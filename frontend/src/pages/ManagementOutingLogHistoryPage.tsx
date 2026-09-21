import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ClipboardList,
  Search,
  Filter,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Footprints,
  LogOut,
  LogIn,
  SlidersHorizontal,
  Building,
  Radio,
  FileText,
} from 'lucide-react';
import {
  managementApiService,
  OutingLogItem,
  OutingLogHistoryStats,
  OutingLogDetail,
  OutingTimelineStep,
} from '../services/api';
import '../styles/OutingLogHistory.css';

interface ManagementOutingLogHistoryPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementOutingLogHistoryPage: React.FC<ManagementOutingLogHistoryPageProps> = () => {
  // Records & KPI Stats
  const [records, setRecords] = useState<OutingLogItem[]>([]);
  const [stats, setStats] = useState<OutingLogHistoryStats>({
    todayRequests: 0,
    todayApproved: 0,
    todayExits: 0,
    todayReturns: 0,
    currentlyOutside: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  // Filter Input States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [movementType, setMovementType] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [sourceFilter, setSourceFilter] = useState<string>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Active Applied Filters
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    movementType: 'ALL',
    status: 'ALL',
    source: 'ALL',
    from: '',
    to: '',
  });

  // Modal / Detail State
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<OutingLogDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Fetch Authoritative Outing Log History
  const fetchLogHistory = useCallback(
    async (pageToFetch: number = pagination.page) => {
      setIsLoading(true);
      setError(null);
      try {
        const res = await managementApiService.getOutingLogHistory({
          page: pageToFetch,
          pageSize: pagination.pageSize,
          search: appliedFilters.search || undefined,
          movementType: appliedFilters.movementType !== 'ALL' ? appliedFilters.movementType : undefined,
          status: appliedFilters.status !== 'ALL' ? appliedFilters.status : undefined,
          source: appliedFilters.source !== 'ALL' ? appliedFilters.source : undefined,
          from: appliedFilters.from || undefined,
          to: appliedFilters.to || undefined,
        });

        if (res.success) {
          setRecords(res.records || []);
          if (res.stats) {
            setStats(res.stats);
          }
          if (res.pagination) {
            setPagination({
              page: res.pagination.page,
              pageSize: res.pagination.pageSize,
              total: res.pagination.total,
              totalPages: res.pagination.totalPages,
            });
          }
        } else {
          setError(res.message || 'Failed to load outing log history.');
        }
      } catch (err: any) {
        setError(err.message || 'Error communicating with outing history service.');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.page, pagination.pageSize, appliedFilters]
  );

  // Initial fetch and on filter changes
  useEffect(() => {
    fetchLogHistory(pagination.page);
  }, [fetchLogHistory, pagination.page]);

  const fetchLogHistoryRef = useRef(fetchLogHistory);
  const currentPageRef = useRef(pagination.page);

  useEffect(() => {
    fetchLogHistoryRef.current = fetchLogHistory;
    currentPageRef.current = pagination.page;
  }, [fetchLogHistory, pagination.page]);

  // Realtime SSE Listener using managementApiService
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      const type = (event?.type || '').toUpperCase();
      if (
        type.startsWith('OUTING_') ||
        type === 'BIOMETRIC_MOVEMENT' ||
        type === 'MANAGEMENT_DASHBOARD_EVENT' ||
        type === 'MANAGEMENT_DASHBOARD_UPDATE'
      ) {
        fetchLogHistoryRef.current(currentPageRef.current);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load detailed record for modal
  const handleOpenDetail = async (id: string) => {
    setSelectedEventId(id);
    setIsDetailLoading(true);
    setDetailError(null);
    try {
      const res = await managementApiService.getOutingLogDetail(id);
      if (res.success && res.data) {
        setDetailData(res.data);
      } else {
        setDetailError(res.message || 'Failed to retrieve detailed record.');
      }
    } catch (err: any) {
      setDetailError(err.message || 'Error loading outing log detail.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedEventId(null);
    setDetailData(null);
    setDetailError(null);
  };

  // Filter Actions
  const handleApplyFilters = () => {
    setAppliedFilters({
      search: searchQuery.trim(),
      movementType,
      status: statusFilter,
      source: sourceFilter,
      from: dateFrom,
      to: dateTo,
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setMovementType('ALL');
    setStatusFilter('ALL');
    setSourceFilter('ALL');
    setDateFrom('');
    setDateTo('');
    setAppliedFilters({
      search: '',
      movementType: 'ALL',
      status: 'ALL',
      source: 'ALL',
      from: '',
      to: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Helper renderers for badges
  const renderMovementBadge = (type: string) => {
    switch (type) {
      case 'REQUESTED':
        return <span className="olh-badge olh-badge-req"><Clock size={12} /> REQUESTED</span>;
      case 'APPROVED':
        return <span className="olh-badge olh-badge-app"><ShieldCheck size={12} /> APPROVED</span>;
      case 'EXIT':
        return <span className="olh-badge olh-badge-exit"><LogOut size={12} /> PHYSICAL EXIT</span>;
      case 'RETURN':
        return <span className="olh-badge olh-badge-return"><LogIn size={12} /> RETURNED</span>;
      case 'REJECTED':
        return <span className="olh-badge olh-badge-rej"><XCircle size={12} /> REJECTED</span>;
      case 'CANCELLED':
        return <span className="olh-badge olh-badge-can"><AlertCircle size={12} /> CANCELLED</span>;
      default:
        return <span className="olh-badge olh-badge-req">{type}</span>;
    }
  };

  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="olh-badge olh-status-pending">PENDING APPROVAL</span>;
      case 'APPROVED':
        return <span className="olh-badge olh-status-approved">APPROVED</span>;
      case 'ACTIVE':
      case 'OUT':
        return <span className="olh-badge olh-status-active">OUTSIDE (ACTIVE)</span>;
      case 'RETURNED':
        return <span className="olh-badge olh-status-returned">COMPLETED</span>;
      case 'REJECTED':
        return <span className="olh-badge olh-status-rejected">REJECTED</span>;
      case 'CANCELLED':
        return <span className="olh-badge olh-status-cancelled">CANCELLED</span>;
      default:
        return <span className="olh-badge">{status}</span>;
    }
  };

  const renderSourceBadge = (source: string) => {
    switch (source) {
      case 'BIOMETRIC_DEVICE':
        return <span className="olh-source-badge"><Radio size={11} /> Biometric Device</span>;
      case 'MANUAL_GATE':
        return <span className="olh-source-badge"><Building size={11} /> Security Gate</span>;
      case 'MANAGEMENT_PORTAL':
        return <span className="olh-source-badge"><ShieldCheck size={11} /> Admin Portal</span>;
      case 'STUDENT_PORTAL':
        return <span className="olh-source-badge"><User size={11} /> Student Portal</span>;
      default:
        return <span className="olh-source-badge">{source}</span>;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="olh-page">
      {/* 1. Authoritative KPI Statistics Cards */}
      <section className="olh-kpi-grid" aria-label="Authoritative Outing KPIs">
        <div className="olh-kpi-card">
          <div className="olh-kpi-icon blue">
            <ClipboardList size={22} />
          </div>
          <div className="olh-kpi-content">
            <span className="olh-kpi-label">Today's Requests</span>
            <span className="olh-kpi-value">{stats.todayRequests}</span>
          </div>
        </div>

        <div className="olh-kpi-card">
          <div className="olh-kpi-icon emerald">
            <CheckCircle2 size={22} />
          </div>
          <div className="olh-kpi-content">
            <span className="olh-kpi-label">Today's Approved</span>
            <span className="olh-kpi-value">{stats.todayApproved}</span>
          </div>
        </div>

        <div className="olh-kpi-card">
          <div className="olh-kpi-icon amber">
            <LogOut size={22} />
          </div>
          <div className="olh-kpi-content">
            <span className="olh-kpi-label">Today's Exits</span>
            <span className="olh-kpi-value">{stats.todayExits}</span>
          </div>
        </div>

        <div className="olh-kpi-card">
          <div className="olh-kpi-icon indigo">
            <LogIn size={22} />
          </div>
          <div className="olh-kpi-content">
            <span className="olh-kpi-label">Today's Returns</span>
            <span className="olh-kpi-value">{stats.todayReturns}</span>
          </div>
        </div>

        <div className="olh-kpi-card">
          <div className="olh-kpi-icon purple">
            <Footprints size={22} />
          </div>
          <div className="olh-kpi-content">
            <span className="olh-kpi-label">Currently Outside</span>
            <span className="olh-kpi-value">{stats.currentlyOutside}</span>
          </div>
        </div>
      </section>

      {/* 2. Filter Bar */}
      <section className="olh-filter-card" aria-label="Filter Outing Logs">
        <div className="olh-filter-header">
          <div className="olh-filter-title">
            <SlidersHorizontal size={16} />
            <span>Search & Authoritative Filters</span>
          </div>
          <button
            type="button"
            className="olh-btn olh-btn-secondary"
            onClick={() => fetchLogHistory(pagination.page)}
            disabled={isLoading}
            title="Refresh log history from database"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="olh-filter-controls">
          {/* Search */}
          <div className="olh-filter-group" style={{ gridColumn: 'span 2' }}>
            <label htmlFor="olh-search-input">Search Student / Request</label>
            <div className="olh-input-wrapper">
              <Search size={15} className="olh-input-icon" />
              <input
                id="olh-search-input"
                type="text"
                className="olh-input"
                placeholder="Student name, JNTU number, REQ-ID, destination..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleApplyFilters();
                }}
              />
            </div>
          </div>

          {/* Movement Type */}
          <div className="olh-filter-group">
            <label htmlFor="olh-movement-select">Movement Type</label>
            <select
              id="olh-movement-select"
              className="olh-select"
              value={movementType}
              onChange={(e) => setMovementType(e.target.value)}
            >
              <option value="ALL">All Movements</option>
              <option value="REQUESTED">Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="EXIT">Physical Exit</option>
              <option value="RETURN">Physical Return</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Outing Status */}
          <div className="olh-filter-group">
            <label htmlFor="olh-status-select">Outing Status</label>
            <select
              id="olh-status-select"
              className="olh-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Approval</option>
              <option value="APPROVED">Approved</option>
              <option value="ACTIVE">Outside (Active)</option>
              <option value="RETURNED">Completed / Returned</option>
              <option value="REJECTED">Rejected</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          {/* Source */}
          <div className="olh-filter-group">
            <label htmlFor="olh-source-select">Audit Source</label>
            <select
              id="olh-source-select"
              className="olh-select"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
            >
              <option value="ALL">All Sources</option>
              <option value="BIOMETRIC_DEVICE">Biometric Device</option>
              <option value="MANUAL_GATE">Security Gate</option>
              <option value="MANAGEMENT_PORTAL">Admin Portal</option>
              <option value="STUDENT_PORTAL">Student Portal</option>
            </select>
          </div>

          {/* Date From */}
          <div className="olh-filter-group">
            <label htmlFor="olh-from-date">Date From</label>
            <input
              id="olh-from-date"
              type="date"
              className="olh-date-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>

          {/* Date To */}
          <div className="olh-filter-group">
            <label htmlFor="olh-to-date">Date To</label>
            <input
              id="olh-to-date"
              type="date"
              className="olh-date-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>

          {/* Filter Action Buttons */}
          <div className="olh-filter-actions">
            <button
              type="button"
              className="olh-btn olh-btn-primary"
              onClick={handleApplyFilters}
            >
              <Filter size={14} />
              <span>Apply Filters</span>
            </button>
            <button
              type="button"
              className="olh-btn olh-btn-secondary"
              onClick={handleClearFilters}
            >
              <X size={14} />
              <span>Clear</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. Main Records Table Card */}
      <section className="olh-table-card" aria-label="Outing Log History Table">
        <div className="olh-table-header-bar">
          <div className="olh-table-header-title">
            <ClipboardList size={18} />
            <span>Outing Log History & Gate Transit Events</span>
            <span className="olh-count-badge">{pagination.total} Records</span>
          </div>
          <div className="olh-immutable-notice">
            <ShieldCheck size={14} color="#059669" />
            <span>Historical records are immutable & cryptographically tracked</span>
          </div>
        </div>

        {error && (
          <div className="olh-empty-state" style={{ color: '#dc2626' }}>
            <AlertCircle size={32} />
            <p>{error}</p>
            <button
              type="button"
              className="olh-btn olh-btn-secondary"
              onClick={() => fetchLogHistory(pagination.page)}
            >
              Try Again
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="olh-loading-state">
            <div className="olh-spinner" />
            <p>Retrieving authoritative log history from PostgreSQL...</p>
          </div>
        ) : records.length === 0 ? (
          <div className="olh-empty-state">
            <Footprints size={40} strokeWidth={1.5} />
            <p style={{ fontWeight: 600, color: '#1e293b' }}>No outing records found</p>
            <p style={{ fontSize: '0.8rem' }}>
              Try adjusting search terms, dates, or clearing your active filters.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="olh-table-wrapper">
              <table className="olh-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Student Details</th>
                    <th>Request No.</th>
                    <th>Event</th>
                    <th>Status</th>
                    <th>Destination</th>
                    <th>Audit Source</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: 600 }}>
                            {formatDateTime(item.eventTimestamp)}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                            Created: {formatDateTime(item.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="olh-student-cell">
                          <span className="olh-student-name">{item.student.name}</span>
                          <span className="olh-student-sub">
                            {item.student.jntuNo} • {item.student.blockName || 'Main Block'} - Room {item.student.roomNumber || 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="olh-req-num">{item.requestNumber}</span>
                      </td>
                      <td>{renderMovementBadge(item.movementType)}</td>
                      <td>{renderStatusBadge(item.status)}</td>
                      <td>
                        <div className="olh-dest-cell" title={item.destination || item.purpose}>
                          {item.destination || item.purpose}
                        </div>
                      </td>
                      <td>{renderSourceBadge(item.source)}</td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                          {item.recordedBy}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="olh-view-btn"
                          onClick={() => handleOpenDetail(item.id)}
                          title="View Authoritative Timeline & Details"
                        >
                          <Eye size={13} />
                          <span>View Details</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards (<768px) */}
            <div className="olh-mobile-cards">
              {records.map((item) => (
                <div key={`m-${item.id}`} className="olh-mobile-card">
                  <div className="olh-mobile-card-top">
                    <div>
                      <div className="olh-mobile-student">{item.student.name}</div>
                      <div className="olh-mobile-sub">
                        {item.student.jntuNo} • Room {item.student.roomNumber || 'N/A'}
                      </div>
                    </div>
                    <span className="olh-req-num">{item.requestNumber}</span>
                  </div>

                  <div className="olh-mobile-row">
                    <span className="olh-mobile-label">Event:</span>
                    <div>{renderMovementBadge(item.movementType)}</div>
                  </div>

                  <div className="olh-mobile-row">
                    <span className="olh-mobile-label">Status:</span>
                    <div>{renderStatusBadge(item.status)}</div>
                  </div>

                  <div className="olh-mobile-row">
                    <span className="olh-mobile-label">Timestamp:</span>
                    <span className="olh-mobile-value">{formatDateTime(item.eventTimestamp)}</span>
                  </div>

                  <div className="olh-mobile-row">
                    <span className="olh-mobile-label">Destination:</span>
                    <span className="olh-mobile-value">{item.destination || item.purpose}</span>
                  </div>

                  <div className="olh-mobile-row">
                    <span className="olh-mobile-label">Source:</span>
                    <div>{renderSourceBadge(item.source)}</div>
                  </div>

                  <div className="olh-mobile-footer">
                    <button
                      type="button"
                      className="olh-view-btn"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={() => handleOpenDetail(item.id)}
                    >
                      <Eye size={14} />
                      <span>View Full Details & Timeline</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* 4. Pagination Bar */}
            <div className="olh-pagination-bar">
              <div>
                Showing{' '}
                <strong style={{ color: '#0f172a' }}>
                  {(pagination.page - 1) * pagination.pageSize + 1}
                </strong>{' '}
                to{' '}
                <strong style={{ color: '#0f172a' }}>
                  {Math.min(pagination.page * pagination.pageSize, pagination.total)}
                </strong>{' '}
                of <strong style={{ color: '#0f172a' }}>{pagination.total}</strong> entries
              </div>

              <div className="olh-pagination-controls">
                <button
                  type="button"
                  className="olh-page-btn"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page <= 1}
                  title="Previous page"
                >
                  <ChevronLeft size={16} />
                </button>

                <span style={{ margin: '0 0.5rem', fontWeight: 600, color: '#0f172a' }}>
                  Page {pagination.page} of {pagination.totalPages}
                </span>

                <button
                  type="button"
                  className="olh-page-btn"
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page >= pagination.totalPages}
                  title="Next page"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* 5. Detail Modal with Visual Lifecycle Timeline */}
      {selectedEventId && (
        <div className="olh-modal-backdrop" onClick={handleCloseDetail}>
          <div className="olh-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="olh-modal-header">
              <div className="olh-modal-title-wrap">
                <div className="olh-modal-icon-badge">
                  <ClipboardList size={22} />
                </div>
                <div>
                  <h3 className="olh-modal-title">Outing Log Details</h3>
                  <p className="olh-modal-subtitle">
                    Authoritative lifecycle audit trail & gate telemetry
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="olh-modal-close-btn"
                onClick={handleCloseDetail}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            <div className="olh-modal-body">
              {isDetailLoading ? (
                <div className="olh-loading-state">
                  <div className="olh-spinner" />
                  <p>Loading authoritative outing records...</p>
                </div>
              ) : detailError ? (
                <div className="olh-empty-state" style={{ color: '#dc2626' }}>
                  <AlertCircle size={32} />
                  <p>{detailError}</p>
                </div>
              ) : detailData ? (
                <>
                  {/* Student Details Grid */}
                  <div>
                    <div className="olh-modal-section-title">
                      <User size={15} />
                      <span>Resident Information</span>
                    </div>
                    <div className="olh-info-grid">
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Student Name</span>
                        <span className="olh-info-item-value">{detailData.student?.name || 'N/A'}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Roll / JNTU No</span>
                        <span className="olh-info-item-value">{detailData.student?.jntuNo || 'N/A'}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Email</span>
                        <span className="olh-info-item-value">{detailData.student?.email || 'N/A'}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Block & Room</span>
                        <span className="olh-info-item-value">
                          {detailData.student?.blockName || 'Block'} - Room {detailData.student?.roomNumber || 'N/A'} (Bed {detailData.student?.bedNumber || 'N/A'})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Outing Request Details Grid */}
                  <div>
                    <div className="olh-modal-section-title">
                      <FileText size={15} />
                      <span>Outing Pass Specifications</span>
                    </div>
                    <div className="olh-info-grid">
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Request Number</span>
                        <span className="olh-info-item-value" style={{ color: '#2563eb' }}>
                          {detailData.outing.requestNumber}
                        </span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Pass Type</span>
                        <span className="olh-info-item-value">{detailData.outing.passType}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Destination</span>
                        <span className="olh-info-item-value">{detailData.outing.destination || 'N/A'}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Current Status</span>
                        <div>{renderStatusBadge(detailData.outing.status)}</div>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Scheduled Out</span>
                        <span className="olh-info-item-value">{formatDateTime(detailData.outing.outDate)}</span>
                      </div>
                      <div className="olh-info-item">
                        <span className="olh-info-item-label">Scheduled Return</span>
                        <span className="olh-info-item-value">{formatDateTime(detailData.outing.returnDate)}</span>
                      </div>
                      <div className="olh-info-item" style={{ gridColumn: 'span 2' }}>
                        <span className="olh-info-item-label">Purpose of Outing</span>
                        <span className="olh-info-item-value">{detailData.outing.purpose}</span>
                      </div>
                      {detailData.outing.emergencyContact && (
                        <div className="olh-info-item">
                          <span className="olh-info-item-label">Emergency Contact</span>
                          <span className="olh-info-item-value">{detailData.outing.emergencyContact}</span>
                        </div>
                      )}
                      {detailData.outing.rejectionReason && (
                        <div className="olh-info-item" style={{ gridColumn: 'span 2' }}>
                          <span className="olh-info-item-label" style={{ color: '#b91c1c' }}>Rejection Reason</span>
                          <span className="olh-info-item-value" style={{ color: '#b91c1c' }}>
                            {detailData.outing.rejectionReason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4-Stage Visual Lifecycle Timeline */}
                  <div>
                    <div className="olh-modal-section-title">
                      <Clock size={15} />
                      <span>Authoritative Lifecycle Timeline</span>
                    </div>

                    <div className="olh-timeline">
                      {detailData.timeline.map((step: OutingTimelineStep, idx: number) => {
                        const stepClass =
                          step.status === 'COMPLETED'
                            ? 'completed'
                            : step.status === 'ACTIVE'
                            ? 'active'
                            : step.status === 'REJECTED'
                            ? 'rejected'
                            : 'pending';

                        return (
                          <div key={`tl-${idx}`} className={`olh-timeline-step ${stepClass}`}>
                            <div className="olh-timeline-dot">
                              {step.status === 'COMPLETED' && <CheckCircle2 size={16} />}
                              {step.status === 'ACTIVE' && <Footprints size={16} />}
                              {step.status === 'REJECTED' && <XCircle size={16} />}
                              {step.status === 'PENDING' && <Clock size={16} />}
                            </div>

                            <div className="olh-timeline-content">
                              <div className="olh-timeline-header">
                                <span className="olh-timeline-title">{step.label}</span>
                                {step.timestamp && (
                                  <span className="olh-timeline-time">
                                    {formatDateTime(step.timestamp)}
                                  </span>
                                )}
                              </div>
                              <p className="olh-timeline-desc">{step.details}</p>
                              <div className="olh-timeline-actor-tag">
                                <span>Recorded by: <strong>{step.actor}</strong></span>
                                <span>•</span>
                                <span>Source: {renderSourceBadge(step.source)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Correlated Biometric Sensor Hits */}
                  {detailData.biometricEvents && detailData.biometricEvents.length > 0 && (
                    <div>
                      <div className="olh-modal-section-title">
                        <Radio size={15} />
                        <span>Correlated Biometric Turnstile Telemetry</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {detailData.biometricEvents.map((ev) => (
                          <div
                            key={ev.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '0.65rem 0.85rem',
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '6px',
                              fontSize: '0.8rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Radio size={14} color="#2563eb" />
                              <span style={{ fontWeight: 600 }}>{ev.eventType}</span>
                              <span style={{ color: '#64748b' }}>({ev.gate || 'Main Turnstile'})</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                              <span style={{ color: '#059669', fontWeight: 600 }}>
                                {ev.verificationStatus}
                              </span>
                              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>
                                {formatDateTime(ev.eventTimestamp)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="olh-modal-footer">
              <div className="olh-immutable-notice">
                <ShieldCheck size={16} color="#059669" />
                <span>Read-Only Audit Record — Historical entries cannot be modified or deleted.</span>
              </div>
              <button
                type="button"
                className="olh-btn olh-btn-secondary"
                onClick={handleCloseDetail}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
