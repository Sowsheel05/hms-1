import { Prisma, PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

// Lightweight audit logger stub for standalone execution
const auditService = {
  recordLog: async (data: any, _tx?: any, _notify?: boolean) => {
    try {
      console.log(`[AUDIT LOG] ${data.action} on ${data.entity}: ${data.description}`);
    } catch {
      // Safe fallback
    }
  },
};

// Event emitter stub for standalone execution
const complaintEventsService = {
  emitFeeEvent: (data: any) => {
    try {
      console.log(`[FEE DOMAIN EVENT] ${data.type} (Entity: ${data.entityId || data.studentId || 'GLOBAL'})`);
    } catch {
      // Safe fallback
    }
  },
};

export interface StudentFeeSummary {
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber: string | null;
    blockName: string | null;
    role: string;
  };
  academicYear: {
    id: string;
    code: string;
    name: string;
  };
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  excessPaid: number;
  refundedAmount: number;
  paidPercent: number;
  overallStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  hasActiveDetention: boolean;
  detentionDetails?: any;
  items: Array<{
    id: string;
    feeType: string;
    module: string;
    totalFee: number;
    paidAmount: number;
    concessionAmount: number;
    dueAmount: number;
    excessPaid: number;
    refundedAmount: number;
    paidPercent: number;
    status: string;
    isExtraFee: boolean;
    extraFeeDetails?: any;
  }>;
}

export class FeeCollectionService {
  /**
   * Generates a collision-resistant unique receipt number in format: R-YYYYMMDD-XXXX
   */
  private async generateReceiptNumber(): Promise<string> {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const datePrefix = `R-${yyyy}${mm}${dd}`;

    for (let attempts = 0; attempts < 10; attempts++) {
      const rand = Math.floor(1000 + Math.random() * 9000);
      const candidate = `${datePrefix}-${rand}`;
      const existing = await prisma.feePayment.findUnique({
        where: { receiptNumber: candidate },
      });
      if (!existing) return candidate;
    }
    return `${datePrefix}-${Date.now().toString().slice(-4)}`;
  }

  // =========================================================================
  // STUDENT FEE DETAILS (QUERY / SUMMARY)
  // =========================================================================

  public async getStudentsWithFees(query: {
    academicYearId?: string;
    search?: string;
    module?: string;
    paymentStatus?: string;
    dueStatus?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 15), 1), 100);
    const skip = (page - 1) * limit;

    // Resolve academic year: use given ID or current active academic year
    let targetYear = null;
    if (query.academicYearId && query.academicYearId !== 'ALL') {
      targetYear = await prisma.academicYear.findUnique({
        where: { id: query.academicYearId },
      });
    }
    if (!targetYear) {
      targetYear = await prisma.academicYear.findFirst({
        where: { isCurrent: true },
      });
      if (!targetYear) {
        targetYear = await prisma.academicYear.findFirst({
          orderBy: { startDate: 'desc' },
        });
      }
    }

    if (!targetYear) {
      return {
        academicYear: null,
        students: [],
        pagination: { total: 0, page, limit, totalPages: 0 },
      };
    }

    const studentWhere: Prisma.StudentWhereInput = {
      role: 'STUDENT',
      isActive: true,
    };

    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      studentWhere.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { jntuNo: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { roomNumber: { contains: s, mode: 'insensitive' } },
        { blockName: { contains: s, mode: 'insensitive' } },
      ];
    }

    // Filter by student payment / fee status if requested
    if (query.dueStatus === 'DUES_ONLY') {
      studentWhere.feeItems = {
        some: {
          academicYearId: targetYear.id,
          dueAmount: { gt: 0 },
        },
      };
    } else if (query.dueStatus === 'PAID_ONLY') {
      studentWhere.feeItems = {
        some: {
          academicYearId: targetYear.id,
        },
        none: {
          academicYearId: targetYear.id,
          dueAmount: { gt: 0 },
        },
      };
    }

    const [totalStudents, students] = await Promise.all([
      prisma.student.count({ where: studentWhere }),
      prisma.student.findMany({
        where: studentWhere,
        skip,
        take: limit,
        orderBy: [{ name: 'asc' }],
        include: {
          feeItems: {
            where: {
              academicYearId: targetYear.id,
              ...(query.module && query.module !== 'ALL' ? { module: query.module.toUpperCase() } : {}),
              ...(query.paymentStatus && query.paymentStatus !== 'ALL' ? { status: query.paymentStatus.toUpperCase() } : {}),
            },
            orderBy: [{ createdAt: 'asc' }],
          },
          detentions: {
            where: {
              academicYearId: targetYear.id,
              status: 'ACTIVE',
            },
          },
        },
      }),
    ]);

    const studentSummaries: StudentFeeSummary[] = students.map((st) => {
      let totalFee = 0;
      let paidAmount = 0;
      let concessionAmount = 0;
      let dueAmount = 0;
      let excessPaid = 0;
      let refundedAmount = 0;

      const items = st.feeItems.map((item) => {
        const iTotal = Number(item.totalFee);
        const iPaid = Number(item.paidAmount);
        const iConcession = Number(item.concessionAmount);
        const iDue = Number(item.dueAmount);
        const iExcess = Number(item.excessPaid);
        const iRefund = Number(item.refundedAmount);
        const iPercent = iTotal > 0 ? Math.min(Math.round((iPaid / iTotal) * 100), 100) : 100;

        totalFee += iTotal;
        paidAmount += iPaid;
        concessionAmount += iConcession;
        dueAmount += iDue;
        excessPaid += iExcess;
        refundedAmount += iRefund;

        let extraDetails = null;
        if (item.extraFeeDetails) {
          try {
            extraDetails = JSON.parse(item.extraFeeDetails);
          } catch {}
        }

        return {
          id: item.id,
          feeType: item.feeType,
          module: item.module,
          totalFee: iTotal,
          paidAmount: iPaid,
          concessionAmount: iConcession,
          dueAmount: iDue,
          excessPaid: iExcess,
          refundedAmount: iRefund,
          paidPercent: iPercent,
          status: item.status,
          isExtraFee: item.isExtraFee,
          extraFeeDetails: extraDetails,
        };
      });

      const overallPaidPercent = totalFee > 0 ? Math.min(Math.round((paidAmount / totalFee) * 100), 100) : 100;
      let overallStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID' = 'UNPAID';
      if (items.length > 0) {
        if (dueAmount === 0 && excessPaid > 0) {
          overallStatus = 'OVERPAID';
        } else if (dueAmount === 0) {
          overallStatus = 'PAID';
        } else if (paidAmount > 0 || concessionAmount > 0) {
          overallStatus = 'PARTIAL';
        } else {
          overallStatus = 'UNPAID';
        }
      }

      const activeDetention = st.detentions[0] || null;

      return {
        student: {
          id: st.id,
          name: st.name,
          jntuNo: st.jntuNo,
          email: st.email,
          roomNumber: st.roomNumber,
          blockName: st.blockName,
          role: st.role,
        },
        academicYear: {
          id: targetYear.id,
          code: targetYear.code,
          name: targetYear.name,
        },
        totalFee,
        paidAmount,
        concessionAmount,
        dueAmount,
        excessPaid,
        refundedAmount,
        paidPercent: overallPaidPercent,
        overallStatus,
        hasActiveDetention: !!activeDetention,
        detentionDetails: activeDetention,
        items,
      };
    });

    return {
      academicYear: targetYear,
      students: studentSummaries,
      pagination: {
        total: totalStudents,
        page,
        limit,
        totalPages: Math.ceil(totalStudents / limit),
      },
    };
  }

  public async getStudentFeeDetails(studentId: string, academicYearId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });
    if (!student) throw new Error('Student not found.');

    const year = await prisma.academicYear.findUnique({
      where: { id: academicYearId },
    });
    if (!year) throw new Error('Academic year not found.');

    const [feeItems, payments, detentions, scholarships] = await Promise.all([
      prisma.feeItem.findMany({
        where: { studentId, academicYearId },
        orderBy: [{ createdAt: 'asc' }],
      }),
      prisma.feePayment.findMany({
        where: { studentId, academicYearId },
        orderBy: [{ createdAt: 'desc' }],
        include: {
          bankAccount: true,
          receipt: true,
          allocations: { include: { feeItem: true } },
          refunds: true,
        },
      }),
      prisma.detention.findMany({
        where: { studentId, academicYearId },
        orderBy: [{ createdAt: 'desc' }],
      }),
      prisma.studentScholarship.findMany({
        where: { studentId, academicYearId },
        include: { scholarshipType: true },
      }),
    ]);

    return {
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        email: student.email,
        roomNumber: student.roomNumber,
        blockName: student.blockName,
      },
      academicYear: year,
      feeItems,
      payments,
      detentions,
      scholarships,
    };
  }

  // =========================================================================
  // PAYMENT COLLECTION (TRANSACTIONAL SAFETY)
  // =========================================================================

  /**
   * Authoritative Payment Recording inside PostgreSQL transaction
   */
  public async recordPayment(params: {
    studentId: string;
    academicYearId: string;
    feeItemId?: string; // Optional: specific fee item or auto-allocate across dues
    allocations?: Array<{ feeItemId: string; amount: number }>;
    amount: number;
    paymentMethod: 'UPI' | 'CHEQUE' | 'SBI_COLLECT';
    bankAccountId: string;
    // Method specific dynamic fields
    upiApp?: string;
    upiReference?: string;
    chequeNumber?: string;
    bankName?: string;
    receivedBy?: string;
    sbiCollectReference?: string;
    verifiedBy?: string;
    actorId: string;
    actorRole: string;
  }) {
    const paymentAmount = Number(params.amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      throw new Error('Payment amount must be strictly greater than zero.');
    }

    const strAmount = params.amount.toString();
    if (strAmount.includes('.')) {
      const decimals = strAmount.split('.')[1];
      if (decimals && decimals.length > 2) {
        throw new Error('Payment amount cannot have more than 2 decimal places.');
      }
    }

    // 1. Validate Bank Account (Must exist and be ACTIVE)
    const bankAccount = await prisma.bankAccount.findUnique({
      where: { id: params.bankAccountId },
    });
    if (!bankAccount) {
      throw new Error('Specified bank account does not exist.');
    }
    if (bankAccount.status !== 'ACTIVE') {
      throw new Error(`Bank account '${bankAccount.displayLabel}' is inactive. Cannot process payment.`);
    }

    // 2. Validate Student & Academic Year
    const [student, academicYear] = await Promise.all([
      prisma.student.findUnique({ where: { id: params.studentId } }),
      prisma.academicYear.findUnique({ where: { id: params.academicYearId } }),
    ]);
    if (!student) throw new Error('Student record not found.');
    if (!academicYear) throw new Error('Academic year not found.');

    // 3. Validate payment method specifics & duplicate transaction protection
    let transactionReference = '';
    const methodDetails: Record<string, any> = {
      paymentMethod: params.paymentMethod,
    };

    if (params.paymentMethod === 'UPI') {
      if (!params.upiApp) throw new Error('UPI Application is required (e.g. PhonePe, Google Pay, Paytm).');
      if (!params.upiReference || !params.upiReference.trim()) {
        throw new Error('UPI Reference / Transaction ID is required.');
      }
      transactionReference = params.upiReference.trim().toUpperCase();
      methodDetails.upiApp = params.upiApp;
      methodDetails.upiReference = transactionReference;
    } else if (params.paymentMethod === 'CHEQUE') {
      if (!params.chequeNumber || !params.chequeNumber.trim()) {
        throw new Error('Cheque number is required.');
      }
      if (!params.bankName || !params.bankName.trim()) {
        throw new Error('Issuing bank name is required.');
      }
      if (!params.receivedBy || !params.receivedBy.trim()) {
        throw new Error('Received By staff identifier is required.');
      }
      transactionReference = params.chequeNumber.trim().toUpperCase();
      methodDetails.chequeNumber = transactionReference;
      methodDetails.bankName = params.bankName.trim();
      methodDetails.receivedBy = params.receivedBy.trim();
    } else if (params.paymentMethod === 'SBI_COLLECT') {
      if (!params.sbiCollectReference || !params.sbiCollectReference.trim()) {
        throw new Error('SBI Collect Reference ID is required.');
      }
      if (!params.verifiedBy || !params.verifiedBy.trim()) {
        throw new Error('Verified By staff identifier is required.');
      }
      transactionReference = params.sbiCollectReference.trim().toUpperCase();
      methodDetails.sbiCollectReference = transactionReference;
      methodDetails.verifiedBy = params.verifiedBy.trim();
    } else {
      throw new Error(`Unsupported payment method '${params.paymentMethod}'.`);
    }

    // Duplicate transaction reference check
    const existingPayment = await prisma.feePayment.findFirst({
      where: {
        paymentMethod: params.paymentMethod,
        transactionReference,
        status: { not: 'VOID' },
      },
    });
    if (existingPayment) {
      throw new Error(
        `Duplicate payment reference: Transaction reference '${transactionReference}' is already registered under receipt ${existingPayment.receiptNumber}.`
      );
    }

    // Generate unique receipt number
    const receiptNumber = await this.generateReceiptNumber();

    // 4. Execute atomic PostgreSQL Transaction
    return prisma.$transaction(async (tx) => {
      // Concurrency protection: lock student row to serialize financial mutations
      await tx.$executeRaw`SELECT id FROM "Student" WHERE id = ${student.id} FOR UPDATE`;

      // Resolve fee items and re-calculate dues directly inside transaction
      let targetItems: Array<{ id: string; dueAmount: number; totalFee: number; paidAmount: number; concessionAmount: number }> = [];

      if (params.feeItemId) {
        const item = await tx.feeItem.findUnique({
          where: { id: params.feeItemId },
        });
        if (!item || item.studentId !== student.id) {
          throw new Error('Target fee item not found for this student.');
        }
        targetItems = [{
          id: item.id,
          dueAmount: Number(item.dueAmount),
          totalFee: Number(item.totalFee),
          paidAmount: Number(item.paidAmount),
          concessionAmount: Number(item.concessionAmount),
        }];
      } else if (params.allocations && params.allocations.length > 0) {
        for (const alloc of params.allocations) {
          const item = await tx.feeItem.findUnique({ where: { id: alloc.feeItemId } });
          if (!item || item.studentId !== student.id) {
            throw new Error(`Fee item ${alloc.feeItemId} not found for student.`);
          }
          targetItems.push({
            id: item.id,
            dueAmount: Number(item.dueAmount),
            totalFee: Number(item.totalFee),
            paidAmount: Number(item.paidAmount),
            concessionAmount: Number(item.concessionAmount),
          });
        }
      } else {
        // Auto-allocate across unpaid dues for this academic year
        const unpaid = await tx.feeItem.findMany({
          where: {
            studentId: student.id,
            academicYearId: academicYear.id,
            dueAmount: { gt: 0 },
          },
          orderBy: [{ createdAt: 'asc' }],
        });
        if (unpaid.length === 0) {
          throw new Error('Student has no outstanding unpaid dues in this academic year.');
        }
        targetItems = unpaid.map((it) => ({
          id: it.id,
          dueAmount: Number(it.dueAmount),
          totalFee: Number(it.totalFee),
          paidAmount: Number(it.paidAmount),
          concessionAmount: Number(it.concessionAmount),
        }));
      }

      // Check total due from authoritative DB data
      const totalDue = targetItems.reduce((acc, it) => acc + it.dueAmount, 0);
      if (totalDue <= 0) {
        throw new Error('Target fee item(s) have no outstanding dues to pay.');
      }
      if (paymentAmount > totalDue) {
        throw new Error(
          `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds outstanding due (₹${totalDue.toFixed(2)}). Overpayment not permitted.`
        );
      }

      // Create FeePayment record
      const payment = await tx.feePayment.create({
        data: {
          studentId: student.id,
          academicYearId: academicYear.id,
          bankAccountId: bankAccount.id,
          amount: new Prisma.Decimal(paymentAmount.toFixed(2)),
          paymentMethod: params.paymentMethod,
          transactionReference,
          methodDetails: JSON.stringify(methodDetails),
          status: 'COMPLETED',
          receiptNumber,
          recordedBy: params.actorRole,
          recordedById: params.actorId,
        },
      });

      // Allocate amount across target items
      let remainingToAllocate = paymentAmount;
      const receiptAllocations: Array<{ feeType: string; amount: number }> = [];

      for (const target of targetItems) {
        if (remainingToAllocate <= 0) break;
        let allocAmount = 0;

        if (params.allocations) {
          const explicit = params.allocations.find((a) => a.feeItemId === target.id);
          allocAmount = explicit ? Number(explicit.amount) : Math.min(remainingToAllocate, target.dueAmount);
        } else {
          allocAmount = Math.min(remainingToAllocate, target.dueAmount || remainingToAllocate);
        }

        if (allocAmount <= 0) continue;

        // Record allocation
        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            feeItemId: target.id,
            amount: new Prisma.Decimal(allocAmount.toFixed(2)),
          },
        });

        // Update fee item balance
        const newPaid = target.paidAmount + allocAmount;
        const newDue = Math.max(target.totalFee - newPaid - target.concessionAmount, 0);
        const newExcess = Math.max(newPaid + target.concessionAmount - target.totalFee, 0);
        const newStatus =
          newDue === 0
            ? newExcess > 0
              ? 'OVERPAID'
              : 'PAID'
            : 'PARTIAL';

        const updatedItem = await tx.feeItem.update({
          where: { id: target.id },
          data: {
            paidAmount: new Prisma.Decimal(newPaid.toFixed(2)),
            dueAmount: new Prisma.Decimal(newDue.toFixed(2)),
            excessPaid: new Prisma.Decimal(newExcess.toFixed(2)),
            status: newStatus,
          },
        });

        receiptAllocations.push({
          feeType: updatedItem.feeType,
          amount: allocAmount,
        });

        remainingToAllocate -= allocAmount;
      }

      // Build authoritative receipt snapshot
      const receiptDataSnapshot = {
        receiptNumber,
        paymentId: payment.id,
        student: {
          id: student.id,
          name: student.name,
          jntuNo: student.jntuNo,
          email: student.email,
          roomNumber: student.roomNumber,
          blockName: student.blockName,
        },
        academicYear: {
          id: academicYear.id,
          code: academicYear.code,
          name: academicYear.name,
        },
        bankAccount: {
          id: bankAccount.id,
          name: bankAccount.name,
          identifier: bankAccount.accountIdentifier,
          bankName: bankAccount.bankName,
          accountNumber: `****${bankAccount.accountNumber.slice(-4)}`,
        },
        paymentMethod: params.paymentMethod,
        transactionReference,
        methodDetails,
        totalAmount: paymentAmount,
        allocations: receiptAllocations,
        recordedBy: params.actorRole,
        timestamp: new Date().toISOString(),
      };

      // Create FeeReceipt record
      const receipt = await tx.feeReceipt.create({
        data: {
          receiptNumber,
          paymentId: payment.id,
          studentId: student.id,
          academicYearId: academicYear.id,
          totalAmount: new Prisma.Decimal(paymentAmount.toFixed(2)),
          receiptData: JSON.stringify(receiptDataSnapshot),
        },
      });

      // Record ActivityLog inside transaction
      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'PAYMENT_RECORDED',
          actionType: 'FEE_PAYMENT',
          entity: 'FeePayment',
          entityId: payment.id,
          newState: payment,
          metadata: {
            receiptNumber,
            paymentMethod: params.paymentMethod,
            transactionReference,
            bankAccount: bankAccount.accountIdentifier,
            amount: paymentAmount,
          },
          description: `Recorded ₹${paymentAmount.toFixed(2)} payment (${params.paymentMethod}: ${transactionReference}) for ${student.name} under receipt ${receiptNumber}.`,
        },
        tx,
        false
      );

      // Create student notification
      await tx.notification.create({
        data: {
          studentId: student.id,
          title: 'Fee Payment Received',
          message: `Your payment of ₹${paymentAmount.toLocaleString('en-IN')} has been credited. Receipt: ${receiptNumber}.`,
          type: 'SUCCESS',
          category: 'SYSTEM',
          entityId: payment.id,
        },
      });

      return {
        payment,
        receipt,
        receiptDetails: receiptDataSnapshot,
      };
    }).then((result) => {
      // Emit real-time SSE events after transaction commit
      complaintEventsService.emitFeeEvent({
        type: 'FEE_PAYMENT_CREATED',
        entityId: result.payment.id,
        studentId: params.studentId,
        academicYearId: params.academicYearId,
        details: { receiptNumber: result.payment.receiptNumber, amount: paymentAmount },
        timestamp: new Date().toISOString(),
      });
      complaintEventsService.emitFeeEvent({
        type: 'FEE_COLLECTION_STATS_UPDATED',
        academicYearId: params.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return result;
    });
  }

  // =========================================================================
  // RECEIPTS & PAYMENT HISTORY
  // =========================================================================

  public async getReceiptDetails(receiptNumber: string) {
    const receipt = await prisma.feeReceipt.findUnique({
      where: { receiptNumber: receiptNumber.trim().toUpperCase() },
      include: {
        payment: { include: { bankAccount: true, refunds: true } },
        student: true,
        academicYear: true,
      },
    });
    if (!receipt) throw new Error(`Receipt '${receiptNumber}' not found.`);

    let snapshot: any = null;
    try {
      snapshot = JSON.parse(receipt.receiptData);
    } catch {
      snapshot = null;
    }

    return {
      receipt,
      snapshot,
    };
  }

  public async getPaymentHistory(studentId: string, academicYearId?: string) {
    const where: Prisma.FeePaymentWhereInput = { studentId };
    if (academicYearId && academicYearId !== 'ALL') {
      where.academicYearId = academicYearId;
    }

    return prisma.feePayment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        bankAccount: true,
        receipt: true,
        allocations: { include: { feeItem: true } },
        refunds: true,
      },
    });
  }

  // =========================================================================
  // REFUNDS
  // =========================================================================

  public async processRefund(params: {
    feeItemId: string;
    paymentId?: string;
    amount: number;
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    const refundAmount = Number(params.amount);
    if (isNaN(refundAmount) || refundAmount <= 0) {
      throw new Error('Refund amount must be strictly greater than zero.');
    }
    const strAmount = params.amount.toString();
    if (strAmount.includes('.')) {
      const decimals = strAmount.split('.')[1];
      if (decimals && decimals.length > 2) {
        throw new Error('Refund amount cannot have more than 2 decimal places.');
      }
    }
    const reason = params.reason.trim();
    if (!reason) throw new Error('Refund reason is required.');

    return prisma.$transaction(async (tx) => {
      const feeItem = await tx.feeItem.findUnique({
        where: { id: params.feeItemId },
        include: { student: true },
      });
      if (!feeItem) throw new Error('Fee item not found.');

      // Concurrency protection: lock student row to serialize financial mutations
      await tx.$executeRaw`SELECT id FROM "Student" WHERE id = ${feeItem.studentId} FOR UPDATE`;

      // If paymentId is specified, validate that payment belongs to this student and fee item
      if (params.paymentId) {
        const payment = await tx.feePayment.findUnique({
          where: { id: params.paymentId },
          include: { refunds: true, allocations: true },
        });
        if (!payment) {
          throw new Error('Referenced payment record not found.');
        }
        if (payment.studentId !== feeItem.studentId) {
          throw new Error('Referenced payment does not belong to the student associated with this fee item.');
        }
        if (payment.status === 'REFUNDED') {
          throw new Error(`Payment with receipt ${payment.receiptNumber} has already been fully refunded.`);
        }
        // Verify payment has allocation to this fee item
        const alloc = payment.allocations.find((a) => a.feeItemId === feeItem.id);
        if (!alloc) {
          throw new Error(`Payment with receipt ${payment.receiptNumber} has no allocation towards fee item '${feeItem.feeType}'.`);
        }

        const priorRefunds = payment.refunds.reduce((sum, r) => sum + Number(r.amount), 0);
        const paymentRemaining = Number(payment.amount) - priorRefunds;

        if (refundAmount > paymentRemaining) {
          throw new Error(
            `Refund amount (₹${refundAmount.toFixed(2)}) exceeds remaining balance on payment receipt ${payment.receiptNumber} (₹${paymentRemaining.toFixed(2)}).`
          );
        }

        // If payment is completely refunded, mark payment status as REFUNDED
        if (priorRefunds + refundAmount >= Number(payment.amount)) {
          await tx.feePayment.update({
            where: { id: payment.id },
            data: { status: 'REFUNDED' },
          });
        }
      }

      // Check refundable balance (feeItem.paidAmount is the net paid amount)
      const currentPaid = Number(feeItem.paidAmount);
      const currentRefunded = Number(feeItem.refundedAmount);
      const eligibleMax = currentPaid;

      if (eligibleMax <= 0) {
        throw new Error('This fee item has no refundable paid balance.');
      }
      if (refundAmount > eligibleMax) {
        throw new Error(`Refund amount (₹${refundAmount.toFixed(2)}) exceeds eligible maximum (₹${eligibleMax.toFixed(2)}).`);
      }

      const refund = await tx.feeRefund.create({
        data: {
          feeItemId: feeItem.id,
          paymentId: params.paymentId || null,
          studentId: feeItem.studentId,
          amount: new Prisma.Decimal(refundAmount.toFixed(2)),
          reason,
          status: 'COMPLETED',
          processedBy: params.actorRole,
          processedById: params.actorId,
        },
      });

      const newRefundedTotal = currentRefunded + refundAmount;
      const newPaidBalance = Math.max(currentPaid - refundAmount, 0);
      const totalFee = Number(feeItem.totalFee);
      const concession = Number(feeItem.concessionAmount);
      const newDue = Math.max(totalFee - newPaidBalance - concession, 0);
      const newExcess = Math.max(newPaidBalance + concession - totalFee, 0);
      const newStatus = newDue === 0 ? 'PAID' : newPaidBalance > 0 ? 'PARTIAL' : 'UNPAID';

      const updatedItem = await tx.feeItem.update({
        where: { id: feeItem.id },
        data: {
          paidAmount: new Prisma.Decimal(newPaidBalance.toFixed(2)),
          refundedAmount: new Prisma.Decimal(newRefundedTotal.toFixed(2)),
          dueAmount: new Prisma.Decimal(newDue.toFixed(2)),
          excessPaid: new Prisma.Decimal(newExcess.toFixed(2)),
          status: newStatus,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'PROCESS_REFUND',
          actionType: 'FEE_REFUND',
          entity: 'FeeRefund',
          entityId: refund.id,
          newState: refund,
          metadata: {
            feeItemId: feeItem.id,
            refundAmount,
            reason,
          },
          description: `Processed ₹${refundAmount.toFixed(2)} refund for ${feeItem.student.name} on fee '${feeItem.feeType}'. Reason: ${reason}`,
        },
        tx,
        false
      );

      return { refund, updatedItem };
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_REFUND_CREATED',
        entityId: res.refund.id,
        studentId: res.refund.studentId,
        timestamp: new Date().toISOString(),
      });
      complaintEventsService.emitFeeEvent({
        type: 'FEE_ITEM_UPDATED',
        entityId: res.updatedItem.id,
        studentId: res.updatedItem.studentId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // ADD EXTRA FEE (INCLUDING BIOMETRIC ATTENDANCE CALCULATION)
  // =========================================================================

  public async addExtraFee(params: {
    studentId: string;
    academicYearId: string;
    feeType: string;
    module?: 'HOSTEL' | 'COLLEGE';
    amount?: number;
    isBiometricAttendance?: boolean;
    startDate?: string;
    endDate?: string;
    workingDays?: number;
    dailyRate?: number;
    actorId: string;
    actorRole: string;
  }) {
    const student = await prisma.student.findUnique({ where: { id: params.studentId } });
    if (!student) throw new Error('Student not found.');

    const year = await prisma.academicYear.findUnique({ where: { id: params.academicYearId } });
    if (!year) throw new Error('Academic year not found.');

    let finalAmount = 0;
    const extraDetails: Record<string, any> = {
      isBiometricAttendance: !!params.isBiometricAttendance,
    };

    if (params.isBiometricAttendance) {
      if (!params.startDate || !params.endDate) {
        throw new Error('Start date and end date are required for attendance-based fee calculation.');
      }
      const sDate = new Date(params.startDate);
      const eDate = new Date(params.endDate);
      if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || sDate > eDate) {
        throw new Error('Valid start date and end date range is required.');
      }
      const workingDays = Number(params.workingDays || 30);
      if (isNaN(workingDays) || workingDays <= 0) {
        throw new Error('Working days must be greater than zero.');
      }
      const dailyRate = Number(params.dailyRate || 120);
      if (isNaN(dailyRate) || dailyRate <= 0) {
        throw new Error('Daily rate must be greater than zero.');
      }

      // Query real biometric events for this student within date range
      const eventCount = await prisma.biometricEvent.count({
        where: {
          studentId: student.id,
          eventTimestamp: { gte: sDate, lte: eDate },
          verificationStatus: 'VERIFIED',
          direction: 'IN',
        },
      });

      // Calculate days present (capped at working days)
      const daysPresent = Math.min(Math.max(eventCount, 1), workingDays);
      finalAmount = daysPresent * dailyRate;

      extraDetails.startDate = params.startDate;
      extraDetails.endDate = params.endDate;
      extraDetails.workingDays = workingDays;
      extraDetails.dailyRate = dailyRate;
      extraDetails.biometricEventsVerified = eventCount;
      extraDetails.calculatedDaysPresent = daysPresent;
    } else {
      finalAmount = Number(params.amount);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        throw new Error('Fee amount must be greater than zero.');
      }
      const strAmount = params.amount!.toString();
      if (strAmount.includes('.')) {
        const decimals = strAmount.split('.')[1];
        if (decimals && decimals.length > 2) {
          throw new Error('Fee amount cannot have more than 2 decimal places.');
        }
      }
    }

    return prisma.$transaction(async (tx) => {
      // Concurrency protection: lock student row
      await tx.$executeRaw`SELECT id FROM "Student" WHERE id = ${student.id} FOR UPDATE`;

      const feeItem = await tx.feeItem.create({
        data: {
          studentId: student.id,
          academicYearId: year.id,
          feeType: params.feeType.trim(),
          module: params.module || 'HOSTEL',
          totalFee: new Prisma.Decimal(finalAmount.toFixed(2)),
          paidAmount: new Prisma.Decimal('0.00'),
          concessionAmount: new Prisma.Decimal('0.00'),
          dueAmount: new Prisma.Decimal(finalAmount.toFixed(2)),
          excessPaid: new Prisma.Decimal('0.00'),
          refundedAmount: new Prisma.Decimal('0.00'),
          status: 'UNPAID',
          isExtraFee: true,
          extraFeeDetails: JSON.stringify(extraDetails),
          createdBy: params.actorRole,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'ADD_EXTRA_FEE',
          actionType: 'FEE_ITEM',
          entity: 'FeeItem',
          entityId: feeItem.id,
          newState: feeItem,
          metadata: extraDetails,
          description: `Added extra fee '${feeItem.feeType}' (₹${finalAmount.toFixed(2)}) for ${student.name}.`,
        },
        tx,
        false
      );

      return feeItem;
    }).then((item) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_ITEM_CREATED',
        entityId: item.id,
        studentId: item.studentId,
        academicYearId: item.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return item;
    });
  }

  // =========================================================================
  // PROMOTE STUDENTS (SEMESTER / ACADEMIC YEAR PROGRESSION)
  // =========================================================================

  public async promoteStudents(params: {
    studentIds: string[];
    currentAcademicYearId: string;
    targetAcademicYearId: string;
    promotionType: 'SEMESTER' | 'ACADEMIC_YEAR';
    actorId: string;
    actorRole: string;
  }) {
    const { studentIds, targetAcademicYearId, promotionType, actorId, actorRole } = params;
    if (!studentIds || studentIds.length === 0) {
      throw new Error('At least one student must be selected for promotion.');
    }

    const targetYear = await prisma.academicYear.findUnique({
      where: { id: targetAcademicYearId },
    });
    if (!targetYear) throw new Error('Target academic year does not exist.');

    return prisma.$transaction(async (tx) => {
      const promoted: string[] = [];
      const skippedDetained: string[] = [];

      for (const stId of studentIds) {
        // Check active detention
        const activeDetention = await tx.detention.findFirst({
          where: { studentId: stId, status: 'ACTIVE' },
        });

        if (activeDetention) {
          skippedDetained.push(stId);
          continue;
        }

        promoted.push(stId);
      }

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'PROMOTE_STUDENTS',
          actionType: 'ACADEMIC_PROGRESSION',
          entity: 'AcademicYear',
          entityId: targetAcademicYearId,
          metadata: {
            promotionType,
            promotedCount: promoted.length,
            skippedDetainedCount: skippedDetained.length,
            promotedStudentIds: promoted,
          },
          description: `Promoted ${promoted.length} students to ${targetYear.code} (${promotionType}). ${skippedDetained.length} skipped due to active detention.`,
        },
        tx,
        false
      );

      return {
        targetAcademicYear: targetYear,
        promotedCount: promoted.length,
        skippedDetainedCount: skippedDetained.length,
        promotedStudentIds: promoted,
        skippedDetainedStudentIds: skippedDetained,
      };
    });
  }

  // =========================================================================
  // IDEMPOTENT FEE SYNCHRONIZATION
  // =========================================================================

  public async syncFeeItems(academicYearId: string, actorId: string, actorRole: string) {
    const year = await prisma.academicYear.findUnique({ where: { id: academicYearId } });
    if (!year) throw new Error('Academic year not found.');

    const activeStructures = await prisma.feeStructure.findMany({
      where: { academicYearId: year.id, status: 'ACTIVE' },
    });
    if (activeStructures.length === 0) {
      throw new Error(`No active fee structures found for academic year ${year.code}.`);
    }

    const students = await prisma.student.findMany({
      where: { role: 'STUDENT', isActive: true },
      select: { id: true, name: true, jntuNo: true },
    });

    return prisma.$transaction(async (tx) => {
      let createdCount = 0;
      let preservedCount = 0;

      for (const struct of activeStructures) {
        for (const st of students) {
          const existing = await tx.feeItem.findFirst({
            where: {
              studentId: st.id,
              academicYearId: year.id,
              feeStructureId: struct.id,
            },
          });

          if (existing) {
            preservedCount++;
          } else {
            const amount = Number(struct.amount);
            await tx.feeItem.create({
              data: {
                studentId: st.id,
                academicYearId: year.id,
                feeStructureId: struct.id,
                feeType: struct.name,
                module: struct.module,
                totalFee: new Prisma.Decimal(amount.toFixed(2)),
                paidAmount: new Prisma.Decimal('0.00'),
                concessionAmount: new Prisma.Decimal('0.00'),
                dueAmount: new Prisma.Decimal(amount.toFixed(2)),
                excessPaid: new Prisma.Decimal('0.00'),
                refundedAmount: new Prisma.Decimal('0.00'),
                status: 'UNPAID',
                createdBy: actorRole,
              },
            });
            createdCount++;
          }
        }
      }

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'SYNC_FEE_ITEMS',
          actionType: 'FEE_ITEM',
          entity: 'AcademicYear',
          entityId: year.id,
          metadata: {
            createdCount,
            preservedCount,
            structuresCount: activeStructures.length,
            studentsCount: students.length,
          },
          description: `Synchronized fee assessments for ${year.code}: Created ${createdCount} items, preserved ${preservedCount} existing.`,
        },
        tx,
        false
      );

      return {
        academicYear: year,
        createdCount,
        preservedCount,
        totalEvaluated: createdCount + preservedCount,
      };
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_COLLECTION_STATS_UPDATED',
        academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // BULK OPERATIONS: EXCEL EXPORT & IMPORT
  // =========================================================================

  public async exportFeeCollectionExcel(academicYearId?: string) {
    const year = academicYearId && academicYearId !== 'ALL'
      ? await prisma.academicYear.findUnique({ where: { id: academicYearId } })
      : await prisma.academicYear.findFirst({ where: { isCurrent: true } });

    const where: Prisma.FeeItemWhereInput = year ? { academicYearId: year.id } : {};

    const items = await prisma.feeItem.findMany({
      where,
      include: {
        student: true,
        academicYear: true,
      },
      orderBy: [{ student: { name: 'asc' } }, { feeType: 'asc' }],
    });

    const rows = items.map((it, idx) => ({
      'S.No': idx + 1,
      'Student Name': it.student.name,
      'JNTU / Roll No': it.student.jntuNo,
      'Email': it.student.email,
      'Academic Year': it.academicYear.code,
      'Module': it.module,
      'Fee Type': it.feeType,
      'Total Fee (INR)': Number(it.totalFee),
      'Paid Amount (INR)': Number(it.paidAmount),
      'Concession (INR)': Number(it.concessionAmount),
      'Due Amount (INR)': Number(it.dueAmount),
      'Excess Paid (INR)': Number(it.excessPaid),
      'Refund (INR)': Number(it.refundedAmount),
      'Status': it.status,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fee Collection');

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  public async importFeeExcel(fileBuffer: Buffer, fileName: string, actorId: string, actorRole: string) {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch {
      throw new Error('Invalid Excel file format. Please upload a valid .xlsx or .xls file.');
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new Error('The uploaded Excel workbook contains no sheets.');

    const sheet = workbook.Sheets[firstSheetName];
    const rawRows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rawRows.length === 0) {
      throw new Error('Uploaded Excel file contains no data rows.');
    }

    const errors: Array<{ row: number; error: string }> = [];
    const validRows: Array<{
      studentId: string;
      academicYearId: string;
      feeType: string;
      module: string;
      amount: number;
    }> = [];

    // Row-level schema validation
    for (let i = 0; i < rawRows.length; i++) {
      const r = rawRows[i];
      const rowNum = i + 2; // Accounting for 1-indexed header

      const jntuNo = (r['JNTU / Roll No'] || r['jntuNo'] || r['RollNo'] || r['Roll Number'] || '').toString().trim();
      const academicYearCode = (r['Academic Year'] || r['academicYear'] || r['Year'] || '').toString().trim();
      const feeType = (r['Fee Type'] || r['feeType'] || r['Fee Name'] || '').toString().trim();
      const moduleVal = (r['Module'] || r['module'] || 'COLLEGE').toString().trim().toUpperCase();
      const rawAmount = r['Amount'] || r['Total Fee'] || r['Total Fee (INR)'] || r['totalFee'];

      if (!jntuNo) {
        errors.push({ row: rowNum, error: 'Missing JNTU / Roll Number.' });
        continue;
      }
      if (!feeType) {
        errors.push({ row: rowNum, error: 'Missing Fee Type name.' });
        continue;
      }

      const amount = Number(rawAmount);
      if (isNaN(amount) || amount <= 0) {
        errors.push({ row: rowNum, error: `Invalid amount '${rawAmount}'. Amount must be > 0.` });
        continue;
      }

      // Check student in database
      const student = await prisma.student.findUnique({ where: { jntuNo } });
      if (!student) {
        errors.push({ row: rowNum, error: `Student with JNTU '${jntuNo}' not found.` });
        continue;
      }

      // Check academic year
      let year = null;
      if (academicYearCode) {
        year = await prisma.academicYear.findUnique({ where: { code: academicYearCode } });
      }
      if (!year) {
        year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
      }
      if (!year) {
        errors.push({ row: rowNum, error: `Academic Year '${academicYearCode}' not found.` });
        continue;
      }

      validRows.push({
        studentId: student.id,
        academicYearId: year.id,
        feeType,
        module: moduleVal === 'HOSTEL' ? 'HOSTEL' : 'COLLEGE',
        amount,
      });
    }

    if (errors.length > 0 && validRows.length === 0) {
      throw new Error(`Import validation failed. 0 rows valid out of ${rawRows.length}. First error: ${errors[0].error}`);
    }

    // Process valid rows transactionally
    return prisma.$transaction(async (tx) => {
      let created = 0;
      for (const item of validRows) {
        await tx.feeItem.create({
          data: {
            studentId: item.studentId,
            academicYearId: item.academicYearId,
            feeType: item.feeType,
            module: item.module,
            totalFee: new Prisma.Decimal(item.amount.toFixed(2)),
            paidAmount: new Prisma.Decimal('0.00'),
            concessionAmount: new Prisma.Decimal('0.00'),
            dueAmount: new Prisma.Decimal(item.amount.toFixed(2)),
            excessPaid: new Prisma.Decimal('0.00'),
            refundedAmount: new Prisma.Decimal('0.00'),
            status: 'UNPAID',
            createdBy: actorRole,
          },
        });
        created++;
      }

      const batch = await tx.feeImportBatch.create({
        data: {
          batchType: 'DUES_IMPORT',
          fileName,
          totalRows: rawRows.length,
          successRows: created,
          failedRows: errors.length,
          status: errors.length === 0 ? 'COMPLETED' : created > 0 ? 'PARTIAL' : 'FAILED',
          errorReport: errors.length > 0 ? JSON.stringify(errors) : null,
          uploadedBy: actorRole,
        },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'IMPORT_FEES_EXCEL',
          actionType: 'BULK_IMPORT',
          entity: 'FeeImportBatch',
          entityId: batch.id,
          metadata: {
            fileName,
            totalRows: rawRows.length,
            createdRows: created,
            failedRows: errors.length,
          },
          description: `Imported fee data from '${fileName}': ${created} created, ${errors.length} failed.`,
        },
        tx,
        false
      );

      return {
        batchId: batch.id,
        totalRows: rawRows.length,
        successRows: created,
        failedRows: errors.length,
        errors,
      };
    });
  }

  public async bulkFeeAdjustment(params: {
    feeItemIds: string[];
    adjustmentType: 'DISCOUNT' | 'FINE';
    amount: number;
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    const { feeItemIds, adjustmentType, reason, actorId, actorRole } = params;
    const adjAmount = Number(params.amount);
    if (isNaN(adjAmount) || adjAmount <= 0) throw new Error('Adjustment amount must be greater than zero.');
    if (!reason?.trim()) throw new Error('Reason is required for bulk fee adjustment.');

    return prisma.$transaction(async (tx) => {
      let adjusted = 0;
      for (const id of feeItemIds) {
        const item = await tx.feeItem.findUnique({ where: { id } });
        if (!item) continue;

        if (adjustmentType === 'DISCOUNT') {
          const currentDue = Number(item.dueAmount);
          const currentConcession = Number(item.concessionAmount);
          const discountAmt = Math.min(adjAmount, currentDue);

          const newConcession = currentConcession + discountAmt;
          const newDue = Math.max(currentDue - discountAmt, 0);
          const totalPaid = Number(item.paidAmount) + newConcession;
          const totalFee = Number(item.totalFee);
          const newStatus = newDue === 0 ? 'PAID' : totalPaid > 0 ? 'PARTIAL' : 'UNPAID';

          await tx.feeItem.update({
            where: { id },
            data: {
              concessionAmount: new Prisma.Decimal(newConcession.toFixed(2)),
              dueAmount: new Prisma.Decimal(newDue.toFixed(2)),
              status: newStatus,
            },
          });
          adjusted++;
        } else {
          // FINE: increases totalFee and dueAmount
          const newTotal = Number(item.totalFee) + adjAmount;
          const newDue = Number(item.dueAmount) + adjAmount;

          await tx.feeItem.update({
            where: { id },
            data: {
              totalFee: new Prisma.Decimal(newTotal.toFixed(2)),
              dueAmount: new Prisma.Decimal(newDue.toFixed(2)),
              status: 'PARTIAL',
            },
          });
          adjusted++;
        }
      }

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'BULK_FEE_ADJUSTMENT',
          actionType: 'FEE_ITEM',
          entity: 'FeeItem',
          metadata: { adjustmentType, amount: adjAmount, reason, count: adjusted },
          description: `Bulk ${adjustmentType} of ₹${adjAmount} applied to ${adjusted} fee items. Reason: ${reason}`,
        },
        tx,
        false
      );

      return { adjustedCount: adjusted };
    });
  }

  public async bulkRemoveFee(params: {
    feeItemIds: string[];
    reason: string;
    actorId: string;
    actorRole: string;
  }) {
    const { feeItemIds, reason, actorId, actorRole } = params;
    if (!reason?.trim()) throw new Error('Reason is required to remove fee items.');

    return prisma.$transaction(async (tx) => {
      let removed = 0;
      for (const id of feeItemIds) {
        const item = await tx.feeItem.findUnique({ where: { id } });
        if (!item) continue;
        // Never remove items that have recorded payments!
        if (Number(item.paidAmount) > 0) {
          throw new Error(`Cannot remove fee '${item.feeType}' for student: payment has already been recorded against it.`);
        }

        await tx.feeItem.delete({ where: { id } });
        removed++;
      }

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'BULK_REMOVE_FEE',
          actionType: 'FEE_ITEM',
          entity: 'FeeItem',
          metadata: { reason, count: removed },
          description: `Removed ${removed} unallocated fee items. Reason: ${reason}`,
        },
        tx,
        false
      );

      return { removedCount: removed };
    });
  }
}

export const feeCollectionService = new FeeCollectionService();
