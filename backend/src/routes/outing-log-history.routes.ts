import { Router, Response } from 'express';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { outingLogHistoryService } from '../services/outing-log-history.service';

const router = Router();

// All Outing Log History routes require management authentication
router.use(authenticateManagement);

// Authorized Management Roles
const AUTHORIZED_ROLES = [
  'ADMIN',
  'SUPPORT_ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
  'WARDEN_BOYS',
  'WARDEN_GIRLS',
  'OFFICE_STAFF',
  'FINANCE_OFFICER',
  'COLLEGE_DIRECTOR',
];

/**
 * GET /api/management/outing-log-history
 * Paginated, filtered authoritative list of student outing log movements & KPI statistics
 */
router.get(
  '/',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const {
        page,
        pageSize,
        limit,
        search,
        studentId,
        requestNumber,
        movementType,
        status,
        source,
        from,
        to,
      } = req.query as Record<string, string>;

      const result = await outingLogHistoryService.getOutingLogHistory({
        page: page ? parseInt(page, 10) : undefined,
        pageSize: pageSize ? parseInt(pageSize, 10) : limit ? parseInt(limit, 10) : undefined,
        search,
        studentId,
        requestNumber,
        movementType,
        status,
        source,
        from,
        to,
      });

      res.json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching outing log history:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve outing log history.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/outing-log-history/:id
 * Single read-only detailed view with complete visual lifecycle timeline
 */
router.get(
  '/:id',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id || typeof id !== 'string' || id.trim().length === 0) {
        res.status(400).json({
          success: false,
          message: 'Valid outing request ID is required.',
        });
        return;
      }

      const detail = await outingLogHistoryService.getOutingLogDetail(id.trim());

      res.json({
        success: true,
        data: detail,
      });
    } catch (error: any) {
      if (error.message === 'OUTING_NOT_FOUND') {
        res.status(404).json({
          success: false,
          message: 'Outing log record not found.',
        });
        return;
      }

      console.error('Error fetching outing log detail:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve outing log detail.',
        error: error.message,
      });
    }
  }
);

export default router;
