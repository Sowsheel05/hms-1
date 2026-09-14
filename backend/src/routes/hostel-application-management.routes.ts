import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';

const router = Router();

// All management hostel application routes require management role authentication
router.use(authenticateManagement);

/**
 * GET /api/management/hostel-applications
 * Retrieves all student registration & hostel applications with metrics, filters, and student information.
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { status, academicYear, preferredBlock, search } = req.query;

    const whereClause: any = {};

    if (typeof status === 'string' && status.trim() && status.trim().toUpperCase() !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    if (typeof academicYear === 'string' && academicYear.trim() && academicYear.trim().toUpperCase() !== 'ALL') {
      whereClause.academicYear = academicYear.trim();
    }

    if (typeof preferredBlock === 'string' && preferredBlock.trim() && preferredBlock.trim().toUpperCase() !== 'ALL') {
      whereClause.preferredBlock = { contains: preferredBlock.trim(), mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.trim()) {
      const q = search.trim();
      whereClause.OR = [
        { applicationNumber: { contains: q, mode: 'insensitive' } },
        { student: { name: { contains: q, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: q, mode: 'insensitive' } } },
        { student: { email: { contains: q, mode: 'insensitive' } } },
        { branch: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Role-based scoping if warden belongs to specific block
    if (req.managementUser?.blockName && !['ADMIN', 'HOSTEL_ADMIN'].includes(req.managementUser.role)) {
      const scopeBlock = req.managementUser.blockName;
      if (!whereClause.preferredBlock) {
        whereClause.OR = [
          ...(whereClause.OR || []),
          { preferredBlock: { contains: scopeBlock, mode: 'insensitive' } },
        ];
      }
    }

    const [applications, total, pending, underReview, approved, allocated, rejected] = await Promise.all([
      prisma.hostelApplication.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              email: true,
              isActive: true,
              allocationStatus: true,
              blockName: true,
              roomNumber: true,
              bedNumber: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.hostelApplication.count(),
      prisma.hostelApplication.count({ where: { status: 'PENDING' } }),
      prisma.hostelApplication.count({ where: { status: 'UNDER_REVIEW' } }),
      prisma.hostelApplication.count({ where: { status: 'APPROVED' } }),
      prisma.hostelApplication.count({ where: { status: 'ALLOCATED' } }),
      prisma.hostelApplication.count({ where: { status: 'REJECTED' } }),
    ]);

    // Available blocks for filter dropdown
    const blocks = await prisma.block.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      metrics: {
        total,
        pending,
        underReview,
        approved,
        allocated,
        rejected,
      },
      applications,
      blocks,
    });
  } catch (error) {
    console.error('Error fetching management hostel applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hostel applications.',
    });
  }
});

/**
 * GET /api/management/hostel-applications/:id
 * Detailed application inspection with student background and room choices.
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const application = await prisma.hostelApplication.findFirst({
      where: {
        OR: [{ id }, { applicationNumber: id }],
      },
      include: {
        student: {
          include: {
            roomAllocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } } },
            },
          },
        },
      },
    });

    if (!application) {
      res.status(404).json({ success: false, message: 'Hostel application not found.' });
      return;
    }

    res.status(200).json({
      success: true,
      application,
    });
  } catch (error) {
    console.error('Error fetching application detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve application details.',
    });
  }
});

/**
 * PATCH /api/management/hostel-applications/:id/status
 * Updates review status (UNDER_REVIEW, REJECTED) with administrative remarks.
 */
router.patch('/:id/status', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, remarks, rejectionReason } = req.body;

    const validStatuses = ['UNDER_REVIEW', 'APPROVED', 'REJECTED', 'PENDING'];
    if (!status || !validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
      return;
    }

    const application = await prisma.hostelApplication.findFirst({
      where: {
        OR: [{ id }, { applicationNumber: id }],
      },
      include: { student: true },
    });

    if (!application) {
      res.status(404).json({ success: false, message: 'Hostel application not found.' });
      return;
    }

    if (application.status === 'ALLOCATED') {
      res.status(400).json({
        success: false,
        message: 'Cannot modify an application that is already ALLOCATED. Please manage room allocations directly.',
      });
      return;
    }

    const reviewerName = req.managementUser?.name || 'Hostel Administrator';
    const now = new Date();

    const isRejected = status === 'REJECTED';
    const isApproved = status === 'APPROVED';

    const [updatedApp] = await prisma.$transaction([
      prisma.hostelApplication.update({
        where: { id: application.id },
        data: {
          status,
          remarks: remarks?.trim() || application.remarks,
          rejectionReason: isRejected ? (rejectionReason?.trim() || remarks?.trim() || 'Criteria not met.') : null,
          reviewedBy: reviewerName,
          reviewedAt: now,
        },
      }),
      prisma.student.update({
        where: { id: application.studentId },
        data: {
          // Student remains inactive if rejected; if approved without immediate room allocation, remains pending
          isActive: isRejected ? false : application.student.isActive,
          allocationStatus: isRejected ? 'NOT_ALLOCATED' : application.student.allocationStatus,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          action: isRejected ? 'REJECT' : 'UPDATE',
          entity: 'HostelApplication',
          entityId: id,
          previousState: application.status,
          newState: status,
          description: `${reviewerName} ${isRejected ? 'rejected' : 'updated'} application ${application.applicationNumber} to ${status}`,
        },
      }),
      prisma.notification.create({
        data: {
          studentId: application.studentId,
          title: isRejected ? 'Registration Application Rejected' : `Registration Application ${status}`,
          message: isRejected
            ? `Your student registration has been rejected. Reason: ${rejectionReason || remarks || 'Contact hostel administration.'}`
            : isApproved
            ? `Your student registration has been approved. Room allocation is in progress.`
            : `Your application is currently under verification.`,
          type: isRejected ? 'WARNING' : isApproved ? 'SUCCESS' : 'INFO',
          category: 'ROOM',
          priority: isRejected ? 'HIGH' : 'NORMAL',
          source: 'ADMIN_PORTAL',
        },
      }),
    ]);

    complaintEventsService.emitRoomEventToStudent(application.studentId, {
      type: 'ROOM_ALLOCATION_CHANGED',
      details: { applicationId: id, status },
      timestamp: now.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Hostel application status updated to ${status}.`,
      application: updatedApp,
    });
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update application status.',
    });
  }
});

/**
 * POST /api/management/hostel-applications/:id/allocate
 * Authoritative Admin Action: Approves applicant, activates student account, and allocates room bed atomically.
 */
router.post('/:id/allocate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { roomId, bedNumber } = req.body;

    if (!roomId || !bedNumber) {
      res.status(400).json({
        success: false,
        message: 'roomId and bedNumber are required for allocation.',
      });
      return;
    }

    const application = await prisma.hostelApplication.findFirst({
      where: {
        OR: [{ id }, { applicationNumber: id }],
      },
      include: { student: true },
    });

    if (!application) {
      res.status(404).json({ success: false, message: 'Hostel application not found.' });
      return;
    }

    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        block: true,
        allocations: { where: { status: 'ACTIVE' } },
      },
    });

    if (!room) {
      res.status(404).json({ success: false, message: 'Specified room was not found.' });
      return;
    }

    if (room.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Cannot allocate room: Room status is currently ${room.status}.`,
      });
      return;
    }

    if (room.block.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Cannot allocate room: Block '${room.block.name}' is inactive.`,
      });
      return;
    }

    // Check capacity
    if (room.allocations.length >= room.capacity) {
      res.status(400).json({
        success: false,
        message: `Room ${room.roomNumber} is already at full capacity (${room.capacity}/${room.capacity} beds occupied).`,
      });
      return;
    }

    // Check if bedNumber is already occupied
    const bedTaken = room.allocations.some(
      (a) => a.bedNumber?.toLowerCase() === bedNumber.trim().toLowerCase()
    );
    if (bedTaken) {
      res.status(409).json({
        success: false,
        message: `Bed '${bedNumber}' is already occupied in room ${room.roomNumber}.`,
      });
      return;
    }

    const reviewerName = req.managementUser?.name || 'Hostel Administrator';
    const now = new Date();

    const [allocation, updatedStudent, updatedApp] = await prisma.$transaction([
      // 1. Create active room allocation
      prisma.roomAllocation.create({
        data: {
          roomId: room.id,
          studentId: application.studentId,
          bedNumber: bedNumber.trim(),
          status: 'ACTIVE',
          allocatedAt: now,
        },
      }),
      // 2. Activate student account and assign residential details
      prisma.student.update({
        where: { id: application.studentId },
        data: {
          isActive: true, // ACCOUNT ACTIVATED! Student can now log in!
          allocationStatus: 'ALLOCATED',
          blockName: room.block.name,
          roomNumber: room.roomNumber,
          floorName: `Floor ${room.floor || 1}`,
          bedNumber: bedNumber.trim(),
          roomType: room.roomType || 'Standard',
          allocatedAt: now,
        },
      }),
      // 3. Mark application as APPROVED and ALLOCATED
      prisma.hostelApplication.update({
        where: { id: application.id },
        data: {
          status: 'APPROVED',
          allocatedRoomId: room.id,
          allocatedBedNumber: bedNumber.trim(),
          reviewedBy: reviewerName,
          reviewedAt: now,
        },
      }),
      // 4. Create ActivityLog
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          action: 'ALLOCATE',
          entity: 'RoomAllocation',
          description: `${reviewerName} approved and allocated ${room.block.name} Room ${room.roomNumber} (${bedNumber.trim()}) to ${application.student.name} (${application.student.jntuNo})`,
        },
      }),
      // 5. Send notification to student
      prisma.notification.create({
        data: {
          studentId: application.studentId,
          title: 'Student Registration Approved & Room Allocated!',
          message: `Your student registration has been approved. Your hostel allocation is: Hostel: ${room.block.name}, Room: ${room.roomNumber}, Bed: ${bedNumber.trim()}. You may now log in to the Student Portal using your credentials.`,
          type: 'SUCCESS',
          category: 'ROOM',
          priority: 'HIGH',
          source: 'ADMIN_PORTAL',
        },
      }),
    ]);

    complaintEventsService.emitRoomEventToStudent(application.studentId, {
      type: 'STUDENT_ALLOCATED',
      roomId: room.id,
      studentId: application.studentId,
      allocationId: allocation.id,
      timestamp: now.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Student ${application.student.name} approved and allocated Room ${room.roomNumber} (${bedNumber.trim()}) successfully.`,
      allocation,
      student: updatedStudent,
      application: updatedApp,
    });
  } catch (error) {
    console.error('Error allocating room via application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to allocate room for this application.',
    });
  }
});

export default router;
