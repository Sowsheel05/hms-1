import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma.service';
import { config } from '../config';

export interface LoginResult {
  token: string;
  user: {
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

export class AuthService {
  /**
   * Validate JNTU number format (8-12 alphanumeric characters)
   */
  static isValidJntuFormat(jntuNo: string): boolean {
    const trimmed = jntuNo.trim();
    return /^[A-Za-z0-9]{8,12}$/.test(trimmed);
  }

  /**
   * Authenticate student using JNTU No. and Password
   */
  static async login(rawJntuNo: any, rawPassword: any): Promise<LoginResult> {
    // 1. Validation for empty or missing JNTU No.
    if (rawJntuNo === undefined || rawJntuNo === null || typeof rawJntuNo !== 'string' || rawJntuNo.trim().length === 0) {
      throw { status: 400, message: 'Please enter your JNTU number.' };
    }

    // 2. Validation for empty or missing Password (do NOT trim password)
    if (rawPassword === undefined || rawPassword === null || typeof rawPassword !== 'string' || rawPassword.length === 0) {
      throw { status: 400, message: 'Password is required.' };
    }

    const jntuNo = rawJntuNo.trim().toUpperCase();
    const password = rawPassword;

    if (!this.isValidJntuFormat(jntuNo)) {
      // Return generic credentials error without disclosing format internals
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 3. Lookup student in database
    const student = await prisma.student.findUnique({
      where: { jntuNo },
    });

    if (!student) {
      // Timing attack mitigation: compute dummy bcrypt hash so response time is uniform
      const dummyHash = await bcrypt.hash(String(Date.now()) + Math.random(), 10);
      await bcrypt.compare(password, dummyHash);
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 4. Verify password hash using bcrypt first (ensures credentials match before reporting account status)
    const isPasswordValid = await bcrypt.compare(password, student.passwordHash);
    if (!isPasswordValid) {
      throw { status: 401, message: 'Invalid JNTU No. or password.' };
    }

    // 5. Check if account is active or pending registration verification
    if (!student.isActive) {
      const application = await prisma.hostelApplication.findFirst({
        where: { studentId: student.id },
        orderBy: { createdAt: 'desc' },
      });

      if (application && (application.status === 'PENDING' || application.status === 'UNDER_REVIEW')) {
        throw {
          status: 403,
          message: 'Your registration is currently pending admin verification. You will be able to access the Student Portal after your application is approved.',
        };
      }

      if (application && application.status === 'REJECTED') {
        throw {
          status: 403,
          message: `Your registration application has been rejected. Reason: ${application.rejectionReason || 'Please contact the hostel administration office.'}`,
        };
      }

      throw {
        status: 403,
        message: 'This account is currently unavailable. Please contact the administrator.',
      };
    }

    // 6. Verify backend-determined role
    if (student.role !== 'STUDENT') {
      throw {
        status: 403,
        message: 'Access denied. Account is not permitted to access student portal.',
      };
    }

    // 7. Generate JWT session token
    const token = jwt.sign(
      {
        id: student.id,
        jntuNo: student.jntuNo,
        role: student.role,
      },
      config.jwtSecret,
      {
        expiresIn: '7d',
        jwtid: crypto.randomUUID(),
      }
    );

    // 8. Store session in database for server-authoritative invalidation
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await prisma.session.create({
      data: {
        token,
        studentId: student.id,
        expiresAt,
      },
    });

    return {
      token,
      user: {
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
      },
    };
  }

  /**
   * Invalidate session on logout
   */
  static async logout(token: string): Promise<boolean> {
    if (!token) return true;
    try {
      await prisma.session.deleteMany({
        where: { token },
      });
      return true;
    } catch (error) {
      console.error('Logout revocation error:', error);
      return false;
    }
  }

  /**
   * Retrieve student profile by ID
   */
  static async getStudentProfile(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        jntuNo: true,
        name: true,
        email: true,
        role: true,
        blockName: true,
        floorName: true,
        roomNumber: true,
        bedNumber: true,
        roomType: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (!student || !student.isActive) {
      throw { status: 404, message: 'This account is currently unavailable. Please contact the administrator.' };
    }

    return student;
  }

  /**
   * Public Student Registration & Hostel Application
   * Creates inactive student record and pending application for Admin review.
   */
  static async registerStudent(payload: {
    name: string;
    dob?: string;
    gender?: string;
    phone?: string;
    email: string;
    password: string;
    jntuNo: string;
    branch?: string;
    yearOfStudy?: string;
    section?: string;
    semester?: string;
    guardianName?: string;
    guardianRelation?: string;
    guardianPhone?: string;
    emergencyContact?: string;
    address?: string;
    preferredBlock?: string;
    preferredRoomType?: string;
    preferredFloor?: number;
    stayDuration?: string;
    foodPreference?: string;
    medicalConditions?: string;
  }) {
    const {
      name,
      dob,
      gender,
      phone,
      email,
      password,
      jntuNo: rawJntu,
      branch,
      yearOfStudy,
      section,
      semester,
      guardianName,
      guardianRelation,
      guardianPhone,
      emergencyContact,
      address,
      preferredBlock,
      preferredRoomType,
      preferredFloor,
      stayDuration,
      foodPreference,
      medicalConditions,
    } = payload;

    if (!rawJntu || typeof rawJntu !== 'string' || !rawJntu.trim()) {
      throw { status: 400, message: 'Student ID / Roll number is required.' };
    }
    const jntuNo = rawJntu.trim().toUpperCase();

    if (!this.isValidJntuFormat(jntuNo)) {
      throw { status: 400, message: 'Student ID / Roll number must be 8-12 alphanumeric characters.' };
    }

    if (!name || typeof name !== 'string' || !name.trim()) {
      throw { status: 400, message: 'Full name is required.' };
    }

    if (!email || typeof email !== 'string' || !email.trim() || !email.includes('@')) {
      throw { status: 400, message: 'Valid email address is required.' };
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw { status: 400, message: 'Password must be at least 6 characters long.' };
    }

    // Check existing student
    const existingStudent = await prisma.student.findFirst({
      where: {
        OR: [
          { jntuNo },
          { email: email.trim().toLowerCase() },
        ],
      },
      include: {
        hostelApplications: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (existingStudent) {
      if (existingStudent.isActive) {
        throw { status: 400, message: 'A student account with this Student ID or Email already exists. Please log in.' };
      }

      const latestApp = existingStudent.hostelApplications[0];
      if (latestApp && (latestApp.status === 'PENDING' || latestApp.status === 'UNDER_REVIEW')) {
        throw {
          status: 400,
          message: `A registration application (${latestApp.applicationNumber}) is already pending for this student ID.`,
        };
      }
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const applicationNumber = `HMS-REG-2026-${randNum}`;

    const [createdStudent, application] = await prisma.$transaction(async (tx) => {
      let student = existingStudent;
      if (!student) {
        student = await tx.student.create({
          data: {
            jntuNo,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            passwordHash,
            role: 'STUDENT',
            isActive: false, // Inactive until approved by Admin!
            allocationStatus: 'PENDING',
          },
          include: { hostelApplications: true },
        });
      } else {
        student = await tx.student.update({
          where: { id: student.id },
          data: {
            name: name.trim(),
            email: email.trim().toLowerCase(),
            passwordHash,
            isActive: false,
            allocationStatus: 'PENDING',
          },
          include: { hostelApplications: true },
        });
      }

      const app = await tx.hostelApplication.create({
        data: {
          applicationNumber,
          studentId: student.id,
          academicYear: '2026-2027',
          dob: dob?.trim() || null,
          gender: gender?.trim() || null,
          phone: phone?.trim() || null,
          branch: branch?.trim() || null,
          yearOfStudy: yearOfStudy?.trim() || null,
          section: section?.trim() || null,
          semester: semester?.trim() || null,
          guardianName: guardianName?.trim() || null,
          guardianRelation: guardianRelation?.trim() || null,
          guardianPhone: guardianPhone?.trim() || null,
          emergencyContact: emergencyContact?.trim() || null,
          address: address?.trim() || null,
          preferredBlock: preferredBlock?.trim() || null,
          preferredRoomType: preferredRoomType?.trim() || 'Non-AC Room (2 Sharing)',
          preferredFloor: preferredFloor ? Number(preferredFloor) : null,
          stayDuration: stayDuration?.trim() || 'Full Academic Year',
          foodPreference: foodPreference?.trim() || 'VEG',
          medicalConditions: medicalConditions?.trim() || null,
          status: 'PENDING',
        },
      });

      await tx.notification.create({
        data: {
          studentId: student.id,
          title: 'Registration Application Submitted',
          message: `Your registration application ${applicationNumber} has been submitted for Admin verification.`,
          type: 'INFO',
          category: 'ROOM',
          priority: 'NORMAL',
          source: 'SYSTEM',
        },
      });

      await tx.activityLog.create({
        data: {
          studentId: student.id,
          actionType: 'ROOM',
          action: 'CREATE',
          entity: 'HostelApplication',
          description: `Applicant submitted registration application ${applicationNumber}`,
          newState: 'PENDING',
        },
      });

      return [student, app];
    });

    return {
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      status: application.status,
      studentId: createdStudent.id,
      name: createdStudent.name,
      jntuNo: createdStudent.jntuNo,
    };
  }
}
