import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  BedDouble,
  Footprints,
  FileText,
  AlertCircle,
  RotateCw,
  Lock,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Layers,
  Building,
  Wrench,
  Receipt,
  UtensilsCrossed,
  History,
  ClipboardList,
  CreditCard,
  Landmark,
  Bell,
} from 'lucide-react';
import {
  managementApiService,
  ManagementDashboardData,
  AttentionItem,
} from '../services/api';
import { useManagementAuth } from '../context/ManagementAuthContext';

interface ManagementDashboardPageProps {
  onNavigate?: (path: string) => void;
  onModuleNotice?: (moduleName: string) => void;
  onRefreshStateChange?: (isRefreshing: boolean, isConnected: boolean) => void;
  registerRefreshHandler?: (refreshFn: () => void) => void;
}

const ADMIN_MODULES = [
  { id: 'blocks', title: 'Block Management', path: '/management/blocks', icon: Building },
  { id: 'rooms', title: 'Room Allocation', path: '/management/rooms', icon: BedDouble },
  { id: 'maintenance', title: 'Maintenance', path: '/management/complaints', icon: Wrench },
  { id: 'outings', title: 'Outing Requests', path: '/management/outings', icon: Footprints },
  { id: 'mess', title: 'Mess Management', path: '/management/mess', icon: UtensilsCrossed },
  { id: 'leaves', title: 'Leaves & Suspension', path: '/management/leaves', icon: FileText },
  { id: 'logs', title: 'Log History', path: '/management/log-history', icon: History },
  { id: 'outing-logs', title: 'Outing Log History', path: '/management/outing-logs', icon: ClipboardList },
  { id: 'users', title: 'User Management', path: '/management/users', icon: Users },
  { id: 'billing', title: 'Guest Billing', path: '/management/guest-billing', icon: Receipt },
  { id: 'fee-management', title: 'Fee Management', path: '/management/fee-management', icon: CreditCard },
  { id: 'fee-collection', title: 'Fee Collection', path: '/management/fee-collection', icon: Landmark },
  { id: 'notifications', title: 'Notifications', path: '/management/notifications', icon: Bell },
];

export const ManagementDashboardPage: React.FC<ManagementDashboardPageProps> = ({
  onNavigate,
  onModuleNotice,
  onRefreshStateChange,
  registerRefreshHandler,
}) => {
  const { user } = useManagementAuth();
  const [data, setData] = useState<ManagementDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const onRefreshStateChangeRef = useRef(onRefreshStateChange);
  const isRefreshingRef = useRef(isRefreshing);
  const isRealtimeConnectedRef = useRef(isRealtimeConnected);

  useEffect(() => {
    onRefreshStateChangeRef.current = onRefreshStateChange;
    isRefreshingRef.current = isRefreshing;
    isRealtimeConnectedRef.current = isRealtimeConnected;
  });

  const fetchDashboardData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
      onRefreshStateChangeRef.current?.(true, isRealtimeConnectedRef.current);
    }
    setError(null);

    try {
      const response = await managementApiService.getDashboard();
      setData(response);
      setLastRefreshedAt(new Date());
    } catch (err: any) {
      console.error('Failed to load admin dashboard:', err);
      setError(err.message || 'Unable to load administration metrics. Please try again.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      onRefreshStateChangeRef.current?.(false, isRealtimeConnectedRef.current);
    }
  }, []);

  const fetchDashboardDataRef = useRef(fetchDashboardData);
  useEffect(() => {
    fetchDashboardDataRef.current = fetchDashboardData;
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchDashboardData(false);
  }, [fetchDashboardData]);

  // Register manual refresh handler with parent layout
  useEffect(() => {
    if (registerRefreshHandler) {
      registerRefreshHandler(() => fetchDashboardDataRef.current(true));
    }
  }, [registerRefreshHandler]);

  // Real-time SSE: Domain change → DB → SSE → Refetch → UI
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (_event) => {
        fetchDashboardDataRef.current(true);
      },
      (connected) => {
        setIsRealtimeConnected(connected);
        onRefreshStateChangeRef.current?.(isRefreshingRef.current, connected);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleAttentionClick = (item: AttentionItem) => {
    if (!item.isAvailable && onModuleNotice) {
      onModuleNotice(item.targetModule);
    }
  };

  const formatTimestamp = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return dateStr; }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <div className="management-dashboard-view" aria-busy="true">
        <div className="admin-dash-hero skeleton-block" style={{ height: '56px', borderRadius: '12px' }} />
        <div className="admin-summary-grid">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="admin-summary-card skeleton-card" style={{ minHeight: '115px' }} />
          ))}
        </div>
        <div className="admin-section-heading skeleton-block" style={{ height: '24px', width: '200px', margin: '1.25rem 0 0.85rem' }} />
        <div className="admin-modules-grid">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="admin-module-card skeleton-card" style={{ minHeight: '105px' }} />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !data) {
    return (
      <div className="management-dashboard-view">
        <div className="mgmt-error-card" role="alert">
          <AlertCircle size={40} className="mgmt-error-icon" />
          <h2 className="mgmt-error-title">Unable to Load Operational Dashboard</h2>
          <p className="mgmt-error-msg">{error}</p>
          <button
            type="button"
            onClick={() => fetchDashboardData(false)}
            className="btn-primary"
            style={{ marginTop: '1rem' }}
          >
            <RotateCw size={16} style={{ marginRight: '6px' }} />
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Use correct field names from backend
  const residents = data.residents;
  const rooms = data.rooms;
  const requests = data.requests;
  const attentionItems = data.attention || [];
  const recentActivity = data.recentActivity || [];

  // Room occupancy donut chart values
  const totalR = rooms.totalRooms || 1;
  const occupiedPct = Math.round(((rooms.occupied || 0) / totalR) * 100);
  const partialPct = Math.round(((rooms.partiallyOccupied || 0) / totalR) * 100);
  const vacantPct = Math.max(0, 100 - occupiedPct - partialPct);

  // SVG donut circumference = 2 * PI * r40 ≈ 251.2
  const circ = 251.2;
  const strokeOccupied = (occupiedPct / 100) * circ;
  const strokePartial = (partialPct / 100) * circ;
  const strokeVacant = (vacantPct / 100) * circ;

  // Resident presence bar percentages
  const totalRes = residents.totalResidents || 1;
  const insidePct = Math.round((residents.currentlyInside / totalRes) * 100);
  const outsidePct = Math.round((residents.currentlyOutside / totalRes) * 100);
  const onLeavePct = Math.round((residents.onLeave / totalRes) * 100);
  const suspendedPct = Math.round((residents.suspended / totalRes) * 100);

  return (
    <div className="management-dashboard-view">
      {/* Admin Dashboard Header (Step 1) */}
      <div className="admin-dash-hero">
        <h1 className="admin-dash-title">Admin Dashboard</h1>
        <p className="admin-dash-subtitle">
          Welcome back, {user?.name || 'Administrator'}
        </p>
      </div>

      {/* Four Primary Summary Cards (Screenshot-Accurate) */}
      <section className="admin-summary-grid" aria-label="Summary Overview">
        {/* Card 1: Total Students */}
        <div className="admin-summary-card card-students">
          <div className="summary-card-header">
            <span className="summary-card-title">Total Students</span>
            <div className="summary-card-icon-wrap icon-blue">
              <Users size={18} />
            </div>
          </div>
          <div className="summary-card-value">
            {residents.totalStudents ?? residents.totalResidents}
          </div>
          <div className="summary-card-status status-neutral">
            {residents.newStudentsThisWeek && residents.newStudentsThisWeek > 0
              ? `+${residents.newStudentsThisWeek} NEW THIS WEEK`
              : 'NO NEW STUDENTS THIS WEEK'}
          </div>
        </div>

        {/* Card 2: Rooms */}
        <div className="admin-summary-card card-rooms">
          <div className="summary-card-header">
            <span className="summary-card-title">Rooms</span>
            <div className="summary-card-icon-wrap icon-emerald">
              <BedDouble size={18} />
            </div>
          </div>
          <div className="summary-card-value">
            {rooms.totalRooms}
          </div>
          <div className="summary-card-status status-positive">
            {rooms.occupancyPercentage}% OCCUPIED
          </div>
        </div>

        {/* Card 3: Maintenance */}
        <div className="admin-summary-card card-maintenance">
          <div className="summary-card-header">
            <span className="summary-card-title">Maintenance</span>
            <div className="summary-card-icon-wrap icon-amber">
              <Wrench size={18} />
            </div>
          </div>
          <div className="summary-card-value">
            {requests.openComplaints}
          </div>
          <div className="summary-card-status status-warning">
            PENDING REQUESTS
          </div>
        </div>

        {/* Card 4: Outings */}
        <div className="admin-summary-card card-outings">
          <div className="summary-card-header">
            <span className="summary-card-title">Outings</span>
            <div className="summary-card-icon-wrap icon-indigo">
              <Footprints size={18} />
            </div>
          </div>
          <div className="summary-card-value">
            {requests.pendingOutings}
          </div>
          <div className="summary-card-status status-warning">
            AWAITING APPROVAL
          </div>
        </div>
      </section>

      {/* Management Modules Section */}
      <section className="admin-modules-section" aria-label="Management Modules">
        <h2 className="admin-section-heading">Management Modules</h2>

        <div className="admin-modules-grid">
          {ADMIN_MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.id}
                className="admin-module-card"
                onClick={() => {
                  if (onNavigate) {
                    onNavigate(mod.path);
                  } else if (onModuleNotice) {
                    onModuleNotice(mod.title);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onNavigate) onNavigate(mod.path);
                  }
                }}
                aria-label={`Navigate to ${mod.title}`}
              >
                <div className="module-card-icon-wrap">
                  <Icon size={24} className="module-card-icon" />
                </div>
                <span className="module-card-title">{mod.title}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Operational Meta Bar */}
      <div className="mgmt-meta-bar" style={{ marginTop: '0.75rem' }}>
        <div className="mgmt-meta-left">
          <span className="mgmt-meta-badge">
            <Activity size={13} />
            PostgreSQL Authoritative
          </span>
          {data.systemStatus && (
            <span className="mgmt-meta-text">
              DB: <strong>{data.systemStatus.database}</strong> •
              Biometric: <strong>{data.systemStatus.biometricSync}</strong>
            </span>
          )}
        </div>
        <div className="mgmt-meta-right">
          {lastRefreshedAt && (
            <span className="mgmt-sync-time">
              Synced at {lastRefreshedAt.toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={isRefreshing}
            className="mgmt-inline-refresh"
            title="Fetch authoritative counts from PostgreSQL"
          >
            <RotateCw size={13} className={isRefreshing ? 'spin-anim' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Requires Attention Section */}
      <section className="mgmt-section" aria-label="Actionable Operational Items">
        <div className="mgmt-section-header">
          <div>
            <h2 className="mgmt-section-title">Requires Attention</h2>
            <p className="mgmt-section-subtitle">Items requiring administrative review or action</p>
          </div>
          <span className="mgmt-attention-count-badge">{requests.actionableTotal} items</span>
        </div>

        {attentionItems.length === 0 ? (
          <div className="mgmt-empty-attention">
            <CheckCircle2 size={32} className="text-emerald" />
            <p className="mgmt-empty-title">All Caught Up</p>
            <p className="mgmt-empty-desc">No pending items requiring immediate attention.</p>
          </div>
        ) : (
          <div className="mgmt-attention-grid">
            {attentionItems.map((item) => {
              const urgencyClass =
                item.urgency === 'URGENT' ? 'severity-urgent'
                : item.urgency === 'HIGH' ? 'severity-high'
                : item.urgency === 'MEDIUM' ? 'severity-medium'
                : 'severity-low';

              return (
                <div
                  key={item.id}
                  onClick={() => handleAttentionClick(item)}
                  className={`mgmt-attention-card ${urgencyClass} ${!item.isAvailable ? 'disabled-target' : ''}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && handleAttentionClick(item)}
                  title={!item.isAvailable ? `${item.targetModule} is scheduled for a future module` : item.title}
                >
                  <div className="mgmt-attention-header">
                    <span className={`mgmt-severity-pill ${urgencyClass}`}>{item.urgency}</span>
                    <span className="mgmt-attention-module-tag">
                      {!item.isAvailable && <Lock size={11} style={{ marginRight: 3 }} />}
                      {item.category}
                    </span>
                  </div>
                  <div className="mgmt-attention-body">
                    <div className="mgmt-attention-count">{item.count}</div>
                    <div className="mgmt-attention-label">{item.title}</div>
                    {item.description && (
                      <div className="mgmt-attention-desc">{item.description}</div>
                    )}
                  </div>
                  <div className="mgmt-attention-footer">
                    <span className="mgmt-target-note">
                      {!item.isAvailable ? 'Module scheduled' : 'Review items'}
                    </span>
                    <ArrowUpRight size={14} className="mgmt-target-arrow" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Visual Analytics Grid */}
      <section className="mgmt-analytics-grid" aria-label="Visual Analytics">
        {/* Room Occupancy Donut */}
        <div className="mgmt-card analytics-card">
          <div className="mgmt-card-header">
            <div>
              <h3 className="mgmt-card-title">Room Occupancy Breakdown</h3>
              <p className="mgmt-card-subtitle">Authoritative bed and room allocations from PostgreSQL</p>
            </div>
            <span className="badge-pill">{rooms.totalRooms} total rooms</span>
          </div>

          <div className="mgmt-donut-container">
            <div className="donut-chart-wrapper">
              <svg width="140" height="140" viewBox="0 0 100 100" className="donut-chart">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" strokeWidth="12" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#E2E8F0" strokeWidth="12"
                  strokeDasharray={`${strokeVacant} ${circ}`} strokeDashoffset={0} transform="rotate(-90 50 50)" />
                {strokePartial > 0 && (
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F59E0B" strokeWidth="12"
                    strokeDasharray={`${strokePartial} ${circ}`} strokeDashoffset={-strokeVacant} transform="rotate(-90 50 50)" />
                )}
                {strokeOccupied > 0 && (
                  <circle cx="50" cy="50" r="40" fill="transparent" stroke="#151B54" strokeWidth="12"
                    strokeDasharray={`${strokeOccupied} ${circ}`} strokeDashoffset={-(strokeVacant + strokePartial)} transform="rotate(-90 50 50)" />
                )}
              </svg>
              <div className="donut-center-label">
                <span className="donut-pct">{rooms.occupancyPercentage}%</span>
                <span className="donut-sub">Occupied</span>
              </div>
            </div>

            <div className="donut-legend">
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#151B54' }} />
                <span className="legend-label">Fully Occupied</span>
                <span className="legend-val">{rooms.occupied} rooms</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#F59E0B' }} />
                <span className="legend-label">Partially Occupied</span>
                <span className="legend-val">{rooms.partiallyOccupied} rooms</span>
              </div>
              <div className="legend-row">
                <span className="legend-dot" style={{ backgroundColor: '#CBD5E1' }} />
                <span className="legend-label">Fully Vacant</span>
                <span className="legend-val">{rooms.vacant} rooms</span>
              </div>
              <div className="legend-divider" />
              <div className="legend-row summary-row">
                <span className="legend-label">Total Beds</span>
                <span className="legend-val">{rooms.allocatedBeds} / {rooms.totalCapacity} allocated</span>
              </div>
            </div>
          </div>
        </div>

        {/* Resident Presence Distribution */}
        <div className="mgmt-card analytics-card">
          <div className="mgmt-card-header">
            <div>
              <h3 className="mgmt-card-title">Resident Presence Distribution</h3>
              <p className="mgmt-card-subtitle">Derived from biometric entry/exit events and active passes</p>
            </div>
            <span className="badge-pill">{residents.totalResidents} residents</span>
          </div>

          <div className="presence-stack-container">
            <div className="presence-stacked-bar" role="progressbar" aria-label="Presence Distribution">
              <div className="bar-segment seg-inside" style={{ width: `${insidePct}%` }}
                title={`Inside: ${residents.currentlyInside} (${insidePct}%)`} />
              <div className="bar-segment seg-outside" style={{ width: `${outsidePct}%` }}
                title={`Outside: ${residents.currentlyOutside} (${outsidePct}%)`} />
              <div className="bar-segment seg-leave" style={{ width: `${onLeavePct}%` }}
                title={`On Leave: ${residents.onLeave} (${onLeavePct}%)`} />
              <div className="bar-segment seg-suspended" style={{ width: `${suspendedPct}%` }}
                title={`Suspended: ${residents.suspended} (${suspendedPct}%)`} />
            </div>

            <div className="presence-stat-list">
              <div className="presence-stat-item">
                <div className="stat-bullet bg-emerald" />
                <div className="stat-content">
                  <span className="stat-name">Inside Hostel</span>
                  <span className="stat-desc">Biometrically confirmed on premises</span>
                </div>
                <span className="stat-count">{residents.currentlyInside} ({insidePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-amber" />
                <div className="stat-content">
                  <span className="stat-name">Currently Outside</span>
                  <span className="stat-desc">Gate pass active or verified exit</span>
                </div>
                <span className="stat-count">{residents.currentlyOutside} ({outsidePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-indigo" />
                <div className="stat-content">
                  <span className="stat-name">On Approved Leave</span>
                  <span className="stat-desc">Multi-day sanctioned leave</span>
                </div>
                <span className="stat-count">{residents.onLeave} ({onLeavePct}%)</span>
              </div>
              <div className="presence-stat-item">
                <div className="stat-bullet bg-crimson" />
                <div className="stat-content">
                  <span className="stat-name">Suspended</span>
                  <span className="stat-desc">Disciplinary campus bar in effect</span>
                </div>
                <span className="stat-count">{residents.suspended} ({suspendedPct}%)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Activity & Biometric Feed */}
      <section className="mgmt-card mgmt-feed-section" aria-label="Operational Logs">
        <div className="mgmt-card-header mgmt-feed-header">
          <div>
            <h3 className="mgmt-card-title">Authoritative Operational Logs</h3>
            <p className="mgmt-card-subtitle">Real-time domain records from PostgreSQL ActivityLog</p>
          </div>
        </div>

        <div className="mgmt-activity-feed">
          {recentActivity.length === 0 ? (
            <div className="mgmt-feed-empty">
              <Layers size={28} className="text-slate" />
              <p>No recent activity records logged.</p>
            </div>
          ) : (
            <div className="activity-timeline">
              {recentActivity.map((act) => (
                <div key={act.id} className="activity-item">
                  <div className="activity-dot-wrapper">
                    <div className="activity-dot" />
                    <div className="activity-line" />
                  </div>
                  <div className="activity-content">
                    <div className="activity-top">
                      <span className="activity-type-badge">{act.activityType}</span>
                      {act.student && (
                        <span className="activity-actor">{act.student.name} ({act.student.jntuNo})</span>
                      )}
                      <span className="activity-time">{formatDate(act.timestamp)} {formatTimestamp(act.timestamp)}</span>
                    </div>
                    <p className="activity-desc">{act.description}</p>
                    {act.student?.blockName && (
                      <div className="activity-meta">
                        <span>Block: {act.student.blockName}</span>
                        {act.student.roomNumber && <span> • Room {act.student.roomNumber}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
