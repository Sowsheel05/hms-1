import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { biometricService } from '../services/biometric.service';
import { complaintEventsService } from '../services/events.service';

const router = Router();

/**
 * SSE Stream for real-time Biometric events
 * GET /api/student/biometric/events-stream
 */
router.get(
  '/biometric/events-stream',
  authenticateStudent,
  (req: AuthenticatedRequest, res: Response): void => {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    complaintEventsService.registerClient(req.student.id, res);
  }
);

/**
 * GET /api/student/biometric/today
 * Authoritative today's presence state and today's activity stream
 */
router.get(
  '/biometric/today',
  authenticateStudent,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.student) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const { today, todayEvents } = await biometricService.getTodayStatus(req.student.id);

      res.json({
        success: true,
        today,
        todayEvents,
      });
    } catch (err: any) {
      console.error('Error fetching today biometric state:', err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve today biometric state.',
      });
    }
  }
);

/**
 * GET /api/student/biometric/summary
 * Daily aggregated attendance cards (e.g. 7-day or 30-day view)
 */
router.get(
  '/biometric/summary',
  authenticateStudent,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.student) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const days = Number(req.query.days) || 7;
      const dailySummaries = await biometricService.getDailySummaries(req.student.id, days);

      res.json({
        success: true,
        dailySummaries,
      });
    } catch (err: any) {
      console.error('Error fetching daily summaries:', err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve daily summaries.',
      });
    }
  }
);

/**
 * GET /api/student/biometric/events/:id
 * Single event lookup with strict IDOR ownership enforcement
 */
router.get(
  '/biometric/events/:id',
  authenticateStudent,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.student) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const event = await biometricService.getEventById(req.student.id, req.params.id);

      res.json({
        success: true,
        event,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve biometric event.',
      });
    }
  }
);

/**
 * GET /api/student/biometric
 * Overview endpoint: returns today's status card + paginated/filtered event history
 */
router.get(
  '/biometric',
  authenticateStudent,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.student) {
        res.status(401).json({ success: false, message: 'Authentication required.' });
        return;
      }

      const [todayData, historyData] = await Promise.all([
        biometricService.getTodayStatus(req.student.id),
        biometricService.listEvents(req.student.id, {
          page: Number(req.query.page) || 1,
          limit: Number(req.query.limit) || 20,
          dateRange: (req.query.dateRange as string) || 'ALL',
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string,
          eventType: req.query.eventType as string,
          verificationStatus: req.query.verificationStatus as string,
        }),
      ]);

      res.json({
        success: true,
        today: todayData.today,
        events: historyData.events,
        pagination: historyData.pagination,
      });
    } catch (err: any) {
      console.error('Error fetching biometric overview:', err);
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to retrieve biometric overview.',
      });
    }
  }
);

/**
 * STRICT STUDENT RESTRICTION:
 * Biometric records are authoritative physical access events.
 * Students cannot create, edit, or delete biometric records.
 */
router.all(
  ['/biometric', '/biometric/*', '/biometric/events', '/biometric/events/*'],
  (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      res.status(403).json({
        success: false,
        message:
          'Access forbidden: Biometric tracking is an immutable server-authoritative event log. Students cannot create, edit, or delete attendance records.',
      });
      return;
    }
    next();
  }
);

/**
 * Controlled Server-Side Ingestion Endpoint for Testing and Gate Devices.
 * Strictly isolated from student APIs.
 * POST /api/test/biometric/events
 */
export const testBiometricRouter = Router();

testBiometricRouter.post(
  '/test/biometric/events',
  async (req, res): Promise<void> => {
    try {
      const {
        studentId,
        eventType,
        direction,
        verificationStatus,
        eventTimestamp,
        source,
        gate,
        deviceId,
        deviceLabel,
        rejectionReason,
        metadata,
      } = req.body;

      if (!studentId || !eventType) {
        res.status(400).json({
          success: false,
          message: 'Missing required parameters: studentId and eventType are mandatory.',
        });
        return;
      }

      const result = await biometricService.recordIngestedEvent({
        studentId,
        eventType,
        direction,
        verificationStatus,
        eventTimestamp,
        source,
        gate,
        deviceId,
        deviceLabel,
        rejectionReason,
        metadata,
      });

      res.status(201).json({
        success: true,
        message: result.isDuplicate
          ? 'Event deduplicated (identical physical scan).'
          : 'Biometric event recorded successfully.',
        event: result.event,
        isDuplicate: result.isDuplicate,
      });
    } catch (err: any) {
      res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || 'Failed to record biometric event.',
      });
    }
  }
);

export default router;
