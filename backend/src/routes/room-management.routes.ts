import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';

const roomManagementRouter = Router();
const roomAllocationRouter = Router();

// All room management routes require authoritative management access
roomManagementRouter.use(authenticateManagement);
roomAllocationRouter.use(authenticateManagement);

// =========================================================================
//                          ROOM MANAGEMENT ROUTES
// =========================================================================

/**
 * GET /api/management/rooms
 * Retrieves all rooms with computed occupancy, available beds, occupant lists, and filtering
 */
roomManagementRouter.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { blockId, block, status, occupancy, search, roomNumber } = req.query;

    const whereClause: any = {};

    // Block filter (by ID or code/name)
    if (typeof blockId === 'string' && blockId.trim()) {
      whereClause.blockId = blockId.trim();
    } else if (typeof block === 'string' && block.trim() && block.trim().toUpperCase() !== 'ALL') {
      const bTerm = block.trim();
      whereClause.block = {
        OR: [
          { id: bTerm },
          { code: { equals: bTerm, mode: 'insensitive' } },
          { name: { equals: bTerm, mode: 'insensitive' } },
        ],
      };
    }

    // Status filter
    if (typeof status === 'string' && status.trim() && status.trim().toUpperCase() !== 'ALL') {
      const normalizedStatus = status.trim().toUpperCase();
      if (['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'].includes(normalizedStatus)) {
        whereClause.status = normalizedStatus;
      }
    }

    // Room number or search
    const searchTerm = typeof roomNumber === 'string' && roomNumber.trim()
      ? roomNumber.trim()
      : typeof search === 'string' && search.trim()
      ? search.trim()
      : null;

    if (searchTerm) {
      whereClause.OR = [
        { roomNumber: { contains: searchTerm, mode: 'insensitive' } },
        { block: { name: { contains: searchTerm, mode: 'insensitive' } } },
        { block: { code: { contains: searchTerm, mode: 'insensitive' } } },
        { roomType: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const rooms = await prisma.room.findMany({
      where: whereClause,
      include: {
        block: {
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
          },
        },
        allocations: {
          where: { status: 'ACTIVE' },
          include: {
            student: {
              select: {
                id: true,
                name: true,
                jntuNo: true,
                email: true,
                isActive: true,
              },
            },
          },
          orderBy: { bedNumber: 'asc' },
        },
      },
      orderBy: [
        { block: { name: 'asc' } },
        { floor: 'asc' },
        { roomNumber: 'asc' },
      ],
    });

    // Compute occupancy & available beds
    const formattedRooms = rooms.map((room) => {
      const activeOccupants = room.allocations.map((alloc) => ({
        allocationId: alloc.id,
        studentId: alloc.student.id,
        name: alloc.student.name,
        jntuNo: alloc.student.jntuNo,
        email: alloc.student.email,
        bedNumber: alloc.bedNumber,
        allocatedAt: alloc.allocatedAt,
      }));

      const activeCount = activeOccupants.length;
      const availableBeds = Math.max(0, room.capacity - activeCount);
      const occupancyStatus =
        activeCount >= room.capacity
          ? 'Occupied'
          : activeCount > 0
          ? 'Partially Occupied'
          : 'Vacant';

      return {
        id: room.id,
        blockId: room.blockId,
        block: room.block,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomType: room.roomType,
        capacity: room.capacity,
        status: room.status,
        occupancy: activeCount,
        availableBeds,
        occupancyStatus,
        activeOccupants,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      };
    });

    // Filter by occupancy status if requested
    let finalRooms = formattedRooms;
    if (typeof occupancy === 'string' && occupancy.trim() && occupancy.trim().toUpperCase() !== 'ALL') {
      const occFilter = occupancy.trim().toUpperCase();
      if (occFilter === 'OCCUPIED') {
        finalRooms = formattedRooms.filter((r) => r.occupancy >= r.capacity);
      } else if (occFilter === 'PARTIALLY_OCCUPIED') {
        finalRooms = formattedRooms.filter((r) => r.occupancy > 0 && r.occupancy < r.capacity);
      } else if (occFilter === 'VACANT') {
        finalRooms = formattedRooms.filter((r) => r.occupancy === 0);
      }
    }

    // Summary statistics from PostgreSQL data
    const totalRooms = formattedRooms.length;
    const occupiedRooms = formattedRooms.filter((r) => r.occupancy >= r.capacity).length;
    const partiallyOccupiedRooms = formattedRooms.filter((r) => r.occupancy > 0 && r.occupancy < r.capacity).length;
    const vacantRooms = formattedRooms.filter((r) => r.occupancy === 0).length;
    const totalCapacity = formattedRooms.reduce((acc, r) => acc + r.capacity, 0);
    const allocatedBeds = formattedRooms.reduce((acc, r) => acc + r.occupancy, 0);

    res.status(200).json({
      success: true,
      count: finalRooms.length,
      summary: {
        totalRooms,
        occupiedRooms,
        partiallyOccupiedRooms,
        vacantRooms,
        totalCapacity,
        allocatedBeds,
      },
      rooms: finalRooms,
    });
  } catch (error) {
    console.error('Error retrieving rooms:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rooms. Please try again.',
    });
  }
});

/**
 * GET /api/management/rooms/:id
 * Retrieves a single room with full allocation history
 */
roomManagementRouter.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        block: true,
        allocations: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                jntuNo: true,
                email: true,
              },
            },
          },
          orderBy: { allocatedAt: 'desc' },
        },
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: `Room with ID '${id}' was not found.`,
      });
      return;
    }

    const activeOccupants = room.allocations
      .filter((a) => a.status === 'ACTIVE')
      .map((alloc) => ({
        allocationId: alloc.id,
        studentId: alloc.student.id,
        name: alloc.student.name,
        jntuNo: alloc.student.jntuNo,
        email: alloc.student.email,
        bedNumber: alloc.bedNumber,
        allocatedAt: alloc.allocatedAt,
      }));

    const activeCount = activeOccupants.length;
    const availableBeds = Math.max(0, room.capacity - activeCount);
    const occupancyStatus =
      activeCount >= room.capacity
        ? 'Occupied'
        : activeCount > 0
        ? 'Partially Occupied'
        : 'Vacant';

    res.status(200).json({
      success: true,
      room: {
        id: room.id,
        blockId: room.blockId,
        block: room.block,
        roomNumber: room.roomNumber,
        floor: room.floor,
        roomType: room.roomType,
        capacity: room.capacity,
        status: room.status,
        occupancy: activeCount,
        availableBeds,
        occupancyStatus,
        activeOccupants,
        history: room.allocations,
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error retrieving room details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve room details.',
    });
  }
});

/**
 * POST /api/management/rooms
 * Creates a new room under an active block with validation and ActivityLog
 */
roomManagementRouter.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { blockId, roomNumber, floor, roomType, capacity, status } = req.body;

    // 1. Validate blockId
    if (!blockId || typeof blockId !== 'string' || !blockId.trim()) {
      res.status(400).json({
        success: false,
        message: 'A valid block ID is required.',
      });
      return;
    }

    const block = await prisma.block.findUnique({
      where: { id: blockId.trim() },
    });

    if (!block) {
      res.status(404).json({
        success: false,
        message: `Referenced block '${blockId}' does not exist.`,
      });
      return;
    }

    if (block.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        message: `Cannot add rooms to inactive block '${block.name}' (${block.code}).`,
      });
      return;
    }

    // 2. Validate roomNumber
    if (!roomNumber || typeof roomNumber !== 'string' || !roomNumber.trim()) {
      res.status(400).json({
        success: false,
        message: 'Room number is required.',
      });
      return;
    }
    const normalizedRoomNumber = roomNumber.trim();

    // Check uniqueness within block
    const existingRoom = await prisma.room.findUnique({
      where: {
        blockId_roomNumber: {
          blockId: block.id,
          roomNumber: normalizedRoomNumber,
        },
      },
    });

    if (existingRoom) {
      res.status(409).json({
        success: false,
        message: `Room '${normalizedRoomNumber}' already exists in block '${block.name}'.`,
      });
      return;
    }

    // 3. Validate capacity
    const parsedCapacity = Number(capacity);
    if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 10) {
      res.status(400).json({
        success: false,
        message: 'Capacity must be an integer between 1 and 10.',
      });
      return;
    }

    // 4. Validate floor
    const parsedFloor = floor !== undefined && floor !== null ? Number(floor) : 1;
    if (isNaN(parsedFloor) || parsedFloor < 0 || parsedFloor > 20) {
      res.status(400).json({
        success: false,
        message: 'Floor must be a valid non-negative number.',
      });
      return;
    }

    // 5. Validate status
    const normalizedStatus = typeof status === 'string' ? status.trim().toUpperCase() : 'ACTIVE';
    if (!['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'].includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: "Status must be 'ACTIVE', 'INACTIVE', or 'UNDER_MAINTENANCE'.",
      });
      return;
    }

    // 6. Create Room and ActivityLog in PostgreSQL Transaction
    const [newRoom] = await prisma.$transaction([
      prisma.room.create({
        data: {
          blockId: block.id,
          roomNumber: normalizedRoomNumber,
          floor: parsedFloor,
          roomType: typeof roomType === 'string' && roomType.trim() ? roomType.trim() : 'Non-AC Room (2 Sharing)',
          capacity: parsedCapacity,
          status: normalizedStatus,
        },
        include: {
          block: {
            select: { id: true, name: true, code: true, status: true },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Created room '${normalizedRoomNumber}' in block '${block.name}' with capacity ${parsedCapacity} and status ${normalizedStatus}`,
        },
      }),
    ]);

    // 7. Dispatch SSE
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ROOM_CREATED',
      timestamp: new Date().toISOString(),
      details: {
        roomId: newRoom.id,
        blockId: block.id,
        roomNumber: newRoom.roomNumber,
        capacity: newRoom.capacity,
      },
    });

    res.status(201).json({
      success: true,
      message: `Room '${newRoom.roomNumber}' created successfully in block '${block.name}'.`,
      room: {
        ...newRoom,
        occupancy: 0,
        availableBeds: newRoom.capacity,
        occupancyStatus: 'Vacant',
        activeOccupants: [],
      },
    });
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create room. Please try again.',
    });
  }
});

/**
 * PUT /api/management/rooms/:id
 * Updates an existing room with capacity checks and ActivityLog
 */
roomManagementRouter.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { roomNumber, floor, roomType, capacity, status, blockId } = req.body;

    const existingRoom = await prisma.room.findUnique({
      where: { id },
      include: {
        block: true,
        allocations: { where: { status: 'ACTIVE' } },
      },
    });

    if (!existingRoom) {
      res.status(404).json({
        success: false,
        message: `Room with ID '${id}' does not exist.`,
      });
      return;
    }

    const currentOccupancy = existingRoom.allocations.length;

    // Check capacity reduction
    if (capacity !== undefined) {
      const parsedCapacity = Number(capacity);
      if (!Number.isInteger(parsedCapacity) || parsedCapacity < 1 || parsedCapacity > 10) {
        res.status(400).json({
          success: false,
          message: 'Capacity must be an integer between 1 and 10.',
        });
        return;
      }
      if (parsedCapacity < currentOccupancy) {
        res.status(400).json({
          success: false,
          message: `Cannot set capacity to ${parsedCapacity}. The room currently has ${currentOccupancy} active student allocations. Vacate or reallocate residents first.`,
        });
        return;
      }
    }

    // Check block change
    let targetBlockId = existingRoom.blockId;
    if (blockId && blockId !== existingRoom.blockId) {
      const newBlock = await prisma.block.findUnique({ where: { id: blockId } });
      if (!newBlock) {
        res.status(404).json({ success: false, message: 'Target block does not exist.' });
        return;
      }
      if (newBlock.status !== 'ACTIVE') {
        res.status(400).json({ success: false, message: 'Target block is inactive.' });
        return;
      }
      targetBlockId = newBlock.id;
    }

    // Check room number change uniqueness
    if (roomNumber && roomNumber.trim() !== existingRoom.roomNumber) {
      const duplicate = await prisma.room.findUnique({
        where: {
          blockId_roomNumber: {
            blockId: targetBlockId,
            roomNumber: roomNumber.trim(),
          },
        },
      });
      if (duplicate && duplicate.id !== existingRoom.id) {
        res.status(409).json({
          success: false,
          message: `Room '${roomNumber.trim()}' already exists in this block.`,
        });
        return;
      }
    }

    // Validate status
    if (status !== undefined) {
      const normalizedStatus = status.trim().toUpperCase();
      if (!['ACTIVE', 'INACTIVE', 'UNDER_MAINTENANCE'].includes(normalizedStatus)) {
        res.status(400).json({
          success: false,
          message: "Status must be 'ACTIVE', 'INACTIVE', or 'UNDER_MAINTENANCE'.",
        });
        return;
      }
    }

    // Perform update in transaction with ActivityLog
    const [updatedRoom] = await prisma.$transaction([
      prisma.room.update({
        where: { id },
        data: {
          blockId: targetBlockId,
          roomNumber: roomNumber !== undefined ? roomNumber.trim() : undefined,
          floor: floor !== undefined ? Number(floor) : undefined,
          roomType: roomType !== undefined ? roomType.trim() : undefined,
          capacity: capacity !== undefined ? Number(capacity) : undefined,
          status: status !== undefined ? status.trim().toUpperCase() : undefined,
        },
        include: {
          block: { select: { id: true, name: true, code: true, status: true } },
          allocations: {
            where: { status: 'ACTIVE' },
            include: { student: { select: { id: true, name: true, jntuNo: true, email: true } } },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Updated room '${existingRoom.roomNumber}' (ID: ${id})`,
        },
      }),
    ]);

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ROOM_UPDATED',
      timestamp: new Date().toISOString(),
      details: { roomId: updatedRoom.id, roomNumber: updatedRoom.roomNumber },
    });

    res.status(200).json({
      success: true,
      message: `Room '${updatedRoom.roomNumber}' updated successfully.`,
      room: {
        ...updatedRoom,
        occupancy: currentOccupancy,
        availableBeds: Math.max(0, updatedRoom.capacity - currentOccupancy),
        occupancyStatus:
          currentOccupancy >= updatedRoom.capacity
            ? 'Occupied'
            : currentOccupancy > 0
            ? 'Partially Occupied'
            : 'Vacant',
      },
    });
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update room.',
    });
  }
});

/**
 * DELETE /api/management/rooms/:id
 * Safe deletion: rejects if room has active student allocations
 */
roomManagementRouter.delete('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        allocations: { where: { status: 'ACTIVE' } },
        block: true,
      },
    });

    if (!room) {
      res.status(404).json({
        success: false,
        message: `Room with ID '${id}' was not found.`,
      });
      return;
    }

    if (room.allocations.length > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete room '${room.roomNumber}' because it currently has ${room.allocations.length} active student allocation(s). Please vacate or reallocate residents before deleting.`,
      });
      return;
    }

    // Delete room and past historical allocations
    await prisma.$transaction([
      prisma.roomAllocation.deleteMany({ where: { roomId: id } }),
      prisma.room.delete({ where: { id } }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Deleted room '${room.roomNumber}' from block '${room.block.name}'`,
        },
      }),
    ]);

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ROOM_DELETED',
      timestamp: new Date().toISOString(),
      details: { roomId: id, roomNumber: room.roomNumber },
    });

    res.status(200).json({
      success: true,
      message: `Room '${room.roomNumber}' deleted successfully.`,
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete room. Please try again.',
    });
  }
});

// Helper: decode academic info from JNTU number
function decodeAcademicInfo(jntuNo: string) {
  const clean = (jntuNo || '').trim().toUpperCase();
  let degree = 'B.Tech';
  let department = 'Computer Science & Engineering (CSE)';
  let year = '2nd Year';
  let semester = 'Semester 1';

  if (clean.length >= 8) {
    const yearPrefix = clean.substring(0, 2);
    const branchCode = clean.substring(6, 8);

    const branchMap: Record<string, string> = {
      '44': 'Data Science (CSE-DS)',
      '05': 'Computer Science & Engineering (CSE)',
      '12': 'Information Technology (IT)',
      '04': 'Electronics & Communication (ECE)',
      '02': 'Electrical & Electronics (EEE)',
      '03': 'Mechanical Engineering (MECH)',
      '01': 'Civil Engineering (CIVIL)',
      '42': 'Artificial Intelligence & Machine Learning (CSE-AI&ML)',
    };
    if (branchMap[branchCode]) {
      department = branchMap[branchCode];
    }

    if (yearPrefix === '25') {
      year = '1st Year';
      semester = 'Semester 1';
    } else if (yearPrefix === '24') {
      year = '2nd Year';
      semester = 'Semester 1';
    } else if (yearPrefix === '23') {
      year = '2nd Year';
      semester = 'Semester 1';
    } else if (yearPrefix === '22') {
      year = '3rd Year';
      semester = 'Semester 1';
    } else if (yearPrefix === '21') {
      year = '4th Year';
      semester = 'Semester 2';
    }
  }

  return { degree, department, year, semester };
}

/**
 * GET /api/management/room-allocations/pending
 * Returns pending room allocation requests with student profile, preferences,
 * biometric status, photos, and pagination
 */
roomAllocationRouter.get('/pending', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { search, block, roomType, biometricStatus } = req.query;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.max(1, Math.min(50, parseInt(req.query.limit as string, 10) || 10));
    const skip = (page - 1) * limit;

    // Total un-filtered pending count from PostgreSQL
    const totalPendingCount = await prisma.student.count({
      where: {
        role: 'STUDENT',
        allocationStatus: 'PENDING',
        isActive: true,
      },
    });

    const whereClause: any = {
      role: 'STUDENT',
      allocationStatus: 'PENDING',
      isActive: true,
    };

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { jntuNo: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (typeof block === 'string' && block.trim() && block.trim().toUpperCase() !== 'ALL') {
      whereClause.blockName = { contains: block.trim(), mode: 'insensitive' };
    }

    if (typeof roomType === 'string' && roomType.trim() && roomType.trim().toUpperCase() !== 'ALL') {
      whereClause.roomType = { contains: roomType.trim(), mode: 'insensitive' };
    }

    const [filteredCount, students] = await Promise.all([
      prisma.student.count({ where: whereClause }),
      prisma.student.findMany({
        where: whereClause,
        include: {
          biometricEvents: {
            orderBy: { eventTimestamp: 'desc' },
            take: 5,
          },
          outings: {
            where: { emergencyContact: { not: null } },
            select: { emergencyContact: true },
            take: 1,
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    // Map to rich pending allocation format
    const formattedPending = students.map((student) => {
      const academic = decodeAcademicInfo(student.jntuNo);
      const hasVerifiedBiometric = student.biometricEvents.some(
        (b) => b.verificationStatus === 'VERIFIED'
      );
      const bioStatus = hasVerifiedBiometric
        ? 'VERIFIED'
        : student.biometricEvents.length > 0
        ? 'ENROLLED'
        : 'PENDING';

      const phone = student.outings[0]?.emergencyContact || '+91 98765 43210';

      return {
        id: student.id,
        studentId: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        email: student.email,
        phone,
        createdAt: student.createdAt,
        updatedAt: student.updatedAt,
        courseInfo: academic,
        preferences: {
          roomPreference: student.roomType || 'Non-AC Room (2 Sharing)',
          sharingPreference: `${student.roomCapacity || 2} Sharing`,
          blockPreference: student.blockName || 'Boys-Block-D',
          floorPreference: student.floorName || 'First Floor',
        },
        documents: {
          biometricStatus: bioStatus,
          photos: 'SUBMITTED',
        },
        biometricEventsCount: student.biometricEvents.length,
        lastBiometricEvent: student.biometricEvents[0] || null,
      };
    });

    // Optional post-filter for biometricStatus
    let results = formattedPending;
    if (typeof biometricStatus === 'string' && biometricStatus.trim() && biometricStatus.trim().toUpperCase() !== 'ALL') {
      const filterBio = biometricStatus.trim().toUpperCase();
      results = formattedPending.filter((p) => p.documents.biometricStatus.toUpperCase() === filterBio);
    }

    res.status(200).json({
      success: true,
      pendingCount: totalPendingCount,
      total: filteredCount,
      page,
      limit,
      totalPages: Math.ceil(filteredCount / limit) || 1,
      data: results,
    });
  } catch (error) {
    console.error('Error retrieving pending allocations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve pending allocations.',
    });
  }
});

/**
 * POST /api/management/room-allocations/reject (or /:studentId/reject)
 * Rejects a pending student room allocation request with explicit reason confirmation
 */
roomAllocationRouter.post('/reject', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { studentId, reason } = req.body;

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      res.status(400).json({ success: false, message: 'Student ID is required.' });
      return;
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      res.status(400).json({ success: false, message: 'Rejection reason is required.' });
      return;
    }

    const sId = studentId.trim();
    const rejectionReason = reason.trim();

    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: sId },
      });

      if (!student) {
        throw new Error(`STUDENT_NOT_FOUND: Student with ID '${sId}' does not exist.`);
      }

      if (student.allocationStatus !== 'PENDING') {
        throw new Error(
          `NOT_PENDING: Student is currently '${student.allocationStatus}' and cannot be rejected as pending.`
        );
      }

      const updatedStudent = await tx.student.update({
        where: { id: sId },
        data: {
          allocationStatus: 'NOT_ALLOCATED',
          blockName: null,
          floorName: null,
          roomNumber: null,
          bedNumber: null,
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          action: 'REJECT',
          actorRole: req.managementUser!.role,
          entity: 'RoomAllocation',
          entityId: sId,
          previousState: 'PENDING',
          newState: 'NOT_ALLOCATED',
          description: `Rejected room allocation request for student ${student.name} (${student.jntuNo}). Reason: ${rejectionReason}`,
        },
      });

      await tx.notification.create({
        data: {
          studentId: sId,
          title: 'Room Allocation Request Rejected',
          message: `Your room allocation request has been rejected. Reason: ${rejectionReason}`,
          type: 'WARNING',
          category: 'ROOM',
        },
      });

      return { student: updatedStudent, reason: rejectionReason };
    });

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ALLOCATION_REJECTED',
      timestamp: new Date().toISOString(),
      details: {
        studentId: result.student.id,
        studentName: result.student.name,
        jntuNo: result.student.jntuNo,
        reason: result.reason,
      },
    });

    complaintEventsService.emitRoomEventToStudent(result.student.id, {
      type: 'ALLOCATION_REJECTED',
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: { reason: result.reason },
    });

    res.status(200).json({
      success: true,
      message: `Room allocation request for ${result.student.name} rejected successfully.`,
      student: result.student,
    });
  } catch (error: any) {
    console.error('Error rejecting room allocation:', error.message);
    const msg = error.message || '';
    if (msg.startsWith('STUDENT_NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (msg.startsWith('NOT_PENDING:')) {
      res.status(400).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to reject room allocation.',
    });
  }
});

roomAllocationRouter.post('/:studentId/reject', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  const { studentId } = req.params;
  req.body.studentId = studentId;
  const { reason } = req.body;

  if (!reason || typeof reason !== 'string' || !reason.trim()) {
    res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    return;
  }

  const sId = studentId.trim();
  const rejectionReason = reason.trim();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const student = await tx.student.findUnique({
        where: { id: sId },
      });

      if (!student) {
        throw new Error(`STUDENT_NOT_FOUND: Student with ID '${sId}' does not exist.`);
      }

      if (student.allocationStatus !== 'PENDING') {
        throw new Error(
          `NOT_PENDING: Student is currently '${student.allocationStatus}' and cannot be rejected as pending.`
        );
      }

      const updatedStudent = await tx.student.update({
        where: { id: sId },
        data: {
          allocationStatus: 'NOT_ALLOCATED',
          blockName: null,
          floorName: null,
          roomNumber: null,
          bedNumber: null,
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          action: 'REJECT',
          actorRole: req.managementUser!.role,
          entity: 'RoomAllocation',
          entityId: sId,
          previousState: 'PENDING',
          newState: 'NOT_ALLOCATED',
          description: `Rejected room allocation request for student ${student.name} (${student.jntuNo}). Reason: ${rejectionReason}`,
        },
      });

      await tx.notification.create({
        data: {
          studentId: sId,
          title: 'Room Allocation Request Rejected',
          message: `Your room allocation request has been rejected. Reason: ${rejectionReason}`,
          type: 'WARNING',
          category: 'ROOM',
        },
      });

      return { student: updatedStudent, reason: rejectionReason };
    });

    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ALLOCATION_REJECTED',
      timestamp: new Date().toISOString(),
      details: {
        studentId: result.student.id,
        studentName: result.student.name,
        jntuNo: result.student.jntuNo,
        reason: result.reason,
      },
    });

    complaintEventsService.emitRoomEventToStudent(result.student.id, {
      type: 'ALLOCATION_REJECTED',
      studentId: result.student.id,
      timestamp: new Date().toISOString(),
      details: { reason: result.reason },
    });

    res.status(200).json({
      success: true,
      message: `Room allocation request for ${result.student.name} rejected successfully.`,
      student: result.student,
    });
  } catch (error: any) {
    console.error('Error rejecting room allocation:', error.message);
    const msg = error.message || '';
    if (msg.startsWith('STUDENT_NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (msg.startsWith('NOT_PENDING:')) {
      res.status(400).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to reject room allocation.',
    });
  }
});

/**
 * GET /api/management/room-allocations/eligible-students
 * Returns active students eligible for room allocation (unallocated, not suspended)
 */
roomAllocationRouter.get('/eligible-students', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const now = new Date();

    // 1. Find all active students with role STUDENT
    const allStudents = await prisma.student.findMany({
      where: {
        role: 'STUDENT',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        jntuNo: true,
        email: true,
        allocationStatus: true,
      },
      orderBy: { name: 'asc' },
    });

    // 2. Find students who currently have ACTIVE allocations
    const activeAllocations = await prisma.roomAllocation.findMany({
      where: { status: 'ACTIVE' },
      select: { studentId: true },
    });
    const allocatedStudentIds = new Set(activeAllocations.map((a) => a.studentId));

    // 3. Find students who currently have ACTIVE suspensions
    const activeSuspensions = await prisma.suspension.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now },
      },
      select: { studentId: true },
    });
    const suspendedStudentIds = new Set(activeSuspensions.map((s) => s.studentId));

    // 4. Filter eligible
    const eligibleStudents = allStudents.filter(
      (s) => !allocatedStudentIds.has(s.id) && !suspendedStudentIds.has(s.id)
    );

    res.status(200).json({
      success: true,
      count: eligibleStudents.length,
      students: eligibleStudents,
    });
  } catch (error) {
    console.error('Error retrieving eligible students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve eligible students.',
    });
  }
});

/**
 * GET /api/management/room-allocations
 * Returns allocations with student and room details, supporting filters
 */
roomAllocationRouter.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { roomId, studentId, status, search } = req.query;

    const whereClause: any = {};

    if (typeof roomId === 'string' && roomId.trim()) {
      whereClause.roomId = roomId.trim();
    }

    if (typeof studentId === 'string' && studentId.trim()) {
      whereClause.studentId = studentId.trim();
    }

    if (typeof status === 'string' && status.trim() && status.trim().toUpperCase() !== 'ALL') {
      whereClause.status = status.trim().toUpperCase();
    }

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { student: { name: { contains: term, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: term, mode: 'insensitive' } } },
        { room: { roomNumber: { contains: term, mode: 'insensitive' } } },
        { room: { block: { name: { contains: term, mode: 'insensitive' } } } },
      ];
    }

    const allocations = await prisma.roomAllocation.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            email: true,
            isActive: true,
          },
        },
        room: {
          include: {
            block: {
              select: {
                id: true,
                name: true,
                code: true,
                status: true,
              },
            },
          },
        },
      },
      orderBy: { allocatedAt: 'desc' },
    });

    res.status(200).json({
      success: true,
      count: allocations.length,
      allocations,
    });
  } catch (error) {
    console.error('Error retrieving allocations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve allocations.',
    });
  }
});

/**
 * POST /api/management/room-allocations
 * Allocates a student to a room atomically with transaction and over-allocation prevention
 */
roomAllocationRouter.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { roomId, studentId, bedNumber } = req.body;

    if (!roomId || typeof roomId !== 'string' || !roomId.trim()) {
      res.status(400).json({ success: false, message: 'Room ID is required.' });
      return;
    }

    if (!studentId || typeof studentId !== 'string' || !studentId.trim()) {
      res.status(400).json({ success: false, message: 'Student ID is required.' });
      return;
    }

    const rId = roomId.trim();
    const sId = studentId.trim();

    // Execute allocation inside a single PostgreSQL Transaction
    const allocationResult = await prisma.$transaction(async (tx) => {
      // 1. Verify Student exists and is eligible
      const student = await tx.student.findUnique({
        where: { id: sId },
      });

      if (!student) {
        throw new Error(`STUDENT_NOT_FOUND: Student with ID '${sId}' does not exist.`);
      }

      if (!student.isActive) {
        throw new Error('STUDENT_INACTIVE: This student account is deactivated.');
      }

      if (student.role !== 'STUDENT') {
        throw new Error('NOT_A_STUDENT: Only students can receive room allocations.');
      }

      // Check active suspension
      const activeSuspension = await tx.suspension.findFirst({
        where: {
          studentId: sId,
          status: 'ACTIVE',
          endDate: { gte: new Date() },
        },
      });

      if (activeSuspension) {
        throw new Error('STUDENT_SUSPENDED: Cannot allocate room to a currently suspended student.');
      }

      // Check existing active allocation
      const existingAlloc = await tx.roomAllocation.findFirst({
        where: {
          studentId: sId,
          status: 'ACTIVE',
        },
        include: {
          room: { include: { block: true } },
        },
      });

      if (existingAlloc) {
        throw new Error(
          `ALREADY_ALLOCATED: Student is already actively allocated to ${existingAlloc.room.block.name} Room ${existingAlloc.room.roomNumber}.`
        );
      }

      // 2. Verify Room exists and is ACTIVE
      const room = await tx.room.findUnique({
        where: { id: rId },
        include: { block: true },
      });

      if (!room) {
        throw new Error(`ROOM_NOT_FOUND: Room with ID '${rId}' does not exist.`);
      }

      if (room.status !== 'ACTIVE') {
        throw new Error(`ROOM_INACTIVE: Room '${room.roomNumber}' is ${room.status} and cannot accept allocations.`);
      }

      // 3. Verify Block is ACTIVE
      if (room.block.status !== 'ACTIVE') {
        throw new Error(`BLOCK_INACTIVE: Block '${room.block.name}' is inactive. Cannot allocate rooms in inactive blocks.`);
      }

      // 4. Over-allocation check (Concurrency safe)
      const currentActiveCount = await tx.roomAllocation.count({
        where: {
          roomId: rId,
          status: 'ACTIVE',
        },
      });

      if (currentActiveCount >= room.capacity) {
        throw new Error(`ROOM_FULL: Room '${room.roomNumber}' is at full capacity (${currentActiveCount}/${room.capacity}).`);
      }

      // 5. Determine bed number
      let assignedBed = bedNumber ? String(bedNumber).trim() : null;
      if (assignedBed) {
        const bedTaken = await tx.roomAllocation.findFirst({
          where: {
            roomId: rId,
            bedNumber: assignedBed,
            status: 'ACTIVE',
          },
        });
        if (bedTaken) {
          throw new Error(`BED_OCCUPIED: Bed '${assignedBed}' is already occupied in room '${room.roomNumber}'.`);
        }
      } else {
        // Auto-assign next available bed
        const occupiedBeds = await tx.roomAllocation
          .findMany({
            where: { roomId: rId, status: 'ACTIVE' },
            select: { bedNumber: true },
          })
          .then((list) => new Set(list.map((b) => b.bedNumber)));

        for (let i = 1; i <= room.capacity; i++) {
          const candidate = `Bed-${i}`;
          if (!occupiedBeds.has(candidate)) {
            assignedBed = candidate;
            break;
          }
        }
        if (!assignedBed) assignedBed = `Bed-${currentActiveCount + 1}`;
      }

      // 6. Create RoomAllocation record
      const allocation = await tx.roomAllocation.create({
        data: {
          roomId: rId,
          studentId: sId,
          bedNumber: assignedBed,
          status: 'ACTIVE',
          allocatedAt: new Date(),
        },
        include: {
          student: true,
          room: { include: { block: true } },
        },
      });

      // 7. Update Student denormalized fields for backwards compatibility
      await tx.student.update({
        where: { id: sId },
        data: {
          allocationStatus: 'ALLOCATED',
          blockName: room.block.name,
          roomNumber: room.roomNumber,
          floorName: String(room.floor || 1),
          roomType: room.roomType,
          roomCapacity: room.capacity,
          bedNumber: assignedBed,
          allocatedAt: new Date(),
        },
      });

      // 8. Create ActivityLog
      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Allocated student ${student.name} (${student.jntuNo}) to ${room.block.name} Room ${room.roomNumber} (${assignedBed})`,
        },
      });

      // 9. Notification for student
      await tx.notification.create({
        data: {
          studentId: sId,
          title: 'Room Allocation Confirmed',
          message: `You have been officially allocated ${assignedBed} in ${room.block.name}, Room ${room.roomNumber}.`,
          type: 'SUCCESS',
          category: 'ROOM',
        },
      });

      return allocation;
    });

    // 10. Dispatch SSE events
    complaintEventsService.emitRoomEventToStudent(sId, {
      type: 'STUDENT_ALLOCATED',
      roomId: rId,
      studentId: sId,
      allocationId: allocationResult.id,
      timestamp: new Date().toISOString(),
      details: {
        roomNumber: allocationResult.room.roomNumber,
        blockName: allocationResult.room.block.name,
        bedNumber: allocationResult.bedNumber,
      },
    });

    res.status(201).json({
      success: true,
      message: `Student ${allocationResult.student.name} successfully allocated to Room ${allocationResult.room.roomNumber} (${allocationResult.bedNumber}).`,
      allocation: allocationResult,
    });
  } catch (error: any) {
    console.error('Error allocating room:', error.message);
    const msg = error.message || '';

    if (msg.startsWith('STUDENT_NOT_FOUND:') || msg.startsWith('ROOM_NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (msg.startsWith('ALREADY_ALLOCATED:') || msg.startsWith('BED_OCCUPIED:')) {
      res.status(409).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (
      msg.startsWith('STUDENT_INACTIVE:') ||
      msg.startsWith('NOT_A_STUDENT:') ||
      msg.startsWith('STUDENT_SUSPENDED:') ||
      msg.startsWith('ROOM_INACTIVE:') ||
      msg.startsWith('BLOCK_INACTIVE:') ||
      msg.startsWith('ROOM_FULL:')
    ) {
      res.status(400).json({ success: false, message: msg.split(': ')[1] });
      return;
    }

    res.status(500).json({
      success: false,
      message: 'Failed to allocate student to room. Please try again.',
    });
  }
});

/**
 * POST /api/management/room-allocations/:id/vacate
 * Vacates an active student allocation atomically
 */
roomAllocationRouter.post('/:id/vacate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const result = await prisma.$transaction(async (tx) => {
      const allocation = await tx.roomAllocation.findUnique({
        where: { id },
        include: {
          student: true,
          room: { include: { block: true } },
        },
      });

      if (!allocation) {
        throw new Error('ALLOCATION_NOT_FOUND: Allocation record not found.');
      }

      if (allocation.status !== 'ACTIVE') {
        throw new Error(`ALREADY_VACATED: Allocation is already ${allocation.status}.`);
      }

      // 1. Mark allocation as VACATED
      const updatedAlloc = await tx.roomAllocation.update({
        where: { id },
        data: {
          status: 'VACATED',
          vacatedAt: new Date(),
        },
      });

      // 2. Update Student denormalized fields
      await tx.student.update({
        where: { id: allocation.studentId },
        data: {
          allocationStatus: 'NOT_ALLOCATED',
          blockName: null,
          roomNumber: null,
          floorName: null,
          bedNumber: null,
        },
      });

      // 3. ActivityLog
      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Vacated student ${allocation.student.name} (${allocation.student.jntuNo}) from ${allocation.room.block.name} Room ${allocation.room.roomNumber} (${allocation.bedNumber})`,
        },
      });

      // 4. Student notification
      await tx.notification.create({
        data: {
          studentId: allocation.studentId,
          title: 'Room Allocation Vacated',
          message: `Your room allocation in ${allocation.room.block.name}, Room ${allocation.room.roomNumber} has been officially vacated.`,
          type: 'INFO',
          category: 'ROOM',
        },
      });

      return {
        allocation: updatedAlloc,
        studentId: allocation.studentId,
        studentName: allocation.student.name,
        roomNumber: allocation.room.roomNumber,
        blockName: allocation.room.block.name,
        roomId: allocation.roomId,
      };
    });

    // Realtime SSE event
    complaintEventsService.emitRoomEventToStudent(result.studentId, {
      type: 'STUDENT_VACATED',
      roomId: result.roomId,
      studentId: result.studentId,
      allocationId: id,
      timestamp: new Date().toISOString(),
      details: {
        studentName: result.studentName,
        roomNumber: result.roomNumber,
        blockName: result.blockName,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${result.studentName} vacated successfully from Room ${result.roomNumber}.`,
      allocation: result.allocation,
    });
  } catch (error: any) {
    console.error('Error vacating student:', error.message);
    const msg = error.message || '';
    if (msg.startsWith('ALLOCATION_NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (msg.startsWith('ALREADY_VACATED:')) {
      res.status(400).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to vacate room allocation.',
    });
  }
});

/**
 * POST /api/management/room-allocations/:id/reallocate
 * Atomically reallocates a student to a new room
 */
roomAllocationRouter.post('/:id/reallocate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { targetRoomId, newBedNumber } = req.body;

    if (!targetRoomId || typeof targetRoomId !== 'string' || !targetRoomId.trim()) {
      res.status(400).json({ success: false, message: 'Target room ID is required for reallocation.' });
      return;
    }

    const tRoomId = targetRoomId.trim();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch current active allocation
      const currentAlloc = await tx.roomAllocation.findUnique({
        where: { id },
        include: {
          student: true,
          room: { include: { block: true } },
        },
      });

      if (!currentAlloc) {
        throw new Error('ALLOCATION_NOT_FOUND: Allocation record not found.');
      }

      if (currentAlloc.status !== 'ACTIVE') {
        throw new Error(`NOT_ACTIVE: Current allocation is already ${currentAlloc.status}.`);
      }

      // 2. Fetch new room
      const newRoom = await tx.room.findUnique({
        where: { id: tRoomId },
        include: { block: true },
      });

      if (!newRoom) {
        throw new Error(`TARGET_NOT_FOUND: Target room '${tRoomId}' does not exist.`);
      }

      if (newRoom.status !== 'ACTIVE') {
        throw new Error(`TARGET_INACTIVE: Target room '${newRoom.roomNumber}' is ${newRoom.status}.`);
      }

      if (newRoom.block.status !== 'ACTIVE') {
        throw new Error(`TARGET_BLOCK_INACTIVE: Target block '${newRoom.block.name}' is inactive.`);
      }

      // Check capacity in target room
      const targetActiveCount = await tx.roomAllocation.count({
        where: {
          roomId: tRoomId,
          status: 'ACTIVE',
        },
      });

      // If target room is different from current room, check capacity
      if (tRoomId !== currentAlloc.roomId && targetActiveCount >= newRoom.capacity) {
        throw new Error(`TARGET_FULL: Target room '${newRoom.roomNumber}' is at full capacity.`);
      }

      // Determine bed number in target room
      let assignedBed = newBedNumber ? String(newBedNumber).trim() : null;
      if (assignedBed) {
        const bedTaken = await tx.roomAllocation.findFirst({
          where: {
            roomId: tRoomId,
            bedNumber: assignedBed,
            status: 'ACTIVE',
            id: { not: id },
          },
        });
        if (bedTaken) {
          throw new Error(`BED_OCCUPIED: Bed '${assignedBed}' is already occupied in room '${newRoom.roomNumber}'.`);
        }
      } else {
        const occupiedBeds = await tx.roomAllocation
          .findMany({
            where: { roomId: tRoomId, status: 'ACTIVE', id: { not: id } },
            select: { bedNumber: true },
          })
          .then((l) => new Set(l.map((b) => b.bedNumber)));

        for (let i = 1; i <= newRoom.capacity; i++) {
          const cand = `Bed-${i}`;
          if (!occupiedBeds.has(cand)) {
            assignedBed = cand;
            break;
          }
        }
        if (!assignedBed) assignedBed = `Bed-${targetActiveCount + 1}`;
      }

      // 3. Mark old allocation as REALLOCATED
      await tx.roomAllocation.update({
        where: { id },
        data: {
          status: 'REALLOCATED',
          vacatedAt: new Date(),
        },
      });

      // 4. Create new allocation
      const newAlloc = await tx.roomAllocation.create({
        data: {
          roomId: tRoomId,
          studentId: currentAlloc.studentId,
          bedNumber: assignedBed,
          status: 'ACTIVE',
          allocatedAt: new Date(),
        },
        include: {
          student: true,
          room: { include: { block: true } },
        },
      });

      // 5. Update Student denormalized fields
      await tx.student.update({
        where: { id: currentAlloc.studentId },
        data: {
          allocationStatus: 'ALLOCATED',
          blockName: newRoom.block.name,
          roomNumber: newRoom.roomNumber,
          floorName: String(newRoom.floor || 1),
          roomType: newRoom.roomType,
          roomCapacity: newRoom.capacity,
          bedNumber: assignedBed,
          allocatedAt: new Date(),
        },
      });

      // 6. ActivityLog
      await tx.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Reallocated student ${currentAlloc.student.name} (${currentAlloc.student.jntuNo}) from ${currentAlloc.room.block.name} Room ${currentAlloc.room.roomNumber} to ${newRoom.block.name} Room ${newRoom.roomNumber} (${assignedBed})`,
        },
      });

      // 7. Student Notification
      await tx.notification.create({
        data: {
          studentId: currentAlloc.studentId,
          title: 'Room Reallocation Confirmed',
          message: `Your room has been reallocated to ${newRoom.block.name}, Room ${newRoom.roomNumber} (${assignedBed}).`,
          type: 'SUCCESS',
          category: 'ROOM',
        },
      });

      return {
        newAllocation: newAlloc,
        studentId: currentAlloc.studentId,
        studentName: currentAlloc.student.name,
        oldRoomNumber: currentAlloc.room.roomNumber,
        newRoomNumber: newRoom.roomNumber,
        newBlockName: newRoom.block.name,
        newBedNumber: assignedBed,
        targetRoomId: tRoomId,
      };
    });

    // Realtime SSE event
    complaintEventsService.emitRoomEventToStudent(result.studentId, {
      type: 'STUDENT_REALLOCATED',
      roomId: result.targetRoomId,
      studentId: result.studentId,
      allocationId: result.newAllocation.id,
      timestamp: new Date().toISOString(),
      details: {
        studentName: result.studentName,
        oldRoomNumber: result.oldRoomNumber,
        newRoomNumber: result.newRoomNumber,
        newBlockName: result.newBlockName,
        newBedNumber: result.newBedNumber,
      },
    });

    res.status(200).json({
      success: true,
      message: `Student ${result.studentName} reallocated to Room ${result.newRoomNumber} (${result.newBedNumber}).`,
      allocation: result.newAllocation,
    });
  } catch (error: any) {
    console.error('Error reallocating student:', error.message);
    const msg = error.message || '';
    if (msg.startsWith('ALLOCATION_NOT_FOUND:') || msg.startsWith('TARGET_NOT_FOUND:')) {
      res.status(404).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (msg.startsWith('BED_OCCUPIED:')) {
      res.status(409).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    if (
      msg.startsWith('NOT_ACTIVE:') ||
      msg.startsWith('TARGET_INACTIVE:') ||
      msg.startsWith('TARGET_BLOCK_INACTIVE:') ||
      msg.startsWith('TARGET_FULL:')
    ) {
      res.status(400).json({ success: false, message: msg.split(': ')[1] });
      return;
    }
    res.status(500).json({
      success: false,
      message: 'Failed to reallocate student.',
    });
  }
});

/**
 * DELETE /api/management/room-allocations/:id
 * Equivalent to vacating an active allocation
 */
roomAllocationRouter.delete('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  try {
    const allocation = await prisma.roomAllocation.findUnique({
      where: { id },
      include: { student: true, room: { include: { block: true } } },
    });

    if (!allocation) {
      res.status(404).json({ success: false, message: 'Allocation not found.' });
      return;
    }

    if (allocation.status !== 'ACTIVE') {
      res.status(400).json({ success: false, message: `Allocation is already ${allocation.status}.` });
      return;
    }

    await prisma.$transaction([
      prisma.roomAllocation.update({
        where: { id },
        data: { status: 'VACATED', vacatedAt: new Date() },
      }),
      prisma.student.update({
        where: { id: allocation.studentId },
        data: { allocationStatus: 'NOT_ALLOCATED', blockName: null, roomNumber: null, floorName: null, bedNumber: null },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'ROOM_MANAGEMENT',
          description: `Vacated student ${allocation.student.name} (${allocation.student.jntuNo}) from ${allocation.room.block.name} Room ${allocation.room.roomNumber}`,
        },
      }),
    ]);

    complaintEventsService.emitRoomEventToStudent(allocation.studentId, {
      type: 'STUDENT_VACATED',
      roomId: allocation.roomId,
      studentId: allocation.studentId,
      allocationId: id,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Student ${allocation.student.name} vacated successfully.`,
    });
  } catch (error) {
    console.error('Error deleting allocation:', error);
    res.status(500).json({ success: false, message: 'Failed to vacate allocation.' });
  }
});

// Also mount /allocations under roomManagementRouter for convenience
roomManagementRouter.use('/allocations', roomAllocationRouter);

export { roomManagementRouter, roomAllocationRouter };
export default roomManagementRouter;
