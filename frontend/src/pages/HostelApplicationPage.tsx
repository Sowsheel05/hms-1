import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  BedDouble,
  User,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { apiService, HostelApplicationOverviewResponse, HostelApplicationItem } from '../services/api';

export const HostelApplicationPage: React.FC = () => {
  const [data, setData] = useState<HostelApplicationOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchOverview = async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setIsRefreshing(true);
    try {
      setError(null);
      const res = await apiService.getHostelApplicationOverview();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load hostel application overview.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ALLOCATED':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={13} /> {status}
          </span>
        );
      case 'PENDING':
      case 'UNDER_REVIEW':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} /> {status}
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <XCircle size={13} /> REJECTED
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status || 'UNKNOWN'}</span>;
    }
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <div className="spinner" style={{ width: '32px', height: '32px' }} />
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading hostel application status...</p>
      </div>
    );
  }

  const student = data?.student;
  const activeApp = data?.activeApplication;
  const activeAlloc = data?.activeAllocation;
  const applications = data?.applications || [];

  return (
    <div className="portal-content-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>
            Hostel Application & Residency Status
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Verified residential registration record, allocation details, and history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOverview(true)}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '1rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Active Residential Allocation Card */}
      <div className="card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: '#EFF6FF', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BedDouble size={22} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--primary-navy)' }}>
                Current Hostel Allocation
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                Authoritative room assignment from HMS
              </p>
            </div>
          </div>
          <div>
            {getStatusBadge(student?.allocationStatus || (activeAlloc ? 'ALLOCATED' : 'NOT_ALLOCATED'))}
          </div>
        </div>

        {student?.blockName ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Hostel Block</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary-navy)', marginTop: '0.25rem', display: 'block' }}>
                {student.blockName}
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Room Number</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary-navy)', marginTop: '0.25rem', display: 'block' }}>
                {student.roomNumber || 'Assigned'}
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Bed Number</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary-navy)', marginTop: '0.25rem', display: 'block' }}>
                {student.bedNumber || 'Bed Assigned'}
              </strong>
            </div>

            <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>Room Type / Floor</span>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary-navy)', marginTop: '0.25rem', display: 'block' }}>
                {student.roomType || 'Standard'} • {student.floorName || 'Floor 1'}
              </strong>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', background: '#F8FAFC', borderRadius: '8px', border: '1px dashed #CBD5E1' }}>
            <Clock size={32} color="#94A3B8" style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontWeight: 600, color: 'var(--primary-navy)' }}>
              No Active Room Allocation Found
            </p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Your application is under administrative review. Once approved, your assigned room will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Submitted Application Details */}
      {activeApp && (
        <div className="card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--primary-navy)' }}>
                Application Details — {activeApp.applicationNumber}
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>
                Submitted on {new Date(activeApp.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              {getStatusBadge(activeApp.status)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
            {/* Academic & Personal */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <User size={15} /> Student & Academic
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Student Name:</span>
                  <strong>{student?.name}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Roll / JNTU No:</span>
                  <strong>{student?.jntuNo}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Branch:</span>
                  <strong>{activeApp.branch || '—'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Year / Sem:</span>
                  <strong>{activeApp.yearOfStudy || '—'} / {activeApp.semester || '—'}</strong>
                </li>
              </ul>
            </div>

            {/* Hostel Preferences */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Building2 size={15} /> Preferences Submitted
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Preferred Block:</span>
                  <strong>{activeApp.preferredBlock || 'Any'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Room Type:</span>
                  <strong>{activeApp.preferredRoomType || 'Standard'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Food Preference:</span>
                  <strong>{activeApp.foodPreference || 'VEG'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Stay Duration:</span>
                  <strong>{activeApp.stayDuration || 'Full Year'}</strong>
                </li>
              </ul>
            </div>

            {/* Guardian Information */}
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '1rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary-navy)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <ShieldCheck size={15} /> Guardian & Emergency
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Guardian:</span>
                  <strong>{activeApp.guardianName || '—'} ({activeApp.guardianRelation || 'Parent'})</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Contact:</span>
                  <strong>{activeApp.guardianPhone || '—'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Emergency Phone:</span>
                  <strong>{activeApp.emergencyContact || '—'}</strong>
                </li>
                <li style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reviewer Remarks:</span>
                  <span style={{ fontStyle: 'italic', color: '#475569' }}>{activeApp.remarks || 'None'}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Application History Table */}
      <div className="card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '1.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 1rem 0', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={18} /> Application History
        </h3>

        {applications.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
            No past registration records found.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '0.75rem' }}>Application ID</th>
                  <th style={{ padding: '0.75rem' }}>Academic Year</th>
                  <th style={{ padding: '0.75rem' }}>Submitted Date</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((app: HostelApplicationItem) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 600 }}>
                      {app.applicationNumber}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{app.academicYear}</td>
                    <td style={{ padding: '0.75rem' }}>
                      {new Date(app.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '0.75rem' }}>{getStatusBadge(app.status)}</td>
                    <td style={{ padding: '0.75rem', color: 'var(--text-muted)' }}>
                      {app.remarks || (app.rejectionReason ? `Rejected: ${app.rejectionReason}` : '—')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
