import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
  Footprints,
  Calendar,
  ShieldAlert,
  Bed,
  UtensilsCrossed,
  Sparkles,
} from 'lucide-react';
import {
  apiService,
  NotificationItem,
  NotificationsListData,
} from '../services/api';

interface NotificationsPageProps {
  onNavigate?: (path: string) => void;
  onUnreadCountChange?: (count: number) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({
  onNavigate,
  onUnreadCountChange,
}) => {
  const [data, setData] = useState<NotificationsListData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const [page, setPage] = useState<number>(1);

  // Modals & Action states
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [isMarkingAll, setIsMarkingAll] = useState<boolean>(false);

  // Toasts
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    if (realtimeToast) {
      const timer = setTimeout(() => setRealtimeToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [realtimeToast]);

  /**
   * Fetch authoritative notifications list
   */
  const fetchNotifications = useCallback(
    async (isSilent = false) => {
      if (isSilent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const res = await apiService.getNotifications({
          page,
          limit: 20,
          category: categoryFilter,
          unreadOnly,
        });
        setData(res);
        if (onUnreadCountChange) {
          onUnreadCountChange(res.unreadCount);
        }
      } catch (err: any) {
        setError(err.message || 'Unable to load notifications.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, categoryFilter, unreadOnly, onUnreadCountChange]
  );

  /**
   * Fetch a single notification detail and mark as read
   */
  const handleOpenDetail = async (item: NotificationItem) => {
    setSelectedNotification(item);

    try {
      if (!item.isRead) {
        const updated = await apiService.markNotificationAsRead(item.id);
        setSelectedNotification(updated.notification);
        if (onUnreadCountChange) {
          onUnreadCountChange(updated.unreadCount);
        }
        fetchNotifications(true);
      }
    } catch (err) {
      console.error('Error marking notification as read on open:', err);
    }
  };

  /**
   * Mark an individual notification as read
   */
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMarkingId(id);

    try {
      const res = await apiService.markNotificationAsRead(id);
      setToastMessage('Notification marked as read.');
      if (onUnreadCountChange) {
        onUnreadCountChange(res.unreadCount);
      }
      fetchNotifications(true);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to mark as read.');
    } finally {
      setMarkingId(null);
    }
  };

  /**
   * Mark all unread notifications as read
   */
  const handleMarkAllAsRead = async () => {
    setIsMarkingAll(true);

    try {
      const res = await apiService.markAllNotificationsAsRead();
      setToastMessage(`Marked all ${res.markedCount} notification(s) as read.`);
      if (onUnreadCountChange) {
        onUnreadCountChange(0);
      }
      fetchNotifications(true);
    } catch (err: any) {
      setToastMessage(err.message || 'Failed to mark all as read.');
    } finally {
      setIsMarkingAll(false);
    }
  };

  /**
   * Real-time SSE Connection & Auto-Synchronization
   */
  useEffect(() => {
    fetchNotifications();

    const unsubscribe = apiService.subscribeToNotificationEvents((event) => {
      let noticeText = 'New notification received in real time.';
      if (event.type === 'NOTIFICATION_CREATED') {
        noticeText = 'New hostel notice received.';
      } else if (event.type === 'NOTIFICATIONS_ALL_READ') {
        noticeText = 'All notifications marked as read.';
      }

      setRealtimeToast(noticeText);
      if (typeof event.unreadCount === 'number' && onUnreadCountChange) {
        onUnreadCountChange(event.unreadCount);
      }
      fetchNotifications(true);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchNotifications, onUnreadCountChange]);

  /**
   * Navigation helper
   */
  const handleNavigateResource = (link?: string | null) => {
    if (!link) return;
    if (onNavigate) {
      onNavigate(link);
    } else {
      window.location.href = link;
    }
  };

  /**
   * Icons and visual helpers mapping domain categories to reference visual categories:
   * Announcements, Reminders, Events, Alerts, General
   */
  const mapCategoryToVisualLabel = (category: string) => {
    switch (category) {
      case 'ANNOUNCEMENT':
        return 'Announcement';
      case 'MESS':
      case 'ROOM':
        return 'Reminder';
      case 'BIOMETRIC':
        return 'Event';
      case 'SUSPENSION':
        return 'Alert';
      case 'OUTING':
      case 'LEAVE':
      case 'COMPLAINT':
      case 'SYSTEM':
      default:
        return 'General';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ANNOUNCEMENT':
        return <Sparkles size={18} className="text-blue-600" />;
      case 'MESS':
        return <UtensilsCrossed size={18} className="text-purple-600" />;
      case 'ROOM':
        return <Bed size={18} className="text-emerald-600" />;
      case 'BIOMETRIC':
        return <Footprints size={18} className="text-indigo-600" />;
      case 'SUSPENSION':
        return <ShieldAlert size={18} className="text-red-700" />;
      case 'OUTING':
        return <Footprints size={18} className="text-amber-600" />;
      case 'LEAVE':
        return <Calendar size={18} className="text-indigo-600" />;
      case 'COMPLAINT':
        return <AlertCircle size={18} className="text-rose-600" />;
      case 'SYSTEM':
      default:
        return <Sparkles size={18} className="text-blue-600" />;
    }
  };

  const getCategoryBoxClass = (category: string) => {
    switch (category) {
      case 'ANNOUNCEMENT':
        return 'cat-system';
      case 'MESS':
      case 'ROOM':
        return 'cat-room';
      case 'BIOMETRIC':
        return 'cat-leave';
      case 'SUSPENSION':
        return 'cat-suspension';
      case 'OUTING':
        return 'cat-outing';
      case 'LEAVE':
        return 'cat-leave';
      case 'COMPLAINT':
        return 'cat-complaint';
      case 'SYSTEM':
      default:
        return 'cat-system';
    }
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

  return (
    <div className="portal-page-container">
      {/* Real-time Push Toast */}
      {realtimeToast && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-indigo-500/40 animate-in fade-in">
          <Sparkles size={18} className="text-amber-400 shrink-0" />
          <span className="text-sm font-medium">{realtimeToast}</span>
          <button
            onClick={() => setRealtimeToast(null)}
            className="text-white/60 hover:text-white ml-2"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Action Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
            <span className="text-sm font-semibold">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="portal-page-header">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="portal-page-title">Notifications</h1>
            {data && data.unreadCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-600 text-white shadow-sm">
                {data.unreadCount} unread
              </span>
            )}
          </div>
          <p className="portal-page-desc">
            Stay informed on your outing passes, leave approvals, room assignments, and official hostel announcements.
          </p>
        </div>

        <div className="portal-header-actions">
          <button
            type="button"
            className="btn-secondary-action"
            onClick={() => fetchNotifications(true)}
            disabled={isRefreshing}
            title="Synchronize notifications"
          >
            <RefreshCw size={16} className={isRefreshing ? 'spin-icon text-primary' : ''} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            className="btn-secondary-action"
            onClick={handleMarkAllAsRead}
            disabled={isMarkingAll || (data ? data.unreadCount === 0 : true)}
            title="Mark all notifications as read"
          >
            <CheckCheck size={16} />
            <span>{isMarkingAll ? 'Marking...' : 'Mark All Read'}</span>
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loading && !data && (
        <div className="p-12 text-center">
          <div className="inline-block w-8 h-8 border-4 border-primary-navy border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">Loading notifications from PostgreSQL...</p>
        </div>
      )}

      {/* General Error state */}
      {error && !data && (
        <div className="p-8 text-center bg-rose-50 border border-rose-200 rounded-2xl">
          <AlertTriangle size={36} className="mx-auto text-rose-500 mb-3" />
          <h3 className="text-base font-bold text-rose-900">Unable to load notifications</h3>
          <p className="text-sm text-rose-700 mt-1 mb-4">{error}</p>
          <button
            onClick={() => fetchNotifications()}
            className="btn-primary-action"
          >
            Retry
          </button>
        </div>
      )}

      {data && (
        <>
          {/* Filters Bar */}
          <div className="notifications-filter-toolbar">
            {/* Category Tabs */}
            <div className="notification-category-pills">
              {[
                { key: 'ALL', label: 'All' },
                { key: 'ANNOUNCEMENT', label: 'Announcements' },
                { key: 'MESS', label: 'Reminders' },
                { key: 'BIOMETRIC', label: 'Events' },
                { key: 'SUSPENSION', label: 'Alerts' },
                { key: 'SYSTEM', label: 'General' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(tab.key);
                    setPage(1);
                  }}
                  className={`filter-pill-btn ${categoryFilter === tab.key ? 'active' : ''}`}
                >
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Read/Unread Filter Toggle & Summary */}
            <div className="flex items-center gap-3 shrink-0">
              <label className="unread-filter-label">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => {
                    setUnreadOnly(e.target.checked);
                    setPage(1);
                  }}
                />
                <span>Unread Only</span>
              </label>

              <div className="text-xs text-slate-500 font-medium pl-3 border-l border-slate-200">
                <strong className="text-slate-800">{data.unreadCount}</strong> unread · {data.total} total
              </div>
            </div>
          </div>

          {/* Notifications List */}
          {data.notifications.length === 0 ? (
            <div className="empty-state-container">
              <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mb-2">
                <CheckCheck size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-base font-bold text-slate-800">You're All Caught Up!</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-3">
                {unreadOnly
                  ? 'There are no unread notifications matching your filter.'
                  : categoryFilter !== 'ALL'
                  ? `No ${categoryFilter.toLowerCase()} notifications recorded.`
                  : 'No notification records present. You will be alerted when new actions occur.'}
              </p>
              {(unreadOnly || categoryFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter('ALL');
                    setUnreadOnly(false);
                    setPage(1);
                  }}
                  className="btn-secondary-action inline-flex"
                >
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          ) : (
            <div className="notifications-feed-list">
              {data.notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleOpenDetail(item)}
                  className={`notification-card ${!item.isRead ? 'unread' : ''}`}
                >
                  {/* Category Icon */}
                  <div
                    className={`notification-icon-box ${getCategoryBoxClass(
                      item.category
                    )}`}
                  >
                    {getCategoryIcon(item.category)}
                  </div>

                  {/* Body Content */}
                  <div className="notification-main-content">
                    <div className="notification-card-top">
                      <div className="notification-title-wrap">
                        {!item.isRead && <span className="unread-dot" />}
                        <span className="notification-title-text">
                          {item.title}
                        </span>
                      </div>

                      <div className="notification-timestamp flex items-center gap-1.5">
                        <Clock size={12} />
                        <span>{formatDateTime(item.createdAt)}</span>
                      </div>
                    </div>

                    <p className="notification-message-body">
                      {item.message}
                    </p>

                    {/* Footer tags & actions */}
                    <div className="notification-card-bottom">
                      <div className="flex items-center gap-2">
                        <span className="notification-category-tag">
                          {mapCategoryToVisualLabel(item.category)}
                        </span>
                        {item.type && item.type !== 'INFO' && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                              item.type === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.type}
                          </span>
                        )}
                      </div>

                      <div className="notification-action-links">
                        {!item.isRead && (
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            disabled={markingId === item.id}
                            className="btn-inline-link"
                          >
                            <CheckCheck size={14} />
                            <span>{markingId === item.id ? 'Marking...' : 'Mark Read'}</span>
                          </button>
                        )}

                        {item.link && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNavigateResource(item.link);
                            }}
                            className="btn-inline-link"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            <span>Open Resource</span>
                            <ExternalLink size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
              <span className="text-xs text-slate-500">
                Page {data.page} of {data.totalPages}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="btn-secondary-action"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary-action"
                  style={{ fontSize: '0.8rem', padding: '0.45rem 0.85rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal-dialog-box" style={{ maxWidth: '560px' }}>
            <div className="modal-header-bar">
              <div className="flex items-center gap-2.5">
                <div
                  className={`notification-icon-box ${getCategoryBoxClass(
                    selectedNotification.category
                  )}`}
                  style={{ width: '36px', height: '36px' }}
                >
                  {getCategoryIcon(selectedNotification.category)}
                </div>
                <div>
                  <h3 className="modal-header-title">{selectedNotification.title}</h3>
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    {formatDateTime(selectedNotification.createdAt)}
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn-modal-close"
                onClick={() => setSelectedNotification(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body-scrollable">
              {/* Category & Status */}
              <div className="flex items-center justify-between text-xs pb-3 border-b border-slate-100">
                <span className="notification-category-tag font-bold">
                  Category: {selectedNotification.category}
                </span>

                <span className="text-slate-500 font-medium">
                  {selectedNotification.isRead
                    ? `Read at ${formatDateTime(selectedNotification.readAt || selectedNotification.createdAt)}`
                    : 'Unread'}
                </span>
              </div>

              {/* Message Body */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                {selectedNotification.message}
              </div>

              {/* Resource Link info */}
              {selectedNotification.link && (
                <div className="p-3 bg-blue-50/60 border border-blue-200/80 rounded-xl flex items-center justify-between text-xs">
                  <span className="text-blue-900 font-semibold">
                    Related Module: {selectedNotification.link}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const link = selectedNotification.link;
                      setSelectedNotification(null);
                      handleNavigateResource(link);
                    }}
                    className="btn-inline-link font-bold"
                  >
                    <span>Go to Module</span>
                    <ExternalLink size={14} />
                  </button>
                </div>
              )}
            </div>

            <div className="modal-footer-bar">
              <button
                type="button"
                className="btn-secondary-action"
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

export default NotificationsPage;
