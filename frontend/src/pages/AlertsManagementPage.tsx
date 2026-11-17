import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Phone,
  MapPin,
  ExternalLink,
  RefreshCw,
  X,
  Search,
  Building2,
  Send,
  Check,
  UserX,
  Flame,
} from 'lucide-react';
import {
  managementApiService,
  AlertItem,
  AlertStats,
  BroadcastAlertPayload,
} from '../services/api';
import '../styles/AlertsManagement.css';

interface AlertsManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const AlertsManagementPage: React.FC<AlertsManagementPageProps> = ({ onNavigate }) => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [stats, setStats] = useState<AlertStats>({
    totalAlerts: 0,
    criticalAlerts: 0,
    overdueStudents: 0,
    gateBreaches: 0,
    urgentComplaints: 0,
    activeSuspensions: 0,
    systemStatus: 'NORMAL',
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  // Modal States
  const [broadcastModalOpen, setBroadcastModalOpen] = useState<boolean>(false);
  const [ackModalOpen, setAckModalOpen] = useState<boolean>(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null);
  const [ackNotes, setAckNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Broadcast Form State
  const [broadcastData, setBroadcastData] = useState<BroadcastAlertPayload>({
    title: '',
    message: '',
    severity: 'HIGH',
    recipientScope: 'ALL_STUDENTS',
    blockName: '',
    roomNumber: '',
    expiresInHours: 24,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const loadAlerts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await managementApiService.getAlerts({
        severity: severityFilter,
        type: typeFilter,
      });
      setAlerts(res.alerts || []);
      setStats(res.stats);
    } catch (err: any) {
      console.error('Failed to load alerts:', err);
      setError(err.message || 'Failed to load active security alerts.');
    } finally {
      setIsLoading(false);
    }
  }, [severityFilter, typeFilter]);

  useEffect(() => {
    loadAlerts();
    // Auto-refresh every 30 seconds for live monitoring
    const timer = setInterval(() => {
      loadAlerts();
    }, 30000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  // Handle Emergency Broadcast
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastData.title.trim() || !broadcastData.message.trim()) {
      alert('Please fill out both title and message.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await managementApiService.broadcastAlert(broadcastData);
      showToast(res.message || 'Emergency alert broadcasted successfully.');
      setBroadcastModalOpen(false);
      setBroadcastData({
        title: '',
        message: '',
        severity: 'HIGH',
        recipientScope: 'ALL_STUDENTS',
        blockName: '',
        roomNumber: '',
        expiresInHours: 24,
      });
      await loadAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to broadcast alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Acknowledgement
  const handleAcknowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;
    try {
      setIsSubmitting(true);
      await managementApiService.acknowledgeAlert(selectedAlert.id, ackNotes);
      showToast(`Alert for ${selectedAlert.title} acknowledged.`);
      setAckModalOpen(false);
      setSelectedAlert(null);
      setAckNotes('');
      await loadAlerts();
    } catch (err: any) {
      alert(err.message || 'Failed to acknowledge alert.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Preset templates for quick emergency broadcast
  const applyPreset = (preset: { title: string; message: string; severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO' }) => {
    setBroadcastData((prev) => ({
      ...prev,
      title: preset.title,
      message: preset.message,
      severity: preset.severity,
    }));
  };

  // Filter alerts by search query
  const filteredAlerts = alerts.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q) ||
      (a.student?.name && a.student.name.toLowerCase().includes(q)) ||
      (a.student?.jntuNo && a.student.jntuNo.toLowerCase().includes(q)) ||
      (a.student?.blockName && a.student.blockName.toLowerCase().includes(q))
    );
  });

  return (
    <div className="alerts-page-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '1.5rem',
            right: '1.5rem',
            background: '#0f172a',
            color: '#fff',
            padding: '0.85rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontWeight: 500,
          }}
        >
          <CheckCircle2 size={18} color="#22c55e" />
          {toastMessage}
        </div>
      )}

      {/* Header & Threat Status Banner */}
      <div className="alerts-header">
        <div className="alerts-header-left">
          <h1>
            <ShieldAlert color="#dc2626" size={28} />
            Alerts & Security Monitoring
          </h1>
          <p>Real-time campus security, curfew violations, gate transit rejections, and urgent facility alerts.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => loadAlerts()}
            disabled={isLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 0.95rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            className="btn-broadcast"
            onClick={() => setBroadcastModalOpen(true)}
          >
            <Flame size={18} />
            Broadcast Emergency Alert
          </button>
        </div>
      </div>

      {/* Threat Level Banner */}
      <div className={`threat-banner threat-${stats.systemStatus}`}>
        <div className="threat-badge">
          <span className="pulse-indicator" />
          System Status: {stats.systemStatus === 'CRITICAL' ? 'Critical Alert Condition' : stats.systemStatus === 'ELEVATED' ? 'Elevated Security Watch' : 'Normal Operational State'}
        </div>
        <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
          {stats.criticalAlerts > 0
            ? `${stats.criticalAlerts} critical incidents requiring immediate warden response.`
            : stats.overdueStudents > 0
            ? `${stats.overdueStudents} students currently overdue past gate curfew.`
            : 'All perimeter gates and curfew monitoring operating normally.'}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="alerts-kpis">
        <div className="kpi-card" style={{ borderLeft: '4px solid #dc2626' }}>
          <div className="kpi-icon-wrapper" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <AlertOctagon size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.criticalAlerts}</span>
            <span className="kpi-label">Critical Alerts</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
          <div className="kpi-icon-wrapper" style={{ background: '#fffbeb', color: '#f59e0b' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.overdueStudents}</span>
            <span className="kpi-label">Curfew Overdue</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #6366f1' }}>
          <div className="kpi-icon-wrapper" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <UserX size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.gateBreaches}</span>
            <span className="kpi-label">Gate Rejections</span>
          </div>
        </div>

        <div className="kpi-card" style={{ borderLeft: '4px solid #0284c7' }}>
          <div className="kpi-icon-wrapper" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <AlertTriangle size={24} />
          </div>
          <div className="kpi-info">
            <span className="kpi-value">{stats.urgentComplaints}</span>
            <span className="kpi-label">Urgent Maintenance</span>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="alerts-controls">
        <div className="controls-filters">
          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search
              size={16}
              style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }}
            />
            <input
              type="text"
              placeholder="Search alert, student, room..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', width: '100%' }}
            />
          </div>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Only</option>
            <option value="HIGH">High Severity</option>
            <option value="WARNING">Warnings</option>
            <option value="INFO">Informational</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="filter-select"
          >
            <option value="ALL">All Alert Types</option>
            <option value="CURFEW_OVERDUE">Curfew Overdue</option>
            <option value="GATE_BREACH">Gate Rejection</option>
            <option value="URGENT_COMPLAINT">Urgent Maintenance</option>
            <option value="DISCIPLINARY">Active Suspension</option>
          </select>
        </div>

        <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>
          Showing {filteredAlerts.length} of {stats.totalAlerts} active alerts
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '8px', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Alert Feed */}
      <div className="alerts-list">
        {filteredAlerts.length === 0 ? (
          <div
            style={{
              background: '#fff',
              border: '1px dashed #cbd5e1',
              borderRadius: '12px',
              padding: '3rem 1.5rem',
              textAlign: 'center',
              color: '#64748b',
            }}
          >
            <CheckCircle2 size={40} color="#22c55e" style={{ margin: '0 auto 0.75rem auto' }} />
            <h3 style={{ margin: '0 0 0.25rem 0', color: '#0f172a' }}>No Active Alerts</h3>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              All students have returned on time and no security or emergency incidents are recorded.
            </p>
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <div key={alert.id} className={`alert-item-card border-${alert.severity}`}>
              <div className="alert-card-top">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <div className="alert-badge-group">
                    <span className={`severity-pill ${alert.severity}`}>{alert.severity}</span>
                    <span className="type-pill">{alert.type.replace('_', ' ')}</span>
                  </div>
                  <h3 className="alert-title">{alert.title}</h3>
                </div>

                <div className="alert-actions">
                  <button
                    className="btn-ack"
                    onClick={() => {
                      setSelectedAlert(alert);
                      setAckModalOpen(true);
                    }}
                  >
                    <Check size={14} />
                    Acknowledge
                  </button>
                  {alert.actionUrl && onNavigate && (
                    <button
                      className="btn-action-link"
                      onClick={() => onNavigate(alert.actionUrl!)}
                    >
                      {alert.actionLabel || 'View Record'}
                      <ExternalLink size={13} />
                    </button>
                  )}
                </div>
              </div>

              <p className="alert-desc">{alert.description}</p>

              <div className="alert-meta">
                <span className="alert-meta-item">
                  <Clock size={14} />
                  {new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(alert.timestamp).toLocaleDateString()})
                </span>

                <span className="alert-meta-item">
                  <Building2 size={14} />
                  {alert.source}
                </span>

                {alert.student && (
                  <>
                    <span className="alert-meta-item" style={{ fontWeight: 600, color: '#0f172a' }}>
                      Student: {alert.student.name} ({alert.student.jntuNo})
                    </span>

                    {alert.student.blockName && (
                      <span className="alert-meta-item">
                        <MapPin size={14} />
                        {alert.student.blockName} {alert.student.roomNumber ? `- Room ${alert.student.roomNumber}` : ''}
                      </span>
                    )}

                    {alert.student.emergencyContact && (
                      <a
                        href={`tel:${alert.student.emergencyContact}`}
                        className="alert-meta-item"
                        style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 600 }}
                      >
                        <Phone size={14} />
                        Call Contact: {alert.student.emergencyContact}
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Emergency Broadcast Modal */}
      {broadcastModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                <Flame color="#dc2626" size={22} />
                Broadcast Emergency Alert
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setBroadcastModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="form-group">
              <label>Quick Alert Presets:</label>
              <div className="preset-buttons">
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() =>
                    applyPreset({
                      title: 'Immediate Curfew Recall: Return to Campus',
                      message: 'Due to severe inclement weather, all outdoor passes are suspended. All residential students must return to their respective hostel blocks immediately.',
                      severity: 'CRITICAL',
                    })
                  }
                >
                  ⛈️ Curfew Recall
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() =>
                    applyPreset({
                      title: 'Scheduled Water Supply Interruption',
                      message: 'Maintenance on main overhead storage tanks will take place between 02:00 PM and 05:00 PM. Please store required water in advance.',
                      severity: 'HIGH',
                    })
                  }
                >
                  💧 Water Interruption
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() =>
                    applyPreset({
                      title: 'Mandatory Fire & Evacuation Drill',
                      message: 'A mandatory fire drill will be conducted today at 04:30 PM. All hostel residents must assemble at the main sports ground upon alarm signal.',
                      severity: 'WARNING',
                    })
                  }
                >
                  🚨 Evacuation Drill
                </button>
                <button
                  type="button"
                  className="btn-preset"
                  onClick={() =>
                    applyPreset({
                      title: 'Mess Serving Timing Update',
                      message: 'Dinner service will commence 30 minutes earlier today at 07:00 PM to accommodate university cultural festival rehearsals.',
                      severity: 'INFO',
                    })
                  }
                >
                  🍲 Mess Schedule
                </button>
              </div>
            </div>

            <form onSubmit={handleBroadcastSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Alert Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Immediate Gate Curfew Notice"
                  value={broadcastData.title}
                  onChange={(e) => setBroadcastData({ ...broadcastData, title: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label>Alert Message Body *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Provide explicit instructions or safety details for residents..."
                  value={broadcastData.message}
                  onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Severity Level</label>
                  <select
                    value={broadcastData.severity}
                    onChange={(e) =>
                      setBroadcastData({
                        ...broadcastData,
                        severity: e.target.value as 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO',
                      })
                    }
                    className="form-select"
                  >
                    <option value="CRITICAL">CRITICAL (Emergency)</option>
                    <option value="HIGH">HIGH (Urgent)</option>
                    <option value="WARNING">WARNING (Operational)</option>
                    <option value="INFO">INFO (Advisory)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Recipient Scope</label>
                  <select
                    value={broadcastData.recipientScope}
                    onChange={(e) =>
                      setBroadcastData({
                        ...broadcastData,
                        recipientScope: e.target.value as 'ALL_STUDENTS' | 'BLOCK' | 'ROOM',
                      })
                    }
                    className="form-select"
                  >
                    <option value="ALL_STUDENTS">All Hostel Residents</option>
                    <option value="BLOCK">Specific Hostel Block</option>
                  </select>
                </div>
              </div>

              {broadcastData.recipientScope === 'BLOCK' && (
                <div className="form-group">
                  <label>Target Hostel Block Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Boys Block A"
                    value={broadcastData.blockName || ''}
                    onChange={(e) => setBroadcastData({ ...broadcastData, blockName: e.target.value })}
                    className="form-input"
                  />
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-ack"
                  onClick={() => setBroadcastModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-broadcast"
                >
                  <Send size={15} />
                  {isSubmitting ? 'Broadcasting...' : 'Send Alert Broadcast'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Acknowledge Alert Modal */}
      {ackModalOpen && selectedAlert && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h2>
                <CheckCircle2 color="#22c55e" size={22} />
                Acknowledge Alert
              </h2>
              <button
                className="modal-close-btn"
                onClick={() => setAckModalOpen(false)}
              >
                <X size={20} />
              </button>
            </div>

            <div>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#0f172a' }}>
                {selectedAlert.title}
              </p>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#475569' }}>
                {selectedAlert.description}
              </p>
            </div>

            <form onSubmit={handleAcknowledgeSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label>Resolution / Contact Notes (Optional):</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Contacted parent; student confirmed arrival delay due to transport. Gate pass verified."
                  value={ackNotes}
                  onChange={(e) => setAckNotes(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-ack"
                  onClick={() => setAckModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: '#166534',
                    color: '#fff',
                    border: 'none',
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {isSubmitting ? 'Recording...' : 'Confirm Acknowledged'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertsManagementPage;
