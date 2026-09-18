import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.service';
import { config } from '../config';
import {
  authenticateManagement,
  AuthenticatedManagementRequest,
  MANAGEMENT_ROLES,
  ALL_MANAGEMENT_ROLES,
} from '../middleware/management.middleware';
import { managementService } from '../services/management.service';
import { complaintEventsService } from '../services/events.service';
import { loginRateLimiter } from '../middleware/rate-limiter';
import blockRoutes from './block.routes';
import { roomManagementRouter, roomAllocationRouter } from './room-management.routes';
import messManagementRouter from './mess-management.routes';
import outingManagementRouter from './outing-management.routes';
import { leaveManagementRouter, suspensionManagementRouter } from './leave-management.routes';
import complaintManagementRouter from './complaint-management.routes';
import guestBillingRouter from './guest-billing.routes';
import logHistoryRouter from './log-history.routes';
import userManagementRouter from './user-management.routes';
import feeManagementRouter from './fee-management.routes';
import feeCollectionRouter from './fee-collection.routes';
import outingLogHistoryRouter from './outing-log-history.routes';
import deviceRouter from './device.routes';
import adminNotificationRouter from './admin-notification.routes';
import hostelApplicationManagementRouter from './hostel-application-management.routes';
import { auditService } from '../services/audit.service';


const router = Router();

// Sub-routers
router.use('/blocks', blockRoutes);
router.use('/rooms', roomManagementRouter);
router.use('/room-allocations', roomAllocationRouter);
router.use('/mess', messManagementRouter);
router.use('/outings', outingManagementRouter);
router.use('/leaves', leaveManagementRouter);
router.use('/suspensions', suspensionManagementRouter);
router.use('/complaints', complaintManagementRouter);
router.use('/guest-billing', guestBillingRouter);
router.use('/log-history', logHistoryRouter);
router.use('/outing-log-history', outingLogHistoryRouter);
router.use('/devices', deviceRouter);
router.use('/users', userManagementRouter);
router.use('/fee-management', feeManagementRouter);
router.use('/fee-collection', feeCollectionRouter);
router.use('/notifications', adminNotificationRouter);
router.use('/hostel-applications', hostelApplicationManagementRouter);


/**
 * POST /api/management/auth/login
 * Authoritative Warden and Administrative personnel authentication
 * Enforces server-side RBAC: students are rejected with 403.
 */
router.post('/auth/login', loginRateLimiter, async (req, res): Promise<void> => {
  try {
    const { username, jntuNo, password } = req.body;
    const identifier = (username || jntuNo || '').trim().toUpperCase();

    if (!identifier) {
      res.status(400).json({
        success: false,
        message: 'Please enter your management staff identifier.',
      });
      return;
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
      return;
    }

    // Lookup user by JNTU / Staff ID or email
    const user = await prisma.student.findFirst({
      where: {
        OR: [
          { jntuNo: identifier },
          { email: identifier.toLowerCase() },
        ],
      },
    });

    if (!user) {
      // Dummy compare to mitigate timing attacks
      const dummyHash = await bcrypt.hash(String(Date.now()) + Math.random(), 10);
      await bcrypt.compare(password, dummyHash);
      res.status(401).json({
        success: false,
        message: 'Invalid management staff credentials.',
      });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently inactive. Contact the chief administrator.',
      });
      return;
    }

    // Server-Side RBAC Enforcement: Students are denied access to management login
    // ALL_MANAGEMENT_ROLES includes WARDEN, CHIEF_WARDEN, ADMIN, HOSTEL_ADMIN, MAINTENANCE_STAFF
    if (!ALL_MANAGEMENT_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Student accounts cannot access the management portal.',
      });
      return;
    }

    // Verify bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      res.status(401).json({
        success: false,
        message: 'Invalid management staff credentials.',
      });
      return;
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        jntuNo: user.jntuNo,
        role: user.role,
        portal: 'MANAGEMENT',
      },
      config.jwtSecret,
      {
        expiresIn: '7d',
        jwtid: crypto.randomUUID(),
      }
    );

    // Save session in PostgreSQL
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.session.create({
      data: {
        token,
        studentId: user.id,
        expiresAt,
      },
    });

    // Record login audit log asynchronously
    auditService
      .recordLog({
        actorId: user.id,
        actorRole: user.role,
        action: 'LOGIN',
        actionType: 'LOGIN',
        entity: 'Session',
        entityId: user.id,
        description: `Management user '${user.name}' (${user.role}) logged in successfully.`,
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
      })
      .catch((err) => console.error('Error recording login audit:', err));

    const hostelScope = user.role === 'CHIEF_WARDEN_BOYS'
      ? 'BOYS'
      : user.role === 'CHIEF_WARDEN_GIRLS'
        ? 'GIRLS'
        : user.blockName?.toLowerCase().includes('girls')
          ? 'GIRLS'
          : user.blockName?.toLowerCase().includes('boys')
            ? 'BOYS'
            : 'ALL';

    res.cookie('hms_management_auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.status(200).json({
      success: true,
      message: 'Management authentication successful.',
      token,
      user: {
        id: user.id,
        jntuNo: user.jntuNo,
        name: user.name,
        email: user.email,
        role: user.role,
        blockName: user.blockName,
        hostelScope,
      },
    });
  } catch (error) {
    console.error('Management login error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to sign in to management portal right now.',
    });
  }
});

/**
 * POST /api/management/auth/logout
 * Terminates active management session
 */
router.post('/auth/logout', async (req, res): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const session = await prisma.session.findUnique({
        where: { token },
        include: { student: true },
      });

      if (session) {
        await prisma.session.delete({ where: { token } }).catch(() => { });
        auditService
          .recordLog({
            actorId: session.student.id,
            actorRole: session.student.role,
            action: 'LOGOUT',
            actionType: 'LOGOUT',
            entity: 'Session',
            entityId: session.student.id,
            description: `Management user '${session.student.name}' logged out.`,
            ipAddress: (req.headers['x-forwarded-for'] as string) || req.ip || null,
          })
          .catch((err) => console.error('Error recording logout audit:', err));
      }
    }

    res.status(200).json({
      success: true,
      message: 'Management session terminated successfully.',
    });
  } catch (error) {
    console.error('Management logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during management logout.',
    });
  }
});

/**
 * GET /api/management/auth/me
 * Retrieves current authenticated management profile
 */
router.get(
  '/auth/me',
  authenticateManagement,
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Unauthenticated' });
      return;
    }

    res.status(200).json({
      success: true,
      user: req.managementUser,
    });
  }
);

/**
 * GET /api/management/dashboard
 * Aggregated authoritative operational management dashboard
 */
router.get(
  '/dashboard',
  authenticateManagement,
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    try {
      const data = await managementService.getDashboardData(req.managementUser?.hostelScope);
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error: any) {
      console.error('Error retrieving management dashboard data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve operational dashboard data.',
      });
    }
  }
);

// Short-lived single-use SSE ticket cache (ticketId -> { user: ManagementUser, expiresAt: number })
const sseTicketCache = new Map<string, { user: any; expiresAt: number }>();

// Periodic cleanup of expired SSE tickets every 60s
setInterval(() => {
  const now = Date.now();
  for (const [ticket, data] of sseTicketCache.entries()) {
    if (data.expiresAt < now) {
      sseTicketCache.delete(ticket);
    }
  }
}, 60000);

/**
 * POST /api/management/events-stream/ticket
 * Issue a short-lived (30s) single-use ticket for establishing SSE connection without exposing JWT token in URL
 */
router.post(
  '/events-stream/ticket',
  authenticateManagement,
  (req: AuthenticatedManagementRequest, res: Response): void => {
    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    const ticket = crypto.randomUUID();
    sseTicketCache.set(ticket, {
      user: req.managementUser,
      expiresAt: Date.now() + 30000, // 30 seconds expiration
    });

    res.status(200).json({ success: true, ticket });
  }
);

/**
 * GET /api/management/events-stream
 * Real-time SSE Stream for Management Dashboards (supports short-lived ticket or header auth)
 */
router.get(
  '/events-stream',
  async (req: AuthenticatedManagementRequest, res: Response): Promise<void> => {
    const ticketParam = req.query.ticket;
    if (typeof ticketParam === 'string' && ticketParam.trim().length > 0) {
      const ticketData = sseTicketCache.get(ticketParam.trim());
      if (ticketData && ticketData.expiresAt > Date.now()) {
        sseTicketCache.delete(ticketParam.trim()); // Single-use consumption
        req.managementUser = ticketData.user;
      } else {
        if (ticketData) sseTicketCache.delete(ticketParam.trim());
        res.status(401).json({ success: false, message: 'Invalid or expired SSE connection ticket.' });
        return;
      }
    } else {
      // Fallback to standard management middleware verification
      await new Promise<void>((resolve) => {
        authenticateManagement(req, res, () => {
          resolve();
        });
      });
    }

    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    complaintEventsService.registerManagementClient(req.managementUser.id, res);
  }
);

export default router;
