import { Prisma } from '@prisma/client';
import { prisma } from './prisma.service';

export interface OutingLogHistoryQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  studentId?: string;
  requestNumber?: string;
  movementType?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
}

export interface OutingLogItem {
  id: string;
  requestNumber: string;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    blockName: string | null;
    roomNumber: string | null;
    bedNumber: string | null;
  };
  passType: string;
  destination: string | null;
  purpose: string;
  outDate: string;
  returnDate: string;
  actualExitTime: string | null;
  actualReturnTime: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  status: string;
  rawStatus: string;
  movementType: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXIT' | 'RETURN' | 'CANCELLED';
  source: 'BIOMETRIC_DEVICE' | 'MANUAL_GATE' | 'STUDENT_PORTAL' | 'MANAGEMENT_PORTAL';
  recordedBy: string;
  eventTimestamp: string;
  createdAt: string;
  updatedAt: string;
}

export class OutingLogHistoryService {
  /**
   * Authoritative Outing Log History query with KPI statistics and filters
   */
  public async getOutingLogHistory(query: OutingLogHistoryQuery) {
    const pageNum = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize || query.limit) || 25));
    const skip = (pageNum - 1) * pageSize;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // Calculate live authoritative KPI statistics
    const [todayRequests, todayApproved, todayExits, todayReturns, currentlyOutside] = await Promise.all([
      prisma.outingRequest.count({
        where: { createdAt: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.outingRequest.count({
        where: { approvedAt: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.outingRequest.count({
        where: { actualExitTime: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.outingRequest.count({
        where: { actualReturnTime: { gte: startOfToday, lte: endOfToday } },
      }),
      prisma.outingRequest.count({
        where: { status: { in: ['OUT', 'ACTIVE'] } },
      }),
    ]);

    // Build Prisma query filter
    const where: Prisma.OutingRequestWhereInput = {};

    if (query.studentId) {
      where.studentId = query.studentId;
    }

    if (query.requestNumber && query.requestNumber.trim()) {
      where.requestNumber = { contains: query.requestNumber.trim(), mode: 'insensitive' };
    }

    if (query.status && query.status !== 'ALL') {
      const targetStatus = query.status.toUpperCase();
      if (targetStatus === 'ACTIVE') {
        where.status = { in: ['OUT', 'ACTIVE'] };
      } else {
        where.status = targetStatus;
      }
    }

    // Date range filters
    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) {
        const fromDate = new Date(query.from);
        if (!isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }
      if (query.to) {
        const toDate = new Date(query.to);
        if (!isNaN(toDate.getTime())) {
          if (query.to.length <= 10) {
            toDate.setHours(23, 59, 59, 999);
          }
          where.createdAt.lte = toDate;
        }
      }
    }

    // Search query: student name, JNTU number, requestNumber, destination
    if (query.search && query.search.trim()) {
      const s = query.search.trim();
      where.OR = [
        { requestNumber: { contains: s, mode: 'insensitive' } },
        { destination: { contains: s, mode: 'insensitive' } },
        { purpose: { contains: s, mode: 'insensitive' } },
        {
          student: {
            OR: [
              { name: { contains: s, mode: 'insensitive' } },
              { jntuNo: { contains: s, mode: 'insensitive' } },
              { email: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    // Movement type filter
    if (query.movementType && query.movementType !== 'ALL') {
      const mType = query.movementType.toUpperCase();
      if (mType === 'RETURN') {
        where.actualReturnTime = { not: null };
      } else if (mType === 'EXIT') {
        where.actualExitTime = { not: null };
        where.actualReturnTime = null;
      } else if (mType === 'APPROVED') {
        where.status = 'APPROVED';
        where.actualExitTime = null;
      } else if (mType === 'REJECTED') {
        where.status = 'REJECTED';
      } else if (mType === 'REQUESTED') {
        where.status = 'PENDING';
      } else if (mType === 'CANCELLED') {
        where.status = 'CANCELLED';
      }
    }

    // Fetch total and paginated records
    const [total, requests] = await Promise.all([
      prisma.outingRequest.count({ where }),
      prisma.outingRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ createdAt: 'desc' }],
        include: {
          student: {
            include: {
              roomAllocations: {
                where: { status: 'ACTIVE' },
                include: { room: { include: { block: true } } },
                take: 1,
              },
            },
          },
        },
      }),
    ]);

    // Format output and determine movement type & source
    const items: OutingLogItem[] = requests.map((req) => {
      const activeAlloc = req.student?.roomAllocations?.[0];
      const blockName = activeAlloc?.room?.block?.name || req.student?.blockName || null;
      const roomNumber = activeAlloc?.room?.roomNumber || req.student?.roomNumber || null;
      const bedNumber = activeAlloc?.bedNumber || req.student?.bedNumber || null;

      // Authoritative latest movement categorization
      let movementType: OutingLogItem['movementType'] = 'REQUESTED';
      let source: OutingLogItem['source'] = 'STUDENT_PORTAL';
      let recordedBy = req.student?.name || 'Student';
      let eventTimestamp = req.createdAt.toISOString();

      if (req.actualReturnTime) {
        movementType = 'RETURN';
        source = 'BIOMETRIC_DEVICE';
        recordedBy = 'Biometric Gate Sensor';
        eventTimestamp = req.actualReturnTime.toISOString();
      } else if (req.actualExitTime) {
        movementType = 'EXIT';
        source = 'BIOMETRIC_DEVICE';
        recordedBy = 'Biometric Gate Sensor';
        eventTimestamp = req.actualExitTime.toISOString();
      } else if (req.status === 'APPROVED' && req.approvedAt) {
        movementType = 'APPROVED';
        source = 'MANAGEMENT_PORTAL';
        recordedBy = req.approvedBy || 'Hostel Warden';
        eventTimestamp = req.approvedAt.toISOString();
      } else if (req.status === 'REJECTED' && req.rejectedAt) {
        movementType = 'REJECTED';
        source = 'MANAGEMENT_PORTAL';
        recordedBy = req.rejectedBy || 'Hostel Warden';
        eventTimestamp = req.rejectedAt.toISOString();
      } else if (req.status === 'CANCELLED') {
        movementType = 'CANCELLED';
        source = 'STUDENT_PORTAL';
        recordedBy = req.student?.name || 'Student';
        eventTimestamp = req.updatedAt.toISOString();
      }

      return {
        id: req.id,
        requestNumber: req.requestNumber || `REQ-${req.id.slice(0, 8)}`,
        student: {
          id: req.student?.id || req.studentId,
          name: req.student?.name || 'Unknown Student',
          jntuNo: req.student?.jntuNo || 'N/A',
          email: req.student?.email || 'N/A',
          blockName,
          roomNumber,
          bedNumber,
        },
        passType: req.passType,
        destination: req.destination,
        purpose: req.purpose,
        outDate: req.outDate.toISOString(),
        returnDate: req.returnDate.toISOString(),
        actualExitTime: req.actualExitTime?.toISOString() || null,
        actualReturnTime: req.actualReturnTime?.toISOString() || null,
        approvedAt: req.approvedAt?.toISOString() || null,
        approvedBy: req.approvedBy || null,
        rejectedAt: req.rejectedAt?.toISOString() || null,
        rejectedBy: req.rejectedBy || null,
        rejectionReason: req.rejectionReason || null,
        status: req.status === 'OUT' ? 'ACTIVE' : req.status,
        rawStatus: req.status,
        movementType,
        source,
        recordedBy,
        eventTimestamp,
        createdAt: req.createdAt.toISOString(),
        updatedAt: req.updatedAt.toISOString(),
      };
    });

    // Post-filter by source if specified and not ALL
    let filteredItems = items;
    if (query.source && query.source !== 'ALL') {
      filteredItems = items.filter((it) => it.source === query.source);
    }

    return {
      records: filteredItems,
      stats: {
        todayRequests,
        todayApproved,
        todayExits,
        todayReturns,
        currentlyOutside,
      },
      pagination: {
        page: pageNum,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize) || 1,
      },
    };
  }

  /**
   * Authoritative Single Outing Log Detail with Full Lifecycle Timeline
   */
  public async getOutingLogDetail(id: string) {
    const outing = await prisma.outingRequest.findUnique({
      where: { id },
      include: {
        student: {
          include: {
            roomAllocations: {
              where: { status: 'ACTIVE' },
              include: { room: { include: { block: true } } },
              take: 1,
            },
          },
        },
      },
    });

    if (!outing) {
      throw new Error('OUTING_NOT_FOUND');
    }

    const activeAlloc = outing.student?.roomAllocations?.[0];

    // Correlated Biometric Transit Events
    const outDateObj = new Date(outing.outDate);
    const biometricEvents = await prisma.biometricEvent.findMany({
      where: {
        studentId: outing.studentId,
        eventTimestamp: {
          gte: new Date(outDateObj.getTime() - 24 * 60 * 60 * 1000),
          lte: new Date(outing.returnDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { eventTimestamp: 'desc' },
      take: 10,
    });

    // Associated Activity Logs
    const activityLogs = await prisma.activityLog.findMany({
      where: {
        studentId: outing.studentId,
        actionType: 'OUTING',
        OR: [
          { entityId: outing.id },
          { description: { contains: outing.requestNumber || outing.id } },
        ],
      },
      orderBy: { createdAt: 'asc' },
    });

    // Construct Visual Lifecycle Timeline
    const timeline = [
      {
        stage: 'REQUESTED',
        label: 'Outing Requested',
        status: 'COMPLETED',
        timestamp: outing.createdAt.toISOString(),
        actor: outing.student?.name || 'Student',
        source: 'STUDENT_PORTAL',
        details: `Pass type: ${outing.passType}. Destination: ${outing.destination || 'N/A'}. Purpose: ${outing.purpose}.`,
      },
    ];

    if (outing.status === 'APPROVED' || outing.approvedAt || outing.status === 'OUT' || outing.status === 'RETURNED') {
      timeline.push({
        stage: 'APPROVED',
        label: 'Warden Approval',
        status: 'COMPLETED',
        timestamp: outing.approvedAt ? outing.approvedAt.toISOString() : outing.updatedAt.toISOString(),
        actor: outing.approvedBy || 'Hostel Warden',
        source: 'MANAGEMENT_PORTAL',
        details: 'Outing pass sanctioned. Student authorized for gate passage.',
      });
    } else if (outing.status === 'REJECTED' || outing.rejectedAt) {
      timeline.push({
        stage: 'REJECTED',
        label: 'Request Rejected',
        status: 'REJECTED',
        timestamp: outing.rejectedAt ? outing.rejectedAt.toISOString() : outing.updatedAt.toISOString(),
        actor: outing.rejectedBy || 'Hostel Warden',
        source: 'MANAGEMENT_PORTAL',
        details: outing.rejectionReason || 'No reason specified',
      });
    } else if (outing.status === 'CANCELLED') {
      timeline.push({
        stage: 'CANCELLED',
        label: 'Request Cancelled',
        status: 'CANCELLED',
        timestamp: outing.updatedAt.toISOString(),
        actor: outing.student?.name || 'Student',
        source: 'STUDENT_PORTAL',
        details: 'Cancelled by student prior to approval.',
      });
    } else {
      timeline.push({
        stage: 'PENDING_APPROVAL',
        label: 'Awaiting Warden Decision',
        status: 'PENDING',
        timestamp: null as any,
        actor: 'Assigned Warden',
        source: 'MANAGEMENT_PORTAL',
        details: 'Request is pending review by hostel administration.',
      });
    }

    // Physical Movement 1: EXIT
    if (outing.actualExitTime) {
      timeline.push({
        stage: 'EXIT',
        label: 'Physical Gate Exit Confirmed',
        status: 'COMPLETED',
        timestamp: outing.actualExitTime.toISOString(),
        actor: 'Biometric Turnstile / Security Gate',
        source: 'BIOMETRIC_DEVICE',
        details: `Student physically departed hostel premises at ${new Date(outing.actualExitTime).toLocaleTimeString('en-IN')}.`,
      });
    } else if (outing.status === 'APPROVED') {
      timeline.push({
        stage: 'EXIT_PENDING',
        label: 'Physical Exit Pending',
        status: 'PENDING',
        timestamp: null as any,
        actor: 'Hostel Exit Gate',
        source: 'BIOMETRIC_DEVICE',
        details: 'Student has not passed through the physical exit gate.',
      });
    }

    // Physical Movement 2: RETURN
    if (outing.actualReturnTime) {
      timeline.push({
        stage: 'RETURN',
        label: 'Physical Return Confirmed',
        status: 'COMPLETED',
        timestamp: outing.actualReturnTime.toISOString(),
        actor: 'Biometric Turnstile / Security Gate',
        source: 'BIOMETRIC_DEVICE',
        details: `Student physically returned and verified at ${new Date(outing.actualReturnTime).toLocaleTimeString('en-IN')}.`,
      });
    } else if (outing.status === 'OUT' || outing.actualExitTime) {
      timeline.push({
        stage: 'RETURN_PENDING',
        label: 'Currently Outside / Return Pending',
        status: 'ACTIVE',
        timestamp: null as any,
        actor: 'Hostel Entry Gate',
        source: 'BIOMETRIC_DEVICE',
        details: `Expected return by ${new Date(outing.returnDate).toLocaleString('en-IN')}.`,
      });
    }

    return {
      outing: {
        id: outing.id,
        requestNumber: outing.requestNumber || `REQ-${outing.id.slice(0, 8)}`,
        passType: outing.passType,
        destination: outing.destination,
        purpose: outing.purpose,
        emergencyContact: outing.emergencyContact,
        remarks: outing.remarks,
        outDate: outing.outDate.toISOString(),
        returnDate: outing.returnDate.toISOString(),
        actualExitTime: outing.actualExitTime?.toISOString() || null,
        actualReturnTime: outing.actualReturnTime?.toISOString() || null,
        approvedAt: outing.approvedAt?.toISOString() || null,
        approvedBy: outing.approvedBy || null,
        rejectedAt: outing.rejectedAt?.toISOString() || null,
        rejectedBy: outing.rejectedBy || null,
        rejectionReason: outing.rejectionReason || null,
        status: outing.status === 'OUT' ? 'ACTIVE' : outing.status,
        rawStatus: outing.status,
        createdAt: outing.createdAt.toISOString(),
        updatedAt: outing.updatedAt.toISOString(),
      },
      student: outing.student
        ? {
            id: outing.student.id,
            name: outing.student.name,
            jntuNo: outing.student.jntuNo,
            email: outing.student.email,
            blockName: activeAlloc?.room?.block?.name || outing.student.blockName || null,
            roomNumber: activeAlloc?.room?.roomNumber || outing.student.roomNumber || null,
            bedNumber: activeAlloc?.bedNumber || outing.student.bedNumber || null,
            roomType: activeAlloc?.room?.roomType || outing.student.roomType || null,
          }
        : null,
      timeline,
      biometricEvents: biometricEvents.map((ev) => ({
        id: ev.id,
        eventType: ev.eventType,
        verificationStatus: ev.verificationStatus,
        gate: ev.gate,
        source: ev.source,
        eventTimestamp: ev.eventTimestamp.toISOString(),
      })),
      activityLogs: activityLogs.map((log) => ({
        id: log.id,
        action: log.action,
        actorRole: log.actorRole,
        description: log.description,
        createdAt: log.createdAt.toISOString(),
      })),
    };
  }
}

export const outingLogHistoryService = new OutingLogHistoryService();
