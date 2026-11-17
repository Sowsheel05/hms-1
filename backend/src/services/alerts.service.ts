import { prisma } from './prisma.service';
import { complaintEventsService } from './events.service';
import { auditService, sanitizeAuditMetadata } from './audit.service';
import { notificationService } from './notification.service';

export interface AlertItem {
  id: string;
  type: 'CURFEW_OVERDUE' | 'GATE_BREACH' | 'URGENT_COMPLAINT' | 'DISCIPLINARY' | 'EMERGENCY_BROADCAST';
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  title: string;
  description: string;
  source: string;
  timestamp: string;
  student?: {
    id: string;
    name: string;
    jntuNo: string;
    blockName?: string | null;
    roomNumber?: string | null;
    emergencyContact?: string | null;
  };
  details: Record<string, any>;
  isActionable: boolean;
  actionLabel?: string;
  actionUrl?: string;
}

export interface AlertStats {
  totalAlerts: number;
  criticalAlerts: number;
  overdueStudents: number;
  gateBreaches: number;
  urgentComplaints: number;
  activeSuspensions: number;
  systemStatus: 'NORMAL' | 'ELEVATED' | 'CRITICAL';
}

export interface BroadcastAlertInput {
  title: string;
  message: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  recipientScope: 'ALL_STUDENTS' | 'BLOCK' | 'ROOM';
  blockName?: string;
  roomNumber?: string;
  expiresInHours?: number;
}

export class AlertsService {
  /**
   * Retrieves aggregated live operational and security alerts across the hostel.
   */
  public async getActiveAlerts(filter?: {
    severity?: string;
    type?: string;
    blockName?: string;
    limit?: number;
  }): Promise<{ alerts: AlertItem[]; stats: AlertStats }> {
    const now = new Date();
    const alerts: AlertItem[] = [];

    // 1. OVERDUE OUTINGS: Students currently OUT whose returnDate is in the past
    const overdueOutings = await prisma.outingRequest.findMany({
      where: {
        status: 'OUT',
        returnDate: {
          lt: now,
        },
        ...(filter?.blockName
          ? {
              student: {
                blockName: { contains: filter.blockName, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        student: true,
      },
      orderBy: {
        returnDate: 'asc',
      },
      take: 50,
    });

    for (const outing of overdueOutings) {
      const minutesOverdue = Math.max(
        1,
        Math.round((now.getTime() - new Date(outing.returnDate).getTime()) / (1000 * 60))
      );
      const hoursOverdue = (minutesOverdue / 60).toFixed(1);

      alerts.push({
        id: `overdue-${outing.id}`,
        type: 'CURFEW_OVERDUE',
        severity: minutesOverdue > 120 ? 'CRITICAL' : 'HIGH',
        title: `Curfew Violation: ${outing.student.name} is Overdue`,
        description: `Student exited campus at ${
          outing.actualExitTime ? new Date(outing.actualExitTime).toLocaleTimeString() : 'recorded gate exit'
        } and is overdue by ${hoursOverdue} hrs (Expected return: ${new Date(outing.returnDate).toLocaleTimeString()}).`,
        source: 'Security Gate Transit & Curfew Monitor',
        timestamp: outing.returnDate.toISOString(),
        student: {
          id: outing.student.id,
          name: outing.student.name,
          jntuNo: outing.student.jntuNo,
          blockName: outing.student.blockName,
          roomNumber: outing.student.roomNumber,
          emergencyContact: outing.emergencyContact,
        },
        details: {
          outingId: outing.id,
          requestNumber: outing.requestNumber,
          passType: outing.passType,
          destination: outing.destination,
          purpose: outing.purpose,
          expectedReturn: outing.returnDate,
          actualExitTime: outing.actualExitTime,
          minutesOverdue,
        },
        isActionable: true,
        actionLabel: 'View Outing Request',
        actionUrl: `/management/outings`,
      });
    }

    // 2. GATE BREACHES: Biometric rejections in the last 48 hours
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const gateBreaches = await prisma.biometricEvent.findMany({
      where: {
        verificationStatus: 'REJECTED',
        eventTimestamp: {
          gte: fortyEightHoursAgo,
        },
        ...(filter?.blockName
          ? {
              student: {
                blockName: { contains: filter.blockName, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        student: true,
      },
      orderBy: {
        eventTimestamp: 'desc',
      },
      take: 50,
    });

    for (const breach of gateBreaches) {
      alerts.push({
        id: `breach-${breach.id}`,
        type: 'GATE_BREACH',
        severity: 'HIGH',
        title: `Gate Breach / Rejection: ${breach.student.name}`,
        description: `Biometric verification REJECTED at ${breach.gate || breach.deviceLabel || 'Turnstile'} (${breach.direction} scan). Reason: ${breach.rejectionReason || 'Unauthorized passage'}.`,
        source: breach.deviceLabel || breach.deviceId || 'Gate Biometric Reader',
        timestamp: breach.eventTimestamp.toISOString(),
        student: {
          id: breach.student.id,
          name: breach.student.name,
          jntuNo: breach.student.jntuNo,
          blockName: breach.student.blockName,
          roomNumber: breach.student.roomNumber,
        },
        details: {
          eventId: breach.id,
          direction: breach.direction,
          gate: breach.gate,
          deviceId: breach.deviceId,
          rejectionReason: breach.rejectionReason,
        },
        isActionable: true,
        actionLabel: 'Inspect Gate Transit Logs',
        actionUrl: `/management/outing-logs`,
      });
    }

    // 3. URGENT COMPLAINTS: Unresolved complaints with priority URGENT
    const urgentComplaints = await prisma.complaint.findMany({
      where: {
        priority: 'URGENT',
        status: {
          in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'],
        },
        ...(filter?.blockName
          ? {
              student: {
                blockName: { contains: filter.blockName, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        student: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });

    for (const complaint of urgentComplaints) {
      alerts.push({
        id: `complaint-${complaint.id}`,
        type: 'URGENT_COMPLAINT',
        severity: 'HIGH',
        title: `Urgent Maintenance: ${complaint.title}`,
        description: `Priority ${complaint.priority} [${complaint.category}] issue reported in ${complaint.location || (complaint.student.blockName ? `${complaint.student.blockName} - Room ${complaint.student.roomNumber}` : 'Hostel premises')}. Status: ${complaint.status}.`,
        source: 'Hostel Maintenance Desk',
        timestamp: complaint.createdAt.toISOString(),
        student: {
          id: complaint.student.id,
          name: complaint.student.name,
          jntuNo: complaint.student.jntuNo,
          blockName: complaint.student.blockName,
          roomNumber: complaint.student.roomNumber,
        },
        details: {
          complaintId: complaint.id,
          ticketNumber: complaint.ticketNumber,
          category: complaint.category,
          status: complaint.status,
          assignedTo: complaint.assignedTo,
        },
        isActionable: true,
        actionLabel: 'Dispatch Maintenance Staff',
        actionUrl: `/management/complaints`,
      });
    }

    // 4. ACTIVE SUSPENSIONS: Students actively banned or restricted
    const activeSuspensions = await prisma.suspension.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
        },
        ...(filter?.blockName
          ? {
              student: {
                blockName: { contains: filter.blockName, mode: 'insensitive' },
              },
            }
          : {}),
      },
      include: {
        student: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });

    for (const susp of activeSuspensions) {
      alerts.push({
        id: `suspension-${susp.id}`,
        type: 'DISCIPLINARY',
        severity: 'WARNING',
        title: `Disciplinary Suspension Active: ${susp.student.name}`,
        description: `Student is suspended until ${new Date(susp.endDate).toLocaleDateString()}. Gate exits and mess tokens are locked. Reason: ${susp.reason}.`,
        source: 'Hostel Disciplinary Authority',
        timestamp: susp.createdAt.toISOString(),
        student: {
          id: susp.student.id,
          name: susp.student.name,
          jntuNo: susp.student.jntuNo,
          blockName: susp.student.blockName,
          roomNumber: susp.student.roomNumber,
        },
        details: {
          suspensionId: susp.id,
          reason: susp.reason,
          startDate: susp.startDate,
          endDate: susp.endDate,
        },
        isActionable: true,
        actionLabel: 'Review Suspension Record',
        actionUrl: `/management/leaves`,
      });
    }

    // Sort all alerts by severity (CRITICAL > HIGH > WARNING > INFO), then timestamp descending
    const severityWeight: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      WARNING: 2,
      INFO: 1,
    };

    alerts.sort((a, b) => {
      const weightDiff = (severityWeight[b.severity] || 0) - (severityWeight[a.severity] || 0);
      if (weightDiff !== 0) return weightDiff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    // Compute live operational metrics
    const criticalCount = alerts.filter((a) => a.severity === 'CRITICAL').length;
    const highCount = alerts.filter((a) => a.severity === 'HIGH').length;

    const stats: AlertStats = {
      totalAlerts: alerts.length,
      criticalAlerts: criticalCount,
      overdueStudents: overdueOutings.length,
      gateBreaches: gateBreaches.length,
      urgentComplaints: urgentComplaints.length,
      activeSuspensions: activeSuspensions.length,
      systemStatus: criticalCount > 0 ? 'CRITICAL' : highCount > 2 ? 'ELEVATED' : 'NORMAL',
    };

    // Apply filtering if requested
    let filteredAlerts = alerts;
    if (filter?.severity && filter.severity !== 'ALL') {
      filteredAlerts = filteredAlerts.filter((a) => a.severity === filter.severity);
    }
    if (filter?.type && filter.type !== 'ALL') {
      filteredAlerts = filteredAlerts.filter((a) => a.type === filter.type);
    }
    if (filter?.limit && filter.limit > 0) {
      filteredAlerts = filteredAlerts.slice(0, filter.limit);
    }

    return {
      alerts: filteredAlerts,
      stats,
    };
  }

  /**
   * Broadcast an urgent emergency or security alert to residents with real-time SSE push
   */
  public async broadcastEmergencyAlert(
    input: BroadcastAlertInput,
    actor: { id: string; username: string; role: string }
  ) {
    const { title, message, severity, recipientScope, blockName, roomNumber, expiresInHours } = input;

    if (!title || !title.trim()) {
      throw new Error('Alert title is required.');
    }
    if (!message || !message.trim()) {
      throw new Error('Alert message body is required.');
    }

    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours default for emergencies

    const priorityMap: Record<string, 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = {
      CRITICAL: 'URGENT',
      HIGH: 'HIGH',
      WARNING: 'NORMAL',
      INFO: 'LOW',
    };

    // Dispatch broadcast via existing notification service
    const result = await notificationService.createAdminNotification(
      {
        title: `[ALERT] ${title.trim()}`,
        message: message.trim(),
        category: 'SYSTEM',
        priority: priorityMap[severity] || 'URGENT',
        type: severity === 'CRITICAL' || severity === 'HIGH' ? 'WARNING' : 'INFO',
        recipientScope,
        blockName,
        roomNumber,
        expiresAt,
        metadata: {
          isEmergencyAlert: true,
          alertSeverity: severity,
          broadcastBy: actor.username,
        },
      },
      actor
    );

    // Record audit event
    await auditService.recordLog({
      actorId: actor.id,
      action: 'CREATE',
      actorRole: actor.role,
      entity: 'EmergencyAlert',
      description: `Warden ${actor.username} triggered an emergency alert broadcast: "${title}" (${severity}) to ${recipientScope}.`,
      metadata: sanitizeAuditMetadata({
        title,
        severity,
        recipientScope,
        blockName,
        roomNumber,
        recipientsReached: result.recipientCount,
      }),
    });

    return {
      success: true,
      recipientsReached: result.recipientCount,
      expiresAt,
    };
  }

  /**
   * Records operational acknowledgement or resolution for an alert in the audit log
   */
  public async acknowledgeAlert(
    alertId: string,
    notes: string,
    actor: { id: string; username: string; role: string }
  ) {
    if (!alertId || !alertId.trim()) {
      throw new Error('Alert ID is required.');
    }

    await auditService.recordLog({
      actorId: actor.id,
      action: 'RESOLVE',
      actorRole: actor.role,
      entity: 'AlertManagement',
      entityId: alertId,
      description: `Manager ${actor.username} acknowledged/resolved alert ${alertId}. Notes: ${notes || 'No notes provided'}.`,
      metadata: sanitizeAuditMetadata({
        alertId,
        notes,
        acknowledgedBy: actor.username,
        acknowledgedAt: new Date().toISOString(),
      }),
    });

    // Notify listeners via domain event bus
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'ALERT_RESOLVED',
      timestamp: new Date().toISOString(),
      details: {
        alertId,
        acknowledgedBy: actor.username,
      },
    });

    return {
      success: true,
      alertId,
      acknowledgedAt: new Date().toISOString(),
    };
  }
}

export const alertsService = new AlertsService();
