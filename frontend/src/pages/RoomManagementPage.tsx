import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BedDouble,
  Plus,
  Search,
  RotateCw,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Users,
  UserPlus,
  UserMinus,
  ArrowRightLeft,
  X,
  History,
  LayoutGrid,
  Filter,
  Fingerprint,
  Phone,
  Mail,
  GraduationCap,
  Calendar,
  ShieldCheck,
  Check,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  managementApiService,
  RoomItem,
  RoomAllocationItem,
  EligibleStudent,
  CreateRoomDto,
  Block,
  PendingAllocationItem,
} from '../services/api';

interface RoomManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const RoomManagementPage: React.FC<RoomManagementPageProps> = () => {
  // Navigation Tabs: 'pending' | 'rooms' | 'allocations'
  // Default is 'pending' for screenshot-accurate Room Allocation workflow
  const [activeTab, setActiveTab] = useState<'pending' | 'rooms' | 'allocations'>('pending');

  // =========================================================================
  //                       PENDING ALLOCATIONS STATE
  // =========================================================================
  const [pendingAllocations, setPendingAllocations] = useState<PendingAllocationItem[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [pendingPage, setPendingPage] = useState<number>(1);
  const [pendingLimit] = useState<number>(10);
  const [pendingTotalPages, setPendingTotalPages] = useState<number>(1);
  const [pendingLoading, setPendingLoading] = useState<boolean>(true);
  const [pendingRefreshing, setPendingRefreshing] = useState<boolean>(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  // Search & Filters for Pending Allocations
  const [residentSearchQuery, setResidentSearchQuery] = useState<string>('');
  const [pendingBlockFilter, setPendingBlockFilter] = useState<string>('ALL');
  const [pendingRoomTypeFilter, setPendingRoomTypeFilter] = useState<string>('ALL');
  const [pendingBiometricFilter, setPendingBiometricFilter] = useState<string>('ALL');

  // Modals for Pending Allocations
  // 1. Assign Modal
  const [isAssignModalOpen, setIsAssignModalOpen] = useState<boolean>(false);
  const [assignStudentTarget, setAssignStudentTarget] = useState<PendingAllocationItem | null>(null);
  const [selectedAssignRoomId, setSelectedAssignRoomId] = useState<string>('');
  const [selectedAssignBed, setSelectedAssignBed] = useState<string>('');
  const [assignModalBlockFilter, setAssignModalBlockFilter] = useState<string>('ALL');
  const [assignError, setAssignError] = useState<string | null>(null);
  const [isAssigning, setIsAssigning] = useState<boolean>(false);

  // 2. Reject Modal
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [rejectStudentTarget, setRejectStudentTarget] = useState<PendingAllocationItem | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('');
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<boolean>(false);

  // 3. View Modal
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [viewStudentTarget, setViewStudentTarget] = useState<PendingAllocationItem | null>(null);

  // 4. Biometric Status Mapping Modal
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState<boolean>(false);
  const [biometricSyncing, setBiometricSyncing] = useState<boolean>(false);

  // 5. Filter Modal
  const [isFilterModalOpen, setIsFilterModalOpen] = useState<boolean>(false);

  // 6. Login Credentials Receipt Modal
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState<boolean>(false);
  const [credentialsModalData, setCredentialsModalData] = useState<{
    name: string;
    jntuNo: string;
    email: string;
    blockName: string;
    roomNumber: string;
    bedNumber?: string | null;
    passwordHint?: string;
  } | null>(null);

  // =========================================================================
  //                       ROOMS & ALLOCATIONS STATE
  // =========================================================================
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Allocations History State
  const [allocations, setAllocations] = useState<RoomAllocationItem[]>([]);
  const [allocationsLoading, setAllocationsLoading] = useState<boolean>(false);

  // Rooms Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [blockFilter, setBlockFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [occupancyFilter, setOccupancyFilter] = useState<string>('ALL');

  // Room Create/Edit Modal State
  const [isRoomModalOpen, setIsRoomModalOpen] = useState<boolean>(false);
  const [editingRoom, setEditingRoom] = useState<RoomItem | null>(null);
  const [roomFormData, setRoomFormData] = useState<CreateRoomDto>({
    blockId: '',
    roomNumber: '',
    floor: 1,
    roomType: 'Non-AC Room (2 Sharing)',
    capacity: 2,
    status: 'ACTIVE',
  });
  const [roomFormError, setRoomFormError] = useState<string | null>(null);
  const [isSubmittingRoom, setIsSubmittingRoom] = useState<boolean>(false);

  // Allocate Student Modal State (from rooms overview)
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState<boolean>(false);
  const [eligibleStudents, setEligibleStudents] = useState<EligibleStudent[]>([]);
  const [allocateBlockId, setAllocateBlockId] = useState<string>('');
  const [allocateRoomId, setAllocateRoomId] = useState<string>('');
  const [allocateStudentId, setAllocateStudentId] = useState<string>('');
  const [allocateBedNumber, setAllocateBedNumber] = useState<string>('');
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [isSubmittingAllocation, setIsSubmittingAllocation] = useState<boolean>(false);

  // Vacate Modal State
  const [vacateModalData, setVacateModalData] = useState<{
    allocationId: string;
    studentName: string;
    roomNumber: string;
    blockName: string;
    bedNumber?: string | null;
  } | null>(null);
  const [isVacating, setIsVacating] = useState<boolean>(false);
  const [vacateError, setVacateError] = useState<string | null>(null);

  // Reallocate Modal State
  const [reallocateModalData, setReallocateModalData] = useState<{
    allocationId: string;
    studentId: string;
    studentName: string;
    currentRoomNumber: string;
    currentBlockName: string;
    currentBedNumber?: string | null;
  } | null>(null);
  const [targetBlockId, setTargetBlockId] = useState<string>('');
  const [targetRoomId, setTargetRoomId] = useState<string>('');
  const [newBedNumber, setNewBedNumber] = useState<string>('');
  const [isReallocating, setIsReallocating] = useState<boolean>(false);
  const [reallocateError, setReallocateError] = useState<string | null>(null);

  // Delete Room Modal State
  const [deleteRoomTarget, setDeleteRoomTarget] = useState<RoomItem | null>(null);
  const [isDeletingRoom, setIsDeletingRoom] = useState<boolean>(false);
  const [deleteRoomError, setDeleteRoomError] = useState<string | null>(null);

  // Toast State
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // =========================================================================
  //                          DATA FETCHING METHODS
  // =========================================================================

  // Fetch Pending Allocations from PostgreSQL
  const fetchPendingAllocations = useCallback(async (isBg = false) => {
    if (!isBg) setPendingLoading(true);
    else setPendingRefreshing(true);
    setPendingError(null);

    try {
      const res = await managementApiService.getPendingAllocations({
        search: residentSearchQuery.trim() || undefined,
        block: pendingBlockFilter !== 'ALL' ? pendingBlockFilter : undefined,
        roomType: pendingRoomTypeFilter !== 'ALL' ? pendingRoomTypeFilter : undefined,
        biometricStatus: pendingBiometricFilter !== 'ALL' ? pendingBiometricFilter : undefined,
        page: pendingPage,
        limit: pendingLimit,
      });

      setPendingAllocations(res.data || []);
      setPendingCount(res.pendingCount || 0);
      setPendingTotal(res.total || 0);
      setPendingTotalPages(res.totalPages || 1);
    } catch (err: any) {
      console.error('Failed to fetch pending allocations:', err);
      setPendingError(err.message || 'Failed to load pending allocations.');
    } finally {
      setPendingLoading(false);
      setPendingRefreshing(false);
    }
  }, [residentSearchQuery, pendingBlockFilter, pendingRoomTypeFilter, pendingBiometricFilter, pendingPage, pendingLimit]);

  // Fetch Blocks for Dropdowns
  const fetchBlocks = useCallback(async () => {
    try {
      const res = await managementApiService.getBlocks();
      setBlocks(res.blocks || []);
    } catch (err) {
      console.error('Failed to load blocks for dropdowns:', err);
    }
  }, []);

  // Fetch authoritative rooms from PostgreSQL
  const fetchRooms = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const response = await managementApiService.getRooms({
        block: blockFilter,
        status: statusFilter,
        occupancy: occupancyFilter,
        search: searchTerm,
      });
      setRooms(response.rooms || []);
    } catch (err: any) {
      console.error('Failed to fetch rooms:', err);
      setError(err.message || 'Unable to load rooms from database.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [blockFilter, statusFilter, occupancyFilter, searchTerm]);

  // Fetch allocations history
  const fetchAllocations = useCallback(async () => {
    setAllocationsLoading(true);
    try {
      const res = await managementApiService.getAllocations({
        search: searchTerm,
      });
      setAllocations(res.allocations || []);
    } catch (err: any) {
      console.error('Failed to fetch allocations:', err);
    } finally {
      setAllocationsLoading(false);
    }
  }, [searchTerm]);

  // Initial load
  useEffect(() => {
    fetchBlocks();
    fetchPendingAllocations(false);
    fetchRooms(false);
  }, [fetchBlocks, fetchPendingAllocations, fetchRooms]);

  useEffect(() => {
    if (activeTab === 'allocations') {
      fetchAllocations();
    } else if (activeTab === 'pending') {
      fetchPendingAllocations(true);
    }
  }, [activeTab, fetchAllocations, fetchPendingAllocations]);

  // Real-time SSE synchronization
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (
        event?.type === 'ROOM_CREATED' ||
        event?.type === 'ROOM_UPDATED' ||
        event?.type === 'ROOM_DELETED' ||
        event?.type === 'STUDENT_ALLOCATED' ||
        event?.type === 'STUDENT_VACATED' ||
        event?.type === 'STUDENT_REALLOCATED' ||
        event?.type === 'ALLOCATION_REJECTED' ||
        event?.type === 'ROOM_ALLOCATION_CHANGED'
      ) {
        fetchPendingAllocations(true);
        fetchRooms(true);
        if (activeTab === 'allocations') {
          fetchAllocations();
        }
      }
    });

    return () => unsubscribe();
  }, [fetchPendingAllocations, fetchRooms, fetchAllocations, activeTab]);

  // =========================================================================
  //                  PENDING ALLOCATION ACTIONS (STEP 3)
  // =========================================================================

  // Open Assign Modal for a pending resident
  const handleOpenAssignModal = (item: PendingAllocationItem) => {
    setAssignStudentTarget(item);
    setSelectedAssignRoomId('');
    setSelectedAssignBed('');
    setAssignError(null);
    setAssignModalBlockFilter(item.preferences.blockPreference || 'ALL');
    setIsAssignModalOpen(true);
  };

  // Rooms available for pending allocation
  const availableRoomsForPending = useMemo(() => {
    return rooms.filter((r) => {
      if (r.status !== 'ACTIVE') return false;
      if (r.occupancy >= r.capacity) return false;
      if (assignModalBlockFilter !== 'ALL') {
        const matchesName = r.block.name.toLowerCase().includes(assignModalBlockFilter.toLowerCase());
        const matchesCode = r.block.code.toLowerCase().includes(assignModalBlockFilter.toLowerCase());
        const matchesId = r.blockId === assignModalBlockFilter;
        return matchesName || matchesCode || matchesId;
      }
      return true;
    });
  }, [rooms, assignModalBlockFilter]);

  // Selected room details in assign modal
  const selectedAssignRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedAssignRoomId) || null;
  }, [rooms, selectedAssignRoomId]);

  // Confirm Assign Pending Student to Room
  const handleConfirmAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignStudentTarget) return;
    setAssignError(null);

    if (!selectedAssignRoomId) {
      setAssignError('Please select a room with available vacancy.');
      return;
    }

    setIsAssigning(true);
    try {
      const res = await managementApiService.allocateStudent({
        roomId: selectedAssignRoomId,
        studentId: assignStudentTarget.studentId,
        bedNumber: selectedAssignBed.trim() ? selectedAssignBed.trim() : undefined,
      });

      const targetRoom = rooms.find((r) => r.id === selectedAssignRoomId);
      const studentName = assignStudentTarget.name;
      const studentJntu = assignStudentTarget.jntuNo;
      const studentEmail = assignStudentTarget.email;
      const blockName = targetRoom ? targetRoom.block.name : 'Hostel Block';
      const roomNumber = targetRoom ? targetRoom.roomNumber : 'Room';
      const bedNumber = selectedAssignBed.trim() || 'Bed-1';

      showToast(res.message || `Assigned ${studentName} successfully!`);
      setIsAssignModalOpen(false);
      setAssignStudentTarget(null);

      setCredentialsModalData({
        name: studentName,
        jntuNo: studentJntu,
        email: studentEmail,
        blockName,
        roomNumber,
        bedNumber,
        passwordHint: 'Password@123',
      });
      setIsCredentialsModalOpen(true);
      fetchPendingAllocations(false);
      fetchRooms(true);
    } catch (err: any) {
      setAssignError(err.message || 'Failed to allocate student to room.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Open Reject Modal
  const handleOpenRejectModal = (item: PendingAllocationItem) => {
    setRejectStudentTarget(item);
    setRejectReason('');
    setRejectError(null);
    setIsRejectModalOpen(true);
  };

  // Confirm Reject Pending Allocation
  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectStudentTarget) return;
    setRejectError(null);

    if (!rejectReason.trim() || rejectReason.trim().length < 4) {
      setRejectError('Please provide a specific reason for rejection (min 4 characters).');
      return;
    }

    setIsRejecting(true);
    try {
      const res = await managementApiService.rejectPendingAllocation(
        rejectStudentTarget.studentId,
        rejectReason.trim()
      );

      showToast(res.message || `Allocation request for ${rejectStudentTarget.name} rejected.`);
      setIsRejectModalOpen(false);
      setRejectStudentTarget(null);
      fetchPendingAllocations(false);
    } catch (err: any) {
      setRejectError(err.message || 'Failed to reject allocation request.');
    } finally {
      setIsRejecting(false);
    }
  };

  // Open View Modal
  const handleOpenViewModal = (item: PendingAllocationItem) => {
    setViewStudentTarget(item);
    setIsViewModalOpen(true);
  };

  // Biometric Sync handler
  const handleBiometricSync = async () => {
    setBiometricSyncing(true);
    try {
      await fetchPendingAllocations(true);
      showToast('Biometric status synchronized from authoritative access control logs.');
    } catch (err) {
      showToast('Failed to synchronize biometric status.', 'error');
    } finally {
      setBiometricSyncing(false);
    }
  };

  // =========================================================================
  //                  ROOMS INVENTORY CRUD HANDLERS
  // =========================================================================

  const handleOpenCreateModal = () => {
    setEditingRoom(null);
    const activeBlocks = blocks.filter((b) => b.status === 'ACTIVE');
    setRoomFormData({
      blockId: activeBlocks.length > 0 ? activeBlocks[0].id : '',
      roomNumber: '',
      floor: 1,
      roomType: 'Non-AC Room (2 Sharing)',
      capacity: 2,
      status: 'ACTIVE',
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  const handleOpenEditModal = (room: RoomItem) => {
    setEditingRoom(room);
    setRoomFormData({
      blockId: room.blockId,
      roomNumber: room.roomNumber,
      floor: room.floor || 1,
      roomType: room.roomType || 'Non-AC Room (2 Sharing)',
      capacity: room.capacity,
      status: room.status,
    });
    setRoomFormError(null);
    setIsRoomModalOpen(true);
  };

  const handleSubmitRoomForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setRoomFormError(null);

    if (!roomFormData.blockId) {
      setRoomFormError('Please select a block for the room.');
      return;
    }
    if (!roomFormData.roomNumber.trim()) {
      setRoomFormError('Room number is required.');
      return;
    }
    if (roomFormData.capacity <= 0 || roomFormData.capacity > 10) {
      setRoomFormError('Capacity must be between 1 and 10.');
      return;
    }

    setIsSubmittingRoom(true);
    try {
      if (editingRoom) {
        await managementApiService.updateRoom(editingRoom.id, roomFormData);
        showToast(`Room '${roomFormData.roomNumber}' updated successfully.`);
      } else {
        await managementApiService.createRoom(roomFormData);
        showToast(`Room '${roomFormData.roomNumber}' created successfully.`);
      }
      setIsRoomModalOpen(false);
      fetchRooms(false);
    } catch (err: any) {
      setRoomFormError(err.message || 'Failed to save room.');
    } finally {
      setIsSubmittingRoom(false);
    }
  };

  const handleOpenAllocateModal = async (prefillRoom?: RoomItem) => {
    setAllocateError(null);
    setAllocateBedNumber('');
    setIsAllocateModalOpen(true);

    const activeBlocks = blocks.filter((b) => b.status === 'ACTIVE');
    const defaultBlockId = prefillRoom ? prefillRoom.blockId : activeBlocks.length > 0 ? activeBlocks[0].id : '';
    setAllocateBlockId(defaultBlockId);
    setAllocateRoomId(prefillRoom ? prefillRoom.id : '');

    try {
      const res = await managementApiService.getEligibleStudents();
      setEligibleStudents(res.students || []);
      setAllocateStudentId(res.students.length > 0 ? res.students[0].id : '');
    } catch (err) {
      console.error('Failed to load eligible students:', err);
    }
  };

  const availableRoomsForAllocation = useMemo(() => {
    if (!allocateBlockId) return [];
    return rooms.filter(
      (r) => r.blockId === allocateBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity
    );
  }, [rooms, allocateBlockId]);

  const handleSubmitAllocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setAllocateError(null);

    if (!allocateRoomId) {
      setAllocateError('Please select a room with vacancy.');
      return;
    }
    if (!allocateStudentId) {
      setAllocateError('Please select an eligible student.');
      return;
    }

    setIsSubmittingAllocation(true);
    try {
      const res = await managementApiService.allocateStudent({
        roomId: allocateRoomId,
        studentId: allocateStudentId,
        bedNumber: allocateBedNumber.trim() ? allocateBedNumber.trim() : undefined,
      });

      const targetRoom = rooms.find((r) => r.id === allocateRoomId);
      const student = eligibleStudents.find((s) => s.id === allocateStudentId);

      showToast(res.message || 'Student allocated successfully.');
      setIsAllocateModalOpen(false);

      if (student) {
        setCredentialsModalData({
          name: student.name,
          jntuNo: student.jntuNo,
          email: student.email,
          blockName: targetRoom ? targetRoom.block.name : 'Hostel Block',
          roomNumber: targetRoom ? targetRoom.roomNumber : 'Room',
          bedNumber: allocateBedNumber.trim() || 'Bed-1',
          passwordHint: 'Password@123',
        });
        setIsCredentialsModalOpen(true);
      }
      fetchRooms(false);
      fetchPendingAllocations(true);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setAllocateError(err.message || 'Failed to allocate student to room.');
    } finally {
      setIsSubmittingAllocation(false);
    }
  };

  const handleConfirmVacate = async () => {
    if (!vacateModalData) return;
    setIsVacating(true);
    setVacateError(null);

    try {
      const res = await managementApiService.vacateStudent(vacateModalData.allocationId);
      showToast(res.message || 'Student vacated successfully.');
      setVacateModalData(null);
      fetchRooms(false);
      fetchPendingAllocations(true);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setVacateError(err.message || 'Failed to vacate resident.');
    } finally {
      setIsVacating(false);
    }
  };

  const handleOpenReallocateModal = (alloc: {
    allocationId: string;
    studentId: string;
    studentName: string;
    currentRoomNumber: string;
    currentBlockName: string;
    currentBedNumber?: string | null;
  }) => {
    setReallocateModalData(alloc);
    setReallocateError(null);
    setNewBedNumber('');

    const activeBlocks = blocks.filter((b) => b.status === 'ACTIVE');
    const firstBlockId = activeBlocks.length > 0 ? activeBlocks[0].id : '';
    setTargetBlockId(firstBlockId);

    const vacantRooms = rooms.filter(
      (r) => r.blockId === firstBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity
    );
    setTargetRoomId(vacantRooms.length > 0 ? vacantRooms[0].id : '');
  };

  const handleConfirmReallocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reallocateModalData) return;
    setReallocateError(null);

    if (!targetRoomId) {
      setReallocateError('Please select a target room with available vacancy.');
      return;
    }

    setIsReallocating(true);
    try {
      const res = await managementApiService.reallocateStudent(reallocateModalData.allocationId, {
        targetRoomId,
        newBedNumber: newBedNumber.trim() ? newBedNumber.trim() : undefined,
      });

      showToast(res.message || 'Student reallocated successfully.');
      setReallocateModalData(null);
      fetchRooms(false);
      if (activeTab === 'allocations') fetchAllocations();
    } catch (err: any) {
      setReallocateError(err.message || 'Failed to reallocate resident.');
    } finally {
      setIsReallocating(false);
    }
  };

  const handleConfirmDeleteRoom = async () => {
    if (!deleteRoomTarget) return;
    setIsDeletingRoom(true);
    setDeleteRoomError(null);

    try {
      await managementApiService.deleteRoom(deleteRoomTarget.id);
      showToast(`Room '${deleteRoomTarget.roomNumber}' deleted successfully.`);
      setDeleteRoomTarget(null);
      fetchRooms(false);
    } catch (err: any) {
      setDeleteRoomError(err.message || 'Failed to delete room.');
    } finally {
      setIsDeletingRoom(false);
    }
  };

  // Helper date formatter
  const formatDate = (isoStr: string) => {
    if (!isoStr) return 'N/A';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  // =========================================================================
  //                                  RENDER
  // =========================================================================

  return (
    <div className="room-mgmt-page" style={{ padding: 'clamp(1rem, 2.5vw, 2rem)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`toast-alert ${toastMessage.type === 'success' ? 'toast-success' : 'toast-error'}`}
          role="status"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 18px',
            borderRadius: '8px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            background: toastMessage.type === 'success' ? '#10B981' : '#EF4444',
            color: '#FFFFFF',
            fontWeight: 500,
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top View-Switcher Tabs */}
      <div className="allocation-tabs-navigation" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pending'}
          onClick={() => setActiveTab('pending')}
          className={`allocation-nav-tab ${activeTab === 'pending' ? 'active' : ''}`}
        >
          <Users size={16} />
          <span>Pending Allocations</span>
          <span className="allocation-tab-badge">{pendingCount}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'rooms'}
          onClick={() => setActiveTab('rooms')}
          className={`allocation-nav-tab ${activeTab === 'rooms' ? 'active' : ''}`}
        >
          <LayoutGrid size={16} />
          <span>Room Inventory</span>
          <span className="allocation-tab-badge">{rooms.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'allocations'}
          onClick={() => setActiveTab('allocations')}
          className={`allocation-nav-tab ${activeTab === 'allocations' ? 'active' : ''}`}
        >
          <History size={16} />
          <span>Allocations History</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/*              TAB 1: PENDING ALLOCATIONS (STEP 3)                  */}
      {/* ================================================================= */}
      {activeTab === 'pending' && (
        <div className="allocation-view-container">
          {/* Header Section with Page Title and Status Indicator */}
          <div className="room-allocation-header-card">
            <div className="room-allocation-title-row">
              <h1 className="room-allocation-main-title">Room Allocation</h1>
              <div className="pending-allocations-badge" aria-live="polite">
                <span className="pending-badge-pulse-dot" />
                <span>{pendingCount} pending allocations</span>
              </div>
            </div>
          </div>

          {/* Search Bar */}
          <div className="allocation-search-wrap">
            <Search size={18} className="allocation-search-icon" />
            <input
              type="text"
              className="allocation-search-input"
              placeholder="Search by resident ID or name"
              value={residentSearchQuery}
              onChange={(e) => setResidentSearchQuery(e.target.value)}
              aria-label="Search by resident ID or name"
            />
            {residentSearchQuery && (
              <button
                type="button"
                onClick={() => setResidentSearchQuery('')}
                className="allocation-search-clear"
                title="Clear search query"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Action Bar */}
          <div className="allocation-action-bar">
            <button
              type="button"
              onClick={() => setIsBiometricModalOpen(true)}
              className="btn-navy-primary"
              title="View and verify resident biometric status"
            >
              <Fingerprint size={16} />
              <span>Map Biometric Status</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFilterModalOpen(true)}
              className="btn-navy-primary"
              title="Filter allocations by block or room type"
            >
              <Filter size={16} />
              <span>Filter</span>
              {(pendingBlockFilter !== 'ALL' || pendingRoomTypeFilter !== 'ALL' || pendingBiometricFilter !== 'ALL') && (
                <span className="filter-active-badge" />
              )}
            </button>

            <button
              type="button"
              onClick={() => fetchPendingAllocations(true)}
              className="btn-light-secondary"
              title="Fetch authoritative pending records from PostgreSQL"
              disabled={pendingRefreshing}
            >
              <RotateCw size={16} className={pendingRefreshing ? 'spin-anim' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Loading State */}
          {pendingLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
              <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                <RotateCw size={30} />
              </div>
              <p>Loading pending allocations from PostgreSQL...</p>
            </div>
          ) : pendingError ? (
            <div
              className="state-card error-state"
              style={{
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '12px',
              }}
            >
              <AlertTriangle size={32} style={{ color: '#DC2626', margin: '0 auto 0.5rem' }} />
              <h3 style={{ color: '#991B1B', margin: '0 0 0.5rem' }}>Database Error</h3>
              <p style={{ color: '#B91C1C', margin: '0 0 1rem' }}>{pendingError}</p>
              <button
                type="button"
                onClick={() => fetchPendingAllocations(false)}
                className="btn-navy-primary"
              >
                Retry
              </button>
            </div>
          ) : pendingAllocations.length === 0 ? (
            <div className="allocation-empty-state">
              <Users size={40} style={{ color: '#94A3B8' }} />
              <h3 className="empty-state-title">No pending allocations found</h3>
              <p className="empty-state-desc">
                {residentSearchQuery || pendingBlockFilter !== 'ALL'
                  ? 'No resident applications matched the active search or filter criteria.'
                  : 'All resident accommodations are currently allocated or processed in the database.'}
              </p>
              {(residentSearchQuery || pendingBlockFilter !== 'ALL' || pendingRoomTypeFilter !== 'ALL' || pendingBiometricFilter !== 'ALL') && (
                <button
                  type="button"
                  onClick={() => {
                    setResidentSearchQuery('');
                    setPendingBlockFilter('ALL');
                    setPendingRoomTypeFilter('ALL');
                    setPendingBiometricFilter('ALL');
                  }}
                  className="btn-light-secondary"
                  style={{ marginTop: '0.5rem' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            /* Pending Allocation Cards List */
            <div className="pending-cards-container">
              {pendingAllocations.map((item) => (
                <article key={item.id} className="pending-resident-card" aria-label={`Allocation request for ${item.name}`}>
                  {/* Top Section: Avatar + Student Name/JNTU + Date */}
                  <div className="pending-card-top">
                    <div className="pending-student-info">
                      <div className="student-avatar-badge" aria-hidden="true">
                        {item.name
                          .split(' ')
                          .filter(Boolean)
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </div>
                      <div className="student-identity-block">
                        <h2 className="student-full-name">{item.name}</h2>
                        <span className="student-jntu-id">{item.jntuNo}</span>
                      </div>
                    </div>

                    <div className="pending-submission-date" title={`Submission date: ${item.createdAt}`}>
                      <Calendar size={13} />
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Card Details Responsive Grid */}
                  <div className="pending-card-grid">
                    {/* 1. Contact */}
                    <div className="pending-grid-group">
                      <span className="pending-group-title">Contact</span>
                      <div className="pending-detail-line" title={item.phone}>
                        <Phone size={13} style={{ color: '#64748B', flexShrink: 0 }} />
                        <span>{item.phone}</span>
                      </div>
                      <div className="pending-detail-line" title={item.email}>
                        <Mail size={13} style={{ color: '#64748B', flexShrink: 0 }} />
                        <span>{item.email}</span>
                      </div>
                    </div>

                    {/* 2. Course Information */}
                    <div className="pending-grid-group">
                      <span className="pending-group-title">Course Information</span>
                      <div className="pending-detail-line" title={`${item.courseInfo.degree} - ${item.courseInfo.department}`}>
                        <GraduationCap size={14} style={{ color: '#64748B', flexShrink: 0 }} />
                        <span>{item.courseInfo.degree}</span>
                      </div>
                      <div className="pending-detail-line" style={{ fontSize: '0.8rem', color: '#475569' }}>
                        <span>{item.courseInfo.department}</span>
                      </div>
                      <div className="pending-detail-chips">
                        <span className="info-chip-tag">{item.courseInfo.year}</span>
                        <span className="info-chip-tag">{item.courseInfo.semester}</span>
                      </div>
                    </div>

                    {/* 3. Preference */}
                    <div className="pending-grid-group">
                      <span className="pending-group-title">Preference</span>
                      <div className="preference-highlight">
                        <BedDouble size={14} style={{ color: '#2563EB', flexShrink: 0 }} />
                        <span>{item.preferences.roomPreference}</span>
                      </div>
                      <div className="preference-sub-specs">
                        <span>
                          Block: <strong>{item.preferences.blockPreference}</strong>
                        </span>
                        <span>
                          Floor: <strong>{item.preferences.floorPreference}</strong>
                        </span>
                      </div>
                    </div>

                    {/* 4. Documents / Verification */}
                    <div className="pending-grid-group">
                      <span className="pending-group-title">Documents / Verification</span>
                      <div className="verification-status-row">
                        <span className="verification-label">Biometric Status</span>
                        <span
                          className={`status-badge ${
                            item.documents.biometricStatus === 'VERIFIED'
                              ? 'badge-verified'
                              : 'badge-pending'
                          }`}
                        >
                          {item.documents.biometricStatus}
                        </span>
                      </div>
                      <div className="verification-status-row">
                        <span className="verification-label">Photos</span>
                        <span className="status-badge badge-submitted">
                          {item.documents.photos}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons Row */}
                  <div className="pending-card-actions">
                    <button
                      type="button"
                      onClick={() => handleOpenAssignModal(item)}
                      className="btn-card-action btn-card-assign"
                      title={`Assign room to ${item.name}`}
                    >
                      Assign
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenRejectModal(item)}
                      className="btn-card-action btn-card-reject"
                      title={`Reject allocation for ${item.name}`}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenViewModal(item)}
                      className="btn-card-action btn-card-view"
                      title={`View detailed application for ${item.name}`}
                    >
                      View
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {pendingTotalPages > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1rem 0',
                borderTop: '1px solid #E2E8F0',
                marginTop: '1rem',
              }}
            >
              <span style={{ fontSize: '0.85rem', color: '#64748B' }}>
                Showing {(pendingPage - 1) * pendingLimit + 1} to{' '}
                {Math.min(pendingPage * pendingLimit, pendingTotal)} of {pendingTotal} pending allocations
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                  disabled={pendingPage === 1}
                  className="btn-light-secondary"
                  style={{ minHeight: '36px', padding: '0.4rem 0.8rem' }}
                >
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPage((p) => Math.min(pendingTotalPages, p + 1))}
                  disabled={pendingPage >= pendingTotalPages}
                  className="btn-light-secondary"
                  style={{ minHeight: '36px', padding: '0.4rem 0.8rem' }}
                >
                  <span>Next</span>
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/*              TAB 2: ROOMS OVERVIEW (PRESERVED)                    */}
      {/* ================================================================= */}
      {activeTab === 'rooms' && (
        <div>
          {/* Header Section */}
          <div className="room-page-header">
            <div className="room-header-title-group">
              <h1>
                <BedDouble size={26} style={{ color: '#151B54' }} />
                Room Inventory Management
              </h1>
              <p>Configure room records, capacities, and monitor live vacancy across blocks.</p>
            </div>

            <div className="room-header-actions">
              <button
                type="button"
                onClick={() => fetchRooms(true)}
                className="btn-secondary"
                title="Synchronize authoritative data"
                disabled={isRefreshing}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem' }}
              >
                <RotateCw size={15} className={isRefreshing ? 'spin-anim' : ''} />
                <span>Sync</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAllocateModal()}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1rem',
                  backgroundColor: '#0F766E',
                }}
              >
                <UserPlus size={16} />
                <span>Allocate Student</span>
              </button>

              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  padding: '0.55rem 1rem',
                  backgroundColor: '#151B54',
                }}
              >
                <Plus size={16} />
                <span>Add Room</span>
              </button>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="room-filter-toolbar" style={{ margin: '1.25rem 0' }}>
            <div className="room-search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search room number, block name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                aria-label="Search"
              />
            </div>

            <div className="room-filter-controls">
              <select
                value={blockFilter}
                onChange={(e) => setBlockFilter(e.target.value)}
                className="room-filter-select"
                aria-label="Filter by block"
              >
                <option value="ALL">All Blocks</option>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="room-filter-select"
                aria-label="Filter by room status"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="UNDER_MAINTENANCE">Maintenance</option>
              </select>

              <select
                value={occupancyFilter}
                onChange={(e) => setOccupancyFilter(e.target.value)}
                className="room-filter-select"
                aria-label="Filter by occupancy"
              >
                <option value="ALL">All Occupancy</option>
                <option value="OCCUPIED">Fully Occupied</option>
                <option value="PARTIALLY_OCCUPIED">Partially Occupied</option>
                <option value="VACANT">Fully Vacant</option>
              </select>
            </div>
          </div>

          {/* Rooms Grid */}
          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
              <div className="spin-anim" style={{ display: 'inline-block', marginBottom: '0.5rem' }}>
                <RotateCw size={28} />
              </div>
              <p>Loading rooms from PostgreSQL...</p>
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1.5rem',
                textAlign: 'center',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FCA5A5',
                borderRadius: '8px',
                color: '#DC2626',
              }}
            >
              <AlertTriangle size={28} style={{ margin: '0 auto 0.5rem' }} />
              <p>{error}</p>
            </div>
          ) : (
            <div className="rooms-cards-grid">
              {rooms.map((room) => {
                const isFull = room.occupancy >= room.capacity;
                return (
                  <div key={room.id} className="room-display-card">
                    <div className="room-card-head">
                      <div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>
                          Room {room.roomNumber}
                        </h3>
                        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          {room.block.name} • Floor {room.floor || 1}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          backgroundColor: isFull ? '#F1F5F9' : '#DEF7EC',
                          color: isFull ? '#475569' : '#03543F',
                        }}
                      >
                        {room.occupancy}/{room.capacity} ({room.availableBeds} beds free)
                      </span>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenAllocateModal(room)}
                        className="btn-secondary"
                        style={{ flex: 1, padding: '0.45rem', fontSize: '0.8rem' }}
                        disabled={isFull}
                      >
                        Allocate
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(room)}
                        className="btn-secondary"
                        style={{ padding: '0.45rem 0.65rem' }}
                        title="Edit room"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteRoomTarget(room)}
                        className="btn-secondary"
                        style={{ padding: '0.45rem 0.65rem', color: '#DC2626' }}
                        title="Delete room"
                        disabled={room.occupancy > 0}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {/*              TAB 3: ALLOCATIONS HISTORY (PRESERVED)               */}
      {/* ================================================================= */}
      {activeTab === 'allocations' && (
        <div>
          <div className="room-page-header">
            <div className="room-header-title-group">
              <h1>
                <History size={26} style={{ color: '#151B54' }} />
                Authoritative Allocations Log
              </h1>
              <p>Review current and past room assignments, occupied beds, and historical vacates.</p>
            </div>
            <button
              type="button"
              onClick={fetchAllocations}
              className="btn-secondary"
              disabled={allocationsLoading}
            >
              <RotateCw size={15} className={allocationsLoading ? 'spin-anim' : ''} />
              <span>Refresh Log</span>
            </button>
          </div>

          <div style={{ marginTop: '1.25rem' }}>
            {allocationsLoading ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>Loading allocations...</p>
            ) : allocations.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: '#64748B' }}>No allocations found.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {allocations.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      padding: '1rem',
                      background: '#FFFFFF',
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '0.75rem',
                    }}
                  >
                    <div>
                      <strong style={{ color: '#0F172A' }}>{a.student.name}</strong>{' '}
                      <span style={{ color: '#64748B', fontSize: '0.85rem' }}>({a.student.jntuNo})</span>
                      <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '2px' }}>
                        {a.room.block.name} • Room {a.room.roomNumber} ({a.bedNumber || 'Bed Assigned'})
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          fontWeight: 700,
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          backgroundColor: a.status === 'ACTIVE' ? '#DEF7EC' : '#F1F5F9',
                          color: a.status === 'ACTIVE' ? '#03543F' : '#64748B',
                        }}
                      >
                        {a.status}
                      </span>
                      {a.status === 'ACTIVE' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenReallocateModal({
                                allocationId: a.id,
                                studentId: a.student.id,
                                studentName: a.student.name,
                                currentRoomNumber: a.room.roomNumber,
                                currentBlockName: a.room.block.name,
                                currentBedNumber: a.bedNumber,
                              })
                            }
                            className="btn-light-secondary"
                            style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', minHeight: '30px' }}
                          >
                            Reallocate
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setVacateModalData({
                                allocationId: a.id,
                                studentName: a.student.name,
                                roomNumber: a.room.roomNumber,
                                blockName: a.room.block.name,
                                bedNumber: a.bedNumber,
                              })
                            }
                            className="btn-danger-card"
                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.75rem', minHeight: '30px' }}
                          >
                            Vacate
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 1: ASSIGN ROOM MODAL (STEP 3)                  */}
      {/* ================================================================= */}
      {isAssignModalOpen && assignStudentTarget && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsAssignModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '580px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <BedDouble size={20} />
              </div>
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0 }}>
                  Assign Room
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  {assignStudentTarget.name} ({assignStudentTarget.jntuNo})
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsAssignModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {assignError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {assignError}
                  </div>
                )}

                {/* Requested Preferences Summary */}
                <div
                  style={{
                    backgroundColor: '#F8FAFC',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '0.825rem',
                  }}
                >
                  <span style={{ fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                    STUDENT PREFERENCES:
                  </span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', color: '#1E293B' }}>
                    <span>
                      Room: <strong>{assignStudentTarget.preferences.roomPreference}</strong>
                    </span>
                    <span>
                      Block: <strong>{assignStudentTarget.preferences.blockPreference}</strong>
                    </span>
                    <span>
                      Floor: <strong>{assignStudentTarget.preferences.floorPreference}</strong>
                    </span>
                  </div>
                </div>

                {/* Filter by Block */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    1. Filter Block
                  </label>
                  <select
                    value={assignModalBlockFilter}
                    onChange={(e) => {
                      setAssignModalBlockFilter(e.target.value);
                      setSelectedAssignRoomId('');
                    }}
                    className="mgmt-select"
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="ALL">All Active Blocks</option>
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.name}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Select Room */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    2. Select Available Room *
                  </label>
                  {availableRoomsForPending.length === 0 ? (
                    <div
                      style={{
                        padding: '1rem',
                        textAlign: 'center',
                        backgroundColor: '#FFFBEB',
                        border: '1px solid #FDE68A',
                        borderRadius: '8px',
                        color: '#B45309',
                        fontSize: '0.85rem',
                      }}
                    >
                      No rooms with available beds in the selected block. Please pick another block.
                    </div>
                  ) : (
                    <div className="room-selection-list">
                      {availableRoomsForPending.map((r) => {
                        const isSelected = selectedAssignRoomId === r.id;
                        return (
                          <div
                            key={r.id}
                            className={`room-select-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => setSelectedAssignRoomId(r.id)}
                            role="button"
                            tabIndex={0}
                          >
                            <div>
                              <strong style={{ color: '#0F172A', fontSize: '0.95rem' }}>
                                Room {r.roomNumber}
                              </strong>{' '}
                              <span style={{ color: '#64748B', fontSize: '0.82rem' }}>
                                ({r.block.name} • Floor {r.floor || 1})
                              </span>
                              <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '2px' }}>
                                {r.roomType || 'Standard'} • Capacity: {r.capacity}
                              </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                              <span
                                style={{
                                  fontSize: '0.75rem',
                                  fontWeight: 700,
                                  color: '#059669',
                                  backgroundColor: '#DEF7EC',
                                  padding: '2px 7px',
                                  borderRadius: '9999px',
                                  display: 'inline-block',
                                }}
                              >
                                {r.availableBeds} beds available
                              </span>
                              {isSelected && (
                                <div
                                  style={{
                                    marginTop: '4px',
                                    color: '#151B54',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '2px',
                                  }}
                                >
                                  <Check size={14} />
                                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Selected</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Bed Assignment */}
                {selectedAssignRoom && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      3. Bed Assignment (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bed-1, Bed-2 (leave blank to auto-assign)"
                      value={selectedAssignBed}
                      onChange={(e) => setSelectedAssignBed(e.target.value)}
                      className="mgmt-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                )}
              </div>

              <div
                className="notice-modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
              >
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsAssignModalOpen(false)}
                  disabled={isAssigning}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-navy-primary"
                  disabled={isAssigning || !selectedAssignRoomId}
                >
                  {isAssigning ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 2: REJECT ALLOCATION MODAL (STEP 3)            */}
      {/* ================================================================= */}
      {isRejectModalOpen && rejectStudentTarget && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsRejectModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '500px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0, color: '#991B1B' }}>
                  Reject Allocation
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  {rejectStudentTarget.name} ({rejectStudentTarget.jntuNo})
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsRejectModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReject}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {rejectError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {rejectError}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
                  Are you sure you want to reject the room allocation request for{' '}
                  <strong>{rejectStudentTarget.name}</strong>? This action updates their status to{' '}
                  <code>NOT_ALLOCATED</code> in PostgreSQL.
                </p>

                <div>
                  <label
                    htmlFor="rejectionReasonInput"
                    style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}
                  >
                    Rejection Reason *
                  </label>
                  <textarea
                    id="rejectionReasonInput"
                    rows={3}
                    placeholder="Enter explicit reason (e.g. Block capacity filled, duplicate request, ineligible)..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    className="mgmt-input"
                    style={{ width: '100%', padding: '0.6rem', boxSizing: 'border-box' }}
                    required
                  />
                </div>
              </div>

              <div
                className="notice-modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
              >
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsRejectModalOpen(false)}
                  disabled={isRejecting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-danger-card"
                  disabled={isRejecting || !rejectReason.trim()}
                >
                  {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 3: VIEW RESIDENT DETAILS (STEP 3)              */}
      {/* ================================================================= */}
      {isViewModalOpen && viewStudentTarget && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsViewModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '600px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <Users size={20} />
              </div>
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0 }}>
                  Resident Application Details
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  {viewStudentTarget.name} ({viewStudentTarget.jntuNo})
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsViewModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Profile Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '12px',
                  border: '1px solid #E2E8F0',
                }}
              >
                <div className="student-avatar-badge" style={{ width: '56px', height: '56px', fontSize: '1.3rem' }}>
                  {viewStudentTarget.name
                    .split(' ')
                    .filter(Boolean)
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 2px', fontSize: '1.15rem', color: '#0F172A' }}>
                    {viewStudentTarget.name}
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#475569', fontFamily: 'monospace' }}>
                    JNTU ID: {viewStudentTarget.jntuNo}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '4px' }}>
                    Submitted on: {new Date(viewStudentTarget.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Grid breakdown */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                {/* Academic */}
                <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Academic Enrollment
                  </span>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.875rem', color: '#1E293B', fontWeight: 600 }}>
                    {viewStudentTarget.courseInfo.degree} - {viewStudentTarget.courseInfo.department}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '2px' }}>
                    {viewStudentTarget.courseInfo.year} • {viewStudentTarget.courseInfo.semester}
                  </div>
                </div>

                {/* Contact */}
                <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Contact Information
                  </span>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#1E293B' }}>
                    Phone: <strong>{viewStudentTarget.phone}</strong>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#1E293B', marginTop: '2px' }}>
                    Email: <strong>{viewStudentTarget.email}</strong>
                  </div>
                </div>

                {/* Preferences */}
                <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Accommodations Requested
                  </span>
                  <div style={{ marginTop: '0.35rem', fontSize: '0.875rem', color: '#151B54', fontWeight: 600 }}>
                    {viewStudentTarget.preferences.roomPreference}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#475569', marginTop: '2px' }}>
                    Block: {viewStudentTarget.preferences.blockPreference} | Floor:{' '}
                    {viewStudentTarget.preferences.floorPreference}
                  </div>
                </div>

                {/* Verification */}
                <div style={{ padding: '0.85rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #F1F5F9' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#64748B', textTransform: 'uppercase' }}>
                    Identity Verification
                  </span>
                  <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#475569' }}>Biometrics:</span>
                    <span className={`status-badge ${viewStudentTarget.documents.biometricStatus === 'VERIFIED' ? 'badge-verified' : 'badge-pending'}`}>
                      {viewStudentTarget.documents.biometricStatus}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.35rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.82rem', color: '#475569' }}>Photos:</span>
                    <span className="status-badge badge-submitted">{viewStudentTarget.documents.photos}</span>
                  </div>
                </div>
              </div>
            </div>

            <div
              className="notice-modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
            >
              <button
                type="button"
                className="btn-light-secondary"
                onClick={() => setIsViewModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-danger-card"
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenRejectModal(viewStudentTarget);
                }}
              >
                Reject
              </button>
              <button
                type="button"
                className="btn-navy-primary"
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenAssignModal(viewStudentTarget);
                }}
              >
                Assign Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 4: MAP BIOMETRIC STATUS (STEP 3)               */}
      {/* ================================================================= */}
      {isBiometricModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsBiometricModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <Fingerprint size={20} />
              </div>
              <div>
                <h3 className="notice-modal-title" style={{ margin: 0 }}>
                  Biometric Access Mapping
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Authoritative device status for resident allocation
                </span>
              </div>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsBiometricModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.85rem',
                  backgroundColor: '#EFF6FF',
                  borderRadius: '10px',
                  border: '1px solid #BFDBFE',
                  fontSize: '0.85rem',
                  color: '#1E40AF',
                }}
              >
                <ShieldCheck size={20} style={{ flexShrink: 0 }} />
                <span>
                  Physical biometric access control events are recorded authoritatively in PostgreSQL from gate
                  sensors.
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Pending Resident Enrollment Status
                </span>

                {pendingAllocations.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      backgroundColor: '#FFFFFF',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '0.9rem', color: '#0F172A' }}>{p.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: '#64748B' }}>
                        {p.jntuNo} • Events logged: {p.biometricEventsCount}
                      </div>
                    </div>

                    <span
                      className={`status-badge ${
                        p.documents.biometricStatus === 'VERIFIED' ? 'badge-verified' : 'badge-pending'
                      }`}
                    >
                      {p.documents.biometricStatus}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="notice-modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
            >
              <button
                type="button"
                className="btn-light-secondary"
                onClick={() => setIsBiometricModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn-navy-primary"
                onClick={handleBiometricSync}
                disabled={biometricSyncing}
              >
                <RotateCw size={15} className={biometricSyncing ? 'spin-anim' : ''} />
                <span>{biometricSyncing ? 'Syncing...' : 'Sync Biometrics'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 5: FILTER ALLOCATIONS (STEP 3)                 */}
      {/* ================================================================= */}
      {isFilterModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsFilterModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <Filter size={20} />
              </div>
              <h3 className="notice-modal-title" style={{ margin: 0 }}>
                Filter Allocations
              </h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsFilterModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Block Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Block Preference
                </label>
                <select
                  value={pendingBlockFilter}
                  onChange={(e) => setPendingBlockFilter(e.target.value)}
                  className="mgmt-select"
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name} ({b.code})
                    </option>
                  ))}
                </select>
              </div>

              {/* Room Type Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Room Preference
                </label>
                <select
                  value={pendingRoomTypeFilter}
                  onChange={(e) => setPendingRoomTypeFilter(e.target.value)}
                  className="mgmt-select"
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="ALL">All Room Types</option>
                  <option value="Non-AC Room (2 Sharing)">Non-AC Room (2 Sharing)</option>
                  <option value="Non-AC Room (3 Sharing)">Non-AC Room (3 Sharing)</option>
                  <option value="AC Room (2 Sharing)">AC Room (2 Sharing)</option>
                </select>
              </div>

              {/* Biometric Status Filter */}
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                  Biometric Status
                </label>
                <select
                  value={pendingBiometricFilter}
                  onChange={(e) => setPendingBiometricFilter(e.target.value)}
                  className="mgmt-select"
                  style={{ width: '100%', height: '38px' }}
                >
                  <option value="ALL">All Statuses</option>
                  <option value="VERIFIED">Verified / Enrolled</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>
            </div>

            <div
              className="notice-modal-footer"
              style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem' }}
            >
              <button
                type="button"
                className="btn-light-secondary"
                onClick={() => {
                  setPendingBlockFilter('ALL');
                  setPendingRoomTypeFilter('ALL');
                  setPendingBiometricFilter('ALL');
                  setIsFilterModalOpen(false);
                }}
              >
                Reset Filters
              </button>
              <button
                type="button"
                className="btn-navy-primary"
                onClick={() => {
                  setIsFilterModalOpen(false);
                  fetchPendingAllocations(false);
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 6: CREATE / EDIT ROOM MODAL (PRESERVED)        */}
      {/* ================================================================= */}
      {isRoomModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsRoomModalOpen(false)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <BedDouble size={20} />
              </div>
              <h3 className="notice-modal-title">{editingRoom ? 'Edit Room' : 'Add New Room'}</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsRoomModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitRoomForm}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {roomFormError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {roomFormError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Block *
                  </label>
                  <select
                    value={roomFormData.blockId}
                    onChange={(e) => setRoomFormData({ ...roomFormData, blockId: e.target.value })}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">Select Block</option>
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Room Number *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 101"
                      value={roomFormData.roomNumber}
                      onChange={(e) => setRoomFormData({ ...roomFormData, roomNumber: e.target.value })}
                      className="mgmt-input"
                      required
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Floor
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={roomFormData.floor}
                      onChange={(e) => setRoomFormData({ ...roomFormData, floor: Number(e.target.value) })}
                      className="mgmt-input"
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Capacity (Beds) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={roomFormData.capacity}
                      onChange={(e) => setRoomFormData({ ...roomFormData, capacity: Number(e.target.value) })}
                      className="mgmt-input"
                      required
                      style={{ width: '100%', height: '38px' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                      Status
                    </label>
                    <select
                      value={roomFormData.status}
                      onChange={(e) => setRoomFormData({ ...roomFormData, status: e.target.value as any })}
                      className="mgmt-select"
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="UNDER_MAINTENANCE">Maintenance</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Room Type
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Non-AC Room (2 Sharing)"
                    value={roomFormData.roomType || ''}
                    onChange={(e) => setRoomFormData({ ...roomFormData, roomType: e.target.value })}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div
                className="notice-modal-footer"
                style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
              >
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsRoomModalOpen(false)}
                  disabled={isSubmittingRoom}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-navy-primary" disabled={isSubmittingRoom}>
                  {isSubmittingRoom ? 'Saving...' : editingRoom ? 'Update Room' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 7: VACATE ALLOCATION CONFIRMATION (PRESERVED)  */}
      {/* ================================================================= */}
      {vacateModalData && (
        <div className="mgmt-modal-backdrop" onClick={() => setVacateModalData(null)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                <UserMinus size={20} />
              </div>
              <h3 className="notice-modal-title">Vacate Resident</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setVacateModalData(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {vacateError && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    color: '#B91C1C',
                    fontSize: '0.85rem',
                  }}
                >
                  {vacateError}
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                Are you sure you want to vacate <strong>{vacateModalData.studentName}</strong> from{' '}
                <strong>
                  {vacateModalData.blockName} Room {vacateModalData.roomNumber}
                </strong>
                {vacateModalData.bedNumber ? ` (${vacateModalData.bedNumber})` : ''}?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                This will immediately free up the bed vacancy in PostgreSQL and update the student&apos;s allocation status.
              </p>
            </div>

            <div
              className="notice-modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
            >
              <button
                type="button"
                className="btn-light-secondary"
                onClick={() => setVacateModalData(null)}
                disabled={isVacating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-card"
                onClick={handleConfirmVacate}
                disabled={isVacating}
              >
                {isVacating ? 'Vacating...' : 'Confirm Vacate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/*              MODAL 8: DELETE ROOM CONFIRMATION (PRESERVED)        */}
      {/* ================================================================= */}
      {deleteRoomTarget && (
        <div className="mgmt-modal-backdrop" onClick={() => setDeleteRoomTarget(null)}>
          <div
            className="mgmt-notice-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '440px', width: '92%' }}
          >
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}>
                <Trash2 size={20} />
              </div>
              <h3 className="notice-modal-title">Delete Room</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setDeleteRoomTarget(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {deleteRoomError && (
                <div
                  style={{
                    padding: '8px 12px',
                    backgroundColor: '#FEF2F2',
                    border: '1px solid #FCA5A5',
                    borderRadius: '6px',
                    color: '#B91C1C',
                    fontSize: '0.85rem',
                  }}
                >
                  {deleteRoomError}
                </div>
              )}

              <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155' }}>
                Are you sure you want to permanently delete Room{' '}
                <strong>{deleteRoomTarget.roomNumber}</strong> in {deleteRoomTarget.block.name}?
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748B' }}>
                Rooms with active student allocations cannot be deleted.
              </p>
            </div>

            <div
              className="notice-modal-footer"
              style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}
            >
              <button
                type="button"
                className="btn-light-secondary"
                onClick={() => setDeleteRoomTarget(null)}
                disabled={isDeletingRoom}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-card"
                onClick={handleConfirmDeleteRoom}
                disabled={isDeletingRoom}
              >
                {isDeletingRoom ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 9. Allocate Student Modal (Rooms Overview) */}
      {isAllocateModalOpen && (
        <div className="mgmt-modal-backdrop" onClick={() => setIsAllocateModalOpen(false)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px', width: '92%' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#CCFBF1', color: '#0F766E' }}>
                <UserPlus size={20} />
              </div>
              <h3 className="notice-modal-title">Allocate Student to Room</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsAllocateModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitAllocation}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {allocateError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {allocateError}
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    1. Select Block *
                  </label>
                  <select
                    value={allocateBlockId}
                    onChange={(e) => {
                      setAllocateBlockId(e.target.value);
                      setAllocateRoomId('');
                    }}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">Choose Block</option>
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    2. Select Room (with Vacancies) *
                  </label>
                  <select
                    value={allocateRoomId}
                    onChange={(e) => setAllocateRoomId(e.target.value)}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">
                      {availableRoomsForAllocation.length === 0
                        ? 'No vacant rooms in this block'
                        : 'Choose Room'}
                    </option>
                    {availableRoomsForAllocation.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} ({r.occupancy}/{r.capacity} occupied, {r.availableBeds} beds free)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    3. Select Eligible Student *
                  </label>
                  {eligibleStudents.length === 0 ? (
                    <div style={{ fontSize: '0.85rem', color: '#64748B', fontStyle: 'italic', padding: '6px 0' }}>
                      No unallocated students eligible for assignment.
                    </div>
                  ) : (
                    <select
                      value={allocateStudentId}
                      onChange={(e) => setAllocateStudentId(e.target.value)}
                      className="mgmt-select"
                      required
                      style={{ width: '100%', height: '38px' }}
                    >
                      <option value="">Choose Student</option>
                      {eligibleStudents.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.jntuNo})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    4. Bed Assignment (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Leave empty to auto-assign (e.g. Bed-1, Bed-2)"
                    value={allocateBedNumber}
                    onChange={(e) => setAllocateBedNumber(e.target.value)}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}>
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsAllocateModalOpen(false)}
                  disabled={isSubmittingAllocation}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-navy-primary"
                  disabled={isSubmittingAllocation || !allocateRoomId || !allocateStudentId}
                >
                  {isSubmittingAllocation ? 'Allocating...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 10. Reallocate Student Modal */}
      {reallocateModalData && (
        <div className="mgmt-modal-backdrop" onClick={() => setReallocateModalData(null)}>
          <div className="mgmt-notice-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px', width: '92%' }}>
            <div className="notice-modal-header">
              <div className="notice-icon-circle" style={{ backgroundColor: '#EEF2FF', color: '#151B54' }}>
                <ArrowRightLeft size={20} />
              </div>
              <h3 className="notice-modal-title">Reallocate Student</h3>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setReallocateModalData(null)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmReallocation}>
              <div className="notice-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {reallocateError && (
                  <div
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#FEF2F2',
                      border: '1px solid #FCA5A5',
                      borderRadius: '6px',
                      color: '#B91C1C',
                      fontSize: '0.85rem',
                    }}
                  >
                    {reallocateError}
                  </div>
                )}

                <p style={{ margin: 0, fontSize: '0.875rem', color: '#334155' }}>
                  Reallocating <strong>{reallocateModalData.studentName}</strong> from{' '}
                  <strong>{reallocateModalData.currentBlockName} Room {reallocateModalData.currentRoomNumber}</strong>.
                </p>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target Block *
                  </label>
                  <select
                    value={targetBlockId}
                    onChange={(e) => {
                      setTargetBlockId(e.target.value);
                      const vacant = rooms.filter(
                        (r) => r.blockId === e.target.value && r.status === 'ACTIVE' && r.occupancy < r.capacity
                      );
                      setTargetRoomId(vacant.length > 0 ? vacant[0].id : '');
                    }}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    {blocks
                      .filter((b) => b.status === 'ACTIVE')
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    Target Room (with Vacancies) *
                  </label>
                  <select
                    value={targetRoomId}
                    onChange={(e) => setTargetRoomId(e.target.value)}
                    className="mgmt-select"
                    required
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">Choose Target Room</option>
                    {rooms
                      .filter((r) => r.blockId === targetBlockId && r.status === 'ACTIVE' && r.occupancy < r.capacity)
                      .map((r) => (
                        <option key={r.id} value={r.id}>
                          Room {r.roomNumber} ({r.availableBeds} beds available)
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '4px' }}>
                    New Bed Number (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Bed-1 (leave blank to auto-assign)"
                    value={newBedNumber}
                    onChange={(e) => setNewBedNumber(e.target.value)}
                    className="mgmt-input"
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
              </div>

              <div className="notice-modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', padding: '1rem' }}>
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setReallocateModalData(null)}
                  disabled={isReallocating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-navy-primary"
                  disabled={isReallocating || !targetRoomId}
                >
                  {isReallocating ? 'Reallocating...' : 'Confirm Reallocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* 11. Login Credentials Receipt Modal */}
      {isCredentialsModalOpen && credentialsModalData && (
        <div
          className="mgmt-modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(5px)',
            WebkitBackdropFilter: 'blur(5px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '1.5rem',
            boxSizing: 'border-box',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCredentialsModalOpen(false);
          }}
        >
          <div
            className="notice-modal-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              backgroundColor: '#FFFFFF',
              borderRadius: '14px',
              boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.35)',
              overflow: 'hidden',
              position: 'relative',
              zIndex: 100000,
            }}
          >
            <div className="notice-modal-header" style={{ backgroundColor: '#151B54', color: 'white', padding: '1.15rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <ShieldCheck size={22} style={{ color: '#34D399' }} />
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#FFFFFF' }}>Room Allocated & Credentials Issued</h3>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8' }}>Account Active • Student Portal Ready</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCredentialsModalOpen(false)}
                style={{ border: 'none', background: 'transparent', color: '#94A3B8', cursor: 'pointer', padding: '0.2rem' }}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
              <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', padding: '0.85rem 1rem', borderRadius: '8px' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#166534', fontSize: '0.925rem' }}>
                  ✓ Room Allocation Confirmed for {credentialsModalData.name}
                </p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#15803D' }}>
                  Allocated to <strong>{credentialsModalData.blockName} • Room {credentialsModalData.roomNumber} ({credentialsModalData.bedNumber || 'Bed-1'})</strong>
                </p>
              </div>

              {/* Credentials Box */}
              <div style={{ backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', padding: '1rem', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>STUDENT LOGIN CREDENTIALS</span>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Login ID / Roll No:</span>
                  <strong style={{ fontSize: '0.95rem', color: '#151B54', fontFamily: 'monospace' }}>{credentialsModalData.jntuNo}</strong>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Portal URL:</span>
                  <span style={{ fontSize: '0.825rem', color: '#2563EB', fontWeight: 700 }}>http://localhost:5173/</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: '0.55rem 0.75rem', borderRadius: '6px', border: '1px solid #E2E8F0' }}>
                  <span style={{ fontSize: '0.8rem', color: '#64748B', fontWeight: 600 }}>Password:</span>
                  <strong style={{ fontSize: '0.95rem', color: '#059669', fontFamily: 'monospace' }}>{credentialsModalData.passwordHint || 'Password@123'}</strong>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.25rem' }}>
                <button
                  type="button"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', backgroundColor: '#151B54', color: 'white', fontWeight: 700, padding: '0.65rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer' }}
                  onClick={() => {
                    const text = `HMS Student Login Credentials:\nStudent Name: ${credentialsModalData.name}\nRoll No / Login ID: ${credentialsModalData.jntuNo}\nPassword: ${credentialsModalData.passwordHint || 'Password@123'}\nAllocated Room: ${credentialsModalData.blockName} Room ${credentialsModalData.roomNumber} (${credentialsModalData.bedNumber || 'Bed-1'})\nURL: http://localhost:5173/`;
                    navigator.clipboard.writeText(text);
                    showToast('Login credentials copied to clipboard!');
                  }}
                >
                  <Check size={16} />
                  <span>Copy Credentials</span>
                </button>

                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsCredentialsModalOpen(false)}
                  style={{ padding: '0.65rem 1rem', fontWeight: 600, borderRadius: '8px' }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomManagementPage;
