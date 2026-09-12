import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Plus,
  RefreshCw,
  X,
  MapPin,
  Eye,
  Trash2,
  CalendarCheck,
  Home,
  Stethoscope,
  GraduationCap,
  Sparkles,
  Send,
} from 'lucide-react';
import {
  apiService,
  LeavesData,
  LeaveRequestItem,
  CreateLeavePayload,
} from '../services/api';

export const LeavesPage: React.FC = () => {
  const [data, setData] = useState<LeavesData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Main Segmented View (Leaves vs Suspensions)
  const [activeSection, setActiveSection] = useState<'LEAVES' | 'SUSPENSIONS'>('LEAVES');

  // Filters & Tabs
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState<boolean>(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState<string | null>(null);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequestItem | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Cancellation
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);

  // Notifications
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [realtimeNotice, setRealtimeNotice] = useState<string | null>(null);

  // Form State
  const [leaveType, setLeaveType] = useState<string>('HOME_LEAVE');
  const [destination, setDestination] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [emergencyContact, setEmergencyContact] = useState<string>('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Clear toast notifications after 5 seconds
  useEffect(() => {
    if (actionSuccess) {
      const timer = setTimeout(() => setActionSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [actionSuccess]);

  useEffect(() => {
    if (actionError) {
      const timer = setTimeout(() => setActionError(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [actionError]);

  useEffect(() => {
    if (realtimeNotice) {
      const timer = setTimeout(() => setRealtimeNotice(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [realtimeNotice]);

  /**
   * Fetch leaves data
   */
  const fetchLeaves = useCallback(async (isSilent = false) => {
    if (isSilent) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const res = await apiService.getLeaves();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Unable to load leave requests.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  /**
   * Fetch authoritative leave detail
   */
  const fetchLeaveDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    setDetailError(null);

    try {
      const res = await apiService.getLeaveDetail(id);
      setSelectedLeave(res.leave);
    } catch (err: any) {
      setDetailError(err.message || 'Unable to load leave details.');
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  const handleOpenDetail = (id: string) => {
    setSelectedLeaveId(id);
    setSelectedLeave(null);
    fetchLeaveDetail(id);
  };

  /**
   * Real-time SSE Connection & Auto-Synchronization
   */
  useEffect(() => {
    fetchLeaves();

    const unsubscribe = apiService.subscribeToLeaveEvents((event) => {
      let message = 'Your leave records have been synchronized.';
      if (event.type === 'LEAVE_APPROVED') message = 'Your leave request has been APPROVED!';
      else if (event.type === 'LEAVE_REJECTED') message = 'Notice: Your leave request was rejected.';
      else if (event.type === 'SUSPENSION_CREATED') message = 'Important notice: Administrative disciplinary suspension recorded.';
      else if (event.type === 'SUSPENSION_LIFTED') message = 'Disciplinary suspension has been lifted. Account restored.';

      setRealtimeNotice(message);
      fetchLeaves(true);

      // If active detail modal matches updated leave, refresh detail as well
      if (selectedLeaveId && event.leaveId === selectedLeaveId) {
        fetchLeaveDetail(selectedLeaveId);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [fetchLeaves, fetchLeaveDetail, selectedLeaveId]);

  /**
   * Form submission handler
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Client-side validations
    if (!destination.trim() || destination.trim().length < 2) {
      setFormError('Please enter a valid destination address.');
      return;
    }

    if (!startDate || !endDate) {
      setFormError('Both departure and return dates are required.');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const todayFloor = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (start < todayFloor) {
      setFormError('Start date cannot be in the past.');
      return;
    }

    if (start >= end) {
      setFormError('Return date must be strictly after departure date.');
      return;
    }

    const durationDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (durationDays > 30) {
      setFormError('Maximum allowed leave duration is 30 days.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Please provide a reason of at least 5 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: CreateLeavePayload = {
        leaveType,
        destination: destination.trim(),
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        reason: reason.trim(),
        emergencyContact: emergencyContact.trim() || undefined,
      };

      const res = await apiService.createLeave(payload);
      setActionSuccess(`Leave application ${res.leave.requestNumber || ''} submitted successfully.`);

      // Reset form & close modal
      setDestination('');
      setStartDate('');
      setEndDate('');
      setReason('');
      setEmergencyContact('');
      setIsApplyModalOpen(false);

      // Refresh list
      fetchLeaves(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to submit leave application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Cancel leave handler
   */
  const handleCancelLeave = async (id: string) => {
    setCancellingId(id);
    setActionError(null);

    try {
      await apiService.cancelLeave(id);
      setActionSuccess('Leave application cancelled successfully.');
      setCancelConfirmId(null);
      if (selectedLeaveId === id) {
        fetchLeaveDetail(id);
      }
      fetchLeaves(true);
    } catch (err: any) {
      setActionError(err.message || 'Failed to cancel leave request.');
    } finally {
      setCancellingId(null);
    }
  };

  /**
   * Formatting helpers
   */
  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getLeaveTypeIcon = (type: string) => {
    switch (type) {
      case 'HOME_LEAVE':
        return <Home size={16} className="text-blue-600" />;
      case 'MEDICAL':
        return <Stethoscope size={16} className="text-emerald-600" />;
      case 'ACADEMIC':
        return <GraduationCap size={16} className="text-purple-600" />;
      case 'EMERGENCY':
        return <AlertTriangle size={16} className="text-rose-600" />;
      case 'SPECIAL_LEAVE':
      default:
        return <Sparkles size={16} className="text-amber-600" />;
    }
  };

  const getLeaveTypeLabel = (type: string) => {
    switch (type) {
      case 'HOME_LEAVE':
        return 'Home Leave';
      case 'MEDICAL':
        return 'Medical Leave';
      case 'ACADEMIC':
        return 'Academic / Conference';
      case 'EMERGENCY':
        return 'Family Emergency';
      case 'SPECIAL_LEAVE':
        return 'Special Leave';
      default:
        return type.replace('_', ' ');
    }
  };

  const getLeaveTypeClass = (type: string) => {
    switch (type) {
      case 'HOME_LEAVE':
        return 'type-home';
      case 'MEDICAL':
        return 'type-medical';
      case 'ACADEMIC':
        return 'type-academic';
      case 'EMERGENCY':
        return 'type-emergency';
      case 'SPECIAL_LEAVE':
      default:
        return 'type-special';
    }
  };

  const renderStatusBadge = (effectiveStatus: string) => {
    switch (effectiveStatus) {
      case 'PENDING':
        return (
          <span className="leave-status-badge badge-pending">
            <Clock size={13} />
            Pending Approval
          </span>
        );
      case 'APPROVED':
        return (
          <span className="leave-status-badge badge-approved">
            <CalendarCheck size={13} />
            Approved (Upcoming)
          </span>
        );
      case 'ACTIVE':
        return (
          <span className="leave-status-badge badge-active">
            <span className="pulse-dot" />
            Currently On Leave
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="leave-status-badge badge-completed">
            <CheckCircle2 size={13} />
            Completed
          </span>
        );
      case 'REJECTED':
        return (
          <span className="leave-status-badge badge-rejected">
            <XCircle size={13} />
            Rejected
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="leave-status-badge badge-cancelled">
            <X size={13} />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="leave-status-badge badge-completed">
            {effectiveStatus}
          </span>
        );
    }
  };

  // Filter requests
  const filteredRequests = (data?.requests || []).filter((req) => {
    // Status Filter
    if (statusFilter === 'PENDING' && req.effectiveStatus !== 'PENDING') return false;
    if (statusFilter === 'APPROVED' && req.effectiveStatus !== 'APPROVED' && req.effectiveStatus !== 'ACTIVE') return false;
    if (statusFilter === 'COMPLETED' && req.effectiveStatus !== 'COMPLETED') return false;
    if (statusFilter === 'REJECTED' && req.effectiveStatus !== 'REJECTED') return false;
    if (statusFilter === 'CANCELLED' && req.effectiveStatus !== 'CANCELLED') return false;

    // Type Filter
    if (typeFilter !== 'ALL' && req.leaveType !== typeFilter) return false;

    return true;
  });

  const isSuspended = data?.currentStatus === 'SUSPENDED';

  return (
    <div className="portal-page-container">
      {/* Real-time Notification Banner */}
      {realtimeNotice && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-indigo-500/40 animate-in fade-in">
          <Sparkles size={18} className="text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{realtimeNotice}</span>
          <button
            onClick={() => setRealtimeNotice(null)}
            className="text-white/60 hover:text-white ml-2"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Success Banner */}
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{actionSuccess}</span>
          </div>
          <button
            onClick={() => setActionSuccess(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Action Error Banner */}
      {actionError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-rose-600 shrink-0" />
            <span className="text-sm font-semibold">{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="portal-page-header">
        <div>
          <h1 className="portal-page-title">Leaves & Suspension</h1>
          <p className="portal-page-desc">
            Manage your temporary hostel leave requests, track approval status, and review administrative notices.
          </p>
        </div>
        <div className="portal-header-actions">
          <button
            type="button"
            className="btn-secondary-action"
            onClick={() => fetchLeaves(true)}
            disabled={isRefreshing}
            title="Refresh leave requests"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-icon text-primary' : ''} />
            <span>Sync</span>
          </button>
          <button
            type="button"
            className={`btn-primary-action ${isSuspended ? 'opacity-60 cursor-not-allowed' : ''}`}
            onClick={() => {
              if (isSuspended) {
                setActionError('Leave application blocked: Your account is currently suspended.');
              } else {
                setIsApplyModalOpen(true);
              }
            }}
            disabled={isSuspended}
          >
            <Plus size={18} />
            <span>Apply for Leave</span>
          </button>
        </div>
      </div>

      {/* Top Segmented Navigation: LEAVES vs SUSPENSIONS */}
      <div className="student-segmented-nav">
        <button
          type="button"
          onClick={() => setActiveSection('LEAVES')}
          className={`student-segmented-btn ${activeSection === 'LEAVES' ? 'active' : ''}`}
        >
          <CalendarCheck size={16} />
          <span>Leave Applications</span>
          {data && (
            <span className="student-segmented-badge">
              {data.summary.total}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('SUSPENSIONS')}
          className={`student-segmented-btn ${activeSection === 'SUSPENSIONS' ? 'active' : ''}`}
        >
          <ShieldAlert size={16} />
          <span>Hostel Suspensions</span>
          {isSuspended ? (
            <span className="student-segmented-badge-alert">
              ACTIVE
            </span>
          ) : (
            <span className="student-segmented-badge">
              {data?.suspensions?.length || 0}
            </span>
          )}
        </button>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">Loading authoritative leave records...</p>
        </div>
      )}

      {/* General Error state */}
      {error && !data && (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl">
          <AlertTriangle size={36} className="mx-auto text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900">Failed to load records</h3>
          <p className="text-sm text-rose-700 mt-1 mb-4">{error}</p>
          <button
            onClick={() => fetchLeaves()}
            className="btn-primary-action"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {activeSection === 'LEAVES' ? (
            <>
              {/* Phase 14 & Phase 5: Student Authoritative Status Banner */}
              <div>
                {data.currentStatus === 'SUSPENDED' && data.activeSuspension ? (
                  <div className="suspension-alert-banner">
                    <div className="suspension-alert-icon">
                      <ShieldAlert size={28} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="suspension-badge">Account Suspended</span>
                          <span className="text-xs font-semibold text-rose-700">
                            Disciplinary Administrative Order
                          </span>
                        </div>
                        <span className="text-xs font-semibold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-md">
                          Enforced Until: {formatDate(data.activeSuspension.endDate)}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-rose-950 mt-2 mb-1">
                        Disciplinary Suspension Active
                      </h2>
                      <p className="text-sm text-rose-800">
                        <strong>Reason:</strong> {data.activeSuspension.reason}
                      </p>
                      {data.activeSuspension.remarks && (
                        <p className="text-xs text-rose-700 mt-1 bg-white/70 p-2 rounded-lg border border-rose-200">
                          <strong>Administrative Remarks:</strong> {data.activeSuspension.remarks}
                        </p>
                      )}
                      <div className="mt-3 flex items-center gap-2 text-xs font-medium text-rose-800">
                        <AlertTriangle size={14} className="shrink-0" />
                        <span>
                          Under hostel administrative rules, leave requests and gate outing permissions are prohibited during suspension.
                        </span>
                      </div>
                    </div>
                  </div>
                ) : data.currentStatus === 'ON_LEAVE' && data.activeLeave ? (
                  <div className="active-leave-banner">
                    <div className="active-leave-icon">
                      <CalendarCheck size={28} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="leave-status-badge badge-active">
                            <span className="pulse-dot" />
                            Currently On Leave
                          </span>
                          <span className={`leave-type-pill ${getLeaveTypeClass(data.activeLeave.leaveType)}`}>
                            {getLeaveTypeLabel(data.activeLeave.leaveType)}
                          </span>
                        </div>
                        <span className="leave-request-id">
                          {data.activeLeave.requestNumber}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-indigo-950 mt-2 mb-1">
                        Active Leave Period in Progress
                      </h2>
                      <p className="text-sm text-indigo-800">
                        Destination: <strong>{data.activeLeave.destination}</strong> · Expected return by{' '}
                        <strong>{formatDate(data.activeLeave.endDate)}</strong> ({data.activeLeave.durationDays} days total)
                      </p>
                      {data.activeLeave.approvedBy && (
                        <p className="text-xs text-indigo-700 mt-1">
                          Approved by: {data.activeLeave.approvedBy}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="resident-status-card">
                    <div className="resident-info-group">
                      <div className="resident-icon-box">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <div className="resident-title-row">
                          <span className="resident-status-title">
                            Resident Status: Active in Hostel
                          </span>
                          <span className="resident-badge-active">
                            Good Standing
                          </span>
                        </div>
                        <p className="resident-meta-text">
                          <strong>{data.student.name}</strong> ({data.student.jntuNo}) ·{' '}
                          {data.student.blockName || 'Hostel'} - Room {data.student.roomNumber || 'Assigned'}
                        </p>
                      </div>
                    </div>
                    <div className="resident-status-aside">
                      <span className="resident-aside-label">Pending Applications</span>
                      <span className="resident-aside-value">
                        {data.summary.pending} request{data.summary.pending !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Phase 8: KPI Statistics Summary */}
              <div className="leaves-kpi-grid">
                <div className="leave-kpi-card">
                  <span className="kpi-title">Total Leaves</span>
                  <span className="kpi-number">{data.summary.total}</span>
                  <span className="kpi-subtext">All-time applications</span>
                </div>

                <div className="leave-kpi-card">
                  <span className="kpi-title" style={{ color: '#B45309' }}>Pending</span>
                  <span className="kpi-number" style={{ color: '#92400E' }}>{data.summary.pending}</span>
                  <span className="kpi-subtext">Awaiting warden review</span>
                </div>

                <div className="leave-kpi-card">
                  <span className="kpi-title" style={{ color: '#047857' }}>Approved / Active</span>
                  <span className="kpi-number" style={{ color: '#065F46' }}>
                    {data.summary.approved + data.summary.active}
                  </span>
                  <span className="kpi-subtext">
                    {data.summary.active} currently active
                  </span>
                </div>

                <div className="leave-kpi-card">
                  <span className="kpi-title">Completed</span>
                  <span className="kpi-number">{data.summary.completed}</span>
                  <span className="kpi-subtext">Concluded leaves</span>
                </div>

                <div className="leave-kpi-card">
                  <span className="kpi-title" style={{ color: '#BE123C' }}>Rejected / Cancelled</span>
                  <span className="kpi-number" style={{ color: '#9F1239' }}>
                    {data.summary.rejected + data.summary.cancelled}
                  </span>
                  <span className="kpi-subtext">
                    {data.summary.rejected} rejected · {data.summary.cancelled} cancelled
                  </span>
                </div>
              </div>

              {/* Filters & Tabs Bar */}
              <div className="leaves-filter-toolbar">
                {/* Status Filter Tabs */}
                <div className="filter-pills-group">
                  {[
                    { key: 'ALL', label: 'All', count: data.summary.total },
                    { key: 'PENDING', label: 'Pending', count: data.summary.pending },
                    { key: 'APPROVED', label: 'Approved', count: data.summary.approved + data.summary.active },
                    { key: 'COMPLETED', label: 'Completed', count: data.summary.completed },
                    { key: 'REJECTED', label: 'Rejected', count: data.summary.rejected },
                    { key: 'CANCELLED', label: 'Cancelled', count: data.summary.cancelled },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setStatusFilter(tab.key)}
                      className={`filter-pill-btn ${statusFilter === tab.key ? 'active' : ''}`}
                    >
                      <span>{tab.label}</span>
                      <span className="filter-pill-count">{tab.count}</span>
                    </button>
                  ))}
                </div>

                {/* Leave Type Selector */}
                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor="leave-type-filter" className="text-xs font-semibold text-slate-500 whitespace-nowrap">
                    Type:
                  </label>
                  <select
                    id="leave-type-filter"
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="portal-select"
                    style={{ minWidth: '180px' }}
                  >
                    <option value="ALL">All Categories</option>
                    <option value="HOME_LEAVE">Home Leave</option>
                    <option value="MEDICAL">Medical Leave</option>
                    <option value="ACADEMIC">Academic / Conference</option>
                    <option value="EMERGENCY">Family Emergency</option>
                    <option value="SPECIAL_LEAVE">Special Leave</option>
                  </select>
                </div>
              </div>

              {/* Phase 8 & 14: Leave Requests List */}
              {filteredRequests.length === 0 ? (
                <div className="empty-state-container">
                  <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2">
                    <Calendar size={32} />
                  </div>
                  <h3 className="text-base font-bold text-slate-800">No Leave Requests Found</h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto mb-3">
                    {statusFilter !== 'ALL' || typeFilter !== 'ALL'
                      ? 'No applications match your selected filter criteria.'
                      : 'You have not submitted any leave applications yet. When you need to be away from the hostel, apply using the button below.'}
                  </p>
                  {!isSuspended && (
                    <button
                      type="button"
                      onClick={() => setIsApplyModalOpen(true)}
                      className="btn-primary-action inline-flex"
                    >
                      <Plus size={16} />
                      <span>Apply for Leave</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="leaves-cards-list">
                  {filteredRequests.map((req) => (
                    <div key={req.id} className="leave-card">
                      {/* Card Header: Type Badge, ID, Date Applied, & Status Badge */}
                      <div className="leave-card-header">
                        <div className="leave-card-top-left">
                          <div className={`leave-type-pill ${getLeaveTypeClass(req.leaveType)}`}>
                            {getLeaveTypeIcon(req.leaveType)}
                            <span>{getLeaveTypeLabel(req.leaveType)}</span>
                          </div>
                          <span className="leave-request-id">
                            {req.requestNumber || 'LEV-PENDING'}
                          </span>
                          <span className="text-xs text-slate-400">
                            · Applied {formatDate(req.createdAt)}
                          </span>
                        </div>
                        <div>{renderStatusBadge(req.effectiveStatus)}</div>
                      </div>

                      <div className="leave-card-body">
                        <div>
                          {/* Date Range & Duration */}
                          <div className="leave-dates-box">
                            <div className="date-node">
                              <span className="date-label">Departure</span>
                              <span className="date-value">{formatDate(req.startDate)}</span>
                            </div>
                            <div className="duration-arrow">
                              <span className="duration-text">{req.durationDays} day{req.durationDays !== 1 ? 's' : ''}</span>
                              <div className="arrow-line" />
                            </div>
                            <div className="date-node">
                              <span className="date-label">Return</span>
                              <span className="date-value">{formatDate(req.endDate)}</span>
                            </div>
                          </div>

                          {/* Destination */}
                          <div className="leave-meta-row">
                            <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                            <span className="text-slate-700 font-medium">{req.destination}</span>
                          </div>

                          {/* Reason */}
                          <div className="leave-reason-text">
                            "{req.reason}"
                          </div>
                        </div>

                        {/* Card Actions */}
                        <div className="leave-card-actions">
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(req.id)}
                            className="btn-secondary-action"
                            style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                          >
                            <Eye size={14} />
                            <span>View Details</span>
                          </button>

                          {req.status === 'PENDING' && (
                            <>
                              {cancelConfirmId === req.id ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleCancelLeave(req.id)}
                                    disabled={cancellingId === req.id}
                                    className="btn-destructive-action"
                                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                                  >
                                    {cancellingId === req.id ? '...' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setCancelConfirmId(null)}
                                    className="btn-secondary-action"
                                    style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
                                  >
                                    No
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setCancelConfirmId(req.id)}
                                  className="btn-destructive-action"
                                  style={{ fontSize: '0.8rem', padding: '0.5rem 0.85rem' }}
                                >
                                  <Trash2 size={13} />
                                  <span>Cancel</span>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            /* Dedicated Hostel Suspensions Section */
            <div className="flex flex-col gap-6">
              {/* Disciplinary Standing Overview Banner */}
              {data.currentStatus === 'SUSPENDED' && data.activeSuspension ? (
                <div className="suspension-alert-banner">
                  <div className="suspension-alert-icon">
                    <ShieldAlert size={28} />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="suspension-badge">Active Disciplinary Suspension</span>
                        <span className="text-xs font-semibold text-rose-700">
                          Administrative Action
                        </span>
                      </div>
                      <span className="text-xs font-semibold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-md">
                        Enforced Until: {formatDate(data.activeSuspension.endDate)}
                      </span>
                    </div>

                    <h2 className="text-lg font-bold text-rose-950 mt-2 mb-1">
                      Account Under Disciplinary Suspension
                    </h2>
                    <p className="text-sm text-rose-800">
                      <strong>Grounds:</strong> {data.activeSuspension.reason}
                    </p>
                    {data.activeSuspension.remarks && (
                      <p className="text-xs text-rose-700 mt-1 bg-white/70 p-2.5 rounded-lg border border-rose-200">
                        <strong>Administrative Remarks:</strong> {data.activeSuspension.remarks}
                      </p>
                    )}
                    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-rose-800">
                      <AlertTriangle size={14} className="shrink-0" />
                      <span>
                        Under hostel administrative rules, gate outing requests and leave permissions are blocked while under suspension.
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-6 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-start gap-4 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center shrink-0">
                    <ShieldCheck size={28} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-base font-bold text-emerald-950">
                        Disciplinary Record in Good Standing
                      </h3>
                      <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                        Clean Status
                      </span>
                    </div>
                    <p className="text-sm text-emerald-800 leading-relaxed">
                      You currently have no active administrative suspensions or disciplinary restrictions. You are fully eligible for hostel gate outings, mess reservations, and leave requests subject to standard warden authorizations.
                    </p>
                  </div>
                </div>
              )}

              {/* Historical Disciplinary Log */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">Historical Disciplinary Records</h3>
                    <p className="text-xs text-slate-500">Official log of past and present disciplinary administrative actions</p>
                  </div>
                  <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
                    {data.suspensions?.length || 0} Record{data.suspensions?.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {(!data.suspensions || data.suspensions.length === 0) ? (
                  <div className="empty-state-container bg-white border border-slate-200 rounded-2xl p-10 text-center">
                    <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                      <ShieldCheck size={28} />
                    </div>
                    <h4 className="text-base font-bold text-slate-800">No Disciplinary Suspensions Recorded</h4>
                    <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                      Your administrative record is clean. No disciplinary actions or hostel suspensions have been issued for your student account.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.suspensions.map((s) => {
                      const isOrderActive = s.status === 'ACTIVE' && new Date(s.endDate) >= new Date();
                      return (
                        <div
                          key={s.id}
                          className={`student-suspension-card ${isOrderActive ? 'active-order' : ''}`}
                        >
                          <div className="student-suspension-header">
                            <div className="student-suspension-order-title">
                              {isOrderActive ? (
                                <ShieldAlert size={18} className="text-rose-600 shrink-0" />
                              ) : (
                                <CheckCircle2 size={18} className="text-slate-500 shrink-0" />
                              )}
                              <span>Order #{s.id.slice(0, 8).toUpperCase()}</span>
                              <span className="text-xs font-normal text-slate-400">
                                · Issued by {s.createdBy || 'Hostel Administration'}
                              </span>
                            </div>
                            <div>
                              {isOrderActive ? (
                                <span className="student-status-badge rejected">
                                  Active Suspension
                                </span>
                              ) : (
                                <span className="student-status-badge closed">
                                  Concluded / Lifted
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Effective Duration
                              </span>
                              <div className="flex items-center gap-2 text-slate-800 font-semibold">
                                <Calendar size={15} className="text-slate-400" />
                                <span>{formatDate(s.startDate)} — {formatDate(s.endDate)}</span>
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Grounds / Reason
                              </span>
                              <span className="text-slate-800 font-medium">{s.reason}</span>
                            </div>
                          </div>

                          {s.remarks && (
                            <div className="text-xs p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-amber-900">
                              <strong>Administrative Remarks:</strong> {s.remarks}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Phase 9: Apply for Leave Modal */}
      {isApplyModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog-box">
            <div className="modal-header-bar">
              <div>
                <h3 className="modal-header-title">Apply for Hostel Leave</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Submit temporary leave request for warden authorization
                </p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => {
                  setIsApplyModalOpen(false);
                  setFormError(null);
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body-scrollable">
                {formError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-rose-600 shrink-0 mt-0.5" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Leave Type */}
                <div className="form-group-clean">
                  <label className="form-label-clean">
                    Leave Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    className="portal-select"
                    required
                  >
                    <option value="HOME_LEAVE">Home Leave (Family Visit)</option>
                    <option value="MEDICAL">Medical Leave / Treatment</option>
                    <option value="ACADEMIC">Academic / Conference / Exam</option>
                    <option value="EMERGENCY">Family Emergency</option>
                    <option value="SPECIAL_LEAVE">Special Permission</option>
                  </select>
                </div>

                {/* Destination */}
                <div className="form-group-clean">
                  <label className="form-label-clean">
                    Destination Address / City <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Plot 42, Jubilee Hills, Hyderabad"
                    className="portal-input"
                    required
                    maxLength={150}
                  />
                </div>

                {/* Dates Grid */}
                <div className="form-grid-2col">
                  <div className="form-group-clean">
                    <label className="form-label-clean">
                      Departure Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="portal-input"
                      required
                    />
                  </div>
                  <div className="form-group-clean">
                    <label className="form-label-clean">
                      Return Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      min={startDate || new Date().toISOString().split('T')[0]}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="portal-input"
                      required
                    />
                  </div>
                </div>

                {/* Reason */}
                <div className="form-group-clean">
                  <label className="form-label-clean">
                    Reason for Leave <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="State the purpose of your leave in detail (minimum 5 characters)..."
                    className="portal-textarea"
                    required
                    minLength={5}
                    maxLength={500}
                  />
                </div>

                {/* Emergency Contact */}
                <div className="form-group-clean">
                  <label className="form-label-clean">
                    Parent / Emergency Contact Number
                  </label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="portal-input"
                  />
                </div>
              </div>

              <div className="modal-footer-bar">
                <button
                  type="button"
                  className="btn-secondary-action"
                  onClick={() => setIsApplyModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary-action"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={16} className="spin-icon" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Submit Application</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Phase 10: Authoritative Leave Details Modal */}
      {selectedLeaveId && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog-box" style={{ maxWidth: '640px' }}>
            <div className="modal-header-bar">
              <div>
                <h3 className="modal-header-title">Leave Request Details</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative hostel administration verification record
                </p>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedLeaveId(null)}
              >
                <X size={20} />
              </button>
            </div>

            {isDetailLoading && (
              <div className="p-12 text-center">
                <div className="inline-block w-8 h-8 border-4 border-primary-navy border-t-transparent rounded-full animate-spin"></div>
                <p className="mt-3 text-sm text-slate-500 font-medium">Retrieving authoritative leave details...</p>
              </div>
            )}

            {detailError && (
              <div className="p-6 text-center text-rose-600 text-sm">
                <AlertTriangle size={24} className="mx-auto mb-2 text-rose-500" />
                <p>{detailError}</p>
              </div>
            )}

            {selectedLeave && (
              <div>
                <div className="modal-body-scrollable">
                  {/* Header Reference & Status */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Application Reference
                      </span>
                      <span className="font-mono text-lg font-extrabold text-primary-navy">
                        {selectedLeave.requestNumber || 'LEV-PENDING'}
                      </span>
                    </div>
                    <div>{renderStatusBadge(selectedLeave.effectiveStatus)}</div>
                  </div>

                  {/* Visual Chronological Timeline */}
                  {selectedLeave.timeline && selectedLeave.timeline.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                        Lifecycle Progression
                      </h4>
                      <div className="space-y-3">
                        {selectedLeave.timeline.map((step, idx) => (
                          <div key={idx} className="flex items-start gap-3">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                                step.current
                                  ? 'bg-primary-navy text-white ring-4 ring-primary-navy/20'
                                  : step.completed
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-200 text-slate-500'
                              }`}
                            >
                              {step.completed ? '✓' : idx + 1}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${step.current ? 'text-primary-navy' : 'text-slate-800'}`}>
                                  {step.title}
                                </span>
                                <span className="text-[11px] text-slate-400">
                                  {formatDateTime(step.timestamp)}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">{step.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Key Details Grid */}
                  <div className="form-grid-2col">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Category
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {getLeaveTypeLabel(selectedLeave.leaveType)}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Duration
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {selectedLeave.durationDays} Consecutive Days
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Departure Date
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {formatDate(selectedLeave.startDate)}
                      </span>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Return Date
                      </span>
                      <span className="text-xs font-bold text-slate-800 mt-0.5 block">
                        {formatDate(selectedLeave.endDate)}
                      </span>
                    </div>
                  </div>

                  {/* Destination & Reason */}
                  <div className="space-y-3 text-xs">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Destination Address
                      </span>
                      <span className="text-slate-800 font-medium">
                        {selectedLeave.destination || 'Not specified'}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                        Reason for Application
                      </span>
                      <p className="text-slate-700 whitespace-pre-wrap">{selectedLeave.reason}</p>
                    </div>

                    {selectedLeave.emergencyContact && (
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                          Emergency Contact
                        </span>
                        <span className="text-slate-800 font-medium">{selectedLeave.emergencyContact}</span>
                      </div>
                    )}

                    {/* Administrative Notes */}
                    {selectedLeave.status === 'APPROVED' && (
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <span className="font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                          Approval Record
                        </span>
                        <p className="text-emerald-900">
                          Authorized by <strong>{selectedLeave.approvedBy || 'Hostel Warden'}</strong> on{' '}
                          {formatDateTime(selectedLeave.approvedAt || selectedLeave.updatedAt)}
                        </p>
                        {selectedLeave.remarks && (
                          <p className="text-emerald-800 mt-1 italic">Remarks: {selectedLeave.remarks}</p>
                        )}
                      </div>
                    )}

                    {selectedLeave.status === 'REJECTED' && (
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                        <span className="font-bold text-rose-800 uppercase tracking-wider block mb-1">
                          Rejection Information
                        </span>
                        <p className="text-rose-900">
                          {selectedLeave.rejectionReason || 'Application rejected by administration.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-footer-bar">
                  {selectedLeave.status === 'PENDING' && (
                    <button
                      type="button"
                      className="btn-destructive-action"
                      disabled={cancellingId === selectedLeave.id}
                      onClick={() => handleCancelLeave(selectedLeave.id)}
                    >
                      <Trash2 size={15} />
                      <span>{cancellingId === selectedLeave.id ? 'Cancelling...' : 'Cancel Leave'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary-action"
                    onClick={() => setSelectedLeaveId(null)}
                  >
                    Close Details
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default LeavesPage;
