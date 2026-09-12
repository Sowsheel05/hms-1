import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';
import { complaintEventsService } from '../services/events.service';

const router = Router();

/**
 * GET /api/student/dashboard
 * Fetch authenticated student's real hostel dashboard dossier
 */
router.get('/dashboard', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Fetch current student record
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable. Please contact the administrator.',
      });
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Fetch real active outings & month usage
    const activeOutingsCount = await prisma.outingRequest.count({
      where: {
        studentId,
        status: { in: ['OUT', 'APPROVED'] },
      },
    });

    const usedOutingsThisMonth = await prisma.outingRequest.count({
      where: {
        studentId,
        status: 'RETURNED',
        createdAt: { gte: startOfMonth },
      },
    });

    // 3. Fetch real mess tokens booked for today
    const messTokensToday = await prisma.messToken.findMany({
      where: {
        studentId,
        date: todayStr,
        status: 'BOOKED',
      },
      select: {
        mealType: true,
      },
    });

    // 4. Fetch real active leaves
    const activeLeavesCount = await prisma.leaveRequest.count({
      where: {
        studentId,
        status: 'APPROVED',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    // 5. Fetch recent notifications
    const notifications = await prisma.notification.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        title: true,
        message: true,
        type: true,
        isRead: true,
        createdAt: true,
      },
    });

    // 6. Fetch recent activity logs
    const recentActivity = await prisma.activityLog.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        actionType: true,
        description: true,
        createdAt: true,
      },
    });

    // Response structure
    const dashboardData = {
      success: true,
      student: {
        id: student.id,
        jntuNo: student.jntuNo,
        name: student.name,
        email: student.email,
        role: student.role,
      },
      room: {
        status: student.allocationStatus, // ALLOCATED, NOT_ALLOCATED, PENDING
        block: student.blockName,
        roomNumber: student.roomNumber,
        floor: student.floorName,
        bedNumber: student.bedNumber,
        roomType: student.roomType,
      },
      outings: {
        active: activeOutingsCount,
        usedThisMonth: usedOutingsThisMonth,
        limit: student.monthlyOutingMax,
      },
      mess: {
        bookedToday: messTokensToday.length,
        meals: messTokensToday.map((t) => t.mealType),
      },
      leaves: {
        active: activeLeavesCount,
      },
      notifications,
      recentActivity,
    };

    res.status(200).json(dashboardData);
  } catch (error) {
    console.error('Error fetching student dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load your hostel dashboard. Please try again.',
    });
  }
});

/**
 * GET /api/student/events
 * Unified Authoritative Multiplexed SSE Stream for all Student Portal domains
 * Scoped to authenticated student with automatic keep-alive
 */
router.get('/events', authenticateStudent, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.student) {
    res.status(401).json({
      success: false,
      message: 'Authentication required for live events stream.',
    });
    return;
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.flushHeaders?.();
  complaintEventsService.registerClient(req.student.id, res);
});

export default router;
