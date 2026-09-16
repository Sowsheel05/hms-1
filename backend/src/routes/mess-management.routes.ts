import { Router, Response } from 'express';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  requireRoles,
} from '../middleware/management.middleware';
import { complaintEventsService } from '../services/events.service';
import { auditService } from '../services/audit.service';
import * as XLSX from 'xlsx';

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

// =========================================================================
//                       STEP 5: MESS INDENT, ATTENDANCE & FOUR-WAY REPORTING
// =========================================================================

/**
 * Helper to classify an eligible student into four-way category or pending
 */
export function classifyFourWay(
  indentMarked: boolean,
  attendanceStatus: 'PENDING' | 'ATE' | 'DID_NOT_EAT'
): {
  categoryKey: 'INDENTED_ATE' | 'NO_INDENT_ATE' | 'INDENTED_NOT_ATE' | 'NO_INDENT_NOT_ATE' | 'PENDING';
  categoryTitle: string;
  isFinalized: boolean;
} {
  if (attendanceStatus === 'PENDING') {
    return {
      categoryKey: 'PENDING',
      categoryTitle: 'Attendance Pending',
      isFinalized: false,
    };
  }
  if (indentMarked && attendanceStatus === 'ATE') {
    return {
      categoryKey: 'INDENTED_ATE',
      categoryTitle: 'Indented & Consumed',
      isFinalized: true,
    };
  }
  if (!indentMarked && attendanceStatus === 'ATE') {
    return {
      categoryKey: 'NO_INDENT_ATE',
      categoryTitle: 'Unindented & Consumed',
      isFinalized: true,
    };
  }
  if (indentMarked && attendanceStatus === 'DID_NOT_EAT') {
    return {
      categoryKey: 'INDENTED_NOT_ATE',
      categoryTitle: 'Indented & Not Consumed',
      isFinalized: true,
    };
  }
  return {
    categoryKey: 'NO_INDENT_NOT_ATE',
    categoryTitle: 'Unindented & Not Consumed',
    isFinalized: true,
  };
}

/**
 * Helper to check if a meal timing window has finished
 */
function isMealSlotEnded(dateStr: string, endHour?: number, endMinute?: number): boolean {
  if (endHour === undefined || endMinute === undefined) return false;
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  if (dateStr < todayStr) return true;
  if (dateStr > todayStr) return false;

  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (currentHour > endHour) return true;
  if (currentHour === endHour && currentMinute >= endMinute) return true;

  return false;
}

/**
 * GET /api/management/mess/attendance-marking (and /api/management/mess/attendance-sheet)
 * Displays ALL eligible students with independent Indent and Attendance statuses.
 * Supports filters: date, mealType, block, attendanceStatus, indentStatus, search, page, limit
 */
router.get(['/attendance-marking', '/attendance-sheet'], async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      date,
      mealType,
      block,
      attendanceStatus = 'ALL',
      indentStatus = 'ALL',
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    // Validate mealType or default to active/first meal
    const configs = await getAuthoritativeMealConfigs();
    let normalizedMeal: MealType = 'LUNCH';
    if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
      const candidate = mealType.trim().toUpperCase() as MealType;
      const valid = configs.find((c) => c.type === candidate);
      if (valid) normalizedMeal = candidate;
    } else {
      const activeSlot = getActiveMealSlot(new Date());
      if (activeSlot.activeMeal) normalizedMeal = activeSlot.activeMeal.type;
      else if (configs.length > 0) normalizedMeal = configs[0].type;
    }

    const currentMealConfig = configs.find((c) => c.type === normalizedMeal) || configs[0];

    // 1. Base query for ALL eligible active students
    const studentWhere: any = {
      role: 'STUDENT',
      isActive: true,
    };

    if (typeof block === 'string' && block.trim() && block.trim().toUpperCase() !== 'ALL') {
      studentWhere.blockName = { contains: block.trim(), mode: 'insensitive' };
    }

    if (typeof search === 'string' && search.trim()) {
      const term = search.trim();
      studentWhere.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { jntuNo: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Fetch all eligible students matching demographic filters
    const allEligibleStudents = await prisma.student.findMany({
      where: studentWhere,
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
      orderBy: [{ blockName: 'asc' }, { roomNumber: 'asc' }, { name: 'asc' }],
    });

    const eligibleStudentIds = allEligibleStudents.map((s) => s.id);

    // 2. Fetch all indents for this date & mealType
    const [indents, tokens, attendances] = await Promise.all([
      prisma.messIndent.findMany({
        where: {
          date: targetDate,
          mealType: normalizedMeal,
          studentId: { in: eligibleStudentIds },
        },
      }),
      prisma.messToken.findMany({
        where: {
          date: targetDate,
          mealType: normalizedMeal,
          studentId: { in: eligibleStudentIds },
        },
      }),
      prisma.messAttendance.findMany({
        where: {
          date: targetDate,
          mealType: normalizedMeal,
          studentId: { in: eligibleStudentIds },
        },
      }),
    ]);

    // 3. Build unified mapped record for every eligible student
    const processedStudents = allEligibleStudents.map((student) => {
      const indentRecord = indents.find((i) => i.studentId === student.id);
      const tokenRecord = tokens.find((t) => t.studentId === student.id);
      const attRecord = attendances.find((a) => a.studentId === student.id);

      // Indent check: true if marked and not skipped
      const isIndentSkipped = Boolean(
        (indentRecord && indentRecord.status === 'SKIPPED') ||
        (tokenRecord && (tokenRecord.status === 'SKIPPED' || tokenRecord.attendanceIntent === 'SKIPPED'))
      );

      const isIndentMarked = Boolean(
        (indentRecord && indentRecord.status === 'MARKED') ||
        (!indentRecord &&
          tokenRecord &&
          (tokenRecord.attendanceIntent === 'ATTENDING' ||
            tokenRecord.status === 'BOOKED' ||
            tokenRecord.status === 'CONSUMED'))
      );

      const computedIndentStatus: 'MARKED' | 'SKIPPED' | 'NOT_MARKED' = isIndentMarked
        ? 'MARKED'
        : isIndentSkipped
          ? 'SKIPPED'
          : 'NOT_MARKED';

      const indentTime = indentRecord
        ? indentRecord.createdAt.toISOString()
        : tokenRecord
          ? tokenRecord.createdAt.toISOString()
          : null;

      // Attendance check: PENDING, ATE, DID_NOT_EAT (Auto-resolve to DID_NOT_EAT if meal slot ended)
      const isSlotEnded = isMealSlotEnded(targetDate, currentMealConfig.endHour, currentMealConfig.endMinute);
      const currentAttendanceStatus: 'PENDING' | 'ATE' | 'DID_NOT_EAT' = attRecord
        ? (attRecord.status as 'ATE' | 'DID_NOT_EAT')
        : isSlotEnded
          ? 'DID_NOT_EAT'
          : 'PENDING';

      const attendanceTime = attRecord ? attRecord.markedAt.toISOString() : null;
      const markedBy = attRecord?.markedBy || null;
      const attendanceId = attRecord?.id || null;

      const classification = classifyFourWay(isIndentMarked, currentAttendanceStatus);
      const academic = decodeAcademicInfo(student.jntuNo);

      return {
        id: student.id,
        studentId: student.jntuNo,
        rollNo: student.jntuNo,
        studentName: student.name,
        name: student.name,
        email: student.email,
        block: student.blockName || 'Unassigned',
        blockName: student.blockName || 'Unassigned',
        room: student.roomNumber || 'N/A',
        roomNumber: student.roomNumber || 'N/A',
        bedNumber: student.bedNumber || 'N/A',
        branch: academic.department,
        year: academic.year,
        section: academic.semester,
        indentMarked: isIndentMarked,
        indentStatus: computedIndentStatus,
        indentTime,
        attendanceStatus: currentAttendanceStatus,
        attendanceTime,
        markedBy,
        attendanceId,
        categoryKey: classification.categoryKey,
        categoryTitle: classification.categoryTitle,
        isFinalized: classification.isFinalized,
      };
    });

    // 4. Calculate authoritative summary across ALL eligible students in scope
    const totalStudents = processedStudents.length;
    const indentMarkedCount = processedStudents.filter((s) => s.indentStatus === 'MARKED').length;
    const indentSkippedCount = processedStudents.filter((s) => s.indentStatus === 'SKIPPED').length;
    const noIndentCount = processedStudents.filter((s) => s.indentStatus === 'NOT_MARKED').length;

    const ateCount = processedStudents.filter((s) => s.attendanceStatus === 'ATE').length;
    const didNotEatCount = processedStudents.filter((s) => s.attendanceStatus === 'DID_NOT_EAT').length;
    const pendingCount = processedStudents.filter((s) => s.attendanceStatus === 'PENDING').length;

    const indentedAndAte = processedStudents.filter((s) => s.categoryKey === 'INDENTED_ATE').length;
    const unindentedAndAte = processedStudents.filter((s) => s.categoryKey === 'NO_INDENT_ATE').length;
    const indentedAndNotConsumed = processedStudents.filter((s) => s.categoryKey === 'INDENTED_NOT_ATE').length;
    const unindentedAndNotConsumed = processedStudents.filter((s) => s.categoryKey === 'NO_INDENT_NOT_ATE').length;
    const attendancePending = processedStudents.filter((s) => s.categoryKey === 'PENDING').length;

    // 5. Apply table-specific status filtering
    let filteredList = processedStudents;

    const attStatusFilter = (attendanceStatus as string).trim().toUpperCase();
    if (attStatusFilter !== 'ALL') {
      filteredList = filteredList.filter((s) => s.attendanceStatus === attStatusFilter);
    }

    const indStatusFilter = (indentStatus as string).trim().toUpperCase();
    if (indStatusFilter !== 'ALL') {
      filteredList = filteredList.filter((s) => s.indentStatus === indStatusFilter);
    }

    const filteredTotal = filteredList.length;
    const paginatedStudents = filteredList.slice(skip, skip + take);

    res.json({
      success: true,
      date: targetDate,
      mealType: normalizedMeal,
      mealName: currentMealConfig.name,
      mealTiming: currentMealConfig.timing,
      summary: {
        totalStudents,
        indentMarkedCount,
        indentSkippedCount,
        noIndentCount,
        ateCount,
        didNotEatCount,
        pendingCount,
        indentedAndAte,
        unindentedAndAte,
        indentedAndNotConsumed,
        unindentedAndNotConsumed,
        attendancePending,
        isFinalized: attendancePending === 0,
      },
      pagination: {
        total: filteredTotal,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(filteredTotal / take) || 1,
      },
      students: paginatedStudents,
    });
  } catch (error: any) {
    console.error('Error fetching mess attendance marking list:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve attendance marking list.' });
  }
});

/**
 * POST /api/management/mess/attendance
 * Marks individual student attendance (ATE or DID_NOT_EAT) by operator
 * Supports individual student-by-student marking and immediate upsert.
 */
router.post('/attendance', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { studentId, date, mealType, status } = req.body;

    if (!studentId || typeof studentId !== 'string') {
      res.status(400).json({ success: false, message: 'Valid studentId is required.' });
      return;
    }

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({ success: false, message: 'Valid mealType is required.' });
      return;
    }

    const normalizedMeal = mealType.trim().toUpperCase() as MealType;
    const configs = await getAuthoritativeMealConfigs();
    const mealCfg = configs.find((c) => c.type === normalizedMeal);
    if (!mealCfg) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    if (!status || !['ATE', 'DID_NOT_EAT'].includes(status.trim().toUpperCase())) {
      res.status(400).json({
        success: false,
        message: "Attendance status must be either 'ATE' or 'DID_NOT_EAT'.",
      });
      return;
    }

    const attendanceStatus = status.trim().toUpperCase() as 'ATE' | 'DID_NOT_EAT';
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    // Verify student exists and is active
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { id: true, name: true, jntuNo: true, isActive: true, blockName: true, roomNumber: true },
    });

    if (!student || !student.isActive) {
      res.status(404).json({ success: false, message: 'Active student record not found.' });
      return;
    }

    const staffDisplayName = req.managementUser?.name || req.managementUser?.role || 'Mess Operator';
    const staffId = req.managementUser?.id || null;
    const markedAt = new Date();

    // Transactional upsert of attendance and synchronization of token consumed state
    const [attendanceRecord] = await prisma.$transaction(async (tx) => {
      const record = await tx.messAttendance.upsert({
        where: {
          studentId_date_mealType: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
          },
        },
        update: {
          status: attendanceStatus,
          markedAt,
          markedBy: staffDisplayName,
          markedById: staffId,
        },
        create: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
          status: attendanceStatus,
          markedAt,
          markedBy: staffDisplayName,
          markedById: staffId,
        },
      });

      // If marked as ATE, sync with MessToken if present
      if (attendanceStatus === 'ATE') {
        await tx.messToken.updateMany({
          where: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
            status: { not: 'CANCELLED' },
          },
          data: {
            status: 'CONSUMED',
            consumedAt: markedAt,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          studentId: staffId || studentId,
          actionType: 'MESS_MANAGEMENT',
          action: 'UPDATE',
          actorRole: req.managementUser?.role || 'MESS_OPERATOR',
          entity: 'MessAttendance',
          entityId: record.id,
          description: `Marked attendance as ${attendanceStatus} for ${student.name} (${student.jntuNo}) - ${mealCfg.name} on ${targetDate}`,
        },
      });

      return [record];
    });

    // SSE event to student
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: 'MESS_ATTENDANCE_RECORDED',
      studentId,
      date: targetDate,
      mealType: normalizedMeal,
      status: attendanceStatus,
      markedBy: staffDisplayName,
      timestamp: markedAt.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Attendance marked as ${attendanceStatus === 'ATE' ? 'Ate' : 'Did Not Eat'} for ${student.name}.`,
      attendance: {
        id: attendanceRecord.id,
        studentId: student.id,
        studentName: student.name,
        rollNo: student.jntuNo,
        date: targetDate,
        mealType: normalizedMeal,
        status: attendanceRecord.status,
        markedAt: attendanceRecord.markedAt,
        markedBy: attendanceRecord.markedBy,
      },
    });
  } catch (error: any) {
    console.error('Error marking mess attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to record attendance.' });
  }
});

/**
 * POST /api/management/mess/attendance/batch
 * Batch saves attendance for multiple students simultaneously.
 * Ideal for rapid tap-to-mark Roll Number auto-save queue processing.
 */
router.post('/attendance/batch', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date, mealType, items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, message: 'Batch items array is required.' });
      return;
    }

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({ success: false, message: 'Valid mealType is required.' });
      return;
    }

    const normalizedMeal = mealType.trim().toUpperCase() as MealType;
    const configs = await getAuthoritativeMealConfigs();
    const mealCfg = configs.find((c) => c.type === normalizedMeal);
    if (!mealCfg) {
      res.status(400).json({ success: false, message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}` });
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const staffDisplayName = req.managementUser?.name || req.managementUser?.role || 'Mess Operator';
    const staffId = req.managementUser?.id || null;
    const markedAt = new Date();

    const studentIds = items.map((i: any) => String(i.studentId));
    
    // Verify students by id or jntuNo
    const students = await prisma.student.findMany({
      where: {
        OR: [
          { id: { in: studentIds } },
          { jntuNo: { in: studentIds } }
        ],
        isActive: true
      },
      select: { id: true, name: true, jntuNo: true }
    });

    // Map any passed jntuNo back to canonical Prisma student.id
    const idMap = new Map<string, string>();
    students.forEach(s => {
      idMap.set(s.id, s.id);
      idMap.set(s.jntuNo, s.id);
    });

    const validItems: { studentId: string; status: 'ATE' | 'DID_NOT_EAT' | 'PENDING' }[] = [];
    for (const item of items) {
      const canonicalId = idMap.get(String(item.studentId));
      if (canonicalId && ['ATE', 'DID_NOT_EAT', 'PENDING'].includes(item.status)) {
        validItems.push({
          studentId: canonicalId,
          status: item.status as 'ATE' | 'DID_NOT_EAT' | 'PENDING'
        });
      }
    }

    if (validItems.length === 0) {
      res.status(400).json({ success: false, message: 'No valid active students found in batch.' });
      return;
    }

    // Atomic transaction for all items
    await prisma.$transaction(async (tx) => {
      for (const item of validItems) {
        if (item.status === 'PENDING') {
          // Reset to pending -> Delete the attendance record and revert token
          const existing = await tx.messAttendance.findUnique({
            where: { studentId_date_mealType: { studentId: item.studentId, date: targetDate, mealType: normalizedMeal } }
          });
          
          if (existing) {
            await tx.messAttendance.delete({
              where: { studentId_date_mealType: { studentId: item.studentId, date: targetDate, mealType: normalizedMeal } }
            });
            
            await tx.messToken.updateMany({
              where: {
                studentId: item.studentId,
                date: targetDate,
                mealType: normalizedMeal,
                status: 'CONSUMED'
              },
              data: {
                status: 'BOOKED',
                consumedAt: null
              }
            });
          }
        } else {
          // Upsert attendance
          const record = await tx.messAttendance.upsert({
            where: {
              studentId_date_mealType: { studentId: item.studentId, date: targetDate, mealType: normalizedMeal },
            },
            update: {
              status: item.status,
              markedAt,
              markedBy: staffDisplayName,
              markedById: staffId,
            },
            create: {
              studentId: item.studentId,
              date: targetDate,
              mealType: normalizedMeal,
              status: item.status,
              markedAt,
              markedBy: staffDisplayName,
              markedById: staffId,
            },
          });

          // Sync tokens
          if (item.status === 'ATE') {
            await tx.messToken.updateMany({
              where: {
                studentId: item.studentId,
                date: targetDate,
                mealType: normalizedMeal,
                status: { not: 'CANCELLED' },
              },
              data: { status: 'CONSUMED', consumedAt: markedAt },
            });
          } else if (item.status === 'DID_NOT_EAT') {
            await tx.messToken.updateMany({
              where: {
                studentId: item.studentId,
                date: targetDate,
                mealType: normalizedMeal,
                status: 'CONSUMED'
              },
              data: { status: 'BOOKED', consumedAt: null },
            });
          }
        }
      }

      // Log the batch activity
      await tx.activityLog.create({
        data: {
          studentId: staffId || validItems[0].studentId,
          actionType: 'MESS_MANAGEMENT',
          action: 'UPDATE',
          actorRole: req.managementUser?.role || 'MESS_OPERATOR',
          entity: 'MessAttendance',
          entityId: 'BATCH',
          description: `Batch updated attendance for ${validItems.length} students - ${mealCfg.name} on ${targetDate}`,
        },
      });
    });

    // Fire SSE events for each processed item asynchronously
    Promise.resolve().then(() => {
      validItems.forEach((item: any) => {
        complaintEventsService.emitMessEventToStudent(item.studentId, {
          type: 'MESS_ATTENDANCE_RECORDED',
          studentId: item.studentId,
          date: targetDate,
          mealType: normalizedMeal,
          status: item.status,
          markedBy: staffDisplayName,
          timestamp: markedAt.toISOString(),
        });
      });
    });

    res.status(200).json({
      success: true,
      message: `Successfully processed batch attendance for ${validItems.length} students.`,
      processedCount: validItems.length
    });
  } catch (error: any) {
    console.error('Error in batch mess attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to process batch attendance.' });
  }
});

/**
 * PATCH /api/management/mess/attendance/:id
 * Corrects attendance record or resets to PENDING
 */
router.patch('/attendance/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!id || typeof id !== 'string') {
      res.status(400).json({ success: false, message: 'Valid attendance ID is required.' });
      return;
    }

    const existing = await prisma.messAttendance.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, name: true, jntuNo: true },
        },
      },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Attendance record not found.' });
      return;
    }

    const staffDisplayName = req.managementUser?.name || req.managementUser?.role || 'Mess Operator';
    const staffId = req.managementUser?.id || null;

    if (status && status.trim().toUpperCase() === 'PENDING') {
      // Revert to pending by deleting the attendance record
      await prisma.$transaction([
        prisma.messAttendance.delete({ where: { id } }),
        prisma.activityLog.create({
          data: {
            studentId: staffId || existing.studentId,
            actionType: 'MESS_MANAGEMENT',
            action: 'DELETE',
            actorRole: req.managementUser?.role || 'MESS_OPERATOR',
            entity: 'MessAttendance',
            entityId: id,
            description: `Reset attendance to PENDING for ${existing.student.name} (${existing.student.jntuNo}) on ${existing.date} - ${existing.mealType}`,
          },
        }),
      ]);

      res.json({
        success: true,
        message: `Attendance reset to Pending for ${existing.student.name}.`,
        status: 'PENDING',
      });
      return;
    }

    if (!status || !['ATE', 'DID_NOT_EAT'].includes(status.trim().toUpperCase())) {
      res.status(400).json({
        success: false,
        message: "Status must be 'ATE', 'DID_NOT_EAT', or 'PENDING'.",
      });
      return;
    }

    const newStatus = status.trim().toUpperCase() as 'ATE' | 'DID_NOT_EAT';
    const markedAt = new Date();

    const [updated] = await prisma.$transaction([
      prisma.messAttendance.update({
        where: { id },
        data: {
          status: newStatus,
          markedAt,
          markedBy: staffDisplayName,
          markedById: staffId,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId: staffId || existing.studentId,
          actionType: 'MESS_MANAGEMENT',
          action: 'UPDATE',
          actorRole: req.managementUser?.role || 'MESS_OPERATOR',
          entity: 'MessAttendance',
          entityId: id,
          description: `Corrected attendance to ${newStatus} for ${existing.student.name} (${existing.student.jntuNo}) on ${existing.date} - ${existing.mealType}`,
        },
      }),
    ]);

    res.json({
      success: true,
      message: `Attendance corrected to ${newStatus} for ${existing.student.name}.`,
      attendance: updated,
    });
  } catch (error: any) {
    console.error('Error correcting mess attendance:', error);
    res.status(500).json({ success: false, message: 'Failed to update attendance.' });
  }
});

/**
 * Shared helper to load all eligible students with full indent & attendance classification
 */
async function getReconciledStudents(
  targetDate: string,
  normalizedMeal: MealType,
  blockFilter?: string,
  searchFilter?: string
) {
  const configs = await getAuthoritativeMealConfigs();
  const mealCfg = configs.find((c) => c.type === normalizedMeal) || configs[0];

  const studentWhere: any = {
    role: 'STUDENT',
    isActive: true,
  };

  if (blockFilter && blockFilter.trim().toUpperCase() !== 'ALL') {
    studentWhere.blockName = { contains: blockFilter.trim(), mode: 'insensitive' };
  }

  if (searchFilter && searchFilter.trim()) {
    const term = searchFilter.trim();
    studentWhere.OR = [
      { name: { contains: term, mode: 'insensitive' } },
      { jntuNo: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const eligibleStudents = await prisma.student.findMany({
    where: studentWhere,
    select: {
      id: true,
      name: true,
      jntuNo: true,
      email: true,
      blockName: true,
      roomNumber: true,
      bedNumber: true,
    },
    orderBy: [{ blockName: 'asc' }, { roomNumber: 'asc' }, { name: 'asc' }],
  });

  const studentIds = eligibleStudents.map((s) => s.id);

  const [indents, tokens, attendances] = await Promise.all([
    prisma.messIndent.findMany({
      where: {
        date: targetDate,
        mealType: normalizedMeal,
        studentId: { in: studentIds },
      },
    }),
    prisma.messToken.findMany({
      where: {
        date: targetDate,
        mealType: normalizedMeal,
        studentId: { in: studentIds },
      },
    }),
    prisma.messAttendance.findMany({
      where: {
        date: targetDate,
        mealType: normalizedMeal,
        studentId: { in: studentIds },
      },
    }),
  ]);

  return eligibleStudents.map((s) => {
    const indentRecord = indents.find((i) => i.studentId === s.id);
    const tokenRecord = tokens.find((t) => t.studentId === s.id);
    const attRecord = attendances.find((a) => a.studentId === s.id);

    const isIndentSkipped = Boolean(
      (indentRecord && indentRecord.status === 'SKIPPED') ||
      (tokenRecord && (tokenRecord.status === 'SKIPPED' || tokenRecord.attendanceIntent === 'SKIPPED'))
    );

    const isIndentMarked = Boolean(
      (indentRecord && indentRecord.status === 'MARKED') ||
      (!indentRecord &&
        tokenRecord &&
        (tokenRecord.attendanceIntent === 'ATTENDING' ||
          tokenRecord.status === 'BOOKED' ||
          tokenRecord.status === 'CONSUMED'))
    );

    const computedIndentStatus: 'MARKED' | 'SKIPPED' | 'NOT_MARKED' = isIndentMarked
      ? 'MARKED'
      : isIndentSkipped
        ? 'SKIPPED'
        : 'NOT_MARKED';

    const indentTime = indentRecord
      ? indentRecord.createdAt.toISOString()
      : tokenRecord
        ? tokenRecord.createdAt.toISOString()
        : null;

    const isSlotEnded = isMealSlotEnded(targetDate, mealCfg.endHour, mealCfg.endMinute);
    const currentAttendanceStatus: 'PENDING' | 'ATE' | 'DID_NOT_EAT' = attRecord
      ? (attRecord.status as 'ATE' | 'DID_NOT_EAT')
      : isSlotEnded
        ? 'DID_NOT_EAT'
        : 'PENDING';

    const attendanceTime = attRecord ? attRecord.markedAt.toISOString() : null;
    const markedBy = attRecord?.markedBy || null;

    const classification = classifyFourWay(isIndentMarked, currentAttendanceStatus);
    const academic = decodeAcademicInfo(s.jntuNo);

    return {
      id: s.id,
      studentId: s.jntuNo,
      rollNo: s.jntuNo,
      studentName: s.name,
      email: s.email,
      branch: academic.department,
      year: academic.year,
      section: academic.semester,
      hostel: s.blockName || 'Residential Hostel',
      block: s.blockName || 'Unassigned',
      room: s.roomNumber || 'N/A',
      date: targetDate,
      meal: mealCfg.name,
      mealType: normalizedMeal,
      indentMarked: isIndentMarked,
      indentStatus: computedIndentStatus,
      indentTime,
      attendanceStatus: currentAttendanceStatus,
      attendanceTime,
      markedBy,
      categoryKey: classification.categoryKey,
      categoryTitle: classification.categoryTitle,
      isFinalized: classification.isFinalized,
    };
  });
}

/**
 * GET /api/management/mess/reports/summary
 * Returns summary counts for all four categories + pending.
 * Enforces Phase 9: values add up to total eligible students.
 */
router.get('/reports/summary', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { date, mealType, block, search } = req.query;
    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();
    let normalizedMeal: MealType = 'LUNCH';
    if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
      const candidate = mealType.trim().toUpperCase() as MealType;
      const valid = configs.find((c) => c.type === candidate);
      if (valid) normalizedMeal = candidate;
    }

    const students = await getReconciledStudents(
      targetDate,
      normalizedMeal,
      typeof block === 'string' ? block : undefined,
      typeof search === 'string' ? search : undefined
    );

    const totalStudents = students.length;
    const indentedAndAte = students.filter((s) => s.categoryKey === 'INDENTED_ATE').length;
    const unindentedAndAte = students.filter((s) => s.categoryKey === 'NO_INDENT_ATE').length;
    const indentedAndNotConsumed = students.filter((s) => s.categoryKey === 'INDENTED_NOT_ATE').length;
    const unindentedAndNotConsumed = students.filter((s) => s.categoryKey === 'NO_INDENT_NOT_ATE').length;
    const attendancePending = students.filter((s) => s.categoryKey === 'PENDING').length;

    res.json({
      success: true,
      date: targetDate,
      mealType: normalizedMeal,
      summary: {
        totalStudents,
        indentedAndAte,
        unindentedAndAte,
        indentedAndNotConsumed,
        unindentedAndNotConsumed,
        attendancePending,
        isFinalized: attendancePending === 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching reports summary:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reports summary.' });
  }
});

/**
 * GET /api/management/mess/reports/data
 * Unified report query endpoint supporting category filtering, pagination, and sorting
 */
router.get('/reports/data', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      category = 'all',
      date,
      mealType,
      block,
      search,
      page = '1',
      limit = '50',
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * take;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();
    let normalizedMeal: MealType = 'LUNCH';
    if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
      const candidate = mealType.trim().toUpperCase() as MealType;
      const valid = configs.find((c) => c.type === candidate);
      if (valid) normalizedMeal = candidate;
    }

    const students = await getReconciledStudents(
      targetDate,
      normalizedMeal,
      typeof block === 'string' ? block : undefined,
      typeof search === 'string' ? search : undefined
    );

    // Map category query string to internal category key
    const catClean = (category as string).toLowerCase().replace(/_/g, '-');
    let filtered = students;

    if (catClean === 'indented-ate' || catClean === 'indented_ate') {
      filtered = students.filter((s) => s.categoryKey === 'INDENTED_ATE');
    } else if (catClean === 'no-indent-ate' || catClean === 'no_indent_ate') {
      filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_ATE');
    } else if (catClean === 'indented-not-ate' || catClean === 'indented_not_ate') {
      filtered = students.filter((s) => s.categoryKey === 'INDENTED_NOT_ATE');
    } else if (catClean === 'no-indent-not-ate' || catClean === 'no_indent_not_ate') {
      filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_NOT_ATE');
    } else if (catClean === 'pending') {
      filtered = students.filter((s) => s.categoryKey === 'PENDING');
    } else {
      // By default for finalized 4-way reports, exclude PENDING unless requested
      filtered = students.filter((s) => s.isFinalized);
    }

    const total = filtered.length;
    const paginated = filtered.slice(skip, skip + take);

    res.json({
      success: true,
      category: catClean,
      date: targetDate,
      mealType: normalizedMeal,
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take) || 1,
      },
      records: paginated,
    });
  } catch (error: any) {
    console.error('Error fetching reports data:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve reports data.' });
  }
});

/**
 * Dedicated category report routes as requested in Phase 13
 */
router.get('/reports/indented-ate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  req.query.category = 'indented-ate';
  // Delegate to data handler
  const { date, mealType, block, search, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
  const skip = (pageNum - 1) * take;
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;
  const configs = await getAuthoritativeMealConfigs();
  let normalizedMeal: MealType = 'LUNCH';
  if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
    const candidate = mealType.trim().toUpperCase() as MealType;
    if (configs.some((c) => c.type === candidate)) normalizedMeal = candidate;
  }
  const students = await getReconciledStudents(targetDate, normalizedMeal, block as string, search as string);
  const filtered = students.filter((s) => s.categoryKey === 'INDENTED_ATE');
  res.json({
    success: true,
    category: 'indented-ate',
    categoryTitle: 'Indented & Consumed',
    date: targetDate,
    mealType: normalizedMeal,
    pagination: { total: filtered.length, page: pageNum, limit: take, totalPages: Math.ceil(filtered.length / take) || 1 },
    records: filtered.slice(skip, skip + take),
  });
});

router.get('/reports/no-indent-ate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  const { date, mealType, block, search, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
  const skip = (pageNum - 1) * take;
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;
  const configs = await getAuthoritativeMealConfigs();
  let normalizedMeal: MealType = 'LUNCH';
  if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
    const candidate = mealType.trim().toUpperCase() as MealType;
    if (configs.some((c) => c.type === candidate)) normalizedMeal = candidate;
  }
  const students = await getReconciledStudents(targetDate, normalizedMeal, block as string, search as string);
  const filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_ATE');
  res.json({
    success: true,
    category: 'no-indent-ate',
    categoryTitle: 'Unindented & Consumed',
    date: targetDate,
    mealType: normalizedMeal,
    pagination: { total: filtered.length, page: pageNum, limit: take, totalPages: Math.ceil(filtered.length / take) || 1 },
    records: filtered.slice(skip, skip + take),
  });
});

router.get('/reports/indented-not-ate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  const { date, mealType, block, search, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
  const skip = (pageNum - 1) * take;
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;
  const configs = await getAuthoritativeMealConfigs();
  let normalizedMeal: MealType = 'LUNCH';
  if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
    const candidate = mealType.trim().toUpperCase() as MealType;
    if (configs.some((c) => c.type === candidate)) normalizedMeal = candidate;
  }
  const students = await getReconciledStudents(targetDate, normalizedMeal, block as string, search as string);
  const filtered = students.filter((s) => s.categoryKey === 'INDENTED_NOT_ATE');
  res.json({
    success: true,
    category: 'indented-not-ate',
    categoryTitle: 'Indented & Not Consumed',
    date: targetDate,
    mealType: normalizedMeal,
    pagination: { total: filtered.length, page: pageNum, limit: take, totalPages: Math.ceil(filtered.length / take) || 1 },
    records: filtered.slice(skip, skip + take),
  });
});

router.get('/reports/no-indent-not-ate', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  const { date, mealType, block, search, page = '1', limit = '50' } = req.query;
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const take = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50));
  const skip = (pageNum - 1) * take;
  const todayStr = new Date().toISOString().split('T')[0];
  const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;
  const configs = await getAuthoritativeMealConfigs();
  let normalizedMeal: MealType = 'LUNCH';
  if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
    const candidate = mealType.trim().toUpperCase() as MealType;
    if (configs.some((c) => c.type === candidate)) normalizedMeal = candidate;
  }
  const students = await getReconciledStudents(targetDate, normalizedMeal, block as string, search as string);
  const filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_NOT_ATE');
  res.json({
    success: true,
    category: 'no-indent-not-ate',
    categoryTitle: 'Unindented & Not Consumed',
    date: targetDate,
    mealType: normalizedMeal,
    pagination: { total: filtered.length, page: pageNum, limit: take, totalPages: Math.ceil(filtered.length / take) || 1 },
    records: filtered.slice(skip, skip + take),
  });
});

/**
 * GET /api/management/mess/reports/export
 * Exports four-way reports in XLSX or CSV format respecting all selected filters.
 * Filenames follow Phase 12 format.
 */
router.get('/reports/export', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const {
      category = 'indented-ate',
      date,
      mealType,
      format = 'xlsx',
      block,
      search,
    } = req.query;

    const todayStr = new Date().toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim())
      ? date.trim()
      : todayStr;

    const configs = await getAuthoritativeMealConfigs();
    let normalizedMeal: MealType = 'LUNCH';
    if (typeof mealType === 'string' && mealType.trim() && mealType.trim().toUpperCase() !== 'ALL') {
      const candidate = mealType.trim().toUpperCase() as MealType;
      const valid = configs.find((c) => c.type === candidate);
      if (valid) normalizedMeal = candidate;
    }

    const students = await getReconciledStudents(
      targetDate,
      normalizedMeal,
      typeof block === 'string' ? block : undefined,
      typeof search === 'string' ? search : undefined
    );

    const catClean = (category as string).toLowerCase().replace(/_/g, '-');
    let filtered = students;
    let fileCategoryTag = 'indented_ate';

    if (catClean === 'indented-ate' || catClean === 'indented_ate') {
      filtered = students.filter((s) => s.categoryKey === 'INDENTED_ATE');
      fileCategoryTag = 'indented_ate';
    } else if (catClean === 'no-indent-ate' || catClean === 'no_indent_ate') {
      filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_ATE');
      fileCategoryTag = 'no_indent_ate';
    } else if (catClean === 'indented-not-ate' || catClean === 'indented_not_ate') {
      filtered = students.filter((s) => s.categoryKey === 'INDENTED_NOT_ATE');
      fileCategoryTag = 'indented_not_ate';
    } else if (catClean === 'no-indent-not-ate' || catClean === 'no_indent_not_ate') {
      filtered = students.filter((s) => s.categoryKey === 'NO_INDENT_NOT_ATE');
      fileCategoryTag = 'no_indent_not_ate';
    } else {
      fileCategoryTag = 'all_reconciled';
    }

    // Format rows according to Phase 12 specification
    const exportRows = filtered.map((item, idx) => ({
      'S.No': idx + 1,
      'Student ID / Roll Number': item.studentId,
      'Student Name': item.studentName,
      'Branch': item.branch,
      'Year': item.year,
      'Section': item.section,
      'Hostel': item.hostel,
      'Block': item.block,
      'Room': item.room,
      'Date': item.date,
      'Meal': item.meal,
      'Indent Status': item.indentStatus,
      'Indent Time': item.indentTime ? new Date(item.indentTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      'Attendance Status': item.attendanceStatus,
      'Attendance Time': item.attendanceTime ? new Date(item.attendanceTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
      'Marked By': item.markedBy || 'N/A',
      'Classification': item.categoryTitle,
    }));

    const isCsv = (format as string).toLowerCase() === 'csv';
    const filename = `mess_${fileCategoryTag}_${targetDate}_${normalizedMeal.toLowerCase()}.${isCsv ? 'csv' : 'xlsx'}`;

    if (isCsv) {
      const headers = [
        'Student ID / Roll Number',
        'Student Name',
        'Branch',
        'Year',
        'Section',
        'Hostel',
        'Block',
        'Room',
        'Date',
        'Meal',
        'Indent Status',
        'Indent Time',
        'Attendance Status',
        'Attendance Time',
        'Marked By',
        'Classification',
      ];

      const csvLines = [headers.map((h) => `"${h}"`).join(',')];
      for (const row of exportRows) {
        csvLines.push([
          `"${row['Student ID / Roll Number']}"`,
          `"${row['Student Name'].replace(/"/g, '""')}"`,
          `"${row['Branch'].replace(/"/g, '""')}"`,
          `"${row['Year']}"`,
          `"${row['Section']}"`,
          `"${row['Hostel'].replace(/"/g, '""')}"`,
          `"${row['Block'].replace(/"/g, '""')}"`,
          `"${row['Room']}"`,
          `"${row['Date']}"`,
          `"${row['Meal']}"`,
          `"${row['Indent Status']}"`,
          `"${row['Indent Time']}"`,
          `"${row['Attendance Status']}"`,
          `"${row['Attendance Time']}"`,
          `"${(row['Marked By'] || '').replace(/"/g, '""')}"`,
          `"${row['Classification']}"`,
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvLines.join('\r\n'));
      return;
    }

    // Default: XLSX format
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reconciliation Report');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.status(200).send(buffer);
  } catch (error: any) {
    console.error('Error exporting mess reconciliation report:', error);
    res.status(500).json({ success: false, message: 'Failed to export reconciliation report.' });
  }
});

export default router;

