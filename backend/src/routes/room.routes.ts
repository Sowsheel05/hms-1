import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';

const router = Router();

/**
 * GET /api/student/my-room
 * Authoritative accommodation details, room overview, and authorized roommates
 * Powered directly by PostgreSQL RoomAllocation and Room tables
 */
router.get('/my-room', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    // 2. Query authoritative active RoomAllocation for this student
    const activeAllocation = await prisma.roomAllocation.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
      },
      include: {
        room: {
          include: {
            block: true,
          },
        },
      },
    });

    // If no active allocation in RoomAllocation table
    if (!activeAllocation) {
      // Check legacy/fallback if not yet migrated
      if (student.allocationStatus === 'ALLOCATED' && student.blockName && student.roomNumber) {
        // Fallback for un-migrated records
        const allocatedOccupants = await prisma.student.findMany({
          where: {
            blockName: student.blockName,
            roomNumber: student.roomNumber,
            allocationStatus: 'ALLOCATED',
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            jntuNo: true,
            bedNumber: true,
            allocationStatus: true,
          },
          orderBy: { bedNumber: 'asc' },
        });

        const block = await prisma.block.findFirst({
          where: { name: student.blockName },
          select: { id: true },
        });
        const roomData = await prisma.room.findFirst({
          where: {
            blockId: block?.id || '',
            roomNumber: student.roomNumber,
          },
          select: { capacity: true },
        });
        const capacity = roomData?.capacity || student.roomCapacity || 2;
        const occupancy = allocatedOccupants.length;
        const occupancyStatus = occupancy >= capacity ? 'Occupied' : 'Partially Occupied';

        const roommates = allocatedOccupants.map((occupant) => ({
          id: occupant.id,
          name: occupant.name,
          jntuNo: occupant.jntuNo,
          bedNumber: occupant.bedNumber,
          allocationStatus: occupant.allocationStatus,
          isCurrentStudent: occupant.id === student.id,
        }));

        res.status(200).json({
          success: true,
          student: {
            id: student.id,
            name: student.name,
            jntuNo: student.jntuNo,
            email: student.email,
          },
          allocation: {
            status: student.allocationStatus,
            block: student.blockName,
            roomNumber: student.roomNumber,
            floor: student.floorName,
            bedNumber: student.bedNumber,
            roomType: student.roomType,
            allocatedAt: student.allocatedAt,
          },
          room: {
            block: student.blockName,
            roomNumber: student.roomNumber,
            floor: student.floorName,
            roomType: student.roomType,
            capacity,
            occupancy,
            occupancyStatus,
          },
          roommates,
        });
        return;
      }

      res.status(200).json({
        success: true,
        student: {
          id: student.id,
          name: student.name,
          jntuNo: student.jntuNo,
          email: student.email,
        },
        allocation: {
          status: 'NOT_ALLOCATED',
          allocatedAt: null,
        },
        room: null,
        roommates: [],
      });
      return;
    }

    // 3. Active allocation found: Fetch all roommates in the same room from RoomAllocation
    const currentRoom = activeAllocation.room;
    const currentBlock = currentRoom.block;

    const activeAllocationsInRoom = await prisma.roomAllocation.findMany({
      where: {
        roomId: currentRoom.id,
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            isActive: true,
          },
        },
      },
      orderBy: { bedNumber: 'asc' },
    });

    const capacity = currentRoom.capacity;
    const occupancy = activeAllocationsInRoom.length;
    const occupancyStatus = occupancy >= capacity ? 'Occupied' : 'Partially Occupied';

    const roommates = activeAllocationsInRoom.map((alloc) => ({
      id: alloc.student.id,
      name: alloc.student.name,
      jntuNo: alloc.student.jntuNo,
      bedNumber: alloc.bedNumber,
      allocationStatus: 'ALLOCATED',
      isCurrentStudent: alloc.student.id === student.id,
    }));

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        email: student.email,
      },
      allocation: {
        status: 'ALLOCATED',
        block: currentBlock.name,
        roomNumber: currentRoom.roomNumber,
        floor: String(currentRoom.floor || 1),
        bedNumber: activeAllocation.bedNumber,
        roomType: currentRoom.roomType,
        allocatedAt: activeAllocation.allocatedAt,
      },
      room: {
        block: currentBlock.name,
        roomNumber: currentRoom.roomNumber,
        floor: String(currentRoom.floor || 1),
        roomType: currentRoom.roomType,
        capacity,
        occupancy,
        occupancyStatus,
      },
      roommates,
    });
  } catch (error) {
    console.error('Error fetching room details:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load room information. Please try again.',
    });
  }
});

export default router;
