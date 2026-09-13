import { studentRealtimeClient } from './student-realtime';

export interface StudentUser {
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
}

export interface DashboardData {
  student: {
    id: string;
    jntuNo: string;
    name: string;
    email: string;
    role: string;
  };
  room: {
    status: 'ALLOCATED' | 'NOT_ALLOCATED' | 'PENDING';
    block?: string | null;
    roomNumber?: string | null;
    floor?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
  };
  outings: {
    active: number;
    usedThisMonth: number;
    limit: number;
  };
  mess: {
    bookedToday: number;
    meals: string[];
  };
  leaves: {
    active: number;
  };
  notifications: Array<{
    id: string;
    title: string;
    message: string;
    type: string;
    isRead: boolean;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    actionType: string;
    description: string;
    createdAt: string;
  }>;
}

export interface Roommate {
  id: string;
  name: string;
  jntuNo: string;
  bedNumber: string | null;
  allocationStatus: string;
  isCurrentStudent: boolean;
}

export interface MyRoomData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
  };
  allocation: {
    status: 'ALLOCATED' | 'NOT_ALLOCATED' | 'PENDING';
    block?: string | null;
    roomNumber?: string | null;
    floor?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
    allocatedAt?: string | null;
  };
  room: {
    block: string;
    roomNumber: string;
    floor: string;
    roomType: string;
    capacity: number;
    occupancy: number;
    occupancyStatus: string;
  } | null;
  roommates: Roommate[];
}

export interface HorizonDateItem {
  date: string;
  dayName: string;
  dayNumber: number;
  monthName: string;
  fullFormatted: string;
  isToday: boolean;
  isPast: boolean;
}

export interface BookingHorizon {
  startDate: string;
  endDate: string;
  horizonDays: number;
  dates: HorizonDateItem[];
}

export interface MessMealSlot {
  mealType: 'BREAKFAST' | 'LUNCH' | 'SNACKS' | 'DINNER';
  name: string;
  timing: string;
  description: string;
  status: 'AVAILABLE' | 'DRAFT' | 'BOOKED' | 'SKIPPED' | 'USED' | 'CLOSED' | 'EXPIRED' | 'UNAVAILABLE';
  isLocked?: boolean;
  attendanceIntent?: 'ATTENDING' | 'SKIPPED' | null;
  isBookingOpen?: boolean;
  deadlineTime?: string;
  deadlineFormatted?: string;
  timeRemainingSeconds?: number;
  token?: {
    id: string;
    tokenNumber?: string | null;
    date: string;
    mealType: string;
    status: string;
    isLocked?: boolean;
    attendanceIntent?: string | null;
    createdAt: string;
    timing?: string;
  } | null;
  draft?: {
    id: string;
    date: string;
    mealType: string;
    attendanceIntent: 'ATTENDING' | 'SKIPPED';
    updatedAt: string;
  } | null;
}

export interface ActiveMessToken {
  id: string;
  tokenNumber: string;
  date: string;
  mealType: string;
  mealName: string;
  timing: string;
  status: string;
  createdAt: string;
  studentName: string;
  jntuNo: string;
  blockName: string;
  roomNumber: string;
}

export interface MessTokenHistoryItem {
  id: string;
  tokenNumber?: string | null;
  date: string;
  mealType: string;
  mealName: string;
  timing: string;
  status: string;
  attendanceIntent?: string | null;
  createdAt: string;
}

export interface MessTokensData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
  };
  horizon?: BookingHorizon;
  selectedDate?: {
    date: string;
    formattedDate: string;
    isToday: boolean;
    summary: {
      totalMeals: number;
      bookedCount: number;
      skippedCount?: number;
      draftCount?: number;
      remainingCount: number;
      summaryStatus: string;
    };
    mealSlots: MessMealSlot[];
  };
  today: {
    date: string;
    formattedDate: string;
    summary: {
      totalMeals: number;
      bookedCount: number;
      skippedCount?: number;
      draftCount?: number;
      remainingCount: number;
      summaryStatus: string;
    };
    mealSlots: MessMealSlot[];
    activeTokensToday: ActiveMessToken[];
  };
  history: MessTokenHistoryItem[];
}

export interface StaticMessQrConfig {
  success: boolean;
  payload: string;
  entryPoint: string;
  title: string;
  description: string;
  isStatic: boolean;
}

export interface BookTokenResponse {
  success: boolean;
  message: string;
  token?: {
    id: string;
    tokenNumber: string;
    mealType: string;
    mealName: string;
    date: string;
    status: string;
    timing: string;
    createdAt: string;
  };
}

export interface OutingRequestItem {
  id: string;
  requestNumber?: string | null;
  studentId: string;
  passType: 'LOCAL_OUTING' | 'EMERGENCY' | 'NIGHT_OUT';
  destination?: string | null;
  purpose: string;
  emergencyContact?: string | null;
  remarks?: string | null;
  outDate: string;
  returnDate: string;
  actualExitTime?: string | null;
  actualReturnTime?: string | null;
  rejectionReason?: string | null;
  status: 'PENDING' | 'APPROVED' | 'OUT' | 'RETURNED' | 'REJECTED' | 'CANCELLED';
  createdAt: string;
  updatedAt: string;
}

export interface OutingSummary {
  currentStatus: string;
  activeCount: number;
  pendingCount: number;
  usedThisMonth: number;
  monthlyLimit: number;
  remainingThisMonth: number;
}

export interface OutingRequestsData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
    blockName?: string | null;
    roomNumber?: string | null;
  };
  summary: OutingSummary;
  requests: OutingRequestItem[];
}

export interface CreateOutingPayload {
  passType: 'LOCAL_OUTING' | 'EMERGENCY' | 'NIGHT_OUT';
  destination: string;
  purpose: string;
  outDate: string;
  returnDate: string;
  emergencyContact?: string;
  remarks?: string;
}

export interface CreateOutingResponse {
  success: boolean;
  message: string;
  request: OutingRequestItem;
}

export interface CancelOutingResponse {
  success: boolean;
  message: string;
  request: OutingRequestItem;
}

export interface ComplaintCommentItem {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface ComplaintAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  downloadUrl: string;
}

export interface ComplaintTimelineItem {
  step: string;
  label: string;
  description: string;
  timestamp?: string | null;
  completed: boolean;
}

export interface ComplaintItem {
  id: string;
  studentId: string;
  ticketNumber: string;
  category: string;
  title: string;
  description: string;
  location?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  assignedTo?: string | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  comments?: string | null;
  commentsList?: ComplaintCommentItem[];
  attachments?: ComplaintAttachment[];
  timeline?: ComplaintTimelineItem[];
  createdAt: string;
  updatedAt: string;
}


export interface ComplaintSummary {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  cancelled: number;
}

export interface ComplaintsData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    allocationStatus: string;
    blockName?: string | null;
    roomNumber?: string | null;
  };
  summary: ComplaintSummary;
  complaints: ComplaintItem[];
}

export interface CreateComplaintPayload {
  category: string;
  title: string;
  description: string;
  location?: string;
  priority?: string;
}

export interface CreateComplaintResponse {
  success: boolean;
  message: string;
  complaint: ComplaintItem;
}

export interface AddCommentResponse {
  success: boolean;
  message: string;
  comment: ComplaintCommentItem;
  complaint: ComplaintItem;
}

export interface CancelComplaintResponse {
  success: boolean;
  message: string;
  complaint: ComplaintItem;
}

export interface LeaveTimelineStep {
  step: string;
  title: string;
  timestamp: string;
  description: string;
  completed: boolean;
  current: boolean;
}

export interface LeaveRequestItem {
  id: string;
  requestNumber?: string | null;
  studentId: string;
  leaveType: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact: string | null;
  remarks: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  status: string;
  effectiveStatus: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  durationDays: number;
  createdAt: string;
  updatedAt: string;
  canCancel?: boolean;
  timeline?: LeaveTimelineStep[];
}

export interface SuspensionInfo {
  id: string;
  reason: string;
  startDate: string;
  endDate: string;
  createdBy: string;
  remarks?: string | null;
  status?: string;
}

export interface LeavesData {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  currentStatus: 'ACTIVE' | 'ON_LEAVE' | 'SUSPENDED';
  activeSuspension: SuspensionInfo | null;
  activeLeave: LeaveRequestItem | null;
  summary: {
    total: number;
    pending: number;
    approved: number;
    active: number;
    completed: number;
    rejected: number;
    cancelled: number;
  };
  requests: LeaveRequestItem[];
  suspensions?: SuspensionInfo[];
}

export interface CreateLeavePayload {
  leaveType: string;
  destination: string;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact?: string;
}

export interface NotificationItem {
  id: string;
  studentId: string;
  title: string;
  message: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS';
  category: 'OUTING' | 'LEAVE' | 'COMPLAINT' | 'MESS' | 'SUSPENSION' | 'ROOM' | 'SYSTEM';
  isRead: boolean;
  readAt?: string | null;
  entityId?: string | null;
  link?: string | null;
  metadata?: string | null;
  createdAt: string;
}

export interface NotificationsListData {
  success: boolean;
  notifications: NotificationItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  unreadCount: number;
  readCount: number;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: StudentUser;
}

const TOKEN_STORAGE_KEY = 'hms_student_auth_token';

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_STORAGE_KEY);
    } catch {
      return null;
    }
  },
  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } catch (e) {
      console.error('Failed to persist auth token', e);
    }
  },
  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      studentRealtimeClient.disconnect();
    } catch (e) {
      console.error('Failed to remove auth token', e);
    }
  },
};

export const apiService = {
  /**
   * Submit student credentials for authentication
   */
  async login(jntuNo: string, password: string): Promise<LoginResponse> {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ jntuNo, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Unable to sign in right now. Please try again.');
      }

      if (data.token) {
        authStorage.setToken(data.token);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to server. Please check your network connection.');
      }
      throw err;
    }
  },

  /**
   * Invalidate authenticated session on server and clear local token
   */
  async logout(): Promise<void> {
    const token = authStorage.getToken();
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.warn('Server logout error (proceeding with local clear):', e);
    } finally {
      authStorage.clearToken();
    }
  },

  /**
   * Fetch current session profile
   */
  async getMe(): Promise<StudentUser | null> {
    const token = authStorage.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/auth/me', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          authStorage.clearToken();
        }
        return null;
      }

      const data = await response.json();
      return data.user || null;
    } catch (err) {
      console.error('Session check error:', err);
      return null;
    }
  },

  /**
   * Fetch complete authenticated student dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/dashboard', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load your hostel dashboard.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's accommodation and room details
   */
  async getMyRoomData(): Promise<MyRoomData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/my-room', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load room information.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's mess tokens, meal slots, and booking history (optionally for a specific date)
   */
  async getMessTokensData(date?: string): Promise<MessTokensData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const url = date ? `/api/student/mess-tokens?date=${encodeURIComponent(date)}` : '/api/student/mess-tokens';
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load mess token information.');
    }

    return data;
  },

  /**
   * Save a draft attendance intent (ATTENDING or SKIPPED)
   */
  async saveMessDraft(
    mealType: string,
    date: string,
    attendanceIntent: 'ATTENDING' | 'SKIPPED'
  ): Promise<{ success: boolean; message: string; draft: any }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess-tokens/draft', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mealType, date, attendanceIntent }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to save draft intent.');
    }

    return data;
  },

  /**
   * Submit and authoritatively lock a meal indent
   */
  async lockMessIndent(
    mealType: string,
    date: string,
    attendanceIntent: 'ATTENDING' | 'SKIPPED'
  ): Promise<{ success: boolean; message: string; token: any }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess-tokens/lock', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mealType, date, attendanceIntent }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to lock meal indent.');
    }

    return data;
  },

  /**
   * Book an available meal token (legacy compatibility)
   */
  async bookMessToken(mealType: string, date?: string): Promise<BookTokenResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess-tokens/book', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ mealType, date }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to book mess token.');
    }

    return data;
  },

  /**
   * Fetch permanent static mess verification QR configuration
   */
  async getMessQrConfig(): Promise<StaticMessQrConfig> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/mess/qr', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load mess QR configuration.');
    }

    return data;
  },

  /**
   * Fetch student's outing summary, active status, and request history
   */
  async getOutingRequestsData(): Promise<OutingRequestsData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/outing-requests', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load outing requests.');
    }

    return data;
  },

  /**
   * Submit a new outing request
   */
  async createOutingRequest(payload: CreateOutingPayload): Promise<CreateOutingResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/outing-requests', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit outing request.');
    }

    return data;
  },

  /**
   * Cancel an eligible pending outing request
   */
  async cancelOutingRequest(id: string): Promise<CancelOutingResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/outing-requests/${id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to cancel outing request.');
    }

    return data;
  },

  /**
   * Fetch authenticated student's complaints data
   */
  async getComplaintsData(): Promise<ComplaintsData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/complaints', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load complaints.');
    }

    return data;
  },

  /**
   * Submit a new maintenance complaint
   */
  async createComplaint(payload: CreateComplaintPayload): Promise<CreateComplaintResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/complaints', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit complaint.');
    }

    return data;
  },

  /**
   * Add a follow-up note/comment to an active complaint
   */
  async addComplaintComment(id: string, comment: string): Promise<AddCommentResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}/comment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ comment }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to add note.');
    }

    return data;
  },

  /**
   * Cancel an eligible open complaint
   */
  async cancelComplaint(id: string): Promise<CancelComplaintResponse> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}/cancel`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Unable to cancel complaint.');
    }

    return data;
  },

  /**
   * Fetch complete authoritative complaint details including attachments and timeline
   * Phase 2 & 3
   */
  async getComplaintDetail(id: string): Promise<{ success: boolean; complaint: ComplaintItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/complaints/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        authStorage.clearToken();
      }
      throw new Error(data.message || 'Unable to load complaint details.');
    }

    return data;
  },

  /**
   * Upload an attachment to an existing complaint
   * Phase 5 & 6
   */
  async uploadComplaintAttachment(
    complaintId: string,
    file: File
  ): Promise<{ success: boolean; message: string; attachment: ComplaintAttachment }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/student/complaints/${complaintId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to upload attachment.');
    }

    return data;
  },

  /**
   * Subscribe to real-time complaint updates via unified Student SSE
   */
  subscribeToComplaintEvents(onEvent: (event: { type: string; complaintId: string; timestamp: string }) => void): () => void {
    return studentRealtimeClient.subscribe('complaint', onEvent);
  },

  /**
   * Fetch all leaves, active suspension, and summary stats
   */
  async getLeaves(): Promise<LeavesData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/leaves', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load leave information.');
    }
    return data;
  },

  /**
   * Fetch detailed authoritative leave record with timeline
   */
  async getLeaveDetail(id: string): Promise<{ success: boolean; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/leaves/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load leave details.');
    }
    return data;
  },

  /**
   * Apply for a new leave request
   */
  async createLeave(payload: CreateLeavePayload): Promise<{ success: boolean; message: string; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/leaves', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to submit leave application.');
    }
    return data;
  },

  /**
   * Cancel a pending leave request
   */
  async cancelLeave(id: string): Promise<{ success: boolean; message: string; leave: LeaveRequestItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/leaves/${id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to cancel leave request.');
    }
    return data;
  },

  /**
   * Subscribe to real-time leave & suspension events via unified Student SSE
   */
  subscribeToLeaveEvents(onEvent: (event: { type: string; leaveId?: string; suspensionId?: string; timestamp: string }) => void): () => void {
    return studentRealtimeClient.subscribe('leave', onEvent);
  },

  /**
   * Fetch paginated and filtered notifications list
   */
  async getNotifications(options: { page?: number; limit?: number; category?: string; unreadOnly?: boolean } = {}): Promise<NotificationsListData> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const params = new URLSearchParams();
    if (options.page) params.append('page', String(options.page));
    if (options.limit) params.append('limit', String(options.limit));
    if (options.category && options.category !== 'ALL') params.append('category', options.category);
    if (options.unreadOnly) params.append('unreadOnly', 'true');

    const queryString = params.toString();
    const url = `/api/student/notifications${queryString ? `?${queryString}` : ''}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load notifications.');
    }
    return data;
  },

  /**
   * Fetch a single notification detail
   */
  async getNotificationDetail(id: string): Promise<{ success: boolean; notification: NotificationItem }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/notifications/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Unable to load notification.');
    }
    return data;
  },

  /**
   * Mark a single notification as read
   */
  async markNotificationAsRead(id: string): Promise<{ success: boolean; notification: NotificationItem; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch(`/api/student/notifications/${id}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark notification as read.');
    }
    return data;
  },

  /**
   * Mark all unread notifications as read
   */
  async markAllNotificationsAsRead(): Promise<{ success: boolean; markedCount: number; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to mark all as read.');
    }
    return data;
  },

  /**
   * Get authoritative unread notification count
   */
  async getUnreadNotificationCount(): Promise<{ success: boolean; unreadCount: number }> {
    const token = authStorage.getToken();
    if (!token) {
      throw new Error('Authentication session missing.');
    }

    const response = await fetch('/api/student/notifications/unread-count', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Failed to retrieve unread notification count.');
    }
    return data;
  },

  /**
   * Subscribe to real-time notification events via unified Student SSE
   */
  subscribeToNotificationEvents(onEvent: (event: { type: string; notificationId?: string; unreadCount?: number; timestamp: string }) => void): () => void {
    return studentRealtimeClient.subscribe('notification', onEvent);
  },

  /**
   * Biometric Tracking APIs (Step 9)
   */
  async getBiometricOverview(params?: {
    page?: number;
    limit?: number;
    dateRange?: string;
    startDate?: string;
    endDate?: string;
    eventType?: string;
    verificationStatus?: string;
  }): Promise<BiometricOverviewData> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.dateRange) query.append('dateRange', params.dateRange);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.eventType) query.append('eventType', params.eventType);
    if (params?.verificationStatus) query.append('verificationStatus', params.verificationStatus);

    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`/api/student/biometric${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch biometric overview.');
    return data;
  },

  async getBiometricToday(): Promise<{
    success: boolean;
    today: BiometricTodayStatus;
    todayEvents: BiometricEventItem[];
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch('/api/student/biometric/today', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch today biometric state.');
    return data;
  },

  async getBiometricSummary(days: number = 7): Promise<{
    success: boolean;
    dailySummaries: DailyAttendanceSummary[];
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch(`/api/student/biometric/summary?days=${days}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch daily biometric summaries.');
    return data;
  },

  async getBiometricEventDetail(id: string): Promise<{
    success: boolean;
    event: BiometricEventItem;
  }> {
    const token = authStorage.getToken();
    if (!token) throw new Error('Authentication required.');

    const res = await fetch(`/api/student/biometric/events/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch biometric event details.');
    return data;
  },

  /**
   * Subscribe to real-time biometric events via unified Student SSE
   */
  subscribeToBiometricEvents(onEvent: (event: any) => void): () => void {
    return studentRealtimeClient.subscribe('biometric', onEvent);
  },

  /**
   * Subscribe to real-time room allocation events via unified Student SSE
   */
  subscribeToRoomEvents(onEvent: (event: any) => void): () => void {
    return studentRealtimeClient.subscribe('room', onEvent);
  },

  /**
   * Subscribe to real-time outing events via unified Student SSE
   */
  subscribeToOutingEvents(onEvent: (event: any) => void): () => void {
    return studentRealtimeClient.subscribe('outing', onEvent);
  },

  /**
   * Subscribe to real-time mess token events via unified Student SSE
   */
  subscribeToMessEvents(onEvent: (event: any) => void): () => void {
    return studentRealtimeClient.subscribe('mess', onEvent);
  },

  /**
   * Subscribe to all student events via unified Student SSE
   */
  subscribeToStudentEvents(onEvent: (event: any) => void): () => void {
    return studentRealtimeClient.subscribe('all', onEvent);
  },
};


export interface BiometricEventItem {
  id: string;
  studentId: string;
  eventType: 'ENTRY' | 'EXIT';
  direction: 'IN' | 'OUT';
  verificationStatus: 'VERIFIED' | 'REJECTED';
  eventTimestamp: string;
  source: string;
  gate: string | null;
  deviceId: string | null;
  deviceLabel: string | null;
  rejectionReason: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface BiometricTodayStatus {
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  statusLabel: string;
  firstEntry: string | null;
  lastExit: string | null;
  entryCount: number;
  exitCount: number;
  latestEvent: BiometricEventItem | null;
  approximateHoursInside: number;
}

export interface DailyAttendanceSummary {
  date: string;
  status: 'INSIDE_HOSTEL' | 'OUTSIDE_HOSTEL' | 'NO_RECORD';
  firstEntry: string | null;
  lastExit: string | null;
  entryCount: number;
  exitCount: number;
  totalEvents: number;
  approximateHoursInside: number;
}

export interface BiometricOverviewData {
  success: boolean;
  today: BiometricTodayStatus;
  events: BiometricEventItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/* =========================================================================
   STEP 10 — MANAGEMENT DASHBOARD TYPES & API SERVICE
   ========================================================================= */

export interface ManagementUser {
  id: string;
  jntuNo: string;
  name: string;
  email?: string | null;
  role: 'WARDEN' | 'CHIEF_WARDEN' | 'CHIEF_WARDEN_BOYS' | 'CHIEF_WARDEN_GIRLS' | 'ADMIN' | 'HOSTEL_ADMIN' | string;
  blockName?: string | null;
  hostelScope?: 'BOYS' | 'GIRLS' | 'ALL';
}

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
  totalCapacity: number;
  allocatedBeds: number;
  occupied: number;
  partiallyOccupied: number;
  vacant: number;
  occupancyPercentage: number;
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
  category: string;
  title: string;
  description: string;
  count: number;
  urgency: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  targetModule: string;
  isAvailable: boolean;
}

export interface ManagementActivityItem {
  id: string;
  activityType: string;
  description: string;
  timestamp: string;
  student: {
    name: string;
    jntuNo: string;
    blockName?: string | null;
    roomNumber?: string | null;
  } | null;
}

export interface ManagementBiometricLog {
  id: string;
  eventType: 'ENTRY' | 'EXIT';
  verificationStatus: 'VERIFIED' | 'REJECTED';
  eventTimestamp: string;
  gate: string | null;
  student: {
    name: string;
    jntuNo: string;
  };
}

export interface ManagementDashboardData {
  success: boolean;
  user?: ManagementUser;
  residents: ResidentPresenceMetrics;
  rooms: RoomOccupancyMetrics;
  requests: RequestMetrics;
  attention: AttentionItem[];
  recentActivity: ManagementActivityItem[];
  recentBiometricEvents: ManagementBiometricLog[];
  systemStatus?: {
    database: string;
    serverTime: string;
    biometricSync: string;
  };
}

export interface ManagementLoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: ManagementUser;
}

const MANAGEMENT_TOKEN_STORAGE_KEY = 'hms_management_auth_token';

let _inMemoryManagementToken: string | null = null;

export const managementAuthStorage = {
  getToken(): string | null {
    if (_inMemoryManagementToken) return _inMemoryManagementToken;
    try {
      const token =
        localStorage.getItem(MANAGEMENT_TOKEN_STORAGE_KEY) ||
        localStorage.getItem('managementToken') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem(MANAGEMENT_TOKEN_STORAGE_KEY) ||
        sessionStorage.getItem('managementToken') ||
        sessionStorage.getItem('token');
      if (token) {
        _inMemoryManagementToken = token;
        return token;
      }
    } catch {
      return null;
    }
    return null;
  },
  setToken(token: string): void {
    _inMemoryManagementToken = token;
    try {
      localStorage.setItem(MANAGEMENT_TOKEN_STORAGE_KEY, token);
      localStorage.setItem('managementToken', token);
      localStorage.setItem('token', token);
      sessionStorage.setItem(MANAGEMENT_TOKEN_STORAGE_KEY, token);
    } catch (e) {
      console.error('Failed to persist management auth token', e);
    }
  },
  clearToken(): void {
    _inMemoryManagementToken = null;
    try {
      localStorage.removeItem(MANAGEMENT_TOKEN_STORAGE_KEY);
      localStorage.removeItem('managementToken');
      localStorage.removeItem('token');
      sessionStorage.removeItem(MANAGEMENT_TOKEN_STORAGE_KEY);
    } catch (e) {
      console.error('Failed to remove management auth token', e);
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('management_auth_logout'));
    }
  },
};

export const managementApiService = {
  async login(identifier: string, password: string): Promise<ManagementLoginResponse> {
    try {
      const response = await fetch('/api/management/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Authentication failed. Please verify credentials.');
      }

      if (data.token) {
        managementAuthStorage.setToken(data.token);
      }

      return data;
    } catch (err: any) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Unable to connect to management service. Please check your connection.');
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    const token = managementAuthStorage.getToken();
    try {
      if (token) {
        await fetch('/api/management/auth/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (e) {
      console.warn('Management logout error:', e);
    } finally {
      managementAuthStorage.clearToken();
    }
  },

  async getMe(): Promise<ManagementUser | null> {
    const token = managementAuthStorage.getToken();
    if (!token) return null;

    try {
      const response = await fetch('/api/management/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          managementAuthStorage.clearToken();
        }
        return null;
      }

      const data = await response.json();
      return data.user || null;
    } catch (err) {
      console.error('Management session check error:', err);
      return null;
    }
  },

  async getDashboard(): Promise<ManagementDashboardData> {
    const token = managementAuthStorage.getToken();
    if (!token) {
      throw new Error('Management session missing. Please log in.');
    }

    const response = await fetch('/api/management/dashboard', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        managementAuthStorage.clearToken();
      }
      throw new Error(data.message || 'Failed to retrieve management dashboard data.');
    }

    // Backend wraps the authoritative data under the 'data' key
    // { success: true, data: { residents, rooms, requests, attention, recentActivity, recentBiometricEvents, systemStatus } }
    return { success: data.success, ...data.data } as ManagementDashboardData;
  },

  subscribeToEvents(
    onEvent: (event: any) => void,
    onConnectionChange?: (connected: boolean) => void
  ): () => void {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;
    let isClosed = false;

    const handleEvent = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data);
        onEvent(parsed);
      } catch (err) {
        console.error('Error parsing SSE management update:', err);
      }
    };

    const connect = () => {
      if (isClosed) return;
      try {
        const token = managementAuthStorage.getToken();
        if (!token) return;

        eventSource = new EventSource(`/api/management/events-stream?token=${encodeURIComponent(token)}`);

        eventSource.onopen = () => {
          onConnectionChange?.(true);
        };

        eventSource.addEventListener('connected', () => {
          onConnectionChange?.(true);
        });

        eventSource.addEventListener('management_dashboard_event', handleEvent);
        eventSource.addEventListener('management_dashboard_update', handleEvent);
        eventSource.onmessage = handleEvent;

        eventSource.onerror = () => {
          onConnectionChange?.(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }
          if (!isClosed) {
            reconnectTimeout = setTimeout(connect, 3000);
          }
        };
      } catch (err) {
        console.error('Failed to connect to management SSE stream:', err);
        onConnectionChange?.(false);
        if (!isClosed) {
          reconnectTimeout = setTimeout(connect, 5000);
        }
      }
    };

    connect();

    return () => {
      isClosed = true;
      onConnectionChange?.(false);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  },

  async getBlocks(params?: { search?: string; status?: string }): Promise<BlocksResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing. Please log in.');

    const query = new URLSearchParams();
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);

    const url = `/api/management/blocks${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch blocks.');
    }
    return data;
  },

  async getBlock(id: string): Promise<{ success: boolean; block: Block }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/blocks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to fetch block.');
    }
    return data;
  },

  async createBlock(dto: CreateBlockDto): Promise<{ success: boolean; message: string; block: Block }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/blocks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create block.');
    }
    return data;
  },

  async updateBlock(id: string, dto: UpdateBlockDto): Promise<{ success: boolean; message: string; block: Block }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/blocks/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update block.');
    }
    return data;
  },

  async deleteBlock(id: string): Promise<{ success: boolean; message: string; deletedId?: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/blocks/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete block.');
    }
    return data;
  },

  // ==================== ROOM MANAGEMENT (STEP 12) ====================

  async getRooms(params?: {
    blockId?: string;
    block?: string;
    status?: string;
    occupancy?: string;
    search?: string;
  }): Promise<RoomsResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing. Please log in.');

    const query = new URLSearchParams();
    if (params?.blockId) query.append('blockId', params.blockId);
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.occupancy && params.occupancy !== 'ALL') query.append('occupancy', params.occupancy);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());

    const url = `/api/management/rooms${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve rooms.');
    }
    return data;
  },

  async getRoom(id: string): Promise<{ success: boolean; room: RoomItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/rooms/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve room details.');
    }
    return data;
  },

  async createRoom(dto: CreateRoomDto): Promise<{ success: boolean; message: string; room: RoomItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/rooms', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to create room.');
    }
    return data;
  },

  async updateRoom(id: string, dto: UpdateRoomDto): Promise<{ success: boolean; message: string; room: RoomItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/rooms/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to update room.');
    }
    return data;
  },

  async deleteRoom(id: string): Promise<{ success: boolean; message: string; deletedId?: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/rooms/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to delete room.');
    }
    return data;
  },

  // ==================== ROOM ALLOCATION (STEP 12) ====================

  async getAllocations(params?: {
    roomId?: string;
    studentId?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; count: number; allocations: RoomAllocationItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.roomId) query.append('roomId', params.roomId);
    if (params?.studentId) query.append('studentId', params.studentId);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());

    const url = `/api/management/room-allocations${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve allocations.');
    }
    return data;
  },

  async getEligibleStudents(): Promise<{ success: boolean; count: number; students: EligibleStudent[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/room-allocations/eligible-students', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve eligible students.');
    }
    return data;
  },

  async allocateStudent(dto: AllocateStudentDto): Promise<{ success: boolean; message: string; allocation: RoomAllocationItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/room-allocations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to allocate room.');
    }
    return data;
  },

  async vacateStudent(allocationId: string): Promise<{ success: boolean; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/room-allocations/${allocationId}/vacate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to vacate room allocation.');
    }
    return data;
  },

  async reallocateStudent(allocationId: string, dto: ReallocateStudentDto): Promise<{ success: boolean; message: string; allocation: RoomAllocationItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/room-allocations/${allocationId}/reallocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to reallocate student.');
    }
    return data;
  },

  async getPendingAllocations(params?: {
    search?: string;
    block?: string;
    roomType?: string;
    biometricStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<PendingAllocationsResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.roomType && params.roomType !== 'ALL') query.append('roomType', params.roomType);
    if (params?.biometricStatus && params.biometricStatus !== 'ALL') query.append('biometricStatus', params.biometricStatus);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const url = `/api/management/room-allocations/pending${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve pending allocations.');
    }
    return data;
  },

  async rejectPendingAllocation(studentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/room-allocations/${studentId}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to reject pending allocation.');
    }
    return data;
  },

  async getMessOverview(date?: string): Promise<{ success: boolean; data: ManagementMessOverview }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`/api/management/mess/overview${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve mess overview.');
    }
    return data;
  },

  async getMessTokens(params?: {
    page?: number;
    limit?: number;
    date?: string;
    mealType?: string;
    status?: string;
    block?: string;
    search?: string;
  }): Promise<{
    success: boolean;
    tokens: ManagementMessToken[];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());
    if (params?.date) query.append('date', params.date);
    if (params?.mealType && params.mealType !== 'ALL') query.append('mealType', params.mealType);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.search) query.append('search', params.search);

    const url = `/api/management/mess/tokens${query.toString() ? `?${query.toString()}` : ''}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve mess tokens.');
    }
    return data;
  },

  async getMessToken(id: string): Promise<{ success: boolean; token: ManagementMessTokenDetail }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/tokens/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve mess token detail.');
    }
    return data;
  },

  async getStudentMessHistory(studentId: string): Promise<{
    success: boolean;
    student: {
      id: string;
      name: string;
      jntuNo: string;
      email: string;
      blockName?: string | null;
      roomNumber?: string | null;
      bedNumber?: string | null;
    };
    summary: {
      totalBooked: number;
      activeBooked: number;
      consumedCount: number;
      cancelledCount: number;
    };
    tokens: {
      id: string;
      tokenNumber: string;
      date: string;
      mealType: string;
      mealName: string;
      status: string;
      consumedAt?: string | null;
      cancelledAt?: string | null;
      cancellationReason?: string | null;
      createdAt: string;
    }[];
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/students/${studentId}/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to retrieve resident mess history.');
    }
    return data;
  },

  async consumeMessToken(id: string): Promise<{ success: boolean; message: string; token: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/tokens/${id}/consume`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to mark token as consumed.');
    }
    return data;
  },

  async cancelMessToken(id: string, reason: string): Promise<{ success: boolean; message: string; token: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/tokens/${id}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'Failed to cancel mess token.');
    }
    return data;
  },

  // --- Mess Management Enhancements (Step 4) ---
  async getMeals(): Promise<{ success: boolean; meals: ConfiguredMeal[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/mess/meals', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve meals.');
    return data;
  },

  async createMeal(payload: {
    name: string;
    startTime: string;
    endTime: string;
    isActive?: boolean;
    description?: string;
  }): Promise<{ success: boolean; message: string; meal: ConfiguredMeal }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/mess/meals', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create meal.');
    return data;
  },

  async updateMeal(
    id: string,
    payload: {
      name?: string;
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
      description?: string;
    }
  ): Promise<{ success: boolean; message: string; meal: ConfiguredMeal }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/meals/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update meal.');
    return data;
  },

  async toggleMealActive(id: string): Promise<{ success: boolean; message: string; meal: ConfiguredMeal }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/meals/${id}/toggle`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to toggle meal status.');
    return data;
  },

  async deleteMeal(id: string): Promise<{ success: boolean; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/mess/meals/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to delete meal.');
    return data;
  },

  async getMessAnalytics(date?: string): Promise<MessAnalyticsData> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await fetch(`/api/management/mess/analytics${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve analytics.');
    return data;
  },

  async getIndentPlan(params?: {
    date?: string;
    block?: string;
    year?: string;
    department?: string;
    search?: string;
  }): Promise<IndentPlanData> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.year && params.year !== 'ALL') query.append('year', params.year);
    if (params?.department && params.department !== 'ALL') query.append('department', params.department);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());

    const qs = query.toString();
    const res = await fetch(`/api/management/mess/indent-plan${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve indent plan.');
    return data;
  },

  async getMessAttendance(params?: {
    date?: string;
    mealType?: string;
    status?: string;
    block?: string;
    gender?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<MessAttendanceData> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.mealType && params.mealType !== 'ALL') query.append('mealType', params.mealType);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.gender && params.gender !== 'ALL') query.append('gender', params.gender);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(`/api/management/mess/attendance${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve attendance logs.');
    return data;
  },

  async exportMessAttendanceCsv(params?: {
    date?: string;
    mealType?: string;
    status?: string;
    block?: string;
    gender?: string;
    search?: string;
  }): Promise<Blob> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.mealType && params.mealType !== 'ALL') query.append('mealType', params.mealType);
    if (params?.status && params.status !== 'ALL') query.append('status', params.status);
    if (params?.block && params.block !== 'ALL') query.append('block', params.block);
    if (params?.gender && params.gender !== 'ALL') query.append('gender', params.gender);
    if (params?.search && params.search.trim()) query.append('search', params.search.trim());

    const qs = query.toString();
    const res = await fetch(`/api/management/mess/attendance/export/csv${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to export mess attendance CSV.');
    return await res.blob();
  },

  async getOutingStats(): Promise<{ success: boolean; data: OutingStats }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/outings/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load outing stats.');
    return data;
  },

  async getOutings(params?: OutingsQueryParams): Promise<OutingsListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.passType) query.append('passType', params.passType);
    if (params?.blockId) query.append('blockId', params.blockId);
    if (params?.date) query.append('date', params.date);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(`/api/management/outings${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load outing requests.');
    return data;
  },

  async getOutingDetail(id: string): Promise<{ success: boolean; data: ManagementOutingDetail }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/outings/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load outing details.');
    return data;
  },

  async approveOuting(id: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/outings/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve outing request.');
    return data;
  },

  async rejectOuting(id: string, reason: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/outings/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reject outing request.');
    return data;
  },

  // --- Leaves Management ---
  async getLeaveStats(): Promise<{ success: boolean; data: LeaveStats }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/leaves/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load leave stats.');
    return data;
  },

  async getLeaves(params?: LeavesQueryParams): Promise<LeavesListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.category) query.append('category', params.category);
    if (params?.search) query.append('search', params.search);
    if (params?.blockId) query.append('blockId', params.blockId);
    if (params?.date) query.append('date', params.date);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(`/api/management/leaves${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load leave requests.');
    return data;
  },

  async getLeaveDetail(id: string): Promise<{ success: boolean; data: ManagementLeaveDetail }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/leaves/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load leave details.');
    return data;
  },

  async approveLeave(id: string, remarks?: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/leaves/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ remarks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve leave request.');
    return data;
  },

  async rejectLeave(id: string, reason: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/leaves/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reject leave request.');
    return data;
  },

  // --- Disciplinary Suspensions ---
  async getSuspensions(params?: SuspensionsQueryParams): Promise<SuspensionsListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search) query.append('search', params.search);
    if (params?.page) query.append('page', params.page.toString());
    if (params?.limit) query.append('limit', params.limit.toString());

    const qs = query.toString();
    const res = await fetch(`/api/management/suspensions${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load suspensions.');
    return data;
  },

  async getSuspensionDetail(id: string): Promise<{ success: boolean; data: ManagementSuspensionDetail }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/suspensions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load suspension details.');
    return data;
  },

  async createSuspension(payload: CreateSuspensionPayload): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/suspensions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create suspension.');
    return data;
  },

  async endSuspension(id: string, remarks?: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/suspensions/${id}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ remarks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to lift suspension.');
    return data;
  },

  // Complaint & Maintenance Management
  async getComplaintStats(): Promise<{ success: boolean; data: ComplaintStats }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/complaints/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load complaint stats.');
    return data;
  },

  async getComplaints(params?: ComplaintQueryParams): Promise<ComplaintsListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.priority) searchParams.set('priority', params.priority);
    if (params?.category) searchParams.set('category', params.category);
    if (params?.assigned) searchParams.set('assigned', params.assigned);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const query = searchParams.toString();
    const res = await fetch(`/api/management/complaints${query ? `?${query}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load complaints.');
    return data;
  },

  async getComplaint(id: string): Promise<{ success: boolean; data: ManagementComplaintItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load complaint details.');
    return data;
  },

  async getMaintenanceStaff(): Promise<{ success: boolean; data: MaintenanceStaffMember[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/complaints/maintenance-staff', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load maintenance staff.');
    return data;
  },

  async assignComplaint(id: string, staffId: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ staffId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to assign complaint.');
    return data;
  },

  async startComplaint(id: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${id}/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to start complaint.');
    return data;
  },

  async resolveComplaint(id: string, resolutionNotes: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${id}/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ resolutionNotes }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to resolve complaint.');
    return data;
  },

  async closeComplaint(id: string): Promise<{ success: boolean; message: string; data: any }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${id}/close`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to close complaint.');
    return data;
  },

  async downloadComplaintAttachment(complaintId: string, attachmentId: string, fileName: string): Promise<void> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/complaints/${complaintId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('Failed to download attachment');
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },

  // Guest Billing Management
  async getGuestBillingOverview(): Promise<{ success: boolean; stats: GuestBillingStats }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/guest-billing/overview', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load guest billing overview.');
    return data;
  },

  async getHostStudents(search?: string): Promise<{ success: boolean; hosts: HostStudentItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const query = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`/api/management/guest-billing/hosts${query}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load host students.');
    return data;
  },

  async getGuests(params?: { page?: number; limit?: number; search?: string }): Promise<{
    success: boolean;
    guests: GuestItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.search) sp.set('search', params.search);

    const res = await fetch(`/api/management/guest-billing/guests?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load guests.');
    return data;
  },

  async getGuest(id: string): Promise<{ success: boolean; guest: GuestItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/guests/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load guest detail.');
    return data;
  },

  async createGuest(payload: {
    name: string;
    phone: string;
    email?: string;
    idProofType?: string;
    idProofNumber?: string;
    address?: string;
    relation?: string;
  }): Promise<{ success: boolean; message: string; guest: GuestItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/guest-billing/guests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to register guest.');
    return data;
  },

  async updateGuest(id: string, payload: Partial<GuestItem>): Promise<{ success: boolean; message: string; guest: GuestItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/guests/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update guest.');
    return data;
  },

  async getGuestVisits(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    guestId?: string;
    studentId?: string;
    date?: string;
  }): Promise<{
    success: boolean;
    visits: GuestVisitItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status && params.status !== 'ALL') sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.guestId) sp.set('guestId', params.guestId);
    if (params?.studentId) sp.set('studentId', params.studentId);
    if (params?.date) sp.set('date', params.date);

    const res = await fetch(`/api/management/guest-billing/visits?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load guest visits.');
    return data;
  },

  async getGuestVisit(id: string): Promise<{ success: boolean; visit: GuestVisitItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/visits/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load visit details.');
    return data;
  },

  async createGuestVisit(payload: {
    guestId: string;
    hostStudentId: string;
    purpose: string;
    checkInTime?: string;
    remarks?: string;
  }): Promise<{ success: boolean; message: string; visit: GuestVisitItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/guest-billing/visits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to register visit.');
    return data;
  },

  async checkoutGuestVisit(id: string, checkOutTime?: string): Promise<{ success: boolean; message: string; visit: GuestVisitItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/visits/${id}/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ checkOutTime }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to check out visit.');
    return data;
  },

  async getGuestBills(params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
    guestVisitId?: string;
  }): Promise<{
    success: boolean;
    bills: GuestBillItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const sp = new URLSearchParams();
    if (params?.page) sp.set('page', String(params.page));
    if (params?.limit) sp.set('limit', String(params.limit));
    if (params?.status && params.status !== 'ALL') sp.set('status', params.status);
    if (params?.search) sp.set('search', params.search);
    if (params?.guestVisitId) sp.set('guestVisitId', params.guestVisitId);

    const res = await fetch(`/api/management/guest-billing/bills?${sp.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load guest bills.');
    return data;
  },

  async getGuestBill(id: string): Promise<{ success: boolean; bill: GuestBillItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/bills/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load bill detail.');
    return data;
  },

  async createGuestBill(payload: {
    guestVisitId: string;
    billNumber?: string;
    items: { description: string; quantity: number; unitAmount: number }[];
  }): Promise<{ success: boolean; message: string; bill: GuestBillItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/guest-billing/bills', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create guest bill.');
    return data;
  },

  async recordGuestBillPayment(
    id: string,
    payload: {
      amount: number;
      paymentMethod: string;
      paymentReference?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; message: string; bill: GuestBillItem; payment: GuestPaymentRecord }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/bills/${id}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record payment.');
    return data;
  },

  async voidGuestBill(id: string, reason: string): Promise<{ success: boolean; message: string; bill: GuestBillItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/guest-billing/bills/${id}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to void bill.');
    return data;
  },

  async getLogHistory(filters?: {
    page?: number;
    pageSize?: number;
    action?: string;
    entity?: string;
    actorRole?: string;
    actorId?: string;
    from?: string;
    to?: string;
    search?: string;
  }): Promise<LogHistoryResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const query = new URLSearchParams();
    if (filters?.page) query.set('page', String(filters.page));
    if (filters?.pageSize) query.set('pageSize', String(filters.pageSize));
    if (filters?.action && filters.action !== 'ALL') query.set('action', filters.action);
    if (filters?.entity && filters.entity !== 'ALL') query.set('entity', filters.entity);
    if (filters?.actorRole && filters.actorRole !== 'ALL') query.set('actorRole', filters.actorRole);
    if (filters?.actorId) query.set('actorId', filters.actorId);
    if (filters?.from) query.set('from', filters.from);
    if (filters?.to) query.set('to', filters.to);
    if (filters?.search) query.set('search', filters.search);

    const res = await fetch(`/api/management/log-history?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch log history.');
    return data;
  },

  async getLogHistorySummary(): Promise<LogHistorySummaryResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/log-history/summary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch log history summary.');
    return data;
  },

  async getLogHistoryById(id: string): Promise<{ success: boolean; log: ActivityLogItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/log-history/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch audit log detail.');
    return data;
  },

  async getUsers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: string;
    status?: string;
  }): Promise<UserListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.search) query.set('search', params.search);
    if (params?.role && params.role !== 'ALL') query.set('role', params.role);
    if (params?.status && params.status !== 'ALL') query.set('status', params.status);

    const res = await fetch(`/api/management/users?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch users.');
    return data;
  },

  async getUserSummary(): Promise<UserSummaryResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/users/summary', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch user summary metrics.');
    return data;
  },

  async getUserRoles(): Promise<UserRolesResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/users/roles', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch roles.');
    return data;
  },

  async getUserById(id: string): Promise<{ success: boolean; user: UserAccountItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/users/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch user details.');
    return data;
  },

  async createUser(payload: {
    jntuNo: string;
    name: string;
    email: string;
    role: string;
    password: string;
    blockName?: string;
    roomNumber?: string;
    bedNumber?: string;
    roomType?: string;
    monthlyOutingMax?: number;
  }): Promise<{ success: boolean; message: string; user: UserAccountItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create user account.');
    return data;
  },

  async updateUser(id: string, payload: {
    name?: string;
    email?: string;
    role?: string;
    blockName?: string;
    roomNumber?: string;
    bedNumber?: string;
    roomType?: string;
    monthlyOutingMax?: number;
  }): Promise<{ success: boolean; message: string; user: UserAccountItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/users/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update user account.');
    return data;
  },

  async disableUser(id: string, reason?: string): Promise<{ success: boolean; message: string; user: UserAccountItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/users/${id}/disable`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to disable user account.');
    return data;
  },

  async enableUser(id: string): Promise<{ success: boolean; message: string; user: UserAccountItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/users/${id}/enable`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to enable user account.');
    return data;
  },

  async resetUserPassword(id: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/users/${id}/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ newPassword }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to reset user password.');
    return data;
  },

  // =========================================================================
  // FEE MANAGEMENT API METHODS
  // =========================================================================

  async getFeeKpiStats(): Promise<{ success: boolean; stats: FeeKpiStats }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/kpi-stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve KPI stats.');
    return data;
  },

  async getAcademicYears(): Promise<{ success: boolean; academicYears: AcademicYearItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/academic-years', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve academic years.');
    return data;
  },

  async createAcademicYear(dto: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }): Promise<{ success: boolean; academicYear: AcademicYearItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/academic-years', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create academic year.');
    return data;
  },

  async setCurrentAcademicYear(id: string): Promise<{ success: boolean; academicYear: AcademicYearItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/academic-years/${id}/set-current`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to set current academic year.');
    return data;
  },

  async getFeeStructures(query?: {
    module?: string;
    academicYearId?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; feeStructures: FeeStructureItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = new URLSearchParams();
    if (query?.module) p.set('module', query.module);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.category) p.set('category', query.category);
    if (query?.status) p.set('status', query.status);
    if (query?.search) p.set('search', query.search);

    const res = await fetch(`/api/management/fee-management/fee-structures?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve fee structures.');
    return data;
  },

  async createFeeStructure(dto: {
    academicYearId: string;
    module: string;
    category?: string;
    feeKind: string;
    name: string;
    amount: number;
    applicability?: any;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/fee-structures', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create fee structure.');
    return data;
  },

  async updateFeeStructure(
    id: string,
    dto: {
      name?: string;
      amount?: number;
      category?: string;
      feeKind?: string;
      applicability?: any;
      effectiveFrom?: string;
      effectiveTo?: string;
    }
  ): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/fee-structures/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update fee structure.');
    return data;
  },

  async toggleFeeStructureStatus(id: string): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/fee-structures/${id}/toggle-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to toggle fee structure status.');
    return data;
  },

  async getBankAccounts(): Promise<{ success: boolean; bankAccounts: BankAccountItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/bank-accounts', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve bank accounts.');
    return data;
  },

  async createBankAccount(dto: {
    name: string;
    accountIdentifier: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    kind: string;
    module?: string;
    displayLabel?: string;
  }): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/bank-accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create bank account.');
    return data;
  },

  async updateBankAccount(
    id: string,
    dto: {
      name?: string;
      bankName?: string;
      accountNumber?: string;
      ifsc?: string;
      kind?: string;
      module?: string;
      displayLabel?: string;
    }
  ): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/bank-accounts/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update bank account.');
    return data;
  },

  async toggleBankAccountStatus(id: string): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/bank-accounts/${id}/toggle-status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to toggle bank account status.');
    return data;
  },

  async getScholarshipTypes(): Promise<{ success: boolean; scholarshipTypes: ScholarshipTypeItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/scholarship-types', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve scholarship types.');
    return data;
  },

  async createScholarshipType(dto: {
    code: string;
    name: string;
    provider?: string;
    maxAmount?: number;
    description?: string;
  }): Promise<{ success: boolean; scholarshipType: ScholarshipTypeItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/scholarship-types', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create scholarship type.');
    return data;
  },

  async getStudentScholarships(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
    scholarshipTypeId?: string;
  }): Promise<{ success: boolean; scholarships: StudentScholarshipItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = new URLSearchParams();
    if (query?.studentSearch) p.set('studentSearch', query.studentSearch);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.status) p.set('status', query.status);
    if (query?.scholarshipTypeId) p.set('scholarshipTypeId', query.scholarshipTypeId);

    const res = await fetch(`/api/management/fee-management/scholarships?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve scholarships.');
    return data;
  },

  async assignScholarship(dto: {
    studentId: string;
    scholarshipTypeId: string;
    academicYearId: string;
    sanctionedAmount: number;
    referenceNumber?: string;
    remarks?: string;
  }): Promise<{ success: boolean; scholarship: StudentScholarshipItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/scholarships', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to assign scholarship.');
    return data;
  },

  async approveScholarship(id: string): Promise<{ success: boolean; scholarship: StudentScholarshipItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/scholarships/${id}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to approve scholarship.');
    return data;
  },

  async applyScholarship(id: string): Promise<{ success: boolean; appliedAmount: number; scholarship: StudentScholarshipItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/scholarships/${id}/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to apply scholarship.');
    return data;
  },

  async getDetentions(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
  }): Promise<{ success: boolean; detentions: DetentionItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = new URLSearchParams();
    if (query?.studentSearch) p.set('studentSearch', query.studentSearch);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.status) p.set('status', query.status);

    const res = await fetch(`/api/management/fee-management/detentions?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve detentions.');
    return data;
  },

  async createDetention(dto: {
    studentId: string;
    academicYearId: string;
    currentYearOfStudy: string;
    detainedYearOfStudy: string;
    reason: string;
    remarks?: string;
  }): Promise<{ success: boolean; detention: DetentionItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/detentions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record detention.');
    return data;
  },

  async revokeDetention(id: string, reason?: string): Promise<{ success: boolean; detention: DetentionItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-management/detentions/${id}/revoke`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to revoke detention.');
    return data;
  },

  async getInstitutionSettings(): Promise<{ success: boolean; settings: InstitutionSettingsItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/settings', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve settings.');
    return data;
  },

  async updateInstitutionSettings(dto: {
    institutionMode?: string;
    institutionName?: string;
    institutionCode?: string;
    enableScholarships?: boolean;
    enableDetentions?: boolean;
    enableBulkUploads?: boolean;
  }): Promise<{ success: boolean; settings: InstitutionSettingsItem; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-management/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update settings.');
    return data;
  },

  // =========================================================================
  // FEE COLLECTION API METHODS
  // =========================================================================

  async getStudentsWithFees(query?: {
    academicYearId?: string;
    search?: string;
    module?: string;
    paymentStatus?: string;
    dueStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<FeeCollectionStudentsResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = new URLSearchParams();
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.search) p.set('search', query.search);
    if (query?.module) p.set('module', query.module);
    if (query?.paymentStatus) p.set('paymentStatus', query.paymentStatus);
    if (query?.dueStatus) p.set('dueStatus', query.dueStatus);
    if (query?.page) p.set('page', query.page.toString());
    if (query?.limit) p.set('limit', query.limit.toString());

    const res = await fetch(`/api/management/fee-collection/students?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve students.');
    return data;
  },

  async getStudentFeeDetails(studentId: string, academicYearId?: string): Promise<StudentFeeDetailsResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = academicYearId ? `?academicYearId=${academicYearId}` : '';
    const res = await fetch(`/api/management/fee-collection/students/${studentId}${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve student details.');
    return data;
  },

  async recordPayment(dto: {
    studentId: string;
    academicYearId: string;
    feeItemId?: string;
    allocations?: Array<{ feeItemId: string; amount: number }>;
    amount: number;
    paymentMethod: 'UPI' | 'CHEQUE' | 'SBI_COLLECT';
    bankAccountId: string;
    upiApp?: string;
    upiReference?: string;
    chequeNumber?: string;
    bankName?: string;
    receivedBy?: string;
    sbiCollectReference?: string;
    verifiedBy?: string;
  }): Promise<RecordPaymentResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record payment.');
    return data;
  },

  async getReceiptDetails(receiptNumber: string): Promise<ReceiptDetailsResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch(`/api/management/fee-collection/receipts/${receiptNumber}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve receipt.');
    return data;
  },

  async getStudentPaymentHistory(studentId: string, academicYearId?: string): Promise<{ success: boolean; payments: FeePaymentItem[] }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const p = academicYearId ? `?academicYearId=${academicYearId}` : '';
    const res = await fetch(`/api/management/fee-collection/students/${studentId}/payment-history${p}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve payment history.');
    return data;
  },

  async processRefund(dto: {
    feeItemId: string;
    paymentId?: string;
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; refund: any; updatedFeeItem: any; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/refunds', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process refund.');
    return data;
  },

  async addExtraFee(dto: {
    studentId: string;
    academicYearId: string;
    feeType: string;
    module?: 'HOSTEL' | 'COLLEGE';
    amount?: number;
    isBiometricAttendance?: boolean;
    startDate?: string;
    endDate?: string;
    workingDays?: number;
    dailyRate?: number;
  }): Promise<{ success: boolean; feeItem: any; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/extra-fee', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add extra fee.');
    return data;
  },

  async promoteStudents(dto: {
    studentIds: string[];
    currentAcademicYearId: string;
    targetAcademicYearId: string;
    promotionType: 'SEMESTER' | 'ACADEMIC_YEAR';
  }): Promise<{ success: boolean; promotedCount: number; targetAcademicYear: any; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/promote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to promote students.');
    return data;
  },

  async syncFeeItems(academicYearId: string): Promise<{ success: boolean; createdCount: number; preservedCount: number; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/sync-fees', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ academicYearId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync fee items.');
    return data;
  },

  async sendFeeDueNotifications(dto: {
    academicYearId: string;
    studentIds?: string[];
    customMessage?: string;
  }): Promise<{ success: boolean; sentCount: number; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/send-notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send notifications.');
    return data;
  },

  async importFeeExcel(file: File): Promise<{
    success: boolean;
    totalRows: number;
    successRows: number;
    failedRows: number;
    errors: Array<{ row: number; error: string }>;
    message: string;
  }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/management/fee-collection/import-excel', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Excel import failed.');
    return data;
  },

  async bulkFeeAdjustment(dto: {
    feeItemIds: string[];
    adjustmentType: 'DISCOUNT' | 'FINE';
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; adjustedCount: number; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/bulk-adjust', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bulk adjustment failed.');
    return data;
  },

  async bulkRemoveFee(dto: {
    feeItemIds: string[];
    reason: string;
  }): Promise<{ success: boolean; removedCount: number; message: string }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');
    const res = await fetch('/api/management/fee-collection/bulk-remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Bulk removal failed.');
    return data;
  },

  async getOutingLogHistory(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    studentId?: string;
    requestNumber?: string;
    movementType?: string;
    status?: string;
    source?: string;
    from?: string;
    to?: string;
  }): Promise<OutingLogHistoryResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const params = new URLSearchParams();
    if (query?.page) params.append('page', query.page.toString());
    if (query?.pageSize) params.append('pageSize', query.pageSize.toString());
    if (query?.search) params.append('search', query.search);
    if (query?.studentId) params.append('studentId', query.studentId);
    if (query?.requestNumber) params.append('requestNumber', query.requestNumber);
    if (query?.movementType && query.movementType !== 'ALL') params.append('movementType', query.movementType);
    if (query?.status && query.status !== 'ALL') params.append('status', query.status);
    if (query?.source && query.source !== 'ALL') params.append('source', query.source);
    if (query?.from) params.append('from', query.from);
    if (query?.to) params.append('to', query.to);

    const res = await fetch(`/api/management/outing-log-history?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch outing log history.');
    return data;
  },

  async getOutingLogDetail(id: string): Promise<OutingLogDetailResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/outing-log-history/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch outing log detail.');
    return data;
  },

  // ==========================================================================
  // STEP 18: DEVICE MANAGEMENT
  // ==========================================================================
  async getDevices(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    type?: string;
    status?: string;
    enabled?: string;
    location?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<DeviceListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const params = new URLSearchParams();
    if (query?.page) params.append('page', query.page.toString());
    if (query?.pageSize) params.append('pageSize', query.pageSize.toString());
    if (query?.search && query.search.trim()) params.append('search', query.search.trim());
    if (query?.type && query.type !== 'ALL') params.append('type', query.type);
    if (query?.status && query.status !== 'ALL') params.append('status', query.status);
    if (query?.enabled && query.enabled !== 'ALL') params.append('enabled', query.enabled);
    if (query?.location && query.location !== 'ALL') params.append('location', query.location);
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const res = await fetch(`/api/management/devices?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch registered devices.');
    return data;
  },

  async getDeviceDetail(id: string): Promise<DeviceDetailResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch device details.');
    return data;
  },

  async createDevice(payload: CreateDevicePayload): Promise<CreateDeviceResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/devices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to register device.');
    return data;
  },

  async updateDevice(id: string, payload: UpdateDevicePayload): Promise<{ success: boolean; message: string; device: DeviceItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update device.');
    return data;
  },

  async enableDevice(id: string): Promise<{ success: boolean; message: string; device: DeviceItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}/enable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to enable device.');
    return data;
  },

  async disableDevice(id: string): Promise<{ success: boolean; message: string; device: DeviceItem }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}/disable`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to disable device.');
    return data;
  },

  async rotateDeviceCredential(id: string): Promise<RotateCredentialResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}/rotate-credential`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to rotate device credential.');
    return data;
  },

  async getDeviceActivity(id: string, page = 1, pageSize = 25): Promise<DeviceActivityResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/devices/${encodeURIComponent(id)}/activity?page=${page}&pageSize=${pageSize}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch device activity.');
    return data;
  },

  // ==========================================================================
  // STEP 19: ADMIN NOTIFICATIONS
  // ==========================================================================
  async getAdminNotifications(query?: {
    page?: number;
    pageSize?: number;
    search?: string;
    category?: string;
    priority?: string;
    status?: string;
    source?: string;
    studentId?: string;
    dateFrom?: string;
    dateTo?: string;
    fromDate?: string;
    toDate?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<AdminNotificationListResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const params = new URLSearchParams();
    if (query?.page) params.append('page', query.page.toString());
    if (query?.pageSize) params.append('pageSize', query.pageSize.toString());
    if (query?.search && query.search.trim()) params.append('search', query.search.trim());
    if (query?.category && query.category !== 'ALL') params.append('category', query.category);
    if (query?.priority && query.priority !== 'ALL') params.append('priority', query.priority);
    if (query?.status && query.status !== 'ALL') params.append('status', query.status);
    if (query?.source && query.source !== 'ALL') params.append('source', query.source);
    if (query?.studentId) params.append('studentId', query.studentId);
    const dFrom = query?.dateFrom || query?.fromDate;
    if (dFrom) params.append('dateFrom', dFrom);
    const dTo = query?.dateTo || query?.toDate;
    if (dTo) params.append('dateTo', dTo);
    if (query?.sortBy) params.append('sortBy', query.sortBy);
    if (query?.sortOrder) params.append('sortOrder', query.sortOrder);

    const res = await fetch(`/api/management/notifications?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch notification history.');
    return data;
  },

  async getAdminNotificationDetail(id: string): Promise<AdminNotificationDetailResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch(`/api/management/notifications/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch notification details.');
    return data;
  },

  async sendAdminNotification(payload: AdminSendNotificationPayload): Promise<AdminSendNotificationResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to send notification.');
    return data;
  },

  async resolveNotificationRecipients(params: {
    scope?: string;
    recipientScope?: string;
    studentId?: string;
    studentIds?: string[];
    recipientIds?: string[];
    blockName?: string;
    roomNumber?: string;
    targetRole?: string;
    roleName?: string;
  }): Promise<AdminRecipientResolveResponse> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const p = new URLSearchParams();
    const resolvedScope = params.scope || params.recipientScope || 'ALL_STUDENTS';
    p.set('scope', resolvedScope);
    if (params.studentId) p.set('studentId', params.studentId);
    const ids = params.studentIds || params.recipientIds;
    if (ids && ids.length > 0) p.set('studentIds', ids.join(','));
    if (params.blockName) p.set('blockName', params.blockName);
    if (params.roomNumber) p.set('roomNumber', params.roomNumber);
    const resolvedRole = params.targetRole || params.roleName;
    if (resolvedRole) p.set('targetRole', resolvedRole);

    const res = await fetch(`/api/management/notifications/recipients/resolve?${p.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to resolve recipients.');
    return data;
  },

  async getAdminNotificationStats(): Promise<{ success: boolean; stats: AdminNotificationKPIs }> {
    const token = managementAuthStorage.getToken();
    if (!token) throw new Error('Management session missing.');

    const res = await fetch('/api/management/notifications/stats', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch notification statistics.');
    return data;
  },
};


export interface Block {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  activeResidents?: number;
  totalRooms?: number;
  totalAllocations?: number;
  totalCapacity?: number;
  occupied?: number;
  vacant?: number;
  maintenance?: number;
  vacancyRate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlockDto {
  name: string;
  code: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface UpdateBlockDto {
  name?: string;
  code?: string;
  description?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface BlocksResponse {
  success: boolean;
  count: number;
  blocks: Block[];
  message?: string;
}

// Room Management Types
export interface RoomOccupant {
  allocationId: string;
  studentId: string;
  name: string;
  jntuNo: string;
  email: string;
  bedNumber?: string | null;
  allocatedAt: string;
}

export interface RoomItem {
  id: string;
  blockId: string;
  block: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  roomNumber: string;
  floor: number | null;
  roomType: string | null;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE';
  occupancy: number;
  availableBeds: number;
  occupancyStatus: 'Occupied' | 'Partially Occupied' | 'Vacant';
  activeOccupants: RoomOccupant[];
  history?: any[];
  createdAt: string;
  updatedAt: string;
}

export interface RoomsSummary {
  totalRooms: number;
  occupiedRooms: number;
  partiallyOccupiedRooms: number;
  vacantRooms: number;
  totalCapacity: number;
  allocatedBeds: number;
}

export interface RoomsResponse {
  success: boolean;
  count: number;
  summary: RoomsSummary;
  rooms: RoomItem[];
  message?: string;
}

export interface RoomAllocationItem {
  id: string;
  roomId: string;
  studentId: string;
  bedNumber?: string | null;
  status: 'ACTIVE' | 'VACATED' | 'REALLOCATED';
  allocatedAt: string;
  vacatedAt?: string | null;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    isActive?: boolean;
  };
  room: {
    id: string;
    roomNumber: string;
    floor?: number | null;
    capacity: number;
    roomType?: string | null;
    block: {
      id: string;
      name: string;
      code: string;
      status: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface EligibleStudent {
  id: string;
  name: string;
  jntuNo: string;
  email: string;
  allocationStatus: string;
}

export interface CreateRoomDto {
  blockId: string;
  roomNumber: string;
  floor?: number;
  roomType?: string;
  capacity: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE';
}

export interface UpdateRoomDto {
  blockId?: string;
  roomNumber?: string;
  floor?: number;
  roomType?: string;
  capacity?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE';
}

export interface AllocateStudentDto {
  roomId: string;
  studentId: string;
  bedNumber?: string;
}

export interface ReallocateStudentDto {
  targetRoomId: string;
  newBedNumber?: string;
}

export interface PendingAllocationItem {
  id: string;
  studentId: string;
  name: string;
  jntuNo: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  courseInfo: {
    degree: string;
    department: string;
    year: string;
    semester: string;
  };
  preferences: {
    roomPreference: string;
    sharingPreference: string;
    blockPreference: string;
    floorPreference: string;
  };
  documents: {
    biometricStatus: string;
    photos: string;
  };
  biometricEventsCount: number;
  lastBiometricEvent?: any;
}

export interface PendingAllocationsResponse {
  success: boolean;
  pendingCount: number;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: PendingAllocationItem[];
  message?: string;
}

export interface MealSlotTiming {
  mealType: string;
  name: string;
  timing: string;
  description: string;
}

export interface MealBreakdownItem {
  mealType: string;
  name: string;
  timing: string;
  description: string;
  total: number;
  booked: number;
  consumed: number;
  cancelled: number;
}

export interface BlockDistributionItem {
  blockName: string;
  total: number;
  booked: number;
  consumed: number;
  cancelled: number;
}

export interface ManagementMessOverview {
  date: string;
  isToday: boolean;
  totalActiveResidents: number;
  summary: {
    totalBookings: number;
    bookedCount: number;
    consumedCount: number;
    cancelledCount: number;
    consumptionRate: number;
  };
  activeMealSlot: MealSlotTiming | null;
  nextMealSlot: MealSlotTiming | null;
  mealBreakdown: MealBreakdownItem[];
  blockDistribution: BlockDistributionItem[];
}

export interface ManagementMessToken {
  id: string;
  tokenNumber: string | null;
  date: string;
  mealType: string;
  mealName: string;
  mealTiming: string;
  status: 'BOOKED' | 'CONSUMED' | 'CANCELLED';
  consumedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    blockName: string;
    roomNumber: string;
    bedNumber: string;
    allocationStatus: string;
  } | null;
}

export interface ManagementMessTokenDetail {
  id: string;
  tokenNumber: string | null;
  date: string;
  mealType: string;
  mealName: string;
  mealTiming: string;
  mealDescription: string;
  status: 'BOOKED' | 'CONSUMED' | 'CANCELLED';
  consumedAt?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
  createdAt: string;
  updatedAt: string;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    blockName?: string | null;
    floorName?: string | null;
    roomNumber?: string | null;
    bedNumber?: string | null;
    roomType?: string | null;
    allocationStatus: string;
    isActive: boolean;
  } | null;
}

export interface OutingStats {
  total: number;
  pending: number;
  approved: number;
  active: number;
  returned: number;
  rejected: number;
  todayOutgoing: number;
  todayIncoming: number;
}

export interface ManagementOutingStudent {
  id: string;
  name: string;
  jntuNo: string;
  email: string;
  blockName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  roomType?: string | null;
}

export interface ManagementOutingItem {
  id: string;
  requestNumber: string | null;
  passType: string;
  destination: string | null;
  purpose: string;
  emergencyContact: string | null;
  remarks: string | null;
  outDate: string;
  returnDate: string;
  actualExitTime: string | null;
  actualReturnTime: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  status: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'RETURNED' | 'REJECTED' | string;
  rawStatus: string;
  createdAt: string;
  updatedAt: string;
  student: ManagementOutingStudent | null;
}

export interface ManagementOutingDetail extends ManagementOutingItem {
  monthlyUsageCount: number;
  biometricEvents: Array<{
    id: string;
    eventType: string;
    verificationStatus: string;
    gate: string | null;
    eventTimestamp: string;
  }>;
}

export interface OutingsQueryParams {
  status?: string;
  search?: string;
  passType?: string;
  blockId?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface OutingsListResponse {
  success: boolean;
  data: ManagementOutingItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Leaves & Suspension Management Types
export interface LeaveStats {
  total: number;
  pending: number;
  approved: number;
  active: number;
  completed: number;
  rejected: number;
  cancelled: number;
  suspendedStudents: number;
}

export interface ManagementLeaveStudent {
  id: string;
  name: string;
  jntuNo: string;
  email: string;
  blockName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
}

export interface ManagementLeaveItem {
  id: string;
  requestNumber: string | null;
  leaveType: string;
  destination: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  reason: string;
  emergencyContact: string;
  remarks?: string | null;
  rejectionReason?: string | null;
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  status: string;
  effectiveStatus: 'PENDING' | 'APPROVED' | 'ACTIVE' | 'COMPLETED' | 'REJECTED' | 'CANCELLED' | string;
  createdAt: string;
  updatedAt: string;
  student: ManagementLeaveStudent | null;
}

export interface ManagementLeaveDetail extends ManagementLeaveItem {
  isSuspended: boolean;
  activeSuspension?: {
    id: string;
    reason: string;
    startDate: string;
    endDate: string;
  } | null;
}

export interface LeavesQueryParams {
  status?: string;
  category?: string;
  search?: string;
  blockId?: string;
  date?: string;
  page?: number;
  limit?: number;
}

export interface LeavesListResponse {
  success: boolean;
  data: ManagementLeaveItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ManagementSuspensionItem {
  id: string;
  studentId: string;
  reason: string;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'LIFTED' | 'EXPIRED' | string;
  effectiveStatus: 'ACTIVE' | 'LIFTED' | 'EXPIRED' | string;
  createdBy?: string | null;
  remarks?: string | null;
  liftedAt?: string | null;
  liftedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  student: ManagementLeaveStudent | null;
}

export interface ManagementSuspensionDetail extends ManagementSuspensionItem {}

export interface SuspensionsQueryParams {
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface SuspensionsListResponse {
  success: boolean;
  data: ManagementSuspensionItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateSuspensionPayload {
  studentId: string;
  reason: string;
  startDate: string;
  endDate: string;
  remarks?: string;
}

// Complaints & Maintenance Management Types
export interface ComplaintStats {
  total: number;
  open: number;
  assigned: number;
  inProgress: number;
  resolved: number;
  closed: number;
  highPriority: number;
  unassigned: number;
}

export interface ComplaintStudent {
  id: string;
  name: string;
  jntuNo: string;
  email?: string;
  blockName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
}

export interface ComplaintAttachmentItem {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
  downloadUrl: string;
}

export interface ManagementComplaintItem {
  id: string;
  ticketNumber?: string | null;
  category: string;
  title: string;
  description: string;
  location?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | string;
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED' | 'REJECTED' | string;
  assignedTo?: string | null;
  assignedToId?: string | null;
  assignedAt?: string | null;
  assignedBy?: string | null;
  resolutionNotes?: string | null;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  closedBy?: string | null;
  student: ComplaintStudent | null;
  attachments: ComplaintAttachmentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceStaffMember {
  id: string;
  name: string;
  jntuNo: string;
  email: string;
  role: string;
}

export interface ComplaintQueryParams {
  status?: string;
  priority?: string;
  category?: string;
  assigned?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ComplaintsListResponse {
  success: boolean;
  data: ManagementComplaintItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Guest Billing Management Interfaces
export interface GuestBillingStats {
  totalGuests: number;
  todayVisits: number;
  activeVisits: number;
  totalBills: number;
  unpaidAmount: number;
  paidAmount: number;
}

export interface GuestItem {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  idProofType?: string | null;
  idProofNumber?: string | null;
  address?: string | null;
  relation?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    visits: number;
  };
  visits?: GuestVisitItem[];
}

export interface HostStudentItem {
  id: string;
  name: string;
  jntuNo: string;
  email?: string;
  blockName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
}

export interface GuestVisitItem {
  id: string;
  guestId: string;
  guest?: GuestItem;
  hostStudentId: string;
  hostStudent?: HostStudentItem;
  purpose: string;
  visitDate: string;
  checkInTime: string;
  checkOutTime?: string | null;
  status: 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | string;
  remarks?: string | null;
  createdAt: string;
  updatedAt: string;
  bills?: GuestBillItem[];
}

export interface BillingItemRecord {
  id?: string;
  guestBillId?: string;
  description: string;
  quantity: number;
  unitAmount: number;
  totalAmount?: number;
  createdAt?: string;
}

export interface GuestPaymentRecord {
  id: string;
  guestBillId: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string | null;
  notes?: string | null;
  recordedBy?: string | null;
  createdAt: string;
}

export interface GuestBillItem {
  id: string;
  guestVisitId: string;
  guestVisit?: GuestVisitItem;
  billNumber: string;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  paymentStatus: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'VOID' | string;
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paidAt?: string | null;
  voidReason?: string | null;
  voidedAt?: string | null;
  voidedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  items: BillingItemRecord[];
  payments: GuestPaymentRecord[];
}

export interface ActivityLogItem {
  id: string;
  studentId: string;
  actor: {
    id: string;
    name: string;
    jntuNo: string;
    role: string;
    email: string;
  };
  actorRole: string;
  action: string;
  actionType: string;
  entity: string;
  entityId?: string | null;
  previousState?: string | null;
  newState?: string | null;
  description: string;
  metadata?: any;
  ipAddress?: string | null;
  createdAt: string;
}

export interface LogHistoryResponse {
  success: boolean;
  logs: ActivityLogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface LogHistorySummaryResponse {
  success: boolean;
  summary: {
    totalLogs: number;
    todayLogs: number;
    approvalLogs: number;
    financialLogs: number;
    securityLogs: number;
    adminLogs: number;
  };
}

export interface UserRoleOption {
  role: string;
  label: string;
  category: 'STUDENT' | 'SUPPORT' | 'MANAGEMENT' | string;
}

export interface UserRolesResponse {
  success: boolean;
  roles: UserRoleOption[];
}

export interface UserSummaryData {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  students: number;
  wardens: number;
  administrators: number;
  hostelAdmins: number;
  chiefWardens: number;
  messStaff: number;
  maintenanceStaff: number;
  managementStaff: number;
  supportStaff: number;
}

export interface UserSummaryResponse {
  success: boolean;
  summary: UserSummaryData;
}

export interface UserAccountItem {
  id: string;
  jntuNo: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  allocationStatus?: string;
  blockName?: string | null;
  floorName?: string | null;
  roomNumber?: string | null;
  bedNumber?: string | null;
  roomType?: string | null;
  roomCapacity?: number;
  monthlyOutingMax?: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sessions?: number;
    complaints?: number;
    outings?: number;
    leaves?: number;
  };
}

export interface UserListResponse {
  success: boolean;
  users: UserAccountItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// =========================================================================
// FEE MANAGEMENT & COLLECTION INTERFACES
// =========================================================================

export interface FeeKpiStats {
  feeStructuresCount: number;
  hostelDue: number;
  collegeDue: number;
  studentsWithDuesCount: number;
  scholarshipsPendingCount: number;
  activeDetentionsCount: number;
}

export interface AcademicYearItem {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    structures?: number;
    feeItems?: number;
    payments?: number;
    scholarships?: number;
    detentions?: number;
  };
}

export interface FeeStructureItem {
  id: string;
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  module: 'HOSTEL' | 'COLLEGE';
  category: string;
  feeKind: string;
  name: string;
  amount: number | string;
  applicability?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    feeItems?: number;
  };
}

export interface BankAccountItem {
  id: string;
  name: string;
  accountIdentifier: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  kind: string;
  module: string;
  displayLabel: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    payments?: number;
  };
}

export interface ScholarshipTypeItem {
  id: string;
  code: string;
  name: string;
  provider: string;
  maxAmount?: number | null;
  description?: string | null;
  status: string;
  createdAt: string;
}

export interface StudentScholarshipItem {
  id: string;
  studentId: string;
  student?: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  scholarshipTypeId: string;
  scholarshipType?: ScholarshipTypeItem;
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  sanctionedAmount: number | string;
  appliedAmount: number | string;
  remainingAmount: number | string;
  referenceNumber?: string | null;
  remarks?: string | null;
  status: 'ASSIGNED' | 'APPROVED' | 'APPLIED' | 'REJECTED' | 'CLOSED';
  approvedBy?: string | null;
  approvedAt?: string | null;
  appliedAt?: string | null;
  createdAt: string;
}

export interface DetentionItem {
  id: string;
  studentId: string;
  student?: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  currentYearOfStudy: string;
  detainedYearOfStudy: string;
  reason: string;
  status: 'ACTIVE' | 'REVOKED' | 'COMPLETED';
  detainedBy?: string | null;
  detainedAt: string;
  revokedBy?: string | null;
  revokedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface InstitutionSettingsItem {
  id: string;
  institutionMode: 'HOSTEL_ONLY' | 'COLLEGE_ONLY' | 'BOTH';
  institutionName: string;
  institutionCode: string;
  enableScholarships: boolean;
  enableDetentions: boolean;
  enableBulkUploads: boolean;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface FeeItemDetail {
  id: string;
  feeType: string;
  module: string;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  excessPaid: number;
  refundedAmount: number;
  paidPercent: number;
  status: string;
  isExtraFee: boolean;
  extraFeeDetails?: any;
}

export interface StudentFeeItemSummary {
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber: string | null;
    blockName: string | null;
    role: string;
  };
  academicYear: {
    id: string;
    code: string;
    name: string;
  };
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  excessPaid: number;
  refundedAmount: number;
  paidPercent: number;
  overallStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  hasActiveDetention: boolean;
  detentionDetails?: any;
  items: FeeItemDetail[];
}

export interface FeeCollectionStudentsResponse {
  success: boolean;
  academicYear: {
    id: string;
    code: string;
    name: string;
  } | null;
  students: StudentFeeItemSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FeePaymentItem {
  id: string;
  studentId: string;
  academicYearId: string;
  bankAccountId: string;
  bankAccount?: BankAccountItem;
  amount: number | string;
  paymentMethod: string;
  transactionReference: string;
  methodDetails?: string | null;
  status: string;
  receiptNumber: string;
  recordedBy: string;
  recordedById: string;
  createdAt: string;
  allocations?: Array<{
    id: string;
    amount: number | string;
    feeItem?: {
      id: string;
      feeType: string;
      totalFee: number;
      dueAmount: number;
    };
  }>;
  receipt?: {
    id: string;
    receiptNumber: string;
    receiptData: string;
  };
  refunds?: any[];
}

export interface StudentFeeDetailsResponse {
  success: boolean;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber: string | null;
    blockName: string | null;
  };
  academicYear: {
    id: string;
    code: string;
    name: string;
  };
  feeItems: any[];
  payments: FeePaymentItem[];
  detentions: any[];
  scholarships: any[];
}

export interface RecordPaymentResponse {
  success: boolean;
  payment: FeePaymentItem;
  receipt: {
    id: string;
    receiptNumber: string;
  };
  receiptDetails: any;
  message: string;
}

export interface ReceiptDetailsResponse {
  success: boolean;
  receipt: {
    id: string;
    receiptNumber: string;
    totalAmount: number | string;
    receiptData: string;
    createdAt: string;
    student: any;
    academicYear: any;
    payment: any;
  };
  snapshot: any;
}

export interface OutingLogItem {
  id: string;
  requestNumber: string;
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    blockName: string | null;
    roomNumber: string | null;
    bedNumber: string | null;
  };
  passType: string;
  destination: string | null;
  purpose: string;
  outDate: string;
  returnDate: string;
  actualExitTime: string | null;
  actualReturnTime: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  status: string;
  rawStatus: string;
  movementType: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'EXIT' | 'RETURN' | 'CANCELLED';
  source: 'BIOMETRIC_DEVICE' | 'MANUAL_GATE' | 'STUDENT_PORTAL' | 'MANAGEMENT_PORTAL';
  recordedBy: string;
  eventTimestamp: string;
  createdAt: string;
  updatedAt: string;
}

export interface OutingLogHistoryStats {
  todayRequests: number;
  todayApproved: number;
  todayExits: number;
  todayReturns: number;
  currentlyOutside: number;
}

export interface OutingLogHistoryResponse {
  success: boolean;
  records: OutingLogItem[];
  stats: OutingLogHistoryStats;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  message?: string;
}

export interface OutingTimelineStep {
  stage: string;
  label: string;
  status: 'COMPLETED' | 'PENDING' | 'REJECTED' | 'ACTIVE' | 'CANCELLED';
  timestamp: string | null;
  actor: string;
  source: string;
  details: string;
}

export interface OutingBiometricEvent {
  id: string;
  eventType: string;
  verificationStatus: string;
  gate: string | null;
  source: string;
  eventTimestamp: string;
}

export interface OutingLogDetail {
  outing: {
    id: string;
    requestNumber: string;
    passType: string;
    destination: string | null;
    purpose: string;
    emergencyContact: string | null;
    remarks: string | null;
    outDate: string;
    returnDate: string;
    actualExitTime: string | null;
    actualReturnTime: string | null;
    approvedAt: string | null;
    approvedBy: string | null;
    rejectedAt: string | null;
    rejectedBy: string | null;
    rejectionReason: string | null;
    status: string;
    rawStatus: string;
    createdAt: string;
    updatedAt: string;
  };
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    blockName: string | null;
    roomNumber: string | null;
    bedNumber: string | null;
    roomType?: string | null;
  } | null;
  timeline: OutingTimelineStep[];
  biometricEvents: OutingBiometricEvent[];
  activityLogs: Array<{
    id: string;
    action: string;
    entityType: string;
    performedBy: string;
    userRole: string;
    details: any;
    createdAt: string;
  }>;
}

export interface OutingLogDetailResponse {
  success: boolean;
  data: OutingLogDetail;
  message?: string;
}

// ============================================================================
// STEP 18: DEVICE MANAGEMENT TYPES
// ============================================================================

export interface DeviceItem {
  id: string;
  deviceIdentifier: string;
  name: string;
  deviceType: 'BIOMETRIC' | 'GATE_READER' | 'RFID' | 'TURNSTILE' | 'OTHER';
  location: string;
  description: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'MAINTENANCE' | 'DISABLED';
  isEnabled: boolean;
  hasApiKey: boolean;
  keyLastRotatedAt: string | null;
  lastSeenAt: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  firmwareVersion: string | null;
  maintenanceNotes: string | null;
  lastMaintenanceDate: string | null;
  configMetadata: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceTelemetry {
  totalEvents: number;
  verifiedEvents: number;
  rejectedEvents: number;
  lastEventTimestamp: string | null;
  lastEventType: string | null;
  lastGate: string | null;
}

export interface DeviceDetail extends DeviceItem {
  telemetry: DeviceTelemetry;
}

export interface DeviceKPIs {
  totalDevices: number;
  activeDevices: number;
  disabledDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  maintenanceDevices: number;
}

export interface DeviceListResponse {
  success: boolean;
  devices: DeviceItem[];
  stats: DeviceKPIs;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface DeviceDetailResponse {
  success: boolean;
  device: DeviceDetail;
  message?: string;
}

export interface CreateDevicePayload {
  name: string;
  deviceIdentifier: string;
  deviceType: string;
  location: string;
  description?: string;
  isEnabled?: boolean;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  maintenanceNotes?: string;
  configMetadata?: any;
}

export interface CreateDeviceResponse {
  success: boolean;
  message: string;
  device: DeviceItem;
  apiKey: string;
  warning: string;
}

export interface UpdateDevicePayload {
  name?: string;
  location?: string;
  deviceType?: string;
  description?: string;
  status?: string;
  isEnabled?: boolean;
  ipAddress?: string;
  macAddress?: string;
  firmwareVersion?: string;
  maintenanceNotes?: string;
  lastMaintenanceDate?: string | null;
  configMetadata?: any;
}

export interface RotateCredentialResponse {
  success: boolean;
  message: string;
  device: DeviceItem;
  apiKey: string;
  warning: string;
}

export interface DeviceActivityItem {
  id: string;
  action: string;
  actionType: string;
  performedBy: string;
  userRole: string;
  description: string;
  details: any;
  createdAt: string;
}

export interface DeviceActivityResponse {
  success: boolean;
  activity: DeviceActivityItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ==========================================
// STEP 19: ADMIN NOTIFICATIONS TYPES & INTERFACES
// ==========================================

export interface AdminNotificationItem {
  id: string;
  studentId: string;
  title: string;
  message: string;
  type: string;
  category: string;
  priority: string;
  source: string;
  createdBy: string | null;
  isRead: boolean;
  readAt: string | null;
  entityId: string | null;
  link: string | null;
  expiresAt: string | null;
  metadata: any;
  createdAt: string;
  student?: {
    id: string;
    fullName: string;
    jntuNo: string;
    roomNo: string | null;
    block: string | null;
    role: string;
  };
}

export interface AdminNotificationKPIs {
  total: number;
  unread: number;
  read: number;
  sentToday: number;
  system: number;
  announcements: number;
}

export interface AdminNotificationListResponse {
  success: boolean;
  notifications: AdminNotificationItem[];
  stats: AdminNotificationKPIs;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface AdminNotificationDetailResponse {
  success: boolean;
  notification: AdminNotificationItem;
}

export interface AdminSendNotificationPayload {
  title: string;
  message: string;
  category: string;
  priority?: string;
  recipientScope: 'INDIVIDUAL' | 'MULTIPLE' | 'ALL_STUDENTS' | 'BLOCK' | 'ROOM' | 'ROLE';
  recipientIds?: string[];
  blockName?: string;
  roomNumber?: string;
  roleName?: string;
  link?: string;
  entityId?: string;
  expiresAt?: string;
}

export interface AdminRecipientResolveResponse {
  success: boolean;
  count: number;
  sampleRecipients: Array<{
    id: string;
    fullName: string;
    jntuNo: string;
    roomNo?: string;
    block?: string;
  }>;
}

export interface AdminSendNotificationResponse {
  success: boolean;
  message: string;
  sentCount: number;
  recipientScope: string;
}

// ==========================================
// STEP 4: MESS MANAGEMENT TYPES & INTERFACES
// ==========================================

export interface ConfiguredMeal {
  id: string;
  mealType: string;
  name: string;
  startTime: string;
  endTime: string;
  isActive: boolean;
  description?: string | null;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  cutoffHour?: number | null;
  cutoffMinute?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MessAnalyticsCard {
  mealType: string;
  name: string;
  timing: string;
  totalScans: number;
  allowed: number;
  denied: number;
}

export interface MessAnalyticsData {
  success: boolean;
  date: string;
  cards: MessAnalyticsCard[];
  chart: {
    labels: string[];
    allowed: number[];
    denied: number[];
  };
  distribution: {
    totalScans: number;
    totalAllowed: number;
    totalDenied: number;
    allowedPercentage: number;
  };
}

export interface IndentMealSummary {
  mealType: string;
  name: string;
  expectedTotal: number;
  vegCount: number;
  nonVegCount: number;
}

export interface IndentStudentRecord {
  id: string;
  studentId: string;
  studentName: string;
  avatar: string;
  block: string;
  room: string;
  year: string;
  department: string;
  meal: string;
  dietaryPreference: string;
  status: 'CAME' | 'NOT CAME';
}

export interface IndentPlanData {
  success: boolean;
  date: string;
  summary: IndentMealSummary[];
  students: IndentStudentRecord[];
  totalStudents: number;
}

export interface AttendanceMealSummary {
  mealType: string;
  name: string;
  total: number;
  allowed: number;
  absent: number;
}

export interface AttendanceRecordItem {
  id: string;
  studentName: string;
  studentId: string;
  avatar: string;
  meal: string;
  mealType: string;
  status: 'Allowed' | 'Denied' | 'Absent';
  badge: string;
  date: string;
  time: string;
  block: string;
  gender: string;
}

export interface MessAttendanceData {
  success: boolean;
  date: string;
  summary: AttendanceMealSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  data: AttendanceRecordItem[];
}
