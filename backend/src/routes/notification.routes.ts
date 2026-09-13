import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { notificationService, VALID_NOTIFICATION_CATEGORIES } from '../services/notification.service';
import { complaintEventsService } from '../services/events.service';

const router = Router();

/**
 * GET /api/student/notifications/events
 * Real-time SSE stream for notifications
 */
router.get('/notifications/events', authenticateStudent, (req: AuthenticatedRequest, res: Response) => {
  if (!req.student) {
    res.status(401).json({ success: false, message: 'Authentication required for live notifications.' });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.flushHeaders?.();
  complaintEventsService.registerClient(req.student.id, res);
});

/**
 * GET /api/student/notifications/unread-count
 * Authoritative unread notification count for global headers & badges
 */
router.get('/notifications/unread-count', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { unreadCount } = await notificationService.getUnreadCount(req.student.id);
    res.status(200).json({
      success: true,
      unreadCount,
    });
  } catch (error) {
    console.error('Error fetching unread notification count:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve unread notification count.' });
  }
});

/**
 * POST /api/student/notifications/read-all
 * Mark all unread notifications as read for authenticated student
 */
router.post('/notifications/read-all', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const result = await notificationService.markAllAsRead(req.student.id);
    res.status(200).json({
      success: true,
      message: `Marked ${result.markedCount} notification(s) as read.`,
      markedCount: result.markedCount,
      unreadCount: result.unreadCount,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark all notifications as read.' });
  }
});

/**
 * GET /api/student/notifications
 * List student notifications with filters, pagination, and counts
 */
router.get('/notifications', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const category = req.query.category as string;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const orderBy = req.query.orderBy as string;

    const result = await notificationService.listNotifications(req.student.id, {
      page,
      limit,
      category,
      unreadOnly,
      orderBy,
    });

    res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Error listing notifications:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notifications.' });
  }
});

/**
 * GET /api/student/notifications/:id
 * Retrieve notification details with strict recipient ownership check
 */
router.get('/notifications/:id', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    const notification = await notificationService.getNotificationById(id, req.student.id);

    if (!notification) {
      res.status(404).json({ success: false, message: 'Notification not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      notification,
    });
  } catch (error: any) {
    if (error.statusCode === 403) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    console.error('Error fetching notification detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve notification details.' });
  }
});

/**
 * POST /api/student/notifications/:id/read
 * Mark a single notification as read with strict ownership check
 */
router.post('/notifications/:id/read', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    const result = await notificationService.markAsRead(id, req.student.id);

    res.status(200).json({
      success: true,
      notification: result.notification,
      unreadCount: result.unreadCount,
    });
  } catch (error: any) {
    if (error.statusCode === 403) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    if (error.statusCode === 404) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, message: 'Failed to update notification state.' });
  }
});

export default router;
