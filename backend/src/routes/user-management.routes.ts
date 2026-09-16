import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../services/prisma.service';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
} from '../middleware/management.middleware';
import { auditService } from '../services/audit.service';
import { complaintEventsService } from '../services/events.service';
import { notificationService } from '../services/notification.service';

export const userManagementRouter = Router();

// Enforce server-side authentication for all user management endpoints
userManagementRouter.use(authenticateManagement);

export const AUTHORIZED_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'WARDEN',
  'STUDENT',
  'MAINTENANCE_STAFF',
  'MESS_STAFF',
] as const;

export type UserRole = typeof AUTHORIZED_ROLES[number];

export const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'System Administrator',
  HOSTEL_ADMIN: 'Hostel Administrator',
  CHIEF_WARDEN: 'Chief Warden',
  CHIEF_WARDEN_BOYS: 'Chief Warden (Boys Hostel)',
  CHIEF_WARDEN_GIRLS: 'Chief Warden (Girls Hostel)',
  WARDEN: 'Hostel Warden',
  STUDENT: 'Hostel Resident (Student)',
  MAINTENANCE_STAFF: 'Maintenance Technician',
  MESS_STAFF: 'Mess Staff',
};

// Roles permitted to perform sensitive administrative operations (role modification, staff creation)
const HIGH_PRIVILEGE_ADMIN_ROLES = [
  'ADMIN',
  'HOSTEL_ADMIN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
];

/**
 * Sanitizes student/user records to guarantee passwords and hashes are NEVER exposed
 */
function sanitizeUser(user: any) {
  if (!user) return null;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

/**
 * GET /api/management/users/roles
 * Returns authoritative list of supported roles and display labels
 */
userManagementRouter.get('/roles', async (_req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const roles = AUTHORIZED_ROLES.map((role) => ({
      role,
      label: ROLE_LABELS[role] || role,
      category: role === 'STUDENT' ? 'STUDENT' : ['MAINTENANCE_STAFF', 'MESS_STAFF'].includes(role) ? 'SUPPORT' : 'MANAGEMENT',
      isCreatable: !['ADMIN', 'HOSTEL_ADMIN'].includes(role),
    }));

    res.json({
      success: true,
      roles,
    });
  } catch (error: any) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch supported roles.' });
  }
});

/**
 * GET /api/management/users/summary
 * Returns real aggregated counts across PostgreSQL 18.6 database
 */
userManagementRouter.get('/summary', async (_req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const [
      totalUsers,
      activeUsers,
      disabledUsers,
      students,
      wardens,
      administrators,
      hostelAdmins,
      chiefWardens,
      messStaff,
      maintenanceStaff,
    ] = await Promise.all([
      prisma.student.count(),
      prisma.student.count({ where: { isActive: true } }),
      prisma.student.count({ where: { isActive: false } }),
      prisma.student.count({ where: { role: 'STUDENT' } }),
      prisma.student.count({ where: { role: 'WARDEN' } }),
      prisma.student.count({ where: { role: 'ADMIN' } }),
      prisma.student.count({ where: { role: 'HOSTEL_ADMIN' } }),
      prisma.student.count({ where: { role: { in: ['CHIEF_WARDEN', 'CHIEF_WARDEN_BOYS', 'CHIEF_WARDEN_GIRLS'] } } }),
      prisma.student.count({ where: { role: 'MESS_STAFF' } }),
      prisma.student.count({ where: { role: 'MAINTENANCE_STAFF' } }),
    ]);

    const managementStaff = wardens + administrators + hostelAdmins + chiefWardens;
    const supportStaff = messStaff + maintenanceStaff;

    res.json({
      success: true,
      summary: {
        totalUsers,
        activeUsers,
        disabledUsers,
        students,
        wardens,
        administrators,
        hostelAdmins,
        chiefWardens,
        messStaff,
        maintenanceStaff,
        managementStaff,
        supportStaff,
      },
    });
  } catch (error: any) {
    console.error('Error fetching user summary metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user metrics.' });
  }
});

/**
 * GET /api/management/users
 * Paginated, filtered, sortable user accounts
 */
userManagementRouter.get('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const rawPageSize = parseInt(req.query.pageSize as string || req.query.limit as string, 10) || 25;
    const pageSize = Math.min(100, Math.max(1, rawPageSize)); // Safe clamping
    const skip = (page - 1) * pageSize;

    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const roleFilter = typeof req.query.role === 'string' ? req.query.role.trim() : '';
    const statusFilter = typeof req.query.status === 'string' ? req.query.status.trim().toUpperCase() : '';
    const blockFilter = typeof req.query.block === 'string' ? req.query.block.trim() : (typeof req.query.blockName === 'string' ? req.query.blockName.trim() : '');
    const academicFilter = typeof req.query.academicYear === 'string' ? req.query.academicYear.trim() : (typeof req.query.branch === 'string' ? req.query.branch.trim() : '');

    const where: any = {};

    if (roleFilter && roleFilter !== 'ALL') {
      if (roleFilter === 'CHIEF_WARDEN') {
        where.role = { in: ['CHIEF_WARDEN', 'CHIEF_WARDEN_BOYS', 'CHIEF_WARDEN_GIRLS'] };
      } else {
        where.role = roleFilter;
      }
    }

    if (statusFilter === 'ACTIVE') {
      where.isActive = true;
    } else if (statusFilter === 'DISABLED' || statusFilter === 'INACTIVE') {
      where.isActive = false;
    }

    if (blockFilter && blockFilter !== 'ALL') {
      where.blockName = { contains: blockFilter, mode: 'insensitive' };
    }

    if (academicFilter && academicFilter !== 'ALL') {
      where.jntuNo = { contains: academicFilter, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { jntuNo: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { blockName: { contains: search, mode: 'insensitive' } },
        { roomNumber: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, users] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          jntuNo: true,
          name: true,
          email: true,
          role: true,
          isActive: true,
          allocationStatus: true,
          blockName: true,
          floorName: true,
          roomNumber: true,
          bedNumber: true,
          roomType: true,
          roomCapacity: true,
          allocatedAt: true,
          monthlyOutingMax: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / pageSize);

    res.json({
      success: true,
      users,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    });
  } catch (error: any) {
    console.error('Error listing users:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user accounts.' });
  }
});

/**
 * GET /api/management/users/:id
 * Retrieve individual user detail
 */
userManagementRouter.get('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const user = await prisma.student.findUnique({
      where: { id },
      select: {
        id: true,
        jntuNo: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        allocationStatus: true,
        blockName: true,
        floorName: true,
        roomNumber: true,
        bedNumber: true,
        roomType: true,
        roomCapacity: true,
        allocatedAt: true,
        monthlyOutingMax: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            sessions: true,
            complaints: true,
            outings: true,
            leaves: true,
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    res.json({
      success: true,
      user,
    });
  } catch (error: any) {
    console.error('Error fetching user detail:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve user details.' });
  }
});

/**
 * POST /api/management/users
 * Authoritative user creation with password hashing and audit
 */
userManagementRouter.post('/', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const requester = req.managementUser!;
    const { jntuNo, name, email, role, password, blockName, roomNumber, bedNumber, roomType, monthlyOutingMax } = req.body;

    // Validation: Required fields
    if (!jntuNo || typeof jntuNo !== 'string' || jntuNo.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Login identifier / JNTU No. is required.' });
      return;
    }

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ success: false, message: 'A valid display name (minimum 2 characters) is required.' });
      return;
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ success: false, message: 'A valid email address is required.' });
      return;
    }

    if (!role || !(AUTHORIZED_ROLES as readonly string[]).includes(role)) {
      res.status(400).json({ success: false, message: `Invalid role specified. Supported roles: ${AUTHORIZED_ROLES.join(', ')}` });
      return;
    }

    if (role === 'ADMIN' || role === 'HOSTEL_ADMIN') {
      res.status(400).json({
        success: false,
        message: 'Main Admin (ADMIN) and Sub Admin (HOSTEL_ADMIN) roles are unique system roles and cannot be created via user management.',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ success: false, message: 'Password is required and must be at least 6 characters long.' });
      return;
    }

    const normalizedIdentifier = jntuNo.trim().toUpperCase();
    const normalizedEmail = email.trim().toLowerCase();

    // RBAC Rule: Only High-Privilege Administrators can create staff/management accounts
    if (role !== 'STUDENT' && !HIGH_PRIVILEGE_ADMIN_ROLES.includes(requester.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Only system administrators can create staff or management accounts.',
      });
      return;
    }

    // Check unique constraints
    const existingByIdentifier = await prisma.student.findUnique({
      where: { jntuNo: normalizedIdentifier },
    });
    if (existingByIdentifier) {
      res.status(409).json({ success: false, message: `An account with identifier "${normalizedIdentifier}" already exists.` });
      return;
    }

    const existingByEmail = await prisma.student.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingByEmail) {
      res.status(409).json({ success: false, message: `An account with email "${normalizedEmail}" already exists.` });
      return;
    }

    // Secure bcrypt hashing
    const passwordHash = await bcrypt.hash(password, 10);

    // Database transaction: create user + audit log
    const result = await prisma.$transaction(async (tx) => {
      const newUser = await tx.student.create({
        data: {
          jntuNo: normalizedIdentifier,
          name: name.trim(),
          email: normalizedEmail,
          role,
          passwordHash,
          isActive: true,
          allocationStatus: role === 'STUDENT' ? (blockName && roomNumber ? 'ALLOCATED' : 'NOT_ALLOCATED') : 'NOT_ALLOCATED',
          blockName: blockName?.trim() || null,
          roomNumber: roomNumber?.trim() || null,
          bedNumber: bedNumber?.trim() || null,
          roomType: roomType?.trim() || null,
          monthlyOutingMax: typeof monthlyOutingMax === 'number' ? monthlyOutingMax : 5,
        },
      });

      // Transactional Audit Log
      await tx.activityLog.create({
        data: {
          studentId: requester.id,
          actionType: 'USER_MANAGEMENT',
          action: 'USER_CREATED',
          actorRole: requester.role,
          entity: 'User',
          entityId: newUser.id,
          previousState: null,
          newState: JSON.stringify({ role: newUser.role, status: 'ACTIVE', jntuNo: newUser.jntuNo }),
          description: `User account created: ${newUser.name} (${newUser.jntuNo}) with role ${newUser.role} by ${requester.name} (${requester.jntuNo})`,
          metadata: JSON.stringify({
            createdUserId: newUser.id,
            jntuNo: newUser.jntuNo,
            role: newUser.role,
            email: newUser.email,
          }),
        },
      });

      // Welcome notification to new user
      await notificationService.createNotification(
        {
          studentId: newUser.id,
          title: 'Welcome to Hostel Portal',
          message: `Your account (${newUser.jntuNo}) has been created with role ${newUser.role}.`,
          type: 'SUCCESS',
          category: 'SYSTEM',
          priority: 'NORMAL',
          createdBy: requester.jntuNo,
        },
        tx
      );

      return newUser;
    });

    // Real-time notification post-commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'USER_CREATED',
      timestamp: new Date().toISOString(),
      details: {
        id: result.id,
        jntuNo: result.jntuNo,
        name: result.name,
        role: result.role,
      },
    });

    res.status(201).json({
      success: true,
      message: `User account "${result.name}" created successfully with role ${result.role}.`,
      user: sanitizeUser(result),
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'A user account with this identifier or email already exists.',
      });
      return;
    }
    console.error('Error creating user account:', error);
    res.status(500).json({ success: false, message: 'Failed to create user account.', error: error.message });
  }
});

/**
 * PUT /api/management/users/:id
 * Update user profile and role with privilege escalation safeguards
 */
userManagementRouter.put('/:id', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requester = req.managementUser!;
    const { name, email, role, blockName, roomNumber, bedNumber, roomType, monthlyOutingMax } = req.body;

    const existing = await prisma.student.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    const updateData: any = {};

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updateData.name = name.trim();
    }

    if (email && typeof email === 'string' && email.includes('@')) {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== existing.email) {
        const conflict = await prisma.student.findUnique({ where: { email: normalizedEmail } });
        if (conflict) {
          res.status(409).json({ success: false, message: `Email address "${normalizedEmail}" is already in use.` });
          return;
        }
        updateData.email = normalizedEmail;
      }
    }

    let isRoleChange = false;
    let oldRole = existing.role;

    if (role && role !== existing.role) {
      if (!(AUTHORIZED_ROLES as readonly string[]).includes(role)) {
        res.status(400).json({ success: false, message: `Invalid role "${role}". Supported: ${AUTHORIZED_ROLES.join(', ')}` });
        return;
      }

      // Security Rule 1: A user cannot modify their own role / security privileges
      if (existing.id === requester.id) {
        res.status(400).json({
          success: false,
          message: 'Self-role modification is strictly prohibited. You cannot change your own role.',
        });
        return;
      }

      // Security Rule 2: Only High-Privilege Administrators can modify roles
      if (!HIGH_PRIVILEGE_ADMIN_ROLES.includes(requester.role)) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Modifying user roles requires system administrator privileges.',
        });
        return;
      }

      // Security Rule 3: Protection for the last authorized administrator
      if (['ADMIN', 'HOSTEL_ADMIN'].includes(existing.role) && !['ADMIN', 'HOSTEL_ADMIN'].includes(role)) {
        const activeAdminsCount = await prisma.student.count({
          where: { role: { in: ['ADMIN', 'HOSTEL_ADMIN'] }, isActive: true },
        });
        if (activeAdminsCount <= 1) {
          res.status(400).json({
            success: false,
            message: 'Cannot demote the last active system administrator. Another administrator must exist.',
          });
          return;
        }
      }

      updateData.role = role;
      isRoleChange = true;
    }

    if (blockName !== undefined) updateData.blockName = blockName ? blockName.trim() : null;
    if (roomNumber !== undefined) updateData.roomNumber = roomNumber ? roomNumber.trim() : null;
    if (bedNumber !== undefined) updateData.bedNumber = bedNumber ? bedNumber.trim() : null;
    if (roomType !== undefined) updateData.roomType = roomType ? roomType.trim() : null;
    if (typeof monthlyOutingMax === 'number' && monthlyOutingMax > 0) updateData.monthlyOutingMax = monthlyOutingMax;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, message: 'No valid fields provided to update.' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: updateData,
      });

      // Audit Log
      const auditAction = isRoleChange ? 'ROLE_CHANGED' : 'USER_UPDATED';
      await tx.activityLog.create({
        data: {
          studentId: requester.id,
          actionType: 'USER_MANAGEMENT',
          action: auditAction,
          actorRole: requester.role,
          entity: 'User',
          entityId: updated.id,
          previousState: isRoleChange ? oldRole : JSON.stringify({ name: existing.name, email: existing.email }),
          newState: isRoleChange ? updated.role : JSON.stringify({ name: updated.name, email: updated.email }),
          description: isRoleChange
            ? `Role changed for ${updated.name} (${updated.jntuNo}): ${oldRole} → ${updated.role} by ${requester.name}`
            : `User account updated for ${updated.name} (${updated.jntuNo}) by ${requester.name}`,
          metadata: JSON.stringify({
            targetUserId: updated.id,
            jntuNo: updated.jntuNo,
            fieldsModified: Object.keys(updateData),
          }),
        },
      });

      if (isRoleChange) {
        await notificationService.createNotification(
          {
            studentId: updated.id,
            title: 'Account Role Updated',
            message: `Your account role has been updated from ${oldRole} to ${updated.role} by administration.`,
            type: 'INFO',
            category: 'SYSTEM',
            priority: 'HIGH',
            createdBy: requester.jntuNo,
          },
          tx
        );
      }

      return updated;
    });

    // Real-time SSE post-commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: isRoleChange ? 'USER_ROLE_CHANGED' : 'USER_UPDATED',
      timestamp: new Date().toISOString(),
      details: {
        id: result.id,
        jntuNo: result.jntuNo,
        role: result.role,
      },
    });

    res.json({
      success: true,
      message: isRoleChange
        ? `Role updated to ${result.role} for ${result.name}.`
        : `User profile for ${result.name} updated successfully.`,
      user: sanitizeUser(result),
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Email address is already in use.' });
      return;
    }
    console.error('Error updating user:', error);
    res.status(500).json({ success: false, message: 'Failed to update user account.', error: error.message });
  }
});

/**
 * POST /api/management/users/:id/disable
 * Disables a user account, invalidates active sessions, and preserves last-admin rule
 */
userManagementRouter.post('/:id/disable', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requester = req.managementUser!;
    const { reason } = req.body || {};

    const target = await prisma.student.findUnique({
      where: { id },
    });

    if (!target) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    // Security Rule 1: Cannot disable own account
    if (target.id === requester.id) {
      res.status(400).json({
        success: false,
        message: 'Security policy violation: You cannot disable your own administrator account.',
      });
      return;
    }

    if (!target.isActive) {
      res.status(400).json({
        success: false,
        message: 'This account is already disabled.',
      });
      return;
    }

    // Security Rule 2: Cannot disable the last active administrator
    if (['ADMIN', 'HOSTEL_ADMIN'].includes(target.role)) {
      const activeAdmins = await prisma.student.count({
        where: { role: { in: ['ADMIN', 'HOSTEL_ADMIN'] }, isActive: true },
      });
      if (activeAdmins <= 1) {
        res.status(400).json({
          success: false,
          message: 'Cannot disable the last active system administrator.',
        });
        return;
      }
    }

    // Execute disable and session invalidation in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: { isActive: false },
      });

      // Instantly invalidate all active sessions for this disabled user
      await tx.session.deleteMany({
        where: { studentId: id },
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          studentId: requester.id,
          actionType: 'USER_MANAGEMENT',
          action: 'USER_DISABLED',
          actorRole: requester.role,
          entity: 'User',
          entityId: updated.id,
          previousState: 'ACTIVE',
          newState: 'DISABLED',
          description: `Account disabled for ${updated.name} (${updated.jntuNo}, ${updated.role}) by ${requester.name}. Reason: ${reason || 'Administrative action'}`,
          metadata: JSON.stringify({
            targetUserId: updated.id,
            jntuNo: updated.jntuNo,
            role: updated.role,
            reason: reason || 'Not specified',
          }),
        },
      });

      // Notification to affected user
      await notificationService.createNotification(
        {
          studentId: updated.id,
          title: 'Account Deactivated',
          message: `Your account has been deactivated by administration. Reason: ${reason || 'Administrative action'}`,
          type: 'WARNING',
          category: 'SYSTEM',
          priority: 'URGENT',
          createdBy: requester.jntuNo,
        },
        tx
      );

      return updated;
    });

    // Real-time SSE post-commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'USER_DISABLED',
      timestamp: new Date().toISOString(),
      details: {
        id: result.id,
        jntuNo: result.jntuNo,
        name: result.name,
      },
    });

    res.json({
      success: true,
      message: `Account for ${result.name} (${result.jntuNo}) has been disabled and all active sessions terminated.`,
      user: sanitizeUser(result),
    });
  } catch (error: any) {
    console.error('Error disabling user:', error);
    res.status(500).json({ success: false, message: 'Failed to disable user account.', error: error.message });
  }
});

/**
 * POST /api/management/users/:id/enable
 * Re-enables a disabled user account
 */
userManagementRouter.post('/:id/enable', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requester = req.managementUser!;

    const target = await prisma.student.findUnique({
      where: { id },
    });

    if (!target) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    if (target.isActive) {
      res.status(400).json({
        success: false,
        message: 'This account is already active.',
      });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.student.update({
        where: { id },
        data: { isActive: true },
      });

      // Audit Log
      await tx.activityLog.create({
        data: {
          studentId: requester.id,
          actionType: 'USER_MANAGEMENT',
          action: 'USER_ENABLED',
          actorRole: requester.role,
          entity: 'User',
          entityId: updated.id,
          previousState: 'DISABLED',
          newState: 'ACTIVE',
          description: `Account enabled for ${updated.name} (${updated.jntuNo}, ${updated.role}) by ${requester.name}`,
          metadata: JSON.stringify({
            targetUserId: updated.id,
            jntuNo: updated.jntuNo,
            role: updated.role,
          }),
        },
      });

      // Notification to restored user
      await notificationService.createNotification(
        {
          studentId: updated.id,
          title: 'Account Reactivated',
          message: 'Your hostel account has been restored and activated.',
          type: 'SUCCESS',
          category: 'SYSTEM',
          priority: 'NORMAL',
          createdBy: requester.jntuNo,
        },
        tx
      );

      return updated;
    });

    // Real-time SSE post-commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'USER_ENABLED',
      timestamp: new Date().toISOString(),
      details: {
        id: result.id,
        jntuNo: result.jntuNo,
        name: result.name,
      },
    });

    res.json({
      success: true,
      message: `Account for ${result.name} (${result.jntuNo}) has been successfully enabled.`,
      user: sanitizeUser(result),
    });
  } catch (error: any) {
    console.error('Error enabling user:', error);
    res.status(500).json({ success: false, message: 'Failed to enable user account.', error: error.message });
  }
});

/**
 * POST /api/management/users/:id/reset-password
 * Authoritative password reset with secure bcrypt hashing and session invalidation
 */
userManagementRouter.post('/:id/reset-password', async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const requester = req.managementUser!;
    const { newPassword } = req.body || {};

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({
        success: false,
        message: 'A valid new password of at least 6 characters is required.',
      });
      return;
    }

    const target = await prisma.student.findUnique({
      where: { id },
    });

    if (!target) {
      res.status(404).json({ success: false, message: 'User account not found.' });
      return;
    }

    // Role check: Only High-Privilege Administrators or authorized Wardens can reset passwords
    if (target.role !== 'STUDENT' && !HIGH_PRIVILEGE_ADMIN_ROLES.includes(requester.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Resetting staff or management passwords requires system administrator privileges.',
      });
      return;
    }

    // Secure bcrypt hashing
    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      await tx.student.update({
        where: { id },
        data: { passwordHash },
      });

      // Invalidate existing sessions so previous credentials cannot be used
      await tx.session.deleteMany({
        where: { studentId: id },
      });

      // Audit Log (Strictly avoiding logging the password or hash!)
      await tx.activityLog.create({
        data: {
          studentId: requester.id,
          actionType: 'SECURITY',
          action: 'PASSWORD_RESET',
          actorRole: requester.role,
          entity: 'User',
          entityId: target.id,
          previousState: 'PASSWORD_ACTIVE',
          newState: 'PASSWORD_RESET',
          description: `Password reset performed for ${target.name} (${target.jntuNo}) by ${requester.name}`,
          metadata: JSON.stringify({
            targetUserId: target.id,
            jntuNo: target.jntuNo,
            role: target.role,
            resetBy: requester.jntuNo,
          }),
        },
      });

      // Notification to user
      await notificationService.createNotification(
        {
          studentId: target.id,
          title: 'Security Alert: Password Reset',
          message: 'Your account password has been reset by administration. All active sessions have been terminated.',
          type: 'WARNING',
          category: 'SYSTEM',
          priority: 'URGENT',
          createdBy: requester.jntuNo,
        },
        tx
      );
    });

    // Real-time SSE post-commit
    complaintEventsService.emitManagementDashboardUpdate({
      type: 'USER_PASSWORD_RESET',
      timestamp: new Date().toISOString(),
      details: {
        id: target.id,
        jntuNo: target.jntuNo,
      },
    });

    res.json({
      success: true,
      message: `Password has been reset successfully for ${target.name} (${target.jntuNo}). Active sessions invalidated.`,
    });
  } catch (error: any) {
    console.error('Error resetting password:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password.', error: error.message });
  }
});

export default userManagementRouter;
