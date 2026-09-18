import { Router, Response } from 'express';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { feeManagementService } from '../services/fee-management.service';

const router = Router();

// All fee management routes require authentication under management portal
router.use(authenticateManagement);

// Financial Management Roles
const FINANCIAL_VIEW_ROLES = [
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
// 1. KPI STATS
// =========================================================================
router.get('/kpi-stats', requireRoles(...FINANCIAL_VIEW_ROLES), async (_req, res): Promise<void> => {
  try {
    const stats = await feeManagementService.getKpiStats();
    res.json({ success: true, stats });
  } catch (error: any) {
    console.error('Fee KPI stats error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch KPI stats.' });
  }
});

// =========================================================================
// 2. ACADEMIC YEARS
// =========================================================================
router.get('/academic-years', requireRoles(...FINANCIAL_VIEW_ROLES), async (_req, res): Promise<void> => {
  try {
    const years = await feeManagementService.getAcademicYears();
    res.json({ success: true, academicYears: years });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch academic years.' });
  }
});

router.post(
  '/academic-years',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { code, name, startDate, endDate, isCurrent } = req.body;
      if (!code || !name || !startDate || !endDate) {
        res.status(400).json({ success: false, message: 'All fields (code, name, startDate, endDate) are required.' });
        return;
      }

      const year = await feeManagementService.createAcademicYear({
        code,
        name,
        startDate,
        endDate,
        isCurrent: !!isCurrent,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, academicYear: year, message: 'Academic year created successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to create academic year.' });
    }
  }
);

router.patch(
  '/academic-years/:id/set-current',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await feeManagementService.setCurrentAcademicYear(
        id,
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({ success: true, academicYear: updated, message: 'Designated active academic year.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to set current academic year.' });
    }
  }
);

// =========================================================================
// 3. FEE STRUCTURES
// =========================================================================
router.get('/fee-structures', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { module, academicYearId, category, status, search } = req.query as Record<string, string>;
    const structures = await feeManagementService.getFeeStructures({
      module,
      academicYearId,
      category,
      status,
      search,
    });
    res.json({ success: true, feeStructures: structures });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch fee structures.' });
  }
});

router.post(
  '/fee-structures',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { academicYearId, module, category, feeKind, name, amount, applicability, effectiveFrom, effectiveTo } =
        req.body;
      if (!academicYearId || !module || !feeKind || !name || amount === undefined) {
        res.status(400).json({
          success: false,
          message: 'academicYearId, module, feeKind, name, and amount are required fields.',
        });
        return;
      }

      const structure = await feeManagementService.createFeeStructure({
        academicYearId,
        module,
        category,
        feeKind,
        name,
        amount,
        applicability,
        effectiveFrom,
        effectiveTo,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, feeStructure: structure, message: 'Fee structure created successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to create fee structure.' });
    }
  }
);

router.put(
  '/fee-structures/:id',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, amount, category, feeKind, applicability, effectiveFrom, effectiveTo } = req.body;

      const updated = await feeManagementService.updateFeeStructure(id, {
        name,
        amount,
        category,
        feeKind,
        applicability,
        effectiveFrom,
        effectiveTo,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, feeStructure: updated, message: 'Fee structure updated successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to update fee structure.' });
    }
  }
);

router.patch(
  '/fee-structures/:id/toggle-status',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await feeManagementService.toggleFeeStructureStatus(
        id,
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({ success: true, feeStructure: updated, message: `Fee structure status is now ${updated.status}.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to toggle fee structure status.' });
    }
  }
);

// =========================================================================
// 4. BANK ACCOUNTS
// =========================================================================
router.get('/bank-accounts', requireRoles(...FINANCIAL_VIEW_ROLES), async (_req, res): Promise<void> => {
  try {
    const accounts = await feeManagementService.getBankAccounts();
    res.json({ success: true, bankAccounts: accounts });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch bank accounts.' });
  }
});

router.post(
  '/bank-accounts',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { name, accountIdentifier, bankName, accountNumber, ifsc, kind, module, displayLabel } = req.body;
      if (!name || !accountIdentifier || !bankName || !accountNumber || !ifsc || !kind) {
        res.status(400).json({
          success: false,
          message: 'All fields (name, accountIdentifier, bankName, accountNumber, ifsc, kind) are required.',
        });
        return;
      }

      const account = await feeManagementService.createBankAccount({
        name,
        accountIdentifier,
        bankName,
        accountNumber,
        ifsc,
        kind,
        module,
        displayLabel,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, bankAccount: account, message: 'Bank account added successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to create bank account.' });
    }
  }
);

router.put(
  '/bank-accounts/:id',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, bankName, accountNumber, ifsc, kind, module, displayLabel } = req.body;

      const updated = await feeManagementService.updateBankAccount(id, {
        name,
        bankName,
        accountNumber,
        ifsc,
        kind,
        module,
        displayLabel,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, bankAccount: updated, message: 'Bank account updated successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to update bank account.' });
    }
  }
);

router.patch(
  '/bank-accounts/:id/toggle-status',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await feeManagementService.toggleBankAccountStatus(
        id,
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({ success: true, bankAccount: updated, message: `Bank account status is now ${updated.status}.` });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to toggle bank account status.' });
    }
  }
);

// =========================================================================
// 5. SCHOLARSHIPS
// =========================================================================
router.get('/scholarship-types', requireRoles(...FINANCIAL_VIEW_ROLES), async (_req, res): Promise<void> => {
  try {
    const types = await feeManagementService.getScholarshipTypes();
    res.json({ success: true, scholarshipTypes: types });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch scholarship types.' });
  }
});

router.post(
  '/scholarship-types',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { code, name, provider, maxAmount, description } = req.body;
      if (!code || !name) {
        res.status(400).json({ success: false, message: 'code and name are required.' });
        return;
      }
      const type = await feeManagementService.createScholarshipType({
        code,
        name,
        provider,
        maxAmount,
        description,
      });
      res.status(201).json({ success: true, scholarshipType: type });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to create scholarship type.' });
    }
  }
);

router.get('/scholarships', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { studentSearch, academicYearId, status, scholarshipTypeId } = req.query as Record<string, string>;
    const scholarships = await feeManagementService.getStudentScholarships({
      studentSearch,
      academicYearId,
      status,
      scholarshipTypeId,
    });
    res.json({ success: true, scholarships });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch scholarships.' });
  }
});

router.post(
  '/scholarships',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { studentId, scholarshipTypeId, academicYearId, sanctionedAmount, referenceNumber, remarks } = req.body;
      if (!studentId || !scholarshipTypeId || !academicYearId || sanctionedAmount === undefined) {
        res.status(400).json({ success: false, message: 'studentId, scholarshipTypeId, academicYearId, and sanctionedAmount are required.' });
        return;
      }

      const assigned = await feeManagementService.assignScholarship({
        studentId,
        scholarshipTypeId,
        academicYearId,
        sanctionedAmount,
        referenceNumber,
        remarks,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, scholarship: assigned, message: 'Scholarship assigned successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to assign scholarship.' });
    }
  }
);

router.patch(
  '/scholarships/:id/approve',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const approved = await feeManagementService.approveScholarship(
        id,
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({ success: true, scholarship: approved, message: 'Scholarship approved successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to approve scholarship.' });
    }
  }
);

router.post(
  '/scholarships/:id/apply',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const result = await feeManagementService.applyScholarshipToFees(
        id,
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({
        success: true,
        appliedAmount: result.appliedAmount,
        scholarship: result.updatedScholarship,
        message: `Applied ₹${result.appliedAmount.toFixed(2)} towards fee dues.`,
      });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to apply scholarship to fees.' });
    }
  }
);

// =========================================================================
// 6. DETENTIONS (Academic Standing)
// =========================================================================
router.get('/detentions', requireRoles(...FINANCIAL_VIEW_ROLES), async (req, res): Promise<void> => {
  try {
    const { studentSearch, academicYearId, status } = req.query as Record<string, string>;
    const detentions = await feeManagementService.getDetentions({
      studentSearch,
      academicYearId,
      status,
    });
    res.json({ success: true, detentions });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch detentions.' });
  }
});

router.post(
  '/detentions',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { studentId, academicYearId, currentYearOfStudy, detainedYearOfStudy, reason, remarks } = req.body;
      if (!studentId || !academicYearId || !currentYearOfStudy || !detainedYearOfStudy || !reason) {
        res.status(400).json({
          success: false,
          message: 'studentId, academicYearId, currentYearOfStudy, detainedYearOfStudy, and reason are required.',
        });
        return;
      }

      const detention = await feeManagementService.createDetention({
        studentId,
        academicYearId,
        currentYearOfStudy,
        detainedYearOfStudy,
        reason,
        remarks,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.status(201).json({ success: true, detention, message: 'Student detention recorded successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to record detention.' });
    }
  }
);

router.patch(
  '/detentions/:id/revoke',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const revoked = await feeManagementService.revokeDetention(
        id,
        reason || '',
        req.managementUser!.id,
        req.managementUser!.role
      );
      res.json({ success: true, detention: revoked, message: 'Detention revoked successfully.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to revoke detention.' });
    }
  }
);

// =========================================================================
// 7. INSTITUTION SETTINGS
// =========================================================================
router.get('/settings', requireRoles(...FINANCIAL_VIEW_ROLES), async (_req, res): Promise<void> => {
  try {
    const settings = await feeManagementService.getInstitutionSettings();
    res.json({ success: true, settings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch institution settings.' });
  }
});

router.put(
  '/settings',
  requireRoles(...FINANCIAL_ADMIN_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { institutionMode, institutionName, institutionCode, enableScholarships, enableDetentions, enableBulkUploads } =
        req.body;

      const updated = await feeManagementService.updateInstitutionSettings({
        institutionMode,
        institutionName,
        institutionCode,
        enableScholarships,
        enableDetentions,
        enableBulkUploads,
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
      });

      res.json({ success: true, settings: updated, message: 'Institutional configuration updated.' });
    } catch (error: any) {
      res.status(400).json({ success: false, message: error.message || 'Failed to update settings.' });
    }
  }
);

export default router;
