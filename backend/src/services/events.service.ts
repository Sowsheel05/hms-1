import { Response } from 'express';
import { EventEmitter } from 'events';

export type ComplaintEventType =
  | 'COMPLAINT_CREATED'
  | 'COMPLAINT_UPDATED'
  | 'COMPLAINT_STATUS_CHANGED'
  | 'COMPLAINT_ASSIGNED'
  | 'COMPLAINT_STARTED'
  | 'COMPLAINT_RESOLVED'
  | 'COMPLAINT_CLOSED'
  | 'COMPLAINT_CANCELLED'
  | 'COMPLAINT_COMMENT_ADDED'
  | 'COMPLAINT_ATTACHMENT_ADDED'
  | 'COMPLAINT_STATS_UPDATED';


export interface ComplaintDomainEvent {
  type: ComplaintEventType;
  complaintId: string;
  timestamp: string;
}

export type LeaveEventType =
  | 'LEAVE_CREATED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'LEAVE_CANCELLED'
  | 'LEAVE_STATUS_CHANGED'
  | 'LEAVE_STATUS_UPDATED'
  | 'LEAVE_STATS_UPDATED'
  | 'SUSPENSION_CREATED'
  | 'SUSPENSION_UPDATED'
  | 'SUSPENSION_LIFTED'
  | 'SUSPENSION_ENDED';

export interface LeaveDomainEvent {
  type: LeaveEventType;
  leaveId?: string;
  suspensionId?: string;
  studentId?: string;
  details?: any;
  timestamp: string;
}

export type NotificationEventType =
  | 'NOTIFICATION_CREATED'
  | 'NOTIFICATION_READ'
  | 'NOTIFICATIONS_ALL_READ';

export interface NotificationDomainEvent {
  type: NotificationEventType;
  notificationId?: string;
  unreadCount?: number;
  count?: number;
  timestamp: string;
}

export type BiometricEventType =
  | 'BIOMETRIC_EVENT_RECORDED';

export interface BiometricDomainEvent {
  type: BiometricEventType;
  eventId?: string;
  eventType?: 'ENTRY' | 'EXIT' | string;
  status?: 'VERIFIED' | 'REJECTED' | string;
  gate?: string | null;
  timestamp: string;
}

export type BlockEventType =
  | 'BLOCK_CREATED'
  | 'BLOCK_UPDATED'
  | 'BLOCK_STATUS_CHANGED'
  | 'BLOCK_DELETED';

export interface BlockDomainEvent {
  type: BlockEventType;
  blockId: string;
  code?: string;
  timestamp: string;
}

export type RoomEventType =
  | 'ROOM_CREATED'
  | 'ROOM_UPDATED'
  | 'ROOM_DELETED'
  | 'ROOM_ALLOCATION_CHANGED'
  | 'STUDENT_ALLOCATED'
  | 'STUDENT_VACATED'
  | 'STUDENT_REALLOCATED';

export interface RoomDomainEvent {
  type: RoomEventType;
  roomId?: string;
  studentId?: string;
  allocationId?: string;
  details?: any;
  timestamp: string;
}

export type MessEventType =
  | 'MESS_TOKEN_BOOKED'
  | 'MESS_TOKEN_CONSUMED'
  | 'MESS_TOKEN_CANCELLED'
  | 'MESS_STATS_UPDATED'
  | 'MESS_INDENT_UPDATED'
  | 'MESS_TOKEN_UPDATED';

export interface MessDomainEvent {
  type: MessEventType;
  tokenId?: string;
  studentId?: string;
  date?: string;
  mealType?: string;
  status?: string;
  details?: any;
  timestamp: string;
}

export type OutingEventType =
  | 'OUTING_CREATED'
  | 'OUTING_APPROVED'
  | 'OUTING_REJECTED'
  | 'OUTING_EXIT_CONFIRMED'
  | 'OUTING_RETURN_CONFIRMED'
  | 'OUTING_STATS_UPDATED';

export interface OutingDomainEvent {
  type: OutingEventType;
  outingId?: string;
  studentId?: string;
  status?: string;
  passType?: string;
  details?: any;
  timestamp: string;
}

export type FeeEventType =
  | 'FEE_STRUCTURE_UPDATED'
  | 'FEE_ITEM_CREATED'
  | 'FEE_ITEM_UPDATED'
  | 'FEE_PAYMENT_CREATED'
  | 'FEE_PAYMENT_UPDATED'
  | 'FEE_REFUND_CREATED'
  | 'SCHOLARSHIP_UPDATED'
  | 'DETENTION_UPDATED'
  | 'ACADEMIC_YEAR_UPDATED'
  | 'BANK_ACCOUNT_UPDATED'
  | 'INSTITUTION_SETTINGS_UPDATED'
  | 'FEE_COLLECTION_STATS_UPDATED';

export interface FeeDomainEvent {
  type: FeeEventType;
  entityId?: string;
  studentId?: string;
  academicYearId?: string;
  details?: any;
  timestamp: string;
}

class ComplaintEventsService extends EventEmitter {
  // Map of studentId -> Set of active SSE Response connections
  private studentConnections: Map<string, Set<Response>> = new Map();
  // Map of managerId -> Set of active SSE Response connections
  private managementConnections: Map<string, Set<Response>> = new Map();
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.startHeartbeat();
  }

  /**
   * Registers an SSE client connection for an authenticated student
   */
  public registerClient(studentId: string, res: Response): void {
    if (!this.studentConnections.has(studentId)) {
      this.studentConnections.set(studentId, new Set());
    }

    const connections = this.studentConnections.get(studentId)!;
    connections.add(res);

    // Initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, timestamp: new Date().toISOString() })}\n\n`);

    // Clean up when client disconnects
    res.on('close', () => {
      this.removeClient(studentId, res);
    });
  }

  /**
   * Unregisters an SSE client connection
   */
  public removeClient(studentId: string, res: Response): void {
    const connections = this.studentConnections.get(studentId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.studentConnections.delete(studentId);
      }
    }
  }

  /**
   * Registers an SSE client connection for an authenticated management user
   */
  public registerManagementClient(managerId: string, res: Response): void {
    if (!this.managementConnections.has(managerId)) {
      this.managementConnections.set(managerId, new Set());
    }

    const connections = this.managementConnections.get(managerId)!;
    connections.add(res);

    // Initial handshake
    res.write(`event: connected\ndata: ${JSON.stringify({ connected: true, role: 'MANAGEMENT', timestamp: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      this.removeManagementClient(managerId, res);
    });
  }

  /**
   * Unregisters an SSE management connection
   */
  public removeManagementClient(managerId: string, res: Response): void {
    const connections = this.managementConnections.get(managerId);
    if (connections) {
      connections.delete(res);
      if (connections.size === 0) {
        this.managementConnections.delete(managerId);
      }
    }
  }

  /**
   * Broadcasts a real-time operational update to all connected management dashboards
   */
  public emitManagementDashboardUpdate(event: { type: string; timestamp: string; details?: any }): void {
    const payload1 = `event: management_dashboard_event\ndata: ${JSON.stringify(event)}\n\n`;
    const payload2 = `event: management_dashboard_update\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [, connections] of this.managementConnections.entries()) {
      for (const res of connections) {
        try {
          res.write(payload1);
          res.write(payload2);
        } catch (err) {
          console.error('Failed to write SSE event to management connection:', err);
        }
      }
    }
  }

  /**
   * Broadcasts a fee domain event to management clients and student if specified
   */
  public emitFeeEvent(event: FeeDomainEvent): void {
    const payload = `event: fee_event\ndata: ${JSON.stringify(event)}\n\n`;
    for (const [, connections] of this.managementConnections.entries()) {
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE fee event to management connection:', err);
        }
      }
    }
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: event,
    });
  }

  /**
   * Helper to write events to all active SSE connections for a given student
   */
  private writeToStudentConnections(studentId: string, domainEventName: string, eventData: any, domain: string): void {
    const connections = this.studentConnections.get(studentId);
    if (!connections || connections.size === 0) return;

    const domainPayload = `event: ${domainEventName}\ndata: ${JSON.stringify(eventData)}\n\n`;
    const genericPayload = `event: student_event\ndata: ${JSON.stringify({
      domain,
      type: eventData.type,
      timestamp: eventData.timestamp || new Date().toISOString(),
      payload: eventData,
    })}\n\n`;

    for (const res of connections) {
      try {
        res.write(domainPayload);
        res.write(genericPayload);
      } catch (err) {
        console.error(`Failed to write SSE ${domainEventName} to student connection:`, err);
      }
    }
  }

  /**
   * Emits a domain event exclusively to the authorized student
   */
  public emitToStudent(studentId: string, event: ComplaintDomainEvent): void {
    this.writeToStudentConnections(studentId, 'complaint_event', event, 'COMPLAINT');

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: { complaintId: event.complaintId },
    });
  }

  /**
   * Emits a leave domain event exclusively to the authorized student
   */
  public emitLeaveEventToStudent(studentId: string, event: LeaveDomainEvent): void {
    this.writeToStudentConnections(studentId, 'leave_event', event, 'LEAVE');

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: {
        leaveId: event.leaveId,
        suspensionId: event.suspensionId,
        studentId: event.studentId,
        ...event.details,
      },
    });
  }

  /**
   * Broadcasts a leave/suspension domain event to all connected management listeners
   */
  public emitLeaveManagementUpdate(event: LeaveDomainEvent): void {
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: {
        leaveId: event.leaveId,
        suspensionId: event.suspensionId,
        studentId: event.studentId,
        ...event.details,
      },
    });
  }

  /**
   * Emits a notification domain event exclusively to the authorized student
   */
  public emitNotificationEventToStudent(studentId: string, event: NotificationDomainEvent): void {
    this.writeToStudentConnections(studentId, 'notification_event', event, 'NOTIFICATION');
  }

  /**
   * Dispatches a lightweight biometric event to a specific student's SSE stream
   */
  public emitBiometricEventToStudent(studentId: string, event: BiometricDomainEvent): void {
    this.writeToStudentConnections(studentId, 'biometric_event', event, 'BIOMETRIC');

    // Also notify management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: { eventId: event.eventId, gate: event.gate },
    });
  }

  /**
   * Dispatches a room allocation domain event to a specific student's SSE stream and broadcasts to management
   */
  public emitRoomEventToStudent(studentId: string, event: RoomDomainEvent): void {
    this.writeToStudentConnections(studentId, 'room_event', event, 'ROOM');

    // Also broadcast to management dashboard
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: {
        roomId: event.roomId,
        studentId: event.studentId,
        allocationId: event.allocationId,
        ...event.details,
      },
    });
  }

  /**
   * Dispatches a mess domain event to a specific student's SSE stream and broadcasts to management
   */
  public emitMessEventToStudent(studentId: string | undefined, event: MessDomainEvent): void {
    if (studentId) {
      this.writeToStudentConnections(studentId, 'mess_event', event, 'MESS');
    }

    // Also broadcast to management dashboard and mess listeners
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: {
        tokenId: event.tokenId,
        studentId: event.studentId,
        date: event.date,
        mealType: event.mealType,
        status: event.status,
        ...event.details,
      },
    });
  }

  /**
   * Dispatches an outing domain event to a student's SSE stream and broadcasts to management
   */
  public emitOutingEventToStudent(studentId: string | undefined, event: OutingDomainEvent): void {
    if (studentId) {
      this.writeToStudentConnections(studentId, 'outing_event', event, 'OUTING');
    }

    // Broadcast to management
    this.emitOutingManagementUpdate(event);
  }

  /**
   * Broadcasts an outing domain event to all connected management dashboards/listeners
   */
  public emitOutingManagementUpdate(event: OutingDomainEvent): void {
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp: event.timestamp || new Date().toISOString(),
      details: {
        outingId: event.outingId,
        studentId: event.studentId,
        status: event.status,
        passType: event.passType,
        ...event.details,
      },
    });
  }

  /**
   * Broadcasts a device domain event to all connected management listeners and dashboards
   */
  public emitDeviceManagementUpdate(event: {
    type: string;
    deviceId?: string;
    deviceIdentifier?: string;
    status?: string;
    timestamp?: string;
    details?: any;
  }): void {
    const timestamp = event.timestamp || new Date().toISOString();
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp,
      details: {
        deviceId: event.deviceId,
        deviceIdentifier: event.deviceIdentifier,
        status: event.status,
        ...event.details,
      },
    });

    const payload = `event: device_event\ndata: ${JSON.stringify({ ...event, timestamp })}\n\n`;
    for (const [, connections] of this.managementConnections.entries()) {
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE device event to connection:', err);
        }
      }
    }
  }

  /**
   * Dispatches real-time notification events to all connected management dashboards
   */
  public emitAdminNotificationUpdate(event: {
    type: string;
    notificationId?: string;
    category?: string;
    recipientCount?: number;
    title?: string;
    timestamp?: string;
    details?: any;
  }): void {
    const timestamp = event.timestamp || new Date().toISOString();
    this.emitManagementDashboardUpdate({
      type: event.type,
      timestamp,
      details: {
        notificationId: event.notificationId,
        category: event.category,
        recipientCount: event.recipientCount,
        title: event.title,
        ...event.details,
      },
    });

    const payload = `event: notification_event\ndata: ${JSON.stringify({ ...event, timestamp })}\n\n`;
    for (const [, connections] of this.managementConnections.entries()) {
      for (const res of connections) {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Failed to write SSE admin notification event to connection:', err);
        }
      }
    }
  }


  /**
   * Keep-alive ping to prevent proxy/browser timeout
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      // Ping student connections
      for (const [, connections] of this.studentConnections.entries()) {
        for (const res of connections) {
          try {
            res.write(': ping\n\n');
          } catch {
            // connection dropped
          }
        }
      }
      // Ping management connections
      for (const [, connections] of this.managementConnections.entries()) {
        for (const res of connections) {
          try {
            res.write(': ping\n\n');
          } catch {
            // connection dropped
          }
        }
      }
    }, 25000);
  }

  /**
   * Diagnostics: get number of active subscribers
   */
  public getActiveConnectionCount(studentId?: string): number {
    if (studentId) {
      return this.studentConnections.get(studentId)?.size || 0;
    }
    let total = 0;
    for (const set of this.studentConnections.values()) {
      total += set.size;
    }
    return total;
  }
}

export const complaintEventsService = new ComplaintEventsService();
