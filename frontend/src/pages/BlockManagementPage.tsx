import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  X,
  LayoutGrid,
  Layers,
  Wrench,
  UserCheck,
  Info,
  Users,
  Phone,
  Mail,
  Eye,
} from 'lucide-react';
import {
  managementApiService,
  Block,
  CreateBlockDto,
  UpdateBlockDto,
  RoomItem,
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

  // Search & Status Filter
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Block Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form Fields for Block & Floor/Room Builder
  const [formData, setFormData] = useState<{
    name: string;
    code: string;
    description: string;
    status: 'ACTIVE' | 'INACTIVE';
    totalFloors: number;
    roomsPerFloor: number;
    roomCapacity: number;
    roomType: string;
    autoGenerateRooms: boolean;
  }>({
    name: '',
    code: '',
    description: '',
    status: 'ACTIVE',
    totalFloors: 3,
    roomsPerFloor: 5,
    roomCapacity: 2,
    roomType: 'Non-AC Room (2 Sharing)',
    autoGenerateRooms: true,
  });

  // Delete confirmation modal state
  const [deleteModalBlock, setDeleteModalBlock] = useState<Block | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Toast / notification feedback
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // =========================================================================
  //                     FLOOR PLAN & ROOM EDITOR STATE
  // =========================================================================
  const [selectedFloorPlanBlock, setSelectedFloorPlanBlock] = useState<Block | null>(null);
  const [floorPlanLoading, setFloorPlanLoading] = useState<boolean>(false);
  const [floorPlanBlockData, setFloorPlanBlockData] = useState<Block | null>(null);
  const [activeFloorFilter, setActiveFloorFilter] = useState<number | 'ALL'>('ALL');
  const [inspectingRoom, setInspectingRoom] = useState<RoomItem | null>(null);

  // Room Modal State (Add / Edit Room inside Floor Plan)
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [roomFormError, setRoomFormError] = useState<string | null>(null);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState<boolean>(false);
  const [roomFormData, setRoomFormData] = useState<{
    roomNumber: string;
    floor: number;
    roomType: string;
    capacity: number;
    status: 'ACTIVE' | 'INACTIVE' | 'UNDER_MAINTENANCE';
  }>({
    roomNumber: '',
    floor: 1,
    roomType: 'Non-AC Room (2 Sharing)',
    capacity: 2,
    status: 'ACTIVE',
  });

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

    try {
      const response = await managementApiService.getBlocks({
        search: searchTerm,
        status: statusFilter,
      });
      setBlocks(response.blocks || []);
    } catch (err: any) {
      console.error('Failed to load blocks from PostgreSQL:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchTerm, statusFilter]);

  // Initial load & filter change
  useEffect(() => {
    fetchBlocks(false);
  }, [fetchBlocks]);

  // Scoped blocks for the active user role (Wardens see their assigned gender hostel, Admins see all)
  const roleScopedBlocks = useMemo(() => {
    if (!blocks || !Array.isArray(blocks)) return [];
    if (!user?.role || user.role === 'ADMIN' || user.role === 'HOSTEL_ADMIN' || user.role === 'SUPPORT_ADMIN') {
      return blocks;
    }
    return blocks.filter((b) => {
      if (user.role === 'CHIEF_WARDEN_BOYS' || user.role === 'WARDEN_BOYS') {
        const isBoys = b.name.toLowerCase().includes('boys') || b.code.toUpperCase().startsWith('BH') || b.code.toUpperCase().startsWith('BB');
        if (!isBoys) return false;
      }
      if (user.role === 'CHIEF_WARDEN_GIRLS' || user.role === 'WARDEN_GIRLS') {
        const isGirls = b.name.toLowerCase().includes('girls') || b.code.toUpperCase().startsWith('GH') || b.code.toUpperCase().startsWith('GB');
        if (!isGirls) return false;
      }
      return true;
    });
  }, [blocks, user]);

  // Summary counts for filter pills (calculated accurately from roleScopedBlocks)
  const counts = useMemo(() => {
    const total = roleScopedBlocks.length;
    const active = roleScopedBlocks.filter((b) => b.status === 'ACTIVE').length;
    const inactive = roleScopedBlocks.filter((b) => b.status === 'INACTIVE').length;
    return { total, active, inactive };
  }, [roleScopedBlocks]);

  // Filtered blocks for display matching search term and status filter
  const displayBlocks = useMemo(() => {
    return roleScopedBlocks.filter((b) => {
      const term = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !term ||
        b.name.toLowerCase().includes(term) ||
        b.code.toLowerCase().includes(term) ||
        (b.description && b.description.toLowerCase().includes(term));

      const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [roleScopedBlocks, searchTerm, statusFilter]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingBlock(null);
    setFormData({
      name: '',
      code: '',
      description: '',
      status: 'ACTIVE',
      totalFloors: 3,
      roomsPerFloor: 5,
      roomCapacity: 2,
      roomType: 'Non-AC Room (2 Sharing)',
      autoGenerateRooms: true,
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
      totalFloors: 3,
      roomsPerFloor: 5,
      roomCapacity: 2,
      roomType: 'Non-AC Room (2 Sharing)',
      autoGenerateRooms: false,
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

    const existingBlockWithCode = blocks.find(
      (b) => b.code.toUpperCase() === code && (!editingBlock || b.id !== editingBlock.id)
    );
    if (existingBlockWithCode) {
      setFormError(`A block with code '${code}' already exists in PostgreSQL database (${existingBlockWithCode.name}). Please enter a unique code or edit the existing block.`);
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingBlock) {
        const updatePayload: UpdateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        await managementApiService.updateBlock(editingBlock.id, updatePayload);

        // Auto-generate additional floor rooms if enabled on edit
        if (formData.autoGenerateRooms && formData.totalFloors > 0 && formData.roomsPerFloor > 0) {
          let roomsGenerated = 0;
          for (let fl = 1; fl <= formData.totalFloors; fl++) {
            for (let rIdx = 1; rIdx <= formData.roomsPerFloor; rIdx++) {
              const roomNumber = `${fl}${String(rIdx).padStart(2, '0')}`;
              try {
                await managementApiService.createRoom({
                  blockId: editingBlock.id,
                  floor: fl,
                  roomNumber,
                  capacity: formData.roomCapacity,
                  roomType: formData.roomType,
                  status: 'ACTIVE',
                });
                roomsGenerated++;
              } catch {
                // Room already exists, skip
              }
            }
          }
          showToast(`Block '${name}' updated with ${roomsGenerated} rooms generated across ${formData.totalFloors} floors.`, 'success');
        } else {
          showToast(`Block '${name}' updated successfully.`, 'success');
        }
      } else {
        const createPayload: CreateBlockDto = {
          name,
          code,
          description: formData.description.trim() || null,
          status: formData.status,
        };
        const res = await managementApiService.createBlock(createPayload);
        const newBlockId = res.block.id;

        // Auto-generate floor rooms if enabled
        if (formData.autoGenerateRooms && formData.totalFloors > 0 && formData.roomsPerFloor > 0) {
          let roomsGenerated = 0;
          for (let fl = 1; fl <= formData.totalFloors; fl++) {
            for (let rIdx = 1; rIdx <= formData.roomsPerFloor; rIdx++) {
              const roomNumber = `${fl}${String(rIdx).padStart(2, '0')}`;
              try {
                await managementApiService.createRoom({
                  blockId: newBlockId,
                  floor: fl,
                  roomNumber,
                  capacity: formData.roomCapacity,
                  roomType: formData.roomType,
                  status: 'ACTIVE',
                });
                roomsGenerated++;
              } catch (roomErr) {
                console.warn('Room auto-generation error:', roomErr);
              }
            }
          }
          showToast(`Block '${name}' created with ${roomsGenerated} rooms generated across ${formData.totalFloors} floors!`, 'success');
        } else {
          showToast(`Block '${name}' created successfully.`, 'success');
        }
      }

      setIsFormModalOpen(false);
      fetchBlocks(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save block details.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (block: Block) => {
    setDeleteModalBlock(block);
    setDeleteError(null);
  };

  // Confirm Delete Block
  const handleConfirmDelete = async () => {
    if (!deleteModalBlock) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await managementApiService.deleteBlock(deleteModalBlock.id);
      showToast(`Block '${deleteModalBlock.name}' deleted successfully.`, 'success');
      setDeleteModalBlock(null);
      fetchBlocks(true);
    } catch (err: any) {
      console.error('Error deleting block:', err);
      setDeleteError(err.message || 'Cannot delete block due to assigned students or rooms.');
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  //                  FLOOR PLAN & ROOM EDITOR HANDLERS
  // =========================================================================
  const loadFloorPlanData = useCallback(async (blockId: string) => {
    setFloorPlanLoading(true);
    try {
      const res = await managementApiService.getBlock(blockId);
      if (res.success && res.block) {
        setFloorPlanBlockData(res.block);
      }
    } catch (err: any) {
      showToast('Failed to load block floor plan details.', 'error');
    } finally {
      setFloorPlanLoading(false);
    }
  }, []);

  const handleOpenFloorPlan = (block: Block) => {
    setSelectedFloorPlanBlock(block);
    setActiveFloorFilter('ALL');
    loadFloorPlanData(block.id);
  };

  const handleCloseFloorPlan = () => {
    setSelectedFloorPlanBlock(null);
    setFloorPlanBlockData(null);
  };

  // Open Add Room Modal for Floor Plan
  const handleOpenAddRoom = (defaultFloor = 1) => {
    if (!selectedFloorPlanBlock) return;
    setEditingRoom(null);
    setRoomFormData({
      roomNumber: '',
      floor: defaultFloor,
      roomType: 'Non-AC Room (2 Sharing)',
      capacity: 2,
      status: 'ACTIVE',
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  // Open Edit Room Modal for Floor Plan
  const handleOpenEditRoom = (room: RoomItem) => {
    setEditingRoom(room);
    setRoomFormData({
      roomNumber: room.roomNumber,
      floor: room.floor || 1,
      roomType: room.roomType || 'Non-AC Room (2 Sharing)',
      capacity: room.capacity || 2,
      status: room.status,
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  // Toggle Maintenance Status for a Room directly
  const handleToggleMaintenance = async (room: RoomItem) => {
    if (!selectedFloorPlanBlock) return;
    const newStatus = room.status === 'UNDER_MAINTENANCE' ? 'ACTIVE' : 'UNDER_MAINTENANCE';
    try {
      await managementApiService.updateRoom(room.id, { status: newStatus });
      showToast(`Room ${room.roomNumber} status set to ${newStatus}.`, 'success');
      loadFloorPlanData(selectedFloorPlanBlock.id);
      fetchBlocks(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update room status.', 'error');
    }
  };

  // Delete Room from Floor Plan
  const handleDeleteRoom = async (room: RoomItem) => {
    if (!selectedFloorPlanBlock) return;
    if (room.activeOccupants && room.activeOccupants.length > 0) {
      showToast(`Cannot delete Room ${room.roomNumber} because it currently has ${room.activeOccupants.length} allocated resident(s).`, 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete Room ${room.roomNumber} from ${selectedFloorPlanBlock.name}?`)) {
      return;
    }

    try {
      await managementApiService.deleteRoom(room.id);
      showToast(`Room ${room.roomNumber} deleted successfully.`, 'success');
      loadFloorPlanData(selectedFloorPlanBlock.id);
      fetchBlocks(true);
    } catch (err: any) {
      showToast(err.message || 'Failed to delete room.', 'error');
    }
  };

  // Submit Room Form (Add / Edit)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFloorPlanBlock) return;
    setRoomFormError(null);

    const rmNum = roomFormData.roomNumber.trim();
    if (!rmNum) {
      setRoomFormError('Please enter a valid room number (e.g. 101, 119).');
      return;
    }

    setIsSubmittingRoom(true);
    try {
      if (editingRoom) {
        await managementApiService.updateRoom(editingRoom.id, {
          roomNumber: rmNum,
          floor: Number(roomFormData.floor),
          roomType: roomFormData.roomType,
          capacity: Number(roomFormData.capacity),
          status: roomFormData.status,
        });
        showToast(`Room ${rmNum} updated successfully.`, 'success');
      } else {
        await managementApiService.createRoom({
          blockId: selectedFloorPlanBlock.id,
          roomNumber: rmNum,
          floor: Number(roomFormData.floor),
          roomType: roomFormData.roomType,
          capacity: Number(roomFormData.capacity),
          status: roomFormData.status,
        });
        showToast(`Room ${rmNum} created in ${selectedFloorPlanBlock.name}.`, 'success');
      }

      setIsRoomModalOpen(false);
      loadFloorPlanData(selectedFloorPlanBlock.id);
      fetchBlocks(true);
    } catch (err: any) {
      setRoomFormError(err.message || 'Failed to save room details.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  // Helper for decorative block watermark
  const getDecorativeLetter = (block: Block) => {
    const code = block.code.toUpperCase();
    if (code.startsWith('BH')) return 'BH';
    if (code.startsWith('GH')) return 'GH';
    return code.substring(0, 2);
  };

  // Group rooms by floor for Floor Plan view
  const floorGroupings = useMemo(() => {
    if (!floorPlanBlockData || !floorPlanBlockData.rooms) return [];

    const map = new Map<number, RoomItem[]>();
    for (const r of floorPlanBlockData.rooms) {
      const fl = r.floor || 1;
      if (!map.has(fl)) map.set(fl, []);
      map.get(fl)!.push(r);
    }

    const sortedFloors = Array.from(map.keys()).sort((a, b) => a - b);
    return sortedFloors.map((fl) => ({
      floorNum: fl,
      floorLabel: fl === 0 ? 'Ground Floor' : `Floor ${fl}`,
      rooms: map.get(fl) || [],
    }));
  }, [floorPlanBlockData]);

  return (
    <div className="campusstay-management-page" style={{ padding: '1.5rem', background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`mgmt-toast ${toastMessage.type}`}
          role="status"
          style={{
            position: 'fixed',
            bottom: '1.5rem',
            right: '1.5rem',
            zIndex: 9999,
            background: toastMessage.type === 'success' ? '#065F46' : '#991B1B',
            color: '#FFFFFF',
            padding: '0.85rem 1.25rem',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.9rem',
            fontWeight: 600,
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Header */}
      <div className="block-header-wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="block-header-title" style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Hostel Block & Floor Plan Management
          </h1>
          <p className="block-header-subtitle" style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
            Manage BH-1, BH-2, GH-1 residential blocks, interactive floor plans, rooms, bed capacities, and maintenance status.
          </p>
        </div>

        <div className="block-header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={() => fetchBlocks(true)}
            disabled={isRefreshing}
            style={{
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              borderRadius: '10px',
              padding: '0.6rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 600,
              color: '#334155',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              background: 'linear-gradient(135deg, #4F46E5 0%, #3730A3 100%)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '10px',
              padding: '0.6rem 1.1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
            }}
          >
            <Plus size={16} />
            <span>+ Add New Block</span>
          </button>
        </div>
      </div>

      {/* Scope Info Banner for Wardens */}
      {blocks.length > roleScopedBlocks.length && (
        <div style={{
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          color: '#1E40AF',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          marginBottom: '1.25rem',
          fontSize: '0.875rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.65rem',
        }}>
          <Info size={20} color="#2563EB" style={{ flexShrink: 0 }} />
          <div>
            <strong>Scoped Role Access ({user?.role}):</strong> Displaying {roleScopedBlocks.length} assigned block(s) out of {blocks.length} total blocks stored in PostgreSQL database. To view or manage all blocks (BH-1, BH-2, GH-1), log in as <strong>Main Admin (ADMIN_MAIN)</strong>.
          </div>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Search blocks by name (BH-1, BH-2, GH-1), code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.65rem 1rem 0.65rem 2.4rem',
              borderRadius: '10px',
              border: '1px solid #CBD5E1',
              fontSize: '0.875rem',
              outline: 'none',
              background: '#FFFFFF',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: statusFilter === st ? 'none' : '1px solid #CBD5E1',
                background: statusFilter === st ? '#1E1B4B' : '#FFFFFF',
                color: statusFilter === st ? '#FFFFFF' : '#475569',
              }}
            >
              {st === 'ALL' ? `All (${counts.total})` : st === 'ACTIVE' ? `Active (${counts.active})` : `Inactive (${counts.inactive})`}
            </button>
          ))}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && blocks.length === 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.25rem' }}>
          {[1, 2, 3].map((n) => (
            <div key={n} style={{ height: '220px', background: '#E2E8F0', borderRadius: '16px' }} />
          ))}
        </div>
      )}

      {/* Block Cards Grid */}
      {!isLoading && displayBlocks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {displayBlocks.map((block) => {
            const isActive = block.status === 'ACTIVE';
            const isBoys =
              block.name.toLowerCase().includes('boys') ||
              block.code.toUpperCase().startsWith('BH') ||
              block.code.toUpperCase().startsWith('BB');

            const totalCapacity = block.totalCapacity ?? 0;
            const occupied = block.occupied ?? 0;
            const vacant = block.vacant ?? Math.max(0, totalCapacity - occupied - (block.maintenance ?? 0));
            const maintenance = block.maintenance ?? 0;
            const vacancyRate = block.vacancyRate ?? (totalCapacity > 0 ? `${Math.round((vacant / totalCapacity) * 100)}%` : '0%');
            const decorativeLetter = getDecorativeLetter(block);

            return (
              <div
                key={block.id}
                style={{
                  background: '#FFFFFF',
                  borderRadius: '16px',
                  padding: '1.5rem',
                  border: '1px solid #E2E8F0',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.03)',
                  position: 'relative',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                {/* Decorative Watermark */}
                <span
                  style={{
                    position: 'absolute',
                    right: '-10px',
                    bottom: '-15px',
                    fontSize: '6rem',
                    fontWeight: 900,
                    color: '#F1F5F9',
                    userSelect: 'none',
                    pointerEvents: 'none',
                    letterSpacing: '-0.05em',
                  }}
                >
                  {decorativeLetter}
                </span>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                          {block.name}
                        </h3>
                        <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: '20px', background: isBoys ? '#EFF6FF' : '#FCE7F3', color: isBoys ? '#1D4ED8' : '#DB2777' }}>
                          {isBoys ? 'Boys Hostel' : 'Girls Hostel'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
                        Code: <strong>{block.code}</strong> — {block.description || 'Hostel Residential Wing'}
                      </p>
                    </div>

                    <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '12px', background: isActive ? '#DCFCE7' : '#F1F5F9', color: isActive ? '#15803D' : '#64748B' }}>
                      {isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Metrics List */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', background: '#F8FAFC', padding: '0.85rem', borderRadius: '12px', marginBottom: '1.25rem', fontSize: '0.825rem' }}>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Total Capacity</span>
                      <strong style={{ fontSize: '1rem', color: '#0F172A' }}>{totalCapacity} Beds</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Occupied</span>
                      <strong style={{ fontSize: '1rem', color: '#16A34A' }}>{occupied} Beds</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Vacant (Rate)</span>
                      <strong style={{ fontSize: '1rem', color: '#2563EB' }}>{vacant} Beds ({vacancyRate})</strong>
                    </div>
                    <div>
                      <span style={{ color: '#64748B', display: 'block', fontSize: '0.75rem' }}>Maintenance</span>
                      <strong style={{ fontSize: '1rem', color: '#D97706' }}>{maintenance} Beds</strong>
                    </div>
                  </div>
                </div>

                {/* Card Footer Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9', zIndex: 2 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenFloorPlan(block)}
                    style={{
                      flex: 2,
                      background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)',
                      color: '#4338CA',
                      border: '1px solid #C7D2FE',
                      borderRadius: '8px',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.35rem',
                    }}
                  >
                    <LayoutGrid size={14} />
                    <span>Floor Plan & Rooms</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(block)}
                    style={{
                      flex: 1,
                      background: '#FFFFFF',
                      color: '#334155',
                      border: '1px solid #CBD5E1',
                      borderRadius: '8px',
                      padding: '0.55rem 0.75rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.25rem',
                    }}
                  >
                    <Edit2 size={13} />
                    <span>Edit</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenDelete(block)}
                    style={{
                      background: '#FEF2F2',
                      color: '#DC2626',
                      border: '1px solid #FCA5A5',
                      borderRadius: '8px',
                      padding: '0.55rem 0.65rem',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    title="Delete Block"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =========================================================================
          INTERACTIVE FLOOR PLAN & ROOM LAYOUT EDITOR MODAL
          ========================================================================= */}
      {selectedFloorPlanBlock && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '1100px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
            
            {/* Modal Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                  <LayoutGrid size={22} color="#818CF8" />
                  <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                    {selectedFloorPlanBlock.name} — Interactive Floor Plan Editor
                  </h2>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '0.25rem 0 0 2rem' }}>
                  Block Code: <strong>{selectedFloorPlanBlock.code}</strong> | View and edit rooms, capacities, and maintenance status floor by floor.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => handleOpenAddRoom(activeFloorFilter === 'ALL' ? 1 : activeFloorFilter)}
                  style={{
                    background: '#4F46E5',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.55rem 0.95rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                  }}
                >
                  <Plus size={15} /> Add Room
                </button>

                <button
                  type="button"
                  onClick={handleCloseFloorPlan}
                  style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
              {floorPlanLoading ? (
                <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                  <RotateCw size={24} className="spin-anim" style={{ marginBottom: '0.5rem' }} />
                  <div>Loading block rooms and floor plan...</div>
                </div>
              ) : (
                <>
                  {/* Summary Bar */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Configured Rooms</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0F172A' }}>
                        {floorPlanBlockData?.rooms?.length || 0}
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Bed Capacity</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#4F46E5' }}>
                        {floorPlanBlockData?.totalCapacity || 0} Beds
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Allocated Residents</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#16A34A' }}>
                        {floorPlanBlockData?.occupied || 0} Residents
                      </div>
                    </div>
                    <div style={{ background: '#FFFFFF', padding: '0.85rem 1rem', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Under Maintenance</span>
                      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#D97706' }}>
                        {floorPlanBlockData?.maintenance || 0} Beds
                      </div>
                    </div>
                  </div>

                  {/* Floor Filter Tabs */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid #CBD5E1', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => setActiveFloorFilter('ALL')}
                      style={{
                        padding: '0.45rem 0.95rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: activeFloorFilter === 'ALL' ? '#4F46E5' : '#FFFFFF',
                        color: activeFloorFilter === 'ALL' ? '#FFFFFF' : '#475569',
                        border: activeFloorFilter === 'ALL' ? 'none' : '1px solid #CBD5E1',
                      }}
                    >
                      All Floors ({floorPlanBlockData?.rooms?.length || 0} Rooms)
                    </button>
                    {floorGroupings.map((fg) => (
                      <button
                        key={fg.floorNum}
                        type="button"
                        onClick={() => setActiveFloorFilter(fg.floorNum)}
                        style={{
                          padding: '0.45rem 0.95rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: activeFloorFilter === fg.floorNum ? '#4F46E5' : '#FFFFFF',
                          color: activeFloorFilter === fg.floorNum ? '#FFFFFF' : '#475569',
                          border: activeFloorFilter === fg.floorNum ? 'none' : '1px solid #CBD5E1',
                        }}
                      >
                        {fg.floorLabel} ({fg.rooms.length} Rooms)
                      </button>
                    ))}
                  </div>

                  {/* Floor Plan Section Breakdown */}
                  {floorGroupings
                    .filter((fg) => activeFloorFilter === 'ALL' || activeFloorFilter === fg.floorNum)
                    .map((fg) => (
                      <div key={fg.floorNum} style={{ marginBottom: '1.5rem', background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', paddingBottom: '0.5rem', borderBottom: '1px solid #F1F5F9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Layers size={18} color="#4F46E5" />
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                              {fg.floorLabel}
                            </h3>
                            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '12px' }}>
                              {fg.rooms.length} Rooms Configured
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenAddRoom(fg.floorNum)}
                            style={{
                              background: '#EEF2FF',
                              color: '#4F46E5',
                              border: '1px solid #C7D2FE',
                              borderRadius: '6px',
                              padding: '0.35rem 0.65rem',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                          >
                            <Plus size={13} /> Add Room to {fg.floorLabel}
                          </button>
                        </div>

                        {/* Room Cards Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
                          {fg.rooms.map((r) => {
                            const isMaintenance = r.status === 'UNDER_MAINTENANCE';
                            const isInactive = r.status === 'INACTIVE';
                            const activeCount = r.allocations?.length || 0;
                            const isFull = activeCount >= (r.capacity || 2);

                            return (
                              <div
                                key={r.id}
                                style={{
                                  background: isMaintenance ? '#FFFBEB' : isInactive ? '#F8FAFC' : '#FFFFFF',
                                  border: isMaintenance ? '1px solid #FCD34D' : isInactive ? '1px solid #E2E8F0' : isFull ? '1px solid #BBF7D0' : '1px solid #CBD5E1',
                                  borderRadius: '12px',
                                  padding: '1rem',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  justifyContent: 'space-between',
                                }}
                              >
                                <div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                                      Room {r.roomNumber}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: '0.7rem',
                                        fontWeight: 800,
                                        padding: '0.2rem 0.5rem',
                                        borderRadius: '12px',
                                        background: isMaintenance ? '#FEF3C7' : isFull ? '#DCFCE7' : '#EFF6FF',
                                        color: isMaintenance ? '#B45309' : isFull ? '#15803D' : '#1D4ED8',
                                      }}
                                    >
                                      {isMaintenance ? 'Maintenance' : isFull ? `Full (${activeCount}/${r.capacity})` : `Occupied (${activeCount}/${r.capacity})`}
                                    </span>
                                  </div>

                                  <div style={{ fontSize: '0.75rem', color: '#64748B', marginBottom: '0.65rem' }}>
                                    {r.roomType || 'Non-AC Room (2 Sharing)'}
                                  </div>

                                  {/* Occupant Badges */}
                                  {r.allocations && r.allocations.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginBottom: '0.75rem' }}>
                                      {r.allocations.map((al: any) => (
                                        <div key={al.id} style={{ fontSize: '0.75rem', color: '#1E293B', background: '#F1F5F9', padding: '0.35rem 0.5rem', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                          <UserCheck size={12} color="#16A34A" />
                                          <span style={{ fontWeight: 600 }}>{al.student?.name}</span>
                                          <span style={{ color: '#64748B', fontSize: '0.7rem' }}>({al.student?.jntuNo})</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.75rem', color: '#94A3B8', fontStyle: 'italic', marginBottom: '0.75rem' }}>
                                      No active occupants allocated
                                    </div>
                                  )}
                                </div>

                                {/* Room Action Buttons */}
                                <div style={{ display: 'flex', gap: '0.35rem', borderTop: '1px solid #E2E8F0', paddingTop: '0.6rem' }}>
                                  <button
                                    type="button"
                                    onClick={() => setInspectingRoom(r)}
                                    style={{
                                      flex: 1.5,
                                      background: '#EEF2FF',
                                      color: '#4338CA',
                                      border: '1px solid #C7D2FE',
                                      borderRadius: '6px',
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.25rem',
                                    }}
                                    title="View who is in this room"
                                  >
                                    <Eye size={12} /> Inspect ({activeCount})
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditRoom(r)}
                                    style={{
                                      flex: 1,
                                      background: '#FFFFFF',
                                      color: '#334155',
                                      border: '1px solid #CBD5E1',
                                      borderRadius: '6px',
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      gap: '0.2rem',
                                    }}
                                  >
                                    <Edit2 size={12} /> Edit
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleMaintenance(r)}
                                    style={{
                                      background: isMaintenance ? '#DCFCE7' : '#FEF3C7',
                                      color: isMaintenance ? '#15803D' : '#B45309',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                    }}
                                    title={isMaintenance ? 'Mark as Active' : 'Mark as Maintenance'}
                                  >
                                    <Wrench size={12} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteRoom(r)}
                                    style={{
                                      background: '#FEF2F2',
                                      color: '#DC2626',
                                      border: 'none',
                                      borderRadius: '6px',
                                      padding: '0.3rem 0.5rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 600,
                                      cursor: 'pointer',
                                    }}
                                    title="Delete Room"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ padding: '1rem 1.5rem', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleCloseFloorPlan}
                style={{
                  background: '#1E1B4B',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.6rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Close Floor Plan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          "WHO IS IN THIS ROOM" OCCUPANT INSPECTION MODAL
          ========================================================================= */}
      {inspectingRoom && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10050, background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }} onClick={() => setInspectingRoom(null)}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)' }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '1.25rem 1.5rem', background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 100%)', color: '#FFFFFF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Users size={20} color="#818CF8" />
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                    Room {inspectingRoom.roomNumber} Occupants — {selectedFloorPlanBlock?.name || inspectingRoom.block?.name || 'Hostel Block'}
                  </h3>
                </div>
                <p style={{ fontSize: '0.8rem', color: '#94A3B8', margin: '0.25rem 0 0 1.75rem' }}>
                  Floor {inspectingRoom.floor || 1} • {inspectingRoom.roomType || 'Non-AC Room'} • Capacity: {inspectingRoom.allocations?.length || 0} / {inspectingRoom.capacity} Occupied
                </p>
              </div>
              <button type="button" onClick={() => setInspectingRoom(null)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: '0.25rem' }}>
                <X size={22} />
              </button>
            </div>

            {/* Body: Occupants List by Bed */}
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1, background: '#F8FAFC' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: '#334155', margin: 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Resident Bed Allocations ({inspectingRoom.allocations?.length || 0} / {inspectingRoom.capacity})
                </h4>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.6rem', borderRadius: '12px', background: (inspectingRoom.allocations?.length || 0) >= inspectingRoom.capacity ? '#DCFCE7' : '#FEF3C7', color: (inspectingRoom.allocations?.length || 0) >= inspectingRoom.capacity ? '#15803D' : '#B45309' }}>
                  {(inspectingRoom.allocations?.length || 0) >= inspectingRoom.capacity ? 'Fully Occupied' : `${inspectingRoom.capacity - (inspectingRoom.allocations?.length || 0)} Bed(s) Available`}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {Array.from({ length: inspectingRoom.capacity || 2 }).map((_, idx) => {
                  const bedTag = `Bed-${idx + 1}`;
                  const alloc = inspectingRoom.allocations?.find((a: any) => a.bedNumber === bedTag || a.bedNumber === `Bed ${idx + 1}`) || inspectingRoom.allocations?.[idx];
                  const student = alloc?.student;

                  return (
                    <div key={idx} style={{ background: '#FFFFFF', borderRadius: '12px', padding: '1.15rem', border: student ? '1px solid #CBD5E1' : '2px dashed #CBD5E1', display: 'flex', gap: '1rem', alignItems: 'center', boxShadow: student ? '0 2px 8px rgba(0,0,0,0.04)' : 'none' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: student ? '#1E1B4B' : '#E2E8F0', color: student ? '#FFFFFF' : '#64748B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 }}>
                        {student ? student.name.slice(0, 2).toUpperCase() : `B${idx + 1}`}
                      </div>

                      {student ? (
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div>
                              <h4 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                                {student.name}
                              </h4>
                              <span style={{ fontSize: '0.78rem', color: '#64748B', fontWeight: 600 }}>
                                Roll No / JNTU No: <strong style={{ color: '#1E1B4B' }}>{student.jntuNo}</strong> • {student.department || 'CSE'}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.725rem', fontWeight: 700, padding: '0.2rem 0.65rem', borderRadius: '12px', background: '#DCFCE7', color: '#15803D' }}>
                              {bedTag} • Active Resident
                            </span>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.75rem', paddingTop: '0.65rem', borderTop: '1px solid #F1F5F9', fontSize: '0.8rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                              <Phone size={13} color="#2563EB" />
                              <a href={`tel:${student.phone}`} style={{ color: '#2563EB', fontWeight: 600, textDecoration: 'none' }}>
                                {student.phone || 'No phone recorded'}
                              </a>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#334155' }}>
                              <Mail size={13} color="#64748B" />
                              <span>{student.email || 'No email recorded'}</span>
                            </div>
                            {student.parentName && (
                              <div style={{ gridColumn: 'span 2', fontSize: '0.78rem', color: '#475569', background: '#F8FAFC', padding: '0.35rem 0.6rem', borderRadius: '6px' }}>
                                <strong>Parent/Guardian:</strong> {student.parentName} ({student.parentPhone || 'Verified contact'})
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#64748B', margin: 0 }}>
                              {bedTag} — Vacant Bed
                            </h4>
                            <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '0.15rem 0 0 0' }}>
                              This bed is available for new resident allocation.
                            </p>
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '0.3rem 0.65rem', borderRadius: '8px', border: '1px solid #A7F3D0' }}>
                            Available Vacancy
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '1rem 1.5rem', background: '#FFFFFF', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setInspectingRoom(null)} style={{ background: '#1E1B4B', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, cursor: 'pointer' }}>
                Close Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD / EDIT ROOM MODAL (INSIDE FLOOR PLAN EDITOR)
          ========================================================================= */}
      {isRoomModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '480px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {editingRoom ? `Edit Room ${editingRoom.roomNumber}` : `Add New Room to ${selectedFloorPlanBlock?.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setIsRoomModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {roomFormError && (
              <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {roomFormError}
              </div>
            )}

            <form onSubmit={handleSaveRoom}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Room Number *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 101, 119, 201"
                    value={roomFormData.roomNumber}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                      Floor Number *
                    </label>
                    <select
                      value={roomFormData.floor}
                      onChange={(e) => setRoomFormData({ ...roomFormData, floor: Number(e.target.value) })}
                      style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    >
                      <option value={0}>Ground Floor</option>
                      <option value={1}>Floor 1</option>
                      <option value={2}>Floor 2</option>
                      <option value={3}>Floor 3</option>
                      <option value={4}>Floor 4</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                      Bed Capacity *
                    </label>
                    <select
                      value={roomFormData.capacity}
                      onChange={(e) => setRoomFormData({ ...roomFormData, capacity: Number(e.target.value) })}
                      style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                    >
                      <option value={1}>1 Bed (Single)</option>
                      <option value={2}>2 Beds (Double Sharing)</option>
                      <option value={3}>3 Beds (Triple Sharing)</option>
                      <option value={4}>4 Beds (Four Sharing)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Room Type & Specification
                  </label>
                  <select
                    value={roomFormData.roomType}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  >
                    <option value="Non-AC Room (2 Sharing)">Non-AC Room (2 Sharing)</option>
                    <option value="AC Room (2 Sharing)">AC Room (2 Sharing)</option>
                    <option value="Non-AC Room (3 Sharing)">Non-AC Room (3 Sharing)</option>
                    <option value="AC Room (3 Sharing)">AC Room (3 Sharing)</option>
                    <option value="Deluxe Single AC Room">Deluxe Single AC Room</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Operational Status
                  </label>
                  <select
                    value={roomFormData.status}
                    onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value as any })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  >
                    <option value="ACTIVE">Active / Operational</option>
                    <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                    <option value="INACTIVE">Inactive / Decommissioned</option>
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsRoomModalOpen(false)}
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRoom}
                    style={{ background: '#4F46E5', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    {isSubmittingRoom ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          CREATE / EDIT BLOCK MODAL
          ========================================================================= */}
      {isFormModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '500px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                {editingBlock ? `Edit Block ${editingBlock.name}` : 'Add New Residential Block'}
              </h3>
              <button type="button" onClick={() => setIsFormModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '0.75rem 1rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Block Name * (e.g. BH-1, BH-2, GH-1)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BH-1, BH-2, GH-1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Block Code * (Unique identifier)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. BH-1, BH-2, GH-1"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Description
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Residential wing description, location, or notes..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '0.35rem' }}>
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    style={{ width: '100%', padding: '0.6rem 0.85rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.875rem' }}
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </div>

                {/* Floor & Room Architecture Setup Card */}
                <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '12px', padding: '1rem', marginTop: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Layers size={16} color="#4F46E5" />
                    <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0F172A' }}>
                      Floor &amp; Room Architecture Setup
                    </h4>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                        Total Floors
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={formData.totalFloors}
                        onChange={(e) => setFormData({ ...formData, totalFloors: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                        Rooms Per Floor
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={30}
                        value={formData.roomsPerFloor}
                        onChange={(e) => setFormData({ ...formData, roomsPerFloor: parseInt(e.target.value, 10) || 1 })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                        Bed Capacity / Room
                      </label>
                      <select
                        value={formData.roomCapacity}
                        onChange={(e) => setFormData({ ...formData, roomCapacity: parseInt(e.target.value, 10) || 2 })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      >
                        <option value={1}>1 Bed (Single Room)</option>
                        <option value={2}>2 Beds (2 Sharing)</option>
                        <option value={3}>3 Beds (3 Sharing)</option>
                        <option value={4}>4 Beds (4 Sharing)</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '0.25rem' }}>
                        Room Classification
                      </label>
                      <select
                        value={formData.roomType}
                        onChange={(e) => setFormData({ ...formData, roomType: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      >
                        <option value="Non-AC Room (2 Sharing)">Non-AC Room (2 Sharing)</option>
                        <option value="AC Deluxe Room">AC Deluxe Room</option>
                        <option value="Standard 3-Sharing">Standard 3-Sharing</option>
                        <option value="Single AC Executive">Single AC Executive</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem' }}>
                    <input
                      type="checkbox"
                      id="auto-gen-rooms"
                      checked={formData.autoGenerateRooms}
                      onChange={(e) => setFormData({ ...formData, autoGenerateRooms: e.target.checked })}
                      style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                    />
                    <label htmlFor="auto-gen-rooms" style={{ fontSize: '0.8rem', color: '#1E293B', fontWeight: 600, cursor: 'pointer' }}>
                      {editingBlock ? 'Generate floor rooms batch for this block' : `Auto-generate ${formData.totalFloors * formData.roomsPerFloor} rooms (e.g. 101-10${formData.roomsPerFloor}, 201-20${formData.roomsPerFloor}...)`}
                    </label>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.6rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{ background: '#4F46E5', border: 'none', borderRadius: '8px', padding: '0.6rem 1.25rem', fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                  >
                    {isSubmitting ? 'Saving Block & Generating Rooms...' : editingBlock ? 'Update Block' : 'Create Block & Generate Rooms'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE BLOCK CONFIRMATION MODAL
          ========================================================================= */}
      {deleteModalBlock && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '440px', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
              <AlertTriangle size={24} color="#DC2626" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', margin: 0 }}>
                  Delete Hostel Block?
                </h3>
                <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
                  Target: <strong>{deleteModalBlock.name}</strong> ({deleteModalBlock.code})
                </p>
              </div>
            </div>

            {deleteError ? (
              <div style={{ padding: '0.85rem', background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: '10px', fontSize: '0.85rem', marginBottom: '1rem' }}>
                <strong>Cannot Delete Block:</strong> {deleteError}
              </div>
            ) : (
              <p style={{ fontSize: '0.85rem', color: '#475569', marginBottom: '1.25rem' }}>
                Are you sure you want to delete this hostel block? Relational safety checks will prevent deletion if students or rooms are assigned.
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button
                type="button"
                onClick={() => setDeleteModalBlock(null)}
                style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
              >
                {deleteError ? 'Close' : 'Cancel'}
              </button>

              {!deleteError && (
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  style={{ background: '#DC2626', border: 'none', borderRadius: '8px', padding: '0.55rem 1rem', fontSize: '0.85rem', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer' }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Block'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
