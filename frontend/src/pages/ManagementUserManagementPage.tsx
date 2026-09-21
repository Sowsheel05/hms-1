import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  Eye,
  Edit2,
  Lock,
  Unlock,
  KeyRound,
  UserPlus,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  ShieldAlert,
  RotateCcw,
} from 'lucide-react';
import {
  managementApiService,
  UserAccountItem,
  UserSummaryData,
  UserRoleOption,
} from '../services/api';

interface ManagementUserManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const ManagementUserManagementPage: React.FC<ManagementUserManagementPageProps> = () => {
  // Users list state
  const [users, setUsers] = useState<UserAccountItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 25,
    total: 0,
    totalPages: 1,
  });

  // Summary Metrics
  const [summary, setSummary] = useState<UserSummaryData | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(true);

  // Supported Roles
  const [availableRoles, setAvailableRoles] = useState<UserRoleOption[]>([]);

  // Filter States
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Applied Filters
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    role: 'ALL',
    status: 'ALL',
  });

  // Real-time Connection State
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  // Modals
  const [selectedUser, setSelectedUser] = useState<UserAccountItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [isPasswordResetModalOpen, setIsPasswordResetModalOpen] = useState<boolean>(false);

  // Action Pending State
  const [actionType, setActionType] = useState<'DISABLE' | 'ENABLE' | null>(null);
  const [disableReason, setDisableReason] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [isActionSubmitting, setIsActionSubmitting] = useState<boolean>(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Add User Form State
  const [addForm, setAddForm] = useState({
    jntuNo: '',
    name: '',
    email: '',
    role: 'STUDENT',
    password: '',
    blockName: '',
    roomNumber: '',
    bedNumber: '',
    roomType: 'Non-AC Room (2 Sharing)',
    monthlyOutingMax: 5,
  });
  const [addFormError, setAddFormError] = useState<string | null>(null);
  const [isAddSubmitting, setIsAddSubmitting] = useState<boolean>(false);

  // Edit User Form State
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    role: '',
    blockName: '',
    roomNumber: '',
    bedNumber: '',
    roomType: '',
    monthlyOutingMax: 5,
  });
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState<boolean>(false);

  // -----------------------------------------------------------------
  // DATA FETCHING: USERS
  // -----------------------------------------------------------------
  const fetchUsers = useCallback(
    async (pageToFetch?: number) => {
      setIsLoading(true);
      setError(null);
      try {
        const targetPage = pageToFetch || pagination.page;
        const res = await managementApiService.getUsers({
          page: targetPage,
          pageSize: pagination.pageSize,
          search: appliedFilters.search || undefined,
          role: appliedFilters.role !== 'ALL' ? appliedFilters.role : undefined,
          status: appliedFilters.status !== 'ALL' ? appliedFilters.status : undefined,
        });

        if (res.success) {
          setUsers(res.users || []);
          setPagination(res.pagination);
        } else {
          setError('Failed to retrieve user accounts.');
        }
      } catch (err: any) {
        setError(err.message || 'Error communicating with HMS user management API.');
      } finally {
        setIsLoading(false);
      }
    },
    [pagination.page, pagination.pageSize, appliedFilters]
  );

  // -----------------------------------------------------------------
  // DATA FETCHING: SUMMARY METRICS & ROLES
  // -----------------------------------------------------------------
  const fetchSummary = useCallback(async () => {
    setIsSummaryLoading(true);
    try {
      const res = await managementApiService.getUserSummary();
      if (res.success) {
        setSummary(res.summary);
      }
    } catch (err) {
      console.error('Failed to load user summary metrics:', err);
    } finally {
      setIsSummaryLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await managementApiService.getUserRoles();
      if (res.success) {
        // Exclude reserved ADMIN and HOSTEL_ADMIN roles as well as generic duplicate CHIEF_WARDEN
        const creatable = (res.roles || []).filter(
          (r: any) => !['ADMIN', 'HOSTEL_ADMIN', 'CHIEF_WARDEN'].includes(r.role)
        );
        setAvailableRoles(creatable);
      }
    } catch (err) {
      console.error('Failed to load supported user roles:', err);
    }
  }, []);

  useEffect(() => {
    fetchUsers(1);
    fetchSummary();
    fetchRoles();
  }, [appliedFilters]);

  const fetchUsersRef = useRef(fetchUsers);
  const fetchSummaryRef = useRef(fetchSummary);

  useEffect(() => {
    fetchUsersRef.current = fetchUsers;
    fetchSummaryRef.current = fetchSummary;
  }, [fetchUsers, fetchSummary]);

  // -----------------------------------------------------------------
  // REAL-TIME SSE STREAM LISTENER
  // -----------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        const type = (event?.type || '').toUpperCase();
        if (
          type.startsWith('USER_') ||
          type === 'MANAGEMENT_DASHBOARD_EVENT' ||
          type === 'MANAGEMENT_DASHBOARD_UPDATE'
        ) {
          fetchUsersRef.current();
          fetchSummaryRef.current();
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, []);

  // Manual Refresh Handler
  const handleManualRefresh = async () => {
    setIsManualRefreshing(true);
    await Promise.all([fetchUsers(pagination.page), fetchSummary(), fetchRoles()]);
    setIsManualRefreshing(false);
  };

  // Filter Trigger
  const handleApplyFilters = () => {
    setAppliedFilters({
      search: searchQuery.trim(),
      role: selectedRole,
      status: selectedStatus,
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedRole('ALL');
    setSelectedStatus('ALL');
    setAppliedFilters({
      search: '',
      role: 'ALL',
      status: 'ALL',
    });
  };

  // -----------------------------------------------------------------
  // ACTION HANDLERS
  // -----------------------------------------------------------------
  const handleOpenDetail = (user: UserAccountItem) => {
    setSelectedUser(user);
    setIsDetailModalOpen(true);
  };

  const handleOpenEdit = (user: UserAccountItem) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name,
      email: user.email,
      role: user.role,
      blockName: user.blockName || '',
      roomNumber: user.roomNumber || '',
      bedNumber: user.bedNumber || '',
      roomType: user.roomType || '',
      monthlyOutingMax: user.monthlyOutingMax || 5,
    });
    setEditFormError(null);
    setIsEditModalOpen(true);
  };

  const handleOpenStatusConfirm = (user: UserAccountItem, action: 'DISABLE' | 'ENABLE') => {
    setSelectedUser(user);
    setActionType(action);
    setDisableReason('');
    setActionError(null);
    setActionSuccess(null);
    setIsConfirmModalOpen(true);
  };

  const handleOpenPasswordReset = (user: UserAccountItem) => {
    setSelectedUser(user);
    setNewPassword('');
    setActionError(null);
    setActionSuccess(null);
    setIsPasswordResetModalOpen(true);
  };

  // Submit Status Change (Disable / Enable)
  const handleStatusSubmit = async () => {
    if (!selectedUser || !actionType) return;
    setIsActionSubmitting(true);
    setActionError(null);

    try {
      if (actionType === 'DISABLE') {
        const res = await managementApiService.disableUser(selectedUser.id, disableReason);
        if (res.success) {
          setActionSuccess(res.message);
          setTimeout(() => {
            setIsConfirmModalOpen(false);
            fetchUsers();
            fetchSummary();
          }, 1200);
        }
      } else {
        const res = await managementApiService.enableUser(selectedUser.id);
        if (res.success) {
          setActionSuccess(res.message);
          setTimeout(() => {
            setIsConfirmModalOpen(false);
            fetchUsers();
            fetchSummary();
          }, 1200);
        }
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to update account status.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Submit Password Reset
  const handlePasswordResetSubmit = async () => {
    if (!selectedUser) return;
    if (newPassword.length < 6) {
      setActionError('New password must be at least 6 characters.');
      return;
    }

    setIsActionSubmitting(true);
    setActionError(null);

    try {
      const res = await managementApiService.resetUserPassword(selectedUser.id, newPassword);
      if (res.success) {
        setActionSuccess(res.message);
        setTimeout(() => {
          setIsPasswordResetModalOpen(false);
        }, 1500);
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to reset password.');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Submit Add User
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.jntuNo || !addForm.name || !addForm.email || !addForm.password) {
      setAddFormError('Please fill in all required fields.');
      return;
    }
    if (addForm.password.length < 6) {
      setAddFormError('Password must be at least 6 characters.');
      return;
    }

    setIsAddSubmitting(true);
    setAddFormError(null);

    try {
      const res = await managementApiService.createUser({
        jntuNo: addForm.jntuNo,
        name: addForm.name,
        email: addForm.email,
        role: addForm.role,
        password: addForm.password,
        blockName: addForm.blockName || undefined,
        roomNumber: addForm.roomNumber || undefined,
        bedNumber: addForm.bedNumber || undefined,
        roomType: addForm.roomType || undefined,
        monthlyOutingMax: addForm.monthlyOutingMax,
      });

      if (res.success) {
        setIsAddModalOpen(false);
        setAddForm({
          jntuNo: '',
          name: '',
          email: '',
          role: 'STUDENT',
          password: '',
          blockName: '',
          roomNumber: '',
          bedNumber: '',
          roomType: 'Non-AC Room (2 Sharing)',
          monthlyOutingMax: 5,
        });
        fetchUsers();
        fetchSummary();
      }
    } catch (err: any) {
      setAddFormError(err.message || 'Failed to create user account.');
    } finally {
      setIsAddSubmitting(false);
    }
  };

  // Submit Edit User
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsEditSubmitting(true);
    setEditFormError(null);

    try {
      const res = await managementApiService.updateUser(selectedUser.id, {
        name: editForm.name,
        email: editForm.email,
        role: editForm.role !== selectedUser.role ? editForm.role : undefined,
        blockName: editForm.blockName,
        roomNumber: editForm.roomNumber,
        bedNumber: editForm.bedNumber,
        roomType: editForm.roomType,
        monthlyOutingMax: editForm.monthlyOutingMax,
      });

      if (res.success) {
        setIsEditModalOpen(false);
        fetchUsers();
        fetchSummary();
      }
    } catch (err: any) {
      setEditFormError(err.message || 'Failed to update user account.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // -----------------------------------------------------------------
  // HELPER BADGE STYLES
  // -----------------------------------------------------------------
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'ADMIN':
      case 'HOSTEL_ADMIN':
        return 'user-role-admin';
      case 'CHIEF_WARDEN':
      case 'CHIEF_WARDEN_BOYS':
      case 'CHIEF_WARDEN_GIRLS':
      case 'WARDEN':
        return 'user-role-warden';
      case 'STUDENT':
        return 'user-role-student';
      case 'MAINTENANCE_STAFF':
      case 'MESS_STAFF':
        return 'user-role-support';
      default:
        return 'user-role-default';
    }
  };

  return (
    <div className="user-management-page">
      {/* 1. Header Area */}
      <div className="user-page-header">
        <div className="user-header-left">
          <div className="user-title-row">
            <div className="user-header-icon-wrapper">
              <Users className="user-header-icon" size={24} />
            </div>
            <div>
              <h1 className="user-page-title">User Management & Role Administration</h1>
              <p className="user-page-subtitle">
                Authoritative system accounts, permissions, and security status control.
              </p>
            </div>
          </div>
        </div>

        <div className="user-header-actions">
          {/* Real-time Indicator */}
          <div className={`user-sync-indicator ${isLiveConnected ? 'connected' : 'disconnected'}`}>
            <span className="user-pulse-dot" />
            <span className="user-sync-text">
              {isLiveConnected ? 'Live Authoritative Sync' : 'Reconnecting...'}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            className="user-btn-secondary"
            onClick={handleManualRefresh}
            disabled={isManualRefreshing || isLoading}
            title="Refresh user data"
          >
            <RefreshCw size={16} className={isManualRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {/* Add User Button */}
          <button
            className="user-btn-primary"
            onClick={() => {
              setAddFormError(null);
              setIsAddModalOpen(true);
            }}
          >
            <UserPlus size={16} />
            <span>Add User</span>
          </button>
        </div>
      </div>

      {/* 2. KPI Cards */}
      <div className="user-kpi-grid">
        <div className="user-kpi-card">
          <div className="user-kpi-icon-container blue">
            <Users size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Total Accounts</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.totalUsers ?? 0}</span>
          </div>
        </div>

        <div className="user-kpi-card">
          <div className="user-kpi-icon-container green">
            <CheckCircle2 size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Active Users</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.activeUsers ?? 0}</span>
          </div>
        </div>

        <div className="user-kpi-card">
          <div className="user-kpi-icon-container red">
            <AlertCircle size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Disabled Accounts</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.disabledUsers ?? 0}</span>
          </div>
        </div>

        <div className="user-kpi-card">
          <div className="user-kpi-icon-container purple">
            <User size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Students</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.students ?? 0}</span>
          </div>
        </div>

        <div className="user-kpi-card">
          <div className="user-kpi-icon-container indigo">
            <ShieldCheck size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Management Staff</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.managementStaff ?? 0}</span>
          </div>
        </div>

        <div className="user-kpi-card">
          <div className="user-kpi-icon-container amber">
            <ShieldAlert size={20} />
          </div>
          <div className="user-kpi-details">
            <span className="user-kpi-label">Support Technicians</span>
            <span className="user-kpi-value">{isSummaryLoading ? '—' : summary?.supportStaff ?? 0}</span>
          </div>
        </div>
      </div>

      {/* 3. Filter Controls */}
      <div className="user-filter-card">
        <div className="user-filter-row">
          {/* Search Box */}
          <div className="user-search-wrapper">
            <Search className="user-search-icon" size={18} />
            <input
              type="text"
              className="user-search-input"
              placeholder="Search by Name, JNTU No, Email, Block..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
            />
          </div>

          {/* Role Filter */}
          <div className="user-filter-item">
            <label className="user-filter-label">Role</label>
            <select
              className="user-select-input"
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
            >
              <option value="ALL">All Roles</option>
              {availableRoles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="user-filter-item">
            <label className="user-filter-label">Account Status</label>
            <select
              className="user-select-input"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="DISABLED">Disabled Only</option>
            </select>
          </div>

          {/* Action Buttons */}
          <div className="user-filter-actions">
            <button className="user-btn-primary" onClick={handleApplyFilters}>
              Filter
            </button>
            <button className="user-btn-secondary" onClick={handleClearFilters}>
              <RotateCcw size={14} />
              <span>Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. Main Data Table */}
      <div className="user-table-card">
        {error && (
          <div className="user-error-banner">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="user-loading-state">
            <RefreshCw className="animate-spin user-loading-spinner" size={32} />
            <p>Loading authoritative user accounts from PostgreSQL...</p>
          </div>
        ) : users.length === 0 ? (
          <div className="user-empty-state">
            <Users size={48} className="user-empty-icon" />
            <h3>No User Accounts Found</h3>
            <p>Try adjusting your search criteria or role filters.</p>
            <button className="user-btn-secondary" onClick={handleClearFilters}>
              Clear Filters
            </button>
          </div>
        ) : (
          <div className="user-table-responsive">
            <table className="user-data-table">
              <thead>
                <tr>
                  <th>User / Display Name</th>
                  <th>Login ID / JNTU</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Room / Allocation</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className={!u.isActive ? 'user-row-disabled' : ''}>
                    <td>
                      <div className="user-identity-cell">
                        <div className="user-avatar-placeholder">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="user-name-text">{u.name}</div>
                          <div className="user-email-text">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <code className="user-id-code">{u.jntuNo}</code>
                    </td>

                    <td>
                      <span className={`user-role-badge ${getRoleBadgeClass(u.role)}`}>
                        {u.role.replace('_', ' ')}
                      </span>
                    </td>

                    <td>
                      <span className={`user-status-pill ${u.isActive ? 'active' : 'disabled'}`}>
                        <span className="user-status-dot" />
                        {u.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>

                    <td>
                      {u.role === 'STUDENT' ? (
                        u.blockName && u.roomNumber ? (
                          <div className="user-allocation-info">
                            <span className="user-block-room">{u.blockName} • Rm {u.roomNumber}</span>
                            <span className="user-bed-tag">{u.bedNumber || 'Bed-1'}</span>
                          </div>
                        ) : (
                          <span className="user-text-muted">Not Allocated</span>
                        )
                      ) : (
                        <span className="user-text-muted">—</span>
                      )}
                    </td>

                    <td>
                      <div className="user-date-cell">
                        <Clock size={12} />
                        <span>{new Date(u.createdAt).toLocaleDateString()}</span>
                      </div>
                    </td>

                    <td className="text-right">
                      <div className="user-action-buttons">
                        {/* View Detail */}
                        <button
                          className="user-action-btn view"
                          title="View User Details"
                          onClick={() => handleOpenDetail(u)}
                        >
                          <Eye size={15} />
                        </button>

                        {/* Edit User */}
                        <button
                          className="user-action-btn edit"
                          title="Edit User Profile / Role"
                          onClick={() => handleOpenEdit(u)}
                        >
                          <Edit2 size={15} />
                        </button>

                        {/* Enable / Disable */}
                        {u.isActive ? (
                          <button
                            className="user-action-btn disable"
                            title="Disable Account"
                            onClick={() => handleOpenStatusConfirm(u, 'DISABLE')}
                          >
                            <Lock size={15} />
                          </button>
                        ) : (
                          <button
                            className="user-action-btn enable"
                            title="Enable Account"
                            onClick={() => handleOpenStatusConfirm(u, 'ENABLE')}
                          >
                            <Unlock size={15} />
                          </button>
                        )}

                        {/* Reset Password */}
                        <button
                          className="user-action-btn key"
                          title="Reset Password"
                          onClick={() => handleOpenPasswordReset(u)}
                        >
                          <KeyRound size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && users.length > 0 && (
          <div className="user-pagination-bar">
            <div className="user-pagination-info">
              Showing {(pagination.page - 1) * pagination.pageSize + 1} to{' '}
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} accounts
            </div>

            <div className="user-pagination-controls">
              <button
                className="user-page-btn"
                disabled={pagination.page <= 1}
                onClick={() => fetchUsers(pagination.page - 1)}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>

              <span className="user-page-counter">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                className="user-page-btn"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchUsers(pagination.page + 1)}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 5. MODAL: USER DETAIL VIEW */}
      {/* ------------------------------------------------------------- */}
      {isDetailModalOpen && selectedUser && (
        <div className="user-modal-overlay">
          <div className="user-modal-container">
            <div className="user-modal-header">
              <div className="user-modal-header-title">
                <User size={20} />
                <h3>User Account Details</h3>
              </div>
              <button className="user-modal-close-btn" onClick={() => setIsDetailModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="user-modal-body">
              <div className="user-detail-profile-card">
                <div className="user-detail-avatar">
                  {selectedUser.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4>{selectedUser.name}</h4>
                  <p>{selectedUser.email}</p>
                  <div className="user-detail-badges">
                    <span className={`user-role-badge ${getRoleBadgeClass(selectedUser.role)}`}>
                      {selectedUser.role.replace('_', ' ')}
                    </span>
                    <span className={`user-status-pill ${selectedUser.isActive ? 'active' : 'disabled'}`}>
                      {selectedUser.isActive ? 'Active Account' : 'Disabled Account'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="user-detail-section">
                <h5>Account Information</h5>
                <div className="user-detail-grid">
                  <div className="user-detail-item">
                    <span className="user-detail-label">Account ID</span>
                    <code className="user-detail-code">{selectedUser.id}</code>
                  </div>
                  <div className="user-detail-item">
                    <span className="user-detail-label">Login Identifier / JNTU</span>
                    <code className="user-detail-code">{selectedUser.jntuNo}</code>
                  </div>
                  <div className="user-detail-item">
                    <span className="user-detail-label">Created Date</span>
                    <span>{new Date(selectedUser.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="user-detail-item">
                    <span className="user-detail-label">Last Updated</span>
                    <span>{new Date(selectedUser.updatedAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {selectedUser.role === 'STUDENT' && (
                <div className="user-detail-section">
                  <h5>Hostel Residency Details</h5>
                  <div className="user-detail-grid">
                    <div className="user-detail-item">
                      <span className="user-detail-label">Allocation Status</span>
                      <span>{selectedUser.allocationStatus || 'NOT_ALLOCATED'}</span>
                    </div>
                    <div className="user-detail-item">
                      <span className="user-detail-label">Hostel Block</span>
                      <span>{selectedUser.blockName || 'Unassigned'}</span>
                    </div>
                    <div className="user-detail-item">
                      <span className="user-detail-label">Room & Bed</span>
                      <span>
                        {selectedUser.roomNumber ? `Room ${selectedUser.roomNumber} (${selectedUser.bedNumber || 'Bed-1'})` : 'Unassigned'}
                      </span>
                    </div>
                    <div className="user-detail-item">
                      <span className="user-detail-label">Monthly Outing Limit</span>
                      <span>{selectedUser.monthlyOutingMax ?? 5} outings / month</span>
                    </div>
                  </div>
                </div>
              )}

              {selectedUser._count && (
                <div className="user-detail-section">
                  <h5>Operational Statistics</h5>
                  <div className="user-stats-pill-grid">
                    <div className="user-stat-box">
                      <span className="val">{selectedUser._count.sessions ?? 0}</span>
                      <span className="lbl">Active Sessions</span>
                    </div>
                    <div className="user-stat-box">
                      <span className="val">{selectedUser._count.outings ?? 0}</span>
                      <span className="lbl">Outing Requests</span>
                    </div>
                    <div className="user-stat-box">
                      <span className="val">{selectedUser._count.leaves ?? 0}</span>
                      <span className="lbl">Leave Requests</span>
                    </div>
                    <div className="user-stat-box">
                      <span className="val">{selectedUser._count.complaints ?? 0}</span>
                      <span className="lbl">Complaints Filed</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="user-modal-footer">
              <button className="user-btn-secondary" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 6. MODAL: ADD USER */}
      {/* ------------------------------------------------------------- */}
      {isAddModalOpen && (
        <div className="user-modal-overlay">
          <div className="user-modal-container">
            <div className="user-modal-header">
              <div className="user-modal-header-title">
                <UserPlus size={20} />
                <h3>Create New User Account</h3>
              </div>
              <button className="user-modal-close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddSubmit}>
              <div className="user-modal-body">
                {addFormError && (
                  <div className="user-modal-error">
                    <AlertCircle size={16} />
                    <span>{addFormError}</span>
                  </div>
                )}

                <div className="user-form-grid">
                  <div className="user-form-group">
                    <label className="user-form-label">Role *</label>
                    <select
                      className="user-form-input"
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                      required
                    >
                      {availableRoles.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label} ({r.role})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="user-form-group">
                    <label className="user-form-label">Login Identifier / JNTU No *</label>
                    <input
                      type="text"
                      className="user-form-input"
                      placeholder="e.g. 25331A05H9 or WARDEN02"
                      value={addForm.jntuNo}
                      onChange={(e) => setAddForm({ ...addForm, jntuNo: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>

                  <div className="user-form-group">
                    <label className="user-form-label">Display Name *</label>
                    <input
                      type="text"
                      className="user-form-input"
                      placeholder="Full Name"
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="user-form-group">
                    <label className="user-form-label">Email Address *</label>
                    <input
                      type="email"
                      className="user-form-input"
                      placeholder="user@college.edu"
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="user-form-group full-width">
                    <label className="user-form-label">Password *</label>
                    <input
                      type="password"
                      className="user-form-input"
                      placeholder="Minimum 6 characters"
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      required
                    />
                  </div>

                  {addForm.role === 'STUDENT' && (
                    <>
                      <div className="user-form-group">
                        <label className="user-form-label">Hostel Block</label>
                        <input
                          type="text"
                          className="user-form-input"
                          placeholder="e.g. Girls-Block-B"
                          value={addForm.blockName}
                          onChange={(e) => setAddForm({ ...addForm, blockName: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Room Number</label>
                        <input
                          type="text"
                          className="user-form-input"
                          placeholder="e.g. 119"
                          value={addForm.roomNumber}
                          onChange={(e) => setAddForm({ ...addForm, roomNumber: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Bed Number</label>
                        <input
                          type="text"
                          className="user-form-input"
                          placeholder="e.g. Bed-1"
                          value={addForm.bedNumber}
                          onChange={(e) => setAddForm({ ...addForm, bedNumber: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Monthly Outing Limit</label>
                        <input
                          type="number"
                          className="user-form-input"
                          min={1}
                          max={20}
                          value={addForm.monthlyOutingMax}
                          onChange={(e) => setAddForm({ ...addForm, monthlyOutingMax: parseInt(e.target.value, 10) || 5 })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="user-modal-footer">
                <button
                  type="button"
                  className="user-btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={isAddSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="user-btn-primary" disabled={isAddSubmitting}>
                  {isAddSubmitting ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 7. MODAL: EDIT USER */}
      {/* ------------------------------------------------------------- */}
      {isEditModalOpen && selectedUser && (
        <div className="user-modal-overlay">
          <div className="user-modal-container">
            <div className="user-modal-header">
              <div className="user-modal-header-title">
                <Edit2 size={20} />
                <h3>Edit User Profile: {selectedUser.name}</h3>
              </div>
              <button className="user-modal-close-btn" onClick={() => setIsEditModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="user-modal-body">
                {editFormError && (
                  <div className="user-modal-error">
                    <AlertCircle size={16} />
                    <span>{editFormError}</span>
                  </div>
                )}

                <div className="user-form-grid">
                  <div className="user-form-group">
                    <label className="user-form-label">Display Name *</label>
                    <input
                      type="text"
                      className="user-form-input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="user-form-group">
                    <label className="user-form-label">Email Address *</label>
                    <input
                      type="email"
                      className="user-form-input"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      required
                    />
                  </div>

                  <div className="user-form-group full-width">
                    <label className="user-form-label">Role (Security Privilege)</label>
                    <select
                      className="user-form-input"
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      {availableRoles.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label} ({r.role})
                        </option>
                      ))}
                    </select>
                    {editForm.role !== selectedUser.role && (
                      <div className="user-role-warning">
                        <ShieldAlert size={14} />
                        <span>
                          Warning: You are modifying this user's privilege from{' '}
                          <strong>{selectedUser.role}</strong> to <strong>{editForm.role}</strong>.
                        </span>
                      </div>
                    )}
                  </div>

                  {selectedUser.role === 'STUDENT' && (
                    <>
                      <div className="user-form-group">
                        <label className="user-form-label">Hostel Block</label>
                        <input
                          type="text"
                          className="user-form-input"
                          value={editForm.blockName}
                          onChange={(e) => setEditForm({ ...editForm, blockName: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Room Number</label>
                        <input
                          type="text"
                          className="user-form-input"
                          value={editForm.roomNumber}
                          onChange={(e) => setEditForm({ ...editForm, roomNumber: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Bed Number</label>
                        <input
                          type="text"
                          className="user-form-input"
                          value={editForm.bedNumber}
                          onChange={(e) => setEditForm({ ...editForm, bedNumber: e.target.value })}
                        />
                      </div>

                      <div className="user-form-group">
                        <label className="user-form-label">Monthly Outing Limit</label>
                        <input
                          type="number"
                          className="user-form-input"
                          min={1}
                          max={20}
                          value={editForm.monthlyOutingMax}
                          onChange={(e) => setEditForm({ ...editForm, monthlyOutingMax: parseInt(e.target.value, 10) || 5 })}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="user-modal-footer">
                <button
                  type="button"
                  className="user-btn-secondary"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isEditSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="user-btn-primary" disabled={isEditSubmitting}>
                  {isEditSubmitting ? 'Saving Changes...' : 'Update Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 8. MODAL: STATUS CONFIRMATION (DISABLE / ENABLE) */}
      {/* ------------------------------------------------------------- */}
      {isConfirmModalOpen && selectedUser && actionType && (
        <div className="user-modal-overlay">
          <div className="user-modal-container small">
            <div className="user-modal-header">
              <div className="user-modal-header-title">
                {actionType === 'DISABLE' ? <Lock size={20} className="text-red" /> : <Unlock size={20} className="text-green" />}
                <h3>{actionType === 'DISABLE' ? 'Disable User Account?' : 'Enable User Account?'}</h3>
              </div>
              <button className="user-modal-close-btn" onClick={() => setIsConfirmModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="user-modal-body">
              {actionError && (
                <div className="user-modal-error">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="user-modal-success">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <p className="user-confirm-text">
                {actionType === 'DISABLE' ? (
                  <>
                    Are you sure you want to disable <strong>{selectedUser.name}</strong> (
                    <code>{selectedUser.jntuNo}</code>)? This user will be immediately logged out and blocked from
                    authenticating into the system.
                  </>
                ) : (
                  <>
                    Are you sure you want to re-enable <strong>{selectedUser.name}</strong> (
                    <code>{selectedUser.jntuNo}</code>)? Their authentication privileges will be restored immediately.
                  </>
                )}
              </p>

              {actionType === 'DISABLE' && (
                <div className="user-form-group full-width">
                  <label className="user-form-label">Reason for Disabling (Optional)</label>
                  <input
                    type="text"
                    className="user-form-input"
                    placeholder="e.g. Disciplinary suspension, Left institution"
                    value={disableReason}
                    onChange={(e) => setDisableReason(e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="user-modal-footer">
              <button
                className="user-btn-secondary"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={isActionSubmitting}
              >
                Cancel
              </button>
              <button
                className={`user-btn-primary ${actionType === 'DISABLE' ? 'danger' : ''}`}
                onClick={handleStatusSubmit}
                disabled={isActionSubmitting}
              >
                {isActionSubmitting
                  ? 'Processing...'
                  : actionType === 'DISABLE'
                  ? 'Yes, Disable Account'
                  : 'Yes, Enable Account'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 9. MODAL: PASSWORD RESET */}
      {/* ------------------------------------------------------------- */}
      {isPasswordResetModalOpen && selectedUser && (
        <div className="user-modal-overlay">
          <div className="user-modal-container small">
            <div className="user-modal-header">
              <div className="user-modal-header-title">
                <KeyRound size={20} />
                <h3>Reset Password</h3>
              </div>
              <button className="user-modal-close-btn" onClick={() => setIsPasswordResetModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="user-modal-body">
              {actionError && (
                <div className="user-modal-error">
                  <AlertCircle size={16} />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="user-modal-success">
                  <CheckCircle2 size={16} />
                  <span>{actionSuccess}</span>
                </div>
              )}

              <p className="user-confirm-text">
                Resetting password for <strong>{selectedUser.name}</strong> (<code>{selectedUser.jntuNo}</code>).
                All current sessions for this user will be terminated immediately.
              </p>

              <div className="user-form-group full-width">
                <label className="user-form-label">New Password *</label>
                <input
                  type="password"
                  className="user-form-input"
                  placeholder="Enter new password (min 6 chars)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="user-modal-footer">
              <button
                className="user-btn-secondary"
                onClick={() => setIsPasswordResetModalOpen(false)}
                disabled={isActionSubmitting}
              >
                Cancel
              </button>
              <button
                className="user-btn-primary"
                onClick={handlePasswordResetSubmit}
                disabled={isActionSubmitting || newPassword.length < 6}
              >
                {isActionSubmitting ? 'Resetting...' : 'Confirm Password Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagementUserManagementPage;
