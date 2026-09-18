import { Prisma, PrismaClient } from '@prisma/client';

// Use global Prisma instance or fallback instantiation
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

export interface FeeKpiStats {
  feeStructuresCount: number;
  hostelDue: number;
  collegeDue: number;
  studentsWithDuesCount: number;
  scholarshipsPendingCount: number;
  activeDetentionsCount: number;
}

export class FeeManagementService {
  /**
   * Authoritative KPI stats aggregated directly from PostgreSQL
   */
  public async getKpiStats(): Promise<FeeKpiStats> {
    const [
      feeStructuresCount,
      hostelDueAggregate,
      collegeDueAggregate,
      dueFeeItems,
      scholarshipsPendingCount,
      activeDetentionsCount,
    ] = await Promise.all([
      prisma.feeStructure.count({ where: { status: 'ACTIVE' } }),
      prisma.feeItem.aggregate({
        where: { module: 'HOSTEL' },
        _sum: { dueAmount: true },
      }),
      prisma.feeItem.aggregate({
        where: { module: 'COLLEGE' },
        _sum: { dueAmount: true },
      }),
      prisma.feeItem.findMany({
        where: { dueAmount: { gt: 0 } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      prisma.studentScholarship.count({
        where: { status: { in: ['ASSIGNED', 'PENDING'] } },
      }),
      prisma.detention.count({
        where: { status: 'ACTIVE' },
      }),
    ]);

    const hostelDue = Number(hostelDueAggregate._sum.dueAmount || 0);
    const collegeDue = Number(collegeDueAggregate._sum.dueAmount || 0);
    const studentsWithDuesCount = dueFeeItems.length;

    return {
      feeStructuresCount,
      hostelDue,
      collegeDue,
      studentsWithDuesCount,
      scholarshipsPendingCount,
      activeDetentionsCount,
    };
  }

  // =========================================================================
  // ACADEMIC YEARS
  // =========================================================================

  public async getAcademicYears() {
    return prisma.academicYear.findMany({
      orderBy: [{ isCurrent: 'desc' }, { startDate: 'desc' }],
      include: {
        _count: {
          select: {
            structures: true,
            feeItems: true,
            payments: true,
            scholarships: true,
            detentions: true,
          },
        },
      },
    });
  }

  public async createAcademicYear(params: {
    code: string;
    name: string;
    startDate: string | Date;
    endDate: string | Date;
    isCurrent?: boolean;
    actorId: string;
    actorRole: string;
  }) {
    const code = params.code.trim().toUpperCase();
    const name = params.name.trim();
    const startDate = new Date(params.startDate);
    const endDate = new Date(params.endDate);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      throw new Error('Invalid start date or end date format.');
    }
    if (startDate >= endDate) {
      throw new Error('Start date must be strictly earlier than end date.');
    }

    const existing = await prisma.academicYear.findUnique({ where: { code } });
    if (existing) {
      throw new Error(`Academic Year '${code}' already exists.`);
    }

    return prisma.$transaction(async (tx) => {
      if (params.isCurrent) {
        await tx.academicYear.updateMany({
          where: { isCurrent: true },
          data: { isCurrent: false },
        });
      }

      const year = await tx.academicYear.create({
        data: {
          code,
          name,
          startDate,
          endDate,
          isCurrent: !!params.isCurrent,
          status: 'ACTIVE',
          createdBy: params.actorRole,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'CREATE_ACADEMIC_YEAR',
          actionType: 'ACADEMIC_YEAR',
          entity: 'AcademicYear',
          entityId: year.id,
          newState: year,
          description: `Created academic year ${year.code} (${year.name}).`,
        },
        tx,
        false
      );

      return year;
    }).then((year) => {
      complaintEventsService.emitFeeEvent({
        type: 'ACADEMIC_YEAR_UPDATED',
        academicYearId: year.id,
        timestamp: new Date().toISOString(),
      });
      return year;
    });
  }

  public async setCurrentAcademicYear(id: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const year = await tx.academicYear.findUnique({ where: { id } });
      if (!year) throw new Error('Academic year not found.');

      await tx.academicYear.updateMany({
        data: { isCurrent: false },
      });

      const updated = await tx.academicYear.update({
        where: { id },
        data: { isCurrent: true, status: 'ACTIVE' },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'SET_CURRENT_ACADEMIC_YEAR',
          actionType: 'ACADEMIC_YEAR',
          entity: 'AcademicYear',
          entityId: id,
          previousState: year,
          newState: updated,
          description: `Designated academic year ${year.code} as current.`,
        },
        tx,
        false
      );

      return updated;
    }).then((updated) => {
      complaintEventsService.emitFeeEvent({
        type: 'ACADEMIC_YEAR_UPDATED',
        academicYearId: updated.id,
        timestamp: new Date().toISOString(),
      });
      return updated;
    });
  }

  // =========================================================================
  // FEE STRUCTURES
  // =========================================================================

  public async getFeeStructures(query?: {
    module?: string;
    academicYearId?: string;
    category?: string;
    status?: string;
    search?: string;
  }) {
    const where: Prisma.FeeStructureWhereInput = {};

    if (query?.module && query.module !== 'ALL') {
      where.module = query.module.toUpperCase();
    }
    if (query?.academicYearId && query.academicYearId !== 'ALL') {
      where.academicYearId = query.academicYearId;
    }
    if (query?.category && query.category !== 'ALL') {
      where.category = query.category;
    }
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status.toUpperCase();
    }
    if (query?.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { feeKind: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }

    return prisma.feeStructure.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        academicYear: true,
        _count: {
          select: { feeItems: true },
        },
      },
    });
  }

  public async createFeeStructure(params: {
    academicYearId: string;
    module: 'HOSTEL' | 'COLLEGE';
    category?: string;
    feeKind: string;
    name: string;
    amount: number | string;
    applicability?: any;
    effectiveFrom?: string | Date;
    effectiveTo?: string | Date;
    actorId: string;
    actorRole: string;
  }) {
    const numAmount = Number(params.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      throw new Error('Amount must be a strictly positive number.');
    }

    const year = await prisma.academicYear.findUnique({
      where: { id: params.academicYearId },
    });
    if (!year) throw new Error('Academic year does not exist.');

    return prisma.$transaction(async (tx) => {
      const structure = await tx.feeStructure.create({
        data: {
          academicYearId: params.academicYearId,
          module: params.module,
          category: (params.category || 'REGULAR').toUpperCase(),
          feeKind: params.feeKind.trim().toUpperCase(),
          name: params.name.trim(),
          amount: new Prisma.Decimal(numAmount.toFixed(2)),
          applicability: params.applicability ? JSON.stringify(params.applicability) : null,
          effectiveFrom: params.effectiveFrom ? new Date(params.effectiveFrom) : null,
          effectiveTo: params.effectiveTo ? new Date(params.effectiveTo) : null,
          status: 'ACTIVE',
          createdBy: params.actorRole,
        },
        include: { academicYear: true },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'CREATE_FEE_STRUCTURE',
          actionType: 'FEE_STRUCTURE',
          entity: 'FeeStructure',
          entityId: structure.id,
          newState: structure,
          description: `Created fee structure '${structure.name}' (₹${structure.amount}) for ${year.code}.`,
        },
        tx,
        false
      );

      return structure;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_STRUCTURE_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async updateFeeStructure(
    id: string,
    params: {
      name?: string;
      amount?: number | string;
      category?: string;
      feeKind?: string;
      applicability?: any;
      effectiveFrom?: string | Date;
      effectiveTo?: string | Date;
      actorId: string;
      actorRole: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.feeStructure.findUnique({ where: { id } });
      if (!prev) throw new Error('Fee structure not found.');

      const data: Prisma.FeeStructureUpdateInput = {
        updatedBy: params.actorRole,
      };
      if (params.name) data.name = params.name.trim();
      if (params.category) data.category = params.category.toUpperCase();
      if (params.feeKind) data.feeKind = params.feeKind.trim().toUpperCase();
      if (params.amount !== undefined) {
        const amt = Number(params.amount);
        if (isNaN(amt) || amt <= 0) throw new Error('Amount must be greater than zero.');
        data.amount = new Prisma.Decimal(amt.toFixed(2));
      }
      if (params.applicability !== undefined) {
        data.applicability = params.applicability ? JSON.stringify(params.applicability) : null;
      }
      if (params.effectiveFrom !== undefined) {
        data.effectiveFrom = params.effectiveFrom ? new Date(params.effectiveFrom) : null;
      }
      if (params.effectiveTo !== undefined) {
        data.effectiveTo = params.effectiveTo ? new Date(params.effectiveTo) : null;
      }

      const updated = await tx.feeStructure.update({
        where: { id },
        data,
        include: { academicYear: true },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'UPDATE_FEE_STRUCTURE',
          actionType: 'FEE_STRUCTURE',
          entity: 'FeeStructure',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Updated fee structure '${updated.name}'.`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_STRUCTURE_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async toggleFeeStructureStatus(id: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.feeStructure.findUnique({ where: { id } });
      if (!prev) throw new Error('Fee structure not found.');

      const nextStatus = prev.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = await tx.feeStructure.update({
        where: { id },
        data: { status: nextStatus, updatedBy: actorRole },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'TOGGLE_FEE_STRUCTURE_STATUS',
          actionType: 'FEE_STRUCTURE',
          entity: 'FeeStructure',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Changed fee structure '${prev.name}' status to ${nextStatus}.`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'FEE_STRUCTURE_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // BANK ACCOUNTS
  // =========================================================================

  public async getBankAccounts() {
    return prisma.bankAccount.findMany({
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { payments: true } },
      },
    });
  }

  public async createBankAccount(params: {
    name: string;
    accountIdentifier: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    kind: string;
    module?: string;
    displayLabel?: string;
    actorId: string;
    actorRole: string;
  }) {
    const identifier = params.accountIdentifier.trim().toUpperCase();
    const ifsc = params.ifsc.trim().toUpperCase();

    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(ifsc)) {
      throw new Error('Invalid IFSC format. Expected 4 alphabets, digit 0, and 6 alphanumeric characters (e.g. SBIN0001234).');
    }

    const existing = await prisma.bankAccount.findUnique({
      where: { accountIdentifier: identifier },
    });
    if (existing) {
      throw new Error(`Bank Account identifier '${identifier}' already exists.`);
    }

    const displayLabel =
      params.displayLabel?.trim() ||
      `${params.bankName} - ${params.name} (*${params.accountNumber.slice(-4)})`;

    return prisma.$transaction(async (tx) => {
      const account = await tx.bankAccount.create({
        data: {
          name: params.name.trim(),
          accountIdentifier: identifier,
          bankName: params.bankName.trim(),
          accountNumber: params.accountNumber.trim(),
          ifsc,
          kind: params.kind.toUpperCase(),
          module: (params.module || 'BOTH').toUpperCase(),
          displayLabel,
          status: 'ACTIVE',
          createdBy: params.actorRole,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'CREATE_BANK_ACCOUNT',
          actionType: 'BANK_ACCOUNT',
          entity: 'BankAccount',
          entityId: account.id,
          newState: account,
          description: `Created bank account '${account.accountIdentifier}' (${account.displayLabel}).`,
        },
        tx,
        false
      );

      return account;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'BANK_ACCOUNT_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async updateBankAccount(
    id: string,
    params: {
      name?: string;
      bankName?: string;
      accountNumber?: string;
      ifsc?: string;
      kind?: string;
      module?: string;
      displayLabel?: string;
      actorId: string;
      actorRole: string;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.bankAccount.findUnique({ where: { id } });
      if (!prev) throw new Error('Bank account not found.');

      const data: Prisma.BankAccountUpdateInput = {
        updatedBy: params.actorRole,
      };
      if (params.name) data.name = params.name.trim();
      if (params.bankName) data.bankName = params.bankName.trim();
      if (params.accountNumber) data.accountNumber = params.accountNumber.trim();
      if (params.ifsc) {
        const ifsc = params.ifsc.trim().toUpperCase();
        const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
        if (!ifscRegex.test(ifsc)) throw new Error('Invalid IFSC format.');
        data.ifsc = ifsc;
      }
      if (params.kind) data.kind = params.kind.toUpperCase();
      if (params.module) data.module = params.module.toUpperCase();
      if (params.displayLabel) data.displayLabel = params.displayLabel.trim();

      const updated = await tx.bankAccount.update({
        where: { id },
        data,
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'UPDATE_BANK_ACCOUNT',
          actionType: 'BANK_ACCOUNT',
          entity: 'BankAccount',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Updated bank account '${updated.accountIdentifier}'.`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'BANK_ACCOUNT_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async toggleBankAccountStatus(id: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.bankAccount.findUnique({ where: { id } });
      if (!prev) throw new Error('Bank account not found.');

      const nextStatus = prev.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      const updated = await tx.bankAccount.update({
        where: { id },
        data: { status: nextStatus, updatedBy: actorRole },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'TOGGLE_BANK_ACCOUNT_STATUS',
          actionType: 'BANK_ACCOUNT',
          entity: 'BankAccount',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Changed bank account '${prev.accountIdentifier}' status to ${nextStatus}.`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'BANK_ACCOUNT_UPDATED',
        entityId: res.id,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // SCHOLARSHIPS
  // =========================================================================

  public async getScholarshipTypes() {
    return prisma.scholarshipType.findMany({
      orderBy: { name: 'asc' },
    });
  }

  public async createScholarshipType(params: {
    code: string;
    name: string;
    provider?: string;
    maxAmount?: number;
    description?: string;
  }) {
    return prisma.scholarshipType.create({
      data: {
        code: params.code.trim().toUpperCase(),
        name: params.name.trim(),
        provider: (params.provider || 'GOVERNMENT').toUpperCase(),
        maxAmount: params.maxAmount ? new Prisma.Decimal(params.maxAmount.toFixed(2)) : null,
        description: params.description?.trim(),
      },
    });
  }

  public async getStudentScholarships(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
    scholarshipTypeId?: string;
  }) {
    const where: Prisma.StudentScholarshipWhereInput = {};

    if (query?.academicYearId && query.academicYearId !== 'ALL') {
      where.academicYearId = query.academicYearId;
    }
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status.toUpperCase();
    }
    if (query?.scholarshipTypeId && query.scholarshipTypeId !== 'ALL') {
      where.scholarshipTypeId = query.scholarshipTypeId;
    }
    if (query?.studentSearch && query.studentSearch.trim()) {
      const s = query.studentSearch.trim();
      where.student = {
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { jntuNo: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.studentScholarship.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        student: {
          select: { id: true, name: true, jntuNo: true, email: true, roomNumber: true, blockName: true },
        },
        scholarshipType: true,
        academicYear: true,
      },
    });
  }

  public async assignScholarship(params: {
    studentId: string;
    scholarshipTypeId: string;
    academicYearId: string;
    sanctionedAmount: number;
    referenceNumber?: string;
    remarks?: string;
    actorId: string;
    actorRole: string;
  }) {
    const amt = Number(params.sanctionedAmount);
    if (isNaN(amt) || amt <= 0) throw new Error('Sanctioned amount must be greater than zero.');

    const [student, type, year] = await Promise.all([
      prisma.student.findUnique({ where: { id: params.studentId } }),
      prisma.scholarshipType.findUnique({ where: { id: params.scholarshipTypeId } }),
      prisma.academicYear.findUnique({ where: { id: params.academicYearId } }),
    ]);

    if (!student) throw new Error('Student not found.');
    if (!type) throw new Error('Scholarship type not found.');
    if (!year) throw new Error('Academic year not found.');

    return prisma.$transaction(async (tx) => {
      const assignment = await tx.studentScholarship.create({
        data: {
          studentId: student.id,
          scholarshipTypeId: type.id,
          academicYearId: year.id,
          sanctionedAmount: new Prisma.Decimal(amt.toFixed(2)),
          appliedAmount: new Prisma.Decimal('0.00'),
          remainingAmount: new Prisma.Decimal(amt.toFixed(2)),
          referenceNumber: params.referenceNumber?.trim(),
          remarks: params.remarks?.trim(),
          status: 'ASSIGNED',
          createdBy: params.actorRole,
        },
        include: {
          student: true,
          scholarshipType: true,
          academicYear: true,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'ASSIGN_SCHOLARSHIP',
          actionType: 'SCHOLARSHIP',
          entity: 'StudentScholarship',
          entityId: assignment.id,
          newState: assignment,
          description: `Assigned scholarship '${type.name}' (₹${amt}) to ${student.name} (${student.jntuNo}).`,
        },
        tx,
        false
      );

      return assignment;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'SCHOLARSHIP_UPDATED',
        studentId: res.studentId,
        academicYearId: res.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async approveScholarship(id: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.studentScholarship.findUnique({
        where: { id },
        include: { student: true, scholarshipType: true },
      });
      if (!prev) throw new Error('Scholarship assignment not found.');
      if (prev.status !== 'ASSIGNED' && prev.status !== 'PENDING') {
        throw new Error(`Cannot approve scholarship in '${prev.status}' state.`);
      }

      const updated = await tx.studentScholarship.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedBy: actorRole,
          approvedAt: new Date(),
        },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'APPROVE_SCHOLARSHIP',
          actionType: 'SCHOLARSHIP',
          entity: 'StudentScholarship',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Approved scholarship for ${prev.student.name} (${prev.scholarshipType.name}).`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'SCHOLARSHIP_UPDATED',
        studentId: res.studentId,
        academicYearId: res.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async applyScholarshipToFees(id: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const scholarship = await tx.studentScholarship.findUnique({
        where: { id },
        include: { student: true, scholarshipType: true },
      });
      if (!scholarship) throw new Error('Scholarship assignment not found.');
      if (scholarship.status !== 'APPROVED' && scholarship.status !== 'APPLIED') {
        throw new Error(`Scholarship must be APPROVED to apply towards fees.`);
      }

      await tx.$executeRaw`SELECT id FROM "Student" WHERE id = ${scholarship.studentId} FOR UPDATE`;

      const remainingSanctioned = Number(scholarship.remainingAmount);
      if (remainingSanctioned <= 0) {
        throw new Error('Scholarship has no remaining balance to apply.');
      }

      const feeItems = await tx.feeItem.findMany({
        where: {
          studentId: scholarship.studentId,
          academicYearId: scholarship.academicYearId,
          dueAmount: { gt: 0 },
        },
        orderBy: [{ createdAt: 'asc' }],
      });

      if (feeItems.length === 0) {
        throw new Error('Student has no eligible unpaid fee dues in this academic year.');
      }

      let balanceToApply = remainingSanctioned;
      let totalAppliedThisRound = 0;

      for (const item of feeItems) {
        if (balanceToApply <= 0) break;
        const itemDue = Number(item.dueAmount);
        const applyToItem = Math.min(balanceToApply, itemDue);

        const newConcession = Number(item.concessionAmount) + applyToItem;
        const newDue = Math.max(itemDue - applyToItem, 0);
        const totalPaidAndConcession = Number(item.paidAmount) + newConcession;
        const newStatus =
          newDue === 0
            ? 'PAID'
            : totalPaidAndConcession > 0
            ? 'PARTIAL'
            : 'UNPAID';

        await tx.feeItem.update({
          where: { id: item.id },
          data: {
            concessionAmount: new Prisma.Decimal(newConcession.toFixed(2)),
            dueAmount: new Prisma.Decimal(newDue.toFixed(2)),
            status: newStatus,
          },
        });

        balanceToApply -= applyToItem;
        totalAppliedThisRound += applyToItem;
      }

      const newAppliedTotal = Number(scholarship.appliedAmount) + totalAppliedThisRound;
      const newRemaining = Math.max(Number(scholarship.sanctionedAmount) - newAppliedTotal, 0);
      const newStatus = newRemaining === 0 ? 'CLOSED' : 'APPLIED';

      const updatedScholarship = await tx.studentScholarship.update({
        where: { id },
        data: {
          appliedAmount: new Prisma.Decimal(newAppliedTotal.toFixed(2)),
          remainingAmount: new Prisma.Decimal(newRemaining.toFixed(2)),
          status: newStatus,
          appliedAt: new Date(),
        },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'APPLY_SCHOLARSHIP',
          actionType: 'SCHOLARSHIP',
          entity: 'StudentScholarship',
          entityId: id,
          previousState: scholarship,
          newState: updatedScholarship,
          metadata: {
            appliedAmountInThisOperation: totalAppliedThisRound,
            affectedFeeItemsCount: feeItems.length,
          },
          description: `Applied ₹${totalAppliedThisRound.toFixed(2)} scholarship towards fee dues for ${scholarship.student.name}.`,
        },
        tx,
        false
      );

      return {
        appliedAmount: totalAppliedThisRound,
        updatedScholarship,
      };
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'SCHOLARSHIP_UPDATED',
        studentId: res.updatedScholarship.studentId,
        academicYearId: res.updatedScholarship.academicYearId,
        timestamp: new Date().toISOString(),
      });
      complaintEventsService.emitFeeEvent({
        type: 'FEE_ITEM_UPDATED',
        studentId: res.updatedScholarship.studentId,
        academicYearId: res.updatedScholarship.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // DETENTIONS (Academic Standing)
  // =========================================================================

  public async getDetentions(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
  }) {
    const where: Prisma.DetentionWhereInput = {};

    if (query?.academicYearId && query.academicYearId !== 'ALL') {
      where.academicYearId = query.academicYearId;
    }
    if (query?.status && query.status !== 'ALL') {
      where.status = query.status.toUpperCase();
    }
    if (query?.studentSearch && query.studentSearch.trim()) {
      const s = query.studentSearch.trim();
      where.student = {
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { jntuNo: { contains: s, mode: 'insensitive' } },
          { email: { contains: s, mode: 'insensitive' } },
        ],
      };
    }

    return prisma.detention.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      include: {
        student: {
          select: { id: true, name: true, jntuNo: true, email: true, roomNumber: true, blockName: true },
        },
        academicYear: true,
      },
    });
  }

  public async createDetention(params: {
    studentId: string;
    academicYearId: string;
    currentYearOfStudy: string;
    detainedYearOfStudy: string;
    reason: string;
    remarks?: string;
    actorId: string;
    actorRole: string;
  }) {
    const reason = params.reason.trim();
    if (!reason) throw new Error('Detention reason detail is required.');

    const [student, year] = await Promise.all([
      prisma.student.findUnique({ where: { id: params.studentId } }),
      prisma.academicYear.findUnique({ where: { id: params.academicYearId } }),
    ]);
    if (!student) throw new Error('Student not found.');
    if (!year) throw new Error('Academic year not found.');

    const existingActive = await prisma.detention.findFirst({
      where: {
        studentId: student.id,
        academicYearId: year.id,
        status: 'ACTIVE',
      },
    });
    if (existingActive) {
      throw new Error(`Student ${student.name} already has an active detention for ${year.code}.`);
    }

    return prisma.$transaction(async (tx) => {
      const detention = await tx.detention.create({
        data: {
          studentId: student.id,
          academicYearId: year.id,
          currentYearOfStudy: params.currentYearOfStudy.trim(),
          detainedYearOfStudy: params.detainedYearOfStudy.trim(),
          reason,
          remarks: params.remarks?.trim(),
          status: 'ACTIVE',
          detainedBy: params.actorRole,
        },
        include: { student: true, academicYear: true },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'CREATE_DETENTION',
          actionType: 'DETENTION',
          entity: 'Detention',
          entityId: detention.id,
          newState: detention,
          description: `Placed academic detention on ${student.name} (${student.jntuNo}) for ${year.code}: held in ${detention.detainedYearOfStudy}.`,
        },
        tx,
        false
      );

      return detention;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'DETENTION_UPDATED',
        studentId: res.studentId,
        academicYearId: res.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  public async revokeDetention(id: string, reason: string, actorId: string, actorRole: string) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.detention.findUnique({
        where: { id },
        include: { student: true, academicYear: true },
      });
      if (!prev) throw new Error('Detention record not found.');
      if (prev.status !== 'ACTIVE') {
        throw new Error(`Detention is already in '${prev.status}' status.`);
      }

      const updated = await tx.detention.update({
        where: { id },
        data: {
          status: 'REVOKED',
          revokedBy: actorRole,
          revokedAt: new Date(),
          remarks: reason ? `${prev.remarks ? prev.remarks + ' | ' : ''}Revocation: ${reason}` : prev.remarks,
        },
      });

      await auditService.recordLog(
        {
          actorId,
          actorRole,
          action: 'REVOKE_DETENTION',
          actionType: 'DETENTION',
          entity: 'Detention',
          entityId: id,
          previousState: prev,
          newState: updated,
          description: `Revoked academic detention for ${prev.student.name} (${prev.student.jntuNo}).`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'DETENTION_UPDATED',
        studentId: res.studentId,
        academicYearId: res.academicYearId,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }

  // =========================================================================
  // INSTITUTION SETTINGS
  // =========================================================================

  public async getInstitutionSettings() {
    let settings = await prisma.institutionSettings.findUnique({
      where: { id: 'GLOBAL' },
    });
    if (!settings) {
      settings = await prisma.institutionSettings.create({
        data: {
          id: 'GLOBAL',
          institutionMode: 'BOTH',
          institutionName: 'Harsha Institution of Technology & Sciences',
          institutionCode: 'HITS-01',
          enableScholarships: true,
          enableDetentions: true,
          enableBulkUploads: true,
        },
      });
    }
    return settings;
  }

  public async updateInstitutionSettings(params: {
    institutionMode?: string;
    institutionName?: string;
    institutionCode?: string;
    enableScholarships?: boolean;
    enableDetentions?: boolean;
    enableBulkUploads?: boolean;
    actorId: string;
    actorRole: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const prev = await tx.institutionSettings.findUnique({
        where: { id: 'GLOBAL' },
      });

      const updated = await tx.institutionSettings.upsert({
        where: { id: 'GLOBAL' },
        create: {
          id: 'GLOBAL',
          institutionMode: params.institutionMode || 'BOTH',
          institutionName: params.institutionName || 'Harsha Institution of Technology & Sciences',
          institutionCode: params.institutionCode || 'HITS-01',
          enableScholarships: params.enableScholarships !== undefined ? params.enableScholarships : true,
          enableDetentions: params.enableDetentions !== undefined ? params.enableDetentions : true,
          enableBulkUploads: params.enableBulkUploads !== undefined ? params.enableBulkUploads : true,
          updatedBy: params.actorRole,
        },
        update: {
          institutionMode: params.institutionMode,
          institutionName: params.institutionName,
          institutionCode: params.institutionCode,
          enableScholarships: params.enableScholarships,
          enableDetentions: params.enableDetentions,
          enableBulkUploads: params.enableBulkUploads,
          updatedBy: params.actorRole,
        },
      });

      await auditService.recordLog(
        {
          actorId: params.actorId,
          actorRole: params.actorRole,
          action: 'UPDATE_INSTITUTION_SETTINGS',
          actionType: 'CONFIG_UPDATE',
          entity: 'InstitutionSettings',
          entityId: 'GLOBAL',
          previousState: prev,
          newState: updated,
          description: `Updated institutional configuration (Mode: ${updated.institutionMode}).`,
        },
        tx,
        false
      );

      return updated;
    }).then((res) => {
      complaintEventsService.emitFeeEvent({
        type: 'INSTITUTION_SETTINGS_UPDATED',
        entityId: 'GLOBAL',
        details: res,
        timestamp: new Date().toISOString(),
      });
      return res;
    });
  }
}

export const feeManagementService = new FeeManagementService();
