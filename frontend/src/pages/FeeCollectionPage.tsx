import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Plus,
  RefreshCw,
  Download,
  Upload,
  ArrowUpRight,
  Bell,
  CheckCircle,
  XCircle,
  Printer,
  ChevronDown,
  ChevronUp,
  History,
  Sliders,
  Calendar,
} from 'lucide-react';
import {
  managementApiService,
  StudentFeeItemSummary,
  FeeItemDetail,
  AcademicYearItem,
  BankAccountItem,
  FeePaymentItem,
} from '../services/api';
import '../styles/FeeModules.css';

interface FeeCollectionPageProps {
  onNavigate?: (path: string) => void;
}

export const FeeCollectionPage: React.FC<FeeCollectionPageProps> = () => {
  // Academic Years
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');

  // Student Fee Collection List
  const [students, setStudents] = useState<StudentFeeItemSummary[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedStudents, setExpandedStudents] = useState<Record<string, boolean>>({});

  // Pagination & Filtering
  const [search, setSearch] = useState<string>('');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('ALL');
  const [dueStatusFilter, setDueStatusFilter] = useState<string>('ALL');
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

  // Bank Accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Active Modals
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentTargetStudent, setPaymentTargetStudent] = useState<StudentFeeItemSummary | null>(null);
  const [paymentTargetItem, setPaymentTargetItem] = useState<FeeItemDetail | null>(null);

  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [currentReceiptData, setCurrentReceiptData] = useState<any | null>(null);

  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyPayments, setHistoryPayments] = useState<FeePaymentItem[]>([]);
  const [historyStudent, setHistoryStudent] = useState<StudentFeeItemSummary | null>(null);

  const [showExtraFeeModal, setShowExtraFeeModal] = useState<boolean>(false);
  const [extraFeeStudent, setExtraFeeStudent] = useState<StudentFeeItemSummary | null>(null);

  const [showPromoteModal, setShowPromoteModal] = useState<boolean>(false);
  const [showBulkImportModal, setShowBulkImportModal] = useState<boolean>(false);
  const [showBulkAdjustModal, setShowBulkAdjustModal] = useState<boolean>(false);
  const [showNotificationModal, setShowNotificationModal] = useState<boolean>(false);

  // Payment Form State
  const [paymentType, setPaymentType] = useState<'FULL' | 'PARTIAL'>('FULL');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CHEQUE' | 'SBI_COLLECT'>('UPI');
  const [selectedBankAccountId, setSelectedBankAccountId] = useState<string>('');
  // Method Specific
  const [upiApp, setUpiApp] = useState<string>('PhonePe');
  const [upiReference, setUpiReference] = useState<string>('');
  const [chequeNumber, setChequeNumber] = useState<string>('');
  const [chequeBankName, setChequeBankName] = useState<string>('');
  const [chequeReceivedBy, setChequeReceivedBy] = useState<string>('');
  const [sbiCollectReference, setSbiCollectReference] = useState<string>('');
  const [sbiVerifiedBy, setSbiVerifiedBy] = useState<string>('');

  // Extra Fee Form State
  const [extraFeeForm, setExtraFeeForm] = useState({
    feeType: 'Annual Hostel Mess & Dining Charges',
    module: 'HOSTEL',
    amount: '',
    isBiometricAttendance: false,
    startDate: '',
    endDate: '',
    workingDays: '30',
    dailyRate: '150',
  });

  // Promote Form State
  const [targetAcademicYearId, setTargetAcademicYearId] = useState<string>('');
  const [promotionType, setPromotionType] = useState<'SEMESTER' | 'ACADEMIC_YEAR'>('ACADEMIC_YEAR');

  // Bulk Adjust State
  const [bulkAdjustForm, setBulkAdjustForm] = useState({
    adjustmentType: 'DISCOUNT',
    amount: '',
    reason: '',
  });

  // Excel Import State
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; error: string }>>([]);
  const [importSummary, setImportSummary] = useState<any | null>(null);

  // Notification Message
  const [notificationMessage, setNotificationMessage] = useState<string>('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Load Academic Years
  const loadAcademicYears = useCallback(async () => {
    try {
      const res = await managementApiService.getAcademicYears();
      if (res.success) {
        setAcademicYears(res.academicYears);
        const current = res.academicYears.find((y) => y.isCurrent) || res.academicYears[0];
        if (current && !selectedYearId) {
          setSelectedYearId(current.id);
        }
      }
    } catch (err) {
      console.error('Failed to load academic years:', err);
    }
  }, [selectedYearId]);

  // 2. Load Bank Accounts
  const loadBankAccounts = useCallback(async () => {
    try {
      const res = await managementApiService.getBankAccounts();
      if (res.success) {
        setBankAccounts(res.bankAccounts);
        const firstActive = res.bankAccounts.find((a) => a.status === 'ACTIVE');
        if (firstActive && !selectedBankAccountId) {
          setSelectedBankAccountId(firstActive.id);
        }
      }
    } catch (err) {
      console.error('Failed to load bank accounts:', err);
    }
  }, [selectedBankAccountId]);

  // 3. Load Student Fee Collection Data
  const loadStudentFees = useCallback(async () => {
    if (!selectedYearId) return;
    setIsLoading(true);
    try {
      const res = await managementApiService.getStudentsWithFees({
        academicYearId: selectedYearId,
        search,
        module: moduleFilter,
        paymentStatus: paymentStatusFilter,
        dueStatus: dueStatusFilter,
        page: pagination.page,
        limit: pagination.limit,
      });

      if (res.success) {
        setStudents(res.students);
        setPagination({
          page: res.pagination.page,
          limit: res.pagination.limit,
          total: res.pagination.total,
          totalPages: res.pagination.totalPages,
        });
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load fee collection data', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedYearId, search, moduleFilter, paymentStatusFilter, dueStatusFilter, pagination.page, pagination.limit]);

  useEffect(() => {
    loadAcademicYears();
    loadBankAccounts();
  }, [loadAcademicYears, loadBankAccounts]);

  useEffect(() => {
    loadStudentFees();
  }, [loadStudentFees]);

  const loadStudentFeesRef = useRef(loadStudentFees);
  useEffect(() => {
    loadStudentFeesRef.current = loadStudentFees;
  }, [loadStudentFees]);

  // Realtime subscription via SSE using authenticated managementApiService
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents((event) => {
      if (
        event?.type === 'FEE_PAYMENT_RECORDED' ||
        event?.type === 'FEE_STRUCTURE_CREATED' ||
        event?.type === 'FEE_UPDATED' ||
        event?.type === 'fee_event'
      ) {
        loadStudentFeesRef.current();
      }
    });
    return () => unsubscribe();
  }, []);

  // Toggle row expansion
  const toggleExpand = (studentId: string) => {
    setExpandedStudents((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  // Open Payment Modal
  const handleOpenPayment = (student: StudentFeeItemSummary, item?: FeeItemDetail) => {
    setPaymentTargetStudent(student);
    setPaymentTargetItem(item || null);
    const payable = item ? item.dueAmount : student.dueAmount;
    setPaymentType('FULL');
    setPaymentAmount(payable.toString());
    setUpiReference('');
    setChequeNumber('');
    setChequeBankName('');
    setChequeReceivedBy('ADMIN01');
    setSbiCollectReference('');
    setSbiVerifiedBy('ADMIN01');
    setShowPaymentModal(true);
  };

  // Submit Payment
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentTargetStudent) return;

    try {
      const amt = parseFloat(paymentAmount);
      if (isNaN(amt) || amt <= 0) {
        showToast('Payment amount must be greater than zero.', 'error');
        return;
      }

      const res = await managementApiService.recordPayment({
        studentId: paymentTargetStudent.student.id,
        academicYearId: selectedYearId,
        feeItemId: paymentTargetItem?.id,
        amount: amt,
        paymentMethod,
        bankAccountId: selectedBankAccountId,
        upiApp: paymentMethod === 'UPI' ? upiApp : undefined,
        upiReference: paymentMethod === 'UPI' ? upiReference : undefined,
        chequeNumber: paymentMethod === 'CHEQUE' ? chequeNumber : undefined,
        bankName: paymentMethod === 'CHEQUE' ? chequeBankName : undefined,
        receivedBy: paymentMethod === 'CHEQUE' ? chequeReceivedBy : undefined,
        sbiCollectReference: paymentMethod === 'SBI_COLLECT' ? sbiCollectReference : undefined,
        verifiedBy: paymentMethod === 'SBI_COLLECT' ? sbiVerifiedBy : undefined,
      });

      if (res.success) {
        setShowPaymentModal(false);
        showToast(res.message || 'Payment recorded successfully.');
        // Show receipt
        setCurrentReceiptData(res.receiptDetails);
        setShowReceiptModal(true);
        loadStudentFees();
      }
    } catch (err: any) {
      showToast(err.message || 'Payment processing failed.', 'error');
    }
  };

  // Open Payment History Modal
  const handleOpenHistory = async (student: StudentFeeItemSummary) => {
    try {
      const res = await managementApiService.getStudentPaymentHistory(student.student.id, selectedYearId);
      if (res.success) {
        setHistoryStudent(student);
        setHistoryPayments(res.payments);
        setShowHistoryModal(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to retrieve payment history', 'error');
    }
  };

  // Process Refund
  const handleProcessRefund = async (feeItemId: string) => {
    const amtStr = prompt('Enter refund amount (INR):');
    if (!amtStr) return;
    const amt = parseFloat(amtStr);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid refund amount.', 'error');
      return;
    }
    const reason = prompt('Enter authorized refund reason:') || '';
    if (!reason.trim()) {
      showToast('Refund reason is required.', 'error');
      return;
    }

    try {
      await managementApiService.processRefund({
        feeItemId,
        amount: amt,
        reason,
      });
      showToast('Refund processed successfully.');
      loadStudentFees();
      if (historyStudent) handleOpenHistory(historyStudent);
    } catch (err: any) {
      showToast(err.message || 'Failed to process refund', 'error');
    }
  };

  // Add Extra Fee
  const handleAddExtraFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraFeeStudent) return;
    try {
      await managementApiService.addExtraFee({
        studentId: extraFeeStudent.student.id,
        academicYearId: selectedYearId,
        feeType: extraFeeForm.feeType,
        module: extraFeeForm.module as any,
        amount: extraFeeForm.isBiometricAttendance ? undefined : parseFloat(extraFeeForm.amount),
        isBiometricAttendance: extraFeeForm.isBiometricAttendance,
        startDate: extraFeeForm.startDate,
        endDate: extraFeeForm.endDate,
        workingDays: parseInt(extraFeeForm.workingDays, 10),
        dailyRate: parseFloat(extraFeeForm.dailyRate),
      });

      showToast('Extra fee added successfully.');
      setShowExtraFeeModal(false);
      loadStudentFees();
    } catch (err: any) {
      showToast(err.message || 'Failed to add extra fee', 'error');
    }
  };

  // Promote Students
  const handlePromoteStudents = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const studentIds = students.map((s) => s.student.id);
      const res = await managementApiService.promoteStudents({
        studentIds,
        currentAcademicYearId: selectedYearId,
        targetAcademicYearId: targetAcademicYearId || selectedYearId,
        promotionType,
      });
      showToast(res.message || 'Promotion completed.');
      setShowPromoteModal(false);
      loadStudentFees();
    } catch (err: any) {
      showToast(err.message || 'Promotion failed.', 'error');
    }
  };

  // Sync Fees
  const handleSyncFees = async () => {
    if (!selectedYearId) return;
    try {
      const res = await managementApiService.syncFeeItems(selectedYearId);
      showToast(res.message || 'Fee items synchronized.');
      loadStudentFees();
    } catch (err: any) {
      showToast(err.message || 'Fee synchronization failed', 'error');
    }
  };

  // Send Notifications
  const handleSendNotifications = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await managementApiService.sendFeeDueNotifications({
        academicYearId: selectedYearId,
        customMessage: notificationMessage || undefined,
      });
      showToast(res.message || 'Notifications dispatched.');
      setShowNotificationModal(false);
    } catch (err: any) {
      showToast(err.message || 'Failed to send notifications', 'error');
    }
  };

  // Bulk Adjustment
  const handleBulkAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(bulkAdjustForm.amount);
      if (isNaN(amt) || amt <= 0) {
        showToast('Amount must be greater than zero.', 'error');
        return;
      }
      const allItemIds = students.flatMap((s) => s.items.map((it) => it.id));
      const res = await managementApiService.bulkFeeAdjustment({
        feeItemIds: allItemIds,
        adjustmentType: bulkAdjustForm.adjustmentType as any,
        amount: amt,
        reason: bulkAdjustForm.reason,
      });
      showToast(res.message || 'Bulk adjustment applied.');
      setShowBulkAdjustModal(false);
      loadStudentFees();
    } catch (err: any) {
      showToast(err.message || 'Bulk adjustment failed', 'error');
    }
  };

  // Bulk Excel Import
  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!excelFile) {
      showToast('Please select an Excel file to upload.', 'error');
      return;
    }
    try {
      const res = await managementApiService.importFeeExcel(excelFile);
      setImportSummary(res);
      setImportErrors(res.errors || []);
      if (res.successRows > 0) {
        showToast(`Imported ${res.successRows} fee items successfully.`);
        loadStudentFees();
      }
    } catch (err: any) {
      showToast(err.message || 'Excel import failed', 'error');
    }
  };

  return (
    <div className="fee-module-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            backgroundColor: toastMessage.type === 'success' ? '#059669' : '#e11d48',
            color: '#ffffff',
            padding: '0.75rem 1.25rem',
            borderRadius: '8px',
            boxShadow: '0 10px 15px -3px rgba(0,0,0,0.2)',
            zIndex: 9999,
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {toastMessage.type === 'success' ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toastMessage.text}
        </div>
      )}

      {/* Header */}
      <div className="fee-header-section">
        <div className="fee-header-title-group">
          <h1>Fee Management / Fee Collection</h1>
          <p className="fee-header-subtitle">
            Manage student fees, apply filters, add fines, and promote students efficiently.
          </p>
        </div>

        <div className="fee-header-actions">
          <button
            type="button"
            className="fee-btn-secondary"
            onClick={loadStudentFees}
            title="Refresh fee collection table"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Academic Year Selector Pills */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {academicYears.map((yr) => (
          <button
            key={yr.id}
            type="button"
            className={`fee-tab-button ${selectedYearId === yr.id ? 'active' : ''}`}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: selectedYearId === yr.id ? '#1e293b' : '#ffffff',
              color: selectedYearId === yr.id ? '#ffffff' : '#334155',
              borderRadius: '20px',
              border: '1px solid #cbd5e1',
            }}
            onClick={() => setSelectedYearId(yr.id)}
          >
            <Calendar size={14} />
            {yr.code} {yr.isCurrent ? '★' : ''}
          </button>
        ))}
      </div>

      {/* Operations Toolbar */}
      <div className="fee-toolbar-container">
        <div className="fee-search-input-wrapper">
          <Search size={16} className="fee-search-icon" />
          <input
            type="text"
            placeholder="Search student by name, roll no, email..."
            className="fee-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="fee-select-filter"
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
        >
          <option value="ALL">All Modules</option>
          <option value="HOSTEL">Hostel Fees</option>
          <option value="COLLEGE">College Fees</option>
        </select>

        <select
          className="fee-select-filter"
          value={paymentStatusFilter}
          onChange={(e) => setPaymentStatusFilter(e.target.value)}
        >
          <option value="ALL">All Payment Status</option>
          <option value="UNPAID">Unpaid</option>
          <option value="PARTIAL">Partial</option>
          <option value="PAID">Paid</option>
          <option value="OVERPAID">Overpaid</option>
        </select>

        <select
          className="fee-select-filter"
          value={dueStatusFilter}
          onChange={(e) => setDueStatusFilter(e.target.value)}
        >
          <option value="ALL">All Dues Status</option>
          <option value="DUES_ONLY">Students with Dues</option>
          <option value="PAID_ONLY">Fully Paid Only</option>
        </select>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="fee-btn-secondary"
            onClick={handleSyncFees}
            title="Synchronize fee assessments from active fee structures"
          >
            <RefreshCw size={14} />
            Sync Fee Items
          </button>

          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => setShowPromoteModal(true)}
            title="Promote students semester or academic year"
          >
            <ArrowUpRight size={14} />
            Promote
          </button>

          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => setShowNotificationModal(true)}
            title="Send notifications to students with dues"
          >
            <Bell size={14} />
            Send Notification
          </button>

          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => setShowBulkAdjustModal(true)}
            title="Apply bulk fine or discount"
          >
            <Sliders size={14} />
            Bulk Adjust
          </button>

          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => {
              window.open(`/api/management/fee-collection/export-excel?academicYearId=${selectedYearId}`, '_blank');
            }}
            title="Download Excel spreadsheet"
          >
            <Download size={14} />
            Export Excel
          </button>

          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => {
              setExcelFile(null);
              setImportErrors([]);
              setImportSummary(null);
              setShowBulkImportModal(true);
            }}
            title="Upload Excel dues file"
          >
            <Upload size={14} />
            Import Excel
          </button>
        </div>
      </div>

      {/* Main Student Fee Table */}
      <div className="fee-table-card">
        <div className="fee-table-responsive">
          <table className="fee-data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Student</th>
                <th>Academic Year</th>
                <th>Total Fee</th>
                <th>Paid</th>
                <th>Due</th>
                <th>Excess Paid</th>
                <th>Refund</th>
                <th>Paid %</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                    {isLoading ? 'Loading authoritative student fees from database...' : 'No student records found.'}
                  </td>
                </tr>
              ) : (
                students.map((st) => {
                  const isExpanded = !!expandedStudents[st.student.id];

                  return (
                    <React.Fragment key={st.student.id}>
                      <tr style={{ backgroundColor: isExpanded ? '#f8fafc' : undefined }}>
                        <td>
                          <button
                            type="button"
                            onClick={() => toggleExpand(st.student.id)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569' }}
                            title="Expand fee items"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div>
                              <strong>{st.student.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                {st.student.jntuNo} • {st.student.blockName || 'Main'} / {st.student.roomNumber || '—'}
                              </div>
                              {st.hasActiveDetention && (
                                <span
                                  style={{
                                    display: 'inline-block',
                                    fontSize: '0.7rem',
                                    color: '#e11d48',
                                    fontWeight: 700,
                                    backgroundColor: '#fff1f2',
                                    padding: '0.1rem 0.35rem',
                                    borderRadius: '4px',
                                    marginTop: '0.2rem',
                                  }}
                                >
                                  DETENTION: {st.detentionDetails?.detainedYearOfStudy}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{st.academicYear.code}</td>
                        <td>
                          <strong>₹{st.totalFee.toLocaleString('en-IN')}</strong>
                        </td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>
                          ₹{st.paidAmount.toLocaleString('en-IN')}
                        </td>
                        <td>
                          <strong style={{ color: st.dueAmount > 0 ? '#e11d48' : '#059669' }}>
                            ₹{st.dueAmount.toLocaleString('en-IN')}
                          </strong>
                        </td>
                        <td>{st.excessPaid > 0 ? `₹${st.excessPaid.toLocaleString('en-IN')}` : '—'}</td>
                        <td>{st.refundedAmount > 0 ? `₹${st.refundedAmount.toLocaleString('en-IN')}` : '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div
                              style={{
                                width: '50px',
                                height: '6px',
                                backgroundColor: '#e2e8f0',
                                borderRadius: '3px',
                                overflow: 'hidden',
                              }}
                            >
                              <div
                                style={{
                                  width: `${st.paidPercent}%`,
                                  height: '100%',
                                  backgroundColor: st.paidPercent === 100 ? '#059669' : '#3b82f6',
                                }}
                              />
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{st.paidPercent}%</span>
                          </div>
                        </td>
                        <td>
                          <span
                            className={`fee-badge ${
                              st.overallStatus === 'PAID'
                                ? 'badge-paid'
                                : st.overallStatus === 'PARTIAL'
                                ? 'badge-partial'
                                : st.overallStatus === 'OVERPAID'
                                ? 'badge-overpaid'
                                : 'badge-unpaid'
                            }`}
                          >
                            {st.overallStatus}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            {st.dueAmount > 0 && (
                              <button
                                type="button"
                                className="fee-btn-primary"
                                style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                onClick={() => handleOpenPayment(st)}
                              >
                                Pay
                              </button>
                            )}
                            <button
                              type="button"
                              className="fee-btn-secondary"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => handleOpenHistory(st)}
                              title="View Payment Details & History"
                            >
                              <History size={12} />
                              History
                            </button>
                            <button
                              type="button"
                              className="fee-btn-outline-blue"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setExtraFeeStudent(st);
                                setExtraFeeForm({
                                  feeType: 'Annual Hostel Mess & Dining Charges',
                                  module: 'HOSTEL',
                                  amount: '',
                                  isBiometricAttendance: false,
                                  startDate: '',
                                  endDate: '',
                                  workingDays: '30',
                                  dailyRate: '150',
                                });
                                setShowExtraFeeModal(true);
                              }}
                              title="Add Extra Fee"
                            >
                              <Plus size={12} />
                              Extra
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Breakdown Rows */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={11} style={{ backgroundColor: '#f1f5f9', padding: '1rem 1.5rem' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: '0.5rem', color: '#1e293b' }}>
                              Itemized Fee Breakdown for {st.student.name}
                            </div>
                            <table style={{ width: '100%', backgroundColor: '#ffffff', borderRadius: '6px', overflow: 'hidden', fontSize: '0.8125rem' }}>
                              <thead style={{ backgroundColor: '#e2e8f0', color: '#334155' }}>
                                <tr>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Fee Type</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Module</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Total Fee</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Paid</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Concession</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Due</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Excess</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Refund</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Status</th>
                                  <th style={{ padding: '0.5rem 0.75rem' }}>Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {st.items.map((item) => (
                                  <tr key={item.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <strong>{item.feeType}</strong>
                                      {item.isExtraFee && (
                                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', color: '#9333ea', backgroundColor: '#faf5ff', padding: '0.1rem 0.3rem', borderRadius: '3px' }}>
                                          EXTRA
                                        </span>
                                      )}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>{item.module}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>₹{item.totalFee.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', color: '#059669' }}>
                                      ₹{item.paidAmount.toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>₹{item.concessionAmount.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: item.dueAmount > 0 ? '#e11d48' : '#059669' }}>
                                      ₹{item.dueAmount.toLocaleString('en-IN')}
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>₹{item.excessPaid.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>₹{item.refundedAmount.toLocaleString('en-IN')}</td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <span className={`fee-badge ${item.status === 'PAID' ? 'badge-paid' : item.status === 'PARTIAL' ? 'badge-partial' : 'badge-unpaid'}`}>
                                        {item.status}
                                      </span>
                                    </td>
                                    <td style={{ padding: '0.5rem 0.75rem' }}>
                                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                                        {item.dueAmount > 0 && (
                                          <button
                                            type="button"
                                            className="fee-btn-primary"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                            onClick={() => handleOpenPayment(st, item)}
                                          >
                                            Collect
                                          </button>
                                        )}
                                        {item.paidAmount > item.refundedAmount && (
                                          <button
                                            type="button"
                                            className="fee-btn-secondary"
                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                                            onClick={() => handleProcessRefund(item.id)}
                                          >
                                            Refund
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* =================================================================== */}
      {/* MODAL: PAYMENT COLLECTION (UPI, CHEQUE, SBI COLLECT)                */}
      {/* =================================================================== */}
      {showPaymentModal && paymentTargetStudent && (
        <div className="fee-modal-backdrop" onClick={() => setShowPaymentModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>
                Record Fee Payment • {paymentTargetStudent.student.name} ({paymentTargetStudent.student.jntuNo})
              </h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowPaymentModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordPayment}>
              <div className="fee-modal-body">
                {paymentTargetItem && (
                  <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    <strong>Allocating To:</strong> {paymentTargetItem.feeType} ({paymentTargetItem.module}) — Due: ₹{paymentTargetItem.dueAmount.toLocaleString('en-IN')}
                  </div>
                )}

                {/* Full vs Partial Toggle */}
                <div className="fee-form-group">
                  <label>Payment Mode</label>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="payType"
                        checked={paymentType === 'FULL'}
                        onChange={() => {
                          setPaymentType('FULL');
                          setPaymentAmount((paymentTargetItem ? paymentTargetItem.dueAmount : paymentTargetStudent.dueAmount).toString());
                        }}
                      />
                      <span>Pay Full Due (₹{(paymentTargetItem ? paymentTargetItem.dueAmount : paymentTargetStudent.dueAmount).toLocaleString('en-IN')})</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="payType"
                        checked={paymentType === 'PARTIAL'}
                        onChange={() => setPaymentType('PARTIAL')}
                      />
                      <span>Pay Partial Amount</span>
                    </label>
                  </div>
                </div>

                {/* Amount Input */}
                <div className="fee-form-group">
                  <label>Amount to Collect (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={paymentTargetItem ? paymentTargetItem.dueAmount : paymentTargetStudent.dueAmount}
                    className="fee-form-input"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    disabled={paymentType === 'FULL'}
                    required
                  />
                </div>

                {/* Payment Method Selector */}
                <div className="fee-form-group">
                  <label>Payment Method</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={`fee-tab-button ${paymentMethod === 'UPI' ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      onClick={() => setPaymentMethod('UPI')}
                    >
                      1. UPI
                    </button>
                    <button
                      type="button"
                      className={`fee-tab-button ${paymentMethod === 'CHEQUE' ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      onClick={() => setPaymentMethod('CHEQUE')}
                    >
                      2. Cheque
                    </button>
                    <button
                      type="button"
                      className={`fee-tab-button ${paymentMethod === 'SBI_COLLECT' ? 'active' : ''}`}
                      style={{ flex: 1, justifyContent: 'center', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                      onClick={() => setPaymentMethod('SBI_COLLECT')}
                    >
                      3. SBI Collect
                    </button>
                  </div>
                </div>

                {/* Bank Account Selection */}
                <div className="fee-form-group">
                  <label>Deposit To Bank Account</label>
                  <select
                    className="fee-form-select"
                    value={selectedBankAccountId}
                    onChange={(e) => setSelectedBankAccountId(e.target.value)}
                    required
                  >
                    {bankAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.displayLabel} [{acc.accountIdentifier}]
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic Fields: UPI */}
                {paymentMethod === 'UPI' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div className="fee-form-group">
                      <label>UPI Application</label>
                      <select
                        className="fee-form-select"
                        value={upiApp}
                        onChange={(e) => setUpiApp(e.target.value)}
                      >
                        <option value="PhonePe">PhonePe</option>
                        <option value="Google Pay">Google Pay</option>
                        <option value="Paytm">Paytm</option>
                        <option value="Other UPI">Other UPI</option>
                      </select>
                    </div>

                    <div className="fee-form-group">
                      <label>UPI Reference / Transaction ID</label>
                      <input
                        type="text"
                        className="fee-form-input"
                        placeholder="e.g. 482910482910 or UPI-29482"
                        value={upiReference}
                        onChange={(e) => setUpiReference(e.target.value.toUpperCase())}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Fields: CHEQUE */}
                {paymentMethod === 'CHEQUE' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div className="fee-form-row">
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>Cheque Number</label>
                        <input
                          type="text"
                          className="fee-form-input"
                          placeholder="e.g. 004821"
                          value={chequeNumber}
                          onChange={(e) => setChequeNumber(e.target.value)}
                          required
                        />
                      </div>
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>Issuing Bank Name</label>
                        <input
                          type="text"
                          className="fee-form-input"
                          placeholder="e.g. State Bank of India"
                          value={chequeBankName}
                          onChange={(e) => setChequeBankName(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="fee-form-group">
                      <label>Received By Staff (Name / ID)</label>
                      <input
                        type="text"
                        className="fee-form-input"
                        value={chequeReceivedBy}
                        onChange={(e) => setChequeReceivedBy(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}

                {/* Dynamic Fields: SBI COLLECT */}
                {paymentMethod === 'SBI_COLLECT' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}>
                    <div className="fee-form-group">
                      <label>SBI Collect Reference / Transaction ID</label>
                      <input
                        type="text"
                        className="fee-form-input"
                        placeholder="e.g. DU12345678"
                        value={sbiCollectReference}
                        onChange={(e) => setSbiCollectReference(e.target.value.toUpperCase())}
                        required
                      />
                    </div>

                    <div className="fee-form-group">
                      <label>Verified By Staff (Name / ID)</label>
                      <input
                        type="text"
                        className="fee-form-input"
                        value={sbiVerifiedBy}
                        onChange={(e) => setSbiVerifiedBy(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowPaymentModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Confirm Payment (₹{parseFloat(paymentAmount || '0').toLocaleString('en-IN')})
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PRINTABLE RECEIPT                                            */}
      {/* =================================================================== */}
      {showReceiptModal && currentReceiptData && (
        <div className="fee-modal-backdrop" onClick={() => setShowReceiptModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '540px' }}>
            <div className="fee-modal-header">
              <h3>Official Fee Receipt</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowReceiptModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="fee-modal-body">
              <div className="fee-receipt-paper">
                <div className="fee-receipt-header">
                  <h2 className="fee-receipt-logo-title">HARSHA INSTITUTION OF TECHNOLOGY</h2>
                  <p className="fee-receipt-sub">Student Hostel & College Fee Administration</p>
                  <div className="fee-receipt-number-badge">
                    RECEIPT: {currentReceiptData.receiptNumber}
                  </div>
                </div>

                <div className="fee-receipt-row">
                  <span>Student Name:</span>
                  <strong>{currentReceiptData.student?.name}</strong>
                </div>

                <div className="fee-receipt-row">
                  <span>JNTU / Roll No:</span>
                  <strong>{currentReceiptData.student?.jntuNo}</strong>
                </div>

                <div className="fee-receipt-row">
                  <span>Academic Year:</span>
                  <span>{currentReceiptData.academicYear?.code}</span>
                </div>

                <div className="fee-receipt-row">
                  <span>Payment Method:</span>
                  <strong>{currentReceiptData.paymentMethod}</strong>
                </div>

                <div className="fee-receipt-row">
                  <span>Transaction Ref:</span>
                  <span>{currentReceiptData.transactionReference}</span>
                </div>

                <div className="fee-receipt-row">
                  <span>Bank Account:</span>
                  <span>{currentReceiptData.bankAccount?.name}</span>
                </div>

                <div className="fee-receipt-row">
                  <span>Date & Time:</span>
                  <span>{new Date(currentReceiptData.timestamp).toLocaleString('en-IN')}</span>
                </div>

                <div className="fee-receipt-row bold">
                  <span>Total Amount Paid:</span>
                  <span>₹{Number(currentReceiptData.totalAmount).toLocaleString('en-IN')}</span>
                </div>

                {currentReceiptData.allocations && currentReceiptData.allocations.length > 0 && (
                  <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Allocated Towards:</div>
                    {currentReceiptData.allocations.map((a: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                        <span>• {a.feeType}</span>
                        <span>₹{Number(a.amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                  Recorded by: {currentReceiptData.recordedBy} • Authoritative PostgreSQL Record
                </div>
              </div>
            </div>

            <div className="fee-modal-footer">
              <button
                type="button"
                className="fee-btn-secondary"
                onClick={() => setShowReceiptModal(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="fee-btn-primary"
                onClick={() => window.print()}
              >
                <Printer size={16} />
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PAYMENT HISTORY & REFUND WORKFLOW                             */}
      {/* =================================================================== */}
      {showHistoryModal && historyStudent && (
        <div className="fee-modal-backdrop" onClick={() => setShowHistoryModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '750px' }}>
            <div className="fee-modal-header">
              <h3>
                Payment History • {historyStudent.student.name} ({historyStudent.student.jntuNo})
              </h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowHistoryModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="fee-modal-body">
              {historyPayments.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                  No payment transactions recorded yet for this student in current academic year.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {historyPayments.map((p) => (
                    <div
                      key={p.id}
                      style={{
                        backgroundColor: '#f8fafc',
                        padding: '1rem',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <div>
                          <strong style={{ fontSize: '1rem' }}>{p.receiptNumber}</strong>
                          <span
                            style={{
                              marginLeft: '0.5rem',
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.4rem',
                              backgroundColor: '#ecfdf5',
                              color: '#059669',
                              borderRadius: '4px',
                              fontWeight: 700,
                            }}
                          >
                            {p.paymentMethod}
                          </span>
                        </div>
                        <strong style={{ fontSize: '1.125rem', color: '#059669' }}>
                          ₹{Number(p.amount).toLocaleString('en-IN')}
                        </strong>
                      </div>

                      <div style={{ fontSize: '0.8125rem', color: '#475569', lineHeight: 1.5 }}>
                        <div>
                          <strong>Reference:</strong> {p.transactionReference}
                        </div>
                        <div>
                          <strong>Deposited To:</strong> {p.bankAccount?.name} ({p.bankAccount?.accountIdentifier})
                        </div>
                        <div>
                          <strong>Date:</strong> {new Date(p.createdAt).toLocaleString('en-IN')} • Recorded by: {p.recordedBy}
                        </div>
                      </div>

                      {p.refunds && p.refunds.length > 0 && (
                        <div style={{ marginTop: '0.5rem', backgroundColor: '#fff1f2', padding: '0.5rem', borderRadius: '4px', fontSize: '0.75rem', color: '#be123c' }}>
                          <strong>Refunds Recorded:</strong>
                          {p.refunds.map((rf: any, i: number) => (
                            <div key={i}>
                              ₹{Number(rf.amount).toLocaleString('en-IN')} — Reason: {rf.reason}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="fee-modal-footer">
              <button
                type="button"
                className="fee-btn-secondary"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD EXTRA FEE (BIOMETRIC ATTENDANCE OPTION)                   */}
      {/* =================================================================== */}
      {showExtraFeeModal && extraFeeStudent && (
        <div className="fee-modal-backdrop" onClick={() => setShowExtraFeeModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>
                Add Extra Fee • {extraFeeStudent.student.name} ({extraFeeStudent.student.jntuNo})
              </h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowExtraFeeModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExtraFee}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Fee Type</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    value={extraFeeForm.feeType}
                    onChange={(e) => setExtraFeeForm({ ...extraFeeForm, feeType: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Module Scope</label>
                  <select
                    className="fee-form-select"
                    value={extraFeeForm.module}
                    onChange={(e) => setExtraFeeForm({ ...extraFeeForm, module: e.target.value })}
                  >
                    <option value="HOSTEL">Hostel</option>
                    <option value="COLLEGE">College</option>
                  </select>
                </div>

                <div className="fee-form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={extraFeeForm.isBiometricAttendance}
                      onChange={(e) => setExtraFeeForm({ ...extraFeeForm, isBiometricAttendance: e.target.checked })}
                    />
                    <strong>Calculate Mess Charges from Biometric Attendance punches</strong>
                  </label>
                </div>

                {extraFeeForm.isBiometricAttendance ? (
                  <div style={{ backgroundColor: '#eff6ff', padding: '1rem', borderRadius: '8px', border: '1px solid #bfdbfe', marginBottom: '1rem' }}>
                    <div className="fee-form-row">
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>Start Date</label>
                        <input
                          type="date"
                          className="fee-form-input"
                          value={extraFeeForm.startDate}
                          onChange={(e) => setExtraFeeForm({ ...extraFeeForm, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>End Date</label>
                        <input
                          type="date"
                          className="fee-form-input"
                          value={extraFeeForm.endDate}
                          onChange={(e) => setExtraFeeForm({ ...extraFeeForm, endDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="fee-form-row">
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>Working Days in Month</label>
                        <input
                          type="number"
                          className="fee-form-input"
                          value={extraFeeForm.workingDays}
                          onChange={(e) => setExtraFeeForm({ ...extraFeeForm, workingDays: e.target.value })}
                          required
                        />
                      </div>
                      <div className="fee-form-group" style={{ flex: 1 }}>
                        <label>Daily Mess Rate (INR)</label>
                        <input
                          type="number"
                          className="fee-form-input"
                          value={extraFeeForm.dailyRate}
                          onChange={(e) => setExtraFeeForm({ ...extraFeeForm, dailyRate: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="fee-form-group">
                    <label>Amount (INR)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      className="fee-form-input"
                      placeholder="e.g. 2500"
                      value={extraFeeForm.amount}
                      onChange={(e) => setExtraFeeForm({ ...extraFeeForm, amount: e.target.value })}
                      required
                    />
                  </div>
                )}
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowExtraFeeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Assess & Persist Fee Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: PROMOTE STUDENTS                                             */}
      {/* =================================================================== */}
      {showPromoteModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowPromoteModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Promote Students</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowPromoteModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePromoteStudents}>
              <div className="fee-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  Promote students from the currently selected academic year to the target academic year.
                  <strong> Students with active academic detentions will be automatically held back.</strong>
                </p>

                <div className="fee-form-group">
                  <label>Promotion Type</label>
                  <select
                    className="fee-form-select"
                    value={promotionType}
                    onChange={(e) => setPromotionType(e.target.value as any)}
                  >
                    <option value="ACADEMIC_YEAR">Promote Academic Year</option>
                    <option value="SEMESTER">Promote Semester</option>
                  </select>
                </div>

                <div className="fee-form-group">
                  <label>Target Academic Year</label>
                  <select
                    className="fee-form-select"
                    value={targetAcademicYearId}
                    onChange={(e) => setTargetAcademicYearId(e.target.value)}
                    required
                  >
                    <option value="">Select Target Year</option>
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.code} ({y.name})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowPromoteModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Execute Promotion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: SEND DUE NOTIFICATIONS                                       */}
      {/* =================================================================== */}
      {showNotificationModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowNotificationModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Send Fee Due Notifications</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowNotificationModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendNotifications}>
              <div className="fee-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  Broadcast formal fee due reminders into the Student Portal notifications feed for all residents with outstanding balances in the active academic year.
                </p>

                <div className="fee-form-group">
                  <label>Custom Message (Optional)</label>
                  <textarea
                    className="fee-form-textarea"
                    rows={3}
                    placeholder="Leave empty to use institutional default fee due notification template..."
                    value={notificationMessage}
                    onChange={(e) => setNotificationMessage(e.target.value)}
                  />
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowNotificationModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  <Bell size={16} />
                  Send to All Students with Dues
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: BULK FEE ADJUSTMENT (FINE / DISCOUNT)                        */}
      {/* =================================================================== */}
      {showBulkAdjustModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowBulkAdjustModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Bulk Fee Adjustment</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowBulkAdjustModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleBulkAdjustment}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Adjustment Type</label>
                  <select
                    className="fee-form-select"
                    value={bulkAdjustForm.adjustmentType}
                    onChange={(e) => setBulkAdjustForm({ ...bulkAdjustForm, adjustmentType: e.target.value })}
                  >
                    <option value="DISCOUNT">Concession / Discount (Reduces Dues)</option>
                    <option value="FINE">Administrative Fine / Penalty (Increases Dues)</option>
                  </select>
                </div>

                <div className="fee-form-group">
                  <label>Adjustment Amount per Fee Item (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="fee-form-input"
                    placeholder="e.g. 500"
                    value={bulkAdjustForm.amount}
                    onChange={(e) => setBulkAdjustForm({ ...bulkAdjustForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Audit Reason</label>
                  <textarea
                    className="fee-form-textarea"
                    rows={2}
                    placeholder="e.g. Late fee waiver approved by warden"
                    value={bulkAdjustForm.reason}
                    onChange={(e) => setBulkAdjustForm({ ...bulkAdjustForm, reason: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowBulkAdjustModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Apply Bulk Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: BULK EXCEL IMPORT                                            */}
      {/* =================================================================== */}
      {showBulkImportModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowBulkImportModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="fee-modal-header">
              <h3>Bulk Import Fees (Excel)</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowBulkImportModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportExcel}>
              <div className="fee-modal-body">
                <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '1rem' }}>
                  Upload a spreadsheet (.xlsx or .xls) with columns: <code>JNTU / Roll No</code>, <code>Fee Type</code>, <code>Amount</code>, <code>Module</code>.
                </p>

                <div className="fee-form-group">
                  <label>Select Spreadsheet File</label>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="fee-form-input"
                    onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
                    required
                  />
                </div>

                {importSummary && (
                  <div style={{ backgroundColor: '#ecfdf5', padding: '1rem', borderRadius: '6px', marginTop: '1rem' }}>
                    <strong>Processed {importSummary.totalRows} rows:</strong> {importSummary.successRows} successfully imported, {importSummary.failedRows} failed.
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div style={{ backgroundColor: '#fff1f2', padding: '1rem', borderRadius: '6px', marginTop: '1rem', maxHeight: '150px', overflowY: 'auto' }}>
                    <strong style={{ color: '#be123c' }}>Validation Errors:</strong>
                    <ul style={{ margin: '0.5rem 0 0 1rem', padding: 0, fontSize: '0.75rem', color: '#be123c' }}>
                      {importErrors.map((err, i) => (
                        <li key={i}>
                          Row {err.row}: {err.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowBulkImportModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  <Upload size={16} />
                  Validate & Import
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
