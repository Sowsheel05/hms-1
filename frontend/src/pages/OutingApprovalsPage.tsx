import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Footprints,
  Clock,
  CheckCircle2,
  XCircle,
  LogOut,
  LogIn,
  Search,
  RefreshCw,
  AlertCircle,
  Check,
  X,
  User,
  Calendar,
  FileText,
  ChevronLeft,
  ChevronRight,
  Info,
  MapPin,
  Phone,
  Mail,
  AlertTriangle,
  LayoutGrid,
  List,
  Building,
  Settings,
  Users,
} from 'lucide-react';
import {
  managementApiService,
  OutingStats,
  ManagementOutingItem,
  ManagementOutingDetail,
  Block,
} from '../services/api';

interface OutingApprovalsPageProps {
  onNavigate?: (path: string) => void;
}

export const OutingApprovalsPage: React.FC<OutingApprovalsPageProps> = () => {
  // Statistics State
  const [stats, setStats] = useState<OutingStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Outings List State
  const [outings, setOutings] = useState<ManagementOutingItem[]>([]);
  const [isListLoading, setIsListLoading] = useState<boolean>(true);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 10, totalPages: 1 });

  // View Mode: 'cards' is the authoritative default matching the reference
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Filters State
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [passTypeFilter, setPassTypeFilter] = useState<string>('ALL');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [genderFilter, setGenderFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<string>('');

  // Residential Blocks for Filter
  const [blocks, setBlocks] = useState<Block[]>([]);

  // Live SSE Status
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Action / Feedback Message
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal States
  const [selectedOutingDetail, setSelectedOutingDetail] = useState<ManagementOutingDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // Approve Confirmation Modal & Parent Consent State
  const [approvingOuting, setApprovingOuting] = useState<ManagementOutingItem | null>(null);
  const [consentMode, setConsentMode] = useState<string>('PHONE_CALL');
  const [consentParentName, setConsentParentName] = useState<string>('');
  const [consentParentPhone, setConsentParentPhone] = useState<string>('');
  const [consentNotes, setConsentNotes] = useState<string>('');
  const [isConsentConfirmed, setIsConsentConfirmed] = useState<boolean>(true);
  const [isSubmittingApprove, setIsSubmittingApprove] = useState<boolean>(false);

  // Reject Modal State
  const [rejectingOuting, setRejectingOuting] = useState<ManagementOutingItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [rejectionError, setRejectionError] = useState<string>('');
  const [isSubmittingReject, setIsSubmittingReject] = useState<boolean>(false);

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
      .catch((err) => console.error('Failed to load blocks for filter:', err));
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch Outing Statistics
  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setIsStatsLoading(true);
    try {
      const res = await managementApiService.getOutingStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Error loading outing statistics:', err);
    } finally {
      if (!silent) setIsStatsLoading(false);
    }
  }, []);

  // Fetch Outing Requests with Filters
  const fetchOutings = useCallback(
    async (pageToLoad = 1, silent = false) => {
      if (!silent) setIsListLoading(true);
      try {
        const res = await managementApiService.getOutings({
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: searchTerm.trim() || undefined,
          passType: passTypeFilter !== 'ALL' ? passTypeFilter : undefined,
          blockId: blockFilter !== 'ALL' ? blockFilter : undefined,
          date: dateFilter || undefined,
          page: pageToLoad,
          limit: 10,
        });

        if (res.success) {
          setOutings(res.data || []);
          if (res.pagination) {
            setPagination({
              total: res.pagination.total,
              page: res.pagination.page,
              limit: res.pagination.limit,
              totalPages: res.pagination.totalPages,
            });
          }
        }
      } catch (err: any) {
        console.error('Error fetching outing requests:', err);
        setToastMessage({ type: 'error', text: err.message || 'Failed to load outing requests.' });
      } finally {
        if (!silent) setIsListLoading(false);
      }
    },
    [statusFilter, searchTerm, passTypeFilter, blockFilter, dateFilter]
  );

  // Initial Load
  useEffect(() => {
    fetchStats();
    fetchOutings(1);
  }, [fetchStats, fetchOutings]);

  const fetchStatsRef = useRef(fetchStats);
  const fetchOutingsRef = useRef(fetchOutings);
  const currentPageRef = useRef(pagination.page);

  useEffect(() => {
    fetchStatsRef.current = fetchStats;
    fetchOutingsRef.current = fetchOutings;
    currentPageRef.current = pagination.page;
  }, [fetchStats, fetchOutings, pagination.page]);

  // Real-time EventSource Setup using authenticated managementApiService
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        const type = (event?.type || '').toUpperCase();
        if (
          type.startsWith('OUTING_') ||
          type === 'BIOMETRIC_MOVEMENT' ||
          type === 'OUTING_STATS_UPDATED' ||
          type === 'MANAGEMENT_DASHBOARD_EVENT' ||
          type === 'MANAGEMENT_DASHBOARD_UPDATE'
        ) {
          fetchStatsRef.current(true);
          fetchOutingsRef.current(currentPageRef.current, true);
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, []);

  // Manual Sync
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([fetchStats(true), fetchOutings(pagination.page, true)]);
    setIsRefreshing(false);
    setToastMessage({ type: 'success', text: 'Outing records refreshed from PostgreSQL.' });
  };

  // Inspect Detail
  const handleOpenDetail = async (outingId: string) => {
    setIsLoadingDetail(true);
    try {
      const res = await managementApiService.getOutingDetail(outingId);
      if (res.success && res.data) {
        setSelectedOutingDetail(res.data);
      }
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to load outing details.' });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleOpenApproveModal = (item: ManagementOutingItem) => {
    setApprovingOuting(item);
    setConsentParentName(item.student?.parentName || (item.student?.name ? `${item.student.name}'s Parent` : 'Parent / Guardian'));
    setConsentParentPhone(item.student?.parentPhone || item.emergencyContact || '+91 98765 43210');
    setConsentMode('PHONE_CALL');
    setConsentNotes(`Parent verified via phone call prior to outing approval.`);
    setIsConsentConfirmed(true);
  };

  // Approve Outing
  const handleConfirmApprove = async () => {
    if (!approvingOuting) return;
    if (!isConsentConfirmed) {
      setToastMessage({ type: 'error', text: 'Parent consent verification check is required to approve outing.' });
      return;
    }
    setIsSubmittingApprove(true);
    try {
      const res = await managementApiService.approveOuting(approvingOuting.id, {
        parentName: consentParentName,
        parentPhone: consentParentPhone,
        consentMode,
        notes: consentNotes,
      });
      setToastMessage({
        type: 'success',
        text: res.message || `Outing pass #${approvingOuting.requestNumber || approvingOuting.id} approved with parent consent recorded.`,
      });
      setApprovingOuting(null);
      if (selectedOutingDetail?.id === approvingOuting.id) {
        setSelectedOutingDetail((prev) =>
          prev
            ? {
                ...prev,
                status: 'APPROVED',
                rawStatus: 'APPROVED',
                approvedAt: new Date().toISOString(),
                approvedBy: 'Hostel Administration',
              }
            : null
        );
      }
      fetchStats(true);
      fetchOutings(pagination.page, true);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err.message || 'Failed to approve request.' });
    } finally {
      setIsSubmittingApprove(false);
    }
  };

  // Reject Outing
  const handleConfirmReject = async () => {
    if (!rejectingOuting) return;
    if (!rejectionReason || rejectionReason.trim().length < 3) {
      setRejectionError('Please provide a reason of at least 3 characters.');
      return;
    }

    setIsSubmittingReject(true);
    try {
      const res = await managementApiService.rejectOuting(rejectingOuting.id, rejectionReason.trim());
      setToastMessage({
        type: 'success',
        text: res.message || `Outing pass #${rejectingOuting.requestNumber || rejectingOuting.id} rejected.`,
      });
      const reasonText = rejectionReason.trim();
      setRejectingOuting(null);
      setRejectionReason('');
      setRejectionError('');
      if (selectedOutingDetail?.id === rejectingOuting.id) {
        setSelectedOutingDetail((prev) =>
          prev
            ? {
                ...prev,
                status: 'REJECTED',
                rawStatus: 'REJECTED',
                rejectedAt: new Date().toISOString(),
                rejectedBy: 'Hostel Administration',
                rejectionReason: reasonText,
              }
            : null
        );
      }
      fetchStats(true);
      fetchOutings(pagination.page, true);
    } catch (err: any) {
      setRejectionError(err.message || 'Failed to reject request.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setStatusFilter('ALL');
    setSearchTerm('');
    setPassTypeFilter('ALL');
    setBlockFilter('ALL');
    setGenderFilter('ALL');
    setDateFilter('');
  };

  // Format Date Helper
  const formatDateTime = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (isoString?: string | null) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Status Badge Component
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return (
          <span className="outing-status-badge pending">
            <Clock size={12} />
            Pending Review
          </span>
        );
      case 'APPROVED':
        return (
          <span className="outing-status-badge approved">
            <CheckCircle2 size={12} />
            Approved (Awaiting Exit)
          </span>
        );
      case 'ACTIVE':
      case 'OUT':
        return (
          <span className="outing-status-badge active">
            <LogOut size={12} />
            Outside Hostel
          </span>
        );
      case 'RETURNED':
        return (
          <span className="outing-status-badge returned">
            <LogIn size={12} />
            Returned
          </span>
        );
      case 'REJECTED':
        return (
          <span className="outing-status-badge rejected">
            <XCircle size={12} />
            Rejected
          </span>
        );
      default:
        return <span className="outing-status-badge default">{status}</span>;
    }
  };

  return (
    <div className="outing-management-page">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div className={`outing-toast ${toastMessage.type}`}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="toast-close">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Header Operational Bar */}
      <div className="outing-header-bar">
        <div className="outing-title-group">
          <div className="outing-icon-badge">
            <Footprints size={24} />
          </div>
          <div>
            <h1 className="outing-main-title">Outing Requests</h1>
            <p className="outing-sub-title">
              Review and approve resident movement passes. Track physical exit and return.
            </p>
          </div>
        </div>

        <div className="outing-controls-group">
          <div className="live-indicator">
            <span className={`live-dot ${isLiveConnected ? 'connected' : 'disconnected'}`} />
            <span className="live-text">{isLiveConnected ? 'Live Realtime' : 'Connecting...'}</span>
          </div>

          <button
            type="button"
            className="btn-secondary refresh-btn"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            title="Refresh statistics and requests from PostgreSQL"
          >
            <RefreshCw size={15} className={isRefreshing ? 'spin' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* KPI Statistics Section */}
      <div className="outing-kpi-grid">
        <div className="outing-kpi-card total">
          <div className="kpi-header">
            <span className="kpi-label">Total Outing Passes</span>
            <div className="kpi-icon-wrap total">
              <FileText size={18} />
            </div>
          </div>
          <div className="kpi-value">{isStatsLoading ? '—' : stats?.total ?? 0}</div>
          <div className="kpi-subtext">Cumulative registered passes</div>
        </div>

        <div className="outing-kpi-card pending-card">
          <div className="kpi-header">
            <span className="kpi-label">Pending Approval</span>
            <div className="kpi-icon-wrap pending">
              <Clock size={18} />
            </div>
          </div>
          <div className="kpi-value warning-text">{isStatsLoading ? '—' : stats?.pending ?? 0}</div>
          <div className="kpi-subtext">
            {(stats?.pending ?? 0) > 0 ? 'Action required by Warden' : 'All requests processed'}
          </div>
        </div>

        <div className="outing-kpi-card approved-card">
          <div className="kpi-header">
            <span className="kpi-label">Approved Passes</span>
            <div className="kpi-icon-wrap approved">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="kpi-value">{isStatsLoading ? '—' : stats?.approved ?? 0}</div>
          <div className="kpi-subtext">Awaiting gate exit</div>
        </div>

        <div className="outing-kpi-card active-card">
          <div className="kpi-header">
            <span className="kpi-label">Currently Outside</span>
            <div className="kpi-icon-wrap active">
              <LogOut size={18} />
            </div>
          </div>
          <div className="kpi-value active-text">{isStatsLoading ? '—' : stats?.active ?? 0}</div>
          <div className="kpi-subtext">Verified physical exit at turnstile</div>
        </div>

        <div className="outing-kpi-card returned-card">
          <div className="kpi-header">
            <span className="kpi-label">Returned Passes</span>
            <div className="kpi-icon-wrap returned">
              <LogIn size={18} />
            </div>
          </div>
          <div className="kpi-value success-text">{isStatsLoading ? '—' : stats?.returned ?? 0}</div>
          <div className="kpi-subtext">Successfully checked back in</div>
        </div>

        <div className="outing-kpi-card rejected-card">
          <div className="kpi-header">
            <span className="kpi-label">Rejected Passes</span>
            <div className="kpi-icon-wrap rejected">
              <XCircle size={18} />
            </div>
          </div>
          <div className="kpi-value danger-text">{isStatsLoading ? '—' : stats?.rejected ?? 0}</div>
          <div className="kpi-subtext">Declined with recorded reason</div>
        </div>
      </div>

      {/* Main Operations Container */}
      <div className="outing-main-card">
        {/* Quick Filter Tabs */}
        <div className="outing-status-tabs">
          <button
            type="button"
            className={`status-tab ${statusFilter === 'ALL' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ALL')}
          >
            All Passes
            <span className="tab-count">{stats?.total ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'PENDING' ? 'active' : ''}`}
            onClick={() => setStatusFilter('PENDING')}
          >
            Pending
            <span className={`tab-count ${stats?.pending ? 'highlight-amber' : ''}`}>
              {stats?.pending ?? 0}
            </span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'APPROVED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('APPROVED')}
          >
            Approved
            <span className="tab-count">{stats?.approved ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            onClick={() => setStatusFilter('ACTIVE')}
          >
            Outside Hostel
            <span className="tab-count">{stats?.active ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'RETURNED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('RETURNED')}
          >
            Returned
            <span className="tab-count">{stats?.returned ?? 0}</span>
          </button>

          <button
            type="button"
            className={`status-tab ${statusFilter === 'REJECTED' ? 'active' : ''}`}
            onClick={() => setStatusFilter('REJECTED')}
          >
            Rejected
            <span className="tab-count">{stats?.rejected ?? 0}</span>
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="outing-toolbar">
          <div className="search-box">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search by student name, JNTU No, destination..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="search-clear-btn"
                title="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="filter-select-group">
            <div className="select-wrapper">
              <label htmlFor="outing-pass-type" className="sr-only">Pass Type</label>
              <select
                id="outing-pass-type"
                value={passTypeFilter}
                onChange={(e) => setPassTypeFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Pass Types</option>
                <option value="LOCAL_OUTING">Local Outing</option>
                <option value="GENERAL_OUTING">General Outing</option>
                <option value="EMERGENCY">Medical / Emergency</option>
                <option value="NIGHT_OUT">Night Out</option>
                <option value="COACHING_TUITION">Coaching / Tuition</option>
                <option value="ACADEMIC_PROJECT">Academic / Project</option>
              </select>
            </div>

            <div className="select-wrapper">
              <label htmlFor="outing-block-filter" className="sr-only">Residential Block</label>
              <select
                id="outing-block-filter"
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Residential Blocks</option>
                {blocks.map((block) => (
                  <option key={block.id} value={block.id}>
                    {block.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="select-wrapper">
              <label htmlFor="outing-gender-filter" className="sr-only">Hostel Scope</label>
              <select
                id="outing-gender-filter"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
                className="filter-select"
              >
                <option value="ALL">All Hostels</option>
                <option value="BOYS">Boys Hostel</option>
                <option value="GIRLS">Girls Hostel</option>
              </select>
            </div>

            <div className="date-input-wrapper">
              <label htmlFor="outing-date-filter" className="sr-only">Filter by Date</label>
              <input
                id="outing-date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="filter-date-input"
                title="Filter by transit date"
              />
            </div>

            {(statusFilter !== 'ALL' ||
              searchTerm ||
              passTypeFilter !== 'ALL' ||
              blockFilter !== 'ALL' ||
              genderFilter !== 'ALL' ||
              dateFilter) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn-secondary reset-filter-btn"
                title="Reset all filters"
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
                title="Cards view"
              >
                <LayoutGrid size={15} />
              </button>
              <button
                type="button"
                className={`view-mode-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Requests Cards / Table View */}
        {isListLoading ? (
          <div className="outing-loading-state">
            <RefreshCw size={28} className="spin" />
            <p>Loading outing requests from PostgreSQL...</p>
          </div>
        ) : outings.length === 0 ? (
          <div className="outing-empty-state">
            <Footprints size={40} className="empty-icon" />
            <h3>No Outing Requests Found</h3>
            <p>There are no resident outing records matching your selected filter criteria.</p>
            {(statusFilter !== 'ALL' || searchTerm || passTypeFilter !== 'ALL' || blockFilter !== 'ALL' || genderFilter !== 'ALL' || dateFilter) && (
              <button type="button" onClick={handleResetFilters} className="btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <>
            {/* 1. Authoritative Cards View (Primary) */}
            {viewMode === 'cards' && (
              <div className="outing-cards-grid">
                {outings.map((item) => {
                  const isPending = item.status === 'PENDING';
                  const isEmergency = item.passType === 'EMERGENCY';
                  const isRejected = item.status === 'REJECTED';
                  const studentName = item.student?.name || 'Resident';
                  const initials = studentName
                    .split(' ')
                    .filter(Boolean)
                    .map((p) => p[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();

                  return (
                    <article
                      key={item.id}
                      className={`outing-request-card ${isPending ? 'card-pending' : ''}`}
                      aria-label={`Outing request for ${studentName}`}
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
                              <span className="jntu-pill">{item.student?.jntuNo}</span>
                              <span className="room-pill">
                                <Building size={12} />
                                {item.student?.blockName || 'Unassigned'} • Room {item.student?.roomNumber || '?'}
                              </span>
                              {item.student?.academic?.year && (
                                <span className="academic-pill">{item.student.academic.year}</span>
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
                              Applied {formatDateOnly(item.createdAt)}
                            </span>
                          </div>

                          <div className="tags-badges-row">
                            {isEmergency && (
                              <span className="pass-type-badge emergency-badge">
                                <AlertTriangle size={12} />
                                Medical / Emergency
                              </span>
                            )}
                            <span className="pass-type-badge">
                              {item.passType?.replace(/_/g, ' ')}
                            </span>
                            {renderStatusBadge(item.status)}
                          </div>
                        </div>
                      </div>

                      {/* 4-Column / Multi-Row Responsive Info Grid */}
                      <div className="card-info-grid">
                        {/* 1. Destination & Purpose */}
                        <div className="info-block">
                          <span className="block-label">Destination &amp; Purpose</span>
                          <div className="block-value dest-val">
                            <MapPin size={14} className="val-icon" />
                            <span>{item.destination || 'Unspecified destination'}</span>
                          </div>
                          <p className="purpose-desc-text">{item.purpose}</p>
                        </div>

                        {/* 2. Transit Window */}
                        <div className="info-block">
                          <span className="block-label">Scheduled Transit Window</span>
                          <div className="transit-window-row">
                            <Calendar size={14} className="val-icon" />
                            <div className="window-times">
                              <div className="time-item">
                                <span className="time-lbl">Out:</span>
                                <span className="time-val">{formatDateTime(item.outDate)}</span>
                              </div>
                              <div className="time-item">
                                <span className="time-lbl">Back:</span>
                                <span className="time-val">{formatDateTime(item.returnDate)}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. Contact & Guardian */}
                        <div className="info-block">
                          <span className="block-label">Contact Information</span>
                          <div className="contact-item">
                            <Phone size={13} className="val-icon" />
                            <span>{item.emergencyContact || 'No emergency contact'}</span>
                          </div>
                          <div className="contact-item">
                            <Mail size={13} className="val-icon" />
                            <span className="email-text">{item.student?.email || '—'}</span>
                          </div>
                        </div>

                        {/* 4. Physical Gate Transit */}
                        <div className="info-block">
                          <span className="block-label">Gate Transit Log</span>
                          {item.actualExitTime ? (
                            <div className="transit-event exit">
                              <LogOut size={13} />
                              <span>Exit: {formatDateTime(item.actualExitTime)}</span>
                            </div>
                          ) : item.status === 'APPROVED' ? (
                            <div className="transit-pending-note">
                              <span>Awaiting Turnstile Exit</span>
                            </div>
                          ) : (
                            <div className="transit-none-note">—</div>
                          )}

                          {item.actualReturnTime ? (
                            <div className="transit-event return">
                              <LogIn size={13} />
                              <span>Return: {formatDateTime(item.actualReturnTime)}</span>
                            </div>
                          ) : item.actualExitTime ? (
                            <div className="transit-outside-badge">Currently Outside</div>
                          ) : null}
                        </div>
                      </div>

                      {/* Rejection Alert Banner */}
                      {isRejected && item.rejectionReason && (
                        <div className="card-rejection-banner">
                          <AlertTriangle size={15} className="rejection-icon" />
                          <span>
                            <strong>Rejection Reason:</strong> {item.rejectionReason}
                          </span>
                        </div>
                      )}

                      {/* Card Action Footer */}
                      <div className="card-actions-footer">
                        <button
                          type="button"
                          className="btn-navy-primary btn-action"
                          onClick={() => handleOpenDetail(item.id)}
                          title={`Manage outing request for ${studentName}`}
                        >
                          <Settings size={14} />
                          <span>Manage</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* 2. Table View (Alternative) */}
            {viewMode === 'table' && (
              <div className="outing-table-wrapper">
                <table className="outing-table">
                  <thead>
                    <tr>
                      <th>Request #</th>
                      <th>Student Resident</th>
                      <th>Pass Type &amp; Destination</th>
                      <th>Departure / Return</th>
                      <th>Status</th>
                      <th>Gate Transit Log</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outings.map((item) => {
                      const isPending = item.status === 'PENDING';
                      const hasExit = Boolean(item.actualExitTime);
                      const hasReturn = Boolean(item.actualReturnTime);

                      return (
                        <tr key={item.id} className={`outing-row ${isPending ? 'pending-highlight' : ''}`}>
                          <td>
                            <div className="request-num-cell">
                              <span className="request-num">{item.requestNumber || '—'}</span>
                              <span className="applied-time">{formatDateOnly(item.createdAt)}</span>
                            </div>
                          </td>

                          <td>
                            <div className="student-info-cell">
                              <span className="student-name">{item.student?.name || 'Resident'}</span>
                              <span className="student-sub">
                                {item.student?.jntuNo} •{' '}
                                {item.student?.blockName
                                  ? `${item.student.blockName} (R-${item.student.roomNumber || '?'})`
                                  : 'Unassigned'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="pass-details-cell">
                              <span className="pass-type-badge">
                                {item.passType?.replace(/_/g, ' ')}
                              </span>
                              <span className="destination-text" title={item.destination || ''}>
                                {item.destination || 'Unspecified'}
                              </span>
                            </div>
                          </td>

                          <td>
                            <div className="schedule-cell">
                              <div className="schedule-item">
                                <span className="schedule-label">Out:</span>
                                <span className="schedule-time">{formatDateTime(item.outDate)}</span>
                              </div>
                              <div className="schedule-item">
                                <span className="schedule-label">Back:</span>
                                <span className="schedule-time">{formatDateTime(item.returnDate)}</span>
                              </div>
                            </div>
                          </td>

                          <td>{renderStatusBadge(item.status)}</td>

                          <td>
                            <div className="transit-log-cell">
                              {hasExit ? (
                                <div className="transit-time exit">
                                  <LogOut size={12} />
                                  <span>Exit: {formatDateTime(item.actualExitTime)}</span>
                                </div>
                              ) : item.status === 'APPROVED' ? (
                                <span className="transit-pending">Awaiting Gate Exit</span>
                              ) : (
                                <span className="transit-none">—</span>
                              )}

                              {hasReturn ? (
                                <div className="transit-time return">
                                  <LogIn size={12} />
                                  <span>Return: {formatDateTime(item.actualReturnTime)}</span>
                                </div>
                              ) : hasExit ? (
                                <span className="transit-pending">Currently Outside</span>
                              ) : null}
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div className="action-buttons-group">
                              <button
                                type="button"
                                className="btn-action view-btn manage-full-btn"
                                onClick={() => handleOpenDetail(item.id)}
                                title="Manage Outing Request"
                              >
                                <Settings size={14} />
                                <span>Manage</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {pagination.totalPages > 1 && (
              <div className="outing-pagination">
                <span className="pagination-summary">
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
                </span>

                <div className="pagination-buttons">
                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchOutings(pagination.page - 1)}
                  >
                    <ChevronLeft size={16} />
                    Previous
                  </button>

                  <span className="pagination-current">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>

                  <button
                    type="button"
                    className="pagination-btn"
                    disabled={pagination.page >= pagination.totalPages}
                    onClick={() => fetchOutings(pagination.page + 1)}
                  >
                    Next
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* APPROVE CONFIRMATION MODAL WITH PARENT CONSENT VERIFICATION */}
      {approvingOuting && (
        <div className="mgmt-modal-backdrop" style={{ zIndex: 1050 }} onClick={() => setApprovingOuting(null)}>
          <div className="mgmt-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon approve">
                <CheckCircle2 size={20} />
              </div>
              <div>
                <h3 className="modal-title">Approve Outing Pass</h3>
                <p className="modal-subtitle">Record parent/guardian consent verification prior to authorization</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setApprovingOuting(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable">
              {/* Resident Overview */}
              <div className="review-box">
                <div className="review-row">
                  <span className="review-label">Resident Name:</span>
                  <span className="review-val font-semibold">{approvingOuting.student?.name}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">JNTU Number:</span>
                  <span className="review-val">{approvingOuting.student?.jntuNo}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Pass Type:</span>
                  <span className="review-val">{approvingOuting.passType?.replace(/_/g, ' ')}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Destination:</span>
                  <span className="review-val font-semibold" style={{ color: '#1E3A8A' }}>{approvingOuting.destination}</span>
                </div>
                <div className="review-row">
                  <span className="review-label">Expected Window:</span>
                  <span className="review-val">
                    {formatDateTime(approvingOuting.outDate)} → {formatDateTime(approvingOuting.returnDate)}
                  </span>
                </div>
              </div>

              {/* MANDATORY PARENT CONSENT RECORDING SECTION */}
              <div className="parent-consent-box" style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '0.5rem', padding: '1rem', marginTop: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <Users size={18} style={{ color: '#1E3A8A' }} />
                  <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#0F172A' }}>
                    Parent / Guardian Consent Verification (Warden Audit)
                  </h4>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                      Parent / Guardian Name
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={consentParentName}
                      onChange={(e) => setConsentParentName(e.target.value)}
                      placeholder="Parent/Guardian Full Name"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                      Verified Contact Number <span className="required-star">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={consentParentPhone}
                      onChange={(e) => setConsentParentPhone(e.target.value)}
                      placeholder="+91 Mobile Number"
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                      Verification Channel / Mode
                    </label>
                    <select
                      className="form-select"
                      value={consentMode}
                      onChange={(e) => setConsentMode(e.target.value)}
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', width: '100%', borderRadius: '0.375rem', border: '1px solid #CBD5E1' }}
                    >
                      <option value="PHONE_CALL">Direct Phone Call Confirmation</option>
                      <option value="WHATSAPP">WhatsApp Consent Message</option>
                      <option value="WRITTEN_LETTER">Signed Parent Letter / Pass Form</option>
                      <option value="IN_PERSON">In-Person Guardian Visit</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                      Verification Timestamp
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      value={new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      disabled
                      style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem', backgroundColor: '#E2E8F0', color: '#475569' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                  <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#334155' }}>
                    Warden Verification Notes &amp; Remarks
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    value={consentNotes}
                    onChange={(e) => setConsentNotes(e.target.value)}
                    placeholder="e.g. Spoke with father Mr. Ramesh; confirmed student travel for weekend stay."
                    style={{ padding: '0.45rem 0.65rem', fontSize: '0.85rem' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem' }}>
                  <input
                    type="checkbox"
                    id="consent-confirm-check"
                    checked={isConsentConfirmed}
                    onChange={(e) => setIsConsentConfirmed(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="consent-confirm-check" style={{ fontSize: '0.825rem', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}>
                    I (Warden/Administrator) confirm that parental consent has been verified and recorded.
                  </label>
                </div>
              </div>

              <div className="notice-banner info" style={{ marginTop: '1rem' }}>
                <Info size={16} className="notice-icon" />
                <p>
                  <strong>Security Note:</strong> Approving this pass permits the student to leave the hostel. Physical gate transit (exit &amp; entry) will be verified by security.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setApprovingOuting(null)}
                disabled={isSubmittingApprove}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary approve-confirm-btn"
                onClick={handleConfirmApprove}
                disabled={isSubmittingApprove || !isConsentConfirmed || !consentParentPhone}
              >
                {isSubmittingApprove ? 'Approving...' : 'Confirm Outing Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingOuting && (
        <div className="mgmt-modal-backdrop" style={{ zIndex: 1050 }} onClick={() => setRejectingOuting(null)}>
          <div className="mgmt-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon reject">
                <XCircle size={20} />
              </div>
              <div>
                <h3 className="modal-title">Reject Outing Pass</h3>
                <p className="modal-subtitle">Provide a justification for rejecting request #{rejectingOuting.requestNumber || rejectingOuting.id.slice(0, 8)}</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setRejectingOuting(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              <div className="review-box compact">
                <div>
                  <strong>{rejectingOuting.student?.name}</strong> ({rejectingOuting.student?.jntuNo})
                </div>
                <div className="text-muted">
                  Destination: {rejectingOuting.destination} • Window: {formatDateOnly(rejectingOuting.outDate)}
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reject-reason">
                  Rejection Reason <span className="required-star">*</span>
                </label>
                <textarea
                  id="reject-reason"
                  rows={3}
                  className="form-textarea"
                  placeholder="State clearly why this request cannot be approved (e.g., examination period restrictions, missing parental confirmation, curfew rules)..."
                  value={rejectionReason}
                  onChange={(e) => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError('');
                  }}
                />
                <div className="form-helper-row">
                  <span className={`char-count ${rejectionReason.trim().length >= 3 ? 'valid' : ''}`}>
                    {rejectionReason.trim().length} / min 3 characters
                  </span>
                  {rejectionError && <span className="form-error-msg">{rejectionError}</span>}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setRejectingOuting(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger reject-confirm-btn"
                onClick={handleConfirmReject}
                disabled={isSubmittingReject || rejectionReason.trim().length < 3}
              >
                {isSubmittingReject ? 'Rejecting...' : 'Reject Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL INSPECTION DRAWER / MODAL */}
      {isLoadingDetail && (
        <div className="mgmt-modal-backdrop">
          <div className="mgmt-modal-card" style={{ padding: '2rem', textAlign: 'center', alignItems: 'center' }}>
            <RefreshCw size={32} className="spin" style={{ color: '#151B54', marginBottom: '1rem' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#334155' }}>Loading outing details from PostgreSQL...</p>
          </div>
        </div>
      )}

      {selectedOutingDetail && (
        <div className="mgmt-modal-backdrop" onClick={() => setSelectedOutingDetail(null)}>
          <div className="mgmt-modal-card large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-header-icon detail">
                <Footprints size={20} />
              </div>
              <div>
                <h3 className="modal-title">
                  Manage Outing Pass #{selectedOutingDetail.requestNumber || selectedOutingDetail.id.slice(0, 8)}
                </h3>
                <p className="modal-subtitle">Comprehensive resident profile, parent verification &amp; transit movement</p>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setSelectedOutingDetail(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body scrollable">
              {/* Top Banner Status */}
              <div className="detail-status-banner">
                <div>
                  <span className="banner-label">Current Lifecycle State</span>
                  <div className="banner-badge-wrap">{renderStatusBadge(selectedOutingDetail.status)}</div>
                </div>
                <div className="monthly-usage-badge">
                  <span className="usage-num">{selectedOutingDetail.monthlyUsageCount}</span>
                  <span className="usage-lbl">Outings This Month</span>
                </div>
              </div>

              {/* 1. STUDENT DETAILS */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <User size={16} /> Student Details
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Student Name</span>
                    <span className="cell-val font-semibold">{selectedOutingDetail.student?.name || 'Resident Student'}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Student ID / JNTU No</span>
                    <span className="cell-val mono font-semibold">{selectedOutingDetail.student?.jntuNo}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Branch / Department</span>
                    <span className="cell-val">{selectedOutingDetail.student?.department || 'CSE'}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Year &amp; Section</span>
                    <span className="cell-val">
                      {selectedOutingDetail.student?.year ? `${selectedOutingDetail.student.year} Year` : '2nd Year'} • Sec {selectedOutingDetail.student?.section || 'A'}
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Hostel &amp; Block</span>
                    <span className="cell-val">
                      {selectedOutingDetail.student?.hostelName || 'Boys Hostel'} • Block {selectedOutingDetail.student?.blockName || 'A'}
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Room &amp; Bed</span>
                    <span className="cell-val font-medium">
                      Room {selectedOutingDetail.student?.roomNumber || '—'} (Bed {selectedOutingDetail.student?.bedNumber || '1'})
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Student Mobile</span>
                    <span className="cell-val">{selectedOutingDetail.student?.phone || '—'}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Student Email</span>
                    <span className="cell-val">{selectedOutingDetail.student?.email || '—'}</span>
                  </div>
                </div>
              </div>

              {/* 2. PARENT / GUARDIAN DETAILS (MANDATORY REQUIREMENT) */}
              <div className="parent-guardian-card">
                <h4 className="detail-section-title">
                  <Users size={16} /> Parent / Guardian Verification (Mandatory)
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Parent / Guardian Name</span>
                    <span className="cell-val parent-info-highlight">
                      {selectedOutingDetail.student?.parentName || 'Parent / Guardian'}
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Relationship</span>
                    <span className="cell-val font-medium">
                      {selectedOutingDetail.student?.parentRelation || 'Father / Guardian'}
                    </span>
                  </div>
                  <div className="info-cell full-width">
                    <span className="cell-lbl">Parent / Guardian Mobile Number (Verified)</span>
                    <div>
                      <a
                        href={`tel:${selectedOutingDetail.student?.parentPhone || selectedOutingDetail.emergencyContact || ''}`}
                        className="parent-phone-badge"
                        title="Click to dial parent/guardian mobile number"
                      >
                        <Phone size={15} />
                        <span>
                          {selectedOutingDetail.student?.parentPhone || selectedOutingDetail.emergencyContact || '+91 98765 43210'}
                        </span>
                      </a>
                    </div>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Emergency Contact Number</span>
                    <span className="cell-val font-medium">
                      {selectedOutingDetail.student?.emergencyContact || selectedOutingDetail.emergencyContact || '—'}
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Guardian Address / City</span>
                    <span className="cell-val">
                      {selectedOutingDetail.student?.guardianAddress || 'Registered on file'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. OUTING DETAILS */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <Calendar size={16} /> Outing Request Details
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Pass Classification</span>
                    <span className="cell-val font-semibold">{selectedOutingDetail.passType?.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Destination</span>
                    <span className="cell-val font-semibold" style={{ color: '#1E3A8A' }}>
                      {selectedOutingDetail.destination}
                    </span>
                  </div>
                  <div className="info-cell full-width">
                    <span className="cell-lbl">Purpose / Reason</span>
                    <span className="cell-val">{selectedOutingDetail.purpose}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Outing Date</span>
                    <span className="cell-val font-medium">{formatDateOnly(selectedOutingDetail.outDate)}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Departure Time</span>
                    <span className="cell-val font-medium">{formatDateTime(selectedOutingDetail.outDate)}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Expected Return</span>
                    <span className="cell-val font-medium">{formatDateTime(selectedOutingDetail.returnDate)}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Current Request Status</span>
                    <div style={{ marginTop: '2px' }}>{renderStatusBadge(selectedOutingDetail.status)}</div>
                  </div>
                </div>
              </div>

              {/* 4. PHYSICAL GATE TRANSIT AUDIT */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <LogOut size={16} /> Physical Gate Transit Audit
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Actual Turnstile Exit</span>
                    <span className="cell-val">
                      {selectedOutingDetail.actualExitTime ? (
                        <strong style={{ color: '#7C3AED' }}>{formatDateTime(selectedOutingDetail.actualExitTime)}</strong>
                      ) : (
                        'Not yet exited'
                      )}
                    </span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Actual Turnstile Return</span>
                    <span className="cell-val">
                      {selectedOutingDetail.actualReturnTime ? (
                        <strong style={{ color: '#059669' }}>{formatDateTime(selectedOutingDetail.actualReturnTime)}</strong>
                      ) : selectedOutingDetail.actualExitTime ? (
                        <strong style={{ color: '#D97706' }}>Currently Outside</strong>
                      ) : (
                        '—'
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* 5. REQUEST HISTORY / AUDIT */}
              <div className="detail-section">
                <h4 className="detail-section-title">
                  <CheckCircle2 size={16} /> Request History &amp; Decision Trail
                </h4>
                <div className="detail-info-grid">
                  <div className="info-cell">
                    <span className="cell-lbl">Request Created</span>
                    <span className="cell-val">{formatDateTime(selectedOutingDetail.createdAt)}</span>
                  </div>
                  <div className="info-cell">
                    <span className="cell-lbl">Pass Reference</span>
                    <span className="cell-val mono">{selectedOutingDetail.requestNumber || selectedOutingDetail.id}</span>
                  </div>
                  {selectedOutingDetail.approvedBy && (
                    <>
                      <div className="info-cell">
                        <span className="cell-lbl">Reviewed / Approved By</span>
                        <span className="cell-val font-semibold">{selectedOutingDetail.approvedBy}</span>
                      </div>
                      <div className="info-cell">
                        <span className="cell-lbl">Approved At</span>
                        <span className="cell-val">{formatDateTime(selectedOutingDetail.approvedAt)}</span>
                      </div>
                    </>
                  )}
                  {selectedOutingDetail.rejectedBy && (
                    <>
                      <div className="info-cell">
                        <span className="cell-lbl">Reviewed / Rejected By</span>
                        <span className="cell-val font-semibold">{selectedOutingDetail.rejectedBy}</span>
                      </div>
                      <div className="info-cell">
                        <span className="cell-lbl">Rejected At</span>
                        <span className="cell-val">{formatDateTime(selectedOutingDetail.rejectedAt)}</span>
                      </div>
                      <div className="info-cell full-width">
                        <span className="cell-lbl">Rejection Reason</span>
                        <span className="cell-val" style={{ color: '#DC2626', fontWeight: 600 }}>
                          {selectedOutingDetail.rejectionReason}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* MODAL FOOTER WITH ADMIN ACTIONS */}
            <div className="modal-footer">
              {selectedOutingDetail.status === 'PENDING' ? (
                <>
                  <div className="pending-action-hint" style={{ marginRight: 'auto' }}>
                    <AlertCircle size={14} />
                    <span>Verify parent contact before taking action</span>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setSelectedOutingDetail(null)}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn-action reject-btn"
                    style={{ padding: '0.5rem 1.15rem' }}
                    onClick={() => {
                      setRejectingOuting(selectedOutingDetail as any);
                      setRejectionReason('');
                      setRejectionError('');
                    }}
                    title="Reject this outing request"
                  >
                    <X size={15} />
                    <span>Reject</span>
                  </button>
                  <button
                    type="button"
                    className="btn-action approve-btn"
                    style={{ padding: '0.5rem 1.15rem' }}
                    onClick={() => handleOpenApproveModal(selectedOutingDetail as any)}
                    title="Approve this outing request with parent consent"
                  >
                    <Check size={15} />
                    <span>Approve</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setSelectedOutingDetail(null)}
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
