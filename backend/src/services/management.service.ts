import { prisma } from './prisma.service';

export interface ResidentPresenceMetrics {
  totalResidents: number;
  totalStudents?: number;
  newStudentsThisWeek?: number;
  activeResidents: number;
  currentlyInside: number;
  currentlyOutside: number;
  onLeave: number;
  suspended: number;
}

export interface RoomOccupancyMetrics {
  totalRooms: number;
  occupied: number;
  partiallyOccupied: number;
  vacant: number;
  occupancyPercentage: number;
  totalCapacity: number;
  allocatedBeds: number;
}

export interface RequestMetrics {
  pendingOutings: number;
  approvedOutings: number;
  outOutings: number;
  pendingLeaves: number;
  activeLeaves: number;
  openComplaints: number;
  inProgressComplaints: number;
  resolvedComplaints: number;
  activeSuspensions: number;
  actionableTotal: number;
}

export interface AttentionItem {
  id: string;
  category: 'OUTING' | 'LEAVE' | 'COMPLAINT' | 'SUSPENSION';
  title: string;
  count: number;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  targetModule: string;
  isAvailable: boolean; // false until the target management module is built in future steps
}

export interface RecentActivityItem {
  id: string;
  activityType: string;
  description: string;
  timestamp: string;
  student?: {
    name: string;
    jntuNo: string;
    blockName?: string | null;
    roomNumber?: string | null;
  } | null;
}

export interface RecentBiometricLog {
  id: string;
  eventType: string;
  verificationStatus: string;
  eventTimestamp: string;
  gate?: string | null;
  student: {
    name: string;
    jntuNo: string;
  };
}

export interface ManagementDashboardData {
  residents: ResidentPresenceMetrics;
  rooms: RoomOccupancyMetrics;
  requests: RequestMetrics;
  attention: AttentionItem[];
  recentActivity: RecentActivityItem[];
  recentBiometricEvents: RecentBiometricLog[];
  systemStatus: {
    database: string;
    serverTime: string;
    biometricSync: string;
  };
}

export class ManagementService {
  /**
   * Authoritative calculation of operational management dashboard metrics
   */
  public async getDashboardData(hostelScope: 'BOYS' | 'GIRLS' | 'ALL' = 'ALL'): Promise<ManagementDashboardData> {
    const now = new Date();

    const studentWhere: any = {
      role: 'STUDENT',
      isActive: true,
    };
    if (hostelScope === 'BOYS') {
      studentWhere.blockName = { contains: 'Boys', mode: 'insensitive' };
    } else if (hostelScope === 'GIRLS') {
      studentWhere.blockName = { contains: 'Girls', mode: 'insensitive' };
    }

    // 1. Fetch Students (active in system)
    const students = await prisma.student.findMany({
      where: studentWhere,
      select: {
        id: true,
        name: true,
        jntuNo: true,
        allocationStatus: true,
        blockName: true,
        floorName: true,
        roomNumber: true,
        bedNumber: true,
        roomCapacity: true,
      },
    });

    const totalResidents = students.length;
    const allocatedStudents = students.filter((s) => s.allocationStatus === 'ALLOCATED');
    const activeResidents = allocatedStudents.length;

    // Calculate new students added within the last 7 days
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newStudentsThisWeek = await prisma.student.count({
      where: {
        ...studentWhere,
        createdAt: { gte: oneWeekAgo },
      },
    });

    // 2. Fetch Active Suspensions
    const activeSuspensionRecords = await prisma.suspension.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gte: now },
      },
    });
    const suspendedStudentIds = new Set(activeSuspensionRecords.map((s) => s.studentId));
    const suspended = suspendedStudentIds.size;

    // 3. Fetch Active Leaves
    // Status === 'APPROVED' and now is within [startDate, endDate]
    const activeLeaveRecords = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        startDate: { lte: now },
        endDate: { gte: now },
      },
    });
    const onLeaveStudentIds = new Set(activeLeaveRecords.map((l) => l.studentId));
    const onLeave = onLeaveStudentIds.size;

    // 4. Fetch Active Outings (status === 'OUT')
    const activeOutingRecords = await prisma.outingRequest.findMany({
      where: {
        status: 'OUT',
      },
    });
    const outOutingStudentIds = new Set(activeOutingRecords.map((o) => o.studentId));

    // 5. Semantic Presence (Inside vs Outside) derived from Biometric Events & States
    // For each student, find their latest verified biometric event
    let currentlyInside = 0;
    let currentlyOutside = 0;

    for (const student of students) {
      // If student is suspended or on leave or currently out on pass
      if (onLeaveStudentIds.has(student.id) || outOutingStudentIds.has(student.id)) {
        currentlyOutside++;
        continue;
      }

      // Query latest verified biometric event for this student
      const latestEvent = await prisma.biometricEvent.findFirst({
        where: {
          studentId: student.id,
          verificationStatus: 'VERIFIED',
        },
        orderBy: {
          eventTimestamp: 'desc',
        },
      });

      if (latestEvent) {
        if (latestEvent.eventType === 'ENTRY') {
          currentlyInside++;
        } else {
          currentlyOutside++;
        }
      } else {
        // Fallback for allocated student with no events yet: considered present in hostel
        if (student.allocationStatus === 'ALLOCATED') {
          currentlyInside++;
        } else {
          currentlyOutside++;
        }
      }
    }

    // 6. Authoritative Room Occupancy Calculation from PostgreSQL Room and RoomAllocation tables
    const roomWhere: any = {};
    if (hostelScope === 'BOYS') {
      roomWhere.block = { name: { contains: 'Boys', mode: 'insensitive' } };
    } else if (hostelScope === 'GIRLS') {
      roomWhere.block = { name: { contains: 'Girls', mode: 'insensitive' } };
    }

    const dbRooms = await prisma.room.findMany({
      where: roomWhere,
      include: {
        block: true,
        allocations: {
          where: { status: 'ACTIVE' },
        },
      },
    });

    let totalRooms = 0;
    let occupied = 0;
    let partiallyOccupied = 0;
    let vacant = 0;
    let totalCapacity = 0;
    let allocatedBeds = 0;

    if (dbRooms.length > 0) {
      totalRooms = dbRooms.length;
      for (const room of dbRooms) {
        totalCapacity += room.capacity;
        const occ = room.allocations.length;
        allocatedBeds += occ;

        if (occ >= room.capacity) {
          occupied++;
        } else if (occ > 0) {
          partiallyOccupied++;
        } else {
          vacant++;
        }
      }
    } else {
      // Fallback for un-migrated databases
      const allStudentRoomRecords = await prisma.student.findMany({
        where: {
          blockName: { not: null },
          roomNumber: { not: null },
        },
        select: {
          id: true,
          blockName: true,
          roomNumber: true,
          roomCapacity: true,
          allocationStatus: true,
          isActive: true,
        },
      });

      const roomMap = new Map<
        string,
        {
          blockName: string;
          roomNumber: string;
          capacity: number;
          occupants: number;
        }
      >();

      for (const rec of allStudentRoomRecords) {
        if (!rec.blockName || !rec.roomNumber) continue;
        const key = `${rec.blockName}__${rec.roomNumber}`;

        if (!roomMap.has(key)) {
          roomMap.set(key, {
            blockName: rec.blockName,
            roomNumber: rec.roomNumber,
            capacity: rec.roomCapacity || 2,
            occupants: 0,
          });
        }

        const roomEntry = roomMap.get(key)!;
        if (rec.allocationStatus === 'ALLOCATED' && rec.isActive) {
          roomEntry.occupants++;
        }
      }

      totalRooms = roomMap.size;
      for (const room of roomMap.values()) {
        totalCapacity += room.capacity;
        allocatedBeds += room.occupants;

        if (room.occupants >= room.capacity) {
          occupied++;
        } else if (room.occupants > 0) {
          partiallyOccupied++;
        } else {
          vacant++;
        }
      }
    }


    const occupancyPercentage =
      totalCapacity > 0 ? Math.round((allocatedBeds / totalCapacity) * 100) : 0;

    // 7. Request Pipeline Metrics
    const [
      pendingOutings,
      approvedOutings,
      outOutings,
      pendingLeaves,
      openComplaints,
      inProgressComplaints,
      resolvedComplaints,
      activeSuspensions,
    ] = await Promise.all([
      prisma.outingRequest.count({ where: { status: 'PENDING' } }),
      prisma.outingRequest.count({ where: { status: 'APPROVED' } }),
      prisma.outingRequest.count({ where: { status: 'OUT' } }),
      prisma.leaveRequest.count({ where: { status: 'PENDING' } }),
      prisma.complaint.count({ where: { status: 'OPEN' } }),
      prisma.complaint.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.complaint.count({ where: { status: 'RESOLVED' } }),
      prisma.suspension.count({ where: { status: 'ACTIVE' } }),
    ]);

    const actionableTotal = pendingOutings + pendingLeaves + openComplaints;

    // 8. Actionable Attention Items
    const attention: AttentionItem[] = [];

    if (pendingOutings > 0) {
      attention.push({
        id: 'outings-pending',
        category: 'OUTING',
        title: 'Pending Outing Approvals',
        count: pendingOutings,
        urgency: 'HIGH',
        description: `${pendingOutings} gate pass request${pendingOutings > 1 ? 's' : ''} awaiting warden authorization before curfew.`,
        targetModule: '/management/outings',
        isAvailable: false,
      });
    }

    if (pendingLeaves > 0) {
      attention.push({
        id: 'leaves-pending',
        category: 'LEAVE',
        title: 'Pending Leave Applications',
        count: pendingLeaves,
        urgency: 'HIGH',
        description: `${pendingLeaves} temporary leave application${pendingLeaves > 1 ? 's' : ''} requiring parent verification and sign-off.`,
        targetModule: '/management/leaves',
        isAvailable: false,
      });
    }

    if (openComplaints > 0) {
      attention.push({
        id: 'complaints-open',
        category: 'COMPLAINT',
        title: 'Unresolved Complaints',
        count: openComplaints,
        urgency: openComplaints > 5 ? 'HIGH' : 'MEDIUM',
        description: `${openComplaints} reported hostel facility ticket${openComplaints > 1 ? 's' : ''} awaiting technician assignment or resolution.`,
        targetModule: '/management/maintenance',
        isAvailable: false,
      });
    }

    if (activeSuspensions > 0) {
      attention.push({
        id: 'suspensions-active',
        category: 'SUSPENSION',
        title: 'Active Disciplinary Suspensions',
        count: activeSuspensions,
        urgency: 'MEDIUM',
        description: `${activeSuspensions} resident${activeSuspensions > 1 ? 's' : ''} under administrative disciplinary sanctions.`,
        targetModule: '/management/leaves',
        isAvailable: false,
      });
    }

    // 9. Recent Real Activity Records
    const rawActivityLogs = await prisma.activityLog.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        student: {
          select: {
            name: true,
            jntuNo: true,
            blockName: true,
            roomNumber: true,
          },
        },
      },
    });

    const recentActivity: RecentActivityItem[] = rawActivityLogs.map((log) => ({
      id: log.id,
      activityType: log.actionType,
      description: log.description,
      timestamp: log.createdAt.toISOString(),
      student: log.student
        ? {
            name: log.student.name,
            jntuNo: log.student.jntuNo,
            blockName: log.student.blockName,
            roomNumber: log.student.roomNumber,
          }
        : null,
    }));

    // 10. Recent Biometric Events
    const rawBiometricEvents = await prisma.biometricEvent.findMany({
      take: 5,
      orderBy: {
        eventTimestamp: 'desc',
      },
      include: {
        student: {
          select: {
            name: true,
            jntuNo: true,
          },
        },
      },
    });

    const recentBiometricEvents: RecentBiometricLog[] = rawBiometricEvents.map((ev) => ({
      id: ev.id,
      eventType: ev.eventType,
      verificationStatus: ev.verificationStatus,
      eventTimestamp: ev.eventTimestamp.toISOString(),
      gate: ev.gate,
      student: {
        name: ev.student.name,
        jntuNo: ev.student.jntuNo,
      },
    }));

    return {
      residents: {
        totalResidents,
        totalStudents: totalResidents,
        newStudentsThisWeek,
        activeResidents,
        currentlyInside,
        currentlyOutside,
        onLeave,
        suspended,
      },
      rooms: {
        totalRooms,
        occupied,
        partiallyOccupied,
        vacant,
        occupancyPercentage,
        totalCapacity,
        allocatedBeds,
      },
      requests: {
        pendingOutings,
        approvedOutings,
        outOutings,
        pendingLeaves,
        activeLeaves: onLeave,
        openComplaints,
        inProgressComplaints,
        resolvedComplaints,
        activeSuspensions,
        actionableTotal,
      },
      attention,
      recentActivity,
      recentBiometricEvents,
      systemStatus: {
        database: 'CONNECTED_POSTGRESQL',
        serverTime: now.toISOString(),
        biometricSync: 'ACTIVE',
      },
    };
  }
}

export const managementService = new ManagementService();
