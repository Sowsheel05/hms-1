import { Router, Response } from 'express';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../services/prisma.service';
import { complaintEventsService } from '../services/events.service';

const router = Router();

// Consume authoritative Mess configuration maintained by Admin Mess Management
import {
  VALID_MEALS,
  MealType,
  MealTimingConfig,
  BOOKING_HORIZON_DAYS,
  MEAL_CONFIGS,
} from './mess-management.routes';

export { VALID_MEALS, MealType, BOOKING_HORIZON_DAYS, MEAL_CONFIGS };
export type MealConfig = MealTimingConfig;

/**
 * Format cutoff hour and minute into human readable string
 */
function formatCutoffTime(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = String(minute).padStart(2, '0');
  return `${String(displayHour).padStart(2, '0')}:${displayMinute} ${period}`;
}

/**
 * Generate unique token identifier
 */
function generateTokenNumber(dateStr: string, mealType: string): string {
  const dateTag = dateStr.replace(/-/g, '');
  const mealTag = mealType.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MT-${dateTag}-${mealTag}-${randomSuffix}`;
}

/**
 * Evaluate authoritative server-side deadline for a given date & meal
 */
export function evaluateMealDeadline(
  targetDate: string,
  mealConfig: MealConfig,
  now: Date = new Date()
): {
  isBookingOpen: boolean;
  deadlineIso: string;
  deadlineFormatted: string;
  timeRemainingSeconds: number;
  reason?: string;
} {
  const todayStr = now.toISOString().split('T')[0];
  const cutoffTimeStr = `${String(mealConfig.cutoffHour).padStart(2, '0')}:${String(mealConfig.cutoffMinute).padStart(2, '0')}:00`;
  const formattedCutoff = formatCutoffTime(mealConfig.cutoffHour, mealConfig.cutoffMinute);

  // 1. Past date -> Closed
  if (targetDate < todayStr) {
    return {
      isBookingOpen: false,
      deadlineIso: `${targetDate}T23:59:59.000Z`,
      deadlineFormatted: `Booking closed for past date`,
      timeRemainingSeconds: 0,
      reason: 'Past date',
    };
  }

  // 2. Today's date -> evaluate cutoff against server time
  if (targetDate === todayStr) {
    const cutoffDateTime = new Date(`${todayStr}T${cutoffTimeStr}`);
    const timeDiffMs = cutoffDateTime.getTime() - now.getTime();
    const timeRemainingSeconds = Math.max(0, Math.floor(timeDiffMs / 1000));

    if (timeRemainingSeconds <= 0) {
      return {
        isBookingOpen: false,
        deadlineIso: cutoffDateTime.toISOString(),
        deadlineFormatted: `Booking closed today at ${formattedCutoff}`,
        timeRemainingSeconds: 0,
        reason: 'Cutoff time passed',
      };
    }

    return {
      isBookingOpen: true,
      deadlineIso: cutoffDateTime.toISOString(),
      deadlineFormatted: `Today by ${formattedCutoff}`,
      timeRemainingSeconds,
    };
  }

  // 3. Future date within horizon -> Open
  const targetCutoff = new Date(`${targetDate}T${cutoffTimeStr}`);
  const timeDiffMs = targetCutoff.getTime() - now.getTime();
  const timeRemainingSeconds = Math.max(0, Math.floor(timeDiffMs / 1000));

  return {
    isBookingOpen: true,
    deadlineIso: targetCutoff.toISOString(),
    deadlineFormatted: `${targetDate} by ${formattedCutoff}`,
    timeRemainingSeconds,
  };
}

/**
 * Generate permitted booking horizon range
 */
export function getBookingHorizon(now: Date = new Date()) {
  const todayStr = now.toISOString().split('T')[0];
  const dates = [];

  for (let i = 0; i < BOOKING_HORIZON_DAYS; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNumber = d.getDate();
    const monthName = d.toLocaleDateString('en-US', { month: 'short' });
    const fullFormatted = d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    dates.push({
      date: dateStr,
      dayName,
      dayNumber,
      monthName,
      fullFormatted,
      isToday: dateStr === todayStr,
      isPast: false,
    });
  }

  const startDate = dates[0].date;
  const endDate = dates[dates.length - 1].date;

  return {
    startDate,
    endDate,
    horizonDays: BOOKING_HORIZON_DAYS,
    dates,
  };
}

/**
 * GET /api/student/mess-tokens
 * Returns student's token booking status, daily meal slots, active passes, and token history.
 * Supports multi-day date query ?date=YYYY-MM-DD
 */
router.get('/mess-tokens', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const horizon = getBookingHorizon(now);

    // Determine target requested date (default to today)
    const { date } = req.query;
    let targetDate = todayStr;
    if (typeof date === 'string' && date.trim()) {
      const cleanDate = date.trim();
      const testDate = new Date(`${cleanDate}T12:00:00Z`);
      const parts = cleanDate.split('-');
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate) ||
        isNaN(testDate.getTime()) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
      ) {
        res.status(400).json({
          success: false,
          message: 'Invalid date format. Expected YYYY-MM-DD.',
        });
        return;
      }
      targetDate = cleanDate;
    }

    const targetDateObj = new Date(`${targetDate}T12:00:00Z`);
    const formattedDate = targetDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    // 2. Fetch tokens and indents for requested targetDate
    const [targetDateTokens, targetDateIndents] = await Promise.all([
      prisma.messToken.findMany({
        where: {
          studentId,
          date: targetDate,
        },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.messIndent.findMany({
        where: {
          studentId,
          date: targetDate,
        },
      }),
    ]);

    // 3. Map meal slots for targetDate
    const mealSlots = MEAL_CONFIGS.map((config) => {
      const existingRecord = targetDateTokens.find((t) => t.mealType === config.type);
      const existingIndent = targetDateIndents.find((i) => i.mealType === config.type);
      const deadlineInfo = evaluateMealDeadline(targetDate, config, now);

      let slotStatus: 'AVAILABLE' | 'DRAFT' | 'BOOKED' | 'SKIPPED' | 'USED' | 'CLOSED';
      let isLocked = false;
      let attendanceIntent: 'ATTENDING' | 'SKIPPED' | null = null;

      if (existingRecord) {
        isLocked = existingRecord.isLocked || ['BOOKED', 'CONSUMED', 'SKIPPED'].includes(existingRecord.status);
        attendanceIntent = (existingRecord.attendanceIntent as any) || (existingRecord.status === 'SKIPPED' ? 'SKIPPED' : 'ATTENDING');

        if (existingRecord.status === 'CONSUMED') {
          slotStatus = 'USED';
        } else if (existingRecord.status === 'BOOKED') {
          slotStatus = 'BOOKED';
        } else if (existingRecord.status === 'SKIPPED') {
          slotStatus = 'SKIPPED';
        } else if (existingRecord.status === 'DRAFT') {
          slotStatus = 'DRAFT';
        } else if (existingRecord.status === 'CANCELLED') {
          slotStatus = deadlineInfo.isBookingOpen ? 'AVAILABLE' : 'CLOSED';
          isLocked = !deadlineInfo.isBookingOpen;
        } else {
          slotStatus = 'BOOKED';
        }
      } else {
        slotStatus = deadlineInfo.isBookingOpen ? 'AVAILABLE' : 'CLOSED';
        isLocked = !deadlineInfo.isBookingOpen;
      }

      return {
        mealType: config.type,
        name: config.name,
        timing: config.timing,
        description: config.description,
        status: slotStatus,
        isLocked,
        attendanceIntent,
        isBookingOpen: deadlineInfo.isBookingOpen,
        deadlineTime: deadlineInfo.deadlineIso,
        deadlineFormatted: deadlineInfo.deadlineFormatted,
        timeRemainingSeconds: deadlineInfo.timeRemainingSeconds,
        token:
          existingRecord && existingRecord.status !== 'DRAFT'
            ? {
              id: existingRecord.id,
              tokenNumber: existingRecord.tokenNumber,
              date: existingRecord.date,
              mealType: existingRecord.mealType,
              status: existingRecord.status,
              isLocked: existingRecord.isLocked,
              attendanceIntent: existingRecord.attendanceIntent,
              createdAt: existingRecord.createdAt,
              timing: config.timing,
            }
            : null,
        draft:
          existingRecord && existingRecord.status === 'DRAFT'
            ? {
              id: existingRecord.id,
              date: existingRecord.date,
              mealType: existingRecord.mealType,
              attendanceIntent: existingRecord.attendanceIntent,
              updatedAt: existingRecord.updatedAt,
            }
            : null,
        indent: existingIndent
          ? {
            id: existingIndent.id,
            status: existingIndent.status,
            markedAt: (existingIndent as any).markedAt ? (existingIndent as any).markedAt.toISOString() : existingIndent.createdAt.toISOString(),
            createdAt: existingIndent.createdAt.toISOString(),
          }
          : existingRecord && (existingRecord.status === 'BOOKED' || existingRecord.status === 'CONSUMED')
            ? {
              id: `token-${existingRecord.id}`,
              status: 'MARKED',
              markedAt: existingRecord.createdAt.toISOString(),
              createdAt: existingRecord.createdAt.toISOString(),
            }
            : null,
      };
    });

    const bookedCount = targetDateTokens.filter((t) => t.status === 'BOOKED' || t.status === 'CONSUMED').length;
    const skippedCount = targetDateTokens.filter((t) => t.status === 'SKIPPED').length;
    const draftCount = targetDateTokens.filter((t) => t.status === 'DRAFT').length;
    const totalMeals = MEAL_CONFIGS.length;
    const remainingCount = Math.max(0, totalMeals - bookedCount - skippedCount);

    let summaryStatus = 'No Indents';
    if (bookedCount === totalMeals) {
      summaryStatus = 'All Meals Booked';
    } else if (bookedCount + skippedCount === totalMeals) {
      summaryStatus = 'All Indents Finalized';
    } else if (bookedCount > 0) {
      summaryStatus = `${bookedCount} Booked Today`;
    } else if (draftCount > 0) {
      summaryStatus = `${draftCount} Draft Saved`;
    }

    // 4. Fetch past/recent token history (ordered by date desc, createdAt desc)
    const rawHistory = await prisma.messToken.findMany({
      where: {
        studentId,
        status: { in: ['BOOKED', 'CONSUMED', 'SKIPPED', 'CANCELLED'] },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });

    const history = rawHistory.map((item) => {
      const mealConf = MEAL_CONFIGS.find((c) => c.type === item.mealType);
      return {
        id: item.id,
        tokenNumber: item.tokenNumber,
        date: item.date,
        mealType: item.mealType,
        mealName: mealConf?.name || item.mealType,
        timing: mealConf?.timing || '',
        status: item.status,
        attendanceIntent: item.attendanceIntent,
        createdAt: item.createdAt,
      };
    });

    // 5. Active token passes for today
    const todayTokens =
      targetDate === todayStr
        ? targetDateTokens
        : await prisma.messToken.findMany({
          where: { studentId, date: todayStr },
        });

    const activeTokensToday = todayTokens
      .filter((t) => t.status === 'BOOKED' && t.tokenNumber)
      .map((t) => {
        const mealConf = MEAL_CONFIGS.find((c) => c.type === t.mealType);
        return {
          id: t.id,
          tokenNumber: t.tokenNumber,
          date: t.date,
          mealType: t.mealType,
          mealName: mealConf?.name || t.mealType,
          timing: mealConf?.timing || '',
          status: t.status,
          createdAt: t.createdAt,
          studentName: student.name,
          jntuNo: student.jntuNo,
          blockName: student.blockName || 'Residential Mess Hall',
          roomNumber: student.roomNumber || 'Hostel Campus',
        };
      });

    // Unified payload preserving complete backward compatibility with Step 2 & existing test suites
    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        allocationStatus: student.allocationStatus,
      },
      horizon,
      selectedDate: {
        date: targetDate,
        formattedDate,
        isToday: targetDate === todayStr,
        summary: {
          totalMeals,
          bookedCount,
          skippedCount,
          draftCount,
          remainingCount,
          summaryStatus,
        },
        mealSlots,
      },
      today: {
        date: targetDate,
        formattedDate,
        summary: {
          totalMeals,
          bookedCount,
          skippedCount,
          draftCount,
          remainingCount,
          summaryStatus,
        },
        mealSlots,
        activeTokensToday,
      },
      history,
    });
  } catch (error) {
    console.error('Error fetching mess tokens:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load mess token information. Please try again.',
    });
  }
});

/**
 * POST /api/student/mess-tokens/draft
 * Persists a draft attendance intent (ATTENDING or SKIPPED) without finalizing token
 */
router.post('/mess-tokens/draft', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Verify student and active suspension
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !student.isActive) {
      res.status(404).json({ success: false, message: 'This account is currently unavailable.' });
      return;
    }

    const activeSuspension = await prisma.suspension.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeSuspension) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Your hostel mess privileges are suspended.',
      });
      return;
    }

    // 2. Validate input
    const { mealType, date, attendanceIntent } = req.body;

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({ success: false, message: 'Valid mealType is required.' });
      return;
    }

    const normalizedMeal = mealType.toUpperCase() as MealType;
    const mealConfig = MEAL_CONFIGS.find((c) => c.type === normalizedMeal);
    if (!mealConfig) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;

    // Validate booking horizon
    const maxHorizonDate = new Date(now.getTime() + (BOOKING_HORIZON_DAYS - 1) * 86400000).toISOString().split('T')[0];
    if (targetDate < todayStr || targetDate > maxHorizonDate) {
      res.status(400).json({
        success: false,
        message: `Date is outside the permitted booking horizon (${todayStr} to ${maxHorizonDate}).`,
      });
      return;
    }

    // Validate server deadline
    const deadlineInfo = evaluateMealDeadline(targetDate, mealConfig, now);
    if (!deadlineInfo.isBookingOpen) {
      res.status(400).json({
        success: false,
        message: `Booking deadline has passed for ${mealConfig.name} on ${targetDate}.`,
      });
      return;
    }

    // Validate attendanceIntent
    if (!attendanceIntent || !['ATTENDING', 'SKIPPED'].includes(attendanceIntent)) {
      res.status(400).json({
        success: false,
        message: "attendanceIntent must be either 'ATTENDING' or 'SKIPPED'.",
      });
      return;
    }

    // 3. Check existing record
    const existing = await prisma.messToken.findUnique({
      where: {
        studentId_date_mealType: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
        },
      },
    });

    if (existing && (existing.isLocked || ['BOOKED', 'CONSUMED'].includes(existing.status))) {
      res.status(409).json({
        success: false,
        message: 'This meal indent is already finalized/locked and cannot be modified as a draft.',
      });
      return;
    }

    // 4. Save/upsert draft record
    const draft = await prisma.messToken.upsert({
      where: {
        studentId_date_mealType: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
        },
      },
      update: {
        status: 'DRAFT',
        attendanceIntent,
        isLocked: false,
        tokenNumber: null,
      },
      create: {
        studentId,
        date: targetDate,
        mealType: normalizedMeal,
        status: 'DRAFT',
        attendanceIntent,
        isLocked: false,
        tokenNumber: null,
      },
    });

    // 5. Emit real-time event to student
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: 'MESS_INDENT_UPDATED',
      tokenId: draft.id,
      studentId,
      date: draft.date,
      mealType: draft.mealType,
      status: draft.status,
      details: { attendanceIntent: draft.attendanceIntent, isDraft: true },
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({
      success: true,
      message: `Draft intent saved for ${mealConfig.name} on ${targetDate}.`,
      draft: {
        id: draft.id,
        mealType: draft.mealType,
        mealName: mealConfig.name,
        date: draft.date,
        attendanceIntent: draft.attendanceIntent,
        status: draft.status,
        isLocked: draft.isLocked,
        timing: mealConfig.timing,
        updatedAt: draft.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error saving mess draft:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to save draft indent. Please try again.',
    });
  }
});

/**
 * POST /api/student/mess-tokens/lock
 * Authoritatively locks meal indent. If ATTENDING, generates token; if SKIPPED, marks skipped.
 */
router.post('/mess-tokens/lock', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // 1. Verify student and active suspension
    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !student.isActive) {
      res.status(404).json({ success: false, message: 'This account is currently unavailable.' });
      return;
    }

    const activeSuspension = await prisma.suspension.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeSuspension) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Your hostel mess privileges are suspended.',
      });
      return;
    }

    // 2. Validate inputs
    const { mealType, date, attendanceIntent } = req.body;

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({ success: false, message: 'Valid mealType is required.' });
      return;
    }

    const normalizedMeal = mealType.toUpperCase() as MealType;
    const mealConfig = MEAL_CONFIGS.find((c) => c.type === normalizedMeal);
    if (!mealConfig) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;

    // Validate booking horizon
    const maxHorizonDate = new Date(now.getTime() + (BOOKING_HORIZON_DAYS - 1) * 86400000).toISOString().split('T')[0];
    if (targetDate < todayStr || targetDate > maxHorizonDate) {
      res.status(400).json({
        success: false,
        message: `Date is outside the permitted booking horizon (${todayStr} to ${maxHorizonDate}).`,
      });
      return;
    }

    // Validate server deadline
    const deadlineInfo = evaluateMealDeadline(targetDate, mealConfig, now);
    if (!deadlineInfo.isBookingOpen) {
      res.status(400).json({
        success: false,
        message: `Booking deadline has passed for ${mealConfig.name} on ${targetDate}.`,
      });
      return;
    }

    if (!attendanceIntent || !['ATTENDING', 'SKIPPED'].includes(attendanceIntent)) {
      res.status(400).json({
        success: false,
        message: "attendanceIntent must be either 'ATTENDING' or 'SKIPPED'.",
      });
      return;
    }

    // 3. Existing record check
    const existing = await prisma.messToken.findUnique({
      where: {
        studentId_date_mealType: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
        },
      },
    });

    if (existing && (existing.isLocked || ['BOOKED', 'CONSUMED', 'SKIPPED'].includes(existing.status))) {
      res.status(409).json({
        success: false,
        message: `You have already submitted and locked your indent for ${mealConfig.name} on ${targetDate}.`,
      });
      return;
    }

    // 4. Transactional persistence with concurrency protection
    const isAttending = attendanceIntent === 'ATTENDING';
    const finalStatus = isAttending ? 'BOOKED' : 'SKIPPED';
    const tokenNumber = isAttending ? generateTokenNumber(targetDate, normalizedMeal) : null;
    const lockedAt = new Date();

    const lockedToken = await prisma.$transaction(async (tx) => {
      if (existing) {
        const updateResult = await tx.messToken.updateMany({
          where: {
            id: existing.id,
            isLocked: false,
          },
          data: {
            status: finalStatus,
            isLocked: true,
            lockedAt,
            attendanceIntent,
            tokenNumber,
          },
        });

        if (updateResult.count === 0) {
          throw { code: 'ALREADY_LOCKED', message: `You have already submitted and locked your indent for ${mealConfig.name} on ${targetDate}.` };
        }

        await tx.messIndent.upsert({
          where: {
            studentId_date_mealType: {
              studentId,
              date: targetDate,
              mealType: normalizedMeal,
            },
          },
          update: {
            status: isAttending ? 'MARKED' : 'SKIPPED',
          },
          create: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
            status: isAttending ? 'MARKED' : 'SKIPPED',
          },
        });

        await tx.activityLog.create({
          data: {
            studentId,
            actionType: 'MESS',
            description: isAttending
              ? `Submitted & locked ${mealConfig.name} indent (${tokenNumber}) for ${targetDate}`
              : `Submitted & locked ${mealConfig.name} indent (SKIPPED) for ${targetDate}`,
          },
        });

        return await tx.messToken.findUniqueOrThrow({ where: { id: existing.id } });
      } else {
        const createdToken = await tx.messToken.create({
          data: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
            status: finalStatus,
            isLocked: true,
            lockedAt,
            attendanceIntent,
            tokenNumber,
          },
        });

        await tx.messIndent.upsert({
          where: {
            studentId_date_mealType: {
              studentId,
              date: targetDate,
              mealType: normalizedMeal,
            },
          },
          update: {
            status: isAttending ? 'MARKED' : 'SKIPPED',
          },
          create: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
            status: isAttending ? 'MARKED' : 'SKIPPED',
          },
        });

        await tx.activityLog.create({
          data: {
            studentId,
            actionType: 'MESS',
            description: isAttending
              ? `Submitted & locked ${mealConfig.name} indent (${tokenNumber}) for ${targetDate}`
              : `Submitted & locked ${mealConfig.name} indent (SKIPPED) for ${targetDate}`,
          },
        });

        return createdToken;
      }
    });

    // 5. Real-time event emission
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: isAttending ? 'MESS_TOKEN_BOOKED' : 'MESS_INDENT_UPDATED',
      tokenId: lockedToken.id,
      studentId,
      date: lockedToken.date,
      mealType: lockedToken.mealType,
      status: lockedToken.status,
      details: {
        attendanceIntent: lockedToken.attendanceIntent,
        tokenNumber: lockedToken.tokenNumber,
        isLocked: true,
      },
      timestamp: lockedAt.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: isAttending
        ? `${mealConfig.name} mess token issued and indent locked successfully.`
        : `${mealConfig.name} meal marked as skipped and indent locked.`,
      token: {
        id: lockedToken.id,
        tokenNumber: lockedToken.tokenNumber,
        mealType: lockedToken.mealType,
        mealName: mealConfig.name,
        date: lockedToken.date,
        status: lockedToken.status,
        isLocked: lockedToken.isLocked,
        attendanceIntent: lockedToken.attendanceIntent,
        timing: mealConfig.timing,
        createdAt: lockedToken.createdAt,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002' || error.code === 'ALREADY_LOCKED') {
      res.status(409).json({
        success: false,
        message: error.message || 'You have already submitted and locked your indent for this meal.',
      });
      return;
    }

    console.error('Error locking mess indent:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit and lock mess indent. Please try again.',
    });
  }
});

/**
 * POST /api/student/mess-tokens/book
 * Atomically books a meal token for the authenticated student (backward compatibility)
 */
router.post('/mess-tokens/book', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Verify student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable.',
      });
      return;
    }

    // 2. Validate input
    const { mealType, date } = req.body;

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Valid mealType is required.',
      });
      return;
    }

    const normalizedMeal = mealType.toUpperCase() as MealType;
    if (!VALID_MEALS.includes(normalizedMeal)) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayStr;
    const mealConfig = MEAL_CONFIGS.find((c) => c.type === normalizedMeal);

    // 3. Duplicate check before creation
    const existing = await prisma.messToken.findUnique({
      where: {
        studentId_date_mealType: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
        },
      },
    });

    if (existing && (existing.status === 'BOOKED' || existing.status === 'CONSUMED' || existing.isLocked)) {
      res.status(409).json({
        success: false,
        message: `You have already booked a mess token for ${normalizedMeal.toLowerCase()} on this date.`,
      });
      return;
    }

    // 4. Generate user-facing token reference
    const tokenNumber = generateTokenNumber(targetDate, normalizedMeal);
    const lockedAt = new Date();

    // 5. Transactional creation: create/update token and record activity log
    const [newToken] = await prisma.$transaction([
      prisma.messToken.upsert({
        where: {
          studentId_date_mealType: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
          },
        },
        update: {
          tokenNumber,
          status: 'BOOKED',
          isLocked: true,
          lockedAt,
          attendanceIntent: 'ATTENDING',
        },
        create: {
          studentId,
          tokenNumber,
          date: targetDate,
          mealType: normalizedMeal,
          status: 'BOOKED',
          isLocked: true,
          lockedAt,
          attendanceIntent: 'ATTENDING',
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'MESS',
          description: `Booked ${mealConfig?.name || normalizedMeal} token (${tokenNumber}) for ${targetDate}`,
        },
      }),
    ]);

    // Emit real-time event
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: 'MESS_TOKEN_BOOKED',
      tokenId: newToken.id,
      studentId,
      date: newToken.date,
      mealType: newToken.mealType,
      status: newToken.status,
      timestamp: new Date().toISOString(),
    });

    res.status(201).json({
      success: true,
      message: `${mealConfig?.name || normalizedMeal} mess token booked successfully.`,
      token: {
        id: newToken.id,
        tokenNumber: newToken.tokenNumber,
        mealType: newToken.mealType,
        mealName: mealConfig?.name || newToken.mealType,
        date: newToken.date,
        status: newToken.status,
        isLocked: newToken.isLocked,
        timing: mealConfig?.timing || '',
        createdAt: newToken.createdAt,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'You have already booked a mess token for this meal.',
      });
      return;
    }

    console.error('Error booking mess token:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to book mess token. Please try again.',
    });
  }
});

export const STATIC_MESS_QR_CONFIG = {
  payload: 'HMS_MESS_ENTRY',
  entryPoint: '/mess/verify',
  title: 'HMS Mess Verification Entry Point',
  description: 'Permanent static QR code for HMS hostel mess attendance verification.',
  isStatic: true,
};

/**
 * GET /api/student/mess/qr and GET /api/student/mess-qr
 * Returns the permanent static QR entry-point configuration for HMS Mess verification.
 * Deterministic and identical for every student, meal, and date.
 */
router.get(['/mess/qr', '/mess-qr'], authenticateStudent, (req: AuthenticatedRequest, res: Response): void => {
  res.json({
    success: true,
    ...STATIC_MESS_QR_CONFIG,
  });
});

/**
 * POST /api/student/mess/indent (and /api/student/mess-indent)
 * Student Portal Indent Marking (Phase 2 & Phase 13)
 * Stores: studentId, date, mealType, status (MARKED/NOT_MARKED/SKIPPED), timestamp
 * Prevents duplicate indent records with uniqueness constraint.
 */
router.post(['/mess/indent', '/mess-indent'], authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const student = await prisma.student.findUnique({ where: { id: studentId } });
    if (!student || !student.isActive) {
      res.status(404).json({ success: false, message: 'This account is currently unavailable.' });
      return;
    }

    const activeSuspension = await prisma.suspension.findFirst({
      where: {
        studentId,
        status: 'ACTIVE',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });

    if (activeSuspension) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Your hostel mess privileges are suspended.',
      });
      return;
    }

    const { mealType, date, status, attendanceIntent } = req.body;

    if (!mealType || typeof mealType !== 'string') {
      res.status(400).json({ success: false, message: 'Valid mealType is required.' });
      return;
    }

    const normalizedMeal = mealType.toUpperCase() as MealType;
    const mealConfig = MEAL_CONFIGS.find((c) => c.type === normalizedMeal);
    if (!mealConfig) {
      res.status(400).json({
        success: false,
        message: `Invalid mealType. Supported meals: ${VALID_MEALS.join(', ')}`,
      });
      return;
    }

    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;

    // Determine if meal is intended/attending
    const isAttending = !(
      status === 'NOT_MARKED' ||
      status === 'SKIPPED' ||
      attendanceIntent === 'SKIPPED' ||
      req.body.indentMarked === false
    );

    const indentStatus = isAttending ? 'MARKED' : 'SKIPPED';
    const finalTokenStatus = isAttending ? 'BOOKED' : 'SKIPPED';
    const finalAttendanceIntent = isAttending ? 'ATTENDING' : 'SKIPPED';
    const tokenNumber = isAttending ? generateTokenNumber(targetDate, normalizedMeal) : null;
    const lockedAt = new Date();

    const [savedIndent] = await prisma.$transaction([
      prisma.messIndent.upsert({
        where: {
          studentId_date_mealType: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
          },
        },
        update: {
          status: indentStatus,
        },
        create: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
          status: indentStatus,
        },
      }),
      prisma.messToken.upsert({
        where: {
          studentId_date_mealType: {
            studentId,
            date: targetDate,
            mealType: normalizedMeal,
          },
        },
        update: {
          status: finalTokenStatus,
          isLocked: true,
          lockedAt,
          attendanceIntent: finalAttendanceIntent,
          ...(tokenNumber ? { tokenNumber } : {}),
        },
        create: {
          studentId,
          date: targetDate,
          mealType: normalizedMeal,
          status: finalTokenStatus,
          isLocked: true,
          lockedAt,
          attendanceIntent: finalAttendanceIntent,
          tokenNumber,
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'MESS',
          description: isAttending
            ? `Marked indent for ${mealConfig.name} on ${targetDate}`
            : `Skipped indent for ${mealConfig.name} on ${targetDate}`,
        },
      }),
    ]);

    // Real-time notification/SSE
    complaintEventsService.emitMessEventToStudent(studentId, {
      type: 'MESS_INDENT_UPDATED',
      studentId,
      date: targetDate,
      mealType: normalizedMeal,
      status: indentStatus,
      timestamp: lockedAt.toISOString(),
    });

    res.status(200).json({
      success: true,
      message: isAttending
        ? `Indent marked successfully for ${mealConfig.name} on ${targetDate}.`
        : `Meal marked as skipped for ${mealConfig.name} on ${targetDate}.`,
      indent: {
        id: savedIndent.id,
        studentId: savedIndent.studentId,
        date: savedIndent.date,
        mealType: savedIndent.mealType,
        mealName: mealConfig.name,
        status: savedIndent.status,
        indentMarked: isAttending,
        markedAt: savedIndent.updatedAt || savedIndent.createdAt,
      },
    });
  } catch (error: any) {
    console.error('Error marking mess indent:', error);
    res.status(500).json({ success: false, message: 'Unable to record mess indent. Please try again.' });
  }
});

/**
 * GET /api/student/mess/indent (and /api/student/mess-indent)
 * Student views their indent status for date / meals (Phase 2 & Phase 13)
 */
router.get(['/mess/indent', '/mess-indent'], authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const studentId = req.student.id;
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    const { date, mealType } = req.query;
    const targetDate = typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date.trim()) ? date.trim() : todayStr;

    const where: any = { studentId, date: targetDate };
    if (typeof mealType === 'string' && mealType.trim()) {
      where.mealType = mealType.trim().toUpperCase();
    }

    const [indents, tokens] = await Promise.all([
      prisma.messIndent.findMany({ where }),
      prisma.messToken.findMany({ where }),
    ]);

    const meals = MEAL_CONFIGS
      .filter((cfg) => !where.mealType || cfg.type === where.mealType)
      .map((cfg) => {
        const indentRecord = indents.find((i) => i.mealType === cfg.type);
        const tokenRecord = tokens.find((t) => t.mealType === cfg.type);

        const isIndentMarked = Boolean(
          (indentRecord && indentRecord.status === 'MARKED') ||
          (!indentRecord &&
            tokenRecord &&
            (tokenRecord.attendanceIntent === 'ATTENDING' ||
              tokenRecord.status === 'BOOKED' ||
              tokenRecord.status === 'CONSUMED'))
        );

        const markedAt = indentRecord
          ? indentRecord.createdAt
          : tokenRecord
            ? tokenRecord.createdAt
            : null;

        return {
          mealType: cfg.type,
          name: cfg.name,
          timing: cfg.timing,
          indentMarked: isIndentMarked,
          status: isIndentMarked ? 'MARKED' : 'NOT_MARKED',
          markedAt,
        };
      });

    res.json({
      success: true,
      date: targetDate,
      studentId,
      meals,
    });
  } catch (error: any) {
    console.error('Error fetching student indent status:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve indent status.' });
  }
});

export default router;
