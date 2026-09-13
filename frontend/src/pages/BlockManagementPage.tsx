import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Building,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Info,
} from 'lucide-react';
import {
  managementApiService,
  Block,
  CreateBlockDto,
  UpdateBlockDto,
} from '../services/api';
import { useManagementAuth } from '../context/ManagementAuthContext';

interface BlockManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const BlockManagementPage: React.FC<BlockManagementPageProps> = () => {
  const { user } = useManagementAuth();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Status Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
  });

  // Delete confirmation modal state
  const [deleteModalBlock, setDeleteModalBlock] = useState<Block | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Fetch authoritative blocks from PostgreSQL
  const fetchBlocks = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setError(null);

    try {
      const response = await managementApiService.getBlocks({
        search: searchTerm,
        status: statusFilter,
      });
      setBlocks(response.blocks || []);
    } catch (err: any) {
      console.error('Failed to load blocks from PostgreSQL:', err);
      setError(err.message || 'Unable to load hostel blocks from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, statusFilter]);

  // Initial load & filter change
  useEffect(() => {
    fetchBlocks(false);
  }, [fetchBlocks]);

  // Real-time SSE synchronization: Automatically refetch on authoritative block events
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (
        event?.type === 'BLOCK_CREATED' ||
        event?.type === 'BLOCK_UPDATED' ||
        event?.type === 'BLOCK_STATUS_CHANGED' ||
        event?.type === 'BLOCK_DELETED' ||
        event?.type === 'ROOM_ALLOCATED' ||
        event?.type === 'ROOM_DEALLOCATED'
      ) {
        fetchBlocks(true);
      }
    });

    return () => unsubscribe();
  }, [fetchBlocks]);

  // Summary counts for filter pills
  const counts = useMemo(() => {
    const total = blocks.length;
    const active = blocks.filter((b) => b.status === 'ACTIVE').length;
    const inactive = blocks.filter((b) => b.status === 'INACTIVE').length;
    return { total, active, inactive };
  }, [blocks]);

  // Filtered blocks for display with optional role scoping
  const displayBlocks = useMemo(() => {
    return blocks.filter((b) => {
      // Role-based hostel scoping for Chief Warden Boys / Girls
      if (user?.role === 'CHIEF_WARDEN_BOYS' && !b.name.toLowerCase().includes('boys') && !b.code.toLowerCase().startsWith('bb')) {
        return false;
      }
      if (user?.role === 'CHIEF_WARDEN_GIRLS' && !b.name.toLowerCase().includes('girls') && !b.code.toLowerCase().startsWith('gb')) {
        return false;
      }

      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [blocks, searchTerm, statusFilter, user]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBlock(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      status: 'ACTIVE',
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (block: Block) => {
    setEditingBlock(block);
    setFormData({
      name: block.name,
      code: block.code,
      description: block.description || '',
      status: block.status,
    });
    setFormError(null);
    setIsFormModalOpen(true);
  };

  // Submit Create / Edit form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim();
    const code = formData.code.trim().toUpperCase();

    if (!name || name.length < 2) {
      setFormError('Block name must be at least 2 characters.');
      return;
    }

    if (!code || code.length < 2) {
      setFormError('Block code must be at least 2 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingBlock) {
        // Update existing block
        const updatePayload: UpdateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        await managementApiService.updateBlock(editingBlock.id, updatePayload);
        showToast(`Block '${name}' (${code}) updated successfully.`);
      } else {
        // Create new block
        const createPayload: CreateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        await managementApiService.createBlock(createPayload);
        showToast(`Block '${name}' (${code}) created successfully.`);
      }

      setIsFormModalOpen(false);
      fetchBlocks(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save block.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Confirmation Modal
  const handleOpenDelete = (block: Block) => {
    setDeleteModalBlock(block);
    setDeleteError(null);
  };

  // Execute Safe Block Deletion
  const handleConfirmDelete = async () => {
    if (!deleteModalBlock) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await managementApiService.deleteBlock(deleteModalBlock.id);
      showToast(res.message || `Block '${deleteModalBlock.name}' deleted.`);
      setDeleteModalBlock(null);
      fetchBlocks(true);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete block.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Extract decorative block initial / letter
  const getDecorativeLetter = (block: Block): string => {
    const parts = block.code.split('-');
    if (parts.length > 1 && parts[parts.length - 1].length <= 2) {
      return parts[parts.length - 1];
    }
    const nameParts = block.name.split('-');
    if (nameParts.length > 1 && nameParts[nameParts.length - 1].length <= 2) {
      return nameParts[nameParts.length - 1];
    }
    return block.code.charAt(0) || 'B';
  };

  return (
    <div className="block-management-view">
      {/* Toast feedback banner */}
      {toastMessage && (
        <div className={`block-toast toast-${toastMessage.type}`} role="status">
          {toastMessage.type === 'success' ? (
            <CheckCircle2 size={16} className="toast-icon" />
          ) : (
            <AlertTriangle size={16} className="toast-icon" />
          )}
          <span>{toastMessage.text}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => setToastMessage(null)}
            aria-label="Close message"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Top Header Section */}
      <div className="block-page-header">
        <div className="block-header-info">
          <div className="block-header-tag">
            <Building size={13} />
            <span>Hostel Infrastructure</span>
          </div>
          <h1 className="block-page-title">Block Management</h1>
          <p className="block-page-desc">
            Configure, monitor, and manage residential blocks, capacity, and occupancy.
          </p>
        </div>

        <div className="block-header-actions">
          <button
            type="button"
            onClick={() => fetchBlocks(true)}
            disabled={isRefreshing}
            className="sync-btn"
            title="Refresh blocks from PostgreSQL"
            aria-label="Refresh blocks"
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span className="sync-btn-label">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="btn-primary block-add-btn"
            id="add-block-btn"
            aria-label="Add new block"
          >
            <Plus size={16} />
            <span>+ Add Block</span>
          </button>
        </div>
      </div>

      {/* Search & Filter Controls Bar */}
      <div className="block-controls-bar">
        <div className="block-search-wrap">
          <Search size={16} className="search-icon" aria-hidden="true" />
          <input
            id="block-search-input"
            type="text"
            className="block-search-input"
            placeholder="Search blocks by name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Search blocks"
          />
          {searchTerm && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearchTerm('')}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="block-filter-controls">
          <div className="block-filter-group" role="group" aria-label="Status filter">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
            >
              All ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={`filter-pill ${statusFilter === 'ACTIVE' ? 'active' : ''}`}
            >
              Active ({counts.active})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={`filter-pill ${statusFilter === 'INACTIVE' ? 'active' : ''}`}
            >
              Inactive ({counts.inactive})
            </button>
          </div>

          <div className="block-status-select-wrap">
            <select
              id="block-status-select-filter"
              className="block-status-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              aria-label="Filter blocks by status"
            >
              <option value="ALL">All Blocks ({counts.total})</option>
              <option value="ACTIVE">Active ({counts.active})</option>
              <option value="INACTIVE">Inactive ({counts.inactive})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && blocks.length === 0 && (
        <div className="block-card-grid" aria-busy="true">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="campusstay-block-card skeleton-card" style={{ height: '240px' }} />
          ))}
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="mgmt-error-card" role="alert">
          <AlertTriangle size={36} className="mgmt-error-icon" />
          <h3 className="mgmt-error-title">Unable to Load Blocks</h3>
          <p className="mgmt-error-msg">{error}</p>
          <button
            type="button"
            onClick={() => fetchBlocks(false)}
            className="btn-primary"
            style={{ marginTop: '0.75rem' }}
          >
            <RotateCw size={14} style={{ marginRight: 6 }} />
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && displayBlocks.length === 0 && (
        <div className="block-empty-card">
          <div className="block-empty-icon">
            <Building size={36} />
          </div>
          <h3 className="block-empty-title">
            {searchTerm || statusFilter !== 'ALL' ? 'No Matching Blocks Found' : 'No Blocks Configured Yet'}
          </h3>
          <p className="block-empty-desc">
            {searchTerm || statusFilter !== 'ALL'
              ? 'Try adjusting your search keywords or resetting the status filter.'
              : 'Get started by creating your first residential block or wing.'}
          </p>
          {searchTerm || statusFilter !== 'ALL' ? (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
              }}
            >
              Reset Filters
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={handleOpenCreate}>
              <Plus size={16} />
              <span>+ Add Block</span>
            </button>
          )}
        </div>
      )}

      {/* Responsive Block Cards Grid matching reference screenshot */}
      {!isLoading && displayBlocks.length > 0 && (
        <div className="block-card-grid" aria-label="Hostel Block Cards">
          {displayBlocks.map((block) => {
            const isActive = block.status === 'ACTIVE';
            const isBoys =
              block.name.toLowerCase().includes('boys') ||
              block.code.toUpperCase().startsWith('BB') ||
              (!block.name.toLowerCase().includes('girls') && !block.code.toUpperCase().startsWith('GB'));

            // Authoritative PostgreSQL statistics
            const totalCapacity = block.totalCapacity ?? 0;
            const occupied = block.occupied ?? 0;
            const vacant = block.vacant ?? Math.max(0, totalCapacity - occupied - (block.maintenance ?? 0));
            const maintenance = block.maintenance ?? 0;
            const vacancyRate = block.vacancyRate ?? (totalCapacity > 0 ? `${Math.round((vacant / totalCapacity) * 100)}%` : '0%');
            const decorativeLetter = getDecorativeLetter(block);

            return (
              <div
                key={block.id}
                className="campusstay-block-card"
                data-block-id={block.id}
                data-block-code={block.code}
              >
                {/* Decorative Watermark Initial */}
                <span className="block-decorative-watermark" aria-hidden="true">
                  {decorativeLetter}
                </span>

                {/* Top Section */}
                <div>
                  <div className="block-card-top-section">
                    <div className="block-card-identity">
                      <h3 className="block-card-name-text">
                        {block.name}
                      </h3>
                      <span className={`block-hostel-type-badge ${isBoys ? 'boys' : 'girls'}`}>
                        {isBoys ? 'Boys Hostel' : 'Girls Hostel'}
                      </span>
                    </div>

                    <div className="block-card-status-wrap">
                      <span className={`block-status-pill-badge ${isActive ? 'active' : 'inactive'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  {/* Metrics Rows matching screenshot structure */}
                  <div className="block-metrics-list">
                    <div className="block-metric-row">
                      <span className="block-metric-label">Total Capacity</span>
                      <span className="block-metric-value">{totalCapacity}</span>
                    </div>
                    <div className="block-metric-row">
                      <span className="block-metric-label">Occupied</span>
                      <span className="block-metric-value">{occupied}</span>
                    </div>
                    <div className="block-metric-row">
                      <span className="block-metric-label">Vacant</span>
                      <span className="block-metric-value">{vacant}</span>
                    </div>
                    <div className="block-metric-row">
                      <span className="block-metric-label">Maintenance</span>
                      <span className="block-metric-value">{maintenance}</span>
                    </div>
                    <div className="block-metric-row">
                      <span className="block-metric-label">Vacancy Rate</span>
                      <span
                        className={`block-metric-value ${
                          vacancyRate === '0%' ? 'vacancy-red' : 'vacancy-green'
                        }`}
                      >
                        {vacancyRate}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Action Buttons matching screenshot */}
                <div className="block-card-action-footer">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(block)}
                    className="block-action-btn-item edit"
                    title={`Edit ${block.name}`}
                    aria-label={`Edit ${block.name}`}
                  >
                    <Edit2 size={12} />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenDelete(block)}
                    className="block-action-btn-item delete"
                    title={`Delete ${block.name}`}
                    aria-label={`Delete ${block.name}`}
                  >
                    <Trash2 size={12} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          CREATE / EDIT BLOCK MODAL
          ========================================================================= */}
      {isFormModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => !isSubmitting && setIsFormModalOpen(false)}>
          <div className="mgmt-modal-dialog block-form-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mgmt-modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-circle">
                  <Building size={18} />
                </div>
                <div>
                  <h3 className="mgmt-modal-title">
                    {editingBlock ? 'Edit Hostel Block' : 'Add New Hostel Block'}
                  </h3>
                  <p className="mgmt-modal-sub">
                    {editingBlock
                      ? 'Update structural details and operational status.'
                      : 'Configure a new residential facility for rooms and allocations.'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => !isSubmitting && setIsFormModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="mgmt-modal-body">
                {formError && (
                  <div className="modal-error-alert" role="alert">
                    <AlertTriangle size={15} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-field-group">
                  <label htmlFor="block-name" className="form-field-label">
                    Block Name <span className="field-required">*</span>
                  </label>
                  <input
                    id="block-name"
                    type="text"
                    required
                    placeholder="e.g. Boys-Block-E, Girls-Block-C"
                    className="form-field-input"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                  <span className="form-field-hint">The primary institutional title for this facility.</span>
                </div>

                <div className="form-field-group">
                  <label htmlFor="block-code" className="form-field-label">
                    Block Code <span className="field-required">*</span>
                  </label>
                  <input
                    id="block-code"
                    type="text"
                    required
                    placeholder="e.g. BB-E, GB-C, WW-01"
                    className="form-field-input code-input"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  />
                  <span className="form-field-hint">Unique uppercase abbreviation used for room indexing.</span>
                </div>

                <div className="form-field-group">
                  <label htmlFor="block-desc" className="form-field-label">
                    Description
                  </label>
                  <textarea
                    id="block-desc"
                    rows={3}
                    placeholder="Optional details on wing layout, amenities, or residential zone..."
                    className="form-field-textarea"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-field-group">
                  <label className="form-field-label">Operational Status</label>
                  <div className="status-radio-group">
                    <label className={`status-radio-option ${formData.status === 'ACTIVE' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="blockStatus"
                        value="ACTIVE"
                        checked={formData.status === 'ACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'ACTIVE' })}
                      />
                      <div className="radio-indicator" />
                      <div className="radio-text">
                        <span className="radio-title">Active</span>
                        <span className="radio-desc">Open for residential assignments</span>
                      </div>
                    </label>

                    <label className={`status-radio-option ${formData.status === 'INACTIVE' ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="blockStatus"
                        value="INACTIVE"
                        checked={formData.status === 'INACTIVE'}
                        onChange={() => setFormData({ ...formData, status: 'INACTIVE' })}
                      />
                      <div className="radio-indicator" />
                      <div className="radio-text">
                        <span className="radio-title">Inactive</span>
                        <span className="radio-desc">Under maintenance or closed</span>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="mgmt-modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFormModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={isSubmitting} id="block-submit-btn">
                  {isSubmitting ? (
                    <>
                      <RotateCw size={14} className="spin-anim" />
                      <span>{editingBlock ? 'Updating...' : 'Creating...'}</span>
                    </>
                  ) : (
                    <span>{editingBlock ? 'Update Block' : 'Create Block'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          SAFE DELETE CONFIRMATION MODAL
          ========================================================================= */}
      {deleteModalBlock && (
        <div className="mgmt-modal-backdrop" onClick={() => !isDeleting && setDeleteModalBlock(null)}>
          <div className="mgmt-modal-dialog delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-modal-header">
              <div className="delete-warning-icon">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="delete-modal-title">Delete Hostel Block?</h3>
                <p className="delete-modal-sub">
                  Target: <strong>{deleteModalBlock.name}</strong> ({deleteModalBlock.code})
                </p>
              </div>
            </div>

            <div className="delete-modal-body">
              {deleteError ? (
                <div className="delete-error-banner" role="alert">
                  <XCircle size={18} className="delete-error-icon" />
                  <div>
                    <h4 className="delete-error-heading">Cannot Delete Block</h4>
                    <p className="delete-error-text">{deleteError}</p>
                  </div>
                </div>
              ) : (
                <div className="delete-warning-text">
                  <p>
                    Are you sure you want to delete this hostel block record? This action will permanently remove
                    the block from PostgreSQL.
                  </p>
                  <p className="dependency-safety-note">
                    <Info size={14} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                    Strict relational dependency checks are enforced. If any students or rooms are associated with this
                    block, deletion will be safely rejected.
                  </p>
                </div>
              )}
            </div>

            <div className="delete-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeleteModalBlock(null)}
                disabled={isDeleting}
              >
                {deleteError ? 'Close' : 'Cancel'}
              </button>

              {!deleteError && (
                <button
                  type="button"
                  className="btn-danger"
                  id="confirm-delete-block-btn"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <RotateCw size={14} className="spin-anim" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <span>Delete Block Permanently</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
