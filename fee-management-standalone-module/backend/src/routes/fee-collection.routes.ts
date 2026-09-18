import { Router, Response } from 'express';
import multer from 'multer';
import { Prisma } from '@prisma/client';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { feeCollectionService } from '../services/fee-collection.service';
import { prisma } from '../services/prisma.service';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

router.use(authenticateManagement);

const FINANCIAL_VIEW_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
];
const FINANCIAL_COLLECT_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
];
const FINANCIAL_ADMIN_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
];

// =========================================================================
// 1. STUDENT FEE LIST & DETAILS
// =========================================================================
router.get('/students', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { academicYearId, search, module, paymentStatus, dueStatus, page, limit } = req.query as Record<string, string>;
    const result = await feeCollectionService.getStudentsWithFees({
      academicYearId,
      search,
      module,
      paymentStatus,
      dueStatus,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Fee collection students error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch student fee records.' });
  }
});

router.get('/students/:studentId', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { academicYearId } = req.query as Record<string, string>;
    const details = await feeCollectionService.getStudentFeeDetails(studentId, academicYearId);
    res.json({ success: true, ...details });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Failed to fetch student details.' });
  }
});

// =========================================================================
// 2. PAYMENT COLLECTION (POSTGRESQL TRANSACTION)
// =========================================================================
router.post(
  '/payments',
  requireRoles(...FINANCIAL_COLLECT_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        studentId,
        academicYearId,
        feeItemId,
        allocations,
        amount,
        paymentMethod,
        bankAccountId,
        upiApp,
        upiReference,
        chequeNumber,
        bankName,
        receivedBy,
        sbiCollectReference,
        verifiedBy,
      } = req.body;

      if (!studentId || !academicYearId || amount === undefined || !paymentMethod || !bankAccountId) {
        res.status(400).json({
          success: false,
          message: 'studentId, academicYearId, amount, paymentMethod, and bankAccountId are required.',
        });
        return;
      }

      const result = await feeCollectionService.recordPayment({
        studentId,
        academicYearId,
        feeItemId,
        allocations,
        amount,
        paymentMethod,
        bankAccountId,
        upiApp,
        upiReference,
        chequeNumber,
        bankName,
        receivedBy,
        sbiCollectReference,
        verifiedBy,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({
        success: true,
        payment: result.payment,
        receipt: result.receipt,
        receiptDetails: result.receiptDetails,
        message: `Payment of ₹${Number(amount).toLocaleString('en-IN')} recorded successfully. Receipt: ${result.payment.receiptNumber}`,
      });
    } catch (error: any) {
      console.error('Record payment error:', error);
      res.status(400).json({ success: false, message: error.message || 'Payment processing failed.' });
    }
  }
);

// =========================================================================
// 3. RECEIPTS & PAYMENT HISTORY
// =========================================================================
router.get('/receipts/:receiptNumber', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { receiptNumber } = req.params;
    const details = await feeCollectionService.getReceiptDetails(receiptNumber);
    res.json({ success: true, ...details });
  } catch (error: any) {
    res.status(404).json({ success: false, message: error.message || 'Receipt not found.' });
  }
});

router.get('/students/:studentId/payment-history', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { studentId } = req.params;
    const { academicYearId } = req.query as Record<string, string>;
    const history = await feeCollectionService.getPaymentHistory(studentId, academicYearId);
    res.json({ success: true, payments: history });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch payment history.' });
  }
});

// =========================================================================
// 4. REFUNDS
// =========================================================================
router.post(
  '/refunds',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { feeItemId, paymentId, amount, reason } = req.body;
      if (!feeItemId || amount === undefined || !reason) {
        res.status(400).json({ success: false, message: 'feeItemId, amount, and reason are required.' });
        return;
      }

      const result = await feeCollectionService.processRefund({
        feeItemId,
        paymentId,
        amount,
        reason,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({
        success: true,
        refund: result.refund,
        updatedFeeItem: result.updatedItem,
        message: `Refund of ₹${Number(amount).toFixed(2)} processed successfully.`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Refund failed.' });
    }
  }
);

// =========================================================================
// 5. ADD EXTRA FEE (BIOMETRIC ATTENDANCE OPTION)
// =========================================================================
router.post(
  '/extra-fee',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        studentId,
        academicYearId,
        feeType,
        module,
        amount,
        isBiometricAttendance,
        startDate,
        endDate,
        workingDays,
        dailyRate,
      } = req.body;

      if (!studentId || !academicYearId || !feeType) {
        res.status(400).json({ success: false, message: 'studentId, academicYearId, and feeType are required.' });
        return;
      }

      const item = await feeCollectionService.addExtraFee({
        studentId,
        academicYearId,
        feeType,
        module,
        amount,
        isBiometricAttendance: !!isBiometricAttendance,
        startDate,
        endDate,
        workingDays,
        dailyRate,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, feeItem: item, message: `Extra fee '${item.feeType}' added successfully.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to add extra fee.' });
    }
  }
);

// =========================================================================
// 6. PROMOTE STUDENTS
// =========================================================================
router.post(
  '/promote',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { studentIds, currentAcademicYearId, targetAcademicYearId, promotionType } = req.body;
      if (!studentIds || !targetAcademicYearId) {
        res.status(400).json({ success: false, message: 'studentIds and targetAcademicYearId are required.' });
        return;
      }

      const result = await feeCollectionService.promoteStudents({
        studentIds,
        currentAcademicYearId,
        targetAcademicYearId,
        promotionType: promotionType || 'ACADEMIC_YEAR',
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, ...result, message: `Promotion completed for ${result.promotedCount} students.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Promotion failed.' });
    }
  }
);

// =========================================================================
// 7. SYNC FEE ITEMS (IDEMPOTENT)
// =========================================================================
router.post(
  '/sync-fees',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { academicYearId } = req.body;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId is required.' });
        return;
      }

      const result = await feeCollectionService.syncFeeItems(
        academicYearId,
        req.managementUser!.id,
        req.managementUser!.role
      );

      res.json({
        success: true,
        ...result,
        message: `Synced fees: ${result.createdCount} new assessments created, ${result.preservedCount} existing preserved.`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Fee synchronization failed.' });
    }
  }
);

// =========================================================================
// 8. SEND NOTIFICATIONS TO STUDENTS WITH DUES
// =========================================================================
router.post(
  '/send-notifications',
  requireRoles(...FINANCIAL_COLLECT_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { academicYearId, studentIds, customMessage } = req.body;
      if (!academicYearId) {
        res.status(400).json({ success: false, message: 'academicYearId is required.' });
        return;
      }

      const whereStudent: Prisma.StudentWhereInput = {
        role: 'STUDENT',
        isActive: true,
        feeItems: {
          some: { academicYearId, dueAmount: { gt: 0 } },
        },
      };

      if (studentIds && Array.isArray(studentIds) && studentIds.length > 0) {
        whereStudent.id = { in: studentIds };
      }

      const studentsWithDues = await prisma.student.findMany({
        where: whereStudent,
        include: {
          feeItems: {
            where: { academicYearId, dueAmount: { gt: 0 } },
          },
        },
      });

      let sentCount = 0;
      for (const st of studentsWithDues) {
        const totalDue = st.feeItems.reduce((acc, it) => acc + Number(it.dueAmount), 0);
        await prisma.notification.create({
          data: {
            studentId: st.id,
            title: 'Pending Fee Due Reminder',
            message:
              customMessage ||
              `Dear ${st.name}, you have an outstanding fee due of ₹${totalDue.toLocaleString('en-IN')}. Please settle your dues at the administrative office or online.`,
            type: 'WARNING',
            category: 'SYSTEM',
          },
        });
        sentCount++;
      }

      res.json({
        success: true,
        sentCount,
        message: `Fee due notification sent to ${sentCount} student(s).`,
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message || 'Failed to send notifications.' });
    }
  }
);

// =========================================================================
// 9. EXCEL EXPORT & IMPORT
// =========================================================================
router.get('/export-excel', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { academicYearId } = req.query as Record<string, string>;
    const buffer = await feeCollectionService.exportFeeCollectionExcel(academicYearId);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=fee-collection-${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to export Excel report.' });
  }
});

router.post(
  '/import-excel',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  upload.single('file'),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'Please upload an Excel (.xlsx or .xls) file.' });
        return;
      }

      const result = await feeCollectionService.importFeeExcel(
        req.file.buffer,
        req.file.originalname,
        req.managementUser!.id,
        req.managementUser!.role
      );

      res.json({
        success: true,
        ...result,
        message: `Processed ${result.totalRows} rows: ${result.successRows} imported successfully, ${result.failedRows} failed.`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Excel import failed.' });
    }
  }
);

// =========================================================================
// 10. BULK ADJUST & BULK REMOVE
// =========================================================================
router.post(
  '/bulk-adjust',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { feeItemIds, adjustmentType, amount, reason } = req.body;
      if (!feeItemIds || !Array.isArray(feeItemIds) || feeItemIds.length === 0 || amount === undefined || !reason) {
        res.status(400).json({ success: false, message: 'feeItemIds, adjustmentType, amount, and reason are required.' });
        return;
      }

      const result = await feeCollectionService.bulkFeeAdjustment({
        feeItemIds,
        adjustmentType: adjustmentType || 'DISCOUNT',
        amount,
        reason,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, ...result, message: `Adjusted ${result.adjustedCount} fee items.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Bulk fee adjustment failed.' });
    }
  }
);

router.post(
  '/bulk-remove',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { feeItemIds, reason } = req.body;
      if (!feeItemIds || !Array.isArray(feeItemIds) || feeItemIds.length === 0 || !reason) {
        res.status(400).json({ success: false, message: 'feeItemIds and reason are required.' });
        return;
      }

      const result = await feeCollectionService.bulkRemoveFee({
        feeItemIds,
        reason,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, ...result, message: `Removed ${result.removedCount} fee items.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Bulk fee removal failed.' });
    }
  }
);

export default router;
