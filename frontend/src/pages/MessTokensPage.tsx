import React, { useState, useEffect, useCallback } from 'react';
import {
  UtensilsCrossed,
  Coffee,
  Sun,
  Cookie,
  Moon,
  CheckCircle2,
  Clock,
  QrCode,
  Calendar,
  AlertCircle,
  RefreshCw,
  Ticket,
  X,
  FileEdit,
  Lock,
  Check,
  Slash,
  Info,
} from 'lucide-react';
import {
  apiService,
  MessTokensData,
  MessMealSlot,
  MessTokenHistoryItem,
  HorizonDateItem,
} from '../services/api';
import {
  StaticMessQrModal,
  STATIC_MESS_QR_PAYLOAD,
  STATIC_MESS_ENTRY_POINT,
} from '../components/StaticMessQr';

export const MessTokensPage: React.FC = () => {
  const [data, setData] = useState<MessTokensData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Static Mess QR State (Step 7)
  const [qrModalOpen, setQrModalOpen] = useState<boolean>(false);
  const [qrPayload, setQrPayload] = useState<string>(STATIC_MESS_QR_PAYLOAD);
  const [qrEntryPoint, setQrEntryPoint] = useState<string>(STATIC_MESS_ENTRY_POINT);

  // Selected date state (defaults to today's ISO date string)
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Fetch static QR configuration once on mount
  useEffect(() => {
    apiService
      .getMessQrConfig()
      .then((cfg) => {
        if (cfg.payload) setQrPayload(cfg.payload);
        if (cfg.entryPoint) setQrEntryPoint(cfg.entryPoint);
      })
      .catch(() => {});
  }, []);

  // Modal / Booking intent state
  const [activeModalSlot, setActiveModalSlot] = useState<MessMealSlot | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<'ATTENDING' | 'SKIPPED'>('ATTENDING');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);

  // Fetch authoritative state for selectedDate
  const fetchMessTokens = useCallback(async (dateTarget?: string, isSilentRefresh = false) => {
    const queryDate = dateTarget || selectedDate;
    if (isSilentRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await apiService.getMessTokensData(queryDate);
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Unable to load mess token information.');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedDate]);

  // Initial fetch and on selectedDate change
  useEffect(() => {
    fetchMessTokens(selectedDate);
  }, [selectedDate, fetchMessTokens]);

  // Unified Student SSE Real-time Subscription
  useEffect(() => {
    const unsubscribe = apiService.subscribeToMessEvents((_event: any) => {
      // Re-fetch authoritative mess state from PostgreSQL on any mess event
      fetchMessTokens(selectedDate, true);
    });

    return () => {
      unsubscribe();
    };
  }, [fetchMessTokens, selectedDate]);

  // Open booking modal for a meal slot
  const handleOpenBookingModal = (slot: MessMealSlot) => {
    setModalError(null);
    setActiveModalSlot(slot);

    // Pre-populate existing intent if draft or booked/skipped
    if (slot.attendanceIntent) {
      setSelectedIntent(slot.attendanceIntent);
    } else if (slot.draft?.attendanceIntent) {
      setSelectedIntent(slot.draft.attendanceIntent);
    } else if (slot.status === 'SKIPPED') {
      setSelectedIntent('SKIPPED');
    } else {
      setSelectedIntent('ATTENDING');
    }
  };

  const handleCloseModal = () => {
    if (isSubmitting) return;
    setActiveModalSlot(null);
    setModalError(null);
  };

  // Action: Save Draft
  const handleSaveDraft = async () => {
    if (!activeModalSlot || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    setActionError(null);

    try {
      const res = await apiService.saveMessDraft(
        activeModalSlot.mealType,
        selectedDate,
        selectedIntent
      );
      setActionSuccess(res.message || 'Draft saved successfully.');
      setActiveModalSlot(null);
      await fetchMessTokens(selectedDate, true);
    } catch (err: any) {
      setModalError(err.message || 'Failed to save draft intent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Action: Submit & Lock Indent
  const handleLockIndent = async () => {
    if (!activeModalSlot || isSubmitting) return;
    setIsSubmitting(true);
    setModalError(null);
    setActionError(null);

    try {
      const res = await apiService.lockMessIndent(
        activeModalSlot.mealType,
        selectedDate,
        selectedIntent
      );
      setActionSuccess(res.message || 'Meal indent submitted and locked.');
      setActiveModalSlot(null);
      await fetchMessTokens(selectedDate, true);
    } catch (err: any) {
      setModalError(err.message || 'Failed to lock meal indent.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMealIcon = (mealType: string) => {
    switch (mealType) {
      case 'BREAKFAST':
        return <Coffee size={22} className="meal-icon breakfast" />;
      case 'LUNCH':
        return <Sun size={22} className="meal-icon lunch" />;
      case 'SNACKS':
        return <Cookie size={22} className="meal-icon snacks" />;
      case 'DINNER':
        return <Moon size={22} className="meal-icon dinner" />;
      default:
        return <UtensilsCrossed size={22} className="meal-icon default" />;
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(`${dateStr}T12:00:00Z`);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  // 1. Error State
  if (error && !loading) {
    return (
      <div className="room-state-container" role="alert">
        <div className="state-card error-state">
          <div className="state-icon-circle error">
            <AlertCircle size={32} />
          </div>
          <h2 className="state-title">Unable to load mess tokens</h2>
          <p className="state-desc">{error}</p>
          <button
            type="button"
            onClick={() => fetchMessTokens(selectedDate)}
            className="btn-retry"
          >
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading && !data) {
    return (
      <div className="mess-page-content" aria-busy="true">
        <div className="skeleton skeleton-welcome" style={{ height: '140px' }} />
        <div className="skeleton skeleton-welcome" style={{ height: '90px' }} />
        <div className="mess-slots-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '260px' }} />
          ))}
        </div>
        <div className="skeleton skeleton-feed" style={{ height: '240px' }} />
      </div>
    );
  }

  const selectedDayData = data?.selectedDate || data?.today;
  const summary = selectedDayData?.summary;
  const mealSlots = selectedDayData?.mealSlots || [];
  const history = data?.history || [];
  const horizonDates = data?.horizon?.dates || [];
  const isSelectedDateToday = selectedDate === new Date().toISOString().split('T')[0];

  return (
    <div className="mess-page-content">
      {/* Toast / Feedback Notifications */}
      {actionSuccess && (
        <div className="feedback-banner success" role="status">
          <div className="feedback-content">
            <CheckCircle2 size={20} className="feedback-icon" />
            <span>{actionSuccess}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionSuccess(null)}
            aria-label="Dismiss message"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {actionError && (
        <div className="feedback-banner error" role="alert">
          <div className="feedback-content">
            <AlertCircle size={20} className="feedback-icon" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            className="feedback-dismiss-btn"
            onClick={() => setActionError(null)}
            aria-label="Dismiss error"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Page Title & Refresh Control */}
      <div className="mess-page-header" style={{ backgroundColor: '#151B54', color: 'white', padding: '1.5rem 1.75rem', borderRadius: '14px', marginBottom: '1.25rem', boxShadow: '0 10px 25px -5px rgba(21, 27, 84, 0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="mess-page-title" style={{ color: 'white', fontSize: '1.6rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Hostel Mess Tokens & Meal Indents</h1>
          <p className="mess-page-subtitle" style={{ color: '#94A3B8', fontSize: '0.875rem', marginTop: '0.35rem', margin: 0 }}>
            Plan multi-day hostel meal indents, place attendance choices, and manage active digital dining passes.
          </p>
        </div>
        <button
          type="button"
          className={`refresh-tokens-btn ${isRefreshing ? 'spinning' : ''}`}
          onClick={() => fetchMessTokens(selectedDate, true)}
          disabled={isRefreshing}
          aria-label="Refresh mess tokens"
          title="Refresh mess tokens"
          style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '0.55rem 1rem', borderRadius: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer' }}
        >
          <RefreshCw size={15} />
          <span>{isRefreshing ? 'Syncing...' : 'Refresh Tokens'}</span>
        </button>
      </div>

      {/* Booking Deadline Guidance Banner */}
      <section className="mess-rules-card" aria-label="Booking Guidelines" style={{ backgroundColor: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: '12px', padding: '1rem 1.25rem', display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1.25rem' }}>
        <div className="rules-icon-wrap" style={{ backgroundColor: '#151B54', color: 'white', width: '36px', height: '36px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Info size={20} />
        </div>
        <div className="rules-body">
          <h3 className="rules-title" style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#151B54' }}>Daily Meal Indent & Cutoff Guidelines</h3>
          <p className="rules-desc" style={{ margin: '0.35rem 0 0', fontSize: '0.825rem', color: '#334155', lineHeight: 1.5 }}>
            To prevent food wastage, please select your meal intent prior to cutoff times:
            <strong> Breakfast</strong> (07:00 AM) ·
            <strong> Lunch</strong> (10:00 AM) ·
            <strong> Evening Snacks</strong> (03:00 PM) ·
            <strong> Dinner</strong> (05:30 PM).
            Select <strong>[✓ Attending]</strong> or <strong>[✗ Skipping]</strong> for each meal slot.
          </p>
        </div>
      </section>

      {/* Multi-Day Planning Date Selector Ribbon */}
      <section className="mess-section" aria-label="Meal Date Selection" style={{ marginBottom: '1.25rem' }}>
        <div className="section-title-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={18} style={{ color: '#151B54' }} />
            <h2 className="mess-section-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#151B54' }}>Meal Planning Horizon</h2>
          </div>
          <span className="section-badge highlight" style={{ backgroundColor: '#151B54', color: 'white', fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
            7-Day Booking Window
          </span>
        </div>

        <div className="mess-date-ribbon" role="tablist" aria-label="Planning dates" style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {horizonDates.map((item: HorizonDateItem) => {
            const isSelected = item.date === selectedDate;
            return (
              <button
                key={item.date}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`date-ribbon-card ${isSelected ? 'active' : ''} ${item.isToday ? 'is-today' : ''}`}
                onClick={() => setSelectedDate(item.date)}
                style={{
                  minWidth: '100px',
                  padding: '0.85rem 0.75rem',
                  borderRadius: '12px',
                  border: isSelected ? '2px solid #151B54' : '1px solid #E2E8F0',
                  backgroundColor: isSelected ? '#151B54' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : '#0F172A',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.2rem',
                  boxShadow: isSelected ? '0 4px 12px rgba(21, 27, 84, 0.2)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <div className="date-card-top" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 700, opacity: isSelected ? 0.9 : 0.6 }}>
                  <span className="day-name">{item.dayName}</span>
                  {item.isToday && <span style={{ backgroundColor: isSelected ? '#38BDF8' : '#EEF2FF', color: isSelected ? '#151B54' : '#151B54', padding: '0.05rem 0.35rem', borderRadius: '4px', fontSize: '0.65rem' }}>Today</span>}
                </div>
                <div className="day-number" style={{ fontSize: '1.4rem', fontWeight: 800 }}>{item.dayNumber}</div>
                <div className="month-name" style={{ fontSize: '0.725rem', fontWeight: 600, opacity: isSelected ? 0.8 : 0.6 }}>{item.monthName}</div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Date Summary Banner */}
      <section className="mess-summary-banner" aria-label="Selected Date Summary" style={{ backgroundColor: '#151B54', color: 'white', padding: '1.25rem 1.5rem', borderRadius: '14px', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
        <div className="summary-banner-left">
          <div className="summary-date-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', backgroundColor: 'rgba(255,255,255,0.12)', padding: '0.25rem 0.65rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, color: '#38BDF8' }}>
            <Calendar size={15} />
            <span>{selectedDayData?.formattedDate || selectedDate}</span>
            {isSelectedDateToday && <span style={{ color: '#A7F3D0' }}>· Today</span>}
          </div>
          <h2 className="summary-main-stat" style={{ margin: '0.5rem 0 0.15rem', fontSize: '1.6rem', fontWeight: 800, color: 'white' }}>
            {summary?.bookedCount || 0} Booked · {summary?.skippedCount || 0} Skipped
          </h2>
          <p className="summary-subtext" style={{ margin: 0, fontSize: '0.825rem', color: '#94A3B8' }}>
            {summary?.remainingCount === 0
              ? 'All daily meal indents have been finalized for this date.'
              : `${summary?.remainingCount} meal${
                  summary?.remainingCount === 1 ? '' : 's'
                } remaining available for planning.`}
          </p>
        </div>

        <div className="summary-banner-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div className="summary-pill-group" style={{ display: 'flex', gap: '0.75rem' }}>
            <div className="summary-stat-box" style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <span className="stat-number" style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800, color: '#10B981' }}>{summary?.bookedCount || 0}</span>
              <span className="stat-label" style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Booked</span>
            </div>
            <div className="summary-stat-box" style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <span className="stat-number" style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800, color: '#EF4444' }}>{summary?.skippedCount || 0}</span>
              <span className="stat-label" style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Skipped</span>
            </div>
            <div className="summary-stat-box" style={{ backgroundColor: 'rgba(255,255,255,0.08)', padding: '0.5rem 0.85rem', borderRadius: '8px', textAlign: 'center' }}>
              <span className="stat-number" style={{ display: 'block', fontSize: '1.25rem', fontWeight: 800, color: '#F59E0B' }}>{summary?.draftCount || 0}</span>
              <span className="stat-label" style={{ fontSize: '0.7rem', color: '#94A3B8', fontWeight: 600 }}>Drafts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Daily Meal Slots Booking Section */}
      <section className="mess-section" aria-labelledby="meal-slots-heading">
        <div className="section-title-group">
          <h2 id="meal-slots-heading" className="mess-section-title">
            Meal Indents for {selectedDayData?.formattedDate}
          </h2>
          <span className="section-badge">Authoritative State Machine</span>
        </div>

        <div className="mess-slots-grid">
          {mealSlots.map((slot: MessMealSlot) => {
            const isBooked = slot.status === 'BOOKED' || slot.status === 'USED';
            const isSkipped = slot.status === 'SKIPPED';
            const isDraft = slot.status === 'DRAFT';
            const isClosed = slot.status === 'CLOSED';

            return (
              <div
                key={slot.mealType}
                className={`meal-slot-card ${
                  isBooked
                    ? 'card-booked'
                    : isSkipped
                    ? 'card-skipped'
                    : isDraft
                    ? 'card-draft'
                    : isClosed
                    ? 'card-closed'
                    : 'card-available'
                }`}
              >
                <div className="meal-card-top">
                  <div className="meal-icon-box">{getMealIcon(slot.mealType)}</div>
                  <div
                    className={`meal-status-badge ${
                      isBooked
                        ? 'badge-booked'
                        : isSkipped
                        ? 'badge-skipped'
                        : isDraft
                        ? 'badge-draft'
                        : slot.status === 'AVAILABLE'
                        ? 'badge-available'
                        : 'badge-closed'
                    }`}
                  >
                    {isBooked ? (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Booked & Locked</span>
                      </>
                    ) : isSkipped ? (
                      <>
                        <Slash size={13} />
                        <span>Meal Skipped</span>
                      </>
                    ) : isDraft ? (
                      <>
                        <FileEdit size={13} />
                        <span>Draft Saved</span>
                      </>
                    ) : slot.status === 'AVAILABLE' ? (
                      <>
                        <Clock size={13} />
                        <span>Available</span>
                      </>
                    ) : (
                      <>
                        <Lock size={13} />
                        <span>Booking Closed</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="meal-card-body">
                  <h3 className="meal-name">{slot.name}</h3>
                  <div className="meal-timing">
                    <Clock size={14} />
                    <span>{slot.timing}</span>
                  </div>
                  <p className="meal-desc">{slot.description}</p>

                  {/* Deadline Notice Chip */}
                  <div className="meal-deadline-chip">
                    <Clock size={12} className="deadline-icon" />
                    <span>Cutoff: {slot.deadlineFormatted || 'Check Schedule'}</span>
                  </div>

                  {/* Indent Status Display (Phase 2) */}
                  <div
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.55rem 0.75rem',
                      borderRadius: '8px',
                      backgroundColor: slot.indent?.status === 'MARKED' || isBooked ? '#ECFDF5' : '#F8FAFC',
                      border: `1px solid ${slot.indent?.status === 'MARKED' || isBooked ? '#A7F3D0' : '#E2E8F0'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span
                        style={{
                          fontSize: '0.825rem',
                          fontWeight: 600,
                          color: slot.indent?.status === 'MARKED' || isBooked ? '#065F46' : '#64748B',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                        }}
                      >
                        {slot.indent?.status === 'MARKED' || isBooked ? (
                          <>
                            <CheckCircle2 size={14} style={{ color: '#059669' }} />
                            <span>[✓ Indent Marked]</span>
                          </>
                        ) : (
                          <>
                            <Slash size={14} style={{ color: '#94A3B8' }} />
                            <span>[✗ Indent Not Marked]</span>
                          </>
                        )}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#64748B', fontWeight: 500 }}>
                        Date: {selectedDate}
                      </span>
                    </div>
                    {(slot.indent?.markedAt || slot.token?.createdAt) && (slot.indent?.status === 'MARKED' || isBooked) && (
                      <span style={{ fontSize: '0.75rem', color: '#047857' }}>
                        Marked at: {formatDateTime(slot.indent?.markedAt || slot.token?.createdAt)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="meal-card-footer">
                  {isBooked ? (
                    <div className="booked-token-indicator">
                      <div className="booked-token-meta">
                        <Ticket size={15} />
                        <span className="token-ref">
                          Ref: {slot.token?.tokenNumber || 'VERIFIED-PASS'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-token-qr"
                        onClick={() => setQrModalOpen(true)}
                        title="View Mess Verification QR for this token"
                        aria-label={`View Mess Verification QR for ${slot.name}`}
                      >
                        <QrCode size={13} />
                        <span>Token QR</span>
                      </button>
                    </div>
                  ) : isSkipped ? (
                    <div className="skipped-token-indicator">
                      <Slash size={15} />
                      <span>Indent Finalized: Skipped</span>
                    </div>
                  ) : isClosed ? (
                    <div className="closed-token-indicator">
                      <Lock size={14} />
                      <span>Cutoff Passed · Closed</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={`btn-book-token ${isDraft ? 'btn-draft-action' : ''}`}
                      onClick={() => handleOpenBookingModal(slot)}
                      aria-label={`Configure indent for ${slot.name}`}
                    >
                      {isDraft ? (
                        <>
                          <FileEdit size={16} />
                          <span>Update / Lock Indent</span>
                        </>
                      ) : (
                        <>
                          <Ticket size={16} />
                          <span>Configure Indent</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Indent & Token Booking History Section */}
      <section className="mess-section" aria-labelledby="token-history-heading">
        <div className="section-title-group">
          <h2 id="token-history-heading" className="mess-section-title">
            Token & Indent History
          </h2>
          <span className="section-badge">Authoritative Audit Trail</span>
        </div>

        {history.length === 0 ? (
          <div className="empty-history-card">
            <Ticket size={40} className="empty-history-icon" />
            <h3 className="empty-history-title">No token history yet</h3>
            <p className="empty-history-desc">
              When you book meal tokens or submit indents, your complete verification records and booking history will appear here.
            </p>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="mess-history-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Meal Type</th>
                  <th scope="col">Token Reference</th>
                  <th scope="col">Timing</th>
                  <th scope="col">Recorded At</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item: MessTokenHistoryItem) => (
                  <tr key={item.id}>
                    <td className="font-medium text-slate-800">
                      {formatDateOnly(item.date)}
                    </td>
                    <td>
                      <div className="history-meal-cell">
                        {getMealIcon(item.mealType)}
                        <span className="font-semibold">{item.mealName}</span>
                      </div>
                    </td>
                    <td>
                      <span className="history-token-pill">
                        {item.tokenNumber || (item.status === 'SKIPPED' ? 'SKIPPED-INDENT' : 'DRAFT')}
                      </span>
                    </td>
                    <td className="text-slate-600 text-sm">{item.timing}</td>
                    <td className="text-slate-500 text-sm">
                      {formatDateTime(item.createdAt)}
                    </td>
                    <td>
                      <span
                        className={`history-status-badge ${
                          item.status === 'BOOKED'
                            ? 'badge-success'
                            : item.status === 'CONSUMED'
                            ? 'badge-neutral'
                            : item.status === 'SKIPPED'
                            ? 'badge-warning'
                            : 'badge-default'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Meal Indent Booking Modal (Reference Flow) */}
      {activeModalSlot && (
        <div className="meal-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-meal-title">
          <div className="meal-modal-container">
            {/* Modal Header */}
            <div className="modal-meal-header">
              <div className="flex items-center gap-3">
                <div className="modal-meal-icon">{getMealIcon(activeModalSlot.mealType)}</div>
                <div>
                  <h3 id="modal-meal-title" className="modal-meal-name">
                    {activeModalSlot.name} Indent
                  </h3>
                  <p className="modal-meal-timing">
                    {selectedDayData?.formattedDate} · {activeModalSlot.timing}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={handleCloseModal}
                disabled={isSubmitting}
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Feedback */}
            {modalError && (
              <div className="modal-error-banner" role="alert">
                <AlertCircle size={18} />
                <span>{modalError}</span>
              </div>
            )}

            {/* Attendance Question & Choice Cards */}
            <div className="modal-body-section">
              <label className="choice-question-label">
                Are you planning to attend?
              </label>

              <div className="attendance-choices-grid">
                {/* Option 1: Yes, I'll attend */}
                <div
                  className={`attendance-choice-card ${selectedIntent === 'ATTENDING' ? 'selected' : ''}`}
                  onClick={() => setSelectedIntent('ATTENDING')}
                  role="radio"
                  aria-checked={selectedIntent === 'ATTENDING'}
                  tabIndex={0}
                >
                  <div className="choice-radio-indicator">
                    {selectedIntent === 'ATTENDING' && <Check size={14} />}
                  </div>
                  <div className="choice-content">
                    <div className="choice-title-row">
                      <span className="choice-title">Yes, I'll attend</span>
                      <span className="choice-tag-attend">Dining Hall Pass</span>
                    </div>
                    <p className="choice-desc">
                      A digital meal pass will be generated upon locking. Please present it at the mess service counter during meal hours.
                    </p>
                  </div>
                </div>

                {/* Option 2: No, Skip meal */}
                <div
                  className={`attendance-choice-card ${selectedIntent === 'SKIPPED' ? 'selected' : ''}`}
                  onClick={() => setSelectedIntent('SKIPPED')}
                  role="radio"
                  aria-checked={selectedIntent === 'SKIPPED'}
                  tabIndex={0}
                >
                  <div className="choice-radio-indicator">
                    {selectedIntent === 'SKIPPED' && <Check size={14} />}
                  </div>
                  <div className="choice-content">
                    <div className="choice-title-row">
                      <span className="choice-title">No, Skip meal</span>
                      <span className="choice-tag-skip">Food Waste Prevention</span>
                    </div>
                    <p className="choice-desc">
                      You will not receive a meal token for this slot. Notifying the kitchen helps prevent residential food waste.
                    </p>
                  </div>
                </div>
              </div>

              {/* Deadline reminder notice */}
              <div className="modal-deadline-notice">
                <Clock size={15} />
                <span>Authoritative Cutoff: <strong>{activeModalSlot.deadlineFormatted}</strong></span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="modal-footer-actions">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <div className="modal-primary-buttons">
                <button
                  type="button"
                  className="btn-modal-draft"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  <FileEdit size={16} />
                  <span>{isSubmitting ? 'Saving...' : 'Save Draft'}</span>
                </button>

                <button
                  type="button"
                  className="btn-modal-lock"
                  onClick={handleLockIndent}
                  disabled={isSubmitting}
                >
                  <Lock size={16} />
                  <span>{isSubmitting ? 'Locking...' : 'Submit & Lock Indent'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Permanent Static Mess QR Modal (Step 7) */}
      {qrModalOpen && (
        <StaticMessQrModal
          payload={qrPayload}
          entryPoint={qrEntryPoint}
          onClose={() => setQrModalOpen(false)}
        />
      )}
    </div>
  );
};

export default MessTokensPage;
