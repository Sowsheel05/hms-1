import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../services/prisma.service';

export interface AuthenticatedRequest extends Request {
  student?: {
    id: string;
    jntuNo: string;
    name: string;
    email: string;
    role: string;
    blockName?: string | null;
    floorName?: string | null;
    roomNumber?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
  };
}

export const authenticateStudent = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Authentication required. No session token provided.',
      });
      return;
    }

    const token = authHeader.split(' ')[1];

    // Check if session exists in DB and is not expired
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

    const student = session.student;

    if (!student.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently unavailable. Please contact the administrator.',
      });
      return;
    }

    if (student.role !== 'STUDENT') {
      res.status(403).json({
        success: false,
        message: 'Access denied. Account is not permitted to access student portal.',
      });
      return;
    }

    req.student = {
      id: student.id,
      jntuNo: student.jntuNo,
      name: student.name,
      email: student.email,
      role: student.role,
      blockName: student.blockName,
      floorName: student.floorName,
      roomNumber: student.roomNumber,
      bedNumber: student.bedNumber,
      roomType: student.roomType,
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to authenticate right now. Please try again.',
    });
  }
};
