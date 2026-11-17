import { Router, Response } from 'express';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { alertsService } from '../services/alerts.service';

export const alertsManagementRouter = Router();

// All alerts management endpoints require management authentication
alertsManagementRouter.use(authenticateManagement);

// Authorized Roles for Security & Alerts
const AUTHORIZED_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
];

/**
 * GET /api/management/alerts
 * List real-time aggregated alerts (curfew overdues, gate breaches, urgent maintenance, active suspensions)
 */
alertsManagementRouter.get(
  '/',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { severity, type, blockName, limit } = req.query as Record<string, string>;

      // Block-scoping for wardens assigned to specific blocks
      const scopedBlock =
        req.managementUser?.blockName && !['ADMIN', 'HOSTEL_ADMIN'].includes(req.managementUser.role)
          ? req.managementUser.blockName
          : blockName;

      const result = await alertsService.getActiveAlerts({
        severity,
        type,
        blockName: scopedBlock,
        limit: limit ? parseInt(limit, 10) : undefined,
      });

      res.status(200).json({
        success: true,
        ...result,
      });
    } catch (error: any) {
      console.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active alerts.',
        error: error.message,
      });
    }
  }
);

/**
 * GET /api/management/alerts/stats
 * Quick KPI summary of threat level and active alert counts
 */
alertsManagementRouter.get(
  '/stats',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const scopedBlock =
        req.managementUser?.blockName && !['ADMIN', 'HOSTEL_ADMIN'].includes(req.managementUser.role)
          ? req.managementUser.blockName
          : undefined;

      const { stats } = await alertsService.getActiveAlerts({ blockName: scopedBlock, limit: 1 });

      res.status(200).json({
        success: true,
        stats,
      });
    } catch (error: any) {
      console.error('Error fetching alert stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve alert statistics.',
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/management/alerts/broadcast
 * Broadcast an emergency / urgent alert to all residents or specific blocks
 */
alertsManagementRouter.post(
  '/broadcast',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { title, message, severity, recipientScope, blockName, roomNumber, expiresInHours } = req.body;

      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Warden',
        role: req.managementUser?.role || 'WARDEN',
      };

      const result = await alertsService.broadcastEmergencyAlert(
        {
          title,
          message,
          severity: severity || 'HIGH',
          recipientScope: recipientScope || 'ALL_STUDENTS',
          blockName,
          roomNumber,
          expiresInHours: expiresInHours ? parseInt(expiresInHours, 10) : 24,
        },
        actor
      );

      res.status(201).json({
        ...result,
        message: `Alert successfully broadcasted to ${result.recipientsReached} residents.`,
      });
    } catch (error: any) {
      console.error('Error broadcasting emergency alert:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to broadcast emergency alert.',
      });
    }
  }
);

/**
 * POST /api/management/alerts/acknowledge
 * Acknowledge or dismiss an operational alert with warden resolution notes
 */
alertsManagementRouter.post(
  '/acknowledge',
  requireRoles(...AUTHORIZED_ROLES),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { alertId, notes } = req.body;

      if (!alertId) {
        res.status(400).json({ success: false, message: 'Alert ID is required.' });
        return;
      }

      const actor = {
        id: req.managementUser?.id || 'system',
        username: req.managementUser?.name || req.managementUser?.jntuNo || 'Warden',
        role: req.managementUser?.role || 'WARDEN',
      };

      const result = await alertsService.acknowledgeAlert(alertId, notes, actor);

      res.status(200).json({
        ...result,
        message: 'Alert acknowledged and recorded in audit log.',
      });
    } catch (error: any) {
      console.error('Error acknowledging alert:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to acknowledge alert.',
      });
    }
  }
);
