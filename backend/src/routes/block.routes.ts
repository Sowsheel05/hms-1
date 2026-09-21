import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { auditService } from '../services/audit.service';

const router = Router();

// All block management routes require authoritative management access
router.use(authenticateManagement);

/**
 * Authoritatively computes statistics for a given block from PostgreSQL Room,
 * RoomAllocation, and Student records.
 *
 * Formula:
 * vacant = total capacity - occupied - maintenance
 * vacancy rate = total capacity > 0 ? (vacant / total capacity) * 100 : 0%
 */
async function getBlockStatistics(block: { id: string; name: string; code: string; status: string }) {
  // Query all rooms linked to this block in PostgreSQL
  const dbRooms = await prisma.room.findMany({
    where: { blockId: block.id },
    include: {
      allocations: {
        where: { status: 'ACTIVE' },
      },
    },
  });

  // Query all active allocated students associated with this block
  const allocatedStudents = await prisma.student.findMany({
    where: {
      OR: [
        { blockName: block.name },
        { blockName: block.code },
      ],
      allocationStatus: 'ALLOCATED',
      isActive: true,
    },
    select: {
      id: true,
      roomNumber: true,
      roomCapacity: true,
    },
  });

  let totalRooms = 0;
  let totalCapacity = 0;
  let occupied = 0;
  let maintenance = 0;

  if (dbRooms.length > 0) {
    totalRooms = dbRooms.length;
    for (const room of dbRooms) {
      const cap = room.capacity || 2;
      totalCapacity += cap;

      if (room.status === 'UNDER_MAINTENANCE') {
        maintenance += cap;
      } else {
        occupied += room.allocations.length;
      }
    }
    // If student table has allocated residents not tracked in allocations, ensure occupied is accurate
    if (allocatedStudents.length > occupied) {
      occupied = allocatedStudents.length;
    }
  } else if (allocatedStudents.length > 0) {
    // If block has student allocations before explicit room records
    const distinctRooms = new Set<string>();
    for (const s of allocatedStudents) {
      if (s.roomNumber) distinctRooms.add(s.roomNumber);
      totalCapacity += s.roomCapacity || 2;
    }
    totalRooms = distinctRooms.size || allocatedStudents.length;
    occupied = allocatedStudents.length;
  }

  const vacant = Math.max(0, totalCapacity - occupied - maintenance);

  let vacancyRate = '0%';
  if (totalCapacity > 0) {
    const rate = (vacant / totalCapacity) * 100;
    if (rate % 1 === 0) {
      vacancyRate = `${Math.round(rate)}%`;
    } else {
      vacancyRate = `${(Math.round(rate * 10) / 10).toFixed(1)}%`;
    }
  }

  return {
    activeResidents: allocatedStudents.length,
    totalRooms,
    totalCapacity,
    occupied,
    vacant,
    maintenance,
    vacancyRate,
  };
}

/**
 * GET /api/management/blocks
 * Retrieves all blocks with authoritative PostgreSQL computed statistics and filtering
 */
router.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;

    const whereClause: any = {};
    if (req.collegeCode) {
      whereClause.collegeCode = req.collegeCode;
    }

    if (typeof status === 'string' && status.trim()) {
      const normalizedStatus = status.trim().toUpperCase();
      if (['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        whereClause.status = normalizedStatus;
      }
    }

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { code: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    const blocks = await prisma.block.findMany({
      where: whereClause,
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    });

    // Authoritative aggregation per block
    const blocksWithStats = await Promise.all(
      blocks.map(async (block) => {
        const stats = await getBlockStatistics(block);
        return {
          ...block,
          ...stats,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: blocksWithStats.length,
      blocks: blocksWithStats,
    });
  } catch (error) {
    console.error('Error retrieving blocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve hostel blocks. Please try again.',
    });
  }
});

/**
 * GET /api/management/blocks/:id
 * Retrieves a single block by ID with authoritative PostgreSQL computed statistics
 */
router.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const block = await prisma.block.findUnique({
      where: { id },
      include: {
        rooms: {
          orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }],
          include: {
            allocations: {
              where: { status: 'ACTIVE' },
              include: {
                student: {
                  select: {
                    id: true,
                    name: true,
                    jntuNo: true,
                    email: true,
                    role: true,
                    blockName: true,
                    floorName: true,
                    roomNumber: true,
                    bedNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!block) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    const stats = await getBlockStatistics(block);

    res.status(200).json({
      success: true,
      block: {
        ...block,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Error retrieving block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve block details.',
    });
  }
});

/**
 * POST /api/management/blocks
 * Creates a new authoritative hostel block with validation and audit logging
 */
router.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { name, code, description, status = 'ACTIVE' } = req.body;

    // 1. Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Block name must be at least 2 characters.',
      });
      return;
    }

    if (!code || typeof code !== 'string' || code.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Block code must be at least 2 characters.',
      });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();
    const normalizedName = name.trim();
    const normalizedStatus = (status || 'ACTIVE').toUpperCase();

    if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
      res.status(400).json({
        success: false,
        message: "Status must be either 'ACTIVE' or 'INACTIVE'.",
      });
      return;
    }

    // 2. Uniqueness check
    const existingBlock = await prisma.block.findUnique({
      where: { code: normalizedCode },
    });

    if (existingBlock) {
      res.status(409).json({
        success: false,
        message: `A block with code '${normalizedCode}' already exists (${existingBlock.name}).`,
      });
      return;
    }

    // 3. Create block and audit log in transaction
    const newBlock = await prisma.$transaction(async (tx) => {
      const created = await tx.block.create({
        data: {
          name: normalizedName,
          code: normalizedCode,
          description: typeof description === 'string' ? description.trim() : null,
          status: normalizedStatus,
        },
      });

      await auditService.recordLog(
        {
          actorId: req.managementUser!.id,
          actorRole: req.managementUser!.role,
          action: 'BLOCK_CREATED',
          actionType: 'BLOCK_MANAGEMENT',
          entity: 'Block',
          entityId: created.id,
          newState: {
            name: normalizedName,
            code: normalizedCode,
            status: normalizedStatus,
          },
          description: `Created block '${normalizedName}' (${normalizedCode}) with status ${normalizedStatus}`,
        },
        tx as any,
        false
      );

      return created;
    });

    // 4. Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'BLOCK_CREATED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: newBlock.id,
        name: newBlock.name,
        code: newBlock.code,
        status: newBlock.status,
      },
    });

    res.status(201).json({
      success: true,
      message: `Block '${newBlock.name}' created successfully.`,
      block: {
        ...newBlock,
        activeResidents: 0,
        totalRooms: 0,
        totalCapacity: 0,
        occupied: 0,
        vacant: 0,
        maintenance: 0,
        vacancyRate: '0%',
      },
    });
  } catch (error) {
    console.error('Error creating block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create block. Please try again.',
    });
  }
});

/**
 * PUT /api/management/blocks/:id
 * Updates an existing block with validation, uniqueness checks, and audit logging
 */
router.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, code, description, status } = req.body;

    const existingBlock = await prisma.block.findUnique({
      where: { id },
    });

    if (!existingBlock) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    const updateData: any = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Block name must be at least 2 characters.',
        });
        return;
      }
      updateData.name = name.trim();
    }

    if (code !== undefined) {
      if (typeof code !== 'string' || code.trim().length < 2) {
        res.status(400).json({
          success: false,
          message: 'Block code must be at least 2 characters.',
        });
        return;
      }
      const normalizedCode = code.trim().toUpperCase();
      if (normalizedCode !== existingBlock.code) {
        const codeConflict = await prisma.block.findUnique({
          where: { code: normalizedCode },
        });
        if (codeConflict) {
          res.status(409).json({
            success: false,
            message: `A block with code '${normalizedCode}' already exists (${codeConflict.name}).`,
          });
          return;
        }
        updateData.code = normalizedCode;
      }
    }

    if (status !== undefined) {
      const normalizedStatus = status.toString().trim().toUpperCase();
      if (!['ACTIVE', 'INACTIVE'].includes(normalizedStatus)) {
        res.status(400).json({
          success: false,
          message: "Status must be either 'ACTIVE' or 'INACTIVE'.",
        });
        return;
      }
      updateData.status = normalizedStatus;
    }

    if (description !== undefined) {
      updateData.description = typeof description === 'string' ? description.trim() : null;
    }

    const isStatusChanged = updateData.status && updateData.status !== existingBlock.status;
    const auditDesc = isStatusChanged
      ? `Changed status of block '${updateData.name || existingBlock.name}' from ${existingBlock.status} to ${updateData.status}`
      : `Updated block '${updateData.name || existingBlock.name}' (${updateData.code || existingBlock.code})`;

    const updatedBlock = await prisma.$transaction(async (tx) => {
      const updated = await tx.block.update({
        where: { id },
        data: updateData,
      });

      await auditService.recordLog(
        {
          actorId: req.managementUser!.id,
          actorRole: req.managementUser!.role,
          action: isStatusChanged ? 'BLOCK_STATUS_CHANGED' : 'BLOCK_UPDATED',
          actionType: 'BLOCK_MANAGEMENT',
          entity: 'Block',
          entityId: updated.id,
          previousState: {
            name: existingBlock.name,
            code: existingBlock.code,
            status: existingBlock.status,
          },
          newState: updateData,
          description: auditDesc,
        },
        tx as any,
        false
      );

      return updated;
    });

    // Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: isStatusChanged ? 'BLOCK_STATUS_CHANGED' : 'BLOCK_UPDATED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: updatedBlock.id,
        code: updatedBlock.code,
        status: updatedBlock.status,
      },
    });

    const stats = await getBlockStatistics(updatedBlock);

    res.status(200).json({
      success: true,
      message: `Block '${updatedBlock.name}' updated successfully.`,
      block: {
        ...updatedBlock,
        ...stats,
      },
    });
  } catch (error) {
    console.error('Error updating block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update block.',
    });
  }
});

/**
 * DELETE /api/management/blocks/:id
 * Safe deletion: enforces dependency checks against student allocations and configured rooms
 */
router.delete('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const existingBlock = await prisma.block.findUnique({
      where: { id },
    });

    if (!existingBlock) {
      res.status(404).json({
        success: false,
        message: 'Hostel block not found.',
      });
      return;
    }

    // Dependency check 1: Ensure no student records are allocated to this block
    const dependentStudentCount = await prisma.student.count({
      where: {
        OR: [
          { blockName: existingBlock.name },
          { blockName: existingBlock.code },
        ],
      },
    });

    // Dependency check 2: Ensure no rooms are configured for this block
    const dependentRoomCount = await prisma.room.count({
      where: { blockId: existingBlock.id },
    });

    if (dependentStudentCount > 0 || dependentRoomCount > 0) {
      const reasons: string[] = [];
      if (dependentStudentCount > 0) {
        reasons.push(`${dependentStudentCount} student record(s)`);
      }
      if (dependentRoomCount > 0) {
        reasons.push(`${dependentRoomCount} configured room(s)`);
      }

      // Record attempted deletion audit
      await auditService.recordLog({
        actorId: req.managementUser!.id,
        actorRole: req.managementUser!.role,
        action: 'BLOCK_DELETION_ATTEMPTED',
        actionType: 'BLOCK_MANAGEMENT',
        entity: 'Block',
        entityId: existingBlock.id,
        description: `Blocked deletion of '${existingBlock.name}' (${existingBlock.code}): ${reasons.join(' and ')} linked`,
      }).catch(() => {});

      res.status(409).json({
        success: false,
        message: `Cannot delete block '${existingBlock.name}' (${existingBlock.code}) because ${reasons.join(' and ')} are assigned to it. Reassign or remove dependent records before deleting.`,
        dependentCount: dependentStudentCount + dependentRoomCount,
        dependentStudentCount,
        dependentRoomCount,
      });
      return;
    }

    // Safe deletion in transaction with audit log
    await prisma.$transaction(async (tx) => {
      await tx.block.delete({
        where: { id },
      });

      await auditService.recordLog(
        {
          actorId: req.managementUser!.id,
          actorRole: req.managementUser!.role,
          action: 'BLOCK_DELETED',
          actionType: 'BLOCK_MANAGEMENT',
          entity: 'Block',
          entityId: existingBlock.id,
          previousState: {
            name: existingBlock.name,
            code: existingBlock.code,
            status: existingBlock.status,
          },
          description: `Deleted block '${existingBlock.name}' (${existingBlock.code})`,
        },
        tx as any,
        false
      );
    });

    // Real-time SSE dispatch
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'BLOCK_DELETED',
      timestamp: new Date().toISOString(),
      details: {
        blockId: existingBlock.id,
        code: existingBlock.code,
        name: existingBlock.name,
      },
    });

    res.status(200).json({
      success: true,
      message: `Block '${existingBlock.name}' (${existingBlock.code}) deleted successfully.`,
      deletedId: id,
    });
  } catch (error) {
    console.error('Error deleting block:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete block.',
    });
  }
});

export default router;
