import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { auditService } from '../services/audit.service';

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

// =========================================================================
//                       STEP 4: MESS MANAGEMENT ENHANCEMENTS
// =========================================================================

/**
 * Robust time string parser supporting both 12-hour ("07:30 AM") and 24-hour ("14:30") formats
 */
export function parseTimeString(timeStr: string): { hour: number; minute: number; formatted: string } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const clean = timeStr.trim();

  // 12-hour format: "07:30 AM", "7:30 pm", etc.
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const formatted = `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
    return { hour, minute, formatted };
  }

  // 24-hour format: "07:30", "14:30", etc.
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const formatted = `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
    return { hour, minute, formatted };
  }

  return null;
}

/**
 * Decodes academic program, department, year, and semester from student JNTU number
 */
export function decodeAcademicInfo(jntuNo: string) {
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
 * Asynchronously loads authoritative meal configurations from PostgreSQL with fallback to static configs
 */
export async function getAuthoritativeMealConfigs(): Promise<MealTimingConfig[]> {
  try {
    const dbMeals = await prisma.mealConfig.findMany({
      where: { isActive: true },
      orderBy: [{ startHour: 'asc' }, { startMinute: 'asc' }],
    });

    if (dbMeals && dbMeals.length > 0) {
      return dbMeals.map((m) => ({
        type: m.mealType as MealType,
        name: m.name,
        timing: `${m.startTime} - ${m.endTime}`,
        startHour: m.startHour,
        startMinute: m.startMinute,
        endHour: m.endHour,
        endMinute: m.endMinute,
        description: m.description || '',
        cutoffHour: m.cutoffHour,
        cutoffMinute: m.cutoffMinute,
      }));
    }
  } catch (err) {
    console.error('Failed to load meal configs from DB, using fallback:', err);
  }
  return MEAL_CONFIGS;
}

// -------------------------------------------------------------------------
// 1. MEAL CONFIGURATION CRUD
// -------------------------------------------------------------------------

/**
 * GET /api/management/mess/meals
 * Returns all configured meals from PostgreSQL MealConfig table
 */
router.get('/meals', async (_req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const meals = await prisma.mealConfig.findMany({
      orderBy: [{ startHour: 'asc' }, { startMinute: 'asc' }],
    });

    res.json({
      success: true,
      meals,
    });
  } catch (error: any) {
    console.error('Error fetching meals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve meal configurations.',
    });
  }
});

/**
 * POST /api/management/mess/meals
 * Adds a new meal configuration (Admin authorized only)
 */
router.post(
  '/meals',
  requireRoles('ADMIN', 'HOSTEL_ADMIN'),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { name, startTime, endTime, isActive = true, description } = req.body;

      if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ success: false, message: 'Meal name is required.' });
        return;
      }

      if (!startTime || typeof startTime !== 'string' || !startTime.trim()) {
        res.status(400).json({ success: false, message: 'Start time is required.' });
        return;
      }

      if (!endTime || typeof endTime !== 'string' || !endTime.trim()) {
        res.status(400).json({ success: false, message: 'End time is required.' });
        return;
      }

      const parsedStart = parseTimeString(startTime);
      if (!parsedStart) {
        res.status(400).json({
          success: false,
          message: 'Invalid start time format. Use HH:MM AM/PM (e.g. 07:30 AM) or HH:MM (e.g. 07:30).',
        });
        return;
      }

      const parsedEnd = parseTimeString(endTime);
      if (!parsedEnd) {
        res.status(400).json({
          success: false,
          message: 'Invalid end time format. Use HH:MM AM/PM (e.g. 09:30 AM) or HH:MM (e.g. 09:30).',
        });
        return;
      }

      const startMinutes = parsedStart.hour * 60 + parsedStart.minute;
      const endMinutes = parsedEnd.hour * 60 + parsedEnd.minute;
      if (endMinutes <= startMinutes) {
        res.status(400).json({
          success: false,
          message: 'End time must be strictly after start time.',
        });
        return;
      }

      const cleanName = name.trim();
      const mealType = req.body.mealType && typeof req.body.mealType === 'string' && req.body.mealType.trim()
        ? req.body.mealType.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_')
        : cleanName.toUpperCase().replace(/[^A-Z0-9]/g, '_');

      // Check duplicate
      const existing = await prisma.mealConfig.findFirst({
        where: {
          OR: [
            { name: { equals: cleanName, mode: 'insensitive' } },
            { mealType },
          ],
        },
      });

      if (existing) {
        res.status(409).json({
          success: false,
          message: `A meal with name "${cleanName}" already exists.`,
        });
        return;
      }

      // Cutoff time defaults to start time
      const cutoffHour = parsedStart.hour;
      const cutoffMinute = parsedStart.minute;

      const [newMeal] = await prisma.$transaction([
        prisma.mealConfig.create({
          data: {
            mealType,
            name: cleanName,
            startTime: parsedStart.formatted,
            endTime: parsedEnd.formatted,
            isActive: Boolean(isActive),
            description: typeof description === 'string' ? description.trim() : null,
            startHour: parsedStart.hour,
            startMinute: parsedStart.minute,
            endHour: parsedEnd.hour,
            endMinute: parsedEnd.minute,
            cutoffHour,
            cutoffMinute,
          },
        }),
        prisma.activityLog.create({
          data: {
            studentId: req.managementUser!.id,
            actionType: 'MESS_MANAGEMENT',
            action: 'CREATE',
            actorRole: req.managementUser!.role,
            entity: 'MealConfig',
            description: `Configured new meal "${cleanName}" (${parsedStart.formatted} - ${parsedEnd.formatted})`,
          },
        }),
      ]);

      // Post-commit SSE dispatch
      complaintEventsService.emitMessEventToStudent(undefined, {
        type: 'MEAL_CREATED',
        details: { meal: newMeal },
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        success: true,
        message: `Meal "${newMeal.name}" created successfully.`,
        meal: newMeal,
      });
    } catch (error: any) {
      console.error('Error creating meal config:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create meal configuration.',
      });
    }
  }
);

/**
 * PUT /api/management/mess/meals/:id
 * Updates an existing meal configuration (Admin authorized only)
 */
router.put(
  '/meals/:id',
  requireRoles('ADMIN', 'HOSTEL_ADMIN'),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { name, startTime, endTime, isActive, description } = req.body;

      const existingMeal = await prisma.mealConfig.findUnique({
        where: { id },
      });

      if (!existingMeal) {
        res.status(404).json({ success: false, message: 'Meal configuration not found.' });
        return;
      }

      const updateData: any = {};

      if (typeof name === 'string' && name.trim()) {
        const cleanName = name.trim();
        if (cleanName.toLowerCase() !== existingMeal.name.toLowerCase()) {
          const duplicate = await prisma.mealConfig.findFirst({
            where: {
              name: { equals: cleanName, mode: 'insensitive' },
              id: { not: id },
            },
          });
          if (duplicate) {
            res.status(409).json({ success: false, message: `Another meal named "${cleanName}" already exists.` });
            return;
          }
        }
        updateData.name = cleanName;
      }

      let parsedStart = existingMeal.startHour !== null
        ? { hour: existingMeal.startHour, minute: existingMeal.startMinute, formatted: existingMeal.startTime }
        : null;

      if (typeof startTime === 'string' && startTime.trim()) {
        parsedStart = parseTimeString(startTime);
        if (!parsedStart) {
          res.status(400).json({ success: false, message: 'Invalid start time format.' });
          return;
        }
        updateData.startTime = parsedStart.formatted;
        updateData.startHour = parsedStart.hour;
        updateData.startMinute = parsedStart.minute;
        updateData.cutoffHour = parsedStart.hour;
        updateData.cutoffMinute = parsedStart.minute;
      }

      let parsedEnd = existingMeal.endHour !== null
        ? { hour: existingMeal.endHour, minute: existingMeal.endMinute, formatted: existingMeal.endTime }
        : null;

      if (typeof endTime === 'string' && endTime.trim()) {
        parsedEnd = parseTimeString(endTime);
        if (!parsedEnd) {
          res.status(400).json({ success: false, message: 'Invalid end time format.' });
          return;
        }
        updateData.endTime = parsedEnd.formatted;
        updateData.endHour = parsedEnd.hour;
        updateData.endMinute = parsedEnd.minute;
      }

      if (parsedStart && parsedEnd) {
        const startMin = parsedStart.hour * 60 + parsedStart.minute;
        const endMin = parsedEnd.hour * 60 + parsedEnd.minute;
        if (endMin <= startMin) {
          res.status(400).json({ success: false, message: 'End time must be strictly after start time.' });
          return;
        }
      }

      if (typeof isActive === 'boolean') {
        updateData.isActive = isActive;
      }

      if (typeof description === 'string') {
        updateData.description = description.trim();
      }

      const [updatedMeal] = await prisma.$transaction([
        prisma.mealConfig.update({
          where: { id },
          data: updateData,
        }),
        prisma.activityLog.create({
          data: {
            studentId: req.managementUser!.id,
            actionType: 'MESS_MANAGEMENT',
            action: 'UPDATE',
            actorRole: req.managementUser!.role,
            entity: 'MealConfig',
            entityId: id,
            description: `Updated meal configuration for "${existingMeal.name}"`,
          },
        }),
      ]);

      // Post-commit SSE dispatch
      complaintEventsService.emitMessEventToStudent(undefined, {
        type: 'MEAL_UPDATED',
        details: { meal: updatedMeal },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Meal "${updatedMeal.name}" updated successfully.`,
        meal: updatedMeal,
      });
    } catch (error: any) {
      console.error('Error updating meal:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update meal configuration.',
      });
    }
  }
);

/**
 * PATCH /api/management/mess/meals/:id/toggle
 * Toggles active/inactive state of a meal configuration
 */
router.patch(
  '/meals/:id/toggle',
  requireRoles('ADMIN', 'HOSTEL_ADMIN'),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const existingMeal = await prisma.mealConfig.findUnique({ where: { id } });
      if (!existingMeal) {
        res.status(404).json({ success: false, message: 'Meal configuration not found.' });
        return;
      }

      const newActive = !existingMeal.isActive;

      const [updatedMeal] = await prisma.$transaction([
        prisma.mealConfig.update({
          where: { id },
          data: { isActive: newActive },
        }),
        prisma.activityLog.create({
          data: {
            studentId: req.managementUser!.id,
            actionType: 'MESS_MANAGEMENT',
            action: 'UPDATE',
            actorRole: req.managementUser!.role,
            entity: 'MealConfig',
            entityId: id,
            description: `Toggled meal "${existingMeal.name}" status to ${newActive ? 'Active' : 'Inactive'}`,
          },
        }),
      ]);

      complaintEventsService.emitMessEventToStudent(undefined, {
        type: 'MEAL_UPDATED',
        details: { meal: updatedMeal },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Meal "${updatedMeal.name}" is now ${newActive ? 'Active' : 'Inactive'}.`,
        meal: updatedMeal,
      });
    } catch (error: any) {
      console.error('Error toggling meal active status:', error);
      res.status(500).json({ success: false, message: 'Failed to update meal status.' });
    }
  }
);

/**
 * DELETE /api/management/mess/meals/:id
 * Safely deletes a meal configuration if not referenced by historical mess tokens
 */
router.delete(
  '/meals/:id',
  requireRoles('ADMIN', 'HOSTEL_ADMIN'),
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      const existingMeal = await prisma.mealConfig.findUnique({ where: { id } });
      if (!existingMeal) {
        res.status(404).json({ success: false, message: 'Meal configuration not found.' });
        return;
      }

      // Check dependent MessToken records
      const dependentTokenCount = await prisma.messToken.count({
        where: { mealType: existingMeal.mealType },
      });

      if (dependentTokenCount > 0) {
        res.status(409).json({
          success: false,
          message: `Cannot delete meal "${existingMeal.name}" because it is referenced by ${dependentTokenCount} historical mess token(s). Please deactivate it instead to preserve auditable records.`,
        });
        return;
      }

      await prisma.$transaction([
        prisma.mealConfig.delete({ where: { id } }),
        prisma.activityLog.create({
          data: {
            studentId: req.managementUser!.id,
            actionType: 'MESS_MANAGEMENT',
            action: 'DELETE',
            actorRole: req.managementUser!.role,
            entity: 'MealConfig',
            entityId: id,
            description: `Deleted meal configuration "${existingMeal.name}"`,
          },
        }),
      ]);

      complaintEventsService.emitMessEventToStudent(undefined, {
        type: 'MEAL_DELETED',
        details: { mealId: id, name: existingMeal.name },
        timestamp: new Date().toISOString(),
      });

      res.json({
        success: true,
        message: `Meal "${existingMeal.name}" was deleted successfully.`,
      });
    } catch (error: any) {
      console.error('Error deleting meal:', error);
      res.status(500).json({ success: false, message: 'Failed to delete meal configuration.' });
    }
  }
);

// -------------------------------------------------------------------------
// 2. ANALYTICS TAB
// -------------------------------------------------------------------------

/**
 * GET /api/management/mess/analytics
 * Computes authoritative meal scan analytics: 4 meal cards (total scans, Allowed, Denied),
 * bar chart dataset (Allowed vs Denied per meal), and overall distribution metrics.
 */
router.get('/analytics', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    // 1. Fetch active meal configs
    const configs = await getAuthoritativeMealConfigs();

    // 2. Fetch all non-draft tokens for target date
    const tokens = await prisma.messToken.findMany({
      where: {
        date: targetDate,
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        mealType: true,
        status: true,
      },
    });

    // 3. Compute per-meal summary cards
    const cards = configs.map((cfg) => {
      const mealTokens = tokens.filter((t) => t.mealType === cfg.type);
      const allowed = mealTokens.filter((t) => t.status === 'CONSUMED').length;
      const denied = mealTokens.filter((t) => t.status === 'CANCELLED').length;
      const totalScans = allowed + denied;

      return {
        mealType: cfg.type,
        name: cfg.name,
        timing: cfg.timing,
        totalScans,
        allowed,
        denied,
      };
    });

    // 4. Chart dataset
    const chart = {
      labels: cards.map((c) => c.name),
      allowed: cards.map((c) => c.allowed),
      denied: cards.map((c) => c.denied),
    };

    // 5. Overall distribution
    const totalScans = cards.reduce((acc, c) => acc + c.totalScans, 0);
    const totalAllowed = cards.reduce((acc, c) => acc + c.allowed, 0);
    const totalDenied = cards.reduce((acc, c) => acc + c.denied, 0);
    const allowedPercentage = totalScans > 0 ? Math.round((totalAllowed / totalScans) * 100) : 100;

    res.json({
      success: true,
      date: targetDate,
      cards,
      chart,
      distribution: {
        totalScans,
        totalAllowed,
        totalDenied,
        allowedPercentage,
      },
    });
  } catch (error: any) {
    console.error('Error fetching mess analytics:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve mess analytics.' });
  }
});

// -------------------------------------------------------------------------
// 3. INDENT PLAN TAB
// -------------------------------------------------------------------------

/**
 * GET /api/management/mess/indent-plan
 * Computes kitchen indent requirements (Expected Total, Veg, Non-Veg) and student records
 */
router.get('/indent-plan', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date, block, year, department, search } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();

    // 1. Fetch attending tokens for target date
    const allAttendingTokens = await prisma.messToken.findMany({
      where: {
        date: targetDate,
        status: { notIn: ['DRAFT', 'SKIPPED'] },
        attendanceIntent: { not: 'SKIPPED' },
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            email: true,
            blockName: true,
            roomNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Summary cards per meal
    const summary = configs.map((cfg) => {
      const mealTokens = allAttendingTokens.filter((t) => t.mealType === cfg.type);
      const expectedTotal = mealTokens.length;
      // In residential hostel, all meals default to Vegetarian unless designated
      const vegCount = expectedTotal;
      const nonVegCount = 0;

      return {
        mealType: cfg.type,
        name: cfg.name,
        expectedTotal,
        vegCount,
        nonVegCount,
      };
    });

    // 3. Filter student records based on search and dropdown filters
    const searchClean = typeof search === 'string' ? search.trim().toLowerCase() : '';
    const blockClean = typeof block === 'string' && block.trim().toUpperCase() !== 'ALL' ? block.trim().toLowerCase() : null;
    const yearClean = typeof year === 'string' && year.trim().toUpperCase() !== 'ALL' ? year.trim().toLowerCase() : null;
    const deptClean = typeof department === 'string' && department.trim().toUpperCase() !== 'ALL' ? department.trim().toLowerCase() : null;

    const filteredTokens = allAttendingTokens.filter((t) => {
      const student = t.student;
      if (!student) return false;

      const academic = decodeAcademicInfo(student.jntuNo);

      if (searchClean) {
        const matchesName = student.name.toLowerCase().includes(searchClean);
        const matchesJntu = student.jntuNo.toLowerCase().includes(searchClean);
        if (!matchesName && !matchesJntu) return false;
      }

      if (blockClean && !(student.blockName || '').toLowerCase().includes(blockClean)) {
        return false;
      }

      if (yearClean && !academic.year.toLowerCase().includes(yearClean)) {
        return false;
      }

      if (deptClean && !academic.department.toLowerCase().includes(deptClean)) {
        return false;
      }

      return true;
    });

    const students = filteredTokens.map((t) => {
      const academic = decodeAcademicInfo(t.student.jntuNo);
      const cfg = configs.find((c) => c.type === t.mealType);

      return {
        id: t.id,
        studentId: t.student.jntuNo,
        studentName: t.student.name,
        avatar: t.student.name
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        block: t.student.blockName || 'Unassigned',
        room: t.student.roomNumber || 'N/A',
        year: academic.year,
        department: academic.department,
        meal: cfg?.name || t.mealType,
        dietaryPreference: 'Veg',
        status: t.status === 'CONSUMED' || t.consumedAt ? 'CAME' : 'NOT CAME',
      };
    });

    res.json({
      success: true,
      date: targetDate,
      summary,
      students,
      totalStudents: students.length,
    });
  } catch (error: any) {
    console.error('Error fetching indent plan:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve indent plan.' });
  }
});

// -------------------------------------------------------------------------
// 4. ATTENDANCE TAB
// -------------------------------------------------------------------------

/**
 * GET /api/management/mess/attendance
 * Computes attendance summary cards (Total, Allowed, Absent) and individual attendance logs
 */
router.get('/attendance', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      date,
      mealType,
      status,
      block,
      gender,
      search,
      page = '1',
      limit = '10',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 10));
    const skip = (pageNum - 1) * take;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();

    // 1. Fetch all non-draft tokens for summary cards on targetDate
    const allTokensForDate = await prisma.messToken.findMany({
      where: {
        date: targetDate,
        status: { not: 'DRAFT' },
      },
      select: {
        id: true,
        mealType: true,
        status: true,
      },
    });

    const summary = configs.map((cfg) => {
      const mealTokens = allTokensForDate.filter((t) => t.mealType === cfg.type);
      const total = mealTokens.length;
      const allowed = mealTokens.filter((t) => t.status === 'CONSUMED').length;
      const absent = mealTokens.filter((t) => t.status === 'BOOKED').length;

      return {
        mealType: cfg.type,
        name: cfg.name,
        total,
        allowed,
        absent,
      };
    });

    // 2. Build where clause for logs list
    const whereClause: any = {
      date: targetDate,
      status: { not: 'DRAFT' },
    };

    if (typeof mealType === 'string' && mealType.trim().toUpperCase() !== 'ALL') {
      whereClause.mealType = mealType.trim().toUpperCase();
    }

    if (typeof status === 'string' && status.trim().toUpperCase() !== 'ALL') {
      const normStatus = status.trim().toUpperCase();
      if (normStatus === 'ALLOWED') whereClause.status = 'CONSUMED';
      else if (normStatus === 'ABSENT') whereClause.status = 'BOOKED';
      else if (normStatus === 'DENIED') whereClause.status = 'CANCELLED';
    }

    const studentConditions: any = {};
    if (typeof block === 'string' && block.trim().toUpperCase() !== 'ALL') {
      studentConditions.blockName = { contains: block.trim(), mode: 'insensitive' };
    }

    if (typeof gender === 'string' && gender.trim().toUpperCase() !== 'ALL') {
      const g = gender.trim().toUpperCase();
      if (g === 'MALE') studentConditions.blockName = { contains: 'Boys', mode: 'insensitive' };
      else if (g === 'FEMALE') studentConditions.blockName = { contains: 'Girls', mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.trim()) {
      const s = search.trim();
      whereClause.OR = [
        { student: { name: { contains: s, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: s, mode: 'insensitive' } } },
        { student: { email: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (Object.keys(studentConditions).length > 0) {
      whereClause.student = { ...(whereClause.student || {}), ...studentConditions };
    }

    const [totalRecords, tokenLogs] = await prisma.$transaction([
      prisma.messToken.count({ where: whereClause }),
      prisma.messToken.findMany({
        where: whereClause,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              email: true,
              blockName: true,
            },
          },
        },
        orderBy: [{ consumedAt: 'desc' }, { createdAt: 'desc' }],
        skip,
        take,
      }),
    ]);

    const data = tokenLogs.map((t) => {
      const cfg = configs.find((c) => c.type === t.mealType);
      const isConsumed = t.status === 'CONSUMED';
      const isCancelled = t.status === 'CANCELLED';
      const logStatus: 'Allowed' | 'Denied' | 'Absent' = isConsumed
        ? 'Allowed'
        : isCancelled
        ? 'Denied'
        : 'Absent';

      const timeSource = t.consumedAt || t.createdAt;
      const hours = timeSource.getHours();
      const minutes = timeSource.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const timeFormatted = `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;

      const blockName = t.student?.blockName || 'Unassigned';
      const genderDerived = blockName.toLowerCase().includes('girls') ? 'FEMALE' : 'MALE';

      return {
        id: t.id,
        studentName: t.student?.name || 'Unknown',
        studentId: t.student?.jntuNo || 'N/A',
        avatar: (t.student?.name || 'U')
          .split(' ')
          .filter(Boolean)
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase(),
        meal: cfg?.name || t.mealType,
        mealType: t.mealType,
        status: logStatus,
        badge: 'BIOMETRIC',
        date: t.date,
        time: timeFormatted,
        block: blockName,
        gender: genderDerived,
      };
    });

    res.json({
      success: true,
      date: targetDate,
      summary,
      total: totalRecords,
      page: pageNum,
      limit: take,
      totalPages: Math.ceil(totalRecords / take) || 1,
      data,
    });
  } catch (error: any) {
    console.error('Error fetching mess attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance records.' });
  }
});

/**
 * GET /api/management/mess/attendance/export/csv
 * Authoritative CSV export of filtered mess attendance logs
 */
router.get('/attendance/export/csv', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date, mealType, status, block, gender, search } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();

    const whereClause: any = {
      date: targetDate,
      status: { not: 'DRAFT' },
    };

    if (typeof mealType === 'string' && mealType.trim().toUpperCase() !== 'ALL') {
      whereClause.mealType = mealType.trim().toUpperCase();
    }

    if (typeof status === 'string' && status.trim().toUpperCase() !== 'ALL') {
      const normStatus = status.trim().toUpperCase();
      if (normStatus === 'ALLOWED') whereClause.status = 'CONSUMED';
      else if (normStatus === 'ABSENT') whereClause.status = 'BOOKED';
      else if (normStatus === 'DENIED') whereClause.status = 'CANCELLED';
    }

    const studentConditions: any = {};
    if (typeof block === 'string' && block.trim().toUpperCase() !== 'ALL') {
      studentConditions.blockName = { contains: block.trim(), mode: 'insensitive' };
    }

    if (typeof gender === 'string' && gender.trim().toUpperCase() !== 'ALL') {
      const g = gender.trim().toUpperCase();
      if (g === 'MALE') studentConditions.blockName = { contains: 'Boys', mode: 'insensitive' };
      else if (g === 'FEMALE') studentConditions.blockName = { contains: 'Girls', mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.trim()) {
      const s = search.trim();
      whereClause.OR = [
        { student: { name: { contains: s, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: s, mode: 'insensitive' } } },
        { student: { email: { contains: s, mode: 'insensitive' } } },
      ];
    }

    if (Object.keys(studentConditions).length > 0) {
      whereClause.student = { ...(whereClause.student || {}), ...studentConditions };
    }

    const records = await prisma.messToken.findMany({
      where: whereClause,
      include: {
        student: {
          select: {
            name: true,
            jntuNo: true,
            blockName: true,
          },
        },
      },
      orderBy: [{ consumedAt: 'desc' }, { createdAt: 'desc' }],
      take: 2000,
    });

    const csvRows = [
      ['Student Name', 'Student ID', 'Meal', 'Status', 'Verification', 'Date', 'Time', 'Block', 'Gender'],
    ];

    for (const r of records) {
      const cfg = configs.find((c) => c.type === r.mealType);
      const isConsumed = r.status === 'CONSUMED';
      const isCancelled = r.status === 'CANCELLED';
      const logStatus = isConsumed ? 'Allowed' : isCancelled ? 'Denied' : 'Absent';
      const timeSource = r.consumedAt || r.createdAt;
      const hours = timeSource.getHours();
      const minutes = timeSource.getMinutes();
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const timeFormatted = `${String(displayHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${period}`;
      const blockName = r.student?.blockName || 'Unassigned';
      const genderDerived = blockName.toLowerCase().includes('girls') ? 'FEMALE' : 'MALE';

      csvRows.push([
        `"${(r.student?.name || '').replace(/"/g, '""')}"`,
        `"${(r.student?.jntuNo || '').replace(/"/g, '""')}"`,
        `"${cfg?.name || r.mealType}"`,
        `"${logStatus}"`,
        '"BIOMETRIC"',
        `"${r.date}"`,
        `"${timeFormatted}"`,
        `"${blockName.replace(/"/g, '""')}"`,
        `"${genderDerived}"`,
      ]);
    }

    const csvString = csvRows.map((row) => row.join(',')).join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mess-attendance-${targetDate}.csv"`);
    res.status(200).send(csvString);
  } catch (error: any) {
    console.error('Error exporting mess attendance CSV:', error);
    res.status(500).json({ success: false, message: 'Failed to export attendance CSV.' });
  }
});

export default router;

