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
  ShieldCheck,
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
  ActiveMessToken,
  MessTokenHistoryItem,
  HorizonDateItem,
} from '../services/api';
import QRCode from 'qrcode';
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
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

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

  // Generate deterministic QR data URL locally for embedded token passes
  useEffect(() => {
    let isMounted = true;
    QRCode.toDataURL(qrPayload, {
      width: 200,
      margin: 1,
      color: { dark: '#0F172A', light: '#FFFFFF' },
    })
      .then((url) => {
        if (isMounted) setQrDataUrl(url);
      })
      .catch((err) => console.error('Error generating token QR:', err));

    return () => {
      isMounted = false;
    };
  }, [qrPayload]);

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
  const activePasses = data?.today?.activeTokensToday || [];
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
      <div className="mess-page-header">
        <div>
          <h1 className="mess-page-title">Mess Tokens</h1>
          <p className="mess-page-subtitle">
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
        >
          <RefreshCw size={16} />
          <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* Booking Deadline Guidance Banner */}
      <section className="mess-rules-card" aria-label="Booking Guidelines">
        <div className="rules-icon-wrap">
          <Info size={22} className="rules-info-icon" />
        </div>
        <div className="rules-body">
          <h3 className="rules-title">Daily Meal Indent & Booking Cutoff Guidelines</h3>
          <p className="rules-desc">
            To ensure zero food waste and hot dining service, meals must be indented prior to cutoff times:
            <strong> Breakfast</strong> by 07:00 AM ·
            <strong> Lunch</strong> by 10:00 AM ·
            <strong> Evening Snacks</strong> by 03:00 PM ·
            <strong> Dinner</strong> by 05:30 PM.
            You can <strong>Save Draft</strong> anytime to prepare your intent, or <strong>Submit & Lock Indent</strong> to finalize your token.
          </p>
        </div>
      </section>

      {/* Multi-Day Planning Date Selector Ribbon */}
      <section className="mess-section" aria-label="Meal Date Selection">
        <div className="section-title-group">
          <div className="flex items-center gap-2">
            <Calendar size={18} className="text-primary" />
            <h2 className="mess-section-title">Meal Planning Horizon</h2>
          </div>
          <span className="section-badge highlight">
            7-Day Booking Window
          </span>
        </div>

        <div className="mess-date-ribbon" role="tablist" aria-label="Planning dates">
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
              >
                <div className="date-card-top">
                  <span className="day-name">{item.dayName}</span>
                  {item.isToday && <span className="today-badge">Today</span>}
                </div>
                <div className="day-number">{item.dayNumber}</div>
                <div className="month-name">{item.monthName}</div>
                {isSelected && <div className="active-pill-dot" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* Selected Date Summary Banner */}
      <section className="mess-summary-banner" aria-label="Selected Date Summary">
        <div className="summary-banner-left">
          <div className="summary-date-badge">
            <Calendar size={18} />
            <span>{selectedDayData?.formattedDate || selectedDate}</span>
            {isSelectedDateToday && <span className="badge-today-chip">· Today</span>}
          </div>
          <h2 className="summary-main-stat">
            {summary?.bookedCount || 0} Booked · {summary?.skippedCount || 0} Skipped
          </h2>
          <p className="summary-subtext">
            {summary?.remainingCount === 0
              ? 'All daily meal indents have been finalized for this date.'
              : `${summary?.remainingCount} meal${
                  summary?.remainingCount === 1 ? '' : 's'
                } remaining available for planning.`}
          </p>
        </div>

        <div className="summary-banner-right">
          <div className="summary-pill-group">
            <div className="summary-stat-box">
              <span className="stat-number">{summary?.bookedCount || 0}</span>
              <span className="stat-label">Booked</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-number">{summary?.skippedCount || 0}</span>
              <span className="stat-label">Skipped</span>
            </div>
            <div className="summary-stat-box">
              <span className="stat-number">{summary?.draftCount || 0}</span>
              <span className="stat-label">Drafts</span>
            </div>
          </div>
          <div
            className={`status-pill ${
              summary?.bookedCount === 4
                ? 'status-pill-success'
                : summary?.bookedCount! > 0
                ? 'status-pill-info'
                : 'status-pill-neutral'
            }`}
          >
            <ShieldCheck size={14} />
            <span>{summary?.summaryStatus || 'Active Indent Window'}</span>
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

      {/* Active Digital Passes (Ticket Cards for Today) */}
      {isSelectedDateToday && activePasses.length > 0 && (
        <section className="mess-section" aria-labelledby="active-passes-heading">
          <div className="section-title-group">
            <h2 id="active-passes-heading" className="mess-section-title">
              Today's Active Digital Passes
            </h2>
            <span className="section-badge highlight">
              {activePasses.length} Active Pass{activePasses.length === 1 ? '' : 'es'}
            </span>
          </div>

          <div className="passes-grid">
            {activePasses.map((pass: ActiveMessToken) => (
              <div key={pass.id} className="digital-token-pass">
                <div className="pass-header">
                  <div className="pass-brand">
                    <QrCode size={18} className="pass-qr-icon" />
                    <span>HOSTEL MEAL PASS</span>
                  </div>
                  <span className="pass-valid-tag">VALID FOR TODAY</span>
                </div>

                <div className="pass-main">
                  <div className="pass-left">
                    <span className="pass-meal-label">{pass.mealName}</span>
                    <h3 className="pass-token-number">{pass.tokenNumber}</h3>
                    <div className="pass-timing-chip">
                      <Clock size={13} />
                      <span>{pass.timing}</span>
                    </div>
                  </div>

                  <div
                    className="pass-qr-visual"
                    onClick={() => setQrModalOpen(true)}
                    style={{ cursor: 'pointer' }}
                    title="Click to enlarge Mess Verification QR"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setQrModalOpen(true)}
                    aria-label="Enlarge Mess Verification QR Code"
                  >
                    {qrDataUrl ? (
                      <img
                        src={qrDataUrl}
                        alt="Mess Verification QR"
                        className="pass-real-qr-img"
                      />
                    ) : (
                      <QrCode size={48} />
                    )}
                    <span className="pass-qr-label">MESS QR</span>
                  </div>
                </div>

                <div className="pass-details-footer">
                  <div className="pass-meta-col">
                    <span className="meta-label">STUDENT</span>
                    <span className="meta-value">{pass.studentName}</span>
                  </div>
                  <div className="pass-meta-col">
                    <span className="meta-label">JNTU NO</span>
                    <span className="meta-value">{pass.jntuNo}</span>
                  </div>
                  <div className="pass-meta-col">
                    <span className="meta-label">LOCATION</span>
                    <span className="meta-value">
                      {pass.blockName} - {pass.roomNumber}
                    </span>
                  </div>
                </div>

                <div className="pass-bottom-note">
                  <ShieldCheck size={13} />
                  <span>Present this token number or pass at the mess service counter</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

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
