import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';
import { notificationService } from '../services/notification.service';
import { complaintEventsService } from '../services/events.service';
import { getActiveSuspension } from './leave.routes';

const router = Router();

const VALID_PASS_TYPES = ['LOCAL_OUTING', 'EMERGENCY', 'NIGHT_OUT'] as const;
type PassType = (typeof VALID_PASS_TYPES)[number];

function generateRequestNumber(outDate: Date, passType: string): string {
  const dateStr = outDate.toISOString().split('T')[0].replace(/-/g, '');
  const typeTag = passType.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `OUT-${dateStr}-${typeTag}-${randomSuffix}`;
}

/**
 * GET /api/student/outing-requests
 * Returns student's active status, quotas, and complete chronological list of outing requests
 */
router.get('/outing-requests', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 2. Fetch all outing requests for this student
    const requests = await prisma.outingRequest.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Compute counts and status
    const activeOuting = requests.find((r) => r.status === 'OUT');
    const approvedOuting = requests.find((r) => r.status === 'APPROVED');
    const pendingOuting = requests.find((r) => r.status === 'PENDING');

    const activeCount = requests.filter((r) => r.status === 'OUT' || r.status === 'APPROVED').length;
    const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

    const usedThisMonth = requests.filter((r) => r.status === 'RETURNED' && r.createdAt >= startOfMonth).length;
    const monthlyLimit = student.monthlyOutingMax || 5;
    const remainingThisMonth = Math.max(0, monthlyLimit - usedThisMonth);

    let currentStatus = 'In Hostel';
    if (activeOuting) {
      currentStatus = 'Currently Out';
    } else if (approvedOuting) {
      currentStatus = 'Outing Approved';
    } else if (pendingOuting) {
      currentStatus = 'Request Pending';
    }

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        allocationStatus: student.allocationStatus,
        blockName: student.blockName,
        roomNumber: student.roomNumber,
      },
      summary: {
        currentStatus,
        activeCount,
        pendingCount,
        usedThisMonth,
        monthlyLimit,
        remainingThisMonth,
      },
      requests,
    });
  } catch (error) {
    console.error('Error fetching outing requests:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load outing requests. Please try again.',
    });
  }
});

/**
 * POST /api/student/outing-requests
 * Submits a new outing request with strict server-side validation and business rules
 */
router.post('/outing-requests', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
        message: 'This account is currently unavailable.',
      });
      return;
    }

    // 2. Business rule: Must have an active room allocation
    if (student.allocationStatus !== 'ALLOCATED') {
      res.status(403).json({
        success: false,
        message: 'Hostel room allocation required to submit outing requests.',
      });
      return;
    }

    // 3. Suspension Check: Block suspended students
    const activeSuspension = await getActiveSuspension(studentId);
    if (activeSuspension) {
      res.status(403).json({
        success: false,
        code: 'ACCOUNT_SUSPENDED',
        message: `Outing request prohibited: Your account is currently suspended until ${new Date(
          activeSuspension.endDate
        ).toLocaleDateString()} (${activeSuspension.reason}).`,
      });
      return;
    }

    // 4. Business rule: Check monthly quota
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const usedThisMonth = await prisma.outingRequest.count({
      where: {
        studentId,
        status: 'RETURNED',
        createdAt: { gte: startOfMonth },
      },
    });

    if (usedThisMonth >= (student.monthlyOutingMax || 5)) {
      res.status(403).json({
        success: false,
        message: `You have reached your monthly limit of ${student.monthlyOutingMax} outings for this month.`,
      });
      return;
    }

    // 4. Business rule: Prevent conflicting active or pending outings
    const conflictingRequest = await prisma.outingRequest.findFirst({
      where: {
        studentId,
        status: { in: ['PENDING', 'APPROVED', 'OUT'] },
      },
    });

    if (conflictingRequest) {
      res.status(409).json({
        success: false,
        message: `You already have an ongoing outing request (${conflictingRequest.status}). Please resolve or cancel it before submitting a new one.`,
      });
      return;
    }

    // 5. Validate input fields
    const {
      passType = 'LOCAL_OUTING',
      destination,
      purpose,
      outDate,
      returnDate,
      emergencyContact,
      remarks,
    } = req.body;

    if (!destination || typeof destination !== 'string' || destination.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid destination (at least 2 characters).',
      });
      return;
    }

    if (!purpose || typeof purpose !== 'string' || purpose.trim().length < 5) {
      res.status(400).json({
        success: false,
        message: 'Please provide a clear purpose for your outing (at least 5 characters).',
      });
      return;
    }

    const normalizedPassType = (passType || '').toUpperCase() as PassType;
    if (!VALID_PASS_TYPES.includes(normalizedPassType)) {
      res.status(400).json({
        success: false,
        message: `Invalid passType. Supported types: ${VALID_PASS_TYPES.join(', ')}`,
      });
      return;
    }

    if (!outDate || !returnDate) {
      res.status(400).json({
        success: false,
        message: 'Both expected exit time and expected return time are required.',
      });
      return;
    }

    const parsedOutDate = new Date(outDate);
    const parsedReturnDate = new Date(returnDate);

    if (isNaN(parsedOutDate.getTime()) || isNaN(parsedReturnDate.getTime())) {
      res.status(400).json({
        success: false,
        message: 'Invalid date or time format provided.',
      });
      return;
    }

    // Time relationship: Return time must be strictly after exit time
    if (parsedReturnDate.getTime() <= parsedOutDate.getTime()) {
      res.status(400).json({
        success: false,
        message: 'Expected return time must be strictly after the exit time.',
      });
      return;
    }

    // Outing date cannot be in the past (allow 15-minute grace period for network delays)
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);
    if (parsedOutDate < fifteenMinutesAgo) {
      res.status(400).json({
        success: false,
        message: 'Outing exit time cannot be in the past.',
      });
      return;
    }

    // 6. Generate request number and create request
    const requestNumber = generateRequestNumber(parsedOutDate, normalizedPassType);

    const [newRequest] = await prisma.$transaction([
      prisma.outingRequest.create({
        data: {
          requestNumber,
          studentId,
          passType: normalizedPassType,
          destination: destination.trim(),
          purpose: purpose.trim(),
          emergencyContact: typeof emergencyContact === 'string' ? emergencyContact.trim() : null,
          remarks: typeof remarks === 'string' ? remarks.trim() : null,
          outDate: parsedOutDate,
          returnDate: parsedReturnDate,
          status: 'PENDING',
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'OUTING',
          description: `Submitted ${normalizedPassType} request (${requestNumber}) for ${destination.trim()}`,
        },
      }),
    ]);

    // Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Outing Pass Requested',
      message: `Outing pass ${requestNumber} (${normalizedPassType.replace('_', ' ')}) submitted for ${destination.trim()}.`,
      type: 'INFO',
      category: 'OUTING',
      entityId: newRequest.id,
      link: '/outing-requests',
    }).catch((err) => console.error('Error creating outing notification:', err));

    // Real-time notification to management dashboard
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'OUTING_CREATED',
      timestamp: new Date().toISOString(),
      details: { outingId: newRequest.id, studentId },
    });

    res.status(201).json({
      success: true,
      message: 'Outing request submitted successfully.',
      request: newRequest,
    });
  } catch (error) {
    console.error('Error creating outing request:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit outing request. Please try again.',
    });
  }
});

/**
 * POST /api/student/outing-requests/:id/cancel
 * Allows a student to cancel their own PENDING outing request
 */
router.post('/outing-requests/:id/cancel', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;
    const { id } = req.params;

    // 1. Fetch the request
    const outing = await prisma.outingRequest.findUnique({
      where: { id },
    });

    if (!outing) {
      res.status(404).json({
        success: false,
        message: 'Outing request not found.',
      });
      return;
    }

    // 2. Strict authorization: Must belong to current student
    if (outing.studentId !== studentId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this outing request.',
      });
      return;
    }

    // 3. Status rule: Only PENDING requests can be cancelled
    if (outing.status !== 'PENDING') {
      res.status(400).json({
        success: false,
        message: `Only pending requests can be cancelled. Current status is ${outing.status}.`,
      });
      return;
    }

    // 4. Update status and log activity
    const [updated] = await prisma.$transaction([
      prisma.outingRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'OUTING',
          description: `Cancelled outing request (${outing.requestNumber || outing.id})`,
        },
      }),
    ]);

    // Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Outing Request Cancelled',
      message: `Outing pass ${outing.requestNumber || outing.id} has been cancelled.`,
      type: 'INFO',
      category: 'OUTING',
      entityId: updated.id,
      link: '/outing-requests',
    }).catch((err) => console.error('Error creating outing cancel notification:', err));

    // Real-time notification to management dashboard
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'OUTING_CANCELLED',
      timestamp: new Date().toISOString(),
      details: { outingId: updated.id, studentId },
    });

    res.status(200).json({
      success: true,
      message: 'Outing request cancelled successfully.',
      request: updated,
    });
  } catch (error) {
    console.error('Error cancelling outing request:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to cancel outing request. Please try again.',
    });
  }
});

export default router;
