import React, { useState, useEffect, useCallback } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Building,
  RefreshCw,
  Eye,
  Check,
  X,
  AlertCircle,
  FileText,
  User,
  ShieldCheck,
  Filter,
} from 'lucide-react';
import {
  managementApiService,
  HostelApplicationItem,
  ManagementHostelApplicationsResponse,
  RoomItem,
  RoomOccupant,
} from '../services/api';

interface ManagementHostelApplicationsPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementHostelApplicationsPage: React.FC<ManagementHostelApplicationsPageProps> = ({
  onNavigate: _onNavigate,
}) => {
  const [data, setData] = useState<ManagementHostelApplicationsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedApp, setSelectedApp] = useState<HostelApplicationItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Reject Modal
  const [rejectModalApp, setRejectModalApp] = useState<HostelApplicationItem | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmittingReject, setIsSubmittingReject] = useState(false);

  // Allocate / Approve Modal
  const [allocateModalApp, setAllocateModalApp] = useState<HostelApplicationItem | null>(null);
  const [blocksList, setBlocksList] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string>('');
  const [roomsInBlock, setRoomsInBlock] = useState<RoomItem[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedBedNumber, setSelectedBedNumber] = useState<string>('');
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isSubmittingAlloc, setIsSubmittingAlloc] = useState(false);

  // Fetch applications list
  const loadApplications = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      setError(null);
      const res = await managementApiService.getHostelApplications({
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        preferredBlock: blockFilter !== 'ALL' ? blockFilter : undefined,
        search: searchQuery.trim() || undefined,
      });
      setData(res);
      if (res.blocks) {
        setBlocksList(res.blocks);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve hostel applications.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [statusFilter, blockFilter, searchQuery]);

  useEffect(() => {
    loadApplications();
  }, [loadApplications]);

  // Load rooms when block changes inside allocation modal
  useEffect(() => {
    if (!selectedBlockId) {
      setRoomsInBlock([]);
      setSelectedRoomId('');
      setSelectedBedNumber('');
      return;
    }

    setIsLoadingRooms(true);
    managementApiService
      .getRooms({ blockId: selectedBlockId, status: 'ACTIVE' })
      .then((res) => {
        setRoomsInBlock(res.rooms || []);
        if (res.rooms && res.rooms.length > 0) {
          // Select first available room with free capacity
          const availableRoom = res.rooms.find(
            (r) => (r.occupancy || 0) < r.capacity
          ) || res.rooms[0];
          setSelectedRoomId(availableRoom.id);
        } else {
          setSelectedRoomId('');
        }
      })
      .catch((err) => {
        console.error('Failed to load rooms for block:', err);
      })
      .finally(() => {
        setIsLoadingRooms(false);
      });
  }, [selectedBlockId]);

  // Update bed options when room changes
  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedBedNumber('');
      return;
    }
    const currentRoom = roomsInBlock.find((r) => r.id === selectedRoomId);
    if (currentRoom) {
      const occupiedBeds = (currentRoom.activeOccupants || []).map((a: RoomOccupant) => a.bedNumber?.toLowerCase());
      // Pick first free bed
      for (let i = 1; i <= currentRoom.capacity; i++) {
        const bedLabel = `Bed ${i}`;
        if (!occupiedBeds.includes(bedLabel.toLowerCase())) {
          setSelectedBedNumber(bedLabel);
          return;
        }
      }
      setSelectedBedNumber(`Bed 1`);
    }
  }, [selectedRoomId, roomsInBlock]);

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!rejectModalApp) return;
    if (!rejectionReason.trim()) {
      alert('Please specify a rejection reason.');
      return;
    }

    setIsSubmittingReject(true);
    try {
      await managementApiService.updateHostelApplicationStatus(rejectModalApp.id, {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      });
      setSuccessToast(`Application ${rejectModalApp.applicationNumber} rejected successfully.`);
      setRejectModalApp(null);
      setRejectionReason('');
      loadApplications();
    } catch (err: any) {
      alert(err.message || 'Failed to reject application.');
    } finally {
      setIsSubmittingReject(false);
    }
  };

  // Handle Allocate & Approve
  const handleConfirmAllocate = async () => {
    if (!allocateModalApp) return;
    if (!selectedRoomId || !selectedBedNumber) {
      alert('Please select a valid Room and Bed.');
      return;
    }

    setIsSubmittingAlloc(true);
    try {
      await managementApiService.allocateHostelApplication(allocateModalApp.id, {
        roomId: selectedRoomId,
        bedNumber: selectedBedNumber,
      });
      setSuccessToast(
        `Application ${allocateModalApp.applicationNumber} approved and allocated! Student account activated.`
      );
      setAllocateModalApp(null);
      setSelectedRoomId('');
      setSelectedBedNumber('');
      loadApplications();
    } catch (err: any) {
      alert(err.message || 'Failed to allocate room.');
    } finally {
      setIsSubmittingAlloc(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
      case 'ALLOCATED':
        return (
          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <CheckCircle2 size={13} /> {status}
          </span>
        );
      case 'PENDING':
        return (
          <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} /> PENDING
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={13} /> UNDER REVIEW
          </span>
        );
      case 'REJECTED':
        return (
          <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <XCircle size={13} /> REJECTED
          </span>
        );
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  const metrics = data?.metrics || {
    total: 0,
    pending: 0,
    underReview: 0,
    approved: 0,
    allocated: 0,
    rejected: 0,
  };

  const applications = data?.applications || [];

  return (
    <div className="portal-content-inner" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            background: '#ECFDF5',
            border: '1px solid #6EE7B7',
            borderRadius: '8px',
            padding: '0.875rem 1.25rem',
            color: '#065F46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle2 size={18} />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessToast(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#065F46' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '1rem', color: '#991B1B', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--primary-navy)', margin: 0 }}>
            Student Registrations & Hostel Applications
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
            Review new student admission requests, inspect applicant verification details, approve, and allocate rooms.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadApplications(true)}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}
        >
          <RefreshCw size={15} className={isRefreshing ? 'spin-icon' : ''} />
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
        <div className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600, textTransform: 'uppercase' }}>
            Total Applications
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0F172A', marginTop: '0.25rem' }}>
            {metrics.total}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #FEF3C7' }}>
          <span style={{ fontSize: '0.8rem', color: '#B45309', fontWeight: 600, textTransform: 'uppercase' }}>
            Pending Verification
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#D97706', marginTop: '0.25rem' }}>
            {metrics.pending}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #DBEAFE' }}>
          <span style={{ fontSize: '0.8rem', color: '#1E40AF', fontWeight: 600, textTransform: 'uppercase' }}>
            Under Review
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#2563EB', marginTop: '0.25rem' }}>
            {metrics.underReview}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #DCFCE7' }}>
          <span style={{ fontSize: '0.8rem', color: '#15803D', fontWeight: 600, textTransform: 'uppercase' }}>
            Approved / Allocated
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#16A34A', marginTop: '0.25rem' }}>
            {metrics.approved + metrics.allocated}
          </div>
        </div>

        <div className="card" style={{ padding: '1.25rem', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #FEE2E2' }}>
          <span style={{ fontSize: '0.8rem', color: '#B91C1C', fontWeight: 600, textTransform: 'uppercase' }}>
            Rejected
          </span>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#DC2626', marginTop: '0.25rem' }}>
            {metrics.rejected}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          padding: '1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '240px' }}>
          <Search
            size={16}
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}
          />
          <input
            type="text"
            placeholder="Search by student name, roll number, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input"
            style={{ width: '100%', paddingLeft: '2.25rem', height: '38px', fontSize: '0.875rem' }}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Filter size={15} color="#64748B" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="input"
            style={{ height: '38px', fontSize: '0.875rem', minWidth: '150px' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending Only</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="ALLOCATED">Allocated</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        {/* Block Filter */}
        {blocksList.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Building size={15} color="#64748B" />
            <select
              value={blockFilter}
              onChange={(e) => setBlockFilter(e.target.value)}
              className="input"
              style={{ height: '38px', fontSize: '0.875rem', minWidth: '160px' }}
            >
              <option value="ALL">All Blocks</option>
              {blocksList.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Applications Table */}
      <div className="card" style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '1rem', overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }} />
            Loading applications...
          </div>
        ) : applications.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
            <FileText size={36} color="#94A3B8" style={{ marginBottom: '0.5rem' }} />
            <p style={{ margin: 0, fontWeight: 600 }}>No applications found matching the criteria.</p>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem' }}>Try clearing filters or search terms.</p>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #E2E8F0', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem' }}>Application ID</th>
                <th style={{ padding: '0.75rem' }}>Student Details</th>
                <th style={{ padding: '0.75rem' }}>Branch & Year</th>
                <th style={{ padding: '0.75rem' }}>Preferred Block / Room</th>
                <th style={{ padding: '0.75rem' }}>Date</th>
                <th style={{ padding: '0.75rem' }}>Status</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 600, color: 'var(--primary-navy)' }}>
                    {app.applicationNumber}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <strong style={{ color: '#0F172A', display: 'block' }}>{app.student?.name || '—'}</strong>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {app.student?.jntuNo} • {app.student?.email}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div>{app.branch || '—'}</div>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {app.yearOfStudy || '1st Year'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    <div style={{ fontWeight: 500 }}>{app.preferredBlock || 'Any Block'}</div>
                    <span style={{ fontSize: '0.78rem', color: '#64748B' }}>
                      {app.preferredRoomType || 'Standard'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem', fontSize: '0.8rem', color: '#64748B' }}>
                    {new Date(app.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '0.75rem' }}>
                    {getStatusBadge(app.status)}
                  </td>
                  <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedApp(app);
                          setIsDetailModalOpen(true);
                        }}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                        title="View Complete Registration Details"
                      >
                        <Eye size={13} /> View
                      </button>

                      {['PENDING', 'UNDER_REVIEW'].includes(app.status) && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setAllocateModalApp(app);
                              if (blocksList.length > 0) {
                                // Default to preferred block if match found
                                const matched = blocksList.find((b) => b.name === app.preferredBlock);
                                setSelectedBlockId(matched ? matched.id : blocksList[0].id);
                              }
                            }}
                            className="btn btn-primary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Approve & Allocate Room"
                          >
                            <Check size={13} /> Approve
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectModalApp(app);
                              setRejectionReason('');
                            }}
                            className="btn btn-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.78rem', color: '#DC2626', borderColor: '#FCA5A5', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}
                            title="Reject Application"
                          >
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 1. VIEW APPLICATION DETAIL MODAL */}
      {isDetailModalOpen && selectedApp && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsDetailModalOpen(false)}>
          <div className="mgmt-notice-modal" style={{ maxWidth: '750px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-header">
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0 }}>
                  Application Details — {selectedApp.applicationNumber}
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Submitted on {new Date(selectedApp.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsDetailModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Personal Details */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <User size={15} /> Personal Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Full Name:</span> <strong>{selectedApp.student?.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Email:</span> <strong>{selectedApp.student?.email}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Gender:</span> <strong>{selectedApp.gender || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Date of Birth:</span> <strong>{selectedApp.dob || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Phone:</span> <strong>{selectedApp.phone || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Academic Details */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <FileText size={15} /> Academic Details
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Roll / JNTU No:</span> <strong>{selectedApp.student?.jntuNo}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Department / Branch:</span> <strong>{selectedApp.branch}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Year of Study:</span> <strong>{selectedApp.yearOfStudy}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Semester & Section:</span> <strong>{selectedApp.semester || '—'} ({selectedApp.section || '—'})</strong>
                  </div>
                </div>
              </div>

              {/* Guardian Details */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <ShieldCheck size={15} /> Guardian & Emergency Contacts
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Guardian Name:</span> <strong>{selectedApp.guardianName || '—'} ({selectedApp.guardianRelation || 'Parent'})</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Guardian Contact:</span> <strong>{selectedApp.guardianPhone || '—'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Emergency Contact:</span> <strong>{selectedApp.emergencyContact || '—'}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: '#64748B' }}>Permanent Address:</span> <strong>{selectedApp.address || '—'}</strong>
                  </div>
                </div>
              </div>

              {/* Hostel Preferences */}
              <div style={{ background: '#F8FAFC', padding: '1rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: 'var(--primary-navy)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Building size={15} /> Hostel Preferences
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: '#64748B' }}>Preferred Block:</span> <strong>{selectedApp.preferredBlock || 'Any'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Preferred Room Type:</span> <strong>{selectedApp.preferredRoomType || 'Standard'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Food Preference:</span> <strong>{selectedApp.foodPreference || 'VEG'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748B' }}>Stay Duration:</span> <strong>{selectedApp.stayDuration || 'Full Year'}</strong>
                  </div>
                  {selectedApp.medicalConditions && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <span style={{ color: '#64748B' }}>Medical Conditions:</span> <strong>{selectedApp.medicalConditions}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Allocation status if allocated */}
              {selectedApp.student?.roomNumber && (
                <div style={{ background: '#ECFDF5', padding: '1rem', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', color: '#065F46' }}>
                    Allocated Residential Accommodation
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#047857' }}>
                    <strong>Block:</strong> {selectedApp.student.blockName} • <strong>Room:</strong> {selectedApp.student.roomNumber} • <strong>Bed:</strong> {selectedApp.student.bedNumber}
                  </p>
                </div>
              )}
            </div>

            <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsDetailModalOpen(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. REJECT APPLICATION MODAL */}
      {rejectModalApp && (
        <div className="mgmt-modal-backdrop" onClick={() => setRejectModalApp(null)}>
          <div className="mgmt-notice-modal" style={{ maxWidth: '500px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-header">
              <h3 className="notice-modal-title" style={{ color: '#DC2626' }}>
                Reject Application — {rejectModalApp.applicationNumber}
              </h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setRejectModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#64748B', margin: 0 }}>
                Applicant: <strong>{rejectModalApp.student?.name}</strong> ({rejectModalApp.student?.jntuNo})
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Rejection Reason *
                </label>
                <textarea
                  rows={3}
                  className="input"
                  placeholder="e.g. Incomplete documentation, criteria not met, or outside residency limits..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  style={{ width: '100%', fontSize: '0.875rem', resize: 'vertical' }}
                />
              </div>

              <div style={{ background: '#FEF2F2', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#991B1B' }}>
                Rejecting will mark the application as REJECTED. The applicant will be informed and prevented from logging in.
              </div>
            </div>

            <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRejectModalApp(null)}
                disabled={isSubmittingReject}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                style={{ background: '#DC2626', color: '#FFFFFF', border: 'none' }}
                onClick={handleConfirmReject}
                disabled={isSubmittingReject}
              >
                {isSubmittingReject ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. APPROVE & ALLOCATE ROOM MODAL */}
      {allocateModalApp && (
        <div className="mgmt-modal-backdrop" onClick={() => setAllocateModalApp(null)}>
          <div className="mgmt-notice-modal" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
            <div className="notice-modal-header">
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0 }}>
                  Approve Student & Allocate Room
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Application {allocateModalApp.applicationNumber} • {allocateModalApp.student?.name}
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setAllocateModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Applicant Summary */}
              <div style={{ background: '#EFF6FF', padding: '0.875rem 1rem', borderRadius: '8px', border: '1px solid #BFDBFE', fontSize: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                  <div><span style={{ color: '#1E40AF' }}>Applicant:</span> <strong>{allocateModalApp.student?.name}</strong></div>
                  <div><span style={{ color: '#1E40AF' }}>JNTU / ID:</span> <strong>{allocateModalApp.student?.jntuNo}</strong></div>
                  <div><span style={{ color: '#1E40AF' }}>Pref. Block:</span> <strong>{allocateModalApp.preferredBlock || 'Any'}</strong></div>
                  <div><span style={{ color: '#1E40AF' }}>Pref. Type:</span> <strong>{allocateModalApp.preferredRoomType || 'Standard'}</strong></div>
                </div>
              </div>

              {/* Block Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Hostel Block *
                </label>
                <select
                  value={selectedBlockId}
                  onChange={(e) => setSelectedBlockId(e.target.value)}
                  className="input"
                  style={{ width: '100%', height: '38px', fontSize: '0.875rem' }}
                >
                  {blocksList.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Room Number *
                </label>
                {isLoadingRooms ? (
                  <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Loading rooms...</p>
                ) : roomsInBlock.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: '#DC2626' }}>No active rooms in this block.</p>
                ) : (
                  <select
                    value={selectedRoomId}
                    onChange={(e) => setSelectedRoomId(e.target.value)}
                    className="input"
                    style={{ width: '100%', height: '38px', fontSize: '0.875rem' }}
                  >
                    {roomsInBlock.map((r) => {
                      const occupied = r.occupancy || 0;
                      const isFull = occupied >= r.capacity;
                      return (
                        <option key={r.id} value={r.id} disabled={isFull}>
                          Room {r.roomNumber} ({r.roomType || 'Standard'}) — {occupied}/{r.capacity} beds occupied {isFull ? '[FULL]' : ''}
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>

              {/* Bed Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.35rem' }}>
                  Bed Assignment *
                </label>
                {(() => {
                  const currentRoom = roomsInBlock.find((r) => r.id === selectedRoomId);
                  if (!currentRoom) {
                    return <p style={{ fontSize: '0.85rem', color: '#64748B' }}>Select a room first.</p>;
                  }
                  const occupiedBeds = (currentRoom.activeOccupants || []).map((a: RoomOccupant) => a.bedNumber?.toLowerCase());
                  const bedOptions = [];
                  for (let i = 1; i <= currentRoom.capacity; i++) {
                    const bedLabel = `Bed ${i}`;
                    const isTaken = occupiedBeds.includes(bedLabel.toLowerCase());
                    bedOptions.push({ label: bedLabel, isTaken });
                  }

                  return (
                    <select
                      value={selectedBedNumber}
                      onChange={(e) => setSelectedBedNumber(e.target.value)}
                      className="input"
                      style={{ width: '100%', height: '38px', fontSize: '0.875rem' }}
                    >
                      {bedOptions.map((b) => (
                        <option key={b.label} value={b.label} disabled={b.isTaken}>
                          {b.label} {b.isTaken ? '(Occupied)' : '(Available)'}
                        </option>
                      ))}
                    </select>
                  );
                })()}
              </div>

              <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', color: '#166534' }}>
                ✓ Approving and allocating a bed will <strong>immediately activate the student account</strong>. The student will now be permitted to log in at the Student Login screen.
              </div>
            </div>

            <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setAllocateModalApp(null)}
                disabled={isSubmittingAlloc}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmAllocate}
                disabled={isSubmittingAlloc || !selectedRoomId || !selectedBedNumber}
              >
                {isSubmittingAlloc ? 'Allocating...' : 'APPROVE & ALLOCATE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
