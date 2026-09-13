import { Prisma } from '@prisma/client';
import { prisma } from './prisma.service';
import { complaintEventsService, NotificationDomainEvent } from './events.service';
import { auditService, sanitizeAuditMetadata } from './audit.service';

export const VALID_NOTIFICATION_CATEGORIES = [
  'OUTING',
  'LEAVE',
  'COMPLAINT',
  'MESS',
  'SUSPENSION',
  'ROOM',
  'SYSTEM',
  'ANNOUNCEMENT',
  'BIOMETRIC',
  'FEE',
  'DEVICE',
] as const;

export type NotificationCategory = (typeof VALID_NOTIFICATION_CATEGORIES)[number];

export const VALID_NOTIFICATION_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;
export type NotificationPriority = (typeof VALID_NOTIFICATION_PRIORITIES)[number];

export const VALID_NOTIFICATION_SCOPES = [
  'ALL_STUDENTS',
  'INDIVIDUAL',
  'MULTIPLE',
  'BLOCK',
  'ROOM',
  'ROLE',
] as const;
export type NotificationScope = (typeof VALID_NOTIFICATION_SCOPES)[number];

export interface CreateNotificationInput {
  studentId: string;
  title: string;
  message: string;
  type?: 'INFO' | 'WARNING' | 'SUCCESS';
  category?: NotificationCategory;
  priority?: NotificationPriority;
  source?: string;
  createdBy?: string;
  entityId?: string;
  link?: string;
  expiresAt?: string | Date | null;
  metadata?: Record<string, any>;
}

export interface ListNotificationsOptions {
  page?: number;
  limit?: number;
  category?: string;
  unreadOnly?: boolean;
}

export interface AdminSendNotificationInput {
  title: string;
  message: string;
  category: string;
  priority?: string;
  type?: string;
  recipientScope: string;
  studentId?: string;
  studentIds?: string[];
  blockName?: string;
  roomNumber?: string;
  targetRole?: string;
  link?: string;
  expiresAt?: string | Date;
  metadata?: Record<string, any>;
}

export interface AdminNotificationListQuery {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  category?: string;
  priority?: string;
  status?: string; // ALL, READ, UNREAD
  source?: string;
  studentId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class NotificationService {
  /**
   * Helper: Validate and sanitize deep link URL (must be relative internal route)
   */
  public sanitizeLink(link?: string | null): string | null {
    if (!link || typeof link !== 'string') return null;
    const trimmed = link.trim();
    if (!trimmed) return null;

    // Reject external schemes, protocol-relative URLs, or javascript injection
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('//') ||
      trimmed.toLowerCase().startsWith('javascript:') ||
      trimmed.toLowerCase().startsWith('data:')
    ) {
      throw new Error('Invalid deep link: external URLs and script schemes are strictly prohibited.');
    }

    if (!trimmed.startsWith('/')) {
      throw new Error('Invalid deep link: route must begin with a forward slash (e.g. /complaints).');
    }

    return trimmed;
  }

  /**
   * Helper: Sanitize notification metadata by completely stripping sensitive keys
   */
  public sanitizeMetadata(data: any): any {
    if (data === null || data === undefined) return null;
    if (typeof data !== 'object') return data;

    const SENSITIVE_KEYS = [
      'password',
      'passwordhash',
      'token',
      'refreshtoken',
      'jwt',
      'secret',
      'apikey',
      'apikeyhash',
      'biometrictemplate',
      'fingerprinttemplate',
      'faceembedding',
      'cookie',
      'authorization',
    ];

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeMetadata(item));
    }

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sk) => lowerKey.includes(sk))) {
        continue; // Completely strip sensitive keys
      }
      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeMetadata(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Authoritative recipient resolution based on selected targeting scope
   */
  public async resolveRecipients(
    scope: string,
    payload: {
      studentId?: string;
      studentIds?: string[];
      blockName?: string;
      roomNumber?: string;
      targetRole?: string;
    }
  ) {
    let resolvedStudents: Array<{ id: string; name: string; jntuNo: string; role: string }> = [];

    switch (scope) {
      case 'ALL_STUDENTS': {
        resolvedStudents = await prisma.student.findMany({
          where: { role: 'STUDENT', isActive: true },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        break;
      }

      case 'INDIVIDUAL': {
        if (!payload.studentId || !payload.studentId.trim()) {
          throw new Error('Recipient Student ID or JNTU number is required for INDIVIDUAL scope.');
        }
        const cleanId = payload.studentId.trim();
        const student = await prisma.student.findFirst({
          where: {
            OR: [{ id: cleanId }, { jntuNo: cleanId.toUpperCase() }],
            isActive: true,
          },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        if (student) {
          resolvedStudents = [student];
        }
        break;
      }

      case 'MULTIPLE': {
        if (!Array.isArray(payload.studentIds) || payload.studentIds.length === 0) {
          throw new Error('At least one recipient must be provided for MULTIPLE scope.');
        }
        const cleanIds = payload.studentIds.map((id) => id.trim()).filter(Boolean);
        resolvedStudents = await prisma.student.findMany({
          where: {
            OR: [{ id: { in: cleanIds } }, { jntuNo: { in: cleanIds.map((c) => c.toUpperCase()) } }],
            isActive: true,
          },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        break;
      }

      case 'BLOCK': {
        if (!payload.blockName || !payload.blockName.trim()) {
          throw new Error('Block name is required for BLOCK targeting.');
        }
        resolvedStudents = await prisma.student.findMany({
          where: {
            blockName: { equals: payload.blockName.trim(), mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        break;
      }

      case 'ROOM': {
        if (!payload.roomNumber || !payload.roomNumber.trim()) {
          throw new Error('Room number is required for ROOM targeting.');
        }
        resolvedStudents = await prisma.student.findMany({
          where: {
            roomNumber: { equals: payload.roomNumber.trim(), mode: 'insensitive' },
            isActive: true,
          },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        break;
      }

      case 'ROLE': {
        if (!payload.targetRole || !payload.targetRole.trim()) {
          throw new Error('Target role is required for ROLE targeting.');
        }
        const cleanTargetRole = payload.targetRole.trim().toUpperCase();
        resolvedStudents = await prisma.student.findMany({
          where: {
            role: cleanTargetRole === 'CHIEF_WARDEN'
              ? { in: ['CHIEF_WARDEN', 'CHIEF_WARDEN_BOYS', 'CHIEF_WARDEN_GIRLS'] }
              : cleanTargetRole,
            isActive: true,
          },
          select: { id: true, name: true, jntuNo: true, role: true },
        });
        break;
      }

      default:
        throw new Error(`Unsupported recipient scope: ${scope}. Allowed: ${VALID_NOTIFICATION_SCOPES.join(', ')}`);
    }

    // Deduplicate recipient records by ID
    const uniqueMap = new Map<string, (typeof resolvedStudents)[0]>();
    for (const student of resolvedStudents) {
      uniqueMap.set(student.id, student);
    }

    return Array.from(uniqueMap.values());
  }

  /**
   * Creates a notification record in PostgreSQL and emits a real-time SSE event.
   * Can participate in an external Prisma transaction if provided.
   */
  async createNotification(input: CreateNotificationInput, txPrisma?: any) {
    const client = txPrisma || prisma;

    const notification = await client.notification.create({
      data: {
        studentId: input.studentId,
        title: input.title.trim(),
        message: input.message.trim(),
        type: input.type || 'INFO',
        category: input.category || 'SYSTEM',
        priority: input.priority || 'NORMAL',
        source: input.source || 'SYSTEM',
        createdBy: input.createdBy || null,
        isRead: false,
        entityId: input.entityId || null,
        link: this.sanitizeLink(input.link),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        metadata: input.metadata ? JSON.stringify(sanitizeAuditMetadata(input.metadata)) : null,
      },
    });

    // Real-time delivery via SSE if not in interactive transaction
    if (!txPrisma) {
      const unreadCount = await prisma.notification.count({
        where: { studentId: input.studentId, isRead: false },
      });

      const event: NotificationDomainEvent = {
        type: 'NOTIFICATION_CREATED',
        notificationId: notification.id,
        unreadCount,
        timestamp: new Date().toISOString(),
      };

      complaintEventsService.emitNotificationEventToStudent(input.studentId, event);
    }

    return notification;
  }

  /**
   * Retrieves paginated, sorted, and filtered notification list for an authenticated student.
   */
  async listNotifications(studentId: string, options: any = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 20));
    const skip = (page - 1) * limit;
    const sortDir: 'asc' | 'desc' = options.orderBy === 'asc' ? 'asc' : 'desc';

    const whereClause: any = { studentId };

    if (options.unreadOnly) {
      whereClause.isRead = false;
    }

    if (options.category && options.category !== 'ALL') {
      whereClause.category = options.category.toUpperCase();
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: sortDir },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where: whereClause }),
      prisma.notification.count({ where: { studentId, isRead: false } }),
    ]);

    const allCount = await prisma.notification.count({ where: { studentId } });

    return {
      notifications,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      unreadCount,
      readCount: Math.max(0, allCount - unreadCount),
    };
  }

  /**
   * Retrieves a single notification with strict recipient ownership check.
   */
  async getNotificationById(id: string, studentId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      return null;
    }

    // Recipient ownership check (IDOR protection)
    if (notification.studentId !== studentId) {
      const error: any = new Error('Forbidden: You do not have permission to access this notification.');
      error.statusCode = 403;
      throw error;
    }

    return notification;
  }

  /**
   * Marks an individual notification as read.
   */
  async markAsRead(id: string, studentId: string) {
    const notification = await this.getNotificationById(id, studentId);
    if (!notification) {
      const error: any = new Error('Notification not found.');
      error.statusCode = 404;
      throw error;
    }

    let updated = notification;
    if (!notification.isRead) {
      updated = await prisma.notification.update({
        where: { id },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    }

    const unreadCount = await prisma.notification.count({
      where: { studentId, isRead: false },
    });

    // Real-time SSE sync
    complaintEventsService.emitNotificationEventToStudent(studentId, {
      type: 'NOTIFICATION_READ',
      notificationId: updated.id,
      unreadCount,
      timestamp: new Date().toISOString(),
    });

    return {
      notification: updated,
      unreadCount,
    };
  }

  /**
   * Marks all unread notifications as read for the authenticated student.
   */
  async markAllAsRead(studentId: string) {
    const result = await prisma.notification.updateMany({
      where: {
        studentId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    // Real-time SSE sync
    complaintEventsService.emitNotificationEventToStudent(studentId, {
      type: 'NOTIFICATIONS_ALL_READ',
      unreadCount: 0,
      count: result.count,
      timestamp: new Date().toISOString(),
    });

    return {
      markedCount: result.count,
      unreadCount: 0,
    };
  }

  /**
   * Retrieves the authoritative unread notification count.
   */
  async getUnreadCount(studentId: string) {
    const count = await prisma.notification.count({
      where: { studentId, isRead: false },
    });
    return { unreadCount: count };
  }

  // ==========================================================================
  // STEP 19: ADMIN / MANAGEMENT NOTIFICATIONS METHODS
  // ==========================================================================

  /**
   * Authoritative Multi-Recipient Broadcast Creation
   */
  public async createAdminNotification(
    dto: AdminSendNotificationInput,
    actor: { id: string; username: string; role: string }
  ) {
    // 1. Validation
    if (!dto.title || !dto.title.trim()) {
      throw new Error('Notification title is required.');
    }
    if (dto.title.trim().length > 200) {
      throw new Error('Notification title cannot exceed 200 characters.');
    }

    if (!dto.message || !dto.message.trim()) {
      throw new Error('Notification message is required.');
    }
    if (dto.message.trim().length > 5000) {
      throw new Error('Notification message cannot exceed 5000 characters.');
    }

    const cleanCategory = (dto.category || 'ANNOUNCEMENT').trim().toUpperCase();
    if (!VALID_NOTIFICATION_CATEGORIES.includes(cleanCategory as any)) {
      throw new Error(`Invalid category. Allowed: ${VALID_NOTIFICATION_CATEGORIES.join(', ')}`);
    }

    const cleanPriority = (dto.priority || 'NORMAL').trim().toUpperCase();
    if (!VALID_NOTIFICATION_PRIORITIES.includes(cleanPriority as any)) {
      throw new Error(`Invalid priority. Allowed: ${VALID_NOTIFICATION_PRIORITIES.join(', ')}`);
    }

    const cleanType = (dto.type || 'INFO').trim().toUpperCase();
    if (!['INFO', 'WARNING', 'SUCCESS'].includes(cleanType)) {
      throw new Error('Invalid notification type. Allowed: INFO, WARNING, SUCCESS');
    }

    const cleanScope = (dto.recipientScope || 'ALL_STUDENTS').trim().toUpperCase();
    if (!VALID_NOTIFICATION_SCOPES.includes(cleanScope as any)) {
      throw new Error(`Invalid recipient scope. Allowed: ${VALID_NOTIFICATION_SCOPES.join(', ')}`);
    }

    const cleanLink = this.sanitizeLink(dto.link);
    const expiresAtDate = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const sanitizedMetadata = dto.metadata ? sanitizeAuditMetadata(dto.metadata) : null;
    const metadataStr = sanitizedMetadata ? JSON.stringify(sanitizedMetadata) : null;

    // 2. Resolve Actual Recipients from Database
    const recipients = await this.resolveRecipients(cleanScope, {
      studentId: dto.studentId,
      studentIds: dto.studentIds,
      blockName: dto.blockName,
      roomNumber: dto.roomNumber,
      targetRole: dto.targetRole,
    });

    if (recipients.length === 0) {
      throw new Error('No active recipients found for the specified target criteria.');
    }

    // Resolve Actor ID for Audit Log
    let resolvedActorId = actor.id;
    if (!resolvedActorId || resolvedActorId === 'system') {
      const adminStudent = await prisma.student.findFirst({
        where: { role: { in: ['ADMIN', 'SUPER_ADMIN', 'HOSTEL_ADMIN', 'CHIEF_WARDEN', 'CHIEF_WARDEN_BOYS', 'CHIEF_WARDEN_GIRLS', 'WARDEN'] } },
        select: { id: true },
      });
      if (adminStudent) {
        resolvedActorId = adminStudent.id;
      }
    }

    // 3. Atomically Persist Notification Records and Audit Trail
    const result = await prisma.$transaction(async (tx) => {
      // Create notification rows for all resolved recipients
      const notificationsData = recipients.map((r) => ({
        studentId: r.id,
        title: dto.title.trim(),
        message: dto.message.trim(),
        category: cleanCategory,
        priority: cleanPriority,
        type: cleanType,
        source: 'ADMIN_PORTAL',
        createdBy: actor.username || actor.role || 'Admin',
        isRead: false,
        link: cleanLink,
        expiresAt: expiresAtDate,
        metadata: metadataStr,
      }));

      await tx.notification.createMany({
        data: notificationsData,
      });

      // Audit Record
      if (resolvedActorId) {
        await auditService.recordLog(
          {
            actorId: resolvedActorId,
            actorRole: actor.role || 'ADMIN',
            action: 'NOTIFICATION_CREATED',
            actionType: 'NOTIFICATION',
            entity: 'Notification',
            entityId: null,
            description: `Admin broadcast: "${dto.title.trim()}" (${cleanCategory}, ${cleanPriority}) to ${recipients.length} recipient(s) [Scope: ${cleanScope}]`,
            newState: {
              title: dto.title.trim(),
              category: cleanCategory,
              priority: cleanPriority,
              recipientScope: cleanScope,
              recipientCount: recipients.length,
              link: cleanLink,
            },
            metadata: {
              title: dto.title.trim(),
              category: cleanCategory,
              priority: cleanPriority,
              scope: cleanScope,
              recipientCount: recipients.length,
              link: cleanLink,
            },
          },
          tx,
          false
        );
      }

      return {
        recipientCount: recipients.length,
      };
    });

    // 4. Real-time Domain Event Dispatch AFTER Transaction Commit
    // Notify recipient students (direct SSE if count <= 50)
    if (recipients.length <= 50) {
      for (const r of recipients) {
        prisma.notification
          .count({ where: { studentId: r.id, isRead: false } })
          .then((unreadCount) => {
            complaintEventsService.emitNotificationEventToStudent(r.id, {
              type: 'NOTIFICATION_CREATED',
              unreadCount,
              timestamp: new Date().toISOString(),
            });
          })
          .catch(() => {});
      }
    }

    // Notify connected Admin dashboards
    complaintEventsService.emitAdminNotificationUpdate({
      type: 'NOTIFICATION_BROADCAST_CREATED',
      category: cleanCategory,
      recipientCount: recipients.length,
      title: dto.title.trim(),
      timestamp: new Date().toISOString(),
    });

    return {
      success: true,
      recipientCount: result.recipientCount,
      message: `Notification successfully sent to ${result.recipientCount} recipient(s).`,
    };
  }

  /**
   * Authoritative List of Notifications for Admin Management Center
   */
  public async getAdminNotifications(query: AdminNotificationListQuery) {
    const rawPage = Number(query.page);
    const pageNum = isNaN(rawPage) || rawPage <= 0 ? 1 : rawPage;

    const rawSize = Number(query.pageSize || query.limit);
    const pageSize = isNaN(rawSize) || rawSize <= 0 ? 25 : Math.min(100, rawSize);
    const skip = (pageNum - 1) * pageSize;

    const where: Prisma.NotificationWhereInput = {};

    // Search query: title, message, or recipient name/jntuNo
    if (query.search && query.search.trim().length > 0) {
      const q = query.search.trim();
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { message: { contains: q, mode: 'insensitive' } },
        { student: { name: { contains: q, mode: 'insensitive' } } },
        { student: { jntuNo: { contains: q, mode: 'insensitive' } } },
      ];
    }

    // Category filter
    if (query.category && query.category !== 'ALL') {
      where.category = query.category.toUpperCase();
    }

    // Priority filter
    if (query.priority && query.priority !== 'ALL') {
      where.priority = query.priority.toUpperCase();
    }

    // Status filter (ALL, READ, UNREAD)
    if (query.status && query.status !== 'ALL') {
      if (query.status === 'READ') {
        where.isRead = true;
      } else if (query.status === 'UNREAD') {
        where.isRead = false;
      }
    }

    // Source filter
    if (query.source && query.source !== 'ALL') {
      where.source = query.source.toUpperCase();
    }

    // Target student ID filter
    if (query.studentId) {
      where.studentId = query.studentId;
    }

    // Date range filter
    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        const toDate = new Date(query.dateTo);
        toDate.setHours(23, 59, 59, 999);
        where.createdAt.lte = toDate;
      }
    }

    // Live Authoritative PostgreSQL KPIs
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalNotifications,
      unreadNotifications,
      readNotifications,
      sentToday,
      systemNotifications,
      announcementNotifications,
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.count({ where: { isRead: true } }),
      prisma.notification.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.notification.count({ where: { category: 'SYSTEM' } }),
      prisma.notification.count({ where: { category: 'ANNOUNCEMENT' } }),
    ]);

    // Query notifications with student relation
    const [records, totalFiltered] = await Promise.all([
      prisma.notification.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              jntuNo: true,
              email: true,
              role: true,
              blockName: true,
              roomNumber: true,
            },
          },
        },
        skip,
        take: pageSize,
        orderBy: query.sortBy ? { [query.sortBy]: query.sortOrder || 'asc' } : { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    return {
      notifications: records.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        category: n.category,
        priority: n.priority,
        type: n.type,
        source: n.source,
        createdBy: n.createdBy,
        isRead: n.isRead,
        readAt: n.readAt ? n.readAt.toISOString() : null,
        link: n.link,
        expiresAt: n.expiresAt ? n.expiresAt.toISOString() : null,
        createdAt: n.createdAt.toISOString(),
        recipient: {
          id: n.student.id,
          name: n.student.name,
          jntuNo: n.student.jntuNo,
          role: n.student.role,
          blockName: n.student.blockName,
          roomNumber: n.student.roomNumber,
        },
      })),
      stats: {
        total: totalNotifications,
        unread: unreadNotifications,
        read: readNotifications,
        sentToday,
        system: systemNotifications,
        announcements: announcementNotifications,
      },
      pagination: {
        page: pageNum,
        pageSize,
        total: totalFiltered,
        totalPages: Math.ceil(totalFiltered / pageSize) || 1,
      },
    };
  }

  /**
   * Authoritative Single Notification Detail View for Admins
   */
  public async getAdminNotificationDetail(id: string) {
    const notification = await prisma.notification.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            jntuNo: true,
            email: true,
            role: true,
            blockName: true,
            roomNumber: true,
            bedNumber: true,
          },
        },
      },
    });

    if (!notification) {
      throw new Error('NOTIFICATION_NOT_FOUND');
    }

    let parsedMeta: any = null;
    if (notification.metadata) {
      try {
        parsedMeta = JSON.parse(notification.metadata);
      } catch {
        parsedMeta = notification.metadata;
      }
    }

    return {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      category: notification.category,
      priority: notification.priority,
      type: notification.type,
      source: notification.source,
      createdBy: notification.createdBy,
      isRead: notification.isRead,
      readAt: notification.readAt ? notification.readAt.toISOString() : null,
      link: notification.link,
      entityId: notification.entityId,
      expiresAt: notification.expiresAt ? notification.expiresAt.toISOString() : null,
      metadata: sanitizeAuditMetadata(parsedMeta),
      createdAt: notification.createdAt.toISOString(),
      recipient: {
        id: notification.student.id,
        name: notification.student.name,
        jntuNo: notification.student.jntuNo,
        email: notification.student.email,
        role: notification.student.role,
        blockName: notification.student.blockName,
        roomNumber: notification.student.roomNumber,
        bedNumber: notification.student.bedNumber,
      },
    };
  }

  /**
   * Helper: Return live stats for dashboard cards
   */
  public async getAdminNotificationStats() {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      total,
      unread,
      read,
      sentToday,
      system,
      announcements,
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notification.count({ where: { isRead: true } }),
      prisma.notification.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.notification.count({ where: { category: 'SYSTEM' } }),
      prisma.notification.count({ where: { category: 'ANNOUNCEMENT' } }),
    ]);

    return {
      total,
      unread,
      read,
      sentToday,
      system,
      announcements,
    };
  }
}

export const notificationService = new NotificationService();
