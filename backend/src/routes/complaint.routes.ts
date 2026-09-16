import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { authenticateStudent, AuthenticatedRequest } from '../middleware/auth.middleware';
import { ALL_MANAGEMENT_ROLES } from '../middleware/management.middleware';
import { prisma } from '../services/prisma.service';
import { storageService } from '../services/storage.service';
import { complaintEventsService } from '../services/events.service';
import { notificationService } from '../services/notification.service';

const router = Router();

// Configure multer for memory storage with 5MB limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1,
  },
});

const handleSingleUpload = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  upload.single('file')(req as any, res as any, (err: any) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          success: false,
          message: 'File size exceeds the 5MB limit.',
        });
        return;
      }
      res.status(400).json({
        success: false,
        message: `Upload error: ${err.message}`,
      });
      return;
    } else if (err) {
      res.status(400).json({
        success: false,
        message: err.message || 'File upload failed.',
      });
      return;
    }
    next();
  });
};

export const VALID_CATEGORIES = [
  'ROOM',
  'ELECTRICAL',
  'PLUMBING',
  'CLEANING',
  'FURNITURE',
  'WIFI',
  'MESS',
  'SECURITY',
  'OTHER',
] as const;

export type ComplaintCategory = (typeof VALID_CATEGORIES)[number];

export const VALID_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type ComplaintPriority = (typeof VALID_PRIORITIES)[number];

function generateTicketNumber(category: string): string {
  const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const catTag = category.substring(0, 3).toUpperCase();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CMP-${dateStr}-${catTag}-${randomSuffix}`;
}

/**
 * Helper to compute timeline steps for a complaint
 */
function buildComplaintTimeline(complaint: any) {
  const timeline = [
    {
      step: 'LODGED',
      label: 'Complaint Submitted',
      description: 'Ticket generated and routed to maintenance team',
      timestamp: complaint.createdAt,
      completed: true,
    },
  ];

  if (complaint.status === 'CANCELLED') {
    timeline.push({
      step: 'CANCELLED',
      label: 'Complaint Cancelled',
      description: 'Withdrawn by student',
      timestamp: complaint.updatedAt,
      completed: true,
    });
  } else {
    timeline.push({
      step: 'IN_PROGRESS',
      label: 'Under Investigation',
      description:
        complaint.status === 'IN_PROGRESS'
          ? 'Maintenance technician assigned and inspecting issue'
          : complaint.status === 'RESOLVED' || complaint.status === 'CLOSED'
          ? 'Work inspected and completed'
          : 'Awaiting technician assignment',
      timestamp: complaint.status !== 'OPEN' ? complaint.updatedAt : null,
      completed: complaint.status === 'IN_PROGRESS' || complaint.status === 'RESOLVED' || complaint.status === 'CLOSED',
    });

    timeline.push({
      step: 'RESOLVED',
      label: 'Resolution & Sign-off',
      description:
        complaint.status === 'RESOLVED' || complaint.status === 'CLOSED'
          ? `Resolved on ${complaint.resolvedAt ? new Date(complaint.resolvedAt).toISOString() : 'completion'}`
          : 'Issue repaired and verified',
      timestamp: complaint.resolvedAt,
      completed: complaint.status === 'RESOLVED' || complaint.status === 'CLOSED',
    });
  }

  return timeline;
}

/**
 * GET /api/student/complaints/events
 * Phase 8: Server-Sent Events (SSE) real-time subscription for student complaints
 */
router.get('/complaints/events', authenticateStudent, (req: AuthenticatedRequest, res: Response): void => {
  if (!req.student) {
    res.status(401).json({
      success: false,
      message: 'Authentication required for real-time events.',
    });
    return;
  }

  // Set SSE HTTP response headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no', // Disable buffering for reverse proxies like Nginx
  });

  res.flushHeaders?.();

  // Register client into SSE service
  complaintEventsService.registerClient(req.student.id, res);
});

/**
 * GET /api/student/complaints
 * Returns student's complaints, status counts, and resolution notes
 */
router.get('/complaints', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Verify student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable. Please contact the administrator.',
      });
      return;
    }

    // 2. Fetch student's complaints with attachments
    const rawComplaints = await prisma.complaint.findMany({
      where: { studentId },
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Calculate summary metrics
    const total = rawComplaints.length;
    const open = rawComplaints.filter((c) => c.status === 'OPEN').length;
    const inProgress = rawComplaints.filter((c) => c.status === 'IN_PROGRESS').length;
    const resolved = rawComplaints.filter((c) => c.status === 'RESOLVED').length;
    const cancelled = rawComplaints.filter((c) => c.status === 'CANCELLED').length;

    // Parse follow-up comments JSON safely & format attachments
    const complaints = rawComplaints.map((c) => {
      let parsedComments: any[] = [];
      if (c.comments) {
        try {
          parsedComments = JSON.parse(c.comments);
        } catch {
          parsedComments = [];
        }
      }
      return {
        ...c,
        commentsList: parsedComments,
        attachments: c.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          createdAt: att.createdAt,
          downloadUrl: `/api/student/complaints/${c.id}/attachments/${att.id}`,
        })),
      };
    });

    res.status(200).json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        jntuNo: student.jntuNo,
        allocationStatus: student.allocationStatus,
        blockName: student.blockName,
        roomNumber: student.roomNumber,
      },
      summary: {
        total,
        open,
        inProgress,
        resolved,
        cancelled,
      },
      complaints,
    });
  } catch (error) {
    console.error('Error fetching complaints:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load complaints. Please try again.',
    });
  }
});

/**
 * GET /api/student/complaints/:id
 * Phase 2: Dedicated Complaint Detail API
 * Strictly enforces server-side ownership: returns 403 if complaint belongs to another student, 404 if missing.
 */
router.get('/complaints/:id', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    // Strict ownership verification: cannot view another student's complaint
    if (complaint.studentId !== studentId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to view this complaint.',
      });
      return;
    }

    let parsedComments: any[] = [];
    if (complaint.comments) {
      try {
        parsedComments = JSON.parse(complaint.comments);
      } catch {
        parsedComments = [];
      }
    }

    const formattedAttachments = complaint.attachments.map((att) => ({
      id: att.id,
      fileName: att.fileName,
      fileSize: att.fileSize,
      mimeType: att.mimeType,
      createdAt: att.createdAt,
      downloadUrl: `/api/student/complaints/${complaint.id}/attachments/${att.id}`,
    }));

    const timeline = buildComplaintTimeline(complaint);

    res.status(200).json({
      success: true,
      complaint: {
        ...complaint,
        commentsList: parsedComments,
        attachments: formattedAttachments,
        timeline,
      },
    });
  } catch (error) {
    console.error('Error fetching complaint details:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to load complaint details. Please try again.',
    });
  }
});

/**
 * POST /api/student/complaints
 * Submits a new hostel maintenance complaint
 */
router.post('/complaints', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;

    // 1. Verify student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
    });

    if (!student || !student.isActive) {
      res.status(404).json({
        success: false,
        message: 'This account is currently unavailable.',
      });
      return;
    }

    // 2. Validate input fields
    const { category, title, description, location, priority } = req.body;

    if (!category || typeof category !== 'string') {
      res.status(400).json({
        success: false,
        message: 'Complaint category is required.',
      });
      return;
    }

    const normalizedCategory = category.toUpperCase() as ComplaintCategory;
    if (!VALID_CATEGORIES.includes(normalizedCategory)) {
      res.status(400).json({
        success: false,
        message: `Invalid category. Supported categories: ${VALID_CATEGORIES.join(', ')}`,
      });
      return;
    }

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      res.status(400).json({
        success: false,
        message: 'Please provide a clear complaint title (at least 3 characters).',
      });
      return;
    }

    if (title.trim().length > 120) {
      res.status(400).json({
        success: false,
        message: 'Complaint title must not exceed 120 characters.',
      });
      return;
    }

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      res.status(400).json({
        success: false,
        message: 'Please describe your complaint in detail (at least 10 characters).',
      });
      return;
    }

    if (description.trim().length > 1000) {
      res.status(400).json({
        success: false,
        message: 'Complaint description must not exceed 1000 characters.',
      });
      return;
    }

    const normalizedPriority: ComplaintPriority =
      priority && VALID_PRIORITIES.includes(priority.toUpperCase() as ComplaintPriority)
        ? (priority.toUpperCase() as ComplaintPriority)
        : 'MEDIUM';

    // 3. Auto-populate location from student's room if omitted
    let finalLocation = typeof location === 'string' && location.trim().length > 0 ? location.trim() : null;
    if (!finalLocation && student.blockName && student.roomNumber) {
      finalLocation = `${student.blockName} - Room ${student.roomNumber}`;
    }

    // 4. Duplicate protection: check if same student submitted same category and title within past 3 minutes
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000);
    const recentDuplicate = await prisma.complaint.findFirst({
      where: {
        studentId,
        category: normalizedCategory,
        title: title.trim(),
        createdAt: { gte: threeMinutesAgo },
      },
    });

    if (recentDuplicate) {
      res.status(409).json({
        success: false,
        message: 'A similar complaint was recently submitted. Please wait before submitting duplicate tickets.',
      });
      return;
    }

    // 5. Generate ticket number and create complaint
    const ticketNumber = generateTicketNumber(normalizedCategory);

    const [newComplaint] = await prisma.$transaction([
      prisma.complaint.create({
        data: {
          ticketNumber,
          studentId,
          category: normalizedCategory,
          title: title.trim(),
          description: description.trim(),
          location: finalLocation,
          priority: normalizedPriority,
          status: 'OPEN', // Force initial status to OPEN
          comments: JSON.stringify([]),
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'COMPLAINT',
          description: `Raised ${normalizedCategory} complaint (${ticketNumber}): ${title.trim()}`,
        },
      }),
    ]);

    // Emit Real-time domain event after commit
    complaintEventsService.emitToStudent(studentId, {
      type: 'COMPLAINT_CREATED',
      complaintId: newComplaint.id,
      timestamp: new Date().toISOString(),
    });

    // Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Complaint Registered',
      message: `Ticket ${ticketNumber} (${normalizedCategory}) has been submitted: ${title.trim()}`,
      type: 'INFO',
      category: 'COMPLAINT',
      entityId: newComplaint.id,
      link: '/complaints',
    }).catch((err) => console.error('Error creating complaint notification:', err));

    res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully.',
      complaint: {
        ...newComplaint,
        commentsList: [],
        attachments: [],
        timeline: buildComplaintTimeline(newComplaint),
      },
    });
  } catch (error) {
    console.error('Error submitting complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to submit complaint. Please try again.',
    });
  }
});

/**
 * POST /api/student/complaints/:id/comment
 * Allows a student to add follow-up notes/comments to their own complaint
 */
router.post('/complaints/:id/comment', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;
    const { id } = req.params;
    const { comment } = req.body;

    if (!comment || typeof comment !== 'string' || comment.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Please provide a valid comment (at least 2 characters).',
      });
      return;
    }

    if (comment.trim().length > 500) {
      res.status(400).json({
        success: false,
        message: 'Comment must not exceed 500 characters.',
      });
      return;
    }

    // 1. Fetch complaint
    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    // 2. Strict authorization: Must belong to current student
    if (complaint.studentId !== studentId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to update this complaint.',
      });
      return;
    }

    // 3. Status rule: Cannot add comments on CANCELLED or RESOLVED complaints
    if (complaint.status === 'CANCELLED' || complaint.status === 'RESOLVED') {
      res.status(400).json({
        success: false,
        message: `Cannot add notes to a ${complaint.status.toLowerCase()} complaint.`,
      });
      return;
    }

    // 4. Append note to comments array
    let currentComments: any[] = [];
    if (complaint.comments) {
      try {
        currentComments = JSON.parse(complaint.comments);
      } catch {
        currentComments = [];
      }
    }

    const newCommentEntry = {
      const commentId = crypto.randomUUID();
      author: req.student.name || 'Student',
      text: comment.trim(),
      createdAt: new Date().toISOString(),
    };

    currentComments.push(newCommentEntry);

    const [updated] = await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: {
          comments: JSON.stringify(currentComments),
        },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'COMPLAINT',
          description: `Added note on complaint (${complaint.ticketNumber || complaint.id})`,
        },
      }),
    ]);

    // Emit Real-time domain event after commit
    complaintEventsService.emitToStudent(studentId, {
      type: 'COMPLAINT_COMMENT_ADDED',
      complaintId: id,
      timestamp: new Date().toISOString(),
    });

    // Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Follow-up Note Added',
      message: `A note was added to ticket ${complaint.ticketNumber || complaint.id}.`,
      type: 'INFO',
      category: 'COMPLAINT',
      entityId: id,
      link: '/complaints',
    }).catch((err) => console.error('Error creating comment notification:', err));

    res.status(200).json({
      success: true,
      message: 'Follow-up note added successfully.',
      comment: newCommentEntry,
      complaint: {
        ...updated,
        commentsList: currentComments,
        attachments: updated.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          createdAt: att.createdAt,
          downloadUrl: `/api/student/complaints/${updated.id}/attachments/${att.id}`,
        })),
        timeline: buildComplaintTimeline(updated),
      },
    });
  } catch (error) {
    console.error('Error adding comment to complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to add note. Please try again.',
    });
  }
});

/**
 * POST /api/student/complaints/:id/cancel
 * Allows a student to cancel their own OPEN complaint
 */
router.post('/complaints/:id/cancel', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;
    const { id } = req.params;

    // 1. Fetch complaint
    const complaint = await prisma.complaint.findUnique({
      where: { id },
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    // 2. Strict authorization: Must belong to current student
    if (complaint.studentId !== studentId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to cancel this complaint.',
      });
      return;
    }

    // 3. Status rule: Only OPEN complaints can be cancelled
    if (complaint.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        message: `Only open complaints can be cancelled. Current status is ${complaint.status}.`,
      });
      return;
    }

    // 4. Update status and record audit log in transaction
    const [updated] = await prisma.$transaction([
      prisma.complaint.update({
        where: { id },
        data: { status: 'CANCELLED' },
        include: {
          attachments: {
            orderBy: { createdAt: 'asc' },
          },
        },
      }),
      prisma.activityLog.create({
        data: {
          studentId,
          actionType: 'COMPLAINT',
          description: `Cancelled complaint (${complaint.ticketNumber || complaint.id})`,
        },
      }),
    ]);

    let parsedComments: any[] = [];
    if (updated.comments) {
      try {
        parsedComments = JSON.parse(updated.comments);
      } catch {
        parsedComments = [];
      }
    }

    // Emit Real-time domain event after commit
    complaintEventsService.emitToStudent(studentId, {
      type: 'COMPLAINT_CANCELLED',
      complaintId: id,
      timestamp: new Date().toISOString(),
    });

    // Persistent Notification
    await notificationService.createNotification({
      studentId,
      title: 'Complaint Cancelled',
      message: `Ticket ${complaint.ticketNumber || complaint.id} has been cancelled.`,
      type: 'INFO',
      category: 'COMPLAINT',
      entityId: id,
      link: '/complaints',
    }).catch((err) => console.error('Error creating complaint cancel notification:', err));

    res.status(200).json({
      success: true,
      message: 'Complaint cancelled successfully.',
      complaint: {
        ...updated,
        commentsList: parsedComments,
        attachments: updated.attachments.map((att) => ({
          id: att.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          createdAt: att.createdAt,
          downloadUrl: `/api/student/complaints/${updated.id}/attachments/${att.id}`,
        })),
        timeline: buildComplaintTimeline(updated),
      },
    });
  } catch (error) {
    console.error('Error cancelling complaint:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to cancel complaint. Please try again.',
    });
  }
});

/**
 * POST /api/student/complaints/:id/attachments
 * Phase 5: Upload attachment to complaint
 */
router.post(
  '/complaints/:id/attachments',
  authenticateStudent,
  handleSingleUpload,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.student) {
        res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
        return;
      }

      const studentId = req.student.id;
      const { id } = req.params;

      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'No file provided for upload.',
        });
        return;
      }

      // 1. Verify complaint exists
      const complaint = await prisma.complaint.findUnique({
        where: { id },
        include: { attachments: true },
      });

      if (!complaint) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found.',
        });
        return;
      }

      // 2. Authorize: Student must own this complaint
      if (complaint.studentId !== studentId) {
        res.status(403).json({
          success: false,
          message: 'You are not authorized to add attachments to this complaint.',
        });
        return;
      }

      // 3. Status rule: Cannot attach files to CANCELLED or RESOLVED complaints
      if (complaint.status === 'CANCELLED' || complaint.status === 'RESOLVED') {
        res.status(400).json({
          success: false,
          message: `Cannot attach files to a ${complaint.status.toLowerCase()} complaint.`,
        });
        return;
      }

      // 4. Max attachments check (max 5 per complaint)
      if (complaint.attachments.length >= 5) {
        res.status(400).json({
          success: false,
          message: 'Maximum of 5 attachments allowed per complaint.',
        });
        return;
      }

      // 5. Store file using storage abstraction (validates size, mime, magic bytes, path traversal)
      const saveResult = await storageService.saveFile(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // 6. Persist metadata in PostgreSQL transaction
      const [attachment] = await prisma.$transaction([
        prisma.attachment.create({
          data: {
            complaintId: id,
            studentId,
            fileName: saveResult.fileName,
            storedName: saveResult.storedName,
            mimeType: saveResult.mimeType,
            fileSize: saveResult.fileSize,
          },
        }),
        prisma.activityLog.create({
          data: {
            studentId,
            actionType: 'COMPLAINT',
            description: `Attached photo (${saveResult.fileName}) to complaint (${complaint.ticketNumber || complaint.id})`,
          },
        }),
      ]);

      // 7. Emit Real-time domain event after commit
      complaintEventsService.emitToStudent(studentId, {
        type: 'COMPLAINT_ATTACHMENT_ADDED',
        complaintId: id,
        timestamp: new Date().toISOString(),
      });

      res.status(201).json({
        success: true,
        message: 'Attachment uploaded successfully.',
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          fileSize: attachment.fileSize,
          mimeType: attachment.mimeType,
          createdAt: attachment.createdAt,
          downloadUrl: `/api/student/complaints/${id}/attachments/${attachment.id}`,
        },
      });
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload attachment.',
      });
    }
  }
);

/**
 * GET /api/student/complaints/:id/attachments
 * Phase 5: List attachment metadata for a complaint
 */
router.get('/complaints/:id/attachments', authenticateStudent, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.student) {
      res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
      return;
    }

    const studentId = req.student.id;
    const { id } = req.params;

    const complaint = await prisma.complaint.findUnique({
      where: { id },
      include: {
        attachments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!complaint) {
      res.status(404).json({
        success: false,
        message: 'Complaint not found.',
      });
      return;
    }

    if (complaint.studentId !== studentId) {
      res.status(403).json({
        success: false,
        message: 'You are not authorized to view attachments for this complaint.',
      });
      return;
    }

    res.status(200).json({
      success: true,
      attachments: complaint.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
        createdAt: att.createdAt,
        downloadUrl: `/api/student/complaints/${id}/attachments/${att.id}`,
      })),
    });
  } catch (error) {
    console.error('Error listing attachments:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to retrieve attachments.',
    });
  }
});

/**
 * Middleware: Authenticate either student owner or authorized management user
 */
interface AttachmentAccessRequest extends Request {
  student?: any;
  managementUser?: any;
}

const authenticateAttachmentAccess = async (
  req: AttachmentAccessRequest,
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
    } catch {
      res.status(401).json({
        success: false,
        message: 'Session verification failed.',
      });
      return;
    }

    const user = session.student;
    if (!user || !user.isActive) {
      res.status(403).json({
        success: false,
        message: 'This account is currently unavailable or inactive.',
      });
      return;
    }

    if (user.role === 'STUDENT') {
      req.student = user;
    } else if (ALL_MANAGEMENT_ROLES.includes(user.role)) {
      req.managementUser = user;
    } else {
      res.status(403).json({
        success: false,
        message: 'Access denied. Account lacks required role.',
      });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in authenticateAttachmentAccess:', error);
    res.status(500).json({ success: false, message: 'Authentication failed.' });
  }
};

/**
 * GET /api/student/complaints/:id/attachments/:attachmentId
 * Phase 5: Secure authenticated download/view of attachment
 * Allows owning student or authorized management roles (WARDEN, ADMIN, assigned MAINTENANCE_STAFF)
 */
router.get(
  '/complaints/:id/attachments/:attachmentId',
  authenticateAttachmentAccess,
  async (req: AttachmentAccessRequest, res: Response): Promise<void> => {
    try {
      const { id, attachmentId } = req.params;

      // 1. Verify complaint exists
      const complaint = await prisma.complaint.findUnique({
        where: { id },
      });

      if (!complaint) {
        res.status(404).json({
          success: false,
          message: 'Complaint not found.',
        });
        return;
      }

      // 2. Strict authorization check
      if (req.student) {
        // Student must own the complaint
        if (complaint.studentId !== req.student.id) {
          res.status(403).json({
            success: false,
            message: 'You are not authorized to access attachments from this complaint.',
          });
          return;
        }
      } else if (req.managementUser) {
        // MAINTENANCE_STAFF can only access attachments on assigned complaints
        if (req.managementUser.role === 'MAINTENANCE_STAFF' && complaint.assignedToId !== req.managementUser.id) {
          res.status(403).json({
            success: false,
            message: 'Access denied. You are not assigned to this complaint.',
          });
          return;
        }
      } else {
        res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
        return;
      }

      // 3. Find attachment
      const attachment = await prisma.attachment.findFirst({
        where: {
          id: attachmentId,
          complaintId: id,
        },
      });

      if (!attachment) {
        res.status(404).json({
          success: false,
          message: 'Attachment not found.',
        });
        return;
      }

      // 4. Double check attachment ownership for students
      if (req.student && attachment.studentId !== req.student.id) {
        res.status(403).json({
          success: false,
          message: 'Unauthorized access to attachment.',
        });
        return;
      }

      // 5. Safe file path resolution
      const safeFilePath = storageService.getFilePath(attachment.storedName);

      // 6. Serve file securely
      res.setHeader('Content-Type', attachment.mimeType);
      res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
      res.setHeader('Cache-Control', 'private, max-age=86400');
      res.sendFile(safeFilePath);
    } catch (error: any) {
      console.error('Error streaming attachment:', error);
      res.status(404).json({
        success: false,
        message: error.message || 'File not accessible.',
      });
    }
  }
);

export default router;
