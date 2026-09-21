import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Receipt,
  UserCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  Plus,
  Eye,
  CreditCard,
  Ban,
  Clock,
  Trash2,
  X,
  UserPlus,
  Check,
  Printer,
} from 'lucide-react';
import {
  managementApiService,
  GuestBillingStats,
  GuestItem,
  GuestVisitItem,
  GuestBillItem,
  HostStudentItem,
  BillingItemRecord,
} from '../services/api';
import { APP_BRANDING } from '../config/branding';

interface GuestBillingManagementPageProps {
  onNavigate?: (path: string) => void;
}

export const GuestBillingManagementPage: React.FC<GuestBillingManagementPageProps> = () => {
  // Active Tab: 'bills' | 'visits' | 'guests'
  const [activeTab, setActiveTab] = useState<'bills' | 'visits' | 'guests'>('bills');

  // KPI Statistics
  const [stats, setStats] = useState<GuestBillingStats | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState<boolean>(true);

  // Guests State
  const [guests, setGuests] = useState<GuestItem[]>([]);
  const [isGuestsLoading, setIsGuestsLoading] = useState<boolean>(false);
  const [guestSearch, setGuestSearch] = useState<string>('');
  const [guestPagination, setGuestPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Visits State
  const [visits, setVisits] = useState<GuestVisitItem[]>([]);
  const [isVisitsLoading, setIsVisitsLoading] = useState<boolean>(false);
  const [visitSearch, setVisitSearch] = useState<string>('');
  const [visitStatusFilter, setVisitStatusFilter] = useState<string>('ALL');
  const [visitPagination, setVisitPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Bills State
  const [bills, setBills] = useState<GuestBillItem[]>([]);
  const [isBillsLoading, setIsBillsLoading] = useState<boolean>(false);
  const [billSearch, setBillSearch] = useState<string>('');
  const [billStatusFilter, setBillStatusFilter] = useState<string>('ALL');
  const [billPagination, setBillPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  // Notification Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modals State
  const [isGuestModalOpen, setIsGuestModalOpen] = useState<boolean>(false);
  const [editingGuest, setEditingGuest] = useState<GuestItem | null>(null);
  const [guestFormData, setGuestFormData] = useState({
    name: '',
    phone: '',
    email: '',
    idProofType: 'AADHAAR',
    idProofNumber: '',
    relation: 'PARENT',
    address: '',
  });

  // Check-In Visit Modal
  const [isVisitModalOpen, setIsVisitModalOpen] = useState<boolean>(false);
  const [visitFormData, setVisitFormData] = useState({
    guestId: '',
    hostStudentId: '',
    purpose: '',
    remarks: '',
  });
  const [selectedGuestName, setSelectedGuestName] = useState<string>('');
  const [hostSearchQuery, setHostSearchQuery] = useState<string>('');
  const [searchedHosts, setSearchedHosts] = useState<HostStudentItem[]>([]);
  const [isSearchingHosts, setIsSearchingHosts] = useState<boolean>(false);
  const [selectedHost, setSelectedHost] = useState<HostStudentItem | null>(null);

  // Checkout Confirm Modal
  const [isCheckoutConfirmOpen, setIsCheckoutConfirmOpen] = useState<boolean>(false);
  const [visitToCheckout, setVisitToCheckout] = useState<GuestVisitItem | null>(null);

  // Create Bill Modal
  const [isBillModalOpen, setIsBillModalOpen] = useState<boolean>(false);
  const [billFormData, setBillFormData] = useState<{
    guestVisitId: string;
    billNumber: string;
    items: BillingItemRecord[];
  }>({
    guestVisitId: '',
    billNumber: '',
    items: [{ description: 'Guest Room Accommodation (1 Night)', quantity: 1, unitAmount: 500 }],
  });

  // Bill Detail / Invoice Modal
  const [isBillDetailModalOpen, setIsBillDetailModalOpen] = useState<boolean>(false);
  const [selectedBillDetail, setSelectedBillDetail] = useState<GuestBillItem | null>(null);
  const [isLoadingBillDetail, setIsLoadingBillDetail] = useState<boolean>(false);

  // Record Payment Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState<boolean>(false);
  const [billToPay, setBillToPay] = useState<GuestBillItem | null>(null);
  const [paymentFormData, setPaymentFormData] = useState({
    amount: '',
    paymentMethod: 'UPI',
    paymentReference: '',
    notes: '',
  });

  // Void Bill Modal
  const [isVoidModalOpen, setIsVoidModalOpen] = useState<boolean>(false);
  const [billToVoid, setBillToVoid] = useState<GuestBillItem | null>(null);
  const [voidReason, setVoidReason] = useState<string>('');

  const showToast = (type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // -----------------------------------------------------------------
  // DATA FETCHING
  // -----------------------------------------------------------------

  const fetchOverview = useCallback(async () => {
    try {
      setIsStatsLoading(true);
      const res = await managementApiService.getGuestBillingOverview();
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err: any) {
      console.error('Failed to fetch guest billing overview:', err);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchGuests = useCallback(async () => {
    try {
      setIsGuestsLoading(true);
      const res = await managementApiService.getGuests({
        page: guestPagination.page,
        limit: guestPagination.limit,
        search: guestSearch,
      });
      if (res.success) {
        setGuests(res.guests);
        setGuestPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch guests:', err);
      showToast('error', err.message || 'Failed to load guests.');
    } finally {
      setIsGuestsLoading(false);
    }
  }, [guestPagination.page, guestPagination.limit, guestSearch]);

  const fetchVisits = useCallback(async () => {
    try {
      setIsVisitsLoading(true);
      const res = await managementApiService.getGuestVisits({
        page: visitPagination.page,
        limit: visitPagination.limit,
        search: visitSearch,
        status: visitStatusFilter,
      });
      if (res.success) {
        setVisits(res.visits);
        setVisitPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch visits:', err);
      showToast('error', err.message || 'Failed to load visits.');
    } finally {
      setIsVisitsLoading(false);
    }
  }, [visitPagination.page, visitPagination.limit, visitSearch, visitStatusFilter]);

  const fetchBills = useCallback(async () => {
    try {
      setIsBillsLoading(true);
      const res = await managementApiService.getGuestBills({
        page: billPagination.page,
        limit: billPagination.limit,
        search: billSearch,
        status: billStatusFilter,
      });
      if (res.success) {
        setBills(res.bills);
        setBillPagination((prev) => ({
          ...prev,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch bills:', err);
      showToast('error', err.message || 'Failed to load bills.');
    } finally {
      setIsBillsLoading(false);
    }
  }, [billPagination.page, billPagination.limit, billSearch, billStatusFilter]);

  const fetchAllData = useCallback(() => {
    fetchOverview();
    if (activeTab === 'guests') fetchGuests();
    if (activeTab === 'visits') fetchVisits();
    if (activeTab === 'bills') fetchBills();
  }, [activeTab, fetchOverview, fetchGuests, fetchVisits, fetchBills]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Host Student Live Search for Check-in Modal
  const searchHosts = useCallback(async (query: string) => {
    try {
      setIsSearchingHosts(true);
      const res = await managementApiService.getHostStudents(query);
      if (res.success) {
        setSearchedHosts(res.hosts);
      }
    } catch (err) {
      console.error('Error searching host students:', err);
    } finally {
      setIsSearchingHosts(false);
    }
  }, []);

  useEffect(() => {
    if (isVisitModalOpen) {
      searchHosts(hostSearchQuery);
    }
  }, [isVisitModalOpen, hostSearchQuery, searchHosts]);

  // -----------------------------------------------------------------
  // HANDLERS: GUEST
  // -----------------------------------------------------------------

  const handleOpenAddGuest = () => {
    setEditingGuest(null);
    setGuestFormData({
      name: '',
      phone: '',
      email: '',
      idProofType: 'AADHAAR',
      idProofNumber: '',
      relation: 'PARENT',
      address: '',
    });
    setIsGuestModalOpen(true);
  };

  const handleOpenEditGuest = (g: GuestItem) => {
    setEditingGuest(g);
    setGuestFormData({
      name: g.name,
      phone: g.phone,
      email: g.email || '',
      idProofType: g.idProofType || 'AADHAAR',
      idProofNumber: g.idProofNumber || '',
      relation: g.relation || 'PARENT',
      address: g.address || '',
    });
    setIsGuestModalOpen(true);
  };

  const handleSaveGuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestFormData.name.trim() || guestFormData.name.trim().length < 2) {
      showToast('error', 'Guest name must be at least 2 characters.');
      return;
    }
    if (!guestFormData.phone.trim() || guestFormData.phone.trim().length < 7) {
      showToast('error', 'Valid contact phone number is required.');
      return;
    }

    try {
      if (editingGuest) {
        const res = await managementApiService.updateGuest(editingGuest.id, guestFormData);
        showToast('success', res.message || 'Guest profile updated.');
      } else {
        const res = await managementApiService.createGuest(guestFormData);
        showToast('success', res.message || 'Guest registered successfully.');
      }
      setIsGuestModalOpen(false);
      fetchGuests();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save guest record.');
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: VISIT & CHECKOUT
  // -----------------------------------------------------------------

  const handleOpenCheckinForGuest = (g: GuestItem) => {
    setVisitFormData({
      guestId: g.id,
      hostStudentId: '',
      purpose: '',
      remarks: '',
    });
    setSelectedGuestName(g.name);
    setSelectedHost(null);
    setHostSearchQuery('');
    setIsVisitModalOpen(true);
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitFormData.guestId) {
      showToast('error', 'Please select a guest.');
      return;
    }
    if (!visitFormData.hostStudentId) {
      showToast('error', 'Please search and select the resident host student.');
      return;
    }
    if (!visitFormData.purpose.trim()) {
      showToast('error', 'Please enter the visit purpose.');
      return;
    }

    try {
      const res = await managementApiService.createGuestVisit(visitFormData);
      showToast('success', res.message || 'Guest checked in successfully.');
      setIsVisitModalOpen(false);
      fetchVisits();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to check in guest.');
    }
  };

  const handleOpenCheckout = (v: GuestVisitItem) => {
    setVisitToCheckout(v);
    setIsCheckoutConfirmOpen(true);
  };

  const handleConfirmCheckout = async () => {
    if (!visitToCheckout) return;
    try {
      const res = await managementApiService.checkoutGuestVisit(visitToCheckout.id);
      showToast('success', res.message || 'Guest checked out successfully.');
      setIsCheckoutConfirmOpen(false);
      setVisitToCheckout(null);
      fetchVisits();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to check out visit.');
    }
  };

  // -----------------------------------------------------------------
  // HANDLERS: BILLING
  // -----------------------------------------------------------------

  const handleOpenCreateBillForVisit = (v: GuestVisitItem) => {
    setBillFormData({
      guestVisitId: v.id,
      billNumber: '',
      items: [{ description: 'Guest Room Accommodation (1 Night)', quantity: 1, unitAmount: 500 }],
    });
    setIsBillModalOpen(true);
  };

  const handleAddItemToBill = () => {
    setBillFormData((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitAmount: 0 }],
    }));
  };

  const handleRemoveItemFromBill = (index: number) => {
    if (billFormData.items.length <= 1) {
      showToast('error', 'A bill must contain at least one line item.');
      return;
    }
    setBillFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleBillItemChange = (index: number, field: keyof BillingItemRecord, value: any) => {
    setBillFormData((prev) => {
      const copy = [...prev.items];
      copy[index] = { ...copy[index], [field]: value };
      return { ...prev, items: copy };
    });
  };

  const calculateFormTotal = () => {
    return billFormData.items.reduce((acc, it) => {
      const qty = parseInt(String(it.quantity), 10) || 0;
      const unit = parseFloat(String(it.unitAmount)) || 0;
      return acc + qty * unit;
    }, 0);
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billFormData.guestVisitId) {
      showToast('error', 'Please select a valid guest visit.');
      return;
    }

    for (let i = 0; i < billFormData.items.length; i++) {
      const it = billFormData.items[i];
      if (!it.description.trim()) {
        showToast('error', `Item #${i + 1} requires a description.`);
        return;
      }
      if (it.quantity <= 0) {
        showToast('error', `Item #${i + 1} quantity must be at least 1.`);
        return;
      }
      if (it.unitAmount < 0) {
        showToast('error', `Item #${i + 1} unit price cannot be negative.`);
        return;
      }
    }

    try {
      const res = await managementApiService.createGuestBill(billFormData);
      showToast('success', res.message || 'Guest bill created successfully.');
      setIsBillModalOpen(false);
      fetchBills();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to create bill.');
    }
  };

  const handleViewBillDetail = async (billId: string) => {
    setIsLoadingBillDetail(true);
    setIsBillDetailModalOpen(true);
    try {
      const res = await managementApiService.getGuestBill(billId);
      if (res.success) {
        setSelectedBillDetail(res.bill);
      }
    } catch (err: any) {
      showToast('error', err.message || 'Failed to load bill invoice.');
    } finally {
      setIsLoadingBillDetail(false);
    }
  };

  const handleOpenRecordPayment = (b: GuestBillItem) => {
    setBillToPay(b);
    setPaymentFormData({
      amount: b.balanceAmount > 0 ? String(b.balanceAmount) : '',
      paymentMethod: 'UPI',
      paymentReference: '',
      notes: '',
    });
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToPay) return;

    const amt = parseFloat(paymentFormData.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('error', 'Payment amount must be greater than zero.');
      return;
    }
    if (amt > billToPay.balanceAmount + 0.001) {
      showToast('error', `Amount exceeds outstanding balance of Rs. ${billToPay.balanceAmount.toFixed(2)}.`);
      return;
    }

    try {
      const res = await managementApiService.recordGuestBillPayment(billToPay.id, {
        amount: amt,
        paymentMethod: paymentFormData.paymentMethod,
        paymentReference: paymentFormData.paymentReference || undefined,
        notes: paymentFormData.notes || undefined,
      });
      showToast('success', res.message || 'Payment recorded successfully.');
      setIsPaymentModalOpen(false);
      setBillToPay(null);
      fetchBills();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to record payment.');
    }
  };

  const handleOpenVoidBill = (b: GuestBillItem) => {
    setBillToVoid(b);
    setVoidReason('');
    setIsVoidModalOpen(true);
  };

  const handleConfirmVoidBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billToVoid) return;
    if (!voidReason.trim() || voidReason.trim().length < 3) {
      showToast('error', 'Void reason must be at least 3 characters.');
      return;
    }

    try {
      const res = await managementApiService.voidGuestBill(billToVoid.id, voidReason.trim());
      showToast('success', res.message || 'Bill voided successfully.');
      setIsVoidModalOpen(false);
      setBillToVoid(null);
      fetchBills();
      fetchOverview();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to void bill.');
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  // Helper for status badge styling
  const renderStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'PAID') {
      return (
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#DCFCE7', color: '#15803D', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <CheckCircle2 size={13} /> PAID
        </span>
      );
    }
    if (s === 'PARTIALLY_PAID') {
      return (
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#FEF3C7', color: '#B45309', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={13} /> PARTIAL
        </span>
      );
    }
    if (s === 'UNPAID') {
      return (
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#FEE2E2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <AlertCircle size={13} /> UNPAID
        </span>
      );
    }
    if (s === 'CHECKED_IN') {
      return (
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#CCFBF1', color: '#0F766E', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <UserCheck size={13} /> CHECKED IN
        </span>
      );
    }
    if (s === 'CHECKED_OUT') {
      return (
        <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#F1F5F9', color: '#475569', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={13} /> CHECKED OUT
        </span>
      );
    }
    return (
      <span style={{ padding: '0.25rem 0.65rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 700, background: '#E2E8F0', color: '#64748B' }}>
        {status}
      </span>
    );
  };

  return (
    <div style={{ padding: '1.5rem', background: '#F8FAFC', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: toast.type === 'success' ? '#065F46' : '#991B1B',
          color: '#FFFFFF',
          padding: '0.85rem 1.25rem',
          borderRadius: '12px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          fontSize: '0.9rem',
          fontWeight: 600,
        }}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Header Title Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.02em' }}>
            Guest Visits & Billing Management
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
            Track resident host check-ins, record guest visits, generate itemized bills, and process payments.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            type="button"
            onClick={fetchAllData}
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
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <RefreshCw size={15} /> Refresh Data
          </button>
          <button
            type="button"
            onClick={handleOpenAddGuest}
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
            <UserPlus size={16} /> Register New Guest
          </button>
        </div>
      </div>

      {/* Overview Summary KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}>
        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Registered Guests</span>
            <Users size={20} color="#2563EB" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
            {isStatsLoading ? '...' : stats?.totalGuests || 0}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Today's Visits</span>
            <Calendar size={20} color="#0D9488" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
            {isStatsLoading ? '...' : stats?.todayVisits || 0}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Active Checked-In</span>
            <UserCheck size={20} color="#059669" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#059669' }}>
            {isStatsLoading ? '...' : stats?.activeVisits || 0}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Issued Bills</span>
            <Receipt size={20} color="#4F46E5" />
          </div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0F172A' }}>
            {isStatsLoading ? '...' : stats?.totalBills || 0}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Total Paid</span>
            <CheckCircle2 size={20} color="#16A34A" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#16A34A' }}>
            {isStatsLoading ? '...' : `₹ ${(stats?.paidAmount || 0).toLocaleString()}`}
          </div>
        </div>

        <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '1.25rem', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Outstanding Balance</span>
            <AlertCircle size={20} color="#DC2626" />
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#DC2626' }}>
            {isStatsLoading ? '...' : `₹ ${(stats?.unpaidAmount || 0).toLocaleString()}`}
          </div>
        </div>
      </div>

      {/* Main Content Area with Navigation Tabs */}
      <div style={{ background: '#FFFFFF', borderRadius: '20px', border: '1px solid #E2E8F0', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
        {/* Navigation Tabs Header */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC', padding: '0 1rem' }}>
          <button
            type="button"
            onClick={() => setActiveTab('bills')}
            style={{
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'bills' ? '#4F46E5' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'bills' ? '3px solid #4F46E5' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Receipt size={18} /> Guest Bills & Payments
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('visits')}
            style={{
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'visits' ? '#4F46E5' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'visits' ? '3px solid #4F46E5' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Calendar size={18} /> Guest Visits (Check-Ins)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('guests')}
            style={{
              padding: '1rem 1.25rem',
              fontSize: '0.9rem',
              fontWeight: 700,
              color: activeTab === 'guests' ? '#4F46E5' : '#64748B',
              border: 'none',
              borderBottom: activeTab === 'guests' ? '3px solid #4F46E5' : '3px solid transparent',
              background: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <Users size={18} /> Registered Guest Directory
          </button>
        </div>

        {/* Tab 1: Guest Bills */}
        {activeTab === 'bills' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={billSearch}
                  onChange={(e) => { setBillSearch(e.target.value); setBillPagination((p) => ({ ...p, page: 1 })); }}
                  placeholder="Search by Bill No., Guest Name, Phone, or Bill ID..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={billStatusFilter}
                  onChange={(e) => { setBillStatusFilter(e.target.value); setBillPagination((p) => ({ ...p, page: 1 })); }}
                  style={{
                    padding: '0.65rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">All Payment Statuses</option>
                  <option value="UNPAID">UNPAID</option>
                  <option value="PARTIALLY_PAID">PARTIALLY PAID</option>
                  <option value="PAID">PAID</option>
                  <option value="VOID">VOID</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Bill No</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Guest Name</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Host Student</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Total Amount</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Paid Amount</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Outstanding Balance</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isBillsLoading ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        Loading guest bills...
                      </td>
                    </tr>
                  ) : bills.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        No guest billing records match the search filter.
                      </td>
                    </tr>
                  ) : (
                    bills.map((b) => (
                      <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#1E293B' }}>
                          {b.billNumber}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 600 }}>
                          {b.guestVisit?.guest?.name || 'Guest'}
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.guestVisit?.guest?.phone}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {b.guestVisit?.hostStudent?.name || 'Resident Host'}
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{b.guestVisit?.hostStudent?.jntuNo}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#0F172A' }}>
                          ₹ {b.totalAmount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#16A34A' }}>
                          ₹ {b.paidAmount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: b.balanceAmount > 0 ? '#DC2626' : '#64748B' }}>
                          ₹ {b.balanceAmount.toFixed(2)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {renderStatusBadge(b.paymentStatus)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleViewBillDetail(b.id)}
                              style={{ background: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Eye size={14} /> View Invoice
                            </button>
                            {b.paymentStatus !== 'PAID' && b.paymentStatus !== 'VOID' && (
                              <button
                                type="button"
                                onClick={() => handleOpenRecordPayment(b)}
                                style={{ background: '#DCFCE7', color: '#15803D', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <CreditCard size={14} /> Record Payment
                              </button>
                            )}
                            {b.paymentStatus !== 'VOID' && (
                              <button
                                type="button"
                                onClick={() => handleOpenVoidBill(b)}
                                style={{ background: '#FEE2E2', color: '#B91C1C', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <Ban size={14} /> Void
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Guest Visits */}
        {activeTab === 'visits' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={visitSearch}
                  onChange={(e) => { setVisitSearch(e.target.value); setVisitPagination((p) => ({ ...p, page: 1 })); }}
                  placeholder="Search visits by Guest Name, Phone, Host Student..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <select
                  value={visitStatusFilter}
                  onChange={(e) => { setVisitStatusFilter(e.target.value); setVisitPagination((p) => ({ ...p, page: 1 })); }}
                  style={{
                    padding: '0.65rem 1rem',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    background: '#FFFFFF',
                    color: '#0F172A',
                    fontWeight: 600,
                  }}
                >
                  <option value="ALL">All Visit Statuses</option>
                  <option value="CHECKED_IN">CHECKED IN</option>
                  <option value="CHECKED_OUT">CHECKED OUT</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Guest Name</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Host Student</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Purpose</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Check In Time</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Check Out Time</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isVisitsLoading ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        Loading guest visits...
                      </td>
                    </tr>
                  ) : visits.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        No guest visit check-in records found.
                      </td>
                    </tr>
                  ) : (
                    visits.map((v) => (
                      <tr key={v.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#1E293B' }}>
                          {v.guest?.name}
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{v.guest?.phone}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {v.hostStudent?.name}
                          <div style={{ fontSize: '0.75rem', color: '#64748B' }}>{v.hostStudent?.jntuNo}</div>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                          {v.purpose}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                          {new Date(v.checkInTime).toLocaleString()}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#475569' }}>
                          {v.checkOutTime ? new Date(v.checkOutTime).toLocaleString() : '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          {renderStatusBadge(v.status)}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            {v.status === 'CHECKED_IN' && (
                              <button
                                type="button"
                                onClick={() => handleOpenCheckout(v)}
                                style={{ background: '#FEF3C7', color: '#B45309', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                Check Out
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenCreateBillForVisit(v)}
                              style={{ background: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <Receipt size={14} /> Generate Bill
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Registered Guests Directory */}
        {activeTab === 'guests' && (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: '1 1 300px' }}>
                <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  value={guestSearch}
                  onChange={(e) => { setGuestSearch(e.target.value); setGuestPagination((p) => ({ ...p, page: 1 })); }}
                  placeholder="Search guest directory by Name, Phone, ID Proof..."
                  style={{
                    width: '100%',
                    padding: '0.65rem 1rem 0.65rem 2.5rem',
                    fontSize: '0.875rem',
                    borderRadius: '10px',
                    border: '1px solid #CBD5E1',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569', fontWeight: 700 }}>
                    <th style={{ padding: '0.85rem 1rem' }}>Guest Name</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Phone</th>
                    <th style={{ padding: '0.85rem 1rem' }}>ID Proof Type</th>
                    <th style={{ padding: '0.85rem 1rem' }}>ID Proof No</th>
                    <th style={{ padding: '0.85rem 1rem' }}>Relation</th>
                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isGuestsLoading ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        Loading guest directory...
                      </td>
                    </tr>
                  ) : guests.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                        No guests registered in directory.
                      </td>
                    </tr>
                  ) : (
                    guests.map((g) => (
                      <tr key={g.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '0.85rem 1rem', fontWeight: 700, color: '#1E293B' }}>
                          {g.name}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                          {g.phone}
                        </td>
                        <td style={{ padding: '0.85rem 1rem' }}>
                          <span style={{ background: '#F1F5F9', color: '#475569', padding: '0.2rem 0.5rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 600 }}>
                            {g.idProofType || 'AADHAAR'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#334155' }}>
                          {g.idProofNumber || '—'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', color: '#475569' }}>
                          {g.relation || 'PARENT'}
                        </td>
                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => handleOpenCheckinForGuest(g)}
                              style={{ background: '#DCFCE7', color: '#15803D', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                            >
                              <UserCheck size={14} /> Check In Guest
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditGuest(g)}
                              style={{ background: '#F1F5F9', color: '#334155', border: 'none', padding: '0.4rem 0.65rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}
                            >
                              Edit Profile
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* MODAL 1: REGISTER / EDIT GUEST */}
      {/* ------------------------------------------------------------- */}
      {isGuestModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '520px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                {editingGuest ? 'Edit Guest Profile' : 'Register New Guest'}
              </h3>
              <button type="button" onClick={() => setIsGuestModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveGuest} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Guest Full Name *</label>
                <input
                  type="text"
                  required
                  value={guestFormData.name}
                  onChange={(e) => setGuestFormData({ ...guestFormData, name: e.target.value })}
                  placeholder="e.g. Ramesh Chandra"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={guestFormData.phone}
                    onChange={(e) => setGuestFormData({ ...guestFormData, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Email Address</label>
                  <input
                    type="email"
                    value={guestFormData.email}
                    onChange={(e) => setGuestFormData({ ...guestFormData, email: e.target.value })}
                    placeholder="e.g. ramesh@example.com"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>ID Proof Type</label>
                  <select
                    value={guestFormData.idProofType}
                    onChange={(e) => setGuestFormData({ ...guestFormData, idProofType: e.target.value })}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
                  >
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="DRIVING_LICENSE">Driving License</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="VOTER_ID">Voter ID</option>
                    <option value="OTHER">Other Official ID</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>ID Proof Number</label>
                  <input
                    type="text"
                    value={guestFormData.idProofNumber}
                    onChange={(e) => setGuestFormData({ ...guestFormData, idProofNumber: e.target.value })}
                    placeholder="e.g. 1234-5678-9012"
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Relationship to Student</label>
                <select
                  value={guestFormData.relation}
                  onChange={(e) => setGuestFormData({ ...guestFormData, relation: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
                >
                  <option value="PARENT">Parent (Father / Mother)</option>
                  <option value="GUARDIAN">Guardian</option>
                  <option value="SIBLING">Sibling (Brother / Sister)</option>
                  <option value="RELATIVE">Relative</option>
                  <option value="FRIEND">Friend / Academic Visitor</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setIsGuestModalOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#4F46E5', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  {editingGuest ? 'Save Changes' : 'Register Guest'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 2: GUEST CHECK-IN & HOST STUDENT SEARCH */}
      {/* ------------------------------------------------------------- */}
      {isVisitModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '580px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                  Register Guest Check-In
                </h3>
                {selectedGuestName && (
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#4F46E5', fontWeight: 600 }}>
                    Guest: {selectedGuestName}
                  </p>
                )}
              </div>
              <button type="button" onClick={() => setIsVisitModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateVisit} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Host Student Live Search Field */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>
                  Search Host Resident Student *
                </label>
                <div style={{ position: 'relative' }}>
                  <Search size={18} color="#94A3B8" style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={hostSearchQuery}
                    onChange={(e) => setHostSearchQuery(e.target.value)}
                    placeholder="Type student name or JNTU No. to search..."
                    style={{ width: '100%', padding: '0.65rem 1rem 0.65rem 2.5rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>

                {/* Host Search Results Container */}
                <div style={{ marginTop: '0.5rem', maxHeight: '160px', overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '8px', background: '#F8FAFC' }}>
                  {isSearchingHosts ? (
                    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
                      Searching host students...
                    </div>
                  ) : searchedHosts.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', fontSize: '0.8rem', color: '#64748B' }}>
                      {hostSearchQuery ? 'No host student found.' : 'Start typing student name or JNTU No.'}
                    </div>
                  ) : (
                    searchedHosts.map((h) => {
                      const isSelected = selectedHost?.id === h.id;
                      return (
                        <div
                          key={h.id}
                          onClick={() => {
                            setSelectedHost(h);
                            setVisitFormData({ ...visitFormData, hostStudentId: h.id });
                          }}
                          style={{
                            padding: '0.65rem 0.85rem',
                            borderBottom: '1px solid #E2E8F0',
                            cursor: 'pointer',
                            background: isSelected ? '#EEF2FF' : '#FFFFFF',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0F172A' }}>{h.name}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748B' }}>
                              JNTU: {h.jntuNo} | Block: {h.blockName || 'Unassigned'} | Room: {h.roomNumber || '—'}
                            </div>
                          </div>
                          {isSelected && <Check size={18} color="#4F46E5" />}
                        </div>
                      );
                    })
                  )}
                </div>

                {selectedHost && (
                  <div style={{ marginTop: '0.5rem', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '0.5rem 0.75rem', borderRadius: '8px', fontSize: '0.8rem', color: '#065F46', fontWeight: 600 }}>
                    Selected Host: {selectedHost.name} ({selectedHost.jntuNo})
                  </div>
                )}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Visit Purpose *</label>
                <input
                  type="text"
                  required
                  value={visitFormData.purpose}
                  onChange={(e) => setVisitFormData({ ...visitFormData, purpose: e.target.value })}
                  placeholder="e.g. Family Visit / Delivering Academic Documents"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Additional Remarks / Gate Notes</label>
                <textarea
                  rows={2}
                  value={visitFormData.remarks}
                  onChange={(e) => setVisitFormData({ ...visitFormData, remarks: e.target.value })}
                  placeholder="Optional gate entry notes or visitor luggage comments..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsVisitModalOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#059669', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <UserCheck size={16} /> Confirm Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 3: CHECKOUT CONFIRMATION */}
      {/* ------------------------------------------------------------- */}
      {isCheckoutConfirmOpen && visitToCheckout && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '440px', padding: '1.75rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto' }}>
              <Clock size={24} color="#D97706" />
            </div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.2rem', fontWeight: 800, color: '#0F172A' }}>
              Check Out Guest Visit?
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#64748B', margin: '0 0 1.5rem 0' }}>
              Are you sure you want to mark guest <strong>{visitToCheckout.guest?.name}</strong> as checked out?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => setIsCheckoutConfirmOpen(false)}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmCheckout}
                style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#D97706', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
              >
                Confirm Checkout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 4: CREATE ITEMIZE GUEST BILL & PRICING CALCULATOR */}
      {/* ------------------------------------------------------------- */}
      {isBillModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Generate Itemized Guest Bill
              </h3>
              <button type="button" onClick={() => setIsBillModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateBill} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Line Items Table */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 700, color: '#334155' }}>
                    Bill Charge Line Items
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemToBill}
                    style={{ background: '#EEF2FF', color: '#4F46E5', border: 'none', padding: '0.35rem 0.65rem', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>

                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  {billFormData.items.map((it, idx) => (
                    <div key={idx} style={{ padding: '0.75rem', borderBottom: idx < billFormData.items.length - 1 ? '1px solid #E2E8F0' : 'none', background: idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC', display: 'grid', gridTemplateColumns: '3fr 1fr 1.5fr 32px', gap: '0.5rem', alignItems: 'center' }}>
                      <input
                        type="text"
                        placeholder="Description (e.g. Guest Room Accommodation)"
                        value={it.description}
                        onChange={(e) => handleBillItemChange(idx, 'description', e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={it.quantity}
                        onChange={(e) => handleBillItemChange(idx, 'quantity', e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Unit Price (₹)"
                        value={it.unitAmount}
                        onChange={(e) => handleBillItemChange(idx, 'unitAmount', e.target.value)}
                        style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.85rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveItemFromBill(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', padding: '0.2rem' }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Total Summary */}
              <div style={{ background: '#EEF2FF', padding: '1rem', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#3730A3' }}>Calculated Total Bill Amount:</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 800, color: '#4F46E5' }}>₹ {calculateFormTotal().toFixed(2)}</span>
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setIsBillModalOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#4F46E5', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Receipt size={16} /> Create & Issue Bill
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 5: VIEW INVOICE & PRINTABLE RECEIPT */}
      {/* ------------------------------------------------------------- */}
      {isBillDetailModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '640px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                  Guest Bill Invoice & Receipt
                </h3>
                {selectedBillDetail && (
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', color: '#64748B' }}>
                    Bill No: <strong style={{ color: '#0F172A' }}>{selectedBillDetail.billNumber}</strong>
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  style={{ background: '#4F46E5', color: '#FFFFFF', border: 'none', padding: '0.45rem 0.85rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <Printer size={15} /> Print Invoice
                </button>
                <button type="button" onClick={() => setIsBillDetailModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                  <X size={20} />
                </button>
              </div>
            </div>

            {isLoadingBillDetail || !selectedBillDetail ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: '#64748B' }}>
                Loading invoice details...
              </div>
            ) : (
              <div style={{ padding: '1.75rem', maxHeight: '75vh', overflowY: 'auto' }}>
                {/* Printable Invoice Container */}
                <div id="printable-invoice">
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #E2E8F0', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4F46E5', margin: 0 }}>
                        {APP_BRANDING.appName}
                      </h2>
                      <p style={{ fontSize: '0.8rem', color: '#64748B', margin: '0.25rem 0 0 0' }}>
                        Official Residential Guest Billing Receipt
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {renderStatusBadge(selectedBillDetail.paymentStatus)}
                      <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '0.35rem' }}>
                        Date: {new Date(selectedBillDetail.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>

                  {/* Guest & Host Information */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: '#F8FAFC', padding: '1rem', borderRadius: '12px', marginBottom: '1.25rem' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Guest Visitor</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginTop: '0.2rem' }}>
                        {selectedBillDetail.guestVisit?.guest?.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        Phone: {selectedBillDetail.guestVisit?.guest?.phone}
                      </div>
                    </div>

                    <div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>Host Resident Student</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', marginTop: '0.2rem' }}>
                        {selectedBillDetail.guestVisit?.hostStudent?.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                        JNTU: {selectedBillDetail.guestVisit?.hostStudent?.jntuNo}
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                    <thead>
                      <tr style={{ background: '#F1F5F9', borderBottom: '1px solid #CBD5E1', color: '#475569', fontWeight: 700 }}>
                        <th style={{ padding: '0.6rem 0.85rem', textAlign: 'left' }}>Description</th>
                        <th style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>Qty</th>
                        <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Unit Price</th>
                        <th style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBillDetail.items?.map((it) => (
                        <tr key={it.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                          <td style={{ padding: '0.6rem 0.85rem', color: '#1E293B', fontWeight: 600 }}>{it.description}</td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'center' }}>{it.quantity}</td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right' }}>₹ {it.unitAmount.toFixed(2)}</td>
                          <td style={{ padding: '0.6rem 0.85rem', textAlign: 'right', fontWeight: 700 }}>₹ {(it.totalAmount ?? (it.quantity * it.unitAmount)).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Financial Breakdown */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end', borderTop: '2px solid #E2E8F0', paddingTop: '0.85rem' }}>
                    <div style={{ fontSize: '0.9rem', color: '#475569' }}>
                      Grand Total: <strong style={{ color: '#0F172A', fontSize: '1.1rem' }}>₹ {selectedBillDetail.totalAmount.toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#16A34A' }}>
                      Paid Amount: <strong>₹ {selectedBillDetail.paidAmount.toFixed(2)}</strong>
                    </div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: selectedBillDetail.balanceAmount > 0 ? '#DC2626' : '#059669' }}>
                      Balance Due: ₹ {selectedBillDetail.balanceAmount.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 6: RECORD PAYMENT */}
      {/* ------------------------------------------------------------- */}
      {isPaymentModalOpen && billToPay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '480px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>
                Record Payment for Bill #{billToPay.billNumber}
              </h3>
              <button type="button" onClick={() => setIsPaymentModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitPayment} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: '#FEF3C7', padding: '0.85rem', borderRadius: '10px', color: '#92400E', fontSize: '0.85rem', fontWeight: 600 }}>
                Outstanding Balance Due: ₹ {billToPay.balanceAmount.toFixed(2)}
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Payment Amount (₹) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentFormData.amount}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                  placeholder="Enter amount being paid..."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Payment Method</label>
                <select
                  value={paymentFormData.paymentMethod}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value })}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', background: '#FFFFFF' }}
                >
                  <option value="UPI">UPI / GPay / PhonePe</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Credit / Debit Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Transaction / UPI Reference Number</label>
                <input
                  type="text"
                  value={paymentFormData.paymentReference}
                  onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentReference: e.target.value })}
                  placeholder="e.g. UPI-9988776655"
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#16A34A', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <CreditCard size={16} /> Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* MODAL 7: VOID BILL */}
      {/* ------------------------------------------------------------- */}
      {isVoidModalOpen && billToVoid && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '20px', width: '100%', maxWidth: '440px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <div style={{ padding: '1.25rem 1.5rem', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#B91C1C' }}>
                Void Bill #{billToVoid.billNumber}
              </h3>
              <button type="button" onClick={() => setIsVoidModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleConfirmVoidBill} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <p style={{ fontSize: '0.875rem', color: '#475569', margin: 0 }}>
                Voiding this bill will cancel the financial record. Please state the audit reason for voiding this bill.
              </p>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: '#334155', marginBottom: '0.35rem' }}>Reason for Voiding *</label>
                <textarea
                  rows={3}
                  required
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="e.g. Duplicate bill generated erroneously by front desk staff."
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #CBD5E1', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifySelf: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setIsVoidModalOpen(false)}
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#475569', fontWeight: 600, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '0.65rem 1.25rem', borderRadius: '8px', border: 'none', background: '#DC2626', color: '#FFFFFF', fontWeight: 700, cursor: 'pointer' }}
                >
                  Confirm Void
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default GuestBillingManagementPage;
