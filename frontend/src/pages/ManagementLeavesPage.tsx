import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  UserCheck,
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  User,
  Calendar,
  ShieldAlert,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Phone,
  PlusCircle,
  Unlock,
  AlertCircle,
  Building,
  LayoutGrid,
  List,
  Edit2,
} from 'lucide-react';
import {
  managementApiService,
  LeaveStats,
  ManagementLeaveItem,
  ManagementLeaveDetail,
  ManagementSuspensionItem,
  Block,
} from '../services/api';

interface ManagementLeavesPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementLeavesPage: React.FC<ManagementLeavesPageProps> = () => {
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'leaves' | 'suspensions'>('leaves');

  // Authoritative View Mode (Cards / Table)
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Statistics State
  const [stats, setStats] = useState<LeaveStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Leave Requests State
  const [leaves, setLeaves] = useState<ManagementLeaveItem[]>([]);
  const [isLeavesLoading, setIsLeavesLoading] = useState<boolean>(true);
  const [leavesPagination, setLeavesPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Leave Filters
  const [leaveStatusFilter, setLeaveStatusFilter] = useState<string>('ALL');
  const [leaveCategoryFilter, setLeaveCategoryFilter] = useState<string>('ALL');
  const [leaveSearchTerm, setLeaveSearchTerm] = useState<string>('');
  const [leaveBlockFilter, setLeaveBlockFilter] = useState<string>('ALL');
  const [leaveGenderFilter, setLeaveGenderFilter] = useState<string>('ALL');
  const [leaveYearFilter, setLeaveYearFilter] = useState<string>('ALL');
  const [leaveDateFilter, setLeaveDateFilter] = useState<string>('');

  // Suspensions State
  const [suspensions, setSuspensions] = useState<ManagementSuspensionItem[]>([]);
  const [isSuspensionsLoading, setIsSuspensionsLoading] = useState<boolean>(true);
  const [suspPagination, setSuspPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // Suspension Filters
  const [suspStatusFilter, setSuspStatusFilter] = useState<string>('ALL');
  const [suspSearchTerm, setSuspSearchTerm] = useState<string>('');
  const [suspBlockFilter, setSuspBlockFilter] = useState<string>('ALL');
  const [suspGenderFilter, setSuspGenderFilter] = useState<string>('ALL');
  const [suspYearFilter, setSuspYearFilter] = useState<string>('ALL');

  // Blocks for filter
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Live SSE Status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Toast Feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals: Leave Details
  const [selectedLeaveDetail, setSelectedLeaveDetail] = useState<ManagementLeaveDetail | null>(null);

  // Modals: Leave Approval
  const [approvingLeave, setApprovingLeave] = useState<ManagementLeaveItem | null>(null);
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [isSubmittingApprove, setIsSubmittingApprove] = useState<boolean>(false);

  // Modals: Leave Rejection
  const [rejectingLeave, setRejectingLeave] = useState<ManagementLeaveItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

  // Modals: Create Suspension
  const [isCreateSuspOpen, setIsCreateSuspOpen] = useState<boolean>(false);
  const [newSuspStudentId, setNewSuspStudentId] = useState<string>('');
  const [newSuspReason, setNewSuspReason] = useState<string>('');
  const [newSuspStartDate, setNewSuspStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [newSuspEndDate, setNewSuspEndDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [newSuspRemarks, setNewSuspRemarks] = useState<string>('');
  const [createSuspError, setCreateSuspError] = useState<string>('');
  const [isSubmittingSusp, setIsSubmittingSusp] = useState<boolean>(false);

  // Modals: Edit Suspension
  const [editingSuspension, setEditingSuspension] = useState<ManagementSuspensionItem | null>(null);
  const [editSuspReason, setEditSuspReason] = useState<string>('');
  const [editSuspEndDate, setEditSuspEndDate] = useState<string>('');
  const [editSuspRemarks, setEditSuspRemarks] = useState<string>('');
  const [editSuspError, setEditSuspError] = useState<string>('');
  const [isSubmittingEditSusp, setIsSubmittingEditSusp] = useState<boolean>(false);

  // Modals: Lift / End Suspension
  const [endingSuspension, setEndingSuspension] = useState<ManagementSuspensionItem | null>(null);
  const [endSuspRemarks, setEndSuspRemarks] = useState<string>('');
  const [isSubmittingEndSusp, setIsSubmittingEndSusp] = useState<boolean>(false);

  // Toast Auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Fetch Blocks
  useEffect(() => {
    let mounted = true;
    managementApiService
      .getBlocks()
      .then((res) => {
        if (mounted && res?.blocks) {
          setBlocks(res.blocks);
        }
      })
      .catch((err) => console.error('Failed to load blocks for leave filter:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Leave Stats
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setIsStatsLoading(true);
    try {
      const res = await managementApiService.getLeaveStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load leave stats:', err);
    } finally {
      if (!silent) setIsStatsLoading(false);
    }
  }, []);

  // Fetch Leaves List
  const fetchLeaves = useCallback(
    async (page = 1, silent = false) => {
      if (!silent) setIsLeavesLoading(true);
      try {
        const res = await managementApiService.getLeaves({
          status: leaveStatusFilter !== 'ALL' ? leaveStatusFilter : undefined,
          category: leaveCategoryFilter !== 'ALL' ? leaveCategoryFilter : undefined,
          search: leaveSearchTerm.trim() || undefined,
          blockId: leaveBlockFilter !== 'ALL' ? leaveBlockFilter : undefined,
          gender: leaveGenderFilter !== 'ALL' ? leaveGenderFilter : undefined,
          year: leaveYearFilter !== 'ALL' ? leaveYearFilter : undefined,
          date: leaveDateFilter || undefined,
          page,
          limit: 10,
        });
        if (res.success && res.data) {
          setLeaves(res.data);
          if (res.pagination) {
            setLeavesPagination({
              total: res.pagination.total,
              page: res.pagination.page,
              limit: res.pagination.limit,
              totalPages: res.pagination.totalPages,
            });
          }
        }
      } catch (err: any) {
        console.error('Failed to load leave requests:', err);
        setToastMessage({ type: 'error', text: err.message || 'Failed to retrieve leaves.' });
      } finally {
        if (!silent) setIsLeavesLoading(false);
      }
    },
    [leaveStatusFilter, leaveCategoryFilter, leaveSearchTerm, leaveBlockFilter, leaveGenderFilter, leaveYearFilter, leaveDateFilter]
  );

  // Fetch Suspensions List
  const fetchSuspensions = useCallback(
    async (page = 1, silent = false) => {
      if (!silent) setIsSuspensionsLoading(true);
      try {
        const res = await managementApiService.getSuspensions({
          status: suspStatusFilter !== 'ALL' ? suspStatusFilter : undefined,
          search: suspSearchTerm.trim() || undefined,
          blockId: suspBlockFilter !== 'ALL' ? suspBlockFilter : undefined,
          gender: suspGenderFilter !== 'ALL' ? suspGenderFilter : undefined,
          year: suspYearFilter !== 'ALL' ? suspYearFilter : undefined,
          page,
          limit: 10,
        });
        if (res.success && res.data) {
          setSuspensions(res.data);
          if (res.pagination) {
            setSuspPagination({
              total: res.pagination.total,
              page: res.pagination.page,
              limit: res.pagination.limit,
              totalPages: res.pagination.totalPages,
            });
          }
        }
      } catch (err: any) {
        console.error('Failed to load suspensions:', err);
        setToastMessage({ type: 'error', text: err.message || 'Failed to retrieve suspensions.' });
      } finally {
        if (!silent) setIsSuspensionsLoading(false);
      }
    },
    [suspStatusFilter, suspSearchTerm, suspBlockFilter, suspGenderFilter, suspYearFilter]
  );

  // Initial Data Fetch
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'leaves') {
      fetchLeaves(1);
    } else {
      fetchSuspensions(1);
    }
  }, [activeTab, fetchLeaves, fetchSuspensions]);

  // Real-time SSE synchronization
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        if (
          event?.type === 'LEAVE_APPROVED' ||
          event?.type === 'LEAVE_REJECTED' ||
          event?.type === 'LEAVE_CREATED' ||
          event?.type === 'LEAVE_STATUS_UPDATED' ||
          event?.type === 'LEAVE_STATS_UPDATED' ||
          event?.type === 'SUSPENSION_CREATED' ||
          event?.type === 'SUSPENSION_ENDED' ||
          event?.type === 'SUSPENSION_LIFTED'
        ) {
          fetchStats(true);
          if (activeTab === 'leaves') {
            fetchLeaves(leavesPagination.page, true);
          } else {
            fetchSuspensions(suspPagination.page, true);
          }
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, [fetchStats, fetchLeaves, fetchSuspensions, activeTab, leavesPagination.page, suspPagination.page]);

  // Manual Refresh
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      fetchStats(),
      activeTab === 'leaves' ? fetchLeaves(leavesPagination.page) : fetchSuspensions(suspPagination.page),
    ]);
    setIsRefreshing(false);
    setToastMessage({ type: 'success', text: 'Data refreshed from server.' });
  };

  // Open Leave Detail
  const handleOpenLeaveDetail = async (id: string) => {
    try {
      const res = await managementApiService.getLeaveDetail(id);
      if (res.success && res.data) {
        setSelectedLeaveDetail(res.data);
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to load leave details.' });
    }
  };

  // Confirm Approve Leave
  const handleConfirmApprove = async () => {
    if (!approvingLeave) return;
    setIsSubmittingApprove(true);
    try {
      const res = await managementApiService.approveLeave(approvingLeave.id, approvalRemarks.trim() || undefined);
      setToastMessage({
        type: 'success',
        text: res.message || `Leave application #${approvingLeave.requestNumber || approvingLeave.id} approved.`,
      });
      setApprovingLeave(null);
      setApprovalRemarks('');
      if (selectedLeaveDetail?.id === approvingLeave.id) {
        setSelectedLeaveDetail(null);
      }
      fetchStats(true);
      fetchLeaves(leavesPagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to approve leave request.' });
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  // Confirm Reject Leave
  const handleConfirmReject = async () => {
    if (!rejectingLeave) return;
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setRejectionError('Rejection reason must be at least 3 characters.');
      return;
    }

    setIsSubmittingReject(true);
    try {
      const res = await managementApiService.rejectLeave(rejectingLeave.id, rejectionReason.trim());
      setToastMessage({
        type: 'success',
        text: res.message || `Leave request #${rejectingLeave.requestNumber || rejectingLeave.id} rejected.`,
      });
      setRejectingLeave(null);
      setRejectionReason('');
      setRejectionError('');
      if (selectedLeaveDetail?.id === rejectingLeave.id) {
        setSelectedLeaveDetail(null);
      }
      fetchStats(true);
      fetchLeaves(leavesPagination.page, true);
    } catch (err: any) {
      setRejectionError(err.message || 'Failed to reject leave request.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Confirm Create Suspension
  const handleConfirmCreateSuspension = async () => {
    setCreateSuspError('');
    if (!newSuspStudentId.trim()) {
      setCreateSuspError('Please select or specify a student.');
      return;
    }
    if (!newSuspReason || newSuspReason.trim().length < 5) {
      setCreateSuspError('Reason must be at least 5 meaningful characters.');
      return;
    }
    if (!newSuspStartDate || !newSuspEndDate) {
      setCreateSuspError('Both start date and end date are required.');
      return;
    }
    if (new Date(newSuspStartDate) >= new Date(newSuspEndDate)) {
      setCreateSuspError('End date must be strictly after start date.');
      return;
    }

    setIsSubmittingSusp(true);
    try {
      const res = await managementApiService.createSuspension({
        studentId: newSuspStudentId.trim(),
        reason: newSuspReason.trim(),
        startDate: new Date(newSuspStartDate).toISOString(),
        endDate: new Date(newSuspEndDate).toISOString(),
        remarks: newSuspRemarks.trim() || undefined,
      });

      setToastMessage({
        type: 'success',
        text: res.message || 'Disciplinary suspension enforced successfully.',
      });
      setIsCreateSuspOpen(false);
      setNewSuspStudentId('');
      setNewSuspReason('');
      setNewSuspRemarks('');
      fetchStats(true);
      fetchSuspensions(1, true);
    } catch (err: any) {
      setCreateSuspError(err.message || 'Failed to enforce suspension.');
    } finally {
      setIsSubmittingSusp(false);
    }
  };

  // Confirm End Suspension
  const handleConfirmEndSuspension = async () => {
    if (!endingSuspension) return;
    setIsSubmittingEndSusp(true);
    try {
      const res = await managementApiService.endSuspension(
        endingSuspension.id,
        endSuspRemarks.trim() || undefined
      );
      setToastMessage({
        type: 'success',
        text: res.message || 'Hostel suspension lifted successfully.',
      });
      setEndingSuspension(null);
      setEndSuspRemarks('');
      fetchStats(true);
      fetchSuspensions(suspPagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to lift suspension.' });
    } finally {
      setIsSubmittingEndSusp(false);
    }
  };

  // Confirm Edit Suspension
  const handleConfirmEditSuspension = async () => {
    if (!editingSuspension) return;
    if (!editSuspReason || editSuspReason.trim().length < 5) {
      setEditSuspError('Reason must be at least 5 characters.');
      return;
    }
    if (!editSuspEndDate) {
      setEditSuspError('End date is required.');
      return;
    }
    if (new Date(editSuspEndDate) <= new Date(editingSuspension.startDate)) {
      setEditSuspError('End date must be strictly after start date.');
      return;
    }

    setIsSubmittingEditSusp(true);
    try {
      const res = await managementApiService.updateSuspension(editingSuspension.id, {
        reason: editSuspReason.trim(),
        endDate: new Date(editSuspEndDate).toISOString(),
        remarks: editSuspRemarks.trim() || undefined,
      });
      setToastMessage({
        type: 'success',
        text: res.message || 'Disciplinary suspension updated successfully.',
      });
      setEditingSuspension(null);
      fetchStats(true);
      fetchSuspensions(suspPagination.page, true);
    } catch (err: any) {
      setEditSuspError(err.message || 'Failed to update suspension.');
    } finally {
      setIsSubmittingEditSusp(false);
    }
  };

  // Helper date formatters
  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatLeaveCategory = (category: string) => {
    switch (category) {
      case 'HOME_LEAVE':
        return 'Home Leave';
      case 'MEDICAL':
        return 'Medical Emergency';
      case 'ACADEMIC':
        return 'Academic / Exam';
      case 'EMERGENCY':
        return 'Family Emergency';
      case 'SPECIAL_LEAVE':
        return 'Special Approval';
      default:
        return category.replace(/_/g, ' ');
    }
  };

  // Render Status Badge for Leaves
  const renderLeaveStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="leave-status-badge pending">
            <Clock size={12} />
            Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="leave-status-badge approved">
            <CheckCircle2 size={12} />
            Approved
          </span>
        );
      case 'ACTIVE':
      case 'ON_LEAVE':
        return (
          <span className="leave-status-badge active">
            <UserCheck size={12} />
            On Leave
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="leave-status-badge completed">
            <ShieldCheck size={12} />
            Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="leave-status-badge rejected">
            <XCircle size={12} />
            Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="leave-status-badge cancelled">
            <X size={12} />
            Cancelled
          </span>
        );
      default:
        return <span className="leave-status-badge default">{status}</span>;
    }
  };

  // Render Status Badge for Suspensions
  const renderSuspensionStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="susp-status-badge active">
            <ShieldAlert size={12} />
            Active Suspension
          </span>
        );
      case 'LIFTED':
        return (
          <span className="susp-status-badge lifted">
            <ShieldCheck size={12} />
            Lifted / Resolved
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="susp-status-badge expired">
            <Clock size={12} />
            Expired
          </span>
        );
      default:
        return <span className="susp-status-badge default">{status}</span>;
    }
  };

  return (
    <div className="leaves-management-page">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`leaves-toast ${toastMessage.type}`} role="alert">
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
            aria-label="Close notification"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Bar */}
      <div className="leaves-header-bar">
        <div className="leaves-title-group">
          <div className="leaves-icon-badge">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="leaves-main-title">Leaves & Suspension Management</h1>
            <p className="leaves-sub-title">
              Authoritative review and lifecycle management of student hostel leave applications and disciplinary suspensions.
            </p>
          </div>
        </div>

        <div className="leaves-controls-group">
          {/* Live Status Indicator */}
          <div className="live-indicator" title={isLiveConnected ? 'SSE Real-time Connected' : 'SSE Reconnecting...'}>
            <span className={`live-dot ${isLiveConnected ? 'connected' : 'disconnected'}`} />
            <span>{isLiveConnected ? 'Live Updates Active' : 'Connecting SSE...'}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            className="btn-secondary refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            aria-label="Refresh data"
          >
            <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <section className="leaves-kpi-grid" aria-label="Authoritative leave and suspension metrics">
        {/* Pending Requests */}
        <div className="leaves-kpi-card pending-card">
          <div className="kpi-header">
            <span className="kpi-label">Pending Approval</span>
            <div className="kpi-icon-pill pending">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.pending ?? 0}</span>
            {(stats?.pending ?? 0) > 0 && <span className="kpi-badge urgent">Requires Action</span>}
          </div>
          <span className="kpi-desc">Awaiting management review</span>
        </div>

        {/* Approved Leaves */}
        <div className="leaves-kpi-card approved-card">
          <div className="kpi-header">
            <span className="kpi-label">Approved (Upcoming)</span>
            <div className="kpi-icon-pill approved">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.approved ?? 0}</span>
          </div>
          <span className="kpi-desc">Future departure scheduled</span>
        </div>

        {/* Active / On Leave */}
        <div className="leaves-kpi-card active-card">
          <div className="kpi-header">
            <span className="kpi-label">Active (On Leave)</span>
            <div className="kpi-icon-pill active">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.active ?? 0}</span>
          </div>
          <span className="kpi-desc">Currently away from campus</span>
        </div>

        {/* Completed Leaves */}
        <div className="leaves-kpi-card completed-card">
          <div className="kpi-header">
            <span className="kpi-label">Completed Leaves</span>
            <div className="kpi-icon-pill completed">
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.completed ?? 0}</span>
          </div>
          <span className="kpi-desc">Returned to hostel premises</span>
        </div>

        {/* Rejected Leaves */}
        <div className="leaves-kpi-card rejected-card">
          <div className="kpi-header">
            <span className="kpi-label">Rejected Requests</span>
            <div className="kpi-icon-pill rejected">
              <XCircle size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.rejected ?? 0}</span>
          </div>
          <span className="kpi-desc">Declined by management</span>
        </div>

        {/* Suspended Students */}
        <div className="leaves-kpi-card suspended-card">
          <div className="kpi-header">
            <span className="kpi-label">Suspended Students</span>
            <div className="kpi-icon-pill suspended">
              <ShieldAlert size={18} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-number">{isStatsLoading ? '—' : stats?.suspendedStudents ?? 0}</span>
            {(stats?.suspendedStudents ?? 0) > 0 && <span className="kpi-badge warning">Active Restrictions</span>}
          </div>
          <span className="kpi-desc">Leave privileges suspended</span>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="leaves-tabs-nav" role="tablist">
        <button
          type="button"
          role="tab"
          id="tab-leaves"
          aria-selected={activeTab === 'leaves'}
          aria-controls="panel-leaves"
          className={`leaves-tab-btn ${activeTab === 'leaves' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaves')}
        >
          <FileText size={16} />
          <span>Leave Applications</span>
          {stats && stats.pending > 0 && (
            <span className="tab-counter-badge">{stats.pending}</span>
          )}
        </button>

        <button
          type="button"
          role="tab"
          id="tab-suspensions"
          aria-selected={activeTab === 'suspensions'}
          aria-controls="panel-suspensions"
          className={`leaves-tab-btn ${activeTab === 'suspensions' ? 'active' : ''}`}
          onClick={() => setActiveTab('suspensions')}
        >
          <ShieldAlert size={16} />
          <span>Hostel Suspensions</span>
          {stats && stats.suspendedStudents > 0 && (
            <span className="tab-counter-badge warning">{stats.suspendedStudents}</span>
          )}
        </button>
      </div>

      {/* TAB 1: LEAVE APPLICATIONS */}
      {activeTab === 'leaves' && (
        <section id="panel-leaves" role="tabpanel" aria-labelledby="tab-leaves" className="leaves-tab-panel">
          {/* Search & Filter Bar */}
          <div className="leaves-filter-card">
            <div className="filter-row">
              {/* Search Bar */}
              <div className="search-input-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search by student name, JNTU No, destination..."
                  value={leaveSearchTerm}
                  onChange={(e) => setLeaveSearchTerm(e.target.value)}
                  className="leaves-search-input"
                  id="leave-search-input"
                />
                {leaveSearchTerm && (
                  <button
                    type="button"
                    className="clear-search-btn"
                    onClick={() => setLeaveSearchTerm('')}
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-status-select" className="filter-label">Status:</label>
                <select
                  id="leave-status-select"
                  value={leaveStatusFilter}
                  onChange={(e) => setLeaveStatusFilter(e.target.value)}
                  className="leaves-select"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending Review</option>
                  <option value="APPROVED">Approved (Upcoming)</option>
                  <option value="ACTIVE">Active (On Leave)</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </div>

              {/* Category Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-category-select" className="filter-label">Category:</label>
                <select
                  id="leave-category-select"
                  value={leaveCategoryFilter}
                  onChange={(e) => setLeaveCategoryFilter(e.target.value)}
                  className="leaves-select"
                >
                  <option value="ALL">All Categories</option>
                  <option value="HOME_LEAVE">Home Leave</option>
                  <option value="MEDICAL">Medical Emergency</option>
                  <option value="ACADEMIC">Academic / Exam</option>
                  <option value="EMERGENCY">Family Emergency</option>
                  <option value="SPECIAL_LEAVE">Special Approval</option>
                </select>
              </div>

              {/* Block Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-block-select" className="filter-label">Block:</label>
                <select
                  id="leave-block-select"
                  value={leaveBlockFilter}
                  onChange={(e) => setLeaveBlockFilter(e.target.value)}
                  className="leaves-select"
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Gender / Hostel Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-gender-select" className="filter-label">Hostel:</label>
                <select
                  id="leave-gender-select"
                  value={leaveGenderFilter}
                  onChange={(e) => setLeaveGenderFilter(e.target.value)}
                  className="leaves-select"
                >
                  <option value="ALL">All Hostels</option>
                  <option value="BOYS">Boys Hostel</option>
                  <option value="GIRLS">Girls Hostel</option>
                </select>
              </div>

              {/* Academic Year Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-year-select" className="filter-label">Year:</label>
                <select
                  id="leave-year-select"
                  value={leaveYearFilter}
                  onChange={(e) => setLeaveYearFilter(e.target.value)}
                  className="leaves-select"
                >
                  <option value="ALL">All Years</option>
                  <option value="1">1st Year</option>
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              {/* Date Filter */}
              <div className="filter-select-group">
                <label htmlFor="leave-date-select" className="filter-label">Date:</label>
                <input
                  type="date"
                  id="leave-date-select"
                  value={leaveDateFilter}
                  onChange={(e) => setLeaveDateFilter(e.target.value)}
                  className="leaves-date-input"
                />
              </div>

              {/* Reset Filters */}
              {(leaveStatusFilter !== 'ALL' ||
                leaveCategoryFilter !== 'ALL' ||
                leaveSearchTerm !== '' ||
                leaveBlockFilter !== 'ALL' ||
                leaveGenderFilter !== 'ALL' ||
                leaveYearFilter !== 'ALL' ||
                leaveDateFilter !== '') && (
                <button
                  type="button"
                  className="btn-text reset-filters-btn"
                  onClick={() => {
                    setLeaveStatusFilter('ALL');
                    setLeaveCategoryFilter('ALL');
                    setLeaveSearchTerm('');
                    setLeaveBlockFilter('ALL');
                    setLeaveGenderFilter('ALL');
                    setLeaveYearFilter('ALL');
                    setLeaveDateFilter('');
                  }}
                >
                  Reset
                </button>
              )}

              {/* View Mode Switcher */}
              <div className="view-mode-toggle" role="group" aria-label="View layout toggle">
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
                  onClick={() => setViewMode('cards')}
                  title="Card View"
                  id="btn-leave-cards-view"
                >
                  <LayoutGrid size={15} />
                </button>
                <button
                  type="button"
                  className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                  onClick={() => setViewMode('table')}
                  title="Table View"
                  id="btn-leave-table-view"
                >
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {/* Leaves Cards / Table Container */}
          <div className="leaves-table-card">
            {isLeavesLoading ? (
              <div className="leaves-loading-state">
                <RefreshCw size={28} className="spin" />
                <p>Loading leave applications from PostgreSQL...</p>
              </div>
            ) : leaves.length === 0 ? (
              <div className="leaves-empty-state">
                <div className="empty-icon-circle">
                  <FileText size={32} />
                </div>
                <h3>No Leave Requests Found</h3>
                <p>
                  {leaveStatusFilter !== 'ALL' || leaveSearchTerm || leaveCategoryFilter !== 'ALL'
                    ? 'No records match the selected search criteria.'
                    : 'There are currently no leave applications registered in the system.'}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Authoritative Cards View (Primary Default) */}
                {viewMode === 'cards' ? (
                  <div className="leaves-cards-grid">
                    {leaves.map((item) => {
                      const isPending = item.effectiveStatus === 'PENDING';
                      const studentName = item.student?.name || 'Student';
                      const initials = item.avatar || studentName
                        .split(' ')
                        .filter(Boolean)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      return (
                        <article
                          key={item.id}
                          className={`leave-request-card ${
                            isPending
                              ? 'card-pending'
                              : item.effectiveStatus === 'ACTIVE'
                              ? 'card-active'
                              : item.effectiveStatus === 'REJECTED'
                              ? 'card-rejected'
                              : ''
                          }`}
                          aria-label={`Leave application for ${studentName}`}
                        >
                          {/* Top Bar */}
                          <div className="card-top-bar">
                            <div className="card-resident-ident">
                              <div className="student-avatar-badge" aria-hidden="true">
                                {initials}
                              </div>
                              <div className="resident-name-block">
                                <h3 className="resident-full-name">{studentName}</h3>
                                <div className="resident-pills-row">
                                  <span className="jntu-pill">{item.student?.jntuNo || '—'}</span>
                                  <span className="room-pill">
                                    <Building size={12} />
                                    {item.student?.blockName || 'Hostel'} • Room {item.student?.roomNumber || '?'}
                                  </span>
                                  {item.student?.academic?.year && (
                                    <span className="academic-pill">{item.student.academic.year}</span>
                                  )}
                                  {item.student?.academic?.department && (
                                    <span className="jntu-pill">{item.student.academic.department}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="card-status-meta">
                              <div className="req-meta-row">
                                <span className="req-number-tag">
                                  #{item.requestNumber || item.id.slice(0, 8)}
                                </span>
                                <span className="applied-date-text">
                                  Applied {formatDate(item.createdAt)}
                                </span>
                              </div>

                              <div className="tags-badges-row">
                                <span className={`category-tag ${item.leaveType.toLowerCase()}`}>
                                  {formatLeaveCategory(item.leaveType)}
                                </span>
                                {renderLeaveStatusBadge(item.effectiveStatus)}
                              </div>
                            </div>
                          </div>

                          {/* 4-Column Responsive Info Grid */}
                          <div className="card-info-grid">
                            {/* 1. Destination & Reason */}
                            <div className="info-block">
                              <span className="block-label">Destination &amp; Reason</span>
                              <div className="block-value dest-val">
                                <MapPin size={14} className="val-icon" />
                                <span>{item.destination || 'Unspecified destination'}</span>
                              </div>
                              <p className="purpose-desc-text">{item.reason}</p>
                            </div>

                            {/* 2. Leave Schedule & Duration */}
                            <div className="info-block">
                              <span className="block-label">Scheduled Leave Period</span>
                              <div className="transit-window-row">
                                <Calendar size={14} className="val-icon" />
                                <div className="window-times">
                                  <div className="time-item">
                                    <span className="time-lbl">From:</span>
                                    <span className="time-val">{formatDate(item.startDate)}</span>
                                  </div>
                                  <div className="time-item">
                                    <span className="time-lbl">To:</span>
                                    <span className="time-val">{formatDate(item.endDate)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className="duration-pill mt-1">{item.durationDays} {item.durationDays === 1 ? 'day' : 'days'} duration</span>
                            </div>

                            {/* 3. Contact Details */}
                            <div className="info-block">
                              <span className="block-label">Contact Information</span>
                              <div className="contact-item">
                                <Phone size={13} className="val-icon" />
                                <span>{item.emergencyContact || 'No emergency contact'}</span>
                              </div>
                              {item.student?.email && (
                                <div className="contact-item">
                                  <User size={13} className="val-icon" />
                                  <span className="truncate">{item.student.email}</span>
                                </div>
                              )}
                            </div>

                            {/* 4. Decision / Audit Status */}
                            <div className="info-block">
                              <span className="block-label">Decision &amp; Audit</span>
                              {item.effectiveStatus === 'APPROVED' ? (
                                <div className="audit-note approved-note">
                                  <CheckCircle2 size={13} />
                                  <span>Approved by {item.approvedBy || 'Hostel Warden'} on {formatDate(item.approvedAt)}</span>
                                </div>
                              ) : item.effectiveStatus === 'REJECTED' ? (
                                <div className="audit-note rejected-note">
                                  <XCircle size={13} />
                                  <span>Rejected by {item.rejectedBy || 'Hostel Warden'}: {item.rejectionReason}</span>
                                </div>
                              ) : item.effectiveStatus === 'PENDING' ? (
                                <div className="audit-note pending-note">
                                  <Clock size={13} />
                                  <span>Awaiting Management Authorization</span>
                                </div>
                              ) : (
                                <div className="audit-note">
                                  <span>Status: {item.effectiveStatus}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Actions Bar */}
                          <div className="card-actions-row">
                            <button
                              type="button"
                              className="card-action-btn view-act"
                              onClick={() => handleOpenLeaveDetail(item.id)}
                              title="View Full Details"
                            >
                              <Eye size={14} />
                              <span>View Details</span>
                            </button>

                            {item.effectiveStatus === 'PENDING' && (
                              <>
                                <button
                                  type="button"
                                  className="card-action-btn approve-act"
                                  onClick={() => setApprovingLeave(item)}
                                  title="Authorize Leave Request"
                                >
                                  <Check size={14} />
                                  <span>Approve</span>
                                </button>
                                <button
                                  type="button"
                                  className="card-action-btn reject-act"
                                  onClick={() => {
                                    setRejectingLeave(item);
                                    setRejectionReason('');
                                    setRejectionError('');
                                  }}
                                  title="Decline Leave Request"
                                >
                                  <X size={14} />
                                  <span>Reject</span>
                                </button>
                              </>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  /* 2. Structured Table View */
                  <div className="leaves-table-wrapper">
                    <table className="leaves-table">
                      <thead>
                        <tr>
                          <th>Request #</th>
                          <th>Student Details</th>
                          <th>Room</th>
                          <th>Category</th>
                          <th>Destination</th>
                          <th>Leave Dates</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaves.map((item) => (
                          <tr key={item.id} className={`leave-row status-${item.effectiveStatus.toLowerCase()}`}>
                            {/* Request Number */}
                            <td className="cell-req-num">
                              <span className="req-code">{item.requestNumber || item.id.slice(0, 8)}</span>
                              <span className="cell-date-sub">{formatDate(item.createdAt)}</span>
                            </td>

                            {/* Student Details */}
                            <td className="cell-student">
                              <div className="student-info-group">
                                <span className="student-name">{item.student?.name || 'Unknown Student'}</span>
                                <span className="student-jntu">{item.student?.jntuNo || '—'}</span>
                              </div>
                            </td>

                            {/* Block & Room */}
                            <td className="cell-room">
                              <span className="room-badge">
                                {item.student?.blockName || 'Hostel'} - {item.student?.roomNumber ? `R-${item.student.roomNumber}` : '—'}
                              </span>
                              {item.student?.bedNumber && (
                                <span className="cell-sub-info">Bed {item.student.bedNumber}</span>
                              )}
                            </td>

                            {/* Category */}
                            <td className="cell-category">
                              <span className={`category-tag ${item.leaveType.toLowerCase()}`}>
                                {formatLeaveCategory(item.leaveType)}
                              </span>
                            </td>

                            {/* Destination */}
                            <td className="cell-destination">
                              <div className="destination-text" title={item.destination}>
                                <MapPin size={12} className="dest-icon" />
                                <span>{item.destination}</span>
                              </div>
                            </td>

                            {/* Leave Dates */}
                            <td className="cell-dates">
                              <div className="dates-range-group">
                                <span className="date-main">
                                  {formatDate(item.startDate)} → {formatDate(item.endDate)}
                                </span>
                                <span className="duration-pill">{item.durationDays} {item.durationDays === 1 ? 'day' : 'days'}</span>
                              </div>
                            </td>

                            {/* Effective Status */}
                            <td className="cell-status">
                              {renderLeaveStatusBadge(item.effectiveStatus)}
                            </td>

                            {/* Actions */}
                            <td className="cell-actions">
                              <div className="action-buttons-group">
                                {/* View Details */}
                                <button
                                  type="button"
                                  className="action-btn view-btn"
                                  title="View Leave Details"
                                  onClick={() => handleOpenLeaveDetail(item.id)}
                                  aria-label="View Details"
                                >
                                  <Eye size={15} />
                                </button>

                                {/* Approve (Only for PENDING) */}
                                {item.effectiveStatus === 'PENDING' && (
                                  <button
                                    type="button"
                                    className="action-btn approve-btn"
                                    title="Approve Leave Request"
                                    onClick={() => setApprovingLeave(item)}
                                    aria-label="Approve Request"
                                  >
                                    <Check size={15} />
                                  </button>
                                )}

                                {/* Reject (Only for PENDING) */}
                                {item.effectiveStatus === 'PENDING' && (
                                  <button
                                    type="button"
                                    className="action-btn reject-btn"
                                    title="Reject Leave Request"
                                    onClick={() => {
                                      setRejectingLeave(item);
                                      setRejectionReason('');
                                      setRejectionError('');
                                    }}
                                    aria-label="Reject Request"
                                  >
                                    <X size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mobile Cards View (<768px for Table fallback) */}
                {viewMode === 'table' && (
                  <div className="leaves-mobile-cards-view">
                    {leaves.map((item) => (
                      <div key={item.id} className="leave-mobile-card">
                        <div className="mobile-card-header">
                          <div>
                            <span className="mobile-req-code">{item.requestNumber || item.id.slice(0, 8)}</span>
                            <h4 className="mobile-student-name">{item.student?.name}</h4>
                            <span className="mobile-jntu">{item.student?.jntuNo}</span>
                          </div>
                          <div>{renderLeaveStatusBadge(item.effectiveStatus)}</div>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-detail-row">
                            <span className="row-label">Category:</span>
                            <span className="row-val font-semibold">{formatLeaveCategory(item.leaveType)}</span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="row-label">Destination:</span>
                            <span className="row-val">{item.destination}</span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="row-label">Dates:</span>
                            <span className="row-val">
                              {formatDate(item.startDate)} → {formatDate(item.endDate)} ({item.durationDays}d)
                            </span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="row-label">Room:</span>
                            <span className="row-val">
                              {item.student?.blockName || 'Hostel'} - Room {item.student?.roomNumber || '—'}
                            </span>
                          </div>
                        </div>

                        <div className="mobile-card-actions">
                          <button
                            type="button"
                            className="btn-secondary mobile-act-btn"
                            onClick={() => handleOpenLeaveDetail(item.id)}
                          >
                            <Eye size={14} />
                            <span>Details</span>
                          </button>

                          {item.effectiveStatus === 'PENDING' && (
                            <>
                              <button
                                type="button"
                                className="btn-success mobile-act-btn"
                                onClick={() => setApprovingLeave(item)}
                              >
                                <Check size={14} />
                                <span>Approve</span>
                              </button>
                              <button
                                type="button"
                                className="btn-danger mobile-act-btn"
                                onClick={() => {
                                  setRejectingLeave(item);
                                  setRejectionReason('');
                                  setRejectionError('');
                                }}
                              >
                                <X size={14} />
                                <span>Reject</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                <div className="leaves-pagination-bar">
                  <span className="pagination-info">
                    Showing {leaves.length} of {leavesPagination.total} requests
                  </span>
                  <div className="pagination-buttons">
                    <button
                      type="button"
                      className="btn-secondary page-nav-btn"
                      disabled={leavesPagination.page <= 1}
                      onClick={() => fetchLeaves(leavesPagination.page - 1)}
                    >
                      <ChevronLeft size={16} />
                      <span>Previous</span>
                    </button>
                    <span className="page-current">
                      Page {leavesPagination.page} of {Math.max(1, leavesPagination.totalPages)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary page-nav-btn"
                      disabled={leavesPagination.page >= leavesPagination.totalPages}
                      onClick={() => fetchLeaves(leavesPagination.page + 1)}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* TAB 2: HOSTEL SUSPENSIONS */}
      {activeTab === 'suspensions' && (
        <section id="panel-suspensions" role="tabpanel" aria-labelledby="tab-suspensions" className="leaves-tab-panel">
          {/* Suspension Action & Filter Bar */}
          <div className="leaves-filter-card">
            <div className="filter-row justify-between">
              <div className="flex-group">
                {/* Search Suspensions */}
                <div className="search-input-wrapper">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search suspended student, JNTU No, reason..."
                    value={suspSearchTerm}
                    onChange={(e) => setSuspSearchTerm(e.target.value)}
                    className="leaves-search-input"
                    id="susp-search-input"
                  />
                  {suspSearchTerm && (
                    <button
                      type="button"
                      className="clear-search-btn"
                      onClick={() => setSuspSearchTerm('')}
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Status Filter */}
                <div className="filter-select-group">
                  <label htmlFor="susp-status-select" className="filter-label">Status:</label>
                  <select
                    id="susp-status-select"
                    value={suspStatusFilter}
                    onChange={(e) => setSuspStatusFilter(e.target.value)}
                    className="leaves-select"
                  >
                    <option value="ALL">All Suspensions</option>
                    <option value="ACTIVE">Active Suspensions</option>
                    <option value="LIFTED">Lifted / Resolved</option>
                    <option value="EXPIRED">Expired</option>
                  </select>
                </div>

                {/* Block Filter */}
                <div className="filter-select-group">
                  <label htmlFor="susp-block-select" className="filter-label">Block:</label>
                  <select
                    id="susp-block-select"
                    value={suspBlockFilter}
                    onChange={(e) => setSuspBlockFilter(e.target.value)}
                    className="leaves-select"
                  >
                    <option value="ALL">All Blocks</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Gender / Hostel Filter */}
                <div className="filter-select-group">
                  <label htmlFor="susp-gender-select" className="filter-label">Hostel:</label>
                  <select
                    id="susp-gender-select"
                    value={suspGenderFilter}
                    onChange={(e) => setSuspGenderFilter(e.target.value)}
                    className="leaves-select"
                  >
                    <option value="ALL">All Hostels</option>
                    <option value="BOYS">Boys Hostel</option>
                    <option value="GIRLS">Girls Hostel</option>
                  </select>
                </div>

                {/* Academic Year Filter */}
                <div className="filter-select-group">
                  <label htmlFor="susp-year-select" className="filter-label">Year:</label>
                  <select
                    id="susp-year-select"
                    value={suspYearFilter}
                    onChange={(e) => setSuspYearFilter(e.target.value)}
                    className="leaves-select"
                  >
                    <option value="ALL">All Years</option>
                    <option value="1">1st Year</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>

                {/* Reset Filters */}
                {(suspSearchTerm !== '' ||
                  suspStatusFilter !== 'ALL' ||
                  suspBlockFilter !== 'ALL' ||
                  suspGenderFilter !== 'ALL' ||
                  suspYearFilter !== 'ALL') && (
                  <button
                    type="button"
                    className="btn-text reset-filters-btn"
                    onClick={() => {
                      setSuspSearchTerm('');
                      setSuspStatusFilter('ALL');
                      setSuspBlockFilter('ALL');
                      setSuspGenderFilter('ALL');
                      setSuspYearFilter('ALL');
                    }}
                  >
                    Reset
                  </button>
                )}

                {/* View Mode Switcher */}
                <div className="view-mode-toggle" role="group" aria-label="Suspensions layout toggle">
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === 'cards' ? 'active' : ''}`}
                    onClick={() => setViewMode('cards')}
                    title="Card View"
                    id="btn-susp-cards-view"
                  >
                    <LayoutGrid size={15} />
                  </button>
                  <button
                    type="button"
                    className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                    id="btn-susp-table-view"
                  >
                    <List size={15} />
                  </button>
                </div>
              </div>

              {/* Enforce New Suspension Button */}
              <button
                type="button"
                className="btn-primary enforce-susp-btn"
                onClick={() => {
                  setCreateSuspError('');
                  setIsCreateSuspOpen(true);
                }}
                id="btn-enforce-suspension"
              >
                <PlusCircle size={16} />
                <span>Enforce Suspension</span>
              </button>
            </div>
          </div>

          {/* Suspensions Cards / Table Card */}
          <div className="leaves-table-card">
            {isSuspensionsLoading ? (
              <div className="leaves-loading-state">
                <RefreshCw size={28} className="spin" />
                <p>Loading disciplinary suspension records...</p>
              </div>
            ) : suspensions.length === 0 ? (
              <div className="leaves-empty-state">
                <div className="empty-icon-circle success-light">
                  <ShieldCheck size={32} />
                </div>
                <h3>No Disciplinary Suspensions</h3>
                <p>
                  {suspSearchTerm || suspStatusFilter !== 'ALL' || suspBlockFilter !== 'ALL'
                    ? 'No suspensions match the selected filter criteria.'
                    : 'There are currently no students under hostel disciplinary suspension.'}
                </p>
              </div>
            ) : (
              <>
                {/* 1. Authoritative Suspensions Cards View */}
                {viewMode === 'cards' ? (
                  <div className="susp-cards-grid">
                    {suspensions.map((susp) => {
                      const isActive = susp.status === 'ACTIVE';
                      const studentName = susp.student?.name || 'Student';
                      const initials = susp.avatar || studentName
                        .split(' ')
                        .filter(Boolean)
                        .map((p) => p[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();

                      const durationDays = Math.max(
                        1,
                        Math.ceil((new Date(susp.endDate).getTime() - new Date(susp.startDate).getTime()) / (1000 * 60 * 60 * 24))
                      );

                      return (
                        <article
                          key={susp.id}
                          className={`suspension-card ${
                            isActive
                              ? 'card-active-susp'
                              : susp.status === 'LIFTED'
                              ? 'card-lifted-susp'
                              : 'card-expired-susp'
                          }`}
                          aria-label={`Suspension record for ${studentName}`}
                        >
                          {/* Top Bar */}
                          <div className="card-top-bar">
                            <div className="card-resident-ident">
                              <div className="student-avatar-badge" aria-hidden="true">
                                {initials}
                              </div>
                              <div className="resident-name-block">
                                <h3 className="resident-full-name">{studentName}</h3>
                                <div className="resident-pills-row">
                                  <span className="jntu-pill">{susp.student?.jntuNo || '—'}</span>
                                  <span className="room-pill">
                                    <Building size={12} />
                                    {susp.student?.blockName || 'Hostel'} • Room {susp.student?.roomNumber || '?'}
                                  </span>
                                  {susp.student?.academic?.year && (
                                    <span className="academic-pill">{susp.student.academic.year}</span>
                                  )}
                                  {susp.student?.academic?.department && (
                                    <span className="jntu-pill">{susp.student.academic.department}</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="card-status-meta">
                              <div className="req-meta-row">
                                <span className="applied-date-text">
                                  Enforced {formatDate(susp.createdAt)}
                                </span>
                              </div>
                              <div className="tags-badges-row">
                                {renderSuspensionStatusBadge(susp.effectiveStatus)}
                              </div>
                            </div>
                          </div>

                          {/* 4-Column Responsive Info Grid */}
                          <div className="card-info-grid">
                            {/* 1. Infraction Reason */}
                            <div className="info-block">
                              <span className="block-label">Infraction / Reason</span>
                              <div className="block-value dest-val text-danger">
                                <ShieldAlert size={14} className="val-icon" />
                                <span>{susp.reason}</span>
                              </div>
                              {susp.remarks && (
                                <p className="purpose-desc-text mt-1">Note: {susp.remarks}</p>
                              )}
                            </div>

                            {/* 2. Suspension Window */}
                            <div className="info-block">
                              <span className="block-label">Effective Suspension Period</span>
                              <div className="transit-window-row">
                                <Calendar size={14} className="val-icon" />
                                <div className="window-times">
                                  <div className="time-item">
                                    <span className="time-lbl">Start:</span>
                                    <span className="time-val">{formatDate(susp.startDate)}</span>
                                  </div>
                                  <div className="time-item">
                                    <span className="time-lbl">End:</span>
                                    <span className="time-val">{formatDate(susp.endDate)}</span>
                                  </div>
                                </div>
                              </div>
                              <span className="duration-pill mt-1">{durationDays} day(s) sanction</span>
                            </div>

                            {/* 3. Student Residential Context */}
                            <div className="info-block">
                              <span className="block-label">Resident Details</span>
                              <div className="contact-item">
                                <Building size={13} className="val-icon" />
                                <span>{susp.student?.blockName || 'Hostel'} - Room {susp.student?.roomNumber || '—'}</span>
                              </div>
                              {susp.student?.email && (
                                <div className="contact-item">
                                  <User size={13} className="val-icon" />
                                  <span className="truncate">{susp.student.email}</span>
                                </div>
                              )}
                            </div>

                            {/* 4. Enforcing Authority & Resolution */}
                            <div className="info-block">
                              <span className="block-label">Authority &amp; Resolution</span>
                              <div className="contact-item">
                                <UserCheck size={13} className="val-icon" />
                                <span>Enforced by {susp.createdBy || 'Hostel Warden'}</span>
                              </div>
                              {susp.liftedAt && (
                                <div className="audit-note approved-note mt-1">
                                  <ShieldCheck size={13} />
                                  <span>Lifted on {formatDate(susp.liftedAt)} by {susp.liftedBy || 'Warden'}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Card Actions Bar */}
                          <div className="card-actions-row">
                            {isActive && (
                              <>
                                <button
                                  type="button"
                                  className="card-action-btn edit-act"
                                  onClick={() => {
                                    setEditingSuspension(susp);
                                    setEditSuspReason(susp.reason);
                                    setEditSuspEndDate(new Date(susp.endDate).toISOString().split('T')[0]);
                                    setEditSuspRemarks(susp.remarks || '');
                                    setEditSuspError('');
                                  }}
                                  title="Edit Suspension Terms"
                                >
                                  <Edit2 size={13} />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="card-action-btn lift-act"
                                  onClick={() => {
                                    setEndingSuspension(susp);
                                    setEndSuspRemarks('');
                                  }}
                                  title="Lift / Resolve Disciplinary Suspension"
                                >
                                  <Unlock size={14} />
                                  <span>Lift Suspension</span>
                                </button>
                              </>
                            )}
                            {susp.status === 'LIFTED' && (
                              <span className="lifted-note">
                                Resolved &amp; restored to good standing
                              </span>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  /* 2. Structured Table View */
                  <div className="leaves-table-wrapper">
                    <table className="leaves-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Room Location</th>
                          <th>Reason for Suspension</th>
                          <th>Effective Period</th>
                          <th>Enforced By</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {suspensions.map((susp) => (
                          <tr key={susp.id} className={`susp-row status-${susp.effectiveStatus.toLowerCase()}`}>
                            {/* Student */}
                            <td className="cell-student">
                              <div className="student-info-group">
                                <span className="student-name">{susp.student?.name || 'Unknown Student'}</span>
                                <span className="student-jntu">{susp.student?.jntuNo || '—'}</span>
                              </div>
                            </td>

                            {/* Room Location */}
                            <td className="cell-room">
                              <span className="room-badge">
                                {susp.student?.blockName || 'Hostel'} - R-{susp.student?.roomNumber || '—'}
                              </span>
                            </td>

                            {/* Reason */}
                            <td className="cell-susp-reason">
                              <div className="reason-truncate" title={susp.reason}>
                                {susp.reason}
                              </div>
                              {susp.remarks && (
                                <span className="cell-remarks-sub" title={susp.remarks}>
                                  Note: {susp.remarks}
                                </span>
                              )}
                            </td>

                            {/* Period */}
                            <td className="cell-dates">
                              <span className="date-main">
                                {formatDate(susp.startDate)} → {formatDate(susp.endDate)}
                              </span>
                              <span className="cell-date-sub">Created {formatDate(susp.createdAt)}</span>
                            </td>

                            {/* Created By */}
                            <td className="cell-creator">
                              <span className="creator-text">{susp.createdBy || 'Hostel Authority'}</span>
                            </td>

                            {/* Status */}
                            <td className="cell-status">
                              {renderSuspensionStatusBadge(susp.effectiveStatus)}
                            </td>

                            {/* Actions */}
                            <td className="cell-actions">
                              <div className="action-buttons-group">
                                {susp.status === 'ACTIVE' && (
                                  <>
                                    <button
                                      type="button"
                                      className="action-btn edit-btn"
                                      title="Edit Suspension"
                                      onClick={() => {
                                        setEditingSuspension(susp);
                                        setEditSuspReason(susp.reason);
                                        setEditSuspEndDate(new Date(susp.endDate).toISOString().split('T')[0]);
                                        setEditSuspRemarks(susp.remarks || '');
                                        setEditSuspError('');
                                      }}
                                      aria-label="Edit Suspension"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      type="button"
                                      className="action-btn lift-btn"
                                      title="Lift / Resolve Suspension"
                                      onClick={() => {
                                        setEndingSuspension(susp);
                                        setEndSuspRemarks('');
                                      }}
                                      aria-label="Lift Suspension"
                                    >
                                      <Unlock size={15} />
                                      <span>Lift</span>
                                    </button>
                                  </>
                                )}
                                {susp.status === 'LIFTED' && (
                                  <span className="lifted-note" title={`Lifted by ${susp.liftedBy || 'Authority'} on ${formatDate(susp.liftedAt)}`}>
                                    Lifted on {formatDate(susp.liftedAt)}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Mobile Suspensions Cards (<768px for Table fallback) */}
                {viewMode === 'table' && (
                  <div className="leaves-mobile-cards-view">
                    {suspensions.map((susp) => (
                      <div key={susp.id} className="leave-mobile-card susp-card">
                        <div className="mobile-card-header">
                          <div>
                            <h4 className="mobile-student-name">{susp.student?.name}</h4>
                            <span className="mobile-jntu">{susp.student?.jntuNo}</span>
                          </div>
                          <div>{renderSuspensionStatusBadge(susp.effectiveStatus)}</div>
                        </div>

                        <div className="mobile-card-body">
                          <div className="mobile-detail-row">
                            <span className="row-label">Reason:</span>
                            <span className="row-val font-semibold text-danger">{susp.reason}</span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="row-label">Period:</span>
                            <span className="row-val">
                              {formatDate(susp.startDate)} → {formatDate(susp.endDate)}
                            </span>
                          </div>
                          <div className="mobile-detail-row">
                            <span className="row-label">Enforced By:</span>
                            <span className="row-val">{susp.createdBy || 'Hostel Authority'}</span>
                          </div>
                          {susp.remarks && (
                            <div className="mobile-detail-row">
                              <span className="row-label">Remarks:</span>
                              <span className="row-val">{susp.remarks}</span>
                            </div>
                          )}
                          {susp.liftedAt && (
                            <div className="mobile-detail-row">
                              <span className="row-label">Lifted:</span>
                              <span className="row-val text-success">
                                On {formatDate(susp.liftedAt)} by {susp.liftedBy || 'Authority'}
                              </span>
                            </div>
                          )}
                        </div>

                        {susp.status === 'ACTIVE' && (
                          <div className="mobile-card-actions">
                            <button
                              type="button"
                              className="btn-secondary mobile-act-btn lift-act"
                              onClick={() => {
                                setEndingSuspension(susp);
                                setEndSuspRemarks('');
                              }}
                            >
                              <Unlock size={14} />
                              <span>Lift Suspension</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Suspensions Pagination */}
                <div className="leaves-pagination-bar">
                  <span className="pagination-info">
                    Showing {suspensions.length} of {suspPagination.total} suspensions
                  </span>
                  <div className="pagination-buttons">
                    <button
                      type="button"
                      className="btn-secondary page-nav-btn"
                      disabled={suspPagination.page <= 1}
                      onClick={() => fetchSuspensions(suspPagination.page - 1)}
                    >
                      <ChevronLeft size={16} />
                      <span>Previous</span>
                    </button>
                    <span className="page-current">
                      Page {suspPagination.page} of {Math.max(1, suspPagination.totalPages)}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary page-nav-btn"
                      disabled={suspPagination.page >= suspPagination.totalPages}
                      onClick={() => fetchSuspensions(suspPagination.page + 1)}
                    >
                      <span>Next</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {/* MODAL 1: LEAVE DETAILS MODAL */}
      {selectedLeaveDetail && (
        <div className="mgmt-modal-backdrop" onClick={() => setSelectedLeaveDetail(null)}>
          <div className="mgmt-modal leaves-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group">
                <FileText size={20} className="modal-header-icon" />
                <h3>Leave Application #{selectedLeaveDetail.requestNumber || selectedLeaveDetail.id.slice(0, 8)}</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedLeaveDetail(null)}
                aria-label="Close details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {/* Suspension Warning Alert if student is suspended */}
              {selectedLeaveDetail.isSuspended && (
                <div className="suspension-warning-banner">
                  <AlertTriangle size={18} className="warn-icon" />
                  <div>
                    <strong>Student Disciplinary Suspension Active!</strong>
                    <p>
                      This student has an active hostel suspension. Leave applications are prohibited and cannot be approved until the suspension is resolved.
                    </p>
                  </div>
                </div>
              )}

              {/* Status Header */}
              <div className="modal-status-banner">
                <span className="banner-label">Current Status:</span>
                {renderLeaveStatusBadge(selectedLeaveDetail.effectiveStatus)}
              </div>

              {/* Student Information */}
              <div className="modal-section">
                <h4 className="section-title">
                  <User size={15} />
                  <span>Student Profile</span>
                </h4>
                <div className="detail-grid-2">
                  <div className="detail-item">
                    <span className="item-label">Full Name:</span>
                    <span className="item-value font-semibold">{selectedLeaveDetail.student?.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">JNTU Number:</span>
                    <span className="item-value">{selectedLeaveDetail.student?.jntuNo}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Residential Block:</span>
                    <span className="item-value">{selectedLeaveDetail.student?.blockName || 'Hostel'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Room & Bed:</span>
                    <span className="item-value">
                      Room {selectedLeaveDetail.student?.roomNumber || '—'} (Bed {selectedLeaveDetail.student?.bedNumber || '—'})
                    </span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="item-label">Email Address:</span>
                    <span className="item-value">{selectedLeaveDetail.student?.email || '—'}</span>
                  </div>
                </div>
              </div>

              {/* Leave Details */}
              <div className="modal-section">
                <h4 className="section-title">
                  <Calendar size={15} />
                  <span>Leave Schedule & Purpose</span>
                </h4>
                <div className="detail-grid-2">
                  <div className="detail-item">
                    <span className="item-label">Leave Category:</span>
                    <span className="item-value font-semibold text-primary">
                      {formatLeaveCategory(selectedLeaveDetail.leaveType)}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Total Duration:</span>
                    <span className="item-value font-semibold">
                      {selectedLeaveDetail.durationDays} {selectedLeaveDetail.durationDays === 1 ? 'day' : 'days'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Departure Date:</span>
                    <span className="item-value">{formatDate(selectedLeaveDetail.startDate)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Expected Return Date:</span>
                    <span className="item-value">{formatDate(selectedLeaveDetail.endDate)}</span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="item-label">Destination Address:</span>
                    <span className="item-value">
                      <MapPin size={13} className="inline-icon" />
                      {selectedLeaveDetail.destination}
                    </span>
                  </div>
                  <div className="detail-item full-width">
                    <span className="item-label">Reason for Absence:</span>
                    <span className="item-value note-box">{selectedLeaveDetail.reason}</span>
                  </div>
                  <div className="detail-item">
                    <span className="item-label">Emergency Phone:</span>
                    <span className="item-value">
                      <Phone size={13} className="inline-icon" />
                      {selectedLeaveDetail.emergencyContact}
                    </span>
                  </div>
                  {selectedLeaveDetail.remarks && (
                    <div className="detail-item full-width">
                      <span className="item-label">Student Remarks:</span>
                      <span className="item-value">{selectedLeaveDetail.remarks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Decision Log */}
              {(selectedLeaveDetail.approvedAt || selectedLeaveDetail.rejectedAt) && (
                <div className="modal-section decision-section">
                  <h4 className="section-title">
                    <ShieldCheck size={15} />
                    <span>Management Decision Record</span>
                  </h4>
                  <div className="detail-grid-2">
                    {selectedLeaveDetail.approvedAt && (
                      <>
                        <div className="detail-item">
                          <span className="item-label">Approved By:</span>
                          <span className="item-value text-success font-semibold">
                            {selectedLeaveDetail.approvedBy || 'Hostel Warden'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="item-label">Decision Timestamp:</span>
                          <span className="item-value">{formatDateTime(selectedLeaveDetail.approvedAt)}</span>
                        </div>
                      </>
                    )}
                    {selectedLeaveDetail.rejectedAt && (
                      <>
                        <div className="detail-item">
                          <span className="item-label">Rejected By:</span>
                          <span className="item-value text-danger font-semibold">
                            {selectedLeaveDetail.rejectedBy || 'Hostel Warden'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="item-label">Decision Timestamp:</span>
                          <span className="item-value">{formatDateTime(selectedLeaveDetail.rejectedAt)}</span>
                        </div>
                        <div className="detail-item full-width">
                          <span className="item-label">Rejection Reason:</span>
                          <span className="item-value rejection-reason-box">
                            {selectedLeaveDetail.rejectionReason || 'No specific reason provided.'}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedLeaveDetail.effectiveStatus === 'PENDING' && (
                <div className="modal-actions-left">
                  <button
                    type="button"
                    className="btn-success"
                    onClick={() => {
                      setApprovingLeave(selectedLeaveDetail);
                    }}
                    disabled={selectedLeaveDetail.isSuspended}
                  >
                    <Check size={15} />
                    <span>Approve Request</span>
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={() => {
                      setRejectingLeave(selectedLeaveDetail);
                      setRejectionReason('');
                      setRejectionError('');
                    }}
                  >
                    <X size={15} />
                    <span>Reject Request</span>
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setSelectedLeaveDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: APPROVE CONFIRMATION */}
      {approvingLeave && (
        <div className="mgmt-modal-backdrop" onClick={() => setApprovingLeave(null)}>
          <div className="mgmt-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group text-success">
                <CheckCircle2 size={20} />
                <h3>Authorize Leave Request</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setApprovingLeave(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to approve leave application{' '}
                <strong>#{approvingLeave.requestNumber || approvingLeave.id.slice(0, 8)}</strong> for{' '}
                <strong>{approvingLeave.student?.name}</strong> ({approvingLeave.student?.jntuNo})?
              </p>

              <div className="confirm-summary-box">
                <div className="summary-row">
                  <span>Destination:</span>
                  <strong>{approvingLeave.destination}</strong>
                </div>
                <div className="summary-row">
                  <span>Period:</span>
                  <strong>
                    {formatDate(approvingLeave.startDate)} → {formatDate(approvingLeave.endDate)} ({approvingLeave.durationDays}d)
                  </strong>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="approval-remarks" className="form-label">
                  Approval Remarks (Optional):
                </label>
                <textarea
                  id="approval-remarks"
                  rows={2}
                  className="leaves-textarea"
                  placeholder="e.g., Parent confirmation verified via call; approved for family function."
                  value={approvalRemarks}
                  onChange={(e) => setApprovalRemarks(e.target.value)}
                />
              </div>

              <div className="info-alert-box">
                <Info size={16} />
                <span>
                  Authorizing this request will notify the resident and record a permanent audit entry in the activity log.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setApprovingLeave(null)}
                disabled={isSubmittingApprove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={handleConfirmApprove}
                disabled={isSubmittingApprove}
                id="btn-confirm-approve-leave"
              >
                {isSubmittingApprove ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Approving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Confirm Approval</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: REJECT CONFIRMATION */}
      {rejectingLeave && (
        <div className="mgmt-modal-backdrop" onClick={() => setRejectingLeave(null)}>
          <div className="mgmt-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group text-danger">
                <XCircle size={20} />
                <h3>Reject Leave Request</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRejectingLeave(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Please specify the reason for declining leave request{' '}
                <strong>#{rejectingLeave.requestNumber || rejectingLeave.id.slice(0, 8)}</strong> for{' '}
                <strong>{rejectingLeave.student?.name}</strong>.
              </p>

              <div className="form-group">
                <label htmlFor="rejection-reason" className="form-label required">
                  Rejection Reason (Minimum 3 characters):
                </label>
                <textarea
                  id="rejection-reason"
                  rows={3}
                  className={`leaves-textarea ${rejectionError ? 'has-error' : ''}`}
                  placeholder="Provide a clear explanation for rejecting this request (e.g., Mandatory internal exams scheduled during this period)."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError('');
                  }}
                  required
                />
                {rejectionError && <span className="field-error-msg">{rejectionError}</span>}
              </div>

              <div className="info-alert-box warning-box">
                <AlertTriangle size={16} />
                <span>
                  This reason will be clearly displayed to the student in their Leaves portal and stored permanently in the audit log.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRejectingLeave(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject}
                id="btn-confirm-reject-leave"
              >
                {isSubmittingReject ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <>
                    <X size={14} />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CREATE DISCIPLINARY SUSPENSION */}
      {isCreateSuspOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsCreateSuspOpen(false)}>
          <div className="mgmt-modal create-suspension-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group text-danger">
                <ShieldAlert size={20} />
                <h3>Enforce Disciplinary Suspension</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateSuspOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {createSuspError && (
                <div className="form-error-banner">
                  <AlertCircle size={16} />
                  <span>{createSuspError}</span>
                </div>
              )}

              {/* Student Identification */}
              <div className="form-group">
                <label htmlFor="susp-student-id" className="form-label required">
                  Student Database ID or JNTU / Select Student:
                </label>
                {leaves.length > 0 && (
                  <select
                    className="leaves-select mb-2"
                    onChange={(e) => {
                      if (e.target.value) {
                        setNewSuspStudentId(e.target.value);
                      }
                    }}
                    value={newSuspStudentId}
                    id="susp-student-quick-pick"
                  >
                    <option value="">-- Quick Pick from Leave Applicants --</option>
                    {Array.from(new Map(leaves.filter((l) => l.student?.id).map((l) => [l.student!.id, l.student!])).values()).map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.jntuNo}) - {st.blockName || 'Hostel'} R-{st.roomNumber || '?'}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  id="susp-student-id"
                  className="leaves-input"
                  placeholder="Enter Student ID (e.g. from quick-pick above or student profile)"
                  value={newSuspStudentId}
                  onChange={(e) => setNewSuspStudentId(e.target.value)}
                  required
                />
                <span className="field-hint">
                  Tip: Select from the quick-pick dropdown above or enter student UUID directly.
                </span>
              </div>

              {/* Suspension Reason */}
              <div className="form-group">
                <label htmlFor="susp-reason" className="form-label required">
                  Infraction / Suspension Reason (min 5 chars):
                </label>
                <textarea
                  id="susp-reason"
                  rows={3}
                  className="leaves-textarea"
                  placeholder="e.g., Curfew violation, hostel damage, or disciplinary committee sanctions."
                  value={newSuspReason}
                  onChange={(e) => setNewSuspReason(e.target.value)}
                  required
                />
              </div>

              {/* Date Period */}
              <div className="form-row-2">
                <div className="form-group">
                  <label htmlFor="susp-start-date" className="form-label required">
                    Start Date:
                  </label>
                  <input
                    type="date"
                    id="susp-start-date"
                    className="leaves-input"
                    value={newSuspStartDate}
                    onChange={(e) => setNewSuspStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="susp-end-date" className="form-label required">
                    End Date:
                  </label>
                  <input
                    type="date"
                    id="susp-end-date"
                    className="leaves-input"
                    value={newSuspEndDate}
                    onChange={(e) => setNewSuspEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Remarks */}
              <div className="form-group">
                <label htmlFor="susp-remarks" className="form-label">
                  Internal Notes / Committee Case Number:
                </label>
                <input
                  type="text"
                  id="susp-remarks"
                  className="leaves-input"
                  placeholder="e.g., Case #DISC-2026-04; reviewed by Chief Warden."
                  value={newSuspRemarks}
                  onChange={(e) => setNewSuspRemarks(e.target.value)}
                />
              </div>

              <div className="info-alert-box warning-box">
                <AlertTriangle size={16} />
                <span>
                  <strong>Strict Disciplinary Rule:</strong> An active suspension automatically blocks the student from applying for any leave requests until the suspension ends or is lifted by management.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsCreateSuspOpen(false)}
                disabled={isSubmittingSusp}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmCreateSuspension}
                disabled={isSubmittingSusp}
                id="btn-submit-enforce-suspension"
              >
                {isSubmittingSusp ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Enforcing...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert size={14} />
                    <span>Enforce Suspension</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: LIFT / END SUSPENSION */}
      {endingSuspension && (
        <div className="mgmt-modal-backdrop" onClick={() => setEndingSuspension(null)}>
          <div className="mgmt-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group text-success">
                <Unlock size={20} />
                <h3>Lift Disciplinary Suspension</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEndingSuspension(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <p className="confirm-text">
                Are you sure you want to lift the suspension for{' '}
                <strong>{endingSuspension.student?.name}</strong> ({endingSuspension.student?.jntuNo})?
              </p>

              <div className="confirm-summary-box">
                <div className="summary-row">
                  <span>Initial Reason:</span>
                  <strong>{endingSuspension.reason}</strong>
                </div>
                <div className="summary-row">
                  <span>Scheduled Until:</span>
                  <strong>{formatDate(endingSuspension.endDate)}</strong>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="end-susp-remarks" className="form-label">
                  Resolution Remarks (Optional):
                </label>
                <textarea
                  id="end-susp-remarks"
                  rows={2}
                  className="leaves-textarea"
                  placeholder="e.g., Disciplinary hearing concluded; student submitted undertaking."
                  value={endSuspRemarks}
                  onChange={(e) => setEndSuspRemarks(e.target.value)}
                />
              </div>

              <div className="info-alert-box">
                <Info size={16} />
                <span>
                  Lifting this suspension will immediately restore the student's good standing and re-enable their ability to submit leave applications.
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEndingSuspension(null)}
                disabled={isSubmittingEndSusp}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-success"
                onClick={handleConfirmEndSuspension}
                disabled={isSubmittingEndSusp}
                id="btn-confirm-lift-suspension"
              >
                {isSubmittingEndSusp ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Lifting...</span>
                  </>
                ) : (
                  <>
                    <Unlock size={14} />
                    <span>Confirm Lift</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 6: EDIT SUSPENSION */}
      {editingSuspension && (
        <div className="mgmt-modal-backdrop" onClick={() => setEditingSuspension(null)}>
          <div className="mgmt-modal confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="header-title-group text-primary">
                <Edit2 size={20} />
                <h3>Modify Disciplinary Suspension</h3>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setEditingSuspension(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {editSuspError && (
                <div className="form-error-banner">
                  <AlertCircle size={16} />
                  <span>{editSuspError}</span>
                </div>
              )}

              <p className="confirm-text">
                Modifying active suspension terms for{' '}
                <strong>{editingSuspension.student?.name}</strong> ({editingSuspension.student?.jntuNo}).
              </p>

              <div className="form-group">
                <label htmlFor="edit-susp-reason" className="form-label required">
                  Infraction Reason (min 5 chars):
                </label>
                <textarea
                  id="edit-susp-reason"
                  rows={3}
                  className="leaves-textarea"
                  value={editSuspReason}
                  onChange={(e) => setEditSuspReason(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-susp-end-date" className="form-label required">
                  New End Date:
                </label>
                <input
                  type="date"
                  id="edit-susp-end-date"
                  className="leaves-input"
                  value={editSuspEndDate}
                  onChange={(e) => setEditSuspEndDate(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="edit-susp-remarks" className="form-label">
                  Internal Remarks / Hearing Notes:
                </label>
                <input
                  type="text"
                  id="edit-susp-remarks"
                  className="leaves-input"
                  value={editSuspRemarks}
                  onChange={(e) => setEditSuspRemarks(e.target.value)}
                  placeholder="e.g., Extension approved by Disciplinary Board"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setEditingSuspension(null)}
                disabled={isSubmittingEditSusp}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleConfirmEditSuspension}
                disabled={isSubmittingEditSusp}
                id="btn-confirm-edit-suspension"
              >
                {isSubmittingEditSusp ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementLeavesPage;
