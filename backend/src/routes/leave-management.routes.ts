import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { notificationService } from '../services/notification.service';
import { decodeAcademicInfo } from './mess-management.routes';

export const leaveManagementRouter = Router();
leaveManagementRouter.use(authenticateManagement);

export const suspensionManagementRouter = Router();
suspensionManagementRouter.use(authenticateManagement);

export const VALID_LEAVE_TYPES = [
  'HOME_LEAVE',
  'MEDICAL',
  'ACADEMIC',
  'EMERGENCY',
  'SPECIAL_LEAVE',
] as const;

/**
 * Computes the authoritative effective status of a leave request
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
 * Helper to check active suspension for a student
 */
async function getActiveSuspension(studentId: string, tx?: any) {
  const client = tx || prisma;
  const now = new Date();
  return client.suspension.findFirst({
    where: {
      studentId,
      status: 'ACTIVE',
      endDate: { gte: now },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/* ==========================================================================
   LEAVES MANAGEMENT ENDPOINTS
   ========================================================================== */

/**
 * GET /api/management/leaves/stats
 * Authoritative KPI metrics calculated from PostgreSQL
 */
leaveManagementRouter.get('/stats', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();

    const [
      total,
      pending,
      approvedFuture,
      activeOngoing,
      completedPast,
      rejected,
      cancelled,
      suspendedStudents,
    ] = await Promise.all([
      prisma.leaveRequest.count(),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { gt: now },
        },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          startDate: { lte: now },
          endDate: { gte: now },
        },
      }),
      prisma.leaveRequest.count({
        where: {
          status: 'APPROVED',
          endDate: { lt: now },
        },
      }),
      prisma.leaveRequest.count({ where: { status: 'REJECTED' } }),
      prisma.leaveRequest.count({ where: { status: 'CANCELLED' } }),
      prisma.suspension.groupBy({
        by: ['studentId'],
        where: {
          status: 'ACTIVE',
          endDate: { gte: now },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved: approvedFuture,
        approvedFuture,
        active: activeOngoing,
        activeOngoing,
        completed: completedPast,
        completedPast,
        rejected,
        cancelled,
        suspendedStudents: suspendedStudents.length,
        suspended: suspendedStudents.length,
      },
    });
  } catch (error: any) {
    console.error('Error fetching management leave stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave metrics.',
      error: error.message,
    });
  }
});

/**
 * GET /api/management/leaves
 * Paginated and filterable list of student leave applications
 */
leaveManagementRouter.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      category,
      search,
      blockId,
      gender,
      year,
      date,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const where: any = {};

    // Category / Leave Type filter
    if (category && category !== 'ALL') {
      where.leaveType = category;
    }

    // Status filter based on database status and date computation
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'PENDING') {
        where.status = 'PENDING';
      } else if (upperStatus === 'REJECTED') {
        where.status = 'REJECTED';
      } else if (upperStatus === 'CANCELLED') {
        where.status = 'CANCELLED';
      } else if (upperStatus === 'APPROVED') {
        where.status = 'APPROVED';
        where.startDate = { gt: now };
      } else if (upperStatus === 'ACTIVE' || upperStatus === 'ON_LEAVE') {
        where.status = 'APPROVED';
        where.startDate = { lte: now };
        where.endDate = { gte: now };
      } else if (upperStatus === 'COMPLETED') {
        where.status = 'APPROVED';
        where.endDate = { lt: now };
      }
    }

    // Date filter (matches either startDate or endDate on that calendar day)
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-').map(Number);
      const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      const dayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);

      where.OR = [
        { startDate: { gte: dayStart, lte: dayEnd } },
        { endDate: { gte: dayStart, lte: dayEnd } },
      ];
    }

    // Search filter
    if (search && search.trim().length > 0) {
      const term = search.trim();
      const searchConditions = [
        { requestNumber: { contains: term, mode: 'insensitive' } },
        { destination: { contains: term, mode: 'insensitive' } },
        { reason: { contains: term, mode: 'insensitive' } },
        { student: { name: { contains: term, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: term, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Block ID filter
    if (blockId && blockId !== 'ALL') {
      where.student = {
        ...(where.student || {}),
        roomAllocations: {
          some: {
            status: 'ACTIVE',
            room: {
              blockId: blockId,
            },
          },
        },
      };
    }

    // Gender / Hostel filter
    if (gender && gender !== 'ALL') {
      const g = gender.toUpperCase();
      const pattern = (g === 'GIRLS' || g === 'FEMALE') ? 'girl' : 'boy';
      where.student = {
        ...(where.student || {}),
        OR: [
          { blockName: { contains: pattern, mode: 'insensitive' } },
          {
            roomAllocations: {
              some: {
                status: 'ACTIVE',
                room: {
                  block: {
                    name: { contains: pattern, mode: 'insensitive' },
                  },
                },
              },
            },
          },
        ],
      };
    }

    // Academic Year filter
    if (year && year !== 'ALL') {
      let prefix = '';
      if (year.includes('1')) prefix = '25';
      else if (year.includes('2')) prefix = '24';
      else if (year.includes('3')) prefix = '22';
      else if (year.includes('4')) prefix = '21';

      if (prefix) {
        where.student = {
          ...(where.student || {}),
          jntuNo: { startsWith: prefix, mode: 'insensitive' },
        };
      }
    }

    const [totalCount, leaves] = await Promise.all([
      prisma.leaveRequest.count({ where }),
      prisma.leaveRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          student: {
            include: {
              roomAllocations: {
                where: { status: 'ACTIVE' },
                include: {
                  room: {
                    include: {
                      block: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const items = leaves.map((leave) => {
      const effectiveStatus = computeEffectiveStatus(leave);
      const activeAlloc = leave.student?.roomAllocations?.[0];
      const blockName = activeAlloc?.room?.block?.name || leave.student?.blockName || null;
      const roomNumber = activeAlloc?.room?.roomNumber || leave.student?.roomNumber || null;
      const bedNumber = activeAlloc?.bedNumber || leave.student?.bedNumber || null;
      const academic = decodeAcademicInfo(leave.student?.jntuNo || '');
      const initials = (leave.student?.name || 'ST')
        .split(' ')
        .filter(Boolean)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;

      const durationDays = Math.max(
        1,
        Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24))
      );

      return {
        id: leave.id,
        requestNumber: leave.requestNumber,
        leaveType: leave.leaveType,
        destination: leave.destination,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        durationDays,
        reason: leave.reason,
        emergencyContact: leave.emergencyContact,
        remarks: leave.remarks,
        rejectionReason: leave.rejectionReason || null,
        approvedAt: leave.approvedAt?.toISOString() || null,
        approvedBy: leave.approvedBy || null,
        rejectedAt: leave.rejectedAt?.toISOString() || null,
        rejectedBy: leave.rejectedBy || null,
        status: leave.status,
        effectiveStatus,
        createdAt: leave.createdAt.toISOString(),
        updatedAt: leave.updatedAt.toISOString(),
        avatar: initials,
        student: leave.student
          ? {
              id: leave.student.id,
              name: leave.student.name,
              jntuNo: leave.student.jntuNo,
              email: leave.student.email,
              gender: derivedGender,
              avatar: initials,
              academic,
              blockName,
              roomNumber,
              bedNumber,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching management leaves:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave requests.',
      error: error.message,
    });
  }
});

/**
 * GET /api/management/leaves/:id
 * Authoritative single leave detail with full context
 */
leaveManagementRouter.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const leave = await prisma.leaveRequest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            roomAllocations: {
              where: { status: 'ACTIVE' },
              include: {
                room: {
                  include: {
                    block: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!leave) {
      res.status(404).json({
        success: false,
        message: 'Leave request not found.',
      });
      return;
    }

    const effectiveStatus = computeEffectiveStatus(leave);
    const durationDays = Math.max(
      1,
      Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / (1000 * 60 * 60 * 24))
    );

    const activeAlloc = leave.student?.roomAllocations?.[0];
    const blockName = activeAlloc?.room?.block?.name || leave.student?.blockName || null;
    const roomNumber = activeAlloc?.room?.roomNumber || leave.student?.roomNumber || null;
    const bedNumber = activeAlloc?.bedNumber || leave.student?.bedNumber || null;
    const academic = decodeAcademicInfo(leave.student?.jntuNo || '');
    const initials = (leave.student?.name || 'ST')
      .split(' ')
      .filter(Boolean)
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;

    // Check if student currently has an active suspension
    const activeSuspension = await getActiveSuspension(leave.studentId);

    res.json({
      success: true,
      data: {
        id: leave.id,
        requestNumber: leave.requestNumber,
        leaveType: leave.leaveType,
        destination: leave.destination,
        startDate: leave.startDate.toISOString(),
        endDate: leave.endDate.toISOString(),
        durationDays,
        reason: leave.reason,
        emergencyContact: leave.emergencyContact,
        remarks: leave.remarks,
        rejectionReason: leave.rejectionReason || null,
        approvedAt: leave.approvedAt?.toISOString() || null,
        approvedBy: leave.approvedBy || null,
        rejectedAt: leave.rejectedAt?.toISOString() || null,
        rejectedBy: leave.rejectedBy || null,
        status: leave.status,
        effectiveStatus,
        createdAt: leave.createdAt.toISOString(),
        updatedAt: leave.updatedAt.toISOString(),
        avatar: initials,
        student: leave.student
          ? {
              id: leave.student.id,
              name: leave.student.name,
              jntuNo: leave.student.jntuNo,
              email: leave.student.email,
              gender: derivedGender,
              avatar: initials,
              academic,
              blockName,
              roomNumber,
              bedNumber,
            }
          : null,
        isSuspended: Boolean(activeSuspension),
        activeSuspension: activeSuspension
          ? {
              id: activeSuspension.id,
              reason: activeSuspension.reason,
              startDate: activeSuspension.startDate.toISOString(),
              endDate: activeSuspension.endDate.toISOString(),
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching single leave:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve leave details.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/leaves/:id/approve
 * Authoritative Warden approval with strict business rule revalidation
 */
leaveManagementRouter.post('/:id/approve', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};
    const manager = req.managementUser!;
    const approverName = manager.name || manager.jntuNo || 'Hostel Warden';

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('LEAVE_NOT_FOUND');
      }

      // State machine validation: Only PENDING can be approved
      if (existing.status !== 'PENDING') {
        const error = new Error(`INVALID_STATE_TRANSITION: Cannot approve leave with status "${existing.status}". Only PENDING requests can be approved.`);
        (error as any).status = existing.status;
        throw error;
      }

      // Business Rule Revalidation 1: Student not suspended
      const activeSuspension = await getActiveSuspension(existing.studentId, tx);
      if (activeSuspension) {
        throw new Error(`SUSPENSION_BLOCKED: Student account is currently suspended until ${new Date(activeSuspension.endDate).toLocaleDateString()} (${activeSuspension.reason}). Leave cannot be approved.`);
      }

      // Business Rule Revalidation 2: Valid dates
      const start = new Date(existing.startDate);
      const end = new Date(existing.endDate);

      if (start >= end) {
        throw new Error('INVALID_DATES: End date must be strictly after start date.');
      }

      // Start date cannot be in the past (allow current day)
      const todayFloor = new Date();
      todayFloor.setHours(0, 0, 0, 0);
      if (start < todayFloor) {
        throw new Error('DATE_EXPIRED: Leave start date has already passed. The student must submit a new request with valid dates.');
      }

      // Duration check: <= 30 days
      const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      if (durationDays > 30) {
        throw new Error('DURATION_EXCEEDED: Maximum allowed leave duration is 30 consecutive days.');
      }

      // Business Rule Revalidation 3: Overlapping conflicting leave
      const conflictingLeave = await tx.leaveRequest.findFirst({
        where: {
          studentId: existing.studentId,
          id: { not: existing.id },
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
      });

      if (conflictingLeave) {
        throw new Error(`CONFLICTING_LEAVE: Student already has an approved leave (${conflictingLeave.requestNumber || 'overlapping'}) covering this time period.`);
      }

      const now = new Date();

      // Update LeaveRequest
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          approvedBy: approverName,
          remarks: remarks?.trim() || existing.remarks || null,
        },
      });

      // Create ActivityLog entry
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'LEAVE',
          action: 'APPROVE',
          actorRole: req.managementUser!.role,
          entity: 'LeaveRequest',
          entityId: existing.id,
          previousState: existing.status,
          newState: 'APPROVED',
          description: `Leave application ${existing.requestNumber || existing.id} (${existing.leaveType}) approved by ${approverName}.`,
        },
      });

      // Create persistent Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Leave Request Approved',
          message: `Your leave application ${existing.requestNumber || existing.id} to ${existing.destination || 'destination'} has been approved by ${approverName}.`,
          type: 'SUCCESS',
          category: 'LEAVE',
          entityId: existing.id,
          link: '/leaves',
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // Emit SSE event post-commit
    complaintEventsService.emitLeaveEventToStudent(result.student.id, {
      type: 'LEAVE_APPROVED',
      leaveId: result.updated.id,
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: {
        requestNumber: result.updated.requestNumber,
        approvedBy: approverName,
      },
    });

    res.json({
      success: true,
      message: `Leave application #${result.updated.requestNumber || result.updated.id} approved successfully.`,
      data: {
        id: result.updated.id,
        requestNumber: result.updated.requestNumber,
        status: 'APPROVED',
        approvedAt: result.updated.approvedAt?.toISOString(),
        approvedBy: result.updated.approvedBy,
      },
    });
  } catch (error: any) {
    if (error.message === 'LEAVE_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Leave request not found.' });
      return;
    }

    if (error.message?.startsWith('INVALID_STATE_TRANSITION')) {
      res.status(400).json({
        success: false,
        message: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
      });
      return;
    }

    if (
      error.message?.startsWith('SUSPENSION_BLOCKED') ||
      error.message?.startsWith('INVALID_DATES') ||
      error.message?.startsWith('DATE_EXPIRED') ||
      error.message?.startsWith('DURATION_EXCEEDED') ||
      error.message?.startsWith('CONFLICTING_LEAVE')
    ) {
      res.status(400).json({
        success: false,
        message: error.message.split(': ')[1] || error.message,
      });
      return;
    }

    console.error('Error approving leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve leave request.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/leaves/:id/reject
 * Authoritative Warden rejection requiring minimum 3-character reason
 */
leaveManagementRouter.post('/:id/reject', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    const manager = req.managementUser!;
    const rejectorName = manager.name || manager.jntuNo || 'Hostel Warden';

    // Validation: Rejection reason is strictly required
    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(400).json({
        success: false,
        message: 'A valid rejection reason is required (minimum 3 characters).',
      });
      return;
    }

    const trimmedReason = reason.trim();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.leaveRequest.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('LEAVE_NOT_FOUND');
      }

      // State machine validation: Only PENDING can be rejected
      if (existing.status !== 'PENDING') {
        const error = new Error(`INVALID_STATE_TRANSITION: Cannot reject leave with status "${existing.status}". Only PENDING requests can be rejected.`);
        (error as any).status = existing.status;
        throw error;
      }

      const now = new Date();

      // Update LeaveRequest
      const updated = await tx.leaveRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: trimmedReason,
          rejectedAt: now,
          rejectedBy: rejectorName,
        },
      });

      // Create ActivityLog entry
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'LEAVE',
          action: 'REJECT',
          actorRole: req.managementUser!.role,
          entity: 'LeaveRequest',
          entityId: existing.id,
          previousState: existing.status,
          newState: 'REJECTED',
          description: `Leave application ${existing.requestNumber || existing.id} rejected by ${rejectorName}. Reason: ${trimmedReason}`,
        },
      });

      // Create persistent student Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Leave Request Rejected',
          message: `Your leave application ${existing.requestNumber || existing.id} was rejected by ${rejectorName}. Reason: ${trimmedReason}`,
          type: 'WARNING',
          category: 'LEAVE',
          entityId: existing.id,
          link: '/leaves',
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // Emit SSE event post-commit
    complaintEventsService.emitLeaveEventToStudent(result.student.id, {
      type: 'LEAVE_REJECTED',
      leaveId: result.updated.id,
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: {
        requestNumber: result.updated.requestNumber,
        rejectedBy: rejectorName,
        reason: trimmedReason,
      },
    });

    res.json({
      success: true,
      message: `Leave application #${result.updated.requestNumber || result.updated.id} rejected.`,
      data: {
        id: result.updated.id,
        requestNumber: result.updated.requestNumber,
        status: 'REJECTED',
        rejectedAt: result.updated.rejectedAt?.toISOString(),
        rejectedBy: result.updated.rejectedBy,
        rejectionReason: result.updated.rejectionReason,
      },
    });
  } catch (error: any) {
    if (error.message === 'LEAVE_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Leave request not found.' });
      return;
    }

    if (error.message?.startsWith('INVALID_STATE_TRANSITION')) {
      res.status(400).json({
        success: false,
        message: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
      });
      return;
    }

    console.error('Error rejecting leave request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject leave request.',
      error: error.message,
    });
  }
});

/* ==========================================================================
   SUSPENSIONS MANAGEMENT ENDPOINTS
   ========================================================================== */

/**
 * GET /api/management/suspensions
 * List all disciplinary hostel suspensions
 */
suspensionManagementRouter.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      search,
      blockId,
      gender,
      year,
      page = '1',
      limit = '25',
    } = req.query as Record<string, string>;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    const now = new Date();
    const where: any = {};

    // Status filter: ACTIVE, LIFTED, EXPIRED, ALL
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'ACTIVE') {
        where.status = 'ACTIVE';
        where.endDate = { gte: now };
      } else if (upperStatus === 'EXPIRED') {
        where.OR = [
          { status: 'EXPIRED' },
          { status: 'ACTIVE', endDate: { lt: now } },
        ];
      } else if (upperStatus === 'LIFTED') {
        where.status = 'LIFTED';
      }
    }

    // Search filter
    if (search && search.trim().length > 0) {
      const term = search.trim();
      const searchConditions = [
        { reason: { contains: term, mode: 'insensitive' } },
        { remarks: { contains: term, mode: 'insensitive' } },
        { student: { name: { contains: term, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: term, mode: 'insensitive' } } },
      ];

      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchConditions }];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Block ID filter
    if (blockId && blockId !== 'ALL') {
      where.student = {
        ...(where.student || {}),
        roomAllocations: {
          some: {
            status: 'ACTIVE',
            room: {
              blockId: blockId,
            },
          },
        },
      };
    }

    // Gender / Hostel filter
    if (gender && gender !== 'ALL') {
      const g = gender.toUpperCase();
      const pattern = (g === 'GIRLS' || g === 'FEMALE') ? 'girl' : 'boy';
      where.student = {
        ...(where.student || {}),
        OR: [
          { blockName: { contains: pattern, mode: 'insensitive' } },
          {
            roomAllocations: {
              some: {
                status: 'ACTIVE',
                room: {
                  block: {
                    name: { contains: pattern, mode: 'insensitive' },
                  },
                },
              },
            },
          },
        ],
      };
    }

    // Academic Year filter
    if (year && year !== 'ALL') {
      let prefix = '';
      if (year.includes('1')) prefix = '25';
      else if (year.includes('2')) prefix = '24';
      else if (year.includes('3')) prefix = '22';
      else if (year.includes('4')) prefix = '21';

      if (prefix) {
        where.student = {
          ...(where.student || {}),
          jntuNo: { startsWith: prefix, mode: 'insensitive' },
        };
      }
    }

    const [totalCount, suspensions] = await Promise.all([
      prisma.suspension.count({ where }),
      prisma.suspension.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          student: {
            include: {
              roomAllocations: {
                where: { status: 'ACTIVE' },
                include: {
                  room: {
                    include: {
                      block: true,
                    },
                  },
                },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    const items = suspensions.map((susp) => {
      const activeAlloc = susp.student?.roomAllocations?.[0];
      const blockName = activeAlloc?.room?.block?.name || susp.student?.blockName || null;
      const roomNumber = activeAlloc?.room?.roomNumber || susp.student?.roomNumber || null;
      const bedNumber = activeAlloc?.bedNumber || susp.student?.bedNumber || null;
      const academic = decodeAcademicInfo(susp.student?.jntuNo || '');
      const initials = (susp.student?.name || 'ST')
        .split(' ')
        .filter(Boolean)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;

      // Evaluate effective status
      let effectiveStatus = susp.status;
      if (susp.status === 'ACTIVE' && new Date(susp.endDate) < now) {
        effectiveStatus = 'EXPIRED';
      }

      return {
        id: susp.id,
        studentId: susp.studentId,
        reason: susp.reason,
        startDate: susp.startDate.toISOString(),
        endDate: susp.endDate.toISOString(),
        status: susp.status,
        effectiveStatus,
        createdBy: susp.createdBy,
        remarks: susp.remarks,
        liftedAt: susp.liftedAt?.toISOString() || null,
        liftedBy: susp.liftedBy || null,
        createdAt: susp.createdAt.toISOString(),
        updatedAt: susp.updatedAt.toISOString(),
        avatar: initials,
        student: susp.student
          ? {
              id: susp.student.id,
              name: susp.student.name,
              jntuNo: susp.student.jntuNo,
              email: susp.student.email,
              gender: derivedGender,
              avatar: initials,
              academic,
              blockName,
              roomNumber,
              bedNumber,
            }
          : null,
      };
    });

    res.json({
      success: true,
      data: items,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error fetching management suspensions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve suspension records.',
      error: error.message,
    });
  }
});

/**
 * GET /api/management/suspensions/:id
 * Single suspension detail
 */
suspensionManagementRouter.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const susp = await prisma.suspension.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            roomAllocations: {
              where: { status: 'ACTIVE' },
              include: {
                room: {
                  include: {
                    block: true,
                  },
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!susp) {
      res.status(404).json({ success: false, message: 'Suspension record not found.' });
      return;
    }

    const activeAlloc = susp.student?.roomAllocations?.[0];
    const blockName = activeAlloc?.room?.block?.name || susp.student?.blockName || null;
    const roomNumber = activeAlloc?.room?.roomNumber || susp.student?.roomNumber || null;
    const bedNumber = activeAlloc?.bedNumber || susp.student?.bedNumber || null;
    const academic = decodeAcademicInfo(susp.student?.jntuNo || '');
    const initials = (susp.student?.name || 'ST')
      .split(' ')
      .filter(Boolean)
      .map((part: string) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
    const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;

    const now = new Date();
    let effectiveStatus = susp.status;
    if (susp.status === 'ACTIVE' && new Date(susp.endDate) < now) {
      effectiveStatus = 'EXPIRED';
    }

    res.json({
      success: true,
      data: {
        id: susp.id,
        studentId: susp.studentId,
        reason: susp.reason,
        startDate: susp.startDate.toISOString(),
        endDate: susp.endDate.toISOString(),
        status: susp.status,
        effectiveStatus,
        createdBy: susp.createdBy,
        remarks: susp.remarks,
        liftedAt: susp.liftedAt?.toISOString() || null,
        liftedBy: susp.liftedBy || null,
        createdAt: susp.createdAt.toISOString(),
        updatedAt: susp.updatedAt.toISOString(),
        avatar: initials,
        student: susp.student
          ? {
              id: susp.student.id,
              name: susp.student.name,
              jntuNo: susp.student.jntuNo,
              email: susp.student.email,
              gender: derivedGender,
              avatar: initials,
              academic,
              blockName,
              roomNumber,
              bedNumber,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching suspension detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve suspension details.',
      error: error.message,
    });
  }
});

/**
 * PUT /api/management/suspensions/:id
 * Authoritative update of suspension reason, endDate, or remarks
 */
suspensionManagementRouter.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason, endDate, remarks } = req.body || {};
    const manager = req.managementUser!;
    const editorName = manager.name || manager.jntuNo || 'Hostel Warden';

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.suspension.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('SUSPENSION_NOT_FOUND');
      }

      if (existing.status === 'LIFTED') {
        throw new Error('CANNOT_EDIT_LIFTED');
      }

      const updateData: any = {};
      if (reason !== undefined) {
        if (typeof reason !== 'string' || reason.trim().length < 5) {
          throw new Error('INVALID_REASON: Reason must be at least 5 characters.');
        }
        updateData.reason = reason.trim();
      }

      if (endDate !== undefined) {
        const newEnd = new Date(endDate);
        if (isNaN(newEnd.getTime())) {
          throw new Error('INVALID_DATE: Invalid end date.');
        }
        if (newEnd <= existing.startDate) {
          throw new Error('INVALID_DATE: End date must be strictly after start date.');
        }
        updateData.endDate = newEnd;
      }

      if (remarks !== undefined) {
        updateData.remarks = typeof remarks === 'string' ? remarks.trim() : null;
      }

      const updated = await tx.suspension.update({
        where: { id },
        data: updateData,
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'LEAVE',
          action: 'UPDATE_SUSPENSION',
          actorRole: req.managementUser!.role,
          entity: 'Suspension',
          entityId: existing.id,
          previousState: existing.status,
          newState: updated.status,
          description: `Disciplinary suspension updated by ${editorName}. Reason: ${updated.reason}`,
        },
      });

      // Student Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Disciplinary Suspension Updated',
          message: `Your suspension terms were updated by ${editorName}. New end date: ${new Date(updated.endDate).toLocaleDateString()}. Reason: ${updated.reason}`,
          type: 'INFO',
          category: 'SUSPENSION',
          entityId: updated.id,
          link: '/leaves',
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // Emit SSE event post-commit
    complaintEventsService.emitLeaveEventToStudent(result.student.id, {
      type: 'SUSPENSION_UPDATED',
      suspensionId: result.updated.id,
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: {
        reason: result.updated.reason,
        endDate: result.updated.endDate.toISOString(),
      },
    });

    res.json({
      success: true,
      message: `Suspension updated successfully.`,
      data: result.updated,
    });
  } catch (error: any) {
    if (error.message === 'SUSPENSION_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Suspension record not found.' });
      return;
    }
    if (error.message === 'CANNOT_EDIT_LIFTED') {
      res.status(400).json({ success: false, message: 'Cannot edit a suspension that has already been lifted.' });
      return;
    }
    if (error.message?.startsWith('INVALID_REASON') || error.message?.startsWith('INVALID_DATE')) {
      res.status(400).json({ success: false, message: error.message.split(': ')[1] });
      return;
    }

    console.error('Error updating suspension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update suspension.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/suspensions
 * Authoritatively create a new disciplinary suspension
 */
suspensionManagementRouter.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { studentId, reason, startDate, endDate, remarks } = req.body || {};
    const manager = req.managementUser!;
    const creatorName = manager.name || manager.role || 'HOSTEL_ADMIN';

    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({ success: false, message: 'Student ID is required.' });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      res.status(400).json({ success: false, message: 'A valid reason of at least 5 characters is required.' });
      return;
    }

    if (!startDate || !endDate) {
      res.status(400).json({ success: false, message: 'Both start date and end date are required.' });
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      res.status(400).json({ success: false, message: 'Invalid dates provided.' });
      return;
    }

    if (start >= end) {
      res.status(400).json({ success: false, message: 'End date must be strictly after start date.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: studentId },
      });

      if (!student) {
        throw new Error('STUDENT_NOT_FOUND');
      }

      const suspension = await tx.suspension.create({
        data: {
          studentId,
          reason: reason.trim(),
          startDate: start,
          endDate: end,
          status: 'ACTIVE',
          createdBy: creatorName,
          remarks: remarks?.trim() || null,
        },
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          studentId,
          actionType: 'LEAVE',
          action: 'SUSPEND',
          actorRole: req.managementUser!.role,
          entity: 'Suspension',
          entityId: suspension.id,
          previousState: 'ACTIVE_STUDENT',
          newState: 'SUSPENDED',
          description: `Hostel disciplinary suspension created by ${creatorName} until ${end.toLocaleDateString()}. Reason: ${reason.trim()}`,
        },
      });

      // Student Notification
      await notificationService.createNotification(
        {
          studentId,
          title: 'Disciplinary Suspension Notice',
          message: `Your hostel account is placed under suspension until ${end.toLocaleDateString()}: ${reason.trim()}. Leave application privileges are temporarily suspended.`,
          type: 'WARNING',
          category: 'SUSPENSION',
          entityId: suspension.id,
          link: '/leaves',
        },
        tx
      );

      return { suspension, student };
    });

    // Emit SSE event post-commit
    complaintEventsService.emitLeaveEventToStudent(result.student.id, {
      type: 'SUSPENSION_CREATED',
      suspensionId: result.suspension.id,
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: {
        reason: result.suspension.reason,
        endDate: result.suspension.endDate.toISOString(),
      },
    });

    res.status(201).json({
      success: true,
      message: `Suspension enforced for ${result.student.name} (${result.student.jntuNo}) until ${end.toLocaleDateString()}.`,
      data: result.suspension,
    });
  } catch (error: any) {
    if (error.message === 'STUDENT_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Student record not found.' });
      return;
    }

    console.error('Error creating suspension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enforce suspension.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/suspensions/:id/end
 * Authoritatively lift/end an active disciplinary suspension
 */
suspensionManagementRouter.post('/:id/end', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { remarks } = req.body || {};
    const manager = req.managementUser!;
    const resolverName = manager.name || manager.jntuNo || 'Hostel Warden';

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.suspension.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('SUSPENSION_NOT_FOUND');
      }

      if (existing.status === 'LIFTED') {
        throw new Error('ALREADY_LIFTED');
      }

      const now = new Date();
      const updatedRemarks = remarks?.trim()
        ? `${existing.remarks ? `${existing.remarks} | ` : ''}Lifted on ${now.toLocaleDateString()} by ${resolverName}: ${remarks.trim()}`
        : existing.remarks;

      const updated = await tx.suspension.update({
        where: { id },
        data: {
          status: 'LIFTED',
          liftedAt: now,
          liftedBy: resolverName,
          remarks: updatedRemarks,
        },
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'LEAVE',
          action: 'LIFT_SUSPENSION',
          actorRole: req.managementUser!.role,
          entity: 'Suspension',
          entityId: existing.id,
          previousState: 'ACTIVE',
          newState: 'ENDED',
          description: `Disciplinary suspension ended/lifted by ${resolverName}. Account privileges restored.`,
        },
      });

      // Student Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Disciplinary Suspension Lifted',
          message: 'Your hostel disciplinary suspension has been lifted. Account restored to good standing. You are now eligible to submit leave applications.',
          type: 'SUCCESS',
          category: 'SUSPENSION',
          entityId: updated.id,
          link: '/leaves',
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // Emit SSE event post-commit
    complaintEventsService.emitLeaveEventToStudent(result.student.id, {
      type: 'SUSPENSION_LIFTED',
      suspensionId: result.updated.id,
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: {
        liftedBy: resolverName,
      },
    });

    res.json({
      success: true,
      message: `Suspension for ${result.student.name} has been lifted successfully.`,
      data: result.updated,
    });
  } catch (error: any) {
    if (error.message === 'SUSPENSION_NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Suspension record not found.' });
      return;
    }

    if (error.message === 'ALREADY_LIFTED') {
      res.status(400).json({ success: false, message: 'This suspension has already been lifted.' });
      return;
    }

    console.error('Error lifting suspension:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to lift suspension.',
      error: error.message,
    });
  }
});

export default leaveManagementRouter;
