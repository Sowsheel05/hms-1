import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { notificationService } from '../services/notification.service';
import { decodeAcademicInfo } from './mess-management.routes';

const router = Router();

// All management outing endpoints require management authentication (RBAC enforced)
router.use(authenticateManagement);

/**
 * GET /api/management/outings/stats
 * Authoritative KPI metrics calculated live from PostgreSQL
 */
router.get('/stats', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const [
      total,
      pending,
      approved,
      activeOutings,
      returned,
      rejected,
      todayOutgoing,
      todayIncoming,
    ] = await Promise.all([
      prisma.outingRequest.count(),
      prisma.outingRequest.count({ where: { status: 'PENDING' } }),
      prisma.outingRequest.count({ where: { status: 'APPROVED' } }),
      prisma.outingRequest.count({ where: { status: { in: ['OUT', 'ACTIVE'] } } }),
      prisma.outingRequest.count({ where: { status: 'RETURNED' } }),
      prisma.outingRequest.count({ where: { status: 'REJECTED' } }),
      prisma.outingRequest.count({
        where: {
          outDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      prisma.outingRequest.count({
        where: {
          returnDate: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
    ]);

    res.json({
      success: true,
      data: {
        total,
        pending,
        approved,
        approvedToday: approved,
        active: activeOutings,
        activeOutings,
        returned,
        rejected,
        todayOutgoing,
        todayIncoming,
      },
    });
  } catch (error: any) {
    console.error('Error fetching management outing stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve authoritative outing metrics.',
      error: error.message,
    });
  }
});

/**
 * GET /api/management/outings
 * Paginated and filterable list of outing requests with student and room details
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      status,
      search,
      passType,
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

    // Build Prisma query filter
    const where: any = {};

    // Status filter
    if (status && status !== 'ALL') {
      const upperStatus = status.toUpperCase();
      if (upperStatus === 'ACTIVE' || upperStatus === 'OUT') {
        where.status = { in: ['OUT', 'ACTIVE'] };
      } else {
        where.status = upperStatus;
      }
    }

    // Pass Type filter
    if (passType && passType !== 'ALL') {
      where.passType = passType;
    }

    // Date filter (matches either outDate or returnDate on that calendar day)
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parts = date.split('-').map(Number);
      const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      const dayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);

      where.OR = [
        { outDate: { gte: dayStart, lte: dayEnd } },
        { returnDate: { gte: dayStart, lte: dayEnd } },
      ];
    }

    // Search filter
    if (search && search.trim().length > 0) {
      const term = search.trim();
      const searchConditions = [
        { requestNumber: { contains: term, mode: 'insensitive' } },
        { destination: { contains: term, mode: 'insensitive' } },
        { purpose: { contains: term, mode: 'insensitive' } },
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

    const [totalCount, outings] = await Promise.all([
      prisma.outingRequest.count({ where }),
      prisma.outingRequest.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: [
          { createdAt: 'desc' },
        ],
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

    // Format outings with student room context
    const items = outings.map((outing) => {
      const activeAllocation = outing.student?.roomAllocations?.[0];
      const blockName = activeAllocation?.room?.block?.name || outing.student?.blockName || null;
      const roomNumber = activeAllocation?.room?.roomNumber || outing.student?.roomNumber || null;
      const bedNumber = activeAllocation?.bedNumber || outing.student?.bedNumber || null;
      const academic = decodeAcademicInfo(outing.student?.jntuNo || '');
      const initials = (outing.student?.name || 'ST')
        .split(' ')
        .filter(Boolean)
        .map((part: string) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
      const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;

      return {
        id: outing.id,
        requestNumber: outing.requestNumber,
        passType: outing.passType,
        destination: outing.destination,
        purpose: outing.purpose,
        emergencyContact: outing.emergencyContact,
        remarks: outing.remarks,
        outDate: outing.outDate.toISOString(),
        returnDate: outing.returnDate.toISOString(),
        actualExitTime: outing.actualExitTime?.toISOString() || null,
        actualReturnTime: outing.actualReturnTime?.toISOString() || null,
        rejectionReason: outing.rejectionReason || null,
        approvedAt: outing.approvedAt?.toISOString() || null,
        approvedBy: outing.approvedBy || null,
        rejectedAt: outing.rejectedAt?.toISOString() || null,
        rejectedBy: outing.rejectedBy || null,
        status: outing.status === 'OUT' ? 'ACTIVE' : outing.status,
        rawStatus: outing.status,
        createdAt: outing.createdAt.toISOString(),
        updatedAt: outing.updatedAt.toISOString(),
        avatar: initials,
        student: outing.student
          ? {
              id: outing.student.id,
              name: outing.student.name,
              jntuNo: outing.student.jntuNo,
              email: outing.student.email,
              gender: derivedGender,
              avatar: initials,
              blockName,
              roomNumber,
              bedNumber,
              academic,
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
    console.error('Error fetching management outings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve outing requests.',
      error: error.message,
    });
  }
});

/**
 * GET /api/management/outings/:id
 * Authoritative single outing detail with complete context
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const outing = await prisma.outingRequest.findUnique({
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

    if (!outing) {
      res.status(404).json({
        success: false,
        message: 'Outing request not found.',
      });
      return;
    }

    // Monthly outing usage for this student (outings taken in current calendar month)
    const outDateObj = new Date(outing.outDate);
    const startOfMonth = new Date(outDateObj.getFullYear(), outDateObj.getMonth(), 1);
    const endOfMonth = new Date(outDateObj.getFullYear(), outDateObj.getMonth() + 1, 0, 23, 59, 59, 999);

    const [monthlyCount, biometricEvents] = await Promise.all([
      prisma.outingRequest.count({
        where: {
          studentId: outing.studentId,
          status: { in: ['APPROVED', 'OUT', 'RETURNED'] },
          outDate: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      }),
      prisma.biometricEvent.findMany({
        where: {
          studentId: outing.studentId,
          eventTimestamp: {
            gte: new Date(outDateObj.getTime() - 24 * 60 * 60 * 1000),
            lte: new Date(outing.returnDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        orderBy: { eventTimestamp: 'desc' },
        take: 10,
      }),
    ]);

    const activeAlloc = outing.student?.roomAllocations?.[0];
    const blockName = activeAlloc?.room?.block?.name || outing.student?.blockName || null;
    const derivedGender = (blockName || '').toLowerCase().includes('girl') ? 'FEMALE' : (blockName || '').toLowerCase().includes('boy') ? 'MALE' : null;
    const initials = (outing.student?.name || 'ST').split(' ').filter(Boolean).map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

    res.json({
      success: true,
      data: {
        id: outing.id,
        requestNumber: outing.requestNumber,
        passType: outing.passType,
        destination: outing.destination,
        purpose: outing.purpose,
        emergencyContact: outing.emergencyContact,
        remarks: outing.remarks,
        outDate: outing.outDate.toISOString(),
        returnDate: outing.returnDate.toISOString(),
        actualExitTime: outing.actualExitTime?.toISOString() || null,
        actualReturnTime: outing.actualReturnTime?.toISOString() || null,
        rejectionReason: outing.rejectionReason || null,
        approvedAt: outing.approvedAt?.toISOString() || null,
        approvedBy: outing.approvedBy || null,
        rejectedAt: outing.rejectedAt?.toISOString() || null,
        rejectedBy: outing.rejectedBy || null,
        status: outing.status === 'OUT' ? 'ACTIVE' : outing.status,
        rawStatus: outing.status,
        createdAt: outing.createdAt.toISOString(),
        updatedAt: outing.updatedAt.toISOString(),
        avatar: initials,
        student: outing.student
          ? {
              id: outing.student.id,
              name: outing.student.name,
              jntuNo: outing.student.jntuNo,
              email: outing.student.email,
              gender: derivedGender,
              avatar: initials,
              blockName,
              roomNumber: activeAlloc?.room?.roomNumber || outing.student.roomNumber || null,
              bedNumber: activeAlloc?.bedNumber || outing.student.bedNumber || null,
              roomType: activeAlloc?.room?.roomType || outing.student.roomType || null,
              academic: decodeAcademicInfo(outing.student.jntuNo),
            }
          : null,
        monthlyUsageCount: monthlyCount,
        biometricEvents: biometricEvents.map((ev) => ({
          id: ev.id,
          eventType: ev.eventType,
          verificationStatus: ev.verificationStatus,
          gate: ev.gate,
          eventTimestamp: ev.eventTimestamp.toISOString(),
        })),
      },
    });
  } catch (error: any) {
    console.error('Error fetching single outing:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve outing detail.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/outings/:id/approve
 * Authoritative Warden approval for pending outing request
 * Enforces strict transactional state transition: ONLY PENDING -> APPROVED
 */
router.post('/:id/approve', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const manager = req.managementUser!;
    const approverName = manager.name || manager.jntuNo || 'Hostel Warden';

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.outingRequest.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('OUTING_NOT_FOUND');
      }

      // State machine validation: Only PENDING can be approved
      if (existing.status !== 'PENDING') {
        const error = new Error(`INVALID_STATE_TRANSITION: Cannot approve outing with status "${existing.status}". Only PENDING requests can be approved.`);
        (error as any).status = existing.status;
        throw error;
      }

      const now = new Date();

      // 1. Update outing request
      const updated = await tx.outingRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          approvedAt: now,
          approvedBy: approverName,
        },
      });

      // 2. Create authoritative ActivityLog
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'OUTING',
          action: 'APPROVE',
          actorRole: req.managementUser!.role,
          entity: 'OutingRequest',
          entityId: existing.id,
          previousState: existing.status,
          newState: 'APPROVED',
          description: `Outing request #${existing.requestNumber || existing.id} approved by ${approverName}.`,
        },
      });

      // 3. Create persistent student Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Outing Request Approved',
          message: `Your outing request #${existing.requestNumber || existing.id} to ${existing.destination || 'destination'} has been approved. You may proceed through the biometric exit gate during the designated hours.`,
          type: 'SUCCESS',
          category: 'OUTING',
          entityId: existing.id,
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // 4. Emit SSE domain event AFTER transaction commits
    complaintEventsService.emitOutingEventToStudent(result.student.id, {
      type: 'OUTING_APPROVED',
      outingId: result.updated.id,
      studentId: result.student.id,
      status: 'APPROVED',
      passType: result.updated.passType,
      timestamp: new Date().toISOString(),
      details: {
        requestNumber: result.updated.requestNumber,
        approvedBy: approverName,
        destination: result.updated.destination,
      },
    });

    res.json({
      success: true,
      message: `Outing request #${result.updated.requestNumber || result.updated.id} successfully approved.`,
      data: {
        id: result.updated.id,
        requestNumber: result.updated.requestNumber,
        status: 'APPROVED',
        approvedAt: result.updated.approvedAt?.toISOString(),
        approvedBy: result.updated.approvedBy,
      },
    });
  } catch (error: any) {
    if (error.message === 'OUTING_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Outing request not found.',
      });
      return;
    }

    if (error.message?.startsWith('INVALID_STATE_TRANSITION')) {
      res.status(400).json({
        success: false,
        message: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
      });
      return;
    }

    console.error('Error approving outing request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve outing request.',
      error: error.message,
    });
  }
});

/**
 * POST /api/management/outings/:id/reject
 * Authoritative Warden rejection for pending outing request
 * Requires mandatory reason (min 3 chars). ONLY PENDING -> REJECTED
 */
router.post('/:id/reject', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
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

    // Execute in transaction
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.outingRequest.findUnique({
        where: { id },
        include: { student: true },
      });

      if (!existing) {
        throw new Error('OUTING_NOT_FOUND');
      }

      // State machine validation: Only PENDING can be rejected
      if (existing.status !== 'PENDING') {
        const error = new Error(`INVALID_STATE_TRANSITION: Cannot reject outing with status "${existing.status}". Only PENDING requests can be rejected.`);
        (error as any).status = existing.status;
        throw error;
      }

      const now = new Date();

      // 1. Update outing request
      const updated = await tx.outingRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectedAt: now,
          rejectedBy: rejectorName,
          rejectionReason: trimmedReason,
        },
      });

      // 2. Create authoritative ActivityLog
      await tx.activityLog.create({
        data: {
          studentId: existing.studentId,
          actionType: 'OUTING',
          action: 'REJECT',
          actorRole: req.managementUser!.role,
          entity: 'OutingRequest',
          entityId: existing.id,
          previousState: existing.status,
          newState: 'REJECTED',
          description: `Outing request #${existing.requestNumber || existing.id} rejected by ${rejectorName}. Reason: ${trimmedReason}`,
        },
      });

      // 3. Create persistent student Notification
      await notificationService.createNotification(
        {
          studentId: existing.studentId,
          title: 'Outing Request Rejected',
          message: `Your outing request #${existing.requestNumber || existing.id} was rejected by ${rejectorName}. Reason: ${trimmedReason}`,
          type: 'WARNING',
          category: 'OUTING',
          entityId: existing.id,
        },
        tx
      );

      return { updated, student: existing.student };
    });

    // 4. Emit SSE domain event AFTER transaction commits
    complaintEventsService.emitOutingEventToStudent(result.student.id, {
      type: 'OUTING_REJECTED',
      outingId: result.updated.id,
      studentId: result.student.id,
      status: 'REJECTED',
      passType: result.updated.passType,
      timestamp: new Date().toISOString(),
      details: {
        requestNumber: result.updated.requestNumber,
        rejectedBy: rejectorName,
        reason: trimmedReason,
      },
    });

    res.json({
      success: true,
      message: `Outing request #${result.updated.requestNumber || result.updated.id} was rejected.`,
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
    if (error.message === 'OUTING_NOT_FOUND') {
      res.status(404).json({
        success: false,
        message: 'Outing request not found.',
      });
      return;
    }

    if (error.message?.startsWith('INVALID_STATE_TRANSITION')) {
      res.status(400).json({
        success: false,
        message: error.message.replace('INVALID_STATE_TRANSITION: ', ''),
      });
      return;
    }

    console.error('Error rejecting outing request:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject outing request.',
      error: error.message,
    });
  }
});

export default router;
