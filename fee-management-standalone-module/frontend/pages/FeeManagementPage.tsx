import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  Building,
  Calendar,
  Award,
  AlertTriangle,
  Settings,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  CheckCircle,
  XCircle,
  ArrowRight,
  Landmark,
  DollarSign,
  Users,
  Copy,
  Check,
} from 'lucide-react';
import { feeManagementApi as managementApiService } from '../services/fee-api';
import {
  FeeKpiStats,
  AcademicYearItem,
  FeeStructureItem,
  BankAccountItem,
  ScholarshipTypeItem,
  StudentScholarshipItem,
  DetentionItem,
  InstitutionSettingsItem,
} from '../services/fee-types';
import '../styles/FeeModules.css';

interface FeeManagementPageProps {
  onNavigate?: (path: string) => void;
}

type TabType = 'structures' | 'bankAccounts' | 'academicYears' | 'scholarships' | 'detentions' | 'settings';

export const FeeManagementPage: React.FC<FeeManagementPageProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<TabType>('structures');
  const [kpiStats, setKpiStats] = useState<FeeKpiStats | null>(null);
  const [isLoadingKpi, setIsLoadingKpi] = useState<boolean>(true);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Core Data State
  const [academicYears, setAcademicYears] = useState<AcademicYearItem[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<string>('');
  const [feeStructures, setFeeStructures] = useState<FeeStructureItem[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountItem[]>([]);
  const [scholarshipTypes, setScholarshipTypes] = useState<ScholarshipTypeItem[]>([]);
  const [scholarships, setScholarships] = useState<StudentScholarshipItem[]>([]);
  const [detentions, setDetentions] = useState<DetentionItem[]>([]);
  const [institutionSettings, setInstitutionSettings] = useState<InstitutionSettingsItem | null>(null);
  const [isTabLoading, setIsTabLoading] = useState<boolean>(false);

  // Filters
  const [structureModuleFilter, setStructureModuleFilter] = useState<string>('ALL');
  const [structureCategoryFilter, setStructureCategoryFilter] = useState<string>('ALL');
  const [structureSearch, setStructureSearch] = useState<string>('');
  const [scholarshipSearch, setScholarshipSearch] = useState<string>('');
  const [detentionSearch, setDetentionSearch] = useState<string>('');

  // Modals state
  const [showAddStructureModal, setShowAddStructureModal] = useState<boolean>(false);
  const [editingStructure, setEditingStructure] = useState<FeeStructureItem | null>(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState<boolean>(false);
  const [editingAccount, setEditingAccount] = useState<BankAccountItem | null>(null);
  const [showAddYearModal, setShowAddYearModal] = useState<boolean>(false);
  const [showAssignScholarshipModal, setShowAssignScholarshipModal] = useState<boolean>(false);
  const [showCreateDetentionModal, setShowCreateDetentionModal] = useState<boolean>(false);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  // Form states
  const [structureForm, setStructureForm] = useState({
    academicYearId: '',
    module: 'HOSTEL',
    category: 'REGULAR',
    feeKind: 'MESS_FEE',
    name: '',
    amount: '',
  });

  const [accountForm, setAccountForm] = useState({
    name: '',
    accountIdentifier: '',
    bankName: '',
    accountNumber: '',
    ifsc: '',
    kind: 'HOSTEL',
    module: 'BOTH',
    displayLabel: '',
  });

  const [yearForm, setYearForm] = useState({
    code: '',
    name: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
  });

  const [scholarshipForm, setScholarshipForm] = useState({
    studentId: '',
    scholarshipTypeId: '',
    academicYearId: '',
    sanctionedAmount: '',
    referenceNumber: '',
    remarks: '',
  });

  const [detentionForm, setDetentionForm] = useState({
    studentId: '',
    academicYearId: '',
    currentYearOfStudy: '3rd Year',
    detainedYearOfStudy: '2nd Year (Held Back)',
    reason: '',
    remarks: '',
  });

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // 1. Load authoritative KPI summary
  const loadKpiStats = useCallback(async () => {
    setIsLoadingKpi(true);
    try {
      const res = await managementApiService.getFeeKpiStats();
      if (res.success) {
        setKpiStats(res.stats);
      }
    } catch (err: any) {
      console.error('Failed to load fee KPI stats:', err);
    } finally {
      setIsLoadingKpi(false);
    }
  }, []);

  // 2. Load Academic Years
  const loadAcademicYears = useCallback(async () => {
    try {
      const res = await managementApiService.getAcademicYears();
      if (res.success) {
        setAcademicYears(res.academicYears);
        const current = res.academicYears.find((y) => y.isCurrent) || res.academicYears[0];
        if (current && !selectedYearId) {
          setSelectedYearId(current.id);
          setStructureForm((prev) => ({ ...prev, academicYearId: current.id }));
          setScholarshipForm((prev) => ({ ...prev, academicYearId: current.id }));
          setDetentionForm((prev) => ({ ...prev, academicYearId: current.id }));
        }
      }
    } catch (err) {
      console.error('Failed to load academic years:', err);
    }
  }, [selectedYearId]);

  // 3. Load Active Tab Content
  const loadActiveTabData = useCallback(async () => {
    setIsTabLoading(true);
    try {
      if (activeTab === 'structures') {
        const res = await managementApiService.getFeeStructures({
          module: structureModuleFilter,
          academicYearId: selectedYearId,
          category: structureCategoryFilter,
          search: structureSearch,
        });
        if (res.success) setFeeStructures(res.feeStructures);
      } else if (activeTab === 'bankAccounts') {
        const res = await managementApiService.getBankAccounts();
        if (res.success) setBankAccounts(res.bankAccounts);
      } else if (activeTab === 'academicYears') {
        const res = await managementApiService.getAcademicYears();
        if (res.success) setAcademicYears(res.academicYears);
      } else if (activeTab === 'scholarships') {
        const [typesRes, schRes] = await Promise.all([
          managementApiService.getScholarshipTypes(),
          managementApiService.getStudentScholarships({
            academicYearId: selectedYearId,
            studentSearch: scholarshipSearch,
          }),
        ]);
        if (typesRes.success) setScholarshipTypes(typesRes.scholarshipTypes);
        if (schRes.success) setScholarships(schRes.scholarships);
      } else if (activeTab === 'detentions') {
        const res = await managementApiService.getDetentions({
          academicYearId: selectedYearId,
          studentSearch: detentionSearch,
        });
        if (res.success) setDetentions(res.detentions);
      } else if (activeTab === 'settings') {
        const res = await managementApiService.getInstitutionSettings();
        if (res.success) setInstitutionSettings(res.settings);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to load tab data', 'error');
    } finally {
      setIsTabLoading(false);
    }
  }, [
    activeTab,
    selectedYearId,
    structureModuleFilter,
    structureCategoryFilter,
    structureSearch,
    scholarshipSearch,
    detentionSearch,
  ]);

  useEffect(() => {
    loadKpiStats();
    loadAcademicYears();
  }, [loadKpiStats, loadAcademicYears]);

  useEffect(() => {
    loadActiveTabData();
  }, [loadActiveTabData]);

  // Realtime subscription
  useEffect(() => {
    const sse = new EventSource('/api/management/events-stream');
    sse.addEventListener('fee_event', () => {
      loadKpiStats();
      loadActiveTabData();
    });
    return () => sse.close();
  }, [loadKpiStats, loadActiveTabData]);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(id);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  // -------------------------------------------------------------------------
  // ACTION HANDLERS
  // -------------------------------------------------------------------------

  // Fee Structure Handlers
  const handleSaveStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(structureForm.amount);
      if (isNaN(amt) || amt <= 0) {
        showToast('Please enter a valid amount greater than zero.', 'error');
        return;
      }

      if (editingStructure) {
        await managementApiService.updateFeeStructure(editingStructure.id, {
          name: structureForm.name,
          amount: amt,
          category: structureForm.category,
          feeKind: structureForm.feeKind,
        });
        showToast('Fee structure updated successfully.');
      } else {
        await managementApiService.createFeeStructure({
          academicYearId: structureForm.academicYearId || selectedYearId,
          module: structureForm.module,
          category: structureForm.category,
          feeKind: structureForm.feeKind,
          name: structureForm.name,
          amount: amt,
        });
        showToast('Fee structure created successfully.');
      }
      setShowAddStructureModal(false);
      setEditingStructure(null);
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Operation failed', 'error');
    }
  };

  const handleToggleStructureStatus = async (id: string) => {
    try {
      await managementApiService.toggleFeeStructureStatus(id);
      showToast('Fee structure status updated.');
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle status', 'error');
    }
  };

  // Bank Account Handlers
  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingAccount) {
        await managementApiService.updateBankAccount(editingAccount.id, accountForm);
        showToast('Bank account updated successfully.');
      } else {
        await managementApiService.createBankAccount(accountForm);
        showToast('Bank account added successfully.');
      }
      setShowAddAccountModal(false);
      setEditingAccount(null);
      loadActiveTabData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save bank account', 'error');
    }
  };

  const handleToggleAccountStatus = async (id: string) => {
    try {
      await managementApiService.toggleBankAccountStatus(id);
      showToast('Bank account status updated.');
      loadActiveTabData();
    } catch (err: any) {
      showToast(err.message || 'Failed to toggle bank account status', 'error');
    }
  };

  // Academic Year Handlers
  const handleSaveYear = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await managementApiService.createAcademicYear(yearForm);
      showToast('Academic year created successfully.');
      setShowAddYearModal(false);
      loadAcademicYears();
      loadActiveTabData();
    } catch (err: any) {
      showToast(err.message || 'Failed to create academic year', 'error');
    }
  };

  const handleSetCurrentYear = async (id: string) => {
    try {
      await managementApiService.setCurrentAcademicYear(id);
      showToast('Designated current active academic year.');
      loadAcademicYears();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to set active year', 'error');
    }
  };

  // Scholarship Handlers
  const handleAssignScholarship = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const amt = parseFloat(scholarshipForm.sanctionedAmount);
      if (isNaN(amt) || amt <= 0) {
        showToast('Sanctioned amount must be greater than zero.', 'error');
        return;
      }
      await managementApiService.assignScholarship({
        studentId: scholarshipForm.studentId,
        scholarshipTypeId: scholarshipForm.scholarshipTypeId,
        academicYearId: scholarshipForm.academicYearId || selectedYearId,
        sanctionedAmount: amt,
        referenceNumber: scholarshipForm.referenceNumber,
        remarks: scholarshipForm.remarks,
      });
      showToast('Scholarship assigned successfully.');
      setShowAssignScholarshipModal(false);
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to assign scholarship', 'error');
    }
  };

  const handleApproveScholarship = async (id: string) => {
    try {
      await managementApiService.approveScholarship(id);
      showToast('Scholarship approved.');
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to approve scholarship', 'error');
    }
  };

  const handleApplyScholarship = async (id: string) => {
    try {
      const res = await managementApiService.applyScholarship(id);
      showToast(`Applied ₹${res.appliedAmount.toFixed(2)} towards fee dues.`);
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to apply scholarship', 'error');
    }
  };

  // Detention Handlers
  const handleCreateDetention = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await managementApiService.createDetention({
        studentId: detentionForm.studentId,
        academicYearId: detentionForm.academicYearId || selectedYearId,
        currentYearOfStudy: detentionForm.currentYearOfStudy,
        detainedYearOfStudy: detentionForm.detainedYearOfStudy,
        reason: detentionForm.reason,
        remarks: detentionForm.remarks,
      });
      showToast('Academic detention registered successfully.');
      setShowCreateDetentionModal(false);
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to register detention', 'error');
    }
  };

  const handleRevokeDetention = async (id: string) => {
    const reason = prompt('Please enter reason for revoking detention:') || '';
    try {
      await managementApiService.revokeDetention(id, reason);
      showToast('Detention revoked successfully.');
      loadActiveTabData();
      loadKpiStats();
    } catch (err: any) {
      showToast(err.message || 'Failed to revoke detention', 'error');
    }
  };

  // Institution Settings Save
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionSettings) return;
    try {
      await managementApiService.updateInstitutionSettings({
        institutionMode: institutionSettings.institutionMode,
        institutionName: institutionSettings.institutionName,
        institutionCode: institutionSettings.institutionCode,
        enableScholarships: institutionSettings.enableScholarships,
        enableDetentions: institutionSettings.enableDetentions,
        enableBulkUploads: institutionSettings.enableBulkUploads,
      });
      showToast('Institutional configuration updated successfully.');
      loadActiveTabData();
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
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
          <h1>Fee Management</h1>
          <p className="fee-header-subtitle">
            Configure fee structures, institutional bank accounts, academic years, scholarships, detentions, and configuration settings.
          </p>
        </div>
        <div className="fee-header-actions">
          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => setActiveTab('settings')}
            title="Institution Settings"
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            type="button"
            className="fee-btn-secondary"
            onClick={() => {
              loadKpiStats();
              loadActiveTabData();
            }}
            title="Refresh authoritative metrics"
          >
            <RefreshCw size={16} className={isLoadingKpi || isTabLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Navigation Card into Fee Collection */}
      <div className="fee-nav-banner-card">
        <div className="fee-nav-banner-text">
          <Landmark size={22} color="#60a5fa" />
          <p>Student accounts and day-to-day fee collection operations live in Fee Collection.</p>
        </div>
        <button
          type="button"
          className="fee-nav-banner-btn"
          onClick={() => (onNavigate ? onNavigate('/management/fee-collection') : (window.location.href = '/management/fee-collection'))}
        >
          Go to Fee Collection
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Authoritative PostgreSQL KPI Summary Grid */}
      <div className="fee-kpi-grid">
        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Fee Structures</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
              <Building size={18} />
            </div>
          </div>
          <div className="fee-kpi-value">{isLoadingKpi ? '...' : kpiStats?.feeStructuresCount ?? 0}</div>
        </div>

        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Hostel Due</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="fee-kpi-value" style={{ color: '#e11d48' }}>
            {isLoadingKpi ? '...' : `₹${(kpiStats?.hostelDue ?? 0).toLocaleString('en-IN')}`}
          </div>
        </div>

        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">College Due</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className="fee-kpi-value" style={{ color: '#d97706' }}>
            {isLoadingKpi ? '...' : `₹${(kpiStats?.collegeDue ?? 0).toLocaleString('en-IN')}`}
          </div>
        </div>

        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Students with Dues</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#faf5ff', color: '#9333ea' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="fee-kpi-value">{isLoadingKpi ? '...' : kpiStats?.studentsWithDuesCount ?? 0}</div>
        </div>

        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Scholarships Pending</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#ecfdf5', color: '#059669' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="fee-kpi-value">{isLoadingKpi ? '...' : kpiStats?.scholarshipsPendingCount ?? 0}</div>
        </div>

        <div className="fee-kpi-card">
          <div className="fee-kpi-top">
            <span className="fee-kpi-label">Active Detentions</span>
            <div className="fee-kpi-icon-wrapper" style={{ backgroundColor: '#fff1f2', color: '#e11d48' }}>
              <AlertTriangle size={18} />
            </div>
          </div>
          <div className="fee-kpi-value">{isLoadingKpi ? '...' : kpiStats?.activeDetentionsCount ?? 0}</div>
        </div>
      </div>

      {/* 6 Tabs */}
      <div className="fee-tabs-container">
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'structures' ? 'active' : ''}`}
          onClick={() => setActiveTab('structures')}
        >
          <CreditCard size={16} />
          Fee Structures
        </button>
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'bankAccounts' ? 'active' : ''}`}
          onClick={() => setActiveTab('bankAccounts')}
        >
          <Landmark size={16} />
          Bank Accounts
        </button>
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'academicYears' ? 'active' : ''}`}
          onClick={() => setActiveTab('academicYears')}
        >
          <Calendar size={16} />
          Academic Years
        </button>
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'scholarships' ? 'active' : ''}`}
          onClick={() => setActiveTab('scholarships')}
        >
          <Award size={16} />
          Scholarships
        </button>
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'detentions' ? 'active' : ''}`}
          onClick={() => setActiveTab('detentions')}
        >
          <AlertTriangle size={16} />
          Detentions
        </button>
        <button
          type="button"
          className={`fee-tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={16} />
          Institution Settings
        </button>
      </div>

      {/* =================================================================== */}
      {/* TAB 1: FEE STRUCTURES                                              */}
      {/* =================================================================== */}
      {activeTab === 'structures' && (
        <>
          <div className="fee-toolbar-container">
            <div className="fee-search-input-wrapper">
              <Search size={16} className="fee-search-icon" />
              <input
                type="text"
                placeholder="Search fee structures by name or kind..."
                className="fee-search-input"
                value={structureSearch}
                onChange={(e) => setStructureSearch(e.target.value)}
              />
            </div>

            <select
              className="fee-select-filter"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              <option value="ALL">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code} {y.isCurrent ? '(Current)' : ''}
                </option>
              ))}
            </select>

            <select
              className="fee-select-filter"
              value={structureModuleFilter}
              onChange={(e) => setStructureModuleFilter(e.target.value)}
            >
              <option value="ALL">All Modules</option>
              <option value="HOSTEL">Hostel Module</option>
              <option value="COLLEGE">College Module</option>
            </select>

            <select
              className="fee-select-filter"
              value={structureCategoryFilter}
              onChange={(e) => setStructureCategoryFilter(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              <option value="REGULAR">Regular</option>
              <option value="MANAGEMENT">Management</option>
              <option value="CONVENOR">Convenor</option>
            </select>

            <button
              type="button"
              className="fee-btn-primary"
              onClick={() => {
                setEditingStructure(null);
                setStructureForm({
                  academicYearId: selectedYearId !== 'ALL' ? selectedYearId : academicYears[0]?.id || '',
                  module: 'HOSTEL',
                  category: 'REGULAR',
                  feeKind: 'MESS_FEE',
                  name: '',
                  amount: '',
                });
                setShowAddStructureModal(true);
              }}
            >
              <Plus size={16} />
              Add Structure
            </button>
          </div>

          <div className="fee-table-card">
            <div className="fee-table-responsive">
              <table className="fee-data-table">
                <thead>
                  <tr>
                    <th>Structure Name</th>
                    <th>Module</th>
                    <th>Kind</th>
                    <th>Category</th>
                    <th>Academic Year</th>
                    <th>Amount (INR)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feeStructures.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No fee structures found for current filters.
                      </td>
                    </tr>
                  ) : (
                    feeStructures.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.name}</strong>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              fontWeight: 700,
                              backgroundColor: s.module === 'HOSTEL' ? '#eff6ff' : '#f5f3ff',
                              color: s.module === 'HOSTEL' ? '#1d4ed8' : '#6d28d9',
                            }}
                          >
                            {s.module}
                          </span>
                        </td>
                        <td>{s.feeKind}</td>
                        <td>{s.category}</td>
                        <td>{s.academicYear?.code || '—'}</td>
                        <td>
                          <strong>₹{Number(s.amount).toLocaleString('en-IN')}</strong>
                        </td>
                        <td>
                          <span className={`fee-badge ${s.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                              type="button"
                              className="fee-btn-outline-blue"
                              onClick={() => {
                                setEditingStructure(s);
                                setStructureForm({
                                  academicYearId: s.academicYearId,
                                  module: s.module,
                                  category: s.category,
                                  feeKind: s.feeKind,
                                  name: s.name,
                                  amount: s.amount.toString(),
                                });
                                setShowAddStructureModal(true);
                              }}
                            >
                              <Edit2 size={12} />
                              Edit
                            </button>
                            <button
                              type="button"
                              className="fee-btn-secondary"
                              onClick={() => handleToggleStructureStatus(s.id)}
                            >
                              {s.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
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
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: BANK ACCOUNTS                                                */}
      {/* =================================================================== */}
      {activeTab === 'bankAccounts' && (
        <>
          <div className="fee-toolbar-container">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              Persisted accounts available for payment allocations & banking records
            </span>
            <button
              type="button"
              className="fee-btn-primary"
              onClick={() => {
                setEditingAccount(null);
                setAccountForm({
                  name: '',
                  accountIdentifier: '',
                  bankName: '',
                  accountNumber: '',
                  ifsc: '',
                  kind: 'HOSTEL',
                  module: 'BOTH',
                  displayLabel: '',
                });
                setShowAddAccountModal(true);
              }}
            >
              <Plus size={16} />
              Add Bank Account
            </button>
          </div>

          <div className="fee-bank-grid">
            {bankAccounts.map((acc) => (
              <div key={acc.id} className="fee-bank-card">
                <div>
                  <div className="fee-bank-card-header">
                    <span className="fee-bank-name">{acc.name}</span>
                    <span className={`fee-badge ${acc.status === 'ACTIVE' ? 'badge-active' : 'badge-inactive'}`}>
                      {acc.status}
                    </span>
                  </div>
                  <div style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
                    <span className="fee-bank-code">{acc.accountIdentifier}</span>
                  </div>
                  <div className="fee-bank-details">
                    <div>
                      <strong>Bank:</strong> {acc.bankName}
                    </div>
                    <div>
                      <strong>A/C No:</strong> {acc.accountNumber}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>IFSC:</strong> {acc.ifsc}
                      <button
                        type="button"
                        onClick={() => handleCopy(acc.ifsc, acc.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb' }}
                        title="Copy IFSC"
                      >
                        {copiedAccount === acc.id ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                    <div>
                      <strong>Module:</strong> {acc.module}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    className="fee-btn-outline-blue"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditingAccount(acc);
                      setAccountForm({
                        name: acc.name,
                        accountIdentifier: acc.accountIdentifier,
                        bankName: acc.bankName,
                        accountNumber: acc.accountNumber,
                        ifsc: acc.ifsc,
                        kind: acc.kind,
                        module: acc.module,
                        displayLabel: acc.displayLabel,
                      });
                      setShowAddAccountModal(true);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="fee-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => handleToggleAccountStatus(acc.id)}
                  >
                    {acc.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 3: ACADEMIC YEARS                                               */}
      {/* =================================================================== */}
      {activeTab === 'academicYears' && (
        <>
          <div className="fee-toolbar-container">
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
              Academic Year definitions and active operational periods
            </span>
            <button
              type="button"
              className="fee-btn-primary"
              onClick={() => {
                setYearForm({
                  code: '',
                  name: '',
                  startDate: '',
                  endDate: '',
                  isCurrent: false,
                });
                setShowAddYearModal(true);
              }}
            >
              <Plus size={16} />
              Add Academic Year
            </button>
          </div>

          <div className="fee-table-card">
            <div className="fee-table-responsive">
              <table className="fee-data-table">
                <thead>
                  <tr>
                    <th>Year Code</th>
                    <th>Display Name</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Current Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {academicYears.map((yr) => (
                    <tr key={yr.id}>
                      <td>
                        <strong>{yr.code}</strong>
                      </td>
                      <td>{yr.name}</td>
                      <td>{new Date(yr.startDate).toLocaleDateString('en-IN')}</td>
                      <td>{new Date(yr.endDate).toLocaleDateString('en-IN')}</td>
                      <td>
                        {yr.isCurrent ? (
                          <span className="fee-badge badge-active">CURRENT ACTIVE</span>
                        ) : (
                          <span className="fee-badge badge-inactive">{yr.status}</span>
                        )}
                      </td>
                      <td>
                        {!yr.isCurrent && (
                          <button
                            type="button"
                            className="fee-btn-outline-blue"
                            onClick={() => handleSetCurrentYear(yr.id)}
                          >
                            Set Active
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 4: SCHOLARSHIPS                                                 */}
      {/* =================================================================== */}
      {activeTab === 'scholarships' && (
        <>
          <div className="fee-toolbar-container">
            <div className="fee-search-input-wrapper">
              <Search size={16} className="fee-search-icon" />
              <input
                type="text"
                placeholder="Search by student name or roll number..."
                className="fee-search-input"
                value={scholarshipSearch}
                onChange={(e) => setScholarshipSearch(e.target.value)}
              />
            </div>

            <select
              className="fee-select-filter"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              <option value="ALL">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="fee-btn-primary"
              onClick={() => {
                setScholarshipForm({
                  studentId: '',
                  scholarshipTypeId: scholarshipTypes[0]?.id || '',
                  academicYearId: selectedYearId !== 'ALL' ? selectedYearId : academicYears[0]?.id || '',
                  sanctionedAmount: '',
                  referenceNumber: '',
                  remarks: '',
                });
                setShowAssignScholarshipModal(true);
              }}
            >
              <Plus size={16} />
              Assign Scholarship
            </button>
          </div>

          <div className="fee-table-card">
            <div className="fee-table-responsive">
              <table className="fee-data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Scholarship Scheme</th>
                    <th>Academic Year</th>
                    <th>Sanctioned (INR)</th>
                    <th>Applied (INR)</th>
                    <th>Remaining (INR)</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {scholarships.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No scholarship records found.
                      </td>
                    </tr>
                  ) : (
                    scholarships.map((s) => (
                      <tr key={s.id}>
                        <td>
                          <strong>{s.student?.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.student?.jntuNo}</div>
                        </td>
                        <td>{s.scholarshipType?.name}</td>
                        <td>{s.academicYear?.code}</td>
                        <td>₹{Number(s.sanctionedAmount).toLocaleString('en-IN')}</td>
                        <td style={{ color: '#059669', fontWeight: 600 }}>
                          ₹{Number(s.appliedAmount).toLocaleString('en-IN')}
                        </td>
                        <td>₹{Number(s.remainingAmount).toLocaleString('en-IN')}</td>
                        <td>
                          <span
                            className={`fee-badge ${
                              s.status === 'APPLIED' || s.status === 'CLOSED'
                                ? 'badge-paid'
                                : s.status === 'APPROVED'
                                ? 'badge-partial'
                                : 'badge-unpaid'
                            }`}
                          >
                            {s.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            {s.status === 'ASSIGNED' && (
                              <button
                                type="button"
                                className="fee-btn-outline-blue"
                                onClick={() => handleApproveScholarship(s.id)}
                              >
                                Approve
                              </button>
                            )}
                            {s.status === 'APPROVED' && (
                              <button
                                type="button"
                                className="fee-btn-outline-emerald"
                                onClick={() => handleApplyScholarship(s.id)}
                              >
                                Apply to Fees
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
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 5: DETENTIONS (Academic Standing)                                */}
      {/* =================================================================== */}
      {activeTab === 'detentions' && (
        <>
          <div className="fee-toolbar-container">
            <div className="fee-search-input-wrapper">
              <Search size={16} className="fee-search-icon" />
              <input
                type="text"
                placeholder="Search detention by student name or roll number..."
                className="fee-search-input"
                value={detentionSearch}
                onChange={(e) => setDetentionSearch(e.target.value)}
              />
            </div>

            <select
              className="fee-select-filter"
              value={selectedYearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
            >
              <option value="ALL">All Academic Years</option>
              {academicYears.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.code}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="fee-btn-primary"
              onClick={() => {
                setDetentionForm({
                  studentId: '',
                  academicYearId: selectedYearId !== 'ALL' ? selectedYearId : academicYears[0]?.id || '',
                  currentYearOfStudy: '3rd Year',
                  detainedYearOfStudy: '2nd Year (Held Back)',
                  reason: '',
                  remarks: '',
                });
                setShowCreateDetentionModal(true);
              }}
            >
              <Plus size={16} />
              Register Detention
            </button>
          </div>

          <div className="fee-table-card">
            <div className="fee-table-responsive">
              <table className="fee-data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Academic Year</th>
                    <th>Current Year</th>
                    <th>Detained Standing</th>
                    <th>Reason Detail</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {detentions.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: '#64748b' }}>
                        No detention records found.
                      </td>
                    </tr>
                  ) : (
                    detentions.map((d) => (
                      <tr key={d.id}>
                        <td>
                          <strong>{d.student?.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{d.student?.jntuNo}</div>
                        </td>
                        <td>{d.academicYear?.code}</td>
                        <td>{d.currentYearOfStudy}</td>
                        <td>
                          <span style={{ color: '#e11d48', fontWeight: 600 }}>{d.detainedYearOfStudy}</span>
                        </td>
                        <td>{d.reason}</td>
                        <td>
                          <span className={`fee-badge ${d.status === 'ACTIVE' ? 'badge-unpaid' : 'badge-inactive'}`}>
                            {d.status}
                          </span>
                        </td>
                        <td>{new Date(d.detainedAt).toLocaleDateString('en-IN')}</td>
                        <td>
                          {d.status === 'ACTIVE' && (
                            <button
                              type="button"
                              className="fee-btn-secondary"
                              onClick={() => handleRevokeDetention(d.id)}
                            >
                              Revoke
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 6: INSTITUTION SETTINGS                                         */}
      {/* =================================================================== */}
      {activeTab === 'settings' && institutionSettings && (
        <div style={{ maxWidth: '700px', background: '#ffffff', padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 1rem 0', color: '#0f172a' }}>
            Institutional Configuration
          </h3>

          <form onSubmit={handleSaveSettings}>
            <div className="fee-form-group">
              <label>Institution Operating Mode</label>
              <select
                className="fee-form-select"
                value={institutionSettings.institutionMode}
                onChange={(e) =>
                  setInstitutionSettings({
                    ...institutionSettings,
                    institutionMode: e.target.value as any,
                  })
                }
              >
                <option value="BOTH">Both (Unified Hostel & College)</option>
                <option value="HOSTEL_ONLY">Hostel Only</option>
                <option value="COLLEGE_ONLY">College Only</option>
              </select>
            </div>

            <div className="fee-form-row">
              <div className="fee-form-group" style={{ flex: 2 }}>
                <label>Institution Name</label>
                <input
                  type="text"
                  className="fee-form-input"
                  value={institutionSettings.institutionName}
                  onChange={(e) =>
                    setInstitutionSettings({
                      ...institutionSettings,
                      institutionName: e.target.value,
                    })
                  }
                />
              </div>
              <div className="fee-form-group" style={{ flex: 1 }}>
                <label>Institution Code</label>
                <input
                  type="text"
                  className="fee-form-input"
                  value={institutionSettings.institutionCode}
                  onChange={(e) =>
                    setInstitutionSettings({
                      ...institutionSettings,
                      institutionCode: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            <div style={{ margin: '1.25rem 0', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
              <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 0.75rem 0', color: '#1e293b' }}>
                Operational Modules
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={institutionSettings.enableScholarships}
                    onChange={(e) =>
                      setInstitutionSettings({
                        ...institutionSettings,
                        enableScholarships: e.target.checked,
                      })
                    }
                  />
                  <span>Enable Scholarship Management & Fee Concessions</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={institutionSettings.enableDetentions}
                    onChange={(e) =>
                      setInstitutionSettings({
                        ...institutionSettings,
                        enableDetentions: e.target.checked,
                      })
                    }
                  />
                  <span>Enable Student Academic Detentions & Standing Tracking</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={institutionSettings.enableBulkUploads}
                    onChange={(e) =>
                      setInstitutionSettings({
                        ...institutionSettings,
                        enableBulkUploads: e.target.checked,
                      })
                    }
                  />
                  <span>Enable Bulk Excel Imports & Automated Fee Adjustments</span>
                </label>
              </div>
            </div>

            <button type="submit" className="fee-btn-primary" style={{ marginTop: '0.5rem' }}>
              Save Configuration
            </button>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT FEE STRUCTURE                                     */}
      {/* =================================================================== */}
      {showAddStructureModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowAddStructureModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>{editingStructure ? 'Edit Fee Structure' : 'Add Fee Structure'}</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowAddStructureModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveStructure}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Academic Year</label>
                  <select
                    className="fee-form-select"
                    value={structureForm.academicYearId}
                    onChange={(e) => setStructureForm({ ...structureForm, academicYearId: e.target.value })}
                    required
                  >
                    {academicYears.map((y) => (
                      <option key={y.id} value={y.id}>
                        {y.code} ({y.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Module</label>
                    <select
                      className="fee-form-select"
                      value={structureForm.module}
                      onChange={(e) => setStructureForm({ ...structureForm, module: e.target.value })}
                    >
                      <option value="HOSTEL">Hostel</option>
                      <option value="COLLEGE">College</option>
                    </select>
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Category</label>
                    <select
                      className="fee-form-select"
                      value={structureForm.category}
                      onChange={(e) => setStructureForm({ ...structureForm, category: e.target.value })}
                    >
                      <option value="REGULAR">Regular</option>
                      <option value="MANAGEMENT">Management</option>
                      <option value="CONVENOR">Convenor</option>
                      <option value="INTERNATIONAL">International</option>
                    </select>
                  </div>
                </div>

                <div className="fee-form-group">
                  <label>Fee Kind</label>
                  <select
                    className="fee-form-select"
                    value={structureForm.feeKind}
                    onChange={(e) => setStructureForm({ ...structureForm, feeKind: e.target.value })}
                  >
                    {structureForm.module === 'HOSTEL' ? (
                      <>
                        <option value="MESS_FEE">Mess Fee</option>
                        <option value="ROOM_RENT">Room Rent</option>
                        <option value="AMENITIES">Amenities Fee</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="CAUTION_DEPOSIT">Caution Deposit</option>
                      </>
                    ) : (
                      <>
                        <option value="TUITION">Tuition Fee</option>
                        <option value="ADMISSION">Admission Fee</option>
                        <option value="SPECIAL">Special Fee</option>
                        <option value="PENDING_DUES_REJOIN">Pending Dues / Rejoin</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="fee-form-group">
                  <label>Structure Display Name</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. Annual Hostel Mess & Dining Charges"
                    value={structureForm.name}
                    onChange={(e) => setStructureForm({ ...structureForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="fee-form-input"
                    placeholder="e.g. 45000"
                    value={structureForm.amount}
                    onChange={(e) => setStructureForm({ ...structureForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowAddStructureModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  {editingStructure ? 'Update Structure' : 'Create Structure'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD / EDIT BANK ACCOUNT                                      */}
      {/* =================================================================== */}
      {showAddAccountModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowAddAccountModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>{editingAccount ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowAddAccountModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveAccount}>
              <div className="fee-modal-body">
                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Account Identifier</label>
                    <input
                      type="text"
                      className="fee-form-input"
                      placeholder="e.g. HOSTEL-001 or TUITION-001"
                      value={accountForm.accountIdentifier}
                      onChange={(e) =>
                        setAccountForm({ ...accountForm, accountIdentifier: e.target.value.toUpperCase() })
                      }
                      disabled={!!editingAccount}
                      required
                    />
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Module Scope</label>
                    <select
                      className="fee-form-select"
                      value={accountForm.module}
                      onChange={(e) => setAccountForm({ ...accountForm, module: e.target.value })}
                    >
                      <option value="BOTH">Both (Hostel & College)</option>
                      <option value="HOSTEL">Hostel Only</option>
                      <option value="COLLEGE">College Only</option>
                    </select>
                  </div>
                </div>

                <div className="fee-form-group">
                  <label>Account Display Name</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. Hostel Maintenance & Mess Account"
                    value={accountForm.name}
                    onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Bank Name</label>
                    <input
                      type="text"
                      className="fee-form-input"
                      placeholder="e.g. State Bank of India"
                      value={accountForm.bankName}
                      onChange={(e) => setAccountForm({ ...accountForm, bankName: e.target.value })}
                      required
                    />
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Account Number</label>
                    <input
                      type="text"
                      className="fee-form-input"
                      placeholder="e.g. 38291048291"
                      value={accountForm.accountNumber}
                      onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>IFSC Code</label>
                    <input
                      type="text"
                      className="fee-form-input"
                      placeholder="e.g. SBIN0004521"
                      value={accountForm.ifsc}
                      onChange={(e) => setAccountForm({ ...accountForm, ifsc: e.target.value.toUpperCase() })}
                      required
                    />
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Account Kind</label>
                    <select
                      className="fee-form-select"
                      value={accountForm.kind}
                      onChange={(e) => setAccountForm({ ...accountForm, kind: e.target.value })}
                    >
                      <option value="MESS">Mess Account</option>
                      <option value="DEPOSIT">Caution Deposit</option>
                      <option value="TUITION">Tuition Fee</option>
                      <option value="SPECIAL">Special Fee</option>
                      <option value="HOSTEL">Hostel Operations</option>
                      <option value="GENERAL">General</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowAddAccountModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  {editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ADD ACADEMIC YEAR                                            */}
      {/* =================================================================== */}
      {showAddYearModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowAddYearModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Add Academic Year</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowAddYearModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveYear}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Academic Year Code</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. 2027-2028"
                    value={yearForm.code}
                    onChange={(e) => setYearForm({ ...yearForm, code: e.target.value.toUpperCase() })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Full Display Name</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. Academic Year 2027-2028"
                    value={yearForm.name}
                    onChange={(e) => setYearForm({ ...yearForm, name: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Start Date</label>
                    <input
                      type="date"
                      className="fee-form-input"
                      value={yearForm.startDate}
                      onChange={(e) => setYearForm({ ...yearForm, startDate: e.target.value })}
                      required
                    />
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>End Date</label>
                    <input
                      type="date"
                      className="fee-form-input"
                      value={yearForm.endDate}
                      onChange={(e) => setYearForm({ ...yearForm, endDate: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="fee-form-group" style={{ marginTop: '0.75rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={yearForm.isCurrent}
                      onChange={(e) => setYearForm({ ...yearForm, isCurrent: e.target.checked })}
                    />
                    <span>Designate as Current Active Academic Year</span>
                  </label>
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowAddYearModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Save Academic Year
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: ASSIGN SCHOLARSHIP                                           */}
      {/* =================================================================== */}
      {showAssignScholarshipModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowAssignScholarshipModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Assign Student Scholarship</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowAssignScholarshipModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignScholarship}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Student ID / JNTU Number</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="Enter Student UUID or JNTU No."
                    value={scholarshipForm.studentId}
                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, studentId: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Scholarship Scheme</label>
                  <select
                    className="fee-form-select"
                    value={scholarshipForm.scholarshipTypeId}
                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, scholarshipTypeId: e.target.value })}
                    required
                  >
                    {scholarshipTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="fee-form-group">
                  <label>Sanctioned Amount (INR)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    className="fee-form-input"
                    placeholder="e.g. 50000"
                    value={scholarshipForm.sanctionedAmount}
                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, sanctionedAmount: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Reference / Sanction Number</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. JVD-2026-89210"
                    value={scholarshipForm.referenceNumber}
                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, referenceNumber: e.target.value })}
                  />
                </div>

                <div className="fee-form-group">
                  <label>Remarks</label>
                  <textarea
                    className="fee-form-textarea"
                    rows={2}
                    placeholder="Optional administrative notes"
                    value={scholarshipForm.remarks}
                    onChange={(e) => setScholarshipForm({ ...scholarshipForm, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowAssignScholarshipModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Assign Scholarship
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL: REGISTER DETENTION (Academic Standing)                        */}
      {/* =================================================================== */}
      {showCreateDetentionModal && (
        <div className="fee-modal-backdrop" onClick={() => setShowCreateDetentionModal(false)}>
          <div className="fee-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="fee-modal-header">
              <h3>Register Academic Detention</h3>
              <button
                type="button"
                className="fee-modal-close-btn"
                onClick={() => setShowCreateDetentionModal(false)}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateDetention}>
              <div className="fee-modal-body">
                <div className="fee-form-group">
                  <label>Student ID / JNTU Number</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="Enter Student UUID or JNTU No."
                    value={detentionForm.studentId}
                    onChange={(e) => setDetentionForm({ ...detentionForm, studentId: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-row">
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Current Year of Study</label>
                    <select
                      className="fee-form-select"
                      value={detentionForm.currentYearOfStudy}
                      onChange={(e) => setDetentionForm({ ...detentionForm, currentYearOfStudy: e.target.value })}
                    >
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                  <div className="fee-form-group" style={{ flex: 1 }}>
                    <label>Detained Year of Study</label>
                    <select
                      className="fee-form-select"
                      value={detentionForm.detainedYearOfStudy}
                      onChange={(e) => setDetentionForm({ ...detentionForm, detainedYearOfStudy: e.target.value })}
                    >
                      <option value="Same Year (Repeat)">Same Year (Repeat)</option>
                      <option value="1st Year (Held Back)">1st Year (Held Back)</option>
                      <option value="2nd Year (Held Back)">2nd Year (Held Back)</option>
                      <option value="3rd Year (Held Back)">3rd Year (Held Back)</option>
                    </select>
                  </div>
                </div>

                <div className="fee-form-group">
                  <label>Reason Detail (Academic Standing Only)</label>
                  <textarea
                    className="fee-form-textarea"
                    rows={3}
                    placeholder="e.g. Attendance below mandatory minimum 65% in Semester 5"
                    value={detentionForm.reason}
                    onChange={(e) => setDetentionForm({ ...detentionForm, reason: e.target.value })}
                    required
                  />
                </div>

                <div className="fee-form-group">
                  <label>Remarks / Council Order</label>
                  <input
                    type="text"
                    className="fee-form-input"
                    placeholder="e.g. Academic Council Minute Ref #2026/08"
                    value={detentionForm.remarks}
                    onChange={(e) => setDetentionForm({ ...detentionForm, remarks: e.target.value })}
                  />
                </div>
              </div>

              <div className="fee-modal-footer">
                <button
                  type="button"
                  className="fee-btn-secondary"
                  onClick={() => setShowCreateDetentionModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="fee-btn-primary">
                  Record Detention
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
