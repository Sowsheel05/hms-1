import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';
import { complaintEventsService, LeaveDomainEvent } from '../services/events.service';
import { notificationService } from '../services/notification.service';

const router = Router();

export const VALID_LEAVE_TYPES = [
  'HOME_LEAVE',
  'MEDICAL',
  'ACADEMIC',
  'EMERGENCY',
  'SPECIAL_LEAVE',
] as const;

export type LeaveType = (typeof VALID_LEAVE_TYPES)[number];

function generateLeaveNumber(leaveType: string): string {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const typeTag = leaveType.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `LEV-${dateStr}-${typeTag}-${randomSuffix}`;
}

/**
 * Calculates effective leave state based on dates and administrative status
 */
export function computeEffectiveStatus(leave: {
  status: string;
  startDate: Date;
  endDate: Date;
}): 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' {
  if (leave.status === 'PENDING') return 'PENDING';
  if (leave.status === 'REJECTED') return 'REJECTED';
  if (leave.status === 'CANCELLED') return 'CANCELLED';

  if (leave.status === 'APPROVED') {
    const now = new Date();
    const start = new Date(leave.startDate);
    const end = new Date(leave.endDate);

    if (now < start) {
      return 'APPROVED';
    } else if (now >= start && now <= end) {
      return 'ACTIVE';
    } else {
      return 'COMPLETED';
    }
  }

  return leave.status as any;
}

/**
 * Builds a chronological timeline for a leave request
 */
function buildLeaveTimeline(leave: any) {
  const effective = computeEffectiveStatus(leave);
  const timeline = [
    {
      step: 'SUBMITTED',
      title: 'Leave Application Submitted',
      timestamp: leave.createdAt,
      description: `Applied for ${leave.leaveType.replace('_', ' ')}`,
      completed: true,
      current: leave.status === 'PENDING',
    },
  ];

  if (leave.status === 'CANCELLED') {
    timeline.push({
      step: 'CANCELLED',
      title: 'Request Cancelled',
      timestamp: leave.updatedAt,
      description: 'Leave request was cancelled by student',
      completed: true,
      current: true,
    });
    return timeline;
  }

  if (leave.status === 'REJECTED') {
    timeline.push({
      step: 'REJECTED',
      title: 'Request Rejected',
      timestamp: leave.updatedAt,
      description: leave.rejectionReason || 'Leave request was rejected by administration',
      completed: true,
      current: true,
    });
    return timeline;
  }

  if (leave.status === 'APPROVED') {
    timeline.push({
      step: 'APPROVED',
      title: 'Leave Approved',
      timestamp: leave.approvedAt || leave.updatedAt,
      description: `Approved by ${leave.approvedBy || 'Hostel Warden'}${leave.remarks ? ` — ${leave.remarks}` : ''}`,
      completed: true,
      current: effective === 'APPROVED',
    });

    timeline.push({
      step: 'ACTIVE',
      title: 'On Leave Period',
      timestamp: leave.startDate,
      description: `Leave duration active from ${new Date(leave.startDate).toLocaleDateString()}`,
      completed: effective === 'ACTIVE' || effective === 'COMPLETED',
      current: effective === 'ACTIVE',
    });

    timeline.push({
      step: 'COMPLETED',
      title: 'Leave Concluded',
      timestamp: leave.endDate,
      description: `Expected return by ${new Date(leave.endDate).toLocaleDateString()}`,
      completed: effective === 'COMPLETED',
      current: effective === 'COMPLETED',
    });
  }

  return timeline;
}

/**
 * Checks if a student currently has an active suspension
 */
export async function getActiveSuspension(studentId: string) {
  const now = new Date();
  const suspension = await prisma.suspension.findFirst({
    where: {
      studentId,
      status: 'ACTIVE',
      startDate: { lte: now },
      endDate: { gte: now },
    },
    orderBy: { endDate: 'desc' },
  });
  return suspension;
}

/**
 * GET /api/student/leaves
 * Returns the student's leave requests, active leave, suspension status, and statistics
 */
router.get('/leaves', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;

    // 1. Fetch student info
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'Student account unavailable or deactivated.',
      });
      return;
    }

    // 2. Check for active suspension
    const activeSuspension = await getActiveSuspension(studentId);

    // 3. Fetch all leave requests
    const leaves = await prisma.leaveRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    // 4. Compute effective states & summary counts
    let activeLeaveRecord: any = null;
    let pendingCount = 0;
    let approvedCount = 0;
    let activeCount = 0;
    let completedCount = 0;
    let rejectedCount = 0;
    let cancelledCount = 0;

    const enrichedLeaves = leaves.map((leave) => {
      const effectiveStatus = computeEffectiveStatus(leave);
      const durationDays = Math.max(
        1,
        Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24))
      );

      if (effectiveStatus === 'PENDING') pendingCount++;
      else if (effectiveStatus === 'APPROVED') approvedCount++;
      else if (effectiveStatus === 'ACTIVE') {
        activeCount++;
        if (!activeLeaveRecord) activeLeaveRecord = { ...leave, effectiveStatus, durationDays };
      } else if (effectiveStatus === 'COMPLETED') completedCount++;
      else if (effectiveStatus === 'REJECTED') rejectedCount++;
      else if (effectiveStatus === 'CANCELLED') cancelledCount++;

      return {
        ...leave,
        effectiveStatus,
        durationDays,
      };
    });

    // 5. Determine high-level student status
    let currentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' = 'ACTIVE';
    if (activeSuspension) {
      currentStatus = 'SUSPENDED';
    } else if (activeLeaveRecord) {
      currentStatus = 'ON_LEAVE';
    }

    // 3b. Fetch all suspension records for student history
    const allSuspensions = await prisma.suspension.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        roomNumber: student.roomNumber,
        blockName: student.blockName,
      },
      currentStatus,
      activeSuspension: activeSuspension
        ? {
            id: activeSuspension.id,
            reason: activeSuspension.reason,
            startDate: activeSuspension.startDate,
            endDate: activeSuspension.endDate,
            createdBy: activeSuspension.createdBy,
            remarks: activeSuspension.remarks,
          }
        : null,
      activeLeave: activeLeaveRecord,
      summary: {
        total: leaves.length,
        pending: pendingCount,
        approved: approvedCount,
        active: activeCount,
        completed: completedCount,
        rejected: rejectedCount,
        cancelled: cancelledCount,
      },
      requests: enrichedLeaves,
      suspensions: allSuspensions,
    });
  } catch (error) {
    console.error('Error fetching leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave records. Please try again.',
    });
  }
});

/**
 * GET /api/student/leaves/status
 * Authoritative endpoint for student's current status (ACTIVE, ON_LEAVE, SUSPENDED)
 */
router.get('/leaves/status', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const activeSuspension = await getActiveSuspension(studentId);

    const now = new Date();
    const activeLeave = await prisma.leaveRequest.findFirst({
      where: {
        studentId,
        status: 'APPROVED',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    let currentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED' = 'ACTIVE';
    if (activeSuspension) {
      currentStatus = 'SUSPENDED';
    } else if (activeLeave) {
      currentStatus = 'ON_LEAVE';
    }

    res.status(200).json({
      success: true,
      currentStatus,
      activeSuspension: activeSuspension || null,
      activeLeave: activeLeave || null,
    });
  } catch (error) {
    console.error('Error fetching student status:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve current status.' });
  }
});

/**
 * GET /api/student/leaves/:id
 * Authoritative detail view for a specific leave request with IDOR protection
 */
router.get('/leaves/:id', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            roomNumber: true,
            blockName: true,
          },
        },
      },
    });

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave request not found.' });
      return;
    }

    // Strict IDOR ownership check
    if (leave.studentId !== req.student.id) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden: You do not have permission to view this leave request.',
      });
      return;
    }

    const effectiveStatus = computeEffectiveStatus(leave);
    const durationDays = Math.max(
      1,
      Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24))
    );
    const timeline = buildLeaveTimeline(leave);

    res.status(200).json({
      success: true,
      leave: {
        ...leave,
        effectiveStatus,
        durationDays,
        canCancel: leave.status === 'PENDING',
        timeline,
      },
    });
  } catch (error) {
    console.error('Error fetching leave details:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve leave details.' });
  }
});

/**
 * POST /api/student/leaves
 * Create a new leave request
 */
router.post('/leaves', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;

    // 1. Suspension Check: Block suspended students
    const activeSuspension = await getActiveSuspension(studentId);
    if (activeSuspension) {
      res.status(403).json({
        success: false,
        message: `Leave application prohibited: Your account is currently suspended until ${new Date(
          activeSuspension.endDate
        ).toLocaleDateString()} (${activeSuspension.reason}).`,
      });
      return;
    }

    const { leaveType, destination, startDate, endDate, reason, emergencyContact } = req.body;

    // 2. Validate leave type
    if (!leaveType || !VALID_LEAVE_TYPES.includes(leaveType)) {
      res.status(400).json({
        success: false,
        message: `Invalid leave type. Must be one of: ${VALID_LEAVE_TYPES.join(', ')}.`,
      });
      return;
    }

    // 3. Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: 'A valid reason of at least 5 characters is required.',
      });
      return;
    }

    // 4. Validate destination
    if (!destination || typeof destination !== 'string' || destination.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'A valid destination address or location is required.',
      });
      return;
    }

    // 5. Validate dates
    if (!startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'Both start date and end date are required.',
      });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid date format provided. Please use standard ISO format.',
      });
      return;
    }

    // Start must be strictly before End
    if (start >= end) {
      res.status(400).json({
        success: false,
        message: 'End date and time must be after the start date and time.',
      });
      return;
    }

    // Start date cannot be in the past (allow current day)
    const todayFloor = new Date();
    todayFloor.setHours(0, 0, 0, 0);
    if (start < todayFloor) {
      res.status(400).json({
        success: false,
        message: 'Start date cannot be in the past.',
      });
      return;
    }

    // Maximum leave duration: 30 days
    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 30) {
      res.status(400).json({
        success: false,
        message: 'Maximum allowed leave duration is 30 consecutive days.',
      });
      return;
    }

    // 6. Conflicting/overlapping leave check
    // Check if there are existing PENDING or APPROVED leaves overlapping with [start, end]
    const conflictingLeave = await prisma.leaveRequest.findFirst({
      where: {
        studentId,
        status: { in: ['PENDING', 'APPROVED'] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
    });

    if (conflictingLeave) {
      res.status(400).json({
        success: false,
        message: `You already have an active, pending, or approved leave request (${conflictingLeave.requestNumber || 'overlapping'}) during this date range.`,
      });
      return;
    }

    // 7. Generate Ticket Number & Save Leave
    const requestNumber = generateLeaveNumber(leaveType);

    const newLeave = await prisma.$transaction(async (tx) => {
      const created = await tx.leaveRequest.create({
        data: {
          requestNumber,
          studentId,
          leaveType,
          destination: destination.trim(),
          startDate: start,
          endDate: end,
          reason: reason.trim(),
          emergencyContact: emergencyContact?.trim() || null,
          status: 'PENDING', // Authoritatively set to PENDING
        },
      });

      // Activity log entry
      await tx.activityLog.create({
        data: {
          studentId,
          actionType: 'LEAVE',
          description: `Submitted leave application ${requestNumber} (${leaveType}) from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        },
      });

      return created;
    });

    // 8. Real-time Domain Event Emission (PostgreSQL committed)
    const event: LeaveDomainEvent = {
      type: 'LEAVE_CREATED',
      leaveId: newLeave.id,
      timestamp: new Date().toISOString(),
    };
    complaintEventsService.emitLeaveEventToStudent(studentId, event);

    // 9. Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Leave Application Submitted',
      message: `Leave application ${requestNumber} (${leaveType.replace('_', ' ')}) has been submitted for review.`,
      type: 'INFO',
      category: 'LEAVE',
      entityId: newLeave.id,
      link: '/leaves',
    }).catch((err) => console.error('Error creating leave notification:', err));

    res.status(201).json({
      success: true,
      message: 'Leave application submitted successfully.',
      leave: {
        ...newLeave,
        effectiveStatus: 'PENDING',
        durationDays: Math.max(1, Math.ceil(durationDays)),
      },
    });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit leave application. Please try again.',
    });
  }
});

/**
 * POST /api/student/leaves/:id/cancel
 * Student cancels a PENDING leave request
 */
router.post('/leaves/:id/cancel', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const { id } = req.params;
    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
    });

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave request not found.' });
      return;
    }

    // Ownership check (IDOR protection)
    if (leave.studentId !== req.student.id) {
      res.status(403).json({
        success: false,
        message: 'Access forbidden: You do not have permission to cancel this leave request.',
      });
      return;
    }

    // Lifecycle check: Only PENDING requests can be cancelled
    if (leave.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Cannot cancel leave request with status '${leave.status}'. Only pending requests can be cancelled.`,
      });
      return;
    }

    // Perform cancellation inside transaction
    const updatedLeave = await prisma.$transaction(async (tx) => {
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'CANCELLED',
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: req.student!.id,
          actionType: 'LEAVE',
          description: `Cancelled leave application ${leave.requestNumber || leave.id}`,
        },
      });

      return updated;
    });

    // Real-time notification
    const event: LeaveDomainEvent = {
      type: 'LEAVE_CANCELLED',
      leaveId: updatedLeave.id,
      timestamp: new Date().toISOString(),
    };
    complaintEventsService.emitLeaveEventToStudent(req.student.id, event);

    // Persistent Notification
    await notificationService.createNotification({
      studentId: req.student!.id,
      title: 'Leave Request Cancelled',
      message: `Leave application ${leave.requestNumber || leave.id} was successfully cancelled.`,
      type: 'INFO',
      category: 'LEAVE',
      entityId: updatedLeave.id,
      link: '/leaves',
    }).catch((err) => console.error('Error creating leave cancel notification:', err));

    res.status(200).json({
      success: true,
      message: 'Leave request cancelled successfully.',
      leave: updatedLeave,
    });
  } catch (error) {
    console.error('Error cancelling leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel leave request. Please try again.',
    });
  }
});

/**
 * Controlled Administrative Test Helper Endpoint
 * Used strictly for testing status transitions (APPROVED, REJECTED) and suspensions
 * without building management UI or violating security boundaries.
 */
router.post('/leaves/test/admin-transition', authenticateManagement, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { leaveId, targetStatus, remarks, approverName } = req.body;

    if (!leaveId || !['APPROVED', 'REJECTED'].includes(targetStatus)) {
      res.status(400).json({
        success: false,
        message: 'Invalid arguments. targetStatus must be APPROVED or REJECTED.',
      });
      return;
    }

    const leave = await prisma.leaveRequest.findUnique({
      where: { id: leaveId },
    });

    if (!leave) {
      res.status(404).json({ success: false, message: 'Leave not found' });
      return;
    }

    const updated = await prisma.leaveRequest.update({
      where: { id: leaveId },
      data: {
        status: targetStatus,
        approvedAt: targetStatus === 'APPROVED' ? new Date() : null,
        approvedBy: targetStatus === 'APPROVED' ? (approverName || 'Hostel Warden') : null,
        remarks: remarks || null,
        rejectionReason: targetStatus === 'REJECTED' ? (remarks || 'Administrative decision') : null,
      },
    });

    // Emit event to student
    const event: LeaveDomainEvent = {
      type: targetStatus === 'APPROVED' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
      leaveId: updated.id,
      timestamp: new Date().toISOString(),
    };
    complaintEventsService.emitLeaveEventToStudent(leave.studentId, event);

    // Persistent Notification
    await notificationService.createNotification({
      studentId: leave.studentId,
      title: targetStatus === 'APPROVED' ? 'Leave Request Approved' : 'Leave Request Rejected',
      message: targetStatus === 'APPROVED'
        ? `Your leave application ${leave.requestNumber || leave.id} has been approved by ${approverName || 'Hostel Warden'}.`
        : `Your leave application ${leave.requestNumber || leave.id} was rejected: ${remarks || 'Administrative decision'}.`,
      type: targetStatus === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      category: 'LEAVE',
      entityId: updated.id,
      link: '/leaves',
    }).catch((err) => console.error('Error creating leave transition notification:', err));

    res.status(200).json({ success: true, leave: updated });
  } catch (error) {
    console.error('Error in admin transition:', error);
    res.status(500).json({ success: false, message: 'Admin transition error' });
  }
});

/**
 * Controlled Administrative Test Helper for Suspension
 */
router.post('/leaves/test/admin-suspension', authenticateManagement, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId, action, reason, startDate, endDate, suspensionId } = req.body;

    if (action === 'CREATE') {
      if (!studentId || !reason || !startDate || !endDate) {
        res.status(400).json({ success: false, message: 'Missing required suspension details' });
        return;
      }

      const suspension = await prisma.suspension.create({
        data: {
          studentId,
          reason,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          status: 'ACTIVE',
          createdBy: 'CHIEF_WARDEN',
          remarks: 'Disciplinary suspension enforced by administrative board.',
        },
      });

      complaintEventsService.emitLeaveEventToStudent(studentId, {
        type: 'SUSPENSION_CREATED',
        suspensionId: suspension.id,
        timestamp: new Date().toISOString(),
      });

      await notificationService.createNotification({
        studentId,
        title: 'Disciplinary Suspension Notice',
        message: `Your hostel account is placed under suspension until ${new Date(endDate).toLocaleDateString()}: ${reason}.`,
        type: 'WARNING',
        category: 'SUSPENSION',
        entityId: suspension.id,
        link: '/leaves',
      }).catch((err) => console.error('Error creating suspension notification:', err));

      res.status(201).json({ success: true, suspension });
      return;
    } else if (action === 'LIFT') {
      if (!suspensionId) {
        res.status(400).json({ success: false, message: 'suspensionId is required to lift' });
        return;
      }

      const updated = await prisma.suspension.update({
        where: { id: suspensionId },
        data: {
          status: 'LIFTED',
          liftedAt: new Date(),
        },
      });

      complaintEventsService.emitLeaveEventToStudent(updated.studentId, {
        type: 'SUSPENSION_LIFTED',
        suspensionId: updated.id,
        timestamp: new Date().toISOString(),
      });

      await notificationService.createNotification({
        studentId: updated.studentId,
        title: 'Disciplinary Suspension Lifted',
        message: 'Your disciplinary suspension has been lifted. Account restored to good standing.',
        type: 'SUCCESS',
        category: 'SUSPENSION',
        entityId: updated.id,
        link: '/leaves',
      }).catch((err) => console.error('Error creating lift suspension notification:', err));

      res.status(200).json({ success: true, suspension: updated });
      return;
    }

    res.status(400).json({ success: false, message: 'Invalid action. Must be CREATE or LIFT' });
  } catch (error) {
    console.error('Error in admin suspension test helper:', error);
    res.status(500).json({ success: false, message: 'Admin suspension test error' });
  }
});

export default router;
