import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../services/prisma.service';

export const MANAGEMENT_ROLES = [
  'WARDEN',
  'CHIEF_WARDEN',
  'CHIEF_WARDEN_BOYS',
  'CHIEF_WARDEN_GIRLS',
  'ADMIN',
  'HOSTEL_ADMIN',
];
export const MAINTENANCE_ROLE = 'MAINTENANCE_STAFF';
export const ALL_MANAGEMENT_ROLES = [...MANAGEMENT_ROLES, MAINTENANCE_ROLE];

export interface ManagementUser {
  id: string;
  jntuNo: string;
  name: string;
  email: string;
  role: string;
  blockName?: string | null;
  hostelScope?: 'BOYS' | 'GIRLS' | 'ALL';
}

export const resolveHostelScope = (role: string, blockName?: string | null): 'BOYS' | 'GIRLS' | 'ALL' => {
  if (role === 'CHIEF_WARDEN_BOYS') return 'BOYS';
  if (role === 'CHIEF_WARDEN_GIRLS') return 'GIRLS';
  if (blockName?.toLowerCase().includes('girls')) return 'GIRLS';
  if (blockName?.toLowerCase().includes('boys')) return 'BOYS';
  return 'ALL';
};

export interface AuthenticatedManagementRequest extends Request {
  managementUser?: ManagementUser;
}

/**
 * Server-Side RBAC Authentication Middleware for Management
 * Verifies that the requester is authenticated and holds an authorized management role.
 * Rejects unauthenticated requests with 401.
 * Rejects students and unauthorized roles with 403.
 */
export const authenticateManagement = async (
  req: AuthenticatedManagementRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    // Check if session exists in database and has not expired
    const session = await prisma.session.findUnique({
      where: { token },
      include: { student: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { token } }).catch(() => {});
      }
      res.status(401).json({
        success: false,
        message: 'Session expired or invalidated. Please sign in again.',
      });
      return;
    }

    // Verify cryptographic signature of JWT
    try {
      jwt.verify(token, config.jwtSecret);
    } catch (jwtErr) {
      res.status(401).json({
        success: false,
        message: 'Session verification failed.',
      });
      return;
    }

    const user = session.student;

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently inactive or suspended. Contact administration.',
      });
      return;
    }

    // Server-Side RBAC: Verify user role against authorized management roles (excludes MAINTENANCE_STAFF)
    if (!MANAGEMENT_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Account lacks management administrative privileges.',
      });
      return;
    }

    req.managementUser = {
      id: user.id,
      jntuNo: user.jntuNo,
      name: user.name,
      email: user.email,
      role: user.role,
      blockName: user.blockName,
      hostelScope: resolveHostelScope(user.role, user.blockName),
    };

    next();
  } catch (error) {
    console.error('Management authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to authenticate management session right now.',
    });
  }
};

/**
 * Extended middleware that accepts both management roles AND MAINTENANCE_STAFF.
 * Used for complaint management endpoints that maintenance staff can also access.
 */
export const authenticateManagementOrMaintenance = async (
  req: AuthenticatedManagementRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    } else if (typeof req.query.token === 'string' && req.query.token.trim().length > 0) {
      token = req.query.token.trim();
    }

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    const session = await prisma.session.findUnique({
      where: { token },
      include: { student: true },
    });

    if (!session || session.expiresAt < new Date()) {
      if (session) {
        await prisma.session.delete({ where: { token } }).catch(() => {});
      }
      res.status(401).json({
        success: false,
        message: 'Session expired or invalidated. Please sign in again.',
      });
      return;
    }

    try {
      jwt.verify(token, config.jwtSecret);
    } catch (jwtErr) {
      res.status(401).json({
        success: false,
        message: 'Session verification failed.',
      });
      return;
    }

    const user = session.student;

    if (!user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently inactive or suspended. Contact administration.',
      });
      return;
    }

    // Accept both management roles AND MAINTENANCE_STAFF
    if (!ALL_MANAGEMENT_ROLES.includes(user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Account lacks the required operational privileges.',
      });
      return;
    }

    req.managementUser = {
      id: user.id,
      jntuNo: user.jntuNo,
      name: user.name,
      email: user.email,
      role: user.role,
      blockName: user.blockName,
      hostelScope: resolveHostelScope(user.role, user.blockName),
    };

    next();
  } catch (error) {
    console.error('Management/Maintenance authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to authenticate session right now.',
    });
  }
};

/**
 * Fine-grained role check middleware factory.
 * Use after authenticateManagementOrMaintenance to restrict specific endpoints.
 */
export const requireRoles = (...roles: string[]) =>
  (req: AuthenticatedManagementRequest, res: Response, next: NextFunction): void => {
    if (!req.managementUser) {
      res.status(401).json({ success: false, message: 'Authentication required.' });
      return;
    }

    // Expand roles hierarchy:
    // If CHIEF_WARDEN or WARDEN is specified, both gender-specific Chief Wardens are also accepted.
    const allowed = new Set(roles);
    if (allowed.has('CHIEF_WARDEN') || allowed.has('WARDEN')) {
      allowed.add('CHIEF_WARDEN');
      allowed.add('CHIEF_WARDEN_BOYS');
      allowed.add('CHIEF_WARDEN_GIRLS');
    }

    if (!allowed.has(req.managementUser.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. This action requires one of: ${roles.join(', ')}.`,
      });
      return;
    }
    next();
  };

