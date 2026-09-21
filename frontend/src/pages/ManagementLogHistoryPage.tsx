import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  History,
  Search,
  RefreshCw,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  FileText,
  CreditCard,
  Layers,
} from 'lucide-react';
import {
  managementApiService,
  ActivityLogItem,
  LogHistorySummaryResponse,
} from '../services/api';

interface ManagementLogHistoryPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementLogHistoryPage: React.FC<ManagementLogHistoryPageProps> = () => {
  // Logs State
  const [logs, setLogs] = useState<ActivityLogItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination State
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  // Summary Metrics State
  const [summary, setSummary] = useState<LogHistorySummaryResponse['summary'] | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Applied Filters (used to trigger queries)
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    action: 'ALL',
    entity: 'ALL',
    actorRole: 'ALL',
    from: '',
    to: '',
  });

  // Realtime Connection State
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  // Detail Modal State
  const [selectedLog, setSelectedLog] = useState<ActivityLogItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);

  // -----------------------------------------------------------------
  // DATA FETCHING: LOGS
  // -----------------------------------------------------------------
  const fetchLogs = useCallback(
    async (pageToFetch?: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const targetPage = pageToFetch || pagination.page;
        const res = await managementApiService.getLogHistory({
          page: targetPage,
          pageSize: pagination.pageSize,
          action: appliedFilters.action !== 'ALL' ? appliedFilters.action : undefined,
          entity: appliedFilters.entity !== 'ALL' ? appliedFilters.entity : undefined,
          actorRole: appliedFilters.actorRole !== 'ALL' ? appliedFilters.actorRole : undefined,
          from: appliedFilters.from || undefined,
          to: appliedFilters.to || undefined,
          search: appliedFilters.search || undefined,
        });

        if (res.success) {
          setLogs(res.logs || []);
          setPagination(res.pagination);
        } else {
          setError('Failed to load system activity logs.');
        }
      } catch (err: any) {
        console.error('Error fetching logs:', err);
        setError(err.message || 'Unable to retrieve audit history.');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.page, pagination.pageSize, appliedFilters]
  );

  // -----------------------------------------------------------------
  // DATA FETCHING: SUMMARY
  // -----------------------------------------------------------------
  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await managementApiService.getLogHistorySummary();
      if (res.success) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Error fetching log history summary:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setIsManualRefreshing(true);
    try {
      await Promise.all([fetchLogs(), fetchSummary()]);
    } finally {
      setIsManualRefreshing(false);
    }
  }, [fetchLogs, fetchSummary]);

  // Initial load
  useEffect(() => {
    fetchLogs(1);
    fetchSummary();
  }, [appliedFilters]);

  // -----------------------------------------------------------------
  const fetchLogsRef = useRef(fetchLogs);
  const fetchSummaryRef = useRef(fetchSummary);

  useEffect(() => {
    fetchLogsRef.current = fetchLogs;
    fetchSummaryRef.current = fetchSummary;
  }, [fetchLogs, fetchSummary]);

  // REAL-TIME SSE SUBSCRIPTION
  // -----------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        const type = (event?.type || '').toUpperCase();
        if (
          type === 'AUDIT_LOG_CREATED' ||
          type === 'MANAGEMENT_AUDIT_UPDATE' ||
          type.includes('UPDATE') ||
          type.includes('CREATED')
        ) {
          fetchLogsRef.current();
          fetchSummaryRef.current();
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, []);

  // -----------------------------------------------------------------
  // FILTER HANDLERS
  // -----------------------------------------------------------------
  const handleApplyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setAppliedFilters({
      search: searchQuery.trim(),
      action: selectedAction,
      entity: selectedEntity,
      actorRole: selectedRole,
      from: fromDate,
      to: toDate,
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedAction('ALL');
    setSelectedEntity('ALL');
    setSelectedRole('ALL');
    setFromDate('');
    setToDate('');
    setAppliedFilters({
      search: '',
      action: 'ALL',
      entity: 'ALL',
      actorRole: 'ALL',
      from: '',
      to: '',
    });
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // Quick Filter via KPI click
  const handleKpiFilter = (type: 'all' | 'approvals' | 'financial' | 'security' | 'admin') => {
    if (type === 'all') {
      handleResetFilters();
    } else if (type === 'approvals') {
      setSelectedAction('APPROVE');
      setAppliedFilters({ ...appliedFilters, action: 'APPROVE' });
    } else if (type === 'financial') {
      setSelectedAction('PAYMENT_RECORDED');
      setAppliedFilters({ ...appliedFilters, action: 'PAYMENT_RECORDED' });
    } else if (type === 'security') {
      setSelectedAction('LOGIN');
      setAppliedFilters({ ...appliedFilters, action: 'LOGIN' });
    } else if (type === 'admin') {
      setSelectedRole('WARDEN');
      setAppliedFilters({ ...appliedFilters, actorRole: 'WARDEN' });
    }
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  // -----------------------------------------------------------------
  // DETAIL MODAL HANDLER
  // -----------------------------------------------------------------
  const handleViewDetail = async (log: ActivityLogItem) => {
    setSelectedLog(log);
    setIsDetailModalOpen(true);
    setIsLoadingDetail(true);
    try {
      const res = await managementApiService.getLogHistoryById(log.id);
      if (res.success && res.log) {
        setSelectedLog(res.log);
      }
    } catch (err) {
      console.error('Error fetching log details:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Action badge color styling helper
  const getActionBadgeClass = (action: string) => {
    const act = (action || '').toUpperCase();
    if (act.includes('APPROVE') || act.includes('CREATE') || act.includes('ALLOCATE')) {
      return 'badge-action-emerald';
    }
    if (act.includes('REJECT') || act.includes('VOID') || act.includes('DELETE') || act.includes('SUSPEND')) {
      return 'badge-action-rose';
    }
    if (act.includes('PAYMENT') || act.includes('BILL')) {
      return 'badge-action-purple';
    }
    if (act.includes('LOGIN') || act.includes('LOGOUT') || act.includes('ENTRY') || act.includes('EXIT')) {
      return 'badge-action-blue';
    }
    if (act.includes('ASSIGN') || act.includes('START') || act.includes('RESOLVE') || act.includes('CHECK')) {
      return 'badge-action-amber';
    }
    return 'badge-action-slate';
  };

  return (
    <div className="log-history-management-page">
      {/* Top Banner with Realtime Status & Header */}
      <div className="log-history-top-bar">
        <div className="log-history-header-title">
          <div className="log-history-badge-icon">
            <History size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 m-0 leading-tight">
              Authoritative Log History & System Audit
            </h2>
            <p className="text-xs text-slate-500 m-0 mt-0.5">
              Comprehensive administrative traceability, state change transitions, and verifiable system mutations
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Real-time SSE Connection Indicator */}
          <div
            className="log-live-indicator"
            title={isLiveConnected ? 'SSE Audit Stream Online' : 'Connecting Realtime...'}
          >
            <span className={`log-live-dot ${isLiveConnected ? 'connected' : ''}`} />
            <span>{isLiveConnected ? 'Live Synchronized' : 'Connecting Stream...'}</span>
          </div>

          <button
            type="button"
            className="log-header-btn-sync"
            onClick={refreshAll}
            disabled={isManualRefreshing}
            title="Refresh latest audit data"
          >
            <RefreshCw size={15} className={isManualRefreshing ? 'animate-spin' : ''} />
            <span>{isManualRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="log-kpi-grid">
        <div
          className="log-kpi-card"
          onClick={() => handleKpiFilter('all')}
          style={{ cursor: 'pointer' }}
          title="Click to reset filters and view all logs"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Total Logs</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#EFF6FF', color: '#2563EB' }}>
              <Layers size={18} />
            </div>
          </div>
          <div className="log-kpi-val">
            {isSummaryLoading ? '—' : (summary?.totalLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Authoritative events recorded</div>
        </div>

        <div
          className="log-kpi-card"
          onClick={() => {
            const today = new Date().toISOString().split('T')[0];
            setFromDate(today);
            setToDate(today);
            setAppliedFilters((p) => ({ ...p, from: today, to: today }));
            setPagination((p) => ({ ...p, page: 1 }));
          }}
          style={{ cursor: 'pointer' }}
          title="Click to filter activity from today"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Today's Activity</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#ECFDF5', color: '#059669' }}>
              <Clock size={18} />
            </div>
          </div>
          <div className="log-kpi-val" style={{ color: '#059669' }}>
            {isSummaryLoading ? '—' : (summary?.todayLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Mutations since midnight</div>
        </div>

        <div
          className="log-kpi-card"
          onClick={() => handleKpiFilter('approvals')}
          style={{ cursor: 'pointer' }}
          title="Click to filter approvals"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Approvals</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#F0FDF4', color: '#16A34A' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div className="log-kpi-val" style={{ color: '#16A34A' }}>
            {isSummaryLoading ? '—' : (summary?.approvalLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Passes, leaves & tickets</div>
        </div>

        <div
          className="log-kpi-card"
          onClick={() => handleKpiFilter('financial')}
          style={{ cursor: 'pointer' }}
          title="Click to filter financial actions"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Financial Actions</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#FAF5FF', color: '#7C3AED' }}>
              <CreditCard size={18} />
            </div>
          </div>
          <div className="log-kpi-val" style={{ color: '#7C3AED' }}>
            {isSummaryLoading ? '—' : (summary?.financialLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Payments, invoices & voids</div>
        </div>

        <div
          className="log-kpi-card"
          onClick={() => handleKpiFilter('security')}
          style={{ cursor: 'pointer' }}
          title="Click to filter security actions"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Security & Access</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#FFFBEB', color: '#D97706' }}>
              <ShieldCheck size={18} />
            </div>
          </div>
          <div className="log-kpi-val" style={{ color: '#D97706' }}>
            {isSummaryLoading ? '—' : (summary?.securityLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Sessions, biometrics & gate</div>
        </div>

        <div
          className="log-kpi-card"
          onClick={() => handleKpiFilter('admin')}
          style={{ cursor: 'pointer' }}
          title="Click to filter administrative mutations"
        >
          <div className="log-kpi-header">
            <span className="log-kpi-label">Administrative</span>
            <div className="log-kpi-icon-wrap" style={{ background: '#F8FAFC', color: '#475569' }}>
              <User size={18} />
            </div>
          </div>
          <div className="log-kpi-val" style={{ color: '#475569' }}>
            {isSummaryLoading ? '—' : (summary?.adminLogs ?? 0).toLocaleString()}
          </div>
          <div className="log-kpi-sub">Warden & admin operations</div>
        </div>
      </div>

      {/* Main Content Card with Filters and Data Table */}
      <section className="log-content-container">
        {/* Filter Controls Bar */}
        <form className="log-filter-controls-bar" onSubmit={handleApplyFilters}>
          <div className="log-search-input-wrapper">
            <Search size={16} className="log-search-icon-inside" />
            <input
              type="text"
              placeholder="Search by description, actor, entity ID, or action..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="log-filters-cluster">
            {/* Action Filter */}
            <div className="log-select-filter-group">
              <label htmlFor="logActionSelect">Action:</label>
              <select
                id="logActionSelect"
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
              >
                <option value="ALL">All Actions</option>
                <option value="CREATE">CREATE</option>
                <option value="UPDATE">UPDATE</option>
                <option value="DELETE">DELETE</option>
                <option value="APPROVE">APPROVE</option>
                <option value="REJECT">REJECT</option>
                <option value="ALLOCATE">ALLOCATE</option>
                <option value="VACATE">VACATE</option>
                <option value="REALLOCATE">REALLOCATE</option>
                <option value="ASSIGN">ASSIGN</option>
                <option value="START">START</option>
                <option value="RESOLVE">RESOLVE</option>
                <option value="CLOSE">CLOSE</option>
                <option value="PAYMENT_RECORDED">PAYMENT</option>
                <option value="VOID">VOID</option>
                <option value="CHECKIN">CHECK-IN</option>
                <option value="CHECKOUT">CHECK-OUT</option>
                <option value="LOGIN">LOGIN</option>
                <option value="LOGOUT">LOGOUT</option>
                <option value="SUSPEND">SUSPEND</option>
                <option value="LIFT_SUSPENSION">LIFT SUSPENSION</option>
              </select>
            </div>

            {/* Entity Filter */}
            <div className="log-select-filter-group">
              <label htmlFor="logEntitySelect">Entity:</label>
              <select
                id="logEntitySelect"
                value={selectedEntity}
                onChange={(e) => setSelectedEntity(e.target.value)}
              >
                <option value="ALL">All Entities</option>
                <option value="Block">Block</option>
                <option value="Room">Room</option>
                <option value="RoomAllocation">RoomAllocation</option>
                <option value="Complaint">Complaint</option>
                <option value="OutingRequest">OutingRequest</option>
                <option value="LeaveRequest">LeaveRequest</option>
                <option value="Suspension">Suspension</option>
                <option value="Guest">Guest</option>
                <option value="GuestVisit">GuestVisit</option>
                <option value="GuestBill">GuestBill</option>
                <option value="Session">Session</option>
                <option value="BiometricEvent">BiometricEvent</option>
                <option value="MessToken">MessToken</option>
              </select>
            </div>

            {/* Actor Role Filter */}
            <div className="log-select-filter-group">
              <label htmlFor="logRoleSelect">Role:</label>
              <select
                id="logRoleSelect"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="ALL">All Roles</option>
                <option value="ADMIN">ADMIN</option>
                <option value="CHIEF_WARDEN">CHIEF WARDEN (ALL)</option>
                <option value="CHIEF_WARDEN_BOYS">CHIEF WARDEN (BOYS)</option>
                <option value="CHIEF_WARDEN_GIRLS">CHIEF WARDEN (GIRLS)</option>
                <option value="WARDEN">WARDEN</option>
                <option value="HOSTEL_ADMIN">HOSTEL ADMIN</option>
                <option value="MAINTENANCE_STAFF">MAINTENANCE STAFF</option>
                <option value="STUDENT">STUDENT</option>
              </select>
            </div>

            {/* Date Range Inputs */}
            <div className="log-date-filter-group">
              <label htmlFor="logFromDate">From:</label>
              <input
                id="logFromDate"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div className="log-date-filter-group">
              <label htmlFor="logToDate">To:</label>
              <input
                id="logToDate"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Filter Action Buttons */}
            <div className="flex items-center gap-1.5">
              <button type="submit" className="log-btn-filter-apply">
                <Filter size={14} />
                <span>Apply</span>
              </button>

              <button
                type="button"
                className="log-btn-filter-reset"
                onClick={handleResetFilters}
                title="Clear all filters"
              >
                <X size={14} />
                <span>Reset</span>
              </button>
            </div>
          </div>
        </form>

        {/* Audit Log Table */}
        <div className="log-table-wrapper">
          {isLoading ? (
            <div className="loading-state p-8 text-center">
              <RefreshCw size={24} className="animate-spin text-primary inline-block" />
              <p className="mt-2 text-sm text-slate-500">Retrieving authoritative activity logs...</p>
            </div>
          ) : error ? (
            <div className="error-state p-8 text-center text-rose-600">
              <AlertCircle size={32} className="inline-block" />
              <p className="mt-2 text-sm font-semibold">{error}</p>
              <button
                type="button"
                className="mt-3 px-3 py-1.5 bg-rose-50 text-rose-700 rounded text-xs font-semibold"
                onClick={() => fetchLogs()}
              >
                Retry Request
              </button>
            </div>
          ) : logs.length === 0 ? (
            <div className="empty-state p-8 text-center">
              <FileText size={40} className="empty-icon inline-block text-slate-400" />
              <h4 className="mt-2 text-base font-semibold text-slate-700">No Activity Logs Found</h4>
              <p className="text-sm text-slate-500">
                There are no audit records matching your selected filter criteria.
              </p>
              <button
                type="button"
                className="mt-3 px-3 py-1.5 bg-slate-100 text-slate-700 rounded text-xs font-semibold hover:bg-slate-200"
                onClick={handleResetFilters}
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <table className="log-data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Entity & Target</th>
                  <th>Description / Transition</th>
                  <th className="text-right">Audit Detail</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="text-sm font-medium text-slate-900">
                        {new Date(log.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-muted">
                        {new Date(log.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </div>
                    </td>

                    <td>
                      <div className="font-semibold text-slate-900">{log.actor?.name || 'System Actor'}</div>
                      <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono">{log.actor?.jntuNo}</span>
                        <span className="log-role-badge">{log.actorRole || log.actor?.role}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`log-action-pill ${getActionBadgeClass(log.action || log.actionType)}`}>
                        {log.action || log.actionType}
                      </span>
                    </td>

                    <td>
                      <div className="font-semibold text-slate-800">{log.entity || 'System'}</div>
                      {log.entityId && (
                        <div className="text-xs font-mono text-slate-500 truncate max-w-xs" title={log.entityId}>
                          {log.entityId}
                        </div>
                      )}
                    </td>

                    <td className="max-w-md">
                      <div className="text-sm text-slate-800 leading-snug">{log.description}</div>
                      {(log.previousState || log.newState) && (
                        <div className="log-inline-transition mt-1">
                          <span className="transition-prev">{log.previousState || '—'}</span>
                          <ArrowRight size={12} className="text-slate-400" />
                          <span className="transition-new">{log.newState || '—'}</span>
                        </div>
                      )}
                    </td>

                    <td className="text-right">
                      <button
                        type="button"
                        className="log-btn-view-detail"
                        onClick={() => handleViewDetail(log)}
                        title="View complete audit record and safe metadata"
                      >
                        <Eye size={14} />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Server-Side Pagination Bar */}
        {pagination.totalPages > 1 && (
          <div className="log-pagination-bar">
            <span className="log-pagination-info">
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total audit records)
            </span>
            <div className="log-pagination-controls">
              <button
                type="button"
                className="log-btn-page"
                disabled={pagination.page <= 1 || isLoading}
                onClick={() => fetchLogs(pagination.page - 1)}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <button
                type="button"
                className="log-btn-page"
                disabled={pagination.page >= pagination.totalPages || isLoading}
                onClick={() => fetchLogs(pagination.page + 1)}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* ============================================================= */}
      {/* AUDIT LOG DETAIL MODAL */}
      {/* ============================================================= */}
      {isDetailModalOpen && selectedLog && (
        <div className="modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div
            className="modal-dialog log-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auditDetailTitle"
          >
            <div className="modal-header">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-primary" />
                <h3 id="auditDetailTitle" className="text-base font-bold text-slate-900 m-0">
                  Audit Record Inspection
                </h3>
              </div>
              <button
                type="button"
                className="btn-icon-close"
                onClick={() => setIsDetailModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {isLoadingDetail && (
                <div className="text-center py-2 text-xs text-slate-500">
                  <RefreshCw size={14} className="animate-spin inline mr-1" /> Synchronizing authoritative log details...
                </div>
              )}

              {/* Log Core Summary Banner */}
              <div className="log-detail-meta-grid">
                <div className="meta-box">
                  <span className="meta-label">Audit Record ID</span>
                  <span className="text-xs font-mono text-slate-700 select-all">{selectedLog.id}</span>
                </div>

                <div className="meta-box">
                  <span className="meta-label">Timestamp</span>
                  <span className="text-xs font-medium text-slate-900">
                    {new Date(selectedLog.createdAt).toLocaleString()}
                  </span>
                </div>

                <div className="meta-box">
                  <span className="meta-label">Actor</span>
                  <div className="text-xs font-bold text-slate-900">{selectedLog.actor?.name || 'System Actor'}</div>
                  <div className="text-[11px] text-muted">
                    {selectedLog.actor?.jntuNo} • {selectedLog.actor?.email}
                  </div>
                </div>

                <div className="meta-box">
                  <span className="meta-label">Actor Role</span>
                  <span className="log-role-badge w-fit">{selectedLog.actorRole || selectedLog.actor?.role}</span>
                </div>

                <div className="meta-box">
                  <span className="meta-label">Action</span>
                  <span className={`log-action-pill w-fit ${getActionBadgeClass(selectedLog.action)}`}>
                    {selectedLog.action || selectedLog.actionType}
                  </span>
                </div>

                <div className="meta-box">
                  <span className="meta-label">Entity Affected</span>
                  <span className="text-xs font-bold text-slate-900">{selectedLog.entity}</span>
                  {selectedLog.entityId && (
                    <span className="text-[11px] font-mono text-slate-500 truncate" title={selectedLog.entityId}>
                      ID: {selectedLog.entityId}
                    </span>
                  )}
                </div>
              </div>

              {/* Description Block */}
              <div className="log-detail-desc-card mt-3">
                <span className="meta-label">Operational Description</span>
                <p className="text-sm font-medium text-slate-900 m-0 mt-1">{selectedLog.description}</p>
              </div>

              {/* State Transition Comparison Card */}
              {(selectedLog.previousState || selectedLog.newState) && (
                <div className="log-detail-transition-card mt-3">
                  <span className="meta-label">State Transition Trace</span>
                  <div className="log-transition-compare-grid mt-2">
                    <div className="transition-state-box prev-box">
                      <span className="state-tag">PREVIOUS STATE</span>
                      <div className="state-content">{selectedLog.previousState || '(None / Created)'}</div>
                    </div>
                    <div className="transition-arrow-divider">
                      <ArrowRight size={20} />
                    </div>
                    <div className="transition-state-box next-box">
                      <span className="state-tag">NEW AUTHORITATIVE STATE</span>
                      <div className="state-content">{selectedLog.newState || '(None / Deleted)'}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Safe Metadata Viewer */}
              {selectedLog.metadata && (
                <div className="log-detail-metadata-card mt-3">
                  <span className="meta-label">Contextual Metadata (Sanitized)</span>
                  <pre className="log-metadata-code-block mt-1">
                    {typeof selectedLog.metadata === 'object'
                      ? JSON.stringify(selectedLog.metadata, null, 2)
                      : String(selectedLog.metadata)}
                  </pre>
                </div>
              )}

              {/* IP Address and Network Context */}
              {selectedLog.ipAddress && (
                <div className="log-detail-network-box mt-3">
                  <span className="meta-label">Originating Request IP:</span>
                  <span className="font-mono text-xs text-slate-700 ml-2">{selectedLog.ipAddress}</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close Audit Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
