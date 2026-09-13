import React, { useState, useEffect, useCallback } from 'react';
import {
  Bed,
  MapPin,
  Utensils,
  Calendar,
  Footprints,
  FileText,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Clock,
  Bell,
} from 'lucide-react';
import { apiService, DashboardData } from '../services/api';
import { useAuth } from '../context/AuthContext';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetchDashboard = useCallback(async (showRefreshSpinner = false) => {
    if (showRefreshSpinner) setIsRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const response = await apiService.getDashboardData();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unable to load your hostel dashboard.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const diffMs = Date.now() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return '';
    }
  };

  // 1. Error State
  if (error && !loading) {
    return (
      <div className="dashboard-state-container" role="alert">
        <div className="state-card error-state">
          <div className="state-icon-circle error">
            <AlertCircle size={32} />
          </div>
          <h2 className="state-title">Unable to load your hostel dashboard</h2>
          <p className="state-desc">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboard()}
            className="btn-retry"
          >
            <RefreshCw size={16} />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading Skeleton State
  if (loading && !data) {
    return (
      <div className="dashboard-content-wrapper" aria-busy="true">
        {/* Skeleton Welcome */}
        <div className="skeleton skeleton-welcome" />

        {/* Skeleton Cards Grid */}
        <div className="summary-cards-grid">
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
          <div className="skeleton skeleton-card" />
        </div>

        {/* Skeleton Quick Actions */}
        <div className="skeleton skeleton-quick-actions" />

        {/* Skeleton Feeds */}
        <div className="feeds-split-grid">
          <div className="skeleton skeleton-feed" />
          <div className="skeleton skeleton-feed" />
        </div>
      </div>
    );
  }

  const studentName = data?.student.name || user?.name || 'Student';
  const room = data?.room;
  const outings = data?.outings;
  const mess = data?.mess;
  const leaves = data?.leaves;

  return (
    <div className="dashboard-content-wrapper">
      {/* Welcome Banner */}
      <section className="welcome-banner-card" aria-label="Student Welcome">
        <div className="welcome-banner-main">
          <div className="welcome-text-group">
            <h2 className="welcome-title">Hi {studentName},</h2>
            <p className="welcome-subtitle">Always stay updated with your hostel.</p>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('/my-room')}
            className="welcome-profile-link"
          >
            <span>View Profile Options</span>
            <ArrowRight size={16} />
          </button>
        </div>

        <div className="welcome-banner-meta">
          <span className="meta-badge">
            <strong>JNTU No:</strong> {data?.student.jntuNo}
          </span>
          <span className="meta-badge">
            <strong>Role:</strong> {data?.student.role}
          </span>
          <button
            type="button"
            onClick={() => fetchDashboard(true)}
            className={`btn-sync-data ${isRefreshing ? 'spinning' : ''}`}
            title="Refresh dashboard data"
            aria-label="Refresh dashboard data"
          >
            <RefreshCw size={14} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </section>

      {/* 4 Summary Cards Grid */}
      <section className="summary-cards-grid" aria-label="Key Hostel Metrics">
        {/* Card 1: Room & Stay */}
        <div className="metric-card card-room" onClick={() => onNavigate('/my-room')} role="button" tabIndex={0}>
          <div className="metric-header">
            <div className="metric-icon-badge badge-blue">
              <Bed size={20} />
            </div>
            <span className={`status-pill ${room?.status === 'ALLOCATED' ? 'pill-success' : 'pill-warning'}`}>
              {room?.status || 'NOT ALLOCATED'}
            </span>
          </div>

          <div className="metric-body">
            <h3 className="metric-label">Room & Stay</h3>
            {room?.status === 'ALLOCATED' ? (
              <>
                <div className="metric-primary-value">
                  {room.block} - {room.roomNumber}
                </div>
                <div className="metric-secondary-value">
                  Floor {room.floor || '1'} · {room.roomType || 'Standard'}
                </div>
              </>
            ) : (
              <>
                <div className="metric-primary-value text-empty">
                  No room allocated
                </div>
                <div className="metric-secondary-value">
                  Your room allocation will appear here once assigned.
                </div>
              </>
            )}
          </div>
        </div>

        {/* Card 2: Active Outings */}
        <div className="metric-card card-outings" onClick={() => onNavigate('/outing-requests')} role="button" tabIndex={0}>
          <div className="metric-header">
            <div className="metric-icon-badge badge-purple">
              <MapPin size={20} />
            </div>
            <span className="metric-mini-badge">
              Active: {outings?.active || 0}
            </span>
          </div>

          <div className="metric-body">
            <h3 className="metric-label">Active Outings</h3>
            <div className="metric-secondary-label">USED THIS MONTH</div>
            <div className="metric-primary-value">
              {outings?.usedThisMonth ?? 0} / {outings?.limit ?? 5}
            </div>
          </div>
        </div>

        {/* Card 3: Mess Tokens */}
        <div className="metric-card card-mess" onClick={() => onNavigate('/mess-tokens')} role="button" tabIndex={0}>
          <div className="metric-header">
            <div className="metric-icon-badge badge-red">
              <Utensils size={20} />
            </div>
            <span className="metric-mini-badge">
              Today
            </span>
          </div>

          <div className="metric-body">
            <h3 className="metric-label">Mess Tokens</h3>
            <div className="metric-secondary-label">CURRENT STATUS</div>
            <div className="metric-primary-value">
              {(mess?.bookedToday ?? 0) > 0 ? `${mess?.bookedToday} booked today` : 'No tokens booked'}
            </div>
            {mess?.meals && mess.meals.length > 0 && (
              <div className="metric-secondary-value">
                {mess.meals.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Card 4: Leave Management */}
        <div className="metric-card card-leaves" onClick={() => onNavigate('/leaves')} role="button" tabIndex={0}>
          <div className="metric-header">
            <div className="metric-icon-badge badge-green">
              <Calendar size={20} />
            </div>
            <span className="metric-mini-badge">
              Records
            </span>
          </div>

          <div className="metric-body">
            <h3 className="metric-label">Leave Management</h3>
            <div className="metric-secondary-label">ACTIVE LEAVES</div>
            <div className="metric-primary-value">
              {leaves?.active ?? 0}
            </div>
            <div className="metric-secondary-value">
              {(leaves?.active ?? 0) > 0 ? `${leaves?.active} active sanction` : 'No active leaves'}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Actions Section */}
      <section className="quick-actions-section" aria-label="Quick Actions">
        <h3 className="section-title">Quick Actions</h3>

        <div className="quick-actions-grid">
          <button
            type="button"
            onClick={() => onNavigate('/outing-requests')}
            className="btn-quick-action action-outing"
          >
            <div className="action-icon-wrap">
              <Footprints size={22} />
            </div>
            <span className="action-title">Outing Request</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/leaves')}
            className="btn-quick-action action-leaves"
          >
            <div className="action-icon-wrap">
              <FileText size={22} />
            </div>
            <span className="action-title">Leaves</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/complaints')}
            className="btn-quick-action action-complaint"
          >
            <div className="action-icon-wrap">
              <AlertCircle size={22} />
            </div>
            <span className="action-title">Complaint</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('/mess-tokens')}
            className="btn-quick-action action-mess"
          >
            <div className="action-icon-wrap">
              <Utensils size={22} />
            </div>
            <span className="action-title">Mess Tokens</span>
          </button>
        </div>
      </section>

      {/* Two Column Feeds: Recent Activity & Notifications Preview */}
      <section className="feeds-split-grid">
        {/* Recent Activity */}
        <div className="feed-card" aria-label="Recent Activity">
          <div className="feed-card-header">
            <div className="feed-header-left">
              <Clock size={18} className="feed-header-icon" />
              <h3 className="feed-title">Recent Activity</h3>
            </div>
          </div>

          <div className="feed-card-body">
            {data?.recentActivity && data.recentActivity.length > 0 ? (
              <div className="activity-timeline">
                {data.recentActivity.map((activity) => (
                  <div key={activity.id} className="activity-timeline-item">
                    <div className="activity-bullet" aria-hidden="true" />
                    <div className="activity-details">
                      <div className="activity-desc">{activity.description}</div>
                      <div className="activity-time">{formatRelativeTime(activity.createdAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-feed-state">
                <Clock size={24} className="empty-feed-icon" />
                <p>No recent activity.</p>
              </div>
            )}
          </div>
        </div>

        {/* Notifications Preview */}
        <div className="feed-card" aria-label="Notification Preview">
          <div className="feed-card-header">
            <div className="feed-header-left">
              <Bell size={18} className="feed-header-icon" />
              <h3 className="feed-title">Notifications</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('/notifications')}
              className="feed-view-all-btn"
            >
              View All
            </button>
          </div>

          <div className="feed-card-body">
            {data?.notifications && data.notifications.length > 0 ? (
              <div className="notifications-preview-list">
                {data.notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`notification-preview-item ${notif.isRead ? 'read' : 'unread'}`}
                  >
                    <div className="notification-item-header">
                      <span className="notif-title">{notif.title}</span>
                      <span className="notif-time">{formatRelativeTime(notif.createdAt)}</span>
                    </div>
                    <p className="notif-message">{notif.message}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-feed-state">
                <Bell size={24} className="empty-feed-icon" />
                <p>No new notifications.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
