import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';

const router = Router();

// Enforce authoritative management authentication on all mess management endpoints
router.use(authenticateManagement);

export const VALID_MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'] as const;
export type MealType = (typeof VALID_MEALS)[number];

export const VALID_STATUSES = ['BOOKED', 'CONSUMED', 'CANCELLED', 'SKIPPED'] as const;
export type TokenStatus = (typeof VALID_STATUSES)[number];

export interface MealTimingConfig {
  type: MealType;
  name: string;
  timing: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  description: string;
  cutoffHour: number;
  cutoffMinute: number;
}

/**
 * Authoritative Booking Horizon in days configured by Mess Administration
 */
export const BOOKING_HORIZON_DAYS = 7;

/**
 * Authoritative Admin Mess Management Meal & Timing Configuration
 * Single source of truth for meal definitions, schedules, and indent deadlines
 */
export const MEAL_CONFIGS: MealTimingConfig[] = [
  {
    type: 'BREAKFAST',
    name: 'Breakfast',
    timing: '07:30 AM - 09:30 AM',
    startHour: 7,
    startMinute: 30,
    endHour: 9,
    endMinute: 30,
    description: 'Hot breakfast buffet with choice of beverages',
    cutoffHour: 7,
    cutoffMinute: 0,
  },
  {
    type: 'LUNCH',
    name: 'Lunch',
    timing: '12:30 PM - 02:30 PM',
    startHour: 12,
    startMinute: 30,
    endHour: 14,
    endMinute: 30,
    description: 'Complete nutritional multi-course lunch meal',
    cutoffHour: 10,
    cutoffMinute: 0,
  },
  {
    type: 'SNACKS',
    name: 'Evening Snacks',
    timing: '04:30 PM - 06:00 PM',
    startHour: 16,
    startMinute: 30,
    endHour: 18,
    endMinute: 0,
    description: 'Evening tea, coffee, and fresh evening snacks',
    cutoffHour: 15,
    cutoffMinute: 0,
  },
  {
    type: 'DINNER',
    name: 'Dinner',
    timing: '07:30 PM - 09:30 PM',
    startHour: 19,
    startMinute: 30,
    endHour: 21,
    endMinute: 30,
    description: 'Residential dinner with seasonal specials',
    cutoffHour: 17,
    cutoffMinute: 30,
  },
];

function getActiveMealSlot(now: Date = new Date()): {
  activeMeal: MealTimingConfig | null;
  nextMeal: MealTimingConfig | null;
} {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  let activeMeal: MealTimingConfig | null = null;
  let nextMeal: MealTimingConfig | null = null;

  for (const config of MEAL_CONFIGS) {
    const startTotal = config.startHour * 60 + config.startMinute;
    const endTotal = config.endHour * 60 + config.endMinute;

    if (currentMinutes >= startTotal && currentMinutes <= endTotal) {
      activeMeal = config;
      break;
    }
  }

  // Find next upcoming meal
  for (const config of MEAL_CONFIGS) {
    const startTotal = config.startHour * 60 + config.startMinute;
    if (currentMinutes < startTotal) {
      nextMeal = config;
      break;
    }
  }

  // If past dinner, next is breakfast tomorrow
  if (!nextMeal && !activeMeal) {
    nextMeal = MEAL_CONFIGS[0];
  }

  return { activeMeal, nextMeal };
}

/**
 * GET /api/management/mess/overview
 * Real-time mess status, meal KPIs, slot tracking, and block breakdowns
 */
router.get('/overview', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    let targetDate = todayStr;
    if (typeof date === 'string' && date.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD.',
        });
        return;
      }
      targetDate = date.trim();
    }

    // 1. Total residents for context
    const totalActiveResidents = await prisma.student.count({
      where: { isActive: true, allocationStatus: 'ALLOCATED' },
    });

    // 2. Fetch all tokens for target date in one bounded query (excluding unsubmitted drafts)
    const tokensForDate = await prisma.messToken.findMany({
      where: {
        date: targetDate,
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        mealType: true,
        status: true,
        student: {
          select: {
            blockName: true,
          },
        },
      },
    });

    // 3. Compute overall counts
    const totalBookings = tokensForDate.length;
    const bookedCount = tokensForDate.filter((t) => t.status === 'BOOKED').length;
    const consumedCount = tokensForDate.filter((t) => t.status === 'CONSUMED').length;
    const cancelledCount = tokensForDate.filter((t) => t.status === 'CANCELLED').length;

    // 4. Compute meal-wise breakdown
    const mealBreakdown = MEAL_CONFIGS.map((config) => {
      const mealTokens = tokensForDate.filter((t) => t.mealType === config.type);
      return {
        mealType: config.type,
        name: config.name,
        timing: config.timing,
        description: config.description,
        total: mealTokens.length,
        booked: mealTokens.filter((t) => t.status === 'BOOKED').length,
        consumed: mealTokens.filter((t) => t.status === 'CONSUMED').length,
        cancelled: mealTokens.filter((t) => t.status === 'CANCELLED').length,
      };
    });

    // 5. Block-wise breakdown
    const blockMap: Record<string, { total: number; booked: number; consumed: number; cancelled: number }> = {};
    for (const t of tokensForDate) {
      const block = t.student?.blockName || 'Unassigned';
      if (!blockMap[block]) {
        blockMap[block] = { total: 0, booked: 0, consumed: 0, cancelled: 0 };
      }
      blockMap[block].total += 1;
      if (t.status === 'BOOKED') blockMap[block].booked += 1;
      else if (t.status === 'CONSUMED') blockMap[block].consumed += 1;
      else if (t.status === 'CANCELLED') blockMap[block].cancelled += 1;
    }

    const blockDistribution = Object.keys(blockMap).map((blockName) => ({
      blockName,
      ...blockMap[blockName],
    })).sort((a, b) => b.total - a.total);

    // 6. Active slot calculation
    const isToday = targetDate === todayStr;
    const { activeMeal, nextMeal } = getActiveMealSlot(now);

    res.json({
      success: true,
      data: {
        date: targetDate,
        isToday,
        totalActiveResidents,
        summary: {
          totalBookings,
          bookedCount,
          consumedCount,
          cancelledCount,
          consumptionRate: totalBookings > 0 ? Math.round((consumedCount / totalBookings) * 100) : 0,
        },
        activeMealSlot: isToday && activeMeal
          ? {
              mealType: activeMeal.type,
              name: activeMeal.name,
              timing: activeMeal.timing,
              description: activeMeal.description,
            }
          : null,
        nextMealSlot: isToday && nextMeal
          ? {
              mealType: nextMeal.type,
              name: nextMeal.name,
              timing: nextMeal.timing,
              description: nextMeal.description,
            }
          : null,
        mealBreakdown,
        blockDistribution,
      },
    });
  } catch (error: any) {
    console.error('Error fetching mess overview:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mess overview statistics.',
    });
  }
});

/**
 * GET /api/management/mess/tokens
 * Paginated and filtered token records with student and room details
 */
router.get('/tokens', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      page = '1',
      limit = '10',
      date,
      mealType,
      status,
      block,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * take;

    const whereClause: any = {};

    // Date filter
    if (typeof date === 'string' && date.trim()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD.',
        });
        return;
      }
      whereClause.date = date.trim();
    }

    // Meal type filter
    if (typeof mealType === 'string' && mealType.trim()) {
      const normalizedMeal = mealType.trim().toUpperCase() as MealType;
      if (!VALID_MEALS.includes(normalizedMeal)) {
        res.status(400).json({
          success: false,
          message: `Invalid mealType. Valid options: ${VALID_MEALS.join(', ')}`,
        });
        return;
      }
      whereClause.mealType = normalizedMeal;
    }

    // Status filter
    if (typeof status === 'string' && status.trim()) {
      const normalizedStatus = status.trim().toUpperCase() as TokenStatus;
      if (!VALID_STATUSES.includes(normalizedStatus)) {
        res.status(400).json({
          success: false,
          message: `Invalid status. Valid options: ${VALID_STATUSES.join(', ')}`,
        });
        return;
      }
      whereClause.status = normalizedStatus;
    } else {
      whereClause.status = { not: 'DRAFT' };
    }

    // Block filter & Search (requires student relation conditions)
    const studentConditions: any = {};

    if (typeof block === 'string' && block.trim()) {
      studentConditions.blockName = { equals: block.trim(), mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      whereClause.OR = [
        { tokenNumber: { contains: term, mode: 'insensitive' } },
        { student: { name: { contains: term, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (Object.keys(studentConditions).length > 0) {
      whereClause.student = {
        ...(whereClause.student || {}),
        ...studentConditions,
      };
    }

    const [total, tokens] = await prisma.$transaction([
      prisma.messToken.count({ where: whereClause }),
      prisma.messToken.findMany({
        where: whereClause,
        skip,
        take,
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              email: true,
              blockName: true,
              roomNumber: true,
              bedNumber: true,
              allocationStatus: true,
            },
          },
        },
      }),
    ]);

    const formattedTokens = tokens.map((t) => {
      const mealCfg = MEAL_CONFIGS.find((m) => m.type === t.mealType);
      return {
        id: t.id,
        tokenNumber: t.tokenNumber,
        date: t.date,
        mealType: t.mealType,
        mealName: mealCfg?.name || t.mealType,
        mealTiming: mealCfg?.timing || '',
        status: t.status,
        consumedAt: t.consumedAt,
        cancelledAt: t.cancelledAt,
        cancellationReason: t.cancellationReason,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        student: t.student
          ? {
              id: t.student.id,
              name: t.student.name,
              jntuNo: t.student.jntuNo,
              email: t.student.email,
              blockName: t.student.blockName || 'Unassigned',
              roomNumber: t.student.roomNumber || 'N/A',
              bedNumber: t.student.bedNumber || 'N/A',
              allocationStatus: t.student.allocationStatus,
            }
          : null,
      };
    });

    res.json({
      success: true,
      tokens: formattedTokens,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
    });
  } catch (error: any) {
    console.error('Error fetching mess tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve mess token bookings.',
    });
  }
});

/**
 * GET /api/management/mess/tokens/:id
 * Retrieve comprehensive details of an individual token record
 */
router.get('/tokens/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid token ID is required.',
      });
      return;
    }

    const token = await prisma.messToken.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            email: true,
            blockName: true,
            floorName: true,
            roomNumber: true,
            bedNumber: true,
            roomType: true,
            allocationStatus: true,
            isActive: true,
          },
        },
      },
    });

    if (!token) {
      res.status(404).json({
        success: false,
        message: 'Mess token not found.',
      });
      return;
    }

    const mealCfg = MEAL_CONFIGS.find((m) => m.type === token.mealType);

    res.json({
      success: true,
      token: {
        id: token.id,
        tokenNumber: token.tokenNumber,
        date: token.date,
        mealType: token.mealType,
        mealName: mealCfg?.name || token.mealType,
        mealTiming: mealCfg?.timing || '',
        mealDescription: mealCfg?.description || '',
        status: token.status,
        consumedAt: token.consumedAt,
        cancelledAt: token.cancelledAt,
        cancellationReason: token.cancellationReason,
        createdAt: token.createdAt,
        updatedAt: token.updatedAt,
        student: token.student,
      },
    });
  } catch (error: any) {
    console.error('Error fetching token detail:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve token details.',
    });
  }
});

/**
 * GET /api/management/mess/students/:studentId/history
 * Retrieve full mess history and statistics for a specific student
 */
router.get('/students/:studentId/history', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid student ID is required.',
      });
      return;
    }

    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        name: true,
        jntuNo: true,
        email: true,
        blockName: true,
        roomNumber: true,
        bedNumber: true,
        allocationStatus: true,
      },
    });

    if (!student) {
      res.status(404).json({
        success: false,
        message: 'Student record not found.',
      });
      return;
    }

    const tokens = await prisma.messToken.findMany({
      where: { studentId },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 100, // Bounded set for resident profile
    });

    const summary = {
      totalBooked: tokens.length,
      activeBooked: tokens.filter((t) => t.status === 'BOOKED').length,
      consumedCount: tokens.filter((t) => t.status === 'CONSUMED').length,
      cancelledCount: tokens.filter((t) => t.status === 'CANCELLED').length,
    };

    const formattedHistory = tokens.map((t) => {
      const mealCfg = MEAL_CONFIGS.find((m) => m.type === t.mealType);
      return {
        id: t.id,
        tokenNumber: t.tokenNumber,
        date: t.date,
        mealType: t.mealType,
        mealName: mealCfg?.name || t.mealType,
        status: t.status,
        consumedAt: t.consumedAt,
        cancelledAt: t.cancelledAt,
        cancellationReason: t.cancellationReason,
        createdAt: t.createdAt,
      };
    });

    res.json({
      success: true,
      student,
      summary,
      tokens: formattedHistory,
    });
  } catch (error: any) {
    console.error('Error fetching student mess history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve student mess history.',
    });
  }
});

/**
 * POST /api/management/mess/tokens/:id/consume
 * Mark a booked token as CONSUMED with transaction and audit trail
 */
router.post('/tokens/:id/consume', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid token ID is required.',
      });
      return;
    }

    const token = await prisma.messToken.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
          },
        },
      },
    });

    if (!token) {
      res.status(404).json({
        success: false,
        message: 'Mess token not found.',
      });
      return;
    }

    if (token.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: 'Cannot mark a cancelled token as consumed.',
      });
      return;
    }

    if (token.status === 'CONSUMED') {
      res.status(400).json({
        success: false,
        message: 'Token has already been consumed.',
      });
      return;
    }

    const consumedTimestamp = new Date();

    const [updatedToken] = await prisma.$transaction([
      prisma.messToken.update({
        where: { id },
        data: {
          status: 'CONSUMED',
          consumedAt: consumedTimestamp,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'MESS_MANAGEMENT',
          description: `Marked ${token.mealType} token ${token.tokenNumber || token.id} as CONSUMED for resident ${token.student.name} (${token.student.jntuNo}) on ${token.date}`,
        },
      }),
    ]);

    // Real-time SSE dispatch
    complaintEventsService.emitMessEventToStudent(token.studentId, {
      type: 'MESS_TOKEN_CONSUMED',
      tokenId: updatedToken.id,
      studentId: token.studentId,
      date: updatedToken.date,
      mealType: updatedToken.mealType,
      status: updatedToken.status,
      timestamp: consumedTimestamp.toISOString(),
      details: {
        tokenNumber: updatedToken.tokenNumber,
        consumedByStaffId: req.managementUser!.id,
      },
    });

    res.json({
      success: true,
      message: `Token ${updatedToken.tokenNumber || updatedToken.id} verified and marked as consumed.`,
      token: updatedToken,
    });
  } catch (error: any) {
    console.error('Error consuming mess token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update token status to consumed.',
    });
  }
});

/**
 * POST /api/management/mess/tokens/:id/cancel
 * Administrative cancellation of a token with mandatory reason and notification
 */
router.post('/tokens/:id/cancel', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid token ID is required.',
      });
      return;
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 3) {
      res.status(400).json({
        success: false,
        message: 'A valid cancellation reason (minimum 3 characters) is required.',
      });
      return;
    }

    const token = await prisma.messToken.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
          },
        },
      },
    });

    if (!token) {
      res.status(404).json({
        success: false,
        message: 'Mess token not found.',
      });
      return;
    }

    if (token.status === 'CONSUMED') {
      res.status(400).json({
        success: false,
        message: 'Cannot cancel a token that has already been consumed.',
      });
      return;
    }

    if (token.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        message: 'Token has already been cancelled.',
      });
      return;
    }

    const cancelledTimestamp = new Date();
    const cleanReason = reason.trim();

    const [updatedToken] = await prisma.$transaction([
      prisma.messToken.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: cancelledTimestamp,
          cancellationReason: cleanReason,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: req.managementUser!.id,
          actionType: 'MESS_MANAGEMENT',
          description: `Administratively cancelled ${token.mealType} token ${token.tokenNumber || token.id} for resident ${token.student.name} (${token.student.jntuNo}) on ${token.date}. Reason: ${cleanReason}`,
        },
      }),
      prisma.notification.create({
        data: {
          studentId: token.studentId,
          title: 'Mess Token Cancelled',
          message: `Your ${token.mealType.toLowerCase()} mess token for ${token.date} was cancelled by mess administration. Reason: ${cleanReason}`,
          type: 'WARNING',
        },
      }),
    ]);

    // Real-time SSE dispatch
    complaintEventsService.emitMessEventToStudent(token.studentId, {
      type: 'MESS_TOKEN_CANCELLED',
      tokenId: updatedToken.id,
      studentId: token.studentId,
      date: updatedToken.date,
      mealType: updatedToken.mealType,
      status: updatedToken.status,
      timestamp: cancelledTimestamp.toISOString(),
      details: {
        tokenNumber: updatedToken.tokenNumber,
        cancellationReason: cleanReason,
        cancelledByStaffId: req.managementUser!.id,
      },
    });

    res.json({
      success: true,
      message: `Token ${updatedToken.tokenNumber || updatedToken.id} has been cancelled.`,
      token: updatedToken,
    });
  } catch (error: any) {
    console.error('Error cancelling mess token:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel mess token.',
    });
  }
});

export default router;
