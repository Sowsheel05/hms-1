import React, { useState, useEffect, useCallback } from 'react';
import {
  Fingerprint,
  LogIn,
  LogOut,
  Clock,
  MapPin,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCw,
  Calendar,
  ShieldCheck,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  apiService,
  BiometricEventItem,
  BiometricTodayStatus,
  DailyAttendanceSummary,
} from '../services/api';

export const BiometricPage: React.FC = () => {
  // State
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [todayStatus, setTodayStatus] = useState<BiometricTodayStatus | null>(null);
  const [events, setEvents] = useState<BiometricEventItem[]>([]);
  const [dailySummaries, setDailySummaries] = useState<DailyAttendanceSummary[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    totalPages: 1,
  });

  // Filters
  const [dateRange, setDateRange] = useState<string>('ALL');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('ALL');
  const [verificationFilter, setVerificationFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'timeline' | 'daily'>('timeline');

  // Modal & Toast
  const [selectedEvent, setSelectedEvent] = useState<BiometricEventItem | null>(null);
  const [realtimeToast, setRealtimeToast] = useState<string | null>(null);

  useEffect(() => {
    if (realtimeToast) {
      const timer = setTimeout(() => setRealtimeToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [realtimeToast]);

  /**
   * Fetch authoritative overview and daily summaries
   */
  const fetchData = useCallback(
    async (isSilent = false) => {
      if (isSilent) setIsRefreshing(true);
      else setLoading(true);
      setError(null);

      try {
        const [overviewRes, summaryRes] = await Promise.all([
          apiService.getBiometricOverview({
            page: pagination.page,
            limit: pagination.limit,
            dateRange,
            eventType: eventTypeFilter,
            verificationStatus: verificationFilter,
          }),
          apiService.getBiometricSummary(7),
        ]);

        setTodayStatus(overviewRes.today);
        setEvents(overviewRes.events);
        setPagination(overviewRes.pagination);
        setDailySummaries(summaryRes.dailySummaries);
      } catch (err: any) {
        console.error('Error fetching biometric data:', err);
        setError(err.message || 'Unable to load biometric records.');
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [pagination.page, pagination.limit, dateRange, eventTypeFilter, verificationFilter]
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Real-time SSE listener
   */
  useEffect(() => {
    const unsubscribe = apiService.subscribeToBiometricEvents((event) => {
      const typeLabel = event.eventType === 'ENTRY' ? 'Entry' : 'Exit';
      const gateLabel = event.gate || 'Gate';
      setRealtimeToast(`New Biometric ${typeLabel} recorded at ${gateLabel} (${event.status || 'Verified'})`);
      fetchData(true);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchData]);

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '--:--';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '--:--';
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  const formatFullDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}`;
    } catch {
      return '';
    }
  };

  return (
    <div className="student-portal-page biometric-page">
      {/* Toast Alert */}
      {realtimeToast && (
        <div className="feedback-banner success" role="alert">
          <div className="feedback-content">
            <CheckCircle2 size={18} className="feedback-icon" />
            <span>{realtimeToast}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setRealtimeToast(null)}
            aria-label="Dismiss message"
          >
            &times;
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="student-page-header">
        <div className="student-page-header-text">
          <div className="student-page-title">
            <Fingerprint size={26} className="text-primary-navy" />
            <span>Biometric Tracking</span>
          </div>
          <p className="student-page-subtitle">
            Server-authoritative, real-time physical access logs from hostel turnstiles and security gates.
          </p>
        </div>

        <div className="student-header-actions">
          <button
            type="button"
            onClick={() => fetchData(true)}
            disabled={loading || isRefreshing}
            className="student-btn-secondary"
            aria-label="Refresh biometric records"
            title="Refresh biometric records"
          >
            <RotateCw size={16} className={isRefreshing ? 'spin-icon' : ''} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync'}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="student-error-state" role="alert">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => fetchData()}
              className="student-btn-secondary"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Today's Status Banner Card */}
      <div className="biometric-hero-banner">
        <div className="biometric-hero-top">
          <div>
            <div className="student-metric-label" style={{ marginBottom: '6px' }}>
              Today's Presence State
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {todayStatus?.status === 'INSIDE_HOSTEL' && (
                <span className="biometric-presence-badge inside">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }} />
                  Present / Inside Hostel
                </span>
              )}

              {todayStatus?.status === 'OUTSIDE_HOSTEL' && (
                <span className="biometric-presence-badge outside">
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f59e0b', display: 'inline-block' }} />
                  Outside Hostel
                </span>
              )}

              {todayStatus?.status === 'NO_RECORD' && (
                <span className="student-status-badge neutral">
                  No Record Today
                </span>
              )}

              {todayStatus?.latestEvent && (
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                  Last verified {todayStatus.latestEvent.eventType === 'ENTRY' ? 'entry' : 'exit'} at{' '}
                  <strong>{formatTime(todayStatus.latestEvent.eventTimestamp)}</strong> via {todayStatus.latestEvent.gate || 'Main Gate'}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#059669', fontSize: '0.85rem', fontWeight: 600 }}>
            <ShieldCheck size={18} />
            <span>Immutable Device Log</span>
          </div>
        </div>

        {/* 5-Column Stats Grid */}
        <div className="biometric-stats-grid">
          <div className="biometric-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogIn size={15} color="#10b981" />
              <span>First Entry</span>
            </div>
            <div className="biometric-stat-val">
              {todayStatus?.firstEntry ? formatTime(todayStatus.firstEntry.toString()) : '--:--'}
            </div>
          </div>

          <div className="biometric-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogOut size={15} color="#f59e0b" />
              <span>Last Exit</span>
            </div>
            <div className="biometric-stat-val">
              {todayStatus?.lastExit ? formatTime(todayStatus.lastExit.toString()) : '--:--'}
            </div>
          </div>

          <div className="biometric-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <Fingerprint size={15} color="#3b82f6" />
              <span>Entries Today</span>
            </div>
            <div className="biometric-stat-val">
              {todayStatus?.entryCount ?? 0}
            </div>
          </div>

          <div className="biometric-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <LogOut size={15} color="#8b5cf6" />
              <span>Exits Today</span>
            </div>
            <div className="biometric-stat-val">
              {todayStatus?.exitCount ?? 0}
            </div>
          </div>

          <div className="biometric-stat-box">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '0.8rem', fontWeight: 500, marginBottom: '4px' }}>
              <Clock size={15} color="#059669" />
              <span>Time Inside</span>
            </div>
            <div className="biometric-stat-val">
              {todayStatus?.approximateHoursInside ? `${todayStatus.approximateHoursInside} hrs` : '0 hrs'}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs & Filters Navigation */}
      <div className="student-filter-bar">
        {/* View Switcher */}
        <div style={{ display: 'flex', gap: '6px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`student-btn-secondary ${activeTab === 'timeline' ? 'active' : ''}`}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'timeline' ? '#fff' : 'transparent',
              color: activeTab === 'timeline' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'timeline' ? 700 : 500,
              boxShadow: activeTab === 'timeline' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Recent Activity & Timeline
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('daily')}
            className={`student-btn-secondary ${activeTab === 'daily' ? 'active' : ''}`}
            style={{
              padding: '6px 16px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: activeTab === 'daily' ? '#fff' : 'transparent',
              color: activeTab === 'daily' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'daily' ? 700 : 500,
              boxShadow: activeTab === 'daily' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Daily Attendance Summary
          </button>
        </div>

        {/* Filter Controls (Timeline Tab Only) */}
        {activeTab === 'timeline' && (
          <div className="student-select-group">
            {/* Date Range Filter */}
            <select
              value={dateRange}
              onChange={(e) => {
                setDateRange(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="student-select"
            >
              <option value="ALL">All Time</option>
              <option value="TODAY">Today Only</option>
              <option value="LAST_7_DAYS">Last 7 Days</option>
              <option value="LAST_30_DAYS">Last 30 Days</option>
            </select>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="student-select"
            >
              <option value="ALL">All Events</option>
              <option value="ENTRY">Entries Only</option>
              <option value="EXIT">Exits Only</option>
            </select>

            {/* Verification Status */}
            <select
              value={verificationFilter}
              onChange={(e) => {
                setVerificationFilter(e.target.value);
                setPagination((prev) => ({ ...prev, page: 1 }));
              }}
              className="student-select"
            >
              <option value="ALL">All Results</option>
              <option value="VERIFIED">Verified Scans</option>
              <option value="REJECTED">Rejected Attempts</option>
            </select>
          </div>
        )}
      </div>

      {/* TAB CONTENT 1: Timeline & Event List */}
      {activeTab === 'timeline' && (
        <div>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    height: '75px',
                    backgroundColor: '#f1f5f9',
                    borderRadius: '10px',
                    animation: 'pulse 1.5s infinite',
                  }}
                />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div
              style={{
                backgroundColor: '#fff',
                border: '1px dashed #cbd5e1',
                borderRadius: '12px',
                padding: '3rem 2rem',
                textAlign: 'center',
              }}
            >
              <Fingerprint size={48} color="#94a3b8" style={{ margin: '0 auto 1rem auto' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#334155', margin: '0 0 6px 0' }}>
                No Biometric Records Found
              </h3>
              <p style={{ color: '#64748b', fontSize: '0.9rem', margin: 0 }}>
                No entry or exit events were recorded for the selected filter criteria.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {events.map((ev) => {
                const isEntry = ev.eventType === 'ENTRY';
                const isVerified = ev.verificationStatus === 'VERIFIED';

                return (
                  <div
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    style={{
                      backgroundColor: '#fff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      padding: '14px 18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    {/* Left: Direction Icon + Event Title & Gate */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: !isVerified
                            ? '#fef2f2'
                            : isEntry
                            ? '#ecfdf5'
                            : '#eff6ff',
                          color: !isVerified
                            ? '#ef4444'
                            : isEntry
                            ? '#10b981'
                            : '#3b82f6',
                        }}
                      >
                        {!isVerified ? (
                          <XCircle size={22} />
                        ) : isEntry ? (
                          <LogIn size={22} />
                        ) : (
                          <LogOut size={22} />
                        )}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                            {isEntry ? 'Hostel Gate Entry' : 'Hostel Gate Exit'}
                          </span>

                          <span
                            style={{
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: isVerified ? '#ecfdf5' : '#fef2f2',
                              color: isVerified ? '#065f46' : '#991b1b',
                            }}
                          >
                            {isVerified ? 'VERIFIED' : 'REJECTED'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', color: '#64748b' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MapPin size={13} />
                            {ev.gate || 'Main Gate'}
                          </span>
                          <span>•</span>
                          <span>{ev.deviceLabel || ev.deviceId || 'Turnstile Device'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Timestamp & Action */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: '#0f172a' }}>
                          {formatTime(ev.eventTimestamp)}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          {formatDate(ev.eventTimestamp)}
                        </div>
                      </div>

                      <ChevronRight size={18} color="#94a3b8" />
                    </div>
                  </div>
                );
              })}

              {/* Pagination controls */}
              {pagination.totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 0',
                    marginTop: '0.5rem',
                  }}
                >
                  <span style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total events)
                  </span>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={pagination.page <= 1}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                        color: pagination.page <= 1 ? '#94a3b8' : '#334155',
                        fontSize: '0.85rem',
                      }}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        backgroundColor: '#fff',
                        cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                        color: pagination.page >= pagination.totalPages ? '#94a3b8' : '#334155',
                        fontSize: '0.85rem',
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT 2: Daily Attendance Summary */}
      {activeTab === 'daily' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {dailySummaries.map((day) => {
            const isInside = day.status === 'INSIDE_HOSTEL';
            const hasRecord = day.status !== 'NO_RECORD';

            return (
              <div
                key={day.date}
                style={{
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  padding: '16px 20px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                    <Calendar size={18} color="#6366f1" />
                    <span style={{ fontWeight: 600, fontSize: '1rem', color: '#0f172a' }}>
                      {formatDate(day.date)}
                    </span>

                    {hasRecord ? (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: isInside ? '#ecfdf5' : '#fffbeb',
                          color: isInside ? '#065f46' : '#92400e',
                        }}
                      >
                        {isInside ? 'INSIDE HOSTEL' : 'OUTSIDE'}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                        }}
                      >
                        NO SCANS
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.85rem', color: '#64748b' }}>
                    <span>First In: <strong>{formatTime(day.firstEntry)}</strong></span>
                    <span>•</span>
                    <span>Last Out: <strong>{formatTime(day.lastExit)}</strong></span>
                    <span>•</span>
                    <span>Total Scans: <strong>{day.totalEvents}</strong></span>
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '2px' }}>
                    Hours Inside Hostel
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>
                    {day.approximateHoursInside} hrs
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* EVENT DETAILS MODAL */}
      {selectedEvent && (
        <div
          role="dialog"
          aria-modal="true"
          className="student-modal-overlay"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="student-modal-box"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="student-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Fingerprint size={22} color={selectedEvent.verificationStatus === 'VERIFIED' ? '#2563eb' : '#ef4444'} />
                <h3 className="student-modal-title">
                  Biometric Scan Details
                </h3>
              </div>

              <button
                type="button"
                className="student-modal-close-btn"
                onClick={() => setSelectedEvent(null)}
                aria-label="Close modal"
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div className="student-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Scan Result</span>
                <span className={`student-status-badge ${selectedEvent.verificationStatus === 'VERIFIED' ? 'success' : 'danger'}`}>
                  {selectedEvent.verificationStatus === 'VERIFIED' ? (
                    <>
                      <CheckCircle2 size={15} /> VERIFIED SUCCESSFUL
                    </>
                  ) : (
                    <>
                      <XCircle size={15} /> REJECTED / ACCESS DENIED
                    </>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Event Type & Direction</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.eventType} ({selectedEvent.direction === 'IN' ? 'Inward Ingress' : 'Outward Egress'})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Date & Timestamp</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {formatFullDateTime(selectedEvent.eventTimestamp)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Gate Location</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.gate || 'Main Gate'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Device / Scanner</span>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#0f172a' }}>
                  {selectedEvent.deviceLabel || selectedEvent.deviceId || 'Turnstile Scanner #1'}
                </span>
              </div>

              {selectedEvent.rejectionReason && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <span style={{ fontSize: '0.85rem', color: '#ef4444' }}>Rejection Reason</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#b91c1c' }}>
                    {selectedEvent.rejectionReason}
                  </span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Verification Source</span>
                <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                  {selectedEvent.source || 'PHYSICAL_BIOMETRIC_DEVICE'}
                </span>
              </div>

              {/* Security & Privacy Notice */}
              <div
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '12px 14px',
                  fontSize: '0.78rem',
                  color: '#64748b',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                }}
              >
                <Info size={16} color="#6366f1" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>
                  This is an immutable physical gate scan logged by the server. Raw biometric patterns and templates are never retained or transmitted.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="student-modal-footer">
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="student-btn-secondary"
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
