import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell,
  Plus,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  Send,
  AlertTriangle,
  FileText,
  Users,
  X,
  ChevronLeft,
  ChevronRight,
  Info,
  Layers,
} from 'lucide-react';
import {
  managementApiService,
  AdminNotificationItem,
  AdminNotificationKPIs,
  AdminSendNotificationPayload,
} from '../services/api';
import '../styles/AdminNotifications.css';

const CATEGORIES = [
  'ALL',
  'SYSTEM',
  'ANNOUNCEMENT',
  'OUTING',
  'LEAVE',
  'COMPLAINT',
  'MESS',
  'BIOMETRIC',
  'SUSPENSION',
  'FEE',
  'DEVICE',
];

const PRIORITIES = ['ALL', 'LOW', 'NORMAL', 'HIGH', 'URGENT'];

const RECIPIENT_SCOPES = [
  { value: 'ALL_STUDENTS', label: 'All Active Students' },
  { value: 'INDIVIDUAL', label: 'Individual Student' },
  { value: 'MULTIPLE', label: 'Multiple Students (IDs / JNTU)' },
  { value: 'BLOCK', label: 'Hostel Block' },
  { value: 'ROOM', label: 'Specific Room' },
  { value: 'ROLE', label: 'User Role' },
];

export const ManagementNotificationsPage: React.FC = () => {
  // State
  const [notifications, setNotifications] = useState<AdminNotificationItem[]>([]);
  const [kpis, setKpis] = useState<AdminNotificationKPIs>({
    total: 0,
    unread: 0,
    read: 0,
    sentToday: 0,
    system: 0,
    announcements: 0,
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters & Pagination
  const [search, setSearch] = useState<string>('');
  const [category, setCategory] = useState<string>('ALL');
  const [priority, setPriority] = useState<string>('ALL');
  const [status, setStatus] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [selectedNotification, setSelectedNotification] = useState<AdminNotificationItem | null>(null);

  // Create Form State
  const [createForm, setCreateForm] = useState<AdminSendNotificationPayload>({
    title: '',
    message: '',
    category: 'ANNOUNCEMENT',
    priority: 'NORMAL',
    recipientScope: 'ALL_STUDENTS',
    recipientIds: [],
    blockName: '',
    roomNumber: '',
    roleName: 'STUDENT',
    link: '',
    expiresAt: '',
  });
  const [recipientInputStr, setRecipientInputStr] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [resolvedCount, setResolvedCount] = useState<number | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [confirmSend, setConfirmSend] = useState<boolean>(false);

  // Fetch Notifications
  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await managementApiService.getAdminNotifications({
        page,
        pageSize,
        search: search.trim() || undefined,
        category: category !== 'ALL' ? category : undefined,
        priority: priority !== 'ALL' ? priority : undefined,
        status: status !== 'ALL' ? status : undefined,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });

      if (res && res.success) {
        setNotifications(res.notifications || []);
        if (res.stats) {
          setKpis(res.stats);
        }
        if (res.pagination) {
          setTotalPages(res.pagination.totalPages || 1);
          setTotalCount(res.pagination.total || 0);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, category, priority, status, fromDate, toDate]);

  // Initial load and filter effect
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const loadNotificationsRef = useRef(loadNotifications);
  useEffect(() => {
    loadNotificationsRef.current = loadNotifications;
  }, [loadNotifications]);

  // Real-time SSE listener via authenticated managementApiService
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      const type = (event?.type || '').toUpperCase();
      if (
        type.includes('NOTIFICATION') ||
        type === 'MANAGEMENT_DASHBOARD_EVENT' ||
        type === 'MANAGEMENT_DASHBOARD_UPDATE'
      ) {
        loadNotificationsRef.current();
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Filter Reset
  const handleResetFilters = () => {
    setSearch('');
    setCategory('ALL');
    setPriority('ALL');
    setStatus('ALL');
    setFromDate('');
    setToDate('');
    setPage(1);
  };

  // Resolve Recipients Preview
  const handleResolveRecipients = async () => {
    setIsResolving(true);
    setCreateError(null);
    try {
      let ids: string[] = [];
      if (createForm.recipientScope === 'INDIVIDUAL' || createForm.recipientScope === 'MULTIPLE') {
        ids = recipientInputStr
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const res = await managementApiService.resolveNotificationRecipients({
        recipientScope: createForm.recipientScope,
        recipientIds: ids,
        blockName: createForm.blockName || undefined,
        roomNumber: createForm.roomNumber || undefined,
        roleName: createForm.roleName || undefined,
      });

      if (res && res.success) {
        setResolvedCount(res.count);
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to resolve recipients.');
      setResolvedCount(0);
    } finally {
      setIsResolving(false);
    }
  };

  // Submit Create Notification
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    if (!createForm.title.trim()) {
      setCreateError('Notification title is required.');
      return;
    }
    if (!createForm.message.trim()) {
      setCreateError('Notification message is required.');
      return;
    }

    if (!confirmSend) {
      setConfirmSend(true);
      return;
    }

    setIsSubmitting(true);
    try {
      let ids: string[] = [];
      if (createForm.recipientScope === 'INDIVIDUAL' || createForm.recipientScope === 'MULTIPLE') {
        ids = recipientInputStr
          .split(/[\s,]+/)
          .map((s) => s.trim())
          .filter(Boolean);
      }

      const payload: AdminSendNotificationPayload = {
        ...createForm,
        title: createForm.title.trim(),
        message: createForm.message.trim(),
        recipientIds: ids.length > 0 ? ids : undefined,
        link: createForm.link?.trim() || undefined,
        expiresAt: createForm.expiresAt || undefined,
      };

      const res = await managementApiService.sendAdminNotification(payload);

      if (res && res.success) {
        setShowCreateModal(false);
        setConfirmSend(false);
        setCreateForm({
          title: '',
          message: '',
          category: 'ANNOUNCEMENT',
          priority: 'NORMAL',
          recipientScope: 'ALL_STUDENTS',
          recipientIds: [],
          blockName: '',
          roomNumber: '',
          roleName: 'STUDENT',
          link: '',
          expiresAt: '',
        });
        setRecipientInputStr('');
        setResolvedCount(null);
        setSuccessToast(`Notification successfully sent to ${res.sentCount} recipient(s)!`);
        setTimeout(() => setSuccessToast(null), 5000);
        loadNotifications();
      }
    } catch (err: any) {
      setCreateError(err.message || 'Failed to send notification.');
      setConfirmSend(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inspect Notification Detail
  const handleViewDetail = async (notif: AdminNotificationItem) => {
    setSelectedNotification(notif);
    try {
      const res = await managementApiService.getAdminNotificationDetail(notif.id);
      if (res && res.success && res.notification) {
        setSelectedNotification(res.notification);
      }
    } catch (err) {
      // Keep selected notification as fallback
    }
  };

  return (
    <div className="admin-notifications-container" data-testid="admin-notifications-page">
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            background: '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} />
          {successToast}
        </div>
      )}

      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#0f172a' }}>
            Notifications
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: '#64748b' }}>
            Create, manage, and monitor HMS notifications.
          </p>
        </div>
        <div className="admin-notif-header-actions">
          <button
            type="button"
            className="btn-create-notification"
            onClick={() => {
              setShowCreateModal(true);
              setConfirmSend(false);
              setCreateError(null);
            }}
            id="btn-create-notification"
          >
            <Plus size={18} />
            + Create Notification
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="admin-notif-kpi-grid">
        <div className="admin-notif-kpi-card" data-testid="kpi-total">
          <div className="notif-kpi-icon-wrapper total">
            <Bell size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">Total Notifications</span>
            <span className="notif-kpi-value">{kpis.total.toLocaleString()}</span>
          </div>
        </div>

        <div className="admin-notif-kpi-card" data-testid="kpi-unread">
          <div className="notif-kpi-icon-wrapper unread">
            <Clock size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">Unread</span>
            <span className="notif-kpi-value">{kpis.unread.toLocaleString()}</span>
          </div>
        </div>

        <div className="admin-notif-kpi-card" data-testid="kpi-read">
          <div className="notif-kpi-icon-wrapper read">
            <CheckCircle2 size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">Read</span>
            <span className="notif-kpi-value">{kpis.read.toLocaleString()}</span>
          </div>
        </div>

        <div className="admin-notif-kpi-card" data-testid="kpi-sent-today">
          <div className="notif-kpi-icon-wrapper sent-today">
            <Send size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">Sent Today</span>
            <span className="notif-kpi-value">{kpis.sentToday.toLocaleString()}</span>
          </div>
        </div>

        <div className="admin-notif-kpi-card" data-testid="kpi-system">
          <div className="notif-kpi-icon-wrapper system">
            <Layers size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">System / Operational</span>
            <span className="notif-kpi-value">{kpis.system.toLocaleString()}</span>
          </div>
        </div>

        <div className="admin-notif-kpi-card" data-testid="kpi-announcements">
          <div className="notif-kpi-icon-wrapper announcements">
            <Info size={22} />
          </div>
          <div className="notif-kpi-content">
            <span className="notif-kpi-label">Announcements</span>
            <span className="notif-kpi-value">{kpis.announcements.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="admin-notif-filters-card">
        <div className="admin-notif-filters-grid">
          <div className="filter-input-group">
            <label htmlFor="filter-search">Search Notification / Recipient</label>
            <input
              id="filter-search"
              type="text"
              placeholder="Search title, message, student..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-category">Category</label>
            <select
              id="filter-category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-priority">Priority</label>
            <select
              id="filter-priority"
              value={priority}
              onChange={(e) => {
                setPriority(e.target.value);
                setPage(1);
              }}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-status">Read Status</label>
            <select
              id="filter-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="ALL">ALL</option>
              <option value="UNREAD">UNREAD</option>
              <option value="READ">READ</option>
            </select>
          </div>

          <div className="filter-input-group">
            <label htmlFor="filter-date-from">From Date</label>
            <input
              id="filter-date-from"
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <button
            type="button"
            className="btn-reset-filters"
            onClick={handleResetFilters}
            title="Reset Filters"
          >
            <RefreshCw size={14} />
            Reset
          </button>
        </div>
      </div>

      {/* Notification History Card */}
      <div className="admin-notif-history-card">
        <div className="history-card-header">
          <h3>
            <FileText size={18} />
            Notification History
          </h3>
          <span className="history-count-badge">
            {totalCount.toLocaleString()} Record{totalCount === 1 ? '' : 's'}
          </span>
        </div>

        {error && (
          <div
            style={{
              padding: '1rem',
              background: '#fef2f2',
              borderBottom: '1px solid #fee2e2',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.875rem',
            }}
          >
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="admin-notif-empty">
            <RefreshCw size={28} className="animate-spin" style={{ color: '#2563eb' }} />
            <p>Loading notification records...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="admin-notif-empty">
            <Bell size={36} style={{ color: '#94a3b8' }} />
            <p>No notifications match the selected criteria.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="admin-notif-table-wrapper">
              <table className="admin-notif-table">
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Title & Snippet</th>
                    <th>Category</th>
                    <th>Priority</th>
                    <th>Recipient / Target</th>
                    <th>Status</th>
                    <th>Created By</th>
                    <th>Related Module</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {notifications.map((notif) => {
                    const recipientName = notif.student?.fullName || 'All / Unknown';
                    const jntuNo = notif.student?.jntuNo ? `(${notif.student.jntuNo})` : '';
                    const dateStr = new Date(notif.createdAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <tr key={notif.id} data-testid={`notification-row-${notif.id}`}>
                        <td style={{ whiteSpace: 'nowrap', fontSize: '0.8125rem', color: '#64748b' }}>
                          {dateStr}
                        </td>
                        <td className="notif-cell-title">
                          <strong>{notif.title}</strong>
                          <span className="notif-cell-snippet">{notif.message}</span>
                        </td>
                        <td>
                          <span className={`badge-category ${notif.category?.toLowerCase() || 'system'}`}>
                            {notif.category}
                          </span>
                        </td>
                        <td>
                          <span className={`badge-priority ${notif.priority?.toLowerCase() || 'normal'}`}>
                            {notif.priority || 'NORMAL'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>{recipientName}</span>
                            {jntuNo && (
                              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{jntuNo}</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`badge-read-status ${notif.isRead ? 'read' : 'unread'}`}>
                            {notif.isRead ? (
                              <>
                                <CheckCircle2 size={12} />
                                Read
                              </>
                            ) : (
                              <>
                                <Clock size={12} />
                                Unread
                              </>
                            )}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.8125rem', color: '#475569' }}>
                          {notif.createdBy || notif.source || 'SYSTEM'}
                        </td>
                        <td style={{ fontSize: '0.8125rem' }}>
                          {notif.link ? (
                            <span style={{ color: '#2563eb', fontFamily: 'monospace' }}>
                              {notif.link}
                            </span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="btn-view-detail"
                            onClick={() => handleViewDetail(notif)}
                            id={`btn-view-${notif.id}`}
                          >
                            <Eye size={14} />
                            View Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards */}
            <div className="admin-notif-mobile-cards">
              {notifications.map((notif) => (
                <div key={notif.id} className="notif-mobile-card">
                  <div className="notif-mobile-top">
                    <span className="notif-mobile-title">{notif.title}</span>
                    <span className={`badge-category ${notif.category?.toLowerCase() || 'system'}`}>
                      {notif.category}
                    </span>
                  </div>

                  <p className="notif-mobile-body">{notif.message}</p>

                  <div className="notif-mobile-meta">
                    <span>
                      <strong>To:</strong> {notif.student?.fullName || 'Broadcast'}
                    </span>
                    <span>
                      <strong>Priority:</strong> {notif.priority || 'NORMAL'}
                    </span>
                    <span>
                      <strong>Status:</strong> {notif.isRead ? 'Read' : 'Unread'}
                    </span>
                    <span>
                      {new Date(notif.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="notif-mobile-actions">
                    <button
                      type="button"
                      className="btn-view-detail"
                      onClick={() => handleViewDetail(notif)}
                    >
                      <Eye size={14} />
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            <div className="admin-notif-pagination">
              <span>
                Page {page} of {totalPages} ({totalCount} items)
              </span>
              <div className="pagination-controls">
                <button
                  type="button"
                  className="btn-page"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={16} />
                  Prev
                </button>
                <button
                  type="button"
                  className="btn-page"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal 1: Create Notification */}
      {showCreateModal && (
        <div className="admin-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                <Send size={18} />
                Create Notification / Announcement
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setShowCreateModal(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="admin-modal-body">
                {createError && (
                  <div
                    style={{
                      background: '#fef2f2',
                      border: '1px solid #fee2e2',
                      borderRadius: 6,
                      padding: '0.75rem 1rem',
                      color: '#dc2626',
                      fontSize: '0.875rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <AlertTriangle size={16} />
                    {createError}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="create-title">
                    Title <span className="required">*</span>
                  </label>
                  <input
                    id="create-title"
                    type="text"
                    placeholder="e.g. Hostel Inspection Tomorrow Morning"
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="create-message">
                    Message Body <span className="required">*</span>
                  </label>
                  <textarea
                    id="create-message"
                    placeholder="Provide full operational details, timing, requirements..."
                    value={createForm.message}
                    onChange={(e) => setCreateForm({ ...createForm, message: e.target.value })}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="create-category">
                      Category <span className="required">*</span>
                    </label>
                    <select
                      id="create-category"
                      value={createForm.category}
                      onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    >
                      {CATEGORIES.filter((c) => c !== 'ALL').map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-priority">Priority</label>
                    <select
                      id="create-priority"
                      value={createForm.priority}
                      onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    >
                      {PRIORITIES.filter((p) => p !== 'ALL').map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Recipient Scope Selection */}
                <div className="form-group">
                  <label htmlFor="create-scope">
                    Recipient Target <span className="required">*</span>
                  </label>
                  <select
                    id="create-scope"
                    value={createForm.recipientScope}
                    onChange={(e) => {
                      setCreateForm({
                        ...createForm,
                        recipientScope: e.target.value as any,
                      });
                      setResolvedCount(null);
                    }}
                  >
                    {RECIPIENT_SCOPES.map((sc) => (
                      <option key={sc.value} value={sc.value}>
                        {sc.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Scope Inputs */}
                {(createForm.recipientScope === 'INDIVIDUAL' || createForm.recipientScope === 'MULTIPLE') && (
                  <div className="form-group">
                    <label htmlFor="create-recipients-input">
                      Student ID(s) or JNTU No(s) <span className="required">*</span>
                    </label>
                    <input
                      id="create-recipients-input"
                      type="text"
                      placeholder="e.g. 25331A05H7, 25331A05H8"
                      value={recipientInputStr}
                      onChange={(e) => {
                        setRecipientInputStr(e.target.value);
                        setResolvedCount(null);
                      }}
                    />
                    <span className="form-hint">Separate multiple entries with commas or spaces.</span>
                  </div>
                )}

                {createForm.recipientScope === 'BLOCK' && (
                  <div className="form-group">
                    <label htmlFor="create-block-input">
                      Block Name / Code <span className="required">*</span>
                    </label>
                    <input
                      id="create-block-input"
                      type="text"
                      placeholder="e.g. Block A, BLK-A"
                      value={createForm.blockName}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, blockName: e.target.value });
                        setResolvedCount(null);
                      }}
                    />
                  </div>
                )}

                {createForm.recipientScope === 'ROOM' && (
                  <div className="form-group">
                    <label htmlFor="create-room-input">
                      Room Number <span className="required">*</span>
                    </label>
                    <input
                      id="create-room-input"
                      type="text"
                      placeholder="e.g. 101, 204"
                      value={createForm.roomNumber}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, roomNumber: e.target.value });
                        setResolvedCount(null);
                      }}
                    />
                  </div>
                )}

                {createForm.recipientScope === 'ROLE' && (
                  <div className="form-group">
                    <label htmlFor="create-role-input">User Role</label>
                    <select
                      id="create-role-input"
                      value={createForm.roleName}
                      onChange={(e) => {
                        setCreateForm({ ...createForm, roleName: e.target.value });
                        setResolvedCount(null);
                      }}
                    >
                      <option value="STUDENT">STUDENT</option>
                      <option value="WARDEN">WARDEN</option>
                      <option value="HOSTEL_ADMIN">HOSTEL_ADMIN</option>
                    </select>
                  </div>
                )}

                {/* Recipient Preview Box */}
                <div className="recipient-resolution-box">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Users size={16} />
                    <span>
                      {resolvedCount !== null
                        ? `Target matches ${resolvedCount} authoritative user(s)`
                        : 'Preview recipient resolution before broadcast'}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="preview-btn"
                    onClick={handleResolveRecipients}
                    disabled={isResolving}
                  >
                    {isResolving ? 'Resolving...' : 'Check Count'}
                  </button>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="create-link">Deep Link / Related Module</label>
                    <input
                      id="create-link"
                      type="text"
                      placeholder="e.g. /student/complaints or /student/outings"
                      value={createForm.link}
                      onChange={(e) => setCreateForm({ ...createForm, link: e.target.value })}
                    />
                    <span className="form-hint">Internal route starting with forward slash (/).</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-expires">Expiry Date / Time (Optional)</label>
                    <input
                      id="create-expires"
                      type="datetime-local"
                      value={createForm.expiresAt}
                      onChange={(e) => setCreateForm({ ...createForm, expiresAt: e.target.value })}
                    />
                  </div>
                </div>

                {confirmSend && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1px solid #fef3c7',
                      borderRadius: 8,
                      padding: '1rem',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      color: '#92400e',
                    }}
                  >
                    <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div style={{ fontSize: '0.875rem' }}>
                      <strong>Confirm Notification Broadcast:</strong>
                      <p style={{ margin: '4px 0 0' }}>
                        You are about to dispatch an authoritative notification to{' '}
                        <strong>
                          {resolvedCount !== null ? `${resolvedCount} recipient(s)` : 'target users'}
                        </strong>
                        . This operation will be written to PostgreSQL and dispatched via real-time SSE.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="btn-page"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-create-notification"
                  disabled={isSubmitting}
                  id="btn-confirm-send"
                >
                  {isSubmitting ? (
                    'Sending...'
                  ) : confirmSend ? (
                    'Confirm & Broadcast Now'
                  ) : (
                    'Preview & Send'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: View Notification Detail */}
      {selectedNotification && (
        <div className="admin-modal-overlay" onClick={() => setSelectedNotification(null)}>
          <div className="admin-modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h3>
                <Info size={18} />
                Notification Details
              </h3>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedNotification(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-body">
              <div className="detail-grid">
                <div className="detail-item detail-full-width">
                  <span className="detail-label">Title</span>
                  <span className="detail-value" style={{ fontSize: '1.0625rem', fontWeight: 700 }}>
                    {selectedNotification.title}
                  </span>
                </div>

                <div className="detail-item detail-full-width">
                  <span className="detail-label">Message</span>
                  <div className="detail-message-box">{selectedNotification.message}</div>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">
                    <span className={`badge-category ${selectedNotification.category?.toLowerCase() || 'system'}`}>
                      {selectedNotification.category}
                    </span>
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Priority</span>
                  <span className="detail-value">
                    <span className={`badge-priority ${selectedNotification.priority?.toLowerCase() || 'normal'}`}>
                      {selectedNotification.priority || 'NORMAL'}
                    </span>
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Recipient</span>
                  <span className="detail-value">
                    {selectedNotification.student?.fullName || 'All / Broadcast'}
                    {selectedNotification.student?.jntuNo ? ` (${selectedNotification.student.jntuNo})` : ''}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Recipient Role</span>
                  <span className="detail-value">
                    {selectedNotification.student?.role || 'STUDENT'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Read Status</span>
                  <span className="detail-value">
                    <span className={`badge-read-status ${selectedNotification.isRead ? 'read' : 'unread'}`}>
                      {selectedNotification.isRead ? 'Read' : 'Unread'}
                    </span>
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Read Timestamp</span>
                  <span className="detail-value">
                    {selectedNotification.readAt
                      ? new Date(selectedNotification.readAt).toLocaleString('en-GB')
                      : '— Not yet read —'}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Source</span>
                  <span className="detail-value">{selectedNotification.source || 'SYSTEM'}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Created By</span>
                  <span className="detail-value">{selectedNotification.createdBy || 'SYSTEM'}</span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Created At</span>
                  <span className="detail-value">
                    {new Date(selectedNotification.createdAt).toLocaleString('en-GB')}
                  </span>
                </div>

                <div className="detail-item">
                  <span className="detail-label">Expires At</span>
                  <span className="detail-value">
                    {selectedNotification.expiresAt
                      ? new Date(selectedNotification.expiresAt).toLocaleString('en-GB')
                      : 'Never'}
                  </span>
                </div>

                {selectedNotification.link && (
                  <div className="detail-item detail-full-width">
                    <span className="detail-label">Deep Navigation Link</span>
                    <span className="detail-value" style={{ color: '#2563eb', fontFamily: 'monospace' }}>
                      {selectedNotification.link}
                    </span>
                  </div>
                )}

                {selectedNotification.metadata && (
                  <div className="detail-item detail-full-width">
                    <span className="detail-label">Safe Metadata</span>
                    <pre className="detail-metadata-box">
                      {typeof selectedNotification.metadata === 'string'
                        ? selectedNotification.metadata
                        : JSON.stringify(selectedNotification.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            <div className="admin-modal-footer">
              <button
                type="button"
                className="btn-page"
                onClick={() => setSelectedNotification(null)}
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

export default ManagementNotificationsPage;
