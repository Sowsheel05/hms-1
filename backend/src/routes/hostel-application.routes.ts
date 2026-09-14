import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';

const router = Router();

/**
 * GET /api/student/hostel-application
 * Authoritative hostel application overview, status, and history for the authenticated student.
 */
router.get('/', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;

    // Fetch student with current allocation details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
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
        },
      },
    });

    if (!student || !student.isActive) {
      res.status(404).json({ success: false, message: 'Student account not found or inactive.' });
      return;
    }

    // Fetch all student applications
    const applications = await prisma.hostelApplication.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });

    // Active application (PENDING, UNDER_REVIEW, APPROVED, or ALLOCATED)
    const activeApplication = applications.find((app) =>
      ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'ALLOCATED'].includes(app.status)
    ) || null;

    // Fetch active residential blocks
    const availableBlocks = await prisma.block.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        code: true,
        description: true,
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        email: student.email,
        allocationStatus: student.allocationStatus,
        blockName: student.blockName,
        roomNumber: student.roomNumber,
        floorName: student.floorName,
        bedNumber: student.bedNumber,
        roomType: student.roomType,
      },
      activeAllocation: student.roomAllocations[0] || null,
      activeApplication,
      applications,
      availableBlocks,
    });
  } catch (error) {
    console.error('Error fetching student hostel application:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hostel application status.',
    });
  }
});

export default router;
