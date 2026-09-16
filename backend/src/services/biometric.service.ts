import { prisma } from './prisma.service';
import { complaintEventsService } from './events.service';
import { deviceService } from './device.service';

export interface TodayBiometricStatus {
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  statusLabel: string;
  firstEntry: Date | null;
  lastExit: Date | null;
  entryCount: number;
  exitCount: number;
  latestEvent: any | null;
  approximateHoursInside: number;
}

export interface ListEventsOptions {
  page?: number;
  limit?: number;
  dateRange?: string; // 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'CUSTOM' | 'ALL'
  startDate?: string;
  endDate?: string;
  eventType?: string; // 'ALL' | 'ENTRY' | 'EXIT'
  verificationStatus?: string; // 'ALL' | 'VERIFIED' | 'REJECTED'
}

export interface DailySummaryItem {
  date: string; // YYYY-MM-DD
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  firstEntry: string | null;
  lastExit: string | null;
  entryCount: number;
  exitCount: number;
  totalEvents: number;
  approximateHoursInside: number;
}

export interface IngestBiometricEventDto {
  studentId: string;
  eventType: 'ENTRY' | 'EXIT';
  direction?: 'IN' | 'OUT';
  verificationStatus?: 'VERIFIED' | 'REJECTED';
  eventTimestamp?: Date | string;
  source?: string;
  gate?: string;
  deviceId?: string;
  deviceLabel?: string;
  rejectionReason?: string;
  metadata?: any;
}

export class BiometricService {
  /**
   * Calculates authoritative today's biometric presence and summary for a student.
   */
  public async getTodayStatus(studentId: string): Promise<{
    today: TodayBiometricStatus;
    todayEvents: any[];
  }> {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Fetch all today's events for this student
    const todayEvents = await prisma.biometricEvent.findMany({
      where: {
        studentId,
        eventTimestamp: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        eventTimestamp: 'asc',
      },
    });

    const verifiedEvents = todayEvents.filter((e) => e.verificationStatus === 'VERIFIED');

    let firstEntry: Date | null = null;
    let lastExit: Date | null = null;
    let entryCount = 0;
    let exitCount = 0;

    for (const ev of verifiedEvents) {
      if (ev.eventType === 'ENTRY') {
        entryCount++;
        if (!firstEntry) firstEntry = ev.eventTimestamp;
      } else if (ev.eventType === 'EXIT') {
        exitCount++;
        lastExit = ev.eventTimestamp;
      }
    }

    const latestVerifiedEvent = verifiedEvents.length > 0 ? verifiedEvents[verifiedEvents.length - 1] : null;

    let status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD' = 'NO_RECORD';
    let statusLabel = 'No Record Today';

    if (latestVerifiedEvent) {
      if (latestVerifiedEvent.eventType === 'ENTRY') {
        status = 'INSIDE_HOSTEL';
        statusLabel = 'Present / Inside Hostel';
      } else if (latestVerifiedEvent.eventType === 'EXIT') {
        status = 'OUTSIDE_HOSTEL';
        statusLabel = 'Outside Hostel';
      }
    }

    // Calculate approximate hours inside today
    let totalMillisInside = 0;
    let currentEntryTime: Date | null = null;

    for (const ev of verifiedEvents) {
      if (ev.eventType === 'ENTRY') {
        currentEntryTime = ev.eventTimestamp;
      } else if (ev.eventType === 'EXIT') {
        if (currentEntryTime) {
          const duration = ev.eventTimestamp.getTime() - currentEntryTime.getTime();
          if (duration > 0) {
            totalMillisInside += duration;
          }
          currentEntryTime = null;
        }
      }
    }

    // If currently inside (last was ENTRY with no EXIT), add elapsed time until now
    if (currentEntryTime) {
      const duration = Math.min(now.getTime(), endOfDay.getTime()) - currentEntryTime.getTime();
      if (duration > 0) {
        totalMillisInside += duration;
      }
    }

    const approximateHoursInside = Math.round((totalMillisInside / (1000 * 60 * 60)) * 10) / 10;

    // Return today's events sorted descending for UI timeline
    const sortedTodayEvents = [...todayEvents].sort(
      (a, b) => b.eventTimestamp.getTime() - a.eventTimestamp.getTime()
    );

    return {
      today: {
        status,
        statusLabel,
        firstEntry,
        lastExit,
        entryCount,
        exitCount,
        latestEvent: latestVerifiedEvent,
        approximateHoursInside,
      },
      todayEvents: sortedTodayEvents,
    };
  }

  /**
   * Retrieves a paginated, filterable list of biometric events for an authenticated student.
   */
  public async listEvents(
    studentId: string,
    options: ListEventsOptions = {}
  ): Promise<{
    events: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;

    const whereClause: any = {
      studentId,
    };

    // Date range filter
    const now = new Date();
    if (options.dateRange === 'TODAY') {
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      whereClause.eventTimestamp = { gte: startOfDay };
    } else if (options.dateRange === 'LAST_7_DAYS') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      whereClause.eventTimestamp = { gte: sevenDaysAgo };
    } else if (options.dateRange === 'LAST_30_DAYS') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      whereClause.eventTimestamp = { gte: thirtyDaysAgo };
    } else if (options.dateRange === 'CUSTOM' && (options.startDate || options.endDate)) {
      whereClause.eventTimestamp = {};
      if (options.startDate) {
        const start = new Date(options.startDate);
        if (!isNaN(start.getTime())) {
          whereClause.eventTimestamp.gte = start;
        }
      }
      if (options.endDate) {
        const end = new Date(options.endDate);
        if (!isNaN(end.getTime())) {
          end.setHours(23, 59, 59, 999);
          whereClause.eventTimestamp.lte = end;
        }
      }
    }

    // Event type filter
    if (options.eventType && options.eventType !== 'ALL') {
      whereClause.eventType = options.eventType.toUpperCase();
    }

    // Verification status filter
    if (options.verificationStatus && options.verificationStatus !== 'ALL') {
      whereClause.verificationStatus = options.verificationStatus.toUpperCase();
    }

    const [total, events] = await Promise.all([
      prisma.biometricEvent.count({ where: whereClause }),
      prisma.biometricEvent.findMany({
        where: whereClause,
        orderBy: { eventTimestamp: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  }

  /**
   * Aggregates daily attendance summaries for the last N days (default 7).
   */
  public async getDailySummaries(studentId: string, days: number = 7): Promise<DailySummaryItem[]> {
    const safeDays = Math.min(30, Math.max(1, days));
    const now = new Date();
    const startDate = new Date(now.getTime() - safeDays * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    const events = await prisma.biometricEvent.findMany({
      where: {
        studentId,
        eventTimestamp: { gte: startDate },
      },
      orderBy: { eventTimestamp: 'asc' },
    });

    // Group by YYYY-MM-DD
    const dayMap = new Map<string, any[]>();
    for (let i = 0; i < safeDays; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().split('T')[0];
      dayMap.set(key, []);
    }

    for (const ev of events) {
      const key = ev.eventTimestamp.toISOString().split('T')[0];
      if (dayMap.has(key)) {
        dayMap.get(key)!.push(ev);
      }
    }

    const result: DailySummaryItem[] = [];

    for (const [dateStr, dayEvents] of dayMap.entries()) {
      const verified = dayEvents.filter((e) => e.verificationStatus === 'VERIFIED');
      let firstEntry: string | null = null;
      let lastExit: string | null = null;
      let entryCount = 0;
      let exitCount = 0;

      for (const ev of verified) {
        if (ev.eventType === 'ENTRY') {
          entryCount++;
          if (!firstEntry) firstEntry = ev.eventTimestamp.toISOString();
        } else if (ev.eventType === 'EXIT') {
          exitCount++;
          lastExit = ev.eventTimestamp.toISOString();
        }
      }

      let status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD' = 'NO_RECORD';
      if (verified.length > 0) {
        const last = verified[verified.length - 1];
        status = last.eventType === 'ENTRY' ? 'INSIDE_HOSTEL' : 'OUTSIDE_HOSTEL';
      }

      // Compute approximate hours inside
      let millisInside = 0;
      let entryRef: Date | null = null;
      for (const ev of verified) {
        if (ev.eventType === 'ENTRY') {
          entryRef = ev.eventTimestamp;
        } else if (ev.eventType === 'EXIT' && entryRef) {
          const diff = ev.eventTimestamp.getTime() - entryRef.getTime();
          if (diff > 0) millisInside += diff;
          entryRef = null;
        }
      }

      const approximateHoursInside = Math.round((millisInside / (1000 * 60 * 60)) * 10) / 10;

      result.push({
        date: dateStr,
        status,
        firstEntry,
        lastExit,
        entryCount,
        exitCount,
        totalEvents: dayEvents.length,
        approximateHoursInside,
      });
    }

    // Sort newest date first
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Retrieves an individual biometric event, strictly enforcing student ownership.
   */
  public async getEventById(studentId: string, eventId: string): Promise<any> {
    const event = await prisma.biometricEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      const error: any = new Error('Biometric event not found.');
      error.statusCode = 404;
      throw error;
    }

    if (event.studentId !== studentId) {
      const error: any = new Error('Access denied: You cannot view another student’s biometric records.');
      error.statusCode = 403;
      throw error;
    }

    return event;
  }

  /**
   * Ingests a new biometric event authoritatively from physical gate / device / internal ingestion.
   * Handles idempotency, Outing pass correlation, and real-time SSE dispatch.
   */
  public async recordIngestedEvent(dto: IngestBiometricEventDto): Promise<any> {
    // 1. Validate student exists
    const student = await prisma.student.findUnique({
      where: { id: dto.studentId },
    });
    if (!student || !student.isActive) {
      return { event: null, isDuplicate: true };
    }

    // 2. Validate event parameters
    const eventType = dto.eventType?.toUpperCase();
    if (eventType !== 'ENTRY' && eventType !== 'EXIT') {
      const err: any = new Error('Invalid eventType. Must be ENTRY or EXIT.');
      err.statusCode = 400;
      throw err;
    }

    const verificationStatus = (dto.verificationStatus || 'VERIFIED').toUpperCase();
    if (verificationStatus !== 'VERIFIED' && verificationStatus !== 'REJECTED') {
      const err: any = new Error('Invalid verificationStatus. Must be VERIFIED or REJECTED.');
      err.statusCode = 400;
      throw err;
    }

    const direction = dto.direction || (eventType === 'ENTRY' ? 'IN' : 'OUT');

    let eventTimestamp = dto.eventTimestamp ? new Date(dto.eventTimestamp) : new Date();
    if (isNaN(eventTimestamp.getTime())) {
      const err: any = new Error('Invalid event timestamp.');
      err.statusCode = 400;
      throw err;
    }

    // Clock skew check: Reject timestamps more than 5 minutes in the future
    const now = new Date();
    if (eventTimestamp.getTime() > now.getTime() + 5 * 60 * 1000) {
      const err: any = new Error('Impossible future timestamp detected.');
      err.statusCode = 400;
      throw err;
    }

    // 3. Idempotency / duplicate check (events for same student, type, device within 5 seconds)
    const recentDuplicate = await prisma.biometricEvent.findFirst({
      where: {
        studentId: dto.studentId,
        eventType,
        deviceId: dto.deviceId || null,
        eventTimestamp: {
          gte: new Date(eventTimestamp.getTime() - 5000),
          lte: new Date(eventTimestamp.getTime() + 5000),
        },
      },
    });

    if (recentDuplicate) {
      return {
        event: recentDuplicate,
        isDuplicate: true,
      };
    }

    // 4. PostgreSQL Transaction: Record Event + ActivityLog + Outing correlation
    const result = await prisma.$transaction(async (tx) => {
      const createdEvent = await tx.biometricEvent.create({
        data: {
          studentId: dto.studentId,
          eventType,
          direction,
          verificationStatus,
          eventTimestamp,
          source: dto.source || 'BIOMETRIC_DEVICE',
          gate: dto.gate || 'Main Gate',
          deviceId: dto.deviceId || null,
          deviceLabel: dto.deviceLabel || null,
          rejectionReason: dto.rejectionReason || null,
          metadata: dto.metadata ? JSON.stringify(dto.metadata) : null,
        },
      });

      // Audit log
      await tx.activityLog.create({
        data: {
          studentId: dto.studentId,
          actionType: 'ROOM', // or general entry
          description: `Biometric ${eventType} recorded at ${dto.gate || 'gate'} (${verificationStatus}).`,
        },
      });

      // Outing Lifecycle Correlation (Only for verified physical transits)
      let correlatedOutingInfo: { outingId: string; type: 'OUTING_EXIT_CONFIRMED' | 'OUTING_RETURN_CONFIRMED'; status: string } | null = null;
      if (verificationStatus === 'VERIFIED') {
        if (eventType === 'EXIT') {
          // If student has an APPROVED outing, activate it to OUT with actualExitTime
          const approvedOuting = await tx.outingRequest.findFirst({
            where: {
              studentId: dto.studentId,
              status: 'APPROVED',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (approvedOuting) {
            await tx.outingRequest.update({
              where: { id: approvedOuting.id },
              data: {
                status: 'OUT',
                actualExitTime: eventTimestamp,
              },
            });

            await tx.activityLog.create({
              data: {
                studentId: dto.studentId,
                actionType: 'OUTING',
                description: `Outing pass #${approvedOuting.requestNumber || approvedOuting.id} marked OUT via biometric exit gate.`,
              },
            });

            correlatedOutingInfo = {
              outingId: approvedOuting.id,
              type: 'OUTING_EXIT_CONFIRMED',
              status: 'OUT',
            };
          }
        } else if (eventType === 'ENTRY') {
          // If student has an OUT outing, complete it to RETURNED with actualReturnTime
          const activeOuting = await tx.outingRequest.findFirst({
            where: {
              studentId: dto.studentId,
              status: 'OUT',
            },
            orderBy: { createdAt: 'desc' },
          });

          if (activeOuting) {
            await tx.outingRequest.update({
              where: { id: activeOuting.id },
              data: {
                status: 'RETURNED',
                actualReturnTime: eventTimestamp,
              },
            });

            await tx.activityLog.create({
              data: {
                studentId: dto.studentId,
                actionType: 'OUTING',
                description: `Outing pass #${activeOuting.requestNumber || activeOuting.id} marked RETURNED via biometric entry gate.`,
              },
            });

            correlatedOutingInfo = {
              outingId: activeOuting.id,
              type: 'OUTING_RETURN_CONFIRMED',
              status: 'RETURNED',
            };
          }
        }
      }

      return { createdEvent, correlatedOutingInfo };
    });

    // 5. Emit Real-time SSE Domain Event to student
    complaintEventsService.emitBiometricEventToStudent(dto.studentId, {
      type: 'BIOMETRIC_EVENT_RECORDED',
      eventId: result.createdEvent.id,
      eventType: result.createdEvent.eventType,
      status: result.createdEvent.verificationStatus,
      gate: result.createdEvent.gate,
      timestamp: result.createdEvent.eventTimestamp.toISOString(),
    });

    // 6. If an outing was correlated, emit outing domain event after commit
    if (result.correlatedOutingInfo) {
      complaintEventsService.emitOutingEventToStudent(dto.studentId, {
        type: result.correlatedOutingInfo.type,
        outingId: result.correlatedOutingInfo.outingId,
        studentId: dto.studentId,
        status: result.correlatedOutingInfo.status,
        timestamp: result.createdEvent.eventTimestamp.toISOString(),
        details: {
          gate: result.createdEvent.gate,
          source: result.createdEvent.source,
        },
      });
    }

    // 7. Update device last seen timestamp if deviceId is provided
    if (dto.deviceId) {
      deviceService.updateDeviceLastSeen(dto.deviceId).catch(() => {});
    }

    return {
      event: result.createdEvent,
      isDuplicate: false,
    };
  }
}

export const biometricService = new BiometricService();
