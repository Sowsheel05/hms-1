import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  UtensilsCrossed,
  Search,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Radio,
  X,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2,
  Filter,
  Download,
  FileText,
  Fingerprint,
  Users,
  FileSpreadsheet,
  Check,
  Slash,
  RefreshCw,
} from 'lucide-react';
import {
  managementApiService,
  Block,
  ConfiguredMeal,
  MessAnalyticsData,
  IndentPlanData,
  MessAttendanceData,
  AttendanceRecordItem,
  IndentStudentRecord,
  AttendanceMarkingStudent,
  AttendanceMarkingResponse,
  MessReportSummary,
  MessReportItem,
} from '../services/api';

interface MessManagementPageProps {
  onNavigate?: (path: string) => void;
}

type MessTab = 'attendance-marking' | 'reports' | 'indent' | 'attendance' | 'analytics' | 'configuration';

export const MessManagementPage: React.FC<MessManagementPageProps> = () => {
  // Navigation Tabs: 'attendance-marking' | 'reports' | 'indent' | 'attendance' | 'analytics' | 'configuration'
  const [activeTab, setActiveTab] = useState<MessTab>('attendance-marking');

  // Date selection (defaults to today's local YYYY-MM-DD)
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Common State
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isLiveConnected, setIsLiveConnected] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // =========================================================================
  // TAB 1: CONFIGURATION STATE & HANDLERS
  // =========================================================================
  const [meals, setMeals] = useState<ConfiguredMeal[]>([]);
  const [isMealsLoading, setIsMealsLoading] = useState<boolean>(true);
  const [isMealModalOpen, setIsMealModalOpen] = useState<boolean>(false);
  const [editingMeal, setEditingMeal] = useState<ConfiguredMeal | null>(null);

  // Add/Edit Meal Form Fields
  const [mealFormName, setMealFormName] = useState<string>('');
  const [mealFormStartTime, setMealFormStartTime] = useState<string>('');
  const [mealFormEndTime, setMealFormEndTime] = useState<string>('');
  const [mealFormActive, setMealFormActive] = useState<boolean>(true);
  const [mealFormError, setMealFormError] = useState<string | null>(null);
  const [isMealSubmitting, setIsMealSubmitting] = useState<boolean>(false);

  // Delete Meal State
  const [mealToDelete, setMealToDelete] = useState<ConfiguredMeal | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [isDeleteSubmitting, setIsDeleteSubmitting] = useState<boolean>(false);

  const fetchMeals = useCallback(async (isBg = false) => {
    if (!isBg) setIsMealsLoading(true);
    try {
      const res = await managementApiService.getMeals();
      if (res.success) {
        setMeals(res.meals || []);
      }
    } catch (err: any) {
      console.error('Failed to load meal configs:', err);
      showToast(err.message || 'Unable to load meal configurations.', 'error');
    } finally {
      setIsMealsLoading(false);
    }
  }, []);

  const handleOpenAddMeal = () => {
    setEditingMeal(null);
    setMealFormName('');
    setMealFormStartTime('07:30 AM');
    setMealFormEndTime('09:30 AM');
    setMealFormActive(true);
    setMealFormError(null);
    setIsMealModalOpen(true);
  };

  const handleOpenEditMeal = (meal: ConfiguredMeal) => {
    setEditingMeal(meal);
    setMealFormName(meal.name);
    setMealFormStartTime(meal.startTime);
    setMealFormEndTime(meal.endTime);
    setMealFormActive(meal.isActive);
    setMealFormError(null);
    setIsMealModalOpen(true);
  };

  const handleSaveMeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setMealFormError(null);

    if (!mealFormName.trim()) {
      setMealFormError('Meal name is required.');
      return;
    }
    if (!mealFormStartTime.trim()) {
      setMealFormError('Start time is required.');
      return;
    }
    if (!mealFormEndTime.trim()) {
      setMealFormError('End time is required.');
      return;
    }

    setIsMealSubmitting(true);
    try {
      if (editingMeal) {
        const res = await managementApiService.updateMeal(editingMeal.id, {
          name: mealFormName.trim(),
          startTime: mealFormStartTime.trim(),
          endTime: mealFormEndTime.trim(),
          isActive: mealFormActive,
        });
        if (res.success) {
          showToast(res.message || 'Meal updated successfully.');
          setIsMealModalOpen(false);
          fetchMeals(true);
        }
      } else {
        const res = await managementApiService.createMeal({
          name: mealFormName.trim(),
          startTime: mealFormStartTime.trim(),
          endTime: mealFormEndTime.trim(),
          isActive: mealFormActive,
        });
        if (res.success) {
          showToast(res.message || 'Meal created successfully.');
          setIsMealModalOpen(false);
          fetchMeals(true);
        }
      }
    } catch (err: any) {
      setMealFormError(err.message || 'Failed to save meal configuration.');
    } finally {
      setIsMealSubmitting(false);
    }
  };

  const handleOpenDeleteMeal = (meal: ConfiguredMeal) => {
    setMealToDelete(meal);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDeleteMeal = async () => {
    if (!mealToDelete) return;
    setIsDeleteSubmitting(true);
    try {
      const res = await managementApiService.deleteMeal(mealToDelete.id);
      if (res.success) {
        showToast(res.message || 'Meal deleted successfully.');
        setIsDeleteModalOpen(false);
        setMealToDelete(null);
        fetchMeals(true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to delete meal.', 'error');
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleteSubmitting(false);
    }
  };

  // =========================================================================
  // TAB 2: ANALYTICS STATE & HANDLERS
  // =========================================================================
  const [analyticsData, setAnalyticsData] = useState<MessAnalyticsData | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState<boolean>(false);

  const fetchAnalytics = useCallback(async (isBg = false) => {
    if (!isBg) setIsAnalyticsLoading(true);
    try {
      const res = await managementApiService.getMessAnalytics(selectedDate);
      if (res.success) {
        setAnalyticsData(res);
      }
    } catch (err: any) {
      console.error('Failed to load mess analytics:', err);
      showToast(err.message || 'Failed to load mess analytics.', 'error');
    } finally {
      setIsAnalyticsLoading(false);
    }
  }, [selectedDate]);

  // =========================================================================
  // TAB 3: INDENT PLAN STATE & HANDLERS
  // =========================================================================
  const [indentData, setIndentData] = useState<IndentPlanData | null>(null);
  const [isIndentLoading, setIsIndentLoading] = useState<boolean>(false);
  const [indentSearch, setIndentSearch] = useState<string>('');
  const [isIndentFilterModalOpen, setIsIndentFilterModalOpen] = useState<boolean>(false);

  // Filter values
  const [indentFilterDate, setIndentFilterDate] = useState<string>(todayStr);
  const [indentFilterBlock, setIndentFilterBlock] = useState<string>('ALL');
  const [indentFilterYear, setIndentFilterYear] = useState<string>('ALL');
  const [indentFilterDept, setIndentFilterDept] = useState<string>('ALL');

  // Applied filter state
  const [appliedIndentFilters, setAppliedIndentFilters] = useState({
    date: todayStr,
    block: 'ALL',
    year: 'ALL',
    department: 'ALL',
  });

  const fetchIndentPlan = useCallback(async (isBg = false) => {
    if (!isBg) setIsIndentLoading(true);
    try {
      const res = await managementApiService.getIndentPlan({
        date: appliedIndentFilters.date,
        block: appliedIndentFilters.block,
        year: appliedIndentFilters.year,
        department: appliedIndentFilters.department,
        search: indentSearch.trim() || undefined,
      });
      if (res.success) {
        setIndentData(res);
      }
    } catch (err: any) {
      console.error('Failed to load indent plan:', err);
      showToast(err.message || 'Failed to load indent plan.', 'error');
    } finally {
      setIsIndentLoading(false);
    }
  }, [appliedIndentFilters, indentSearch]);

  const handleApplyIndentFilters = () => {
    setAppliedIndentFilters({
      date: indentFilterDate,
      block: indentFilterBlock,
      year: indentFilterYear,
      department: indentFilterDept,
    });
    setIsIndentFilterModalOpen(false);
  };

  const handleResetIndentFilters = () => {
    setIndentFilterDate(todayStr);
    setIndentFilterBlock('ALL');
    setIndentFilterYear('ALL');
    setIndentFilterDept('ALL');
    setAppliedIndentFilters({
      date: todayStr,
      block: 'ALL',
      year: 'ALL',
      department: 'ALL',
    });
    setIsIndentFilterModalOpen(false);
  };

  // =========================================================================
  // TAB 4: ATTENDANCE STATE & HANDLERS
  // =========================================================================
  const [attendanceData, setAttendanceData] = useState<MessAttendanceData | null>(null);
  const [isAttendanceLoading, setIsAttendanceLoading] = useState<boolean>(false);
  const [attendanceSearch, setAttendanceSearch] = useState<string>('');
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [isAttendanceFilterModalOpen, setIsAttendanceFilterModalOpen] = useState<boolean>(false);

  // Filter values
  const [attFilterDate, setAttFilterDate] = useState<string>(todayStr);
  const [attFilterMeal, setAttFilterMeal] = useState<string>('ALL');
  const [attFilterStatus, setAttFilterStatus] = useState<string>('ALL');
  const [attFilterBlock, setAttFilterBlock] = useState<string>('ALL');
  const [attFilterGender, setAttFilterGender] = useState<string>('ALL');

  // Applied attendance filters
  const [appliedAttFilters, setAppliedAttFilters] = useState({
    date: todayStr,
    mealType: 'ALL',
    status: 'ALL',
    block: 'ALL',
    gender: 'ALL',
  });

  const fetchAttendance = useCallback(async (page = attendancePage, isBg = false) => {
    if (!isBg) setIsAttendanceLoading(true);
    try {
      const res = await managementApiService.getMessAttendance({
        date: appliedAttFilters.date,
        mealType: appliedAttFilters.mealType,
        status: appliedAttFilters.status,
        block: appliedAttFilters.block,
        gender: appliedAttFilters.gender,
        search: attendanceSearch.trim() || undefined,
        page,
        limit: 10,
      });
      if (res.success) {
        setAttendanceData(res);
        setAttendancePage(res.page);
      }
    } catch (err: any) {
      console.error('Failed to load mess attendance:', err);
      showToast(err.message || 'Failed to load mess attendance logs.', 'error');
    } finally {
      setIsAttendanceLoading(false);
    }
  }, [appliedAttFilters, attendanceSearch, attendancePage]);

  const handleApplyAttendanceFilters = () => {
    setAppliedAttFilters({
      date: attFilterDate,
      mealType: attFilterMeal,
      status: attFilterStatus,
      block: attFilterBlock,
      gender: attFilterGender,
    });
    setAttendancePage(1);
    setIsAttendanceFilterModalOpen(false);
  };

  const handleResetAttendanceFilters = () => {
    setAttFilterDate(todayStr);
    setAttFilterMeal('ALL');
    setAttFilterStatus('ALL');
    setAttFilterBlock('ALL');
    setAttFilterGender('ALL');
    setAppliedAttFilters({
      date: todayStr,
      mealType: 'ALL',
      status: 'ALL',
      block: 'ALL',
      gender: 'ALL',
    });
    setAttendancePage(1);
    setIsAttendanceFilterModalOpen(false);
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      showToast('Generating attendance CSV export...');
      const blob = await managementApiService.exportMessAttendanceCsv({
        date: appliedAttFilters.date,
        mealType: appliedAttFilters.mealType,
        status: appliedAttFilters.status,
        block: appliedAttFilters.block,
        gender: appliedAttFilters.gender,
        search: attendanceSearch.trim() || undefined,
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mess-attendance-${appliedAttFilters.date}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('CSV export downloaded successfully.');
    } catch (err: any) {
      showToast(err.message || 'Failed to export CSV.', 'error');
    }
  };

  // PDF Export
  const handleExportPdf = () => {
    window.print();
  };

  // =========================================================================
  // TAB: MESS ATTENDANCE MARKING (Phase 3 & 4)
  // =========================================================================
  const [markingDate, setMarkingDate] = useState<string>(todayStr);
  const [markingMeal, setMarkingMeal] = useState<string>('LUNCH');
  const [markingBlock, setMarkingBlock] = useState<string>('ALL');
  const [markingSearch, setMarkingSearch] = useState<string>('');
  const [markingPage, setMarkingPage] = useState<number>(1);
  const [markingData, setMarkingData] = useState<AttendanceMarkingResponse | null>(null);
  const [isMarkingLoading, setIsMarkingLoading] = useState<boolean>(false);
  const [markingStudentAction, setMarkingStudentAction] = useState<string | null>(null);

  // Attendance Correction Modal State
  const [correctionTarget, setCorrectionTarget] = useState<AttendanceMarkingStudent | null>(null);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState<boolean>(false);
  const [isCorrectionSubmitting, setIsCorrectionSubmitting] = useState<boolean>(false);

  const fetchAttendanceMarking = useCallback(async (page = markingPage, isBg = false) => {
    if (!isBg) setIsMarkingLoading(true);
    try {
      const res = await managementApiService.getAttendanceMarking({
        date: markingDate,
        mealType: markingMeal,
        block: markingBlock,
        search: markingSearch.trim() || undefined,
        page,
        limit: 15,
      });
      if (res.success) {
        setMarkingData(res);
        setMarkingPage(res.pagination.page);
      }
    } catch (err: any) {
      console.error('Failed to load attendance marking:', err);
      showToast(err.message || 'Failed to load eligible students list.', 'error');
    } finally {
      setIsMarkingLoading(false);
    }
  }, [markingDate, markingMeal, markingBlock, markingSearch, markingPage]);

  // Quick Inline Action: Mark Attendance (ATE or DID_NOT_EAT)
  const handleQuickMarkAttendance = async (student: AttendanceMarkingStudent, status: 'ATE' | 'DID_NOT_EAT') => {
    setMarkingStudentAction(student.studentId);
    try {
      const res = await managementApiService.markAttendance({
        studentId: student.studentId,
        date: markingDate,
        mealType: markingMeal,
        status,
      });
      if (res.success) {
        showToast(`Marked ${student.studentName} as ${status === 'ATE' ? 'ATE (Consumed)' : 'DID NOT EAT'}`);
        await fetchAttendanceMarking(markingPage, true);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update attendance.', 'error');
    } finally {
      setMarkingStudentAction(null);
    }
  };

  const handleOpenCorrection = (student: AttendanceMarkingStudent) => {
    setCorrectionTarget(student);
    setIsCorrectionModalOpen(true);
  };

  const handleSaveCorrection = async (newStatus: 'ATE' | 'DID_NOT_EAT' | 'PENDING') => {
    if (!correctionTarget) return;
    setIsCorrectionSubmitting(true);
    try {
      if (correctionTarget.attendanceId) {
        const res = await managementApiService.correctAttendance(correctionTarget.attendanceId, newStatus);
        if (res.success) {
          showToast(`Attendance updated to ${newStatus}`);
        }
      } else {
        if (newStatus === 'PENDING') {
          showToast('Attendance is already pending.');
        } else {
          const res = await managementApiService.markAttendance({
            studentId: correctionTarget.studentId,
            date: markingDate,
            mealType: markingMeal,
            status: newStatus,
          });
          if (res.success) {
            showToast(`Attendance marked as ${newStatus}`);
          }
        }
      }
      setIsCorrectionModalOpen(false);
      setCorrectionTarget(null);
      await fetchAttendanceMarking(markingPage, true);
    } catch (err: any) {
      showToast(err.message || 'Failed to correct attendance.', 'error');
    } finally {
      setIsCorrectionSubmitting(false);
    }
  };

  // =========================================================================
  // TAB: FOUR-WAY RECONCILIATION REPORTS & EXPORT (Phase 6 to 12)
  // =========================================================================
  const [reportDate, setReportDate] = useState<string>(todayStr);
  const [reportMeal, setReportMeal] = useState<string>('LUNCH');
  const [reportBlock, setReportBlock] = useState<string>('ALL');
  const [reportSearch, setReportSearch] = useState<string>('');
  const [reportCategory, setReportCategory] = useState<'INDENTED_ATE' | 'NO_INDENT_ATE' | 'INDENTED_NOT_ATE' | 'NO_INDENT_NOT_ATE' | 'PENDING' | 'ALL'>('INDENTED_ATE');
  const [reportPage, setReportPage] = useState<number>(1);

  const [reportsSummary, setReportsSummary] = useState<MessReportSummary | null>(null);
  const [reportsData, setReportsData] = useState<MessReportItem[]>([]);
  const [reportsPagination, setReportsPagination] = useState<{ total: number; page: number; limit: number; totalPages: number }>({
    total: 0,
    page: 1,
    limit: 15,
    totalPages: 1,
  });
  const [isReportsLoading, setIsReportsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const fetchReportsSummary = useCallback(async (_isBg = false) => {
    try {
      const res = await managementApiService.getMessReportsSummary({
        date: reportDate,
        mealType: reportMeal,
        block: reportBlock,
        search: reportSearch.trim() || undefined,
      });
      if (res.success) {
        setReportsSummary(res.summary);
      }
    } catch (err: any) {
      console.error('Failed to load reports summary:', err);
    }
  }, [reportDate, reportMeal, reportBlock, reportSearch]);

  const fetchReportsData = useCallback(async (page = reportPage, isBg = false) => {
    if (!isBg) setIsReportsLoading(true);
    try {
      const res = await managementApiService.getMessReportsData({
        category: reportCategory === 'ALL' ? undefined : reportCategory,
        date: reportDate,
        mealType: reportMeal,
        block: reportBlock,
        search: reportSearch.trim() || undefined,
        page,
        limit: 15,
      });
      if (res.success) {
        setReportsData(res.records);
        setReportsPagination(res.pagination);
        setReportPage(res.pagination.page);
      }
    } catch (err: any) {
      console.error('Failed to load reports data:', err);
      showToast(err.message || 'Failed to load report dataset.', 'error');
    } finally {
      setIsReportsLoading(false);
    }
  }, [reportCategory, reportDate, reportMeal, reportBlock, reportSearch, reportPage]);

  const handleExportReconciliationReport = async (format: 'xlsx' | 'csv') => {
    setIsExporting(true);
    try {
      const categorySlug = reportCategory.toLowerCase();
      const blob = await managementApiService.exportMessReport({
        category: reportCategory,
        date: reportDate,
        mealType: reportMeal,
        format,
        block: reportBlock,
        search: reportSearch.trim() || undefined,
      });

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanMeal = reportMeal.toLowerCase();
      link.setAttribute('download', `mess_${categorySlug}_${reportDate}_${cleanMeal}.${format}`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`Exported ${format.toUpperCase()} report successfully.`);
    } catch (err: any) {
      console.error('Export failed:', err);
      showToast(err.message || 'Failed to export report.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  // =========================================================================
  // INITIAL DATA LOADING & SSE
  // =========================================================================
  useEffect(() => {
    managementApiService.getBlocks().then((res) => {
      if (res.blocks) setBlocks(res.blocks);
    }).catch((e) => console.warn('Failed to load blocks:', e));
  }, []);

  useEffect(() => {
    if (activeTab === 'attendance-marking') {
      fetchAttendanceMarking(1);
    } else if (activeTab === 'reports') {
      fetchReportsSummary();
      fetchReportsData(1);
    } else if (activeTab === 'configuration') {
      fetchMeals();
    } else if (activeTab === 'analytics') {
      fetchAnalytics();
    } else if (activeTab === 'indent') {
      fetchIndentPlan();
    } else if (activeTab === 'attendance') {
      fetchAttendance(1);
    }
  }, [activeTab, fetchAttendanceMarking, fetchReportsSummary, fetchReportsData, fetchMeals, fetchAnalytics, fetchIndentPlan, fetchAttendance]);

  useEffect(() => {
    if (activeTab === 'attendance-marking') {
      fetchAttendanceMarking(1);
    }
  }, [activeTab, markingDate, markingMeal, markingBlock, markingSearch, fetchAttendanceMarking]);

  useEffect(() => {
    if (activeTab === 'reports') {
      fetchReportsSummary();
      fetchReportsData(1);
    }
  }, [activeTab, reportDate, reportMeal, reportBlock, reportSearch, reportCategory, fetchReportsSummary, fetchReportsData]);

  // Unified SSE Subscription
  useEffect(() => {
    const unsubscribe = managementApiService.subscribeToEvents(
      (event) => {
        if (
          event?.type === 'MEAL_CREATED' ||
          event?.type === 'MEAL_UPDATED' ||
          event?.type === 'MEAL_DELETED'
        ) {
          fetchMeals(true);
        }
        if (
          event?.type === 'MESS_TOKEN_BOOKED' ||
          event?.type === 'MESS_TOKEN_CONSUMED' ||
          event?.type === 'MESS_TOKEN_CANCELLED' ||
          event?.type === 'MESS_INDENT_UPDATED' ||
          event?.type === 'MESS_ATTENDANCE_UPDATED' ||
          event?.type === 'MESS_STATS_UPDATED'
        ) {
          if (activeTab === 'attendance-marking') fetchAttendanceMarking(markingPage, true);
          if (activeTab === 'reports') {
            fetchReportsSummary(true);
            fetchReportsData(reportPage, true);
          }
          if (activeTab === 'analytics') fetchAnalytics(true);
          if (activeTab === 'indent') fetchIndentPlan(true);
          if (activeTab === 'attendance') fetchAttendance(attendancePage, true);
        }
      },
      (connected) => {
        setIsLiveConnected(connected);
      }
    );

    return () => unsubscribe();
  }, [activeTab, fetchAttendanceMarking, fetchReportsSummary, fetchReportsData, fetchMeals, fetchAnalytics, fetchIndentPlan, fetchAttendance, attendancePage, markingPage, reportPage]);

  // Global manual refresh
  const handleGlobalRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === 'attendance-marking') await fetchAttendanceMarking(markingPage, true);
    else if (activeTab === 'reports') {
      await Promise.all([fetchReportsSummary(true), fetchReportsData(reportPage, true)]);
    }
    else if (activeTab === 'configuration') await fetchMeals(true);
    else if (activeTab === 'analytics') await fetchAnalytics(true);
    else if (activeTab === 'indent') await fetchIndentPlan(true);
    else if (activeTab === 'attendance') await fetchAttendance(attendancePage, true);
    setIsRefreshing(false);
    showToast('Data synchronized with PostgreSQL');
  };

  return (
    <div className="mess-management-container">
      {/* Toast Notification */}
      {toast && (
        <div className={`block-toast toast-${toast.type}`} role="status">
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="toast-icon" />
          ) : (
            <AlertTriangle size={16} className="toast-icon" />
          )}
          <span>{toast.message}</span>
          <button type="button" className="toast-close" onClick={() => setToast(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Page Header */}
      <header className="mess-header-section">
        <div className="mess-header-title-block">
          <h1 className="mess-main-title">Mess Management</h1>
          <p className="mess-sub-title">Configure meal times and view attendance analytics.</p>
        </div>

        {/* Live SSE & Sync */}
        <div className="mess-header-controls">
          <div className={`mess-live-badge ${isLiveConnected ? 'connected' : 'connecting'}`}>
            <Radio size={13} className={isLiveConnected ? 'spin-anim' : ''} />
            <span>{isLiveConnected ? 'Live Realtime' : 'Connecting...'}</span>
          </div>

          <button
            type="button"
            onClick={handleGlobalRefresh}
            className="btn-light-secondary"
            title="Authoritative refresh"
            disabled={isRefreshing}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem' }}
          >
            <RotateCw size={14} className={isRefreshing ? 'spin-anim' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="mess-nav-tabs" aria-label="Mess Management Tabs">
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'attendance-marking' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance-marking')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Users size={16} />
            Mess Attendance
          </span>
        </button>
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
          onClick={() => setActiveTab('reports')}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <FileSpreadsheet size={16} />
            Four-Way Reports
          </span>
        </button>
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'indent' ? 'active' : ''}`}
          onClick={() => setActiveTab('indent')}
        >
          Indent Plan
        </button>
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Biometric Scans
        </button>
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          Analytics
        </button>
        <button
          type="button"
          className={`mess-nav-tab-btn ${activeTab === 'configuration' ? 'active' : ''}`}
          onClick={() => setActiveTab('configuration')}
        >
          Meal Schedules
        </button>
      </nav>

      {/* =================================================================== */}
      {/* TAB: MESS ATTENDANCE MARKING (Phase 3 & 4)                         */}
      {/* =================================================================== */}
      {activeTab === 'attendance-marking' && (
        <section className="mess-tab-panel" aria-label="Mess Attendance Marking Panel">
          {/* Action Toolbar */}
          <div className="mess-action-toolbar">
            <div className="mess-filter-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={15} style={{ color: '#64748B' }} />
                <input
                  type="date"
                  value={markingDate}
                  onChange={(e) => {
                    setMarkingDate(e.target.value);
                    setMarkingPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Attendance Date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UtensilsCrossed size={15} style={{ color: '#64748B' }} />
                <select
                  value={markingMeal}
                  onChange={(e) => {
                    setMarkingMeal(e.target.value);
                    setMarkingPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Attendance Meal"
                >
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="SNACKS">Snacks</option>
                  <option value="DINNER">Dinner</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Filter size={15} style={{ color: '#64748B' }} />
                <select
                  value={markingBlock}
                  onChange={(e) => {
                    setMarkingBlock(e.target.value);
                    setMarkingPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Filter by Block"
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="search-field-wrap" style={{ minWidth: '240px' }}>
                <Search size={15} className="search-input-icon" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={markingSearch}
                  onChange={(e) => {
                    setMarkingSearch(e.target.value);
                    setMarkingPage(1);
                  }}
                  className="allocation-search-input"
                  aria-label="Search students by name or roll number"
                />
              </div>

              <button
                type="button"
                className="btn-light-secondary btn-sm"
                onClick={() => fetchAttendanceMarking(markingPage)}
                title="Refresh Attendance List"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <RefreshCw size={14} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Real-Time Attendance Marking Summary Ribbon */}
          {markingData?.summary && (
            <div className="marking-stats-ribbon">
              <div className="marking-stat-card">
                <span className="marking-stat-label">Total Eligible</span>
                <span className="marking-stat-value">{markingData.summary.totalStudents}</span>
              </div>
              <div className="marking-stat-card" style={{ borderLeft: '3px solid #10B981' }}>
                <span className="marking-stat-label">Indent Marked</span>
                <span className="marking-stat-value" style={{ color: '#059669' }}>
                  {markingData.summary.indentMarkedCount}
                </span>
              </div>
              <div className="marking-stat-card" style={{ borderLeft: '3px solid #94A3B8' }}>
                <span className="marking-stat-label">No Indent</span>
                <span className="marking-stat-value" style={{ color: '#64748B' }}>
                  {markingData.summary.noIndentCount}
                </span>
              </div>
              <div className="marking-stat-card" style={{ borderLeft: '3px solid #059669' }}>
                <span className="marking-stat-label">✓ Ate (Consumed)</span>
                <span className="marking-stat-value" style={{ color: '#059669' }}>
                  {markingData.summary.ateCount}
                </span>
              </div>
              <div className="marking-stat-card" style={{ borderLeft: '3px solid #EF4444' }}>
                <span className="marking-stat-label">✗ Did Not Eat</span>
                <span className="marking-stat-value" style={{ color: '#DC2626' }}>
                  {markingData.summary.didNotEatCount}
                </span>
              </div>
              <div className="marking-stat-card" style={{ borderLeft: '3px solid #F59E0B' }}>
                <span className="marking-stat-label">○ Pending</span>
                <span className="marking-stat-value" style={{ color: '#D97706' }}>
                  {markingData.summary.pendingCount}
                </span>
              </div>
            </div>
          )}

          {/* Student Table */}
          {isMarkingLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Loading eligible students for {markingMeal} ({markingDate})...</p>
            </div>
          ) : !markingData || markingData.students.length === 0 ? (
            <div className="allocation-empty-state">
              <Users size={40} style={{ color: '#94A3B8' }} />
              <h3 className="empty-state-title">No eligible students found</h3>
              <p className="empty-state-desc">Try changing your search query, block filter, or selected meal.</p>
            </div>
          ) : (
            <div className="mess-report-table-wrapper">
              <table className="mess-report-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Block / Room</th>
                    <th>Indent Status</th>
                    <th>Attendance Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {markingData.students.map((student) => {
                    const isBusy = markingStudentAction === student.studentId;
                    return (
                      <tr key={student.studentId}>
                        <td>
                          <span className="status-badge badge-neutral" style={{ fontWeight: 600 }}>
                            {student.rollNo}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600, color: '#0F172A' }}>{student.studentName}</span>
                            <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{student.email}</span>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                            {student.blockName || student.block} · Room {student.roomNumber || student.room}
                          </span>
                        </td>
                        <td>
                          {student.indentMarked ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span className="status-badge badge-verified" style={{ width: 'fit-content' }}>
                                ✓ Marked
                              </span>
                              {student.indentTime && (
                                <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                  {new Date(student.indentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="status-badge badge-neutral" style={{ width: 'fit-content' }}>
                              ✗ No Indent
                            </span>
                          )}
                        </td>
                        <td>
                          {student.attendanceStatus === 'ATE' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span className="status-badge badge-verified" style={{ width: 'fit-content' }}>
                                ✓ Ate
                              </span>
                              {student.attendanceTime && (
                                <span style={{ fontSize: '0.7rem', color: '#047857' }}>
                                  {new Date(student.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : student.attendanceStatus === 'DID_NOT_EAT' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span className="status-badge badge-denied" style={{ width: 'fit-content' }}>
                                ✗ Did Not Eat
                              </span>
                              {student.attendanceTime && (
                                <span style={{ fontSize: '0.7rem', color: '#B91C1C' }}>
                                  {new Date(student.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="status-badge badge-pending" style={{ width: 'fit-content' }}>
                              ○ Pending
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem' }}>
                            {student.attendanceStatus === 'PENDING' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn-mark-ate"
                                  disabled={isBusy}
                                  onClick={() => handleQuickMarkAttendance(student, 'ATE')}
                                  title="Mark student as Ate / Consumed"
                                >
                                  {isBusy ? <RotateCw size={12} className="spin-anim" /> : <Check size={13} />}
                                  <span>Ate</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn-mark-dne"
                                  disabled={isBusy}
                                  onClick={() => handleQuickMarkAttendance(student, 'DID_NOT_EAT')}
                                  title="Mark student as Did Not Eat"
                                >
                                  {isBusy ? <RotateCw size={12} className="spin-anim" /> : <Slash size={13} />}
                                  <span>Did Not Eat</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn-light-secondary btn-sm"
                                onClick={() => handleOpenCorrection(student)}
                                title="Change or correct attendance status"
                              >
                                <Edit2 size={12} />
                                <span>Correct</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {markingData.pagination.totalPages > 1 && (
                <div className="pagination-controls-bar" style={{ padding: '0.75rem 1rem' }}>
                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={markingPage <= 1}
                    onClick={() => {
                      const prev = Math.max(1, markingPage - 1);
                      setMarkingPage(prev);
                      fetchAttendanceMarking(prev);
                    }}
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  <span className="pagination-page-indicator">
                    Page {markingData.pagination.page} of {markingData.pagination.totalPages} ({markingData.pagination.total} students)
                  </span>

                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={markingPage >= markingData.pagination.totalPages}
                    onClick={() => {
                      const next = Math.min(markingData.pagination.totalPages, markingPage + 1);
                      setMarkingPage(next);
                      fetchAttendanceMarking(next);
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* =================================================================== */}
      {/* TAB: FOUR-WAY RECONCILIATION REPORTS (Phase 6 to 12)               */}
      {/* =================================================================== */}
      {activeTab === 'reports' && (
        <section className="mess-tab-panel" aria-label="Four-Way Reconciliation Reports Panel">
          {/* Top Filters & Export Bar */}
          <div className="mess-action-toolbar">
            <div className="mess-filter-group">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Calendar size={15} style={{ color: '#64748B' }} />
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => {
                    setReportDate(e.target.value);
                    setReportPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Report Date"
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <UtensilsCrossed size={15} style={{ color: '#64748B' }} />
                <select
                  value={reportMeal}
                  onChange={(e) => {
                    setReportMeal(e.target.value);
                    setReportPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Report Meal"
                >
                  <option value="ALL">All Meals</option>
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="SNACKS">Snacks</option>
                  <option value="DINNER">Dinner</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Filter size={15} style={{ color: '#64748B' }} />
                <select
                  value={reportBlock}
                  onChange={(e) => {
                    setReportBlock(e.target.value);
                    setReportPage(1);
                  }}
                  className="mess-input-control"
                  aria-label="Filter by Block"
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div className="search-field-wrap" style={{ minWidth: '220px' }}>
                <Search size={15} className="search-input-icon" />
                <input
                  type="text"
                  placeholder="Search student or roll no..."
                  value={reportSearch}
                  onChange={(e) => {
                    setReportSearch(e.target.value);
                    setReportPage(1);
                  }}
                  className="allocation-search-input"
                  aria-label="Search reconciled records"
                />
              </div>

              <div className="export-btn-group">
                <button
                  type="button"
                  className="btn-export-excel"
                  disabled={isExporting}
                  onClick={() => handleExportReconciliationReport('xlsx')}
                  title="Export filtered dataset to Excel (.xlsx)"
                >
                  <Download size={14} />
                  <span>Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  className="btn-export-csv"
                  disabled={isExporting}
                  onClick={() => handleExportReconciliationReport('csv')}
                  title="Export filtered dataset to CSV (.csv)"
                >
                  <Download size={14} />
                  <span>CSV (.csv)</span>
                </button>
                <button
                  type="button"
                  className="btn-light-secondary btn-sm"
                  onClick={handleExportPdf}
                  title="Print / Save PDF"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  <FileText size={14} />
                  <span>PDF</span>
                </button>
              </div>
            </div>
          </div>

          {/* Four-Way Summary Cards (Phase 9 & 10) */}
          {reportsSummary && (
            <>
              <div className="reports-kpi-grid">
                <div className="reports-kpi-card kpi-total">
                  <span className="reports-kpi-title">Total Students</span>
                  <span className="reports-kpi-count">{reportsSummary.totalStudents}</span>
                  <span className="reports-kpi-desc">Total cohort eligible</span>
                </div>

                <div className="reports-kpi-card kpi-indented-ate">
                  <span className="reports-kpi-title">Indented & Ate</span>
                  <span className="reports-kpi-count" style={{ color: '#059669' }}>
                    {reportsSummary.indentedAndAte}
                  </span>
                  <span className="reports-kpi-desc">Indented & Consumed</span>
                </div>

                <div className="reports-kpi-card kpi-no-indent-ate">
                  <span className="reports-kpi-title">No Indent & Ate</span>
                  <span className="reports-kpi-count" style={{ color: '#D97706' }}>
                    {reportsSummary.unindentedAndAte}
                  </span>
                  <span className="reports-kpi-desc">Unindented & Consumed</span>
                </div>

                <div className="reports-kpi-card kpi-indented-not-ate">
                  <span className="reports-kpi-title">Indented & Not Eat</span>
                  <span className="reports-kpi-count" style={{ color: '#DB2777' }}>
                    {reportsSummary.indentedAndNotConsumed}
                  </span>
                  <span className="reports-kpi-desc">Indented & Not Consumed (Wasted)</span>
                </div>

                <div className="reports-kpi-card kpi-no-indent-not-ate">
                  <span className="reports-kpi-title">No Indent & Not Eat</span>
                  <span className="reports-kpi-count" style={{ color: '#475569' }}>
                    {reportsSummary.unindentedAndNotConsumed}
                  </span>
                  <span className="reports-kpi-desc">Unindented & Not Consumed</span>
                </div>

                <div className="reports-kpi-card kpi-pending">
                  <span className="reports-kpi-title">Attendance Pending</span>
                  <span className="reports-kpi-count" style={{ color: '#7C3AED' }}>
                    {reportsSummary.attendancePending}
                  </span>
                  <span className="reports-kpi-desc">Excluded from 4-way reports</span>
                </div>
              </div>

              {/* Mathematical Integrity Banner */}
              <div className="reconciliation-integrity-banner">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <CheckCircle2 size={16} style={{ color: '#059669' }} />
                  <span>
                    <strong>Reconciliation Balance Check:</strong> {reportsSummary.totalStudents} Total ={' '}
                    {reportsSummary.indentedAndAte} (Indented & Ate) + {reportsSummary.unindentedAndAte} (No Indent & Ate) +{' '}
                    {reportsSummary.indentedAndNotConsumed} (Indented & Not Eat) +{' '}
                    {reportsSummary.unindentedAndNotConsumed} (No Indent & Not Eat) +{' '}
                    {reportsSummary.attendancePending} (Pending)
                  </span>
                </div>
                <span className={`status-badge ${reportsSummary.isFinalized ? 'badge-verified' : 'badge-pending'}`}>
                  {reportsSummary.isFinalized ? 'Finalized' : 'Attendance In Progress'}
                </span>
              </div>
            </>
          )}

          {/* Category Tabs (Phase 7 & 8) */}
          <div className="category-subnav-tabs">
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'INDENTED_ATE' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('INDENTED_ATE');
                setReportPage(1);
              }}
            >
              Report 1: Indented & Ate ({reportsSummary?.indentedAndAte ?? 0})
            </button>
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'NO_INDENT_ATE' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('NO_INDENT_ATE');
                setReportPage(1);
              }}
            >
              Report 2: No Indent & Ate ({reportsSummary?.unindentedAndAte ?? 0})
            </button>
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'INDENTED_NOT_ATE' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('INDENTED_NOT_ATE');
                setReportPage(1);
              }}
            >
              Report 3: Indented & Did Not Eat ({reportsSummary?.indentedAndNotConsumed ?? 0})
            </button>
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'NO_INDENT_NOT_ATE' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('NO_INDENT_NOT_ATE');
                setReportPage(1);
              }}
            >
              Report 4: No Indent & Did Not Eat ({reportsSummary?.unindentedAndNotConsumed ?? 0})
            </button>
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'PENDING' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('PENDING');
                setReportPage(1);
              }}
            >
              Pending Attendance ({reportsSummary?.attendancePending ?? 0})
            </button>
            <button
              type="button"
              className={`category-subnav-btn ${reportCategory === 'ALL' ? 'active' : ''}`}
              onClick={() => {
                setReportCategory('ALL');
                setReportPage(1);
              }}
            >
              All Finalized Records
            </button>
          </div>

          {/* Detailed Reports Data Table */}
          {isReportsLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Fetching reconciled dataset from PostgreSQL...</p>
            </div>
          ) : reportsData.length === 0 ? (
            <div className="allocation-empty-state">
              <FileSpreadsheet size={40} style={{ color: '#94A3B8' }} />
              <h3 className="empty-state-title">No records in this report category</h3>
              <p className="empty-state-desc">No students match the current category, meal, date, or search filter.</p>
            </div>
          ) : (
            <div className="mess-report-table-wrapper">
              <table className="mess-report-table">
                <thead>
                  <tr>
                    <th>Roll No</th>
                    <th>Student Name</th>
                    <th>Branch / Year</th>
                    <th>Block / Room</th>
                    <th>Meal</th>
                    <th>Indent Status</th>
                    <th>Attendance Status</th>
                    <th>Marked By</th>
                  </tr>
                </thead>
                <tbody>
                  {reportsData.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="status-badge badge-neutral" style={{ fontWeight: 600 }}>
                          {item.rollNo}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, color: '#0F172A' }}>{item.studentName}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748B' }}>{item.email}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                          {item.branch} · {item.year} {item.section ? `(${item.section})` : ''}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.825rem', color: '#334155' }}>
                          {item.block} · Room {item.room}
                        </span>
                      </td>
                      <td>
                        <span className="status-badge badge-neutral" style={{ textTransform: 'capitalize' }}>
                          {item.meal}
                        </span>
                      </td>
                      <td>
                        {item.indentMarked ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span className="status-badge badge-verified" style={{ width: 'fit-content' }}>
                              ✓ Marked
                            </span>
                            {item.indentTime && (
                              <span style={{ fontSize: '0.7rem', color: '#64748B' }}>
                                {new Date(item.indentTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="status-badge badge-neutral" style={{ width: 'fit-content' }}>
                            ✗ No Indent
                          </span>
                        )}
                      </td>
                      <td>
                        {item.attendanceStatus === 'ATE' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span className="status-badge badge-verified" style={{ width: 'fit-content' }}>
                              ✓ Ate
                            </span>
                            {item.attendanceTime && (
                              <span style={{ fontSize: '0.7rem', color: '#047857' }}>
                                {new Date(item.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : item.attendanceStatus === 'DID_NOT_EAT' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <span className="status-badge badge-denied" style={{ width: 'fit-content' }}>
                              ✗ Did Not Eat
                            </span>
                            {item.attendanceTime && (
                              <span style={{ fontSize: '0.7rem', color: '#B91C1C' }}>
                                {new Date(item.attendanceTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="status-badge badge-pending" style={{ width: 'fit-content' }}>
                            ○ Pending
                          </span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                          {item.markedBy || 'System/Scanner'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {reportsPagination.totalPages > 1 && (
                <div className="pagination-controls-bar" style={{ padding: '0.75rem 1rem' }}>
                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={reportPage <= 1}
                    onClick={() => {
                      const prev = Math.max(1, reportPage - 1);
                      setReportPage(prev);
                      fetchReportsData(prev);
                    }}
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  <span className="pagination-page-indicator">
                    Page {reportsPagination.page} of {reportsPagination.totalPages} ({reportsPagination.total} records)
                  </span>

                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={reportPage >= reportsPagination.totalPages}
                    onClick={() => {
                      const next = Math.min(reportsPagination.totalPages, reportPage + 1);
                      setReportPage(next);
                      fetchReportsData(next);
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* TAB 1: CONFIGURATION */}
      {activeTab === 'configuration' && (
        <section className="mess-tab-panel" aria-label="Configuration Panel">
          <div className="mess-toolbar-row">
            <div className="mess-section-meta">
              <h2 className="mess-panel-heading">Meal Schedules</h2>
              <span className="mess-count-indicator">{meals.length} configured meals</span>
            </div>

            <button
              type="button"
              className="btn-navy-primary"
              onClick={handleOpenAddMeal}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} />
              <span>+ Add Meal</span>
            </button>
          </div>

          {isMealsLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Loading configured meals from PostgreSQL...</p>
            </div>
          ) : meals.length === 0 ? (
            <div className="allocation-empty-state">
              <UtensilsCrossed size={40} style={{ color: '#94A3B8' }} />
              <h3 className="empty-state-title">No meal configurations found</h3>
              <p className="empty-state-desc">Add a new meal schedule using the button above.</p>
            </div>
          ) : (
            <div className="meal-cards-grid">
              {meals.map((meal) => (
                <article key={meal.id} className="meal-config-card" aria-label={`Meal schedule for ${meal.name}`}>
                  <div className="meal-card-header">
                    <h3 className="meal-card-title">{meal.name}</h3>
                    <span className={`status-badge ${meal.isActive ? 'badge-verified' : 'badge-pending'}`}>
                      {meal.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="meal-card-timing">
                    <Clock size={16} style={{ color: '#64748B', flexShrink: 0 }} />
                    <span className="meal-timing-text">{meal.startTime} - {meal.endTime}</span>
                  </div>

                  {meal.description && (
                    <p className="meal-card-desc">{meal.description}</p>
                  )}

                  <div className="meal-card-actions">
                    <button
                      type="button"
                      className="btn-light-secondary btn-sm"
                      onClick={() => handleOpenEditMeal(meal)}
                    >
                      <Edit2 size={13} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      className="btn-card-reject btn-sm"
                      onClick={() => handleOpenDeleteMeal(meal)}
                      style={{ padding: '0.4rem 0.75rem', fontSize: '0.8rem' }}
                    >
                      <Trash2 size={13} />
                      <span>Delete</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* TAB 2: ANALYTICS */}
      {activeTab === 'analytics' && (
        <section className="mess-tab-panel" aria-label="Analytics Panel">
          <div className="mess-toolbar-row">
            <div className="mess-section-meta">
              <h2 className="mess-panel-heading">Attendance Analytics</h2>
              <span className="mess-count-indicator">Date: {selectedDate}</span>
            </div>

            <div className="mess-date-selector-group">
              <Calendar size={15} style={{ color: '#64748B' }} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="mess-date-input"
                aria-label="Select Date for Analytics"
              />
            </div>
          </div>

          {isAnalyticsLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Computing analytics from PostgreSQL scan records...</p>
            </div>
          ) : !analyticsData ? (
            <div className="allocation-empty-state">
              <AlertTriangle size={40} style={{ color: '#EF4444' }} />
              <h3 className="empty-state-title">Unable to compute analytics</h3>
              <button type="button" onClick={() => fetchAnalytics(false)} className="btn-navy-primary">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* 4 Meal Summary Cards */}
              <div className="analytics-cards-grid">
                {analyticsData.cards.map((card) => (
                  <div key={card.mealType} className="analytics-summary-card">
                    <span className="analytics-card-meal-name">{card.name}</span>
                    <div className="analytics-card-total">{card.totalScans}</div>
                    <div className="analytics-card-subcounts">
                      <span className="analytics-stat-allowed">
                        Allowed: <strong>{card.allowed}</strong>
                      </span>
                      <span className="analytics-stat-denied">
                        Denied: <strong>{card.denied}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Bar Chart Section: Allowed vs Denied per Meal */}
              <div className="analytics-chart-container">
                <div className="analytics-chart-header">
                  <h3 className="analytics-chart-title">Allowed vs Denied per Meal</h3>
                  <div className="analytics-chart-legend">
                    <span className="legend-item">
                      <span className="legend-box allowed-box"></span> Allowed
                    </span>
                    <span className="legend-item">
                      <span className="legend-box denied-box"></span> Denied
                    </span>
                  </div>
                </div>

                <div className="chart-bars-wrap">
                  {analyticsData.cards.map((card) => {
                    const maxCount = Math.max(
                      1,
                      ...analyticsData.cards.map((c) => Math.max(c.allowed, c.denied))
                    );
                    const allowedPct = Math.round((card.allowed / maxCount) * 100);
                    const deniedPct = Math.round((card.denied / maxCount) * 100);

                    return (
                      <div key={card.mealType} className="chart-meal-col">
                        <div className="chart-bars-group">
                          {/* Allowed Bar */}
                          <div className="chart-bar-slot">
                            <span className="bar-count-label">{card.allowed}</span>
                            <div
                              className="chart-bar bar-allowed"
                              style={{ height: `${Math.max(8, allowedPct)}%` }}
                              title={`${card.name} Allowed: ${card.allowed}`}
                            />
                          </div>

                          {/* Denied Bar */}
                          <div className="chart-bar-slot">
                            <span className="bar-count-label">{card.denied}</span>
                            <div
                              className="chart-bar bar-denied"
                              style={{ height: `${Math.max(8, deniedPct)}%` }}
                              title={`${card.name} Denied: ${card.denied}`}
                            />
                          </div>
                        </div>

                        <span className="chart-col-label">{card.name}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Overall Distribution */}
              <div className="overall-distribution-section">
                <h3 className="distribution-heading">Overall Distribution</h3>
                <div className="distribution-metrics-row">
                  <div className="dist-metric-box">
                    <span className="dist-label">Total Attendance Scans</span>
                    <strong className="dist-val">{analyticsData.distribution.totalScans}</strong>
                  </div>
                  <div className="dist-metric-box">
                    <span className="dist-label">Total Allowed</span>
                    <strong className="dist-val" style={{ color: '#059669' }}>
                      {analyticsData.distribution.totalAllowed}
                    </strong>
                  </div>
                  <div className="dist-metric-box">
                    <span className="dist-label">Total Denied</span>
                    <strong className="dist-val" style={{ color: '#DC2626' }}>
                      {analyticsData.distribution.totalDenied}
                    </strong>
                  </div>
                  <div className="dist-metric-box">
                    <span className="dist-label">Access Success Rate</span>
                    <strong className="dist-val" style={{ color: '#151B54' }}>
                      {analyticsData.distribution.allowedPercentage}%
                    </strong>
                  </div>
                </div>

                <div className="distribution-bar-track">
                  <div
                    className="distribution-bar-fill"
                    style={{ width: `${analyticsData.distribution.allowedPercentage}%` }}
                    title={`Allowed: ${analyticsData.distribution.allowedPercentage}%`}
                  />
                </div>
              </div>
            </>
          )}
        </section>
      )}

      {/* TAB 3: INDENT PLAN */}
      {activeTab === 'indent' && (
        <section className="mess-tab-panel" aria-label="Indent Planner Panel">
          <div className="indent-header-intro">
            <h2 className="indent-main-heading">Indent Planner</h2>
            <p className="indent-sub-heading">Expected meal counts and dietary preferences for a specific day.</p>
          </div>

          {/* Indent Controls: Search & Filter */}
          <div className="mess-search-actions-bar">
            <div className="search-field-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                type="text"
                placeholder="Search by name or ID"
                value={indentSearch}
                onChange={(e) => setIndentSearch(e.target.value)}
                className="allocation-search-input"
                aria-label="Search by name or ID"
              />
            </div>

            <div className="indent-action-btns">
              <button
                type="button"
                className="btn-navy-primary"
                onClick={() => setIsIndentFilterModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Filter size={15} />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {isIndentLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Calculating kitchen indent headcount from PostgreSQL...</p>
            </div>
          ) : !indentData ? (
            <div className="allocation-empty-state">
              <AlertTriangle size={40} style={{ color: '#EF4444' }} />
              <h3 className="empty-state-title">Failed to load indent plan</h3>
              <button type="button" onClick={() => fetchIndentPlan(false)} className="btn-navy-primary">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* 4 Meal Summary Cards: Expected, Veg, Non-Veg */}
              <div className="indent-summary-cards-grid">
                {indentData.summary.map((meal) => (
                  <div key={meal.mealType} className="indent-meal-card">
                    <span className="indent-card-title">{meal.name}</span>
                    <div className="indent-card-expected-total">{meal.expectedTotal}</div>
                    <div className="indent-card-diet-breakdown">
                      <span className="diet-veg">
                        Veg: <strong>{meal.vegCount}</strong>
                      </span>
                      <span className="diet-nonveg">
                        Non-Veg: <strong>{meal.nonVegCount}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Student Indent Records List */}
              <div className="indent-records-header">
                <span className="records-count-text">
                  {indentData.totalStudents} resident records for {appliedIndentFilters.date}
                </span>
              </div>

              {indentData.students.length === 0 ? (
                <div className="allocation-empty-state">
                  <Users size={40} style={{ color: '#94A3B8' }} />
                  <h3 className="empty-state-title">No indent records found</h3>
                  <p className="empty-state-desc">No residents booked meals matching the selected filter criteria.</p>
                </div>
              ) : (
                <div className="indent-students-cards-grid">
                  {indentData.students.map((student: IndentStudentRecord) => (
                    <article key={student.id} className="indent-student-card" aria-label={`Indent record for ${student.studentName}`}>
                      <div className="indent-card-top-row">
                        <div className="student-avatar-badge" aria-hidden="true">
                          {student.avatar}
                        </div>
                        <div className="indent-student-identity">
                          <h4 className="indent-student-name">{student.studentName}</h4>
                          <span className="indent-student-id">{student.studentId}</span>
                        </div>
                        <span
                          className={`status-badge ${
                            student.status === 'CAME' ? 'badge-verified' : 'badge-pending'
                          }`}
                        >
                          {student.status}
                        </span>
                      </div>

                      <div className="indent-card-meta-grid">
                        <div className="indent-meta-item">
                          <span className="meta-label">Block / Room</span>
                          <span className="meta-val">{student.block} / {student.room}</span>
                        </div>
                        <div className="indent-meta-item">
                          <span className="meta-label">Year & Program</span>
                          <span className="meta-val">{student.year}</span>
                        </div>
                        <div className="indent-meta-item">
                          <span className="meta-label">Department</span>
                          <span className="meta-val">{student.department}</span>
                        </div>
                        <div className="indent-meta-item">
                          <span className="meta-label">Meal & Diet</span>
                          <span className="meta-val">
                            {student.meal} • <strong style={{ color: '#059669' }}>{student.dietaryPreference}</strong>
                          </span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* TAB 4: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <section className="mess-tab-panel" aria-label="Attendance Panel">
          {/* Header Action Bar: Search, CSV, PDF, Filter */}
          <div className="mess-search-actions-bar">
            <div className="search-field-wrap">
              <Search size={16} className="search-input-icon" />
              <input
                type="text"
                placeholder="Search by name, email, or ID"
                value={attendanceSearch}
                onChange={(e) => setAttendanceSearch(e.target.value)}
                className="allocation-search-input"
                aria-label="Search attendance by name, email, or ID"
              />
            </div>

            <div className="attendance-action-btns">
              <button
                type="button"
                className="btn-light-secondary"
                onClick={handleExportCsv}
                title="Export CSV"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Download size={15} />
                <span>CSV export</span>
              </button>

              <button
                type="button"
                className="btn-light-secondary"
                onClick={handleExportPdf}
                title="Export PDF / Print"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <FileText size={15} />
                <span>PDF export</span>
              </button>

              <button
                type="button"
                className="btn-navy-primary"
                onClick={() => setIsAttendanceFilterModalOpen(true)}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <Filter size={15} />
                <span>Filter</span>
              </button>
            </div>
          </div>

          {isAttendanceLoading ? (
            <div className="allocation-loading-state">
              <RotateCw size={28} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p>Loading attendance verification records from PostgreSQL...</p>
            </div>
          ) : !attendanceData ? (
            <div className="allocation-empty-state">
              <AlertTriangle size={40} style={{ color: '#EF4444' }} />
              <h3 className="empty-state-title">Failed to load attendance logs</h3>
              <button type="button" onClick={() => fetchAttendance(1, false)} className="btn-navy-primary">
                Retry
              </button>
            </div>
          ) : (
            <>
              {/* 4 Attendance Summary Cards */}
              <div className="attendance-summary-cards-grid">
                {attendanceData.summary.map((meal) => (
                  <div key={meal.mealType} className="attendance-summary-card">
                    <span className="attendance-card-title">{meal.name}</span>
                    <div className="attendance-card-total">{meal.total}</div>
                    <div className="attendance-card-subcounts">
                      <span className="att-sub-allowed">
                        Allowed: <strong>{meal.allowed}</strong>
                      </span>
                      <span className="att-sub-absent">
                        Absent: <strong>{meal.absent}</strong>
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Records Header */}
              <div className="attendance-logs-header">
                <span className="records-count-text">
                  Total {attendanceData.total} attendance records for {appliedAttFilters.date}
                </span>
              </div>

              {/* Attendance Log Items */}
              {attendanceData.data.length === 0 ? (
                <div className="allocation-empty-state">
                  <Fingerprint size={40} style={{ color: '#94A3B8' }} />
                  <h3 className="empty-state-title">No attendance records found</h3>
                  <p className="empty-state-desc">No verification scans matched the current filters or query.</p>
                </div>
              ) : (
                <div className="attendance-logs-list">
                  {attendanceData.data.map((log: AttendanceRecordItem) => (
                    <article key={log.id} className="attendance-log-row" aria-label={`Attendance record for ${log.studentName}`}>
                      <div className="attendance-log-left">
                        <span
                          className={`status-badge ${
                            log.status === 'Allowed'
                              ? 'badge-verified'
                              : log.status === 'Denied'
                              ? 'badge-denied'
                              : 'badge-pending'
                          }`}
                        >
                          {log.status}
                        </span>

                        <div className="student-avatar-badge" aria-hidden="true">
                          {log.avatar}
                        </div>

                        <div className="att-student-info">
                          <h4 className="att-student-name">{log.studentName}</h4>
                          <span className="att-student-id">{log.studentId}</span>
                        </div>
                      </div>

                      <div className="attendance-log-right">
                        <span className="badge-biometric">
                          <Fingerprint size={12} />
                          <span>{log.badge}</span>
                        </span>

                        <div className="att-datetime-block">
                          <span className="att-time-text">{log.time}</span>
                          <span className="att-date-text">{log.date}</span>
                        </div>

                        <span className="att-meal-tag">{log.meal}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {attendanceData.totalPages > 1 && (
                <div className="pagination-controls-bar">
                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={attendancePage <= 1}
                    onClick={() => setAttendancePage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft size={16} />
                    <span>Previous</span>
                  </button>

                  <span className="pagination-page-indicator">
                    Page {attendanceData.page} of {attendanceData.totalPages}
                  </span>

                  <button
                    type="button"
                    className="btn-light-secondary btn-sm"
                    disabled={attendancePage >= attendanceData.totalPages}
                    onClick={() => setAttendancePage((p) => Math.min(attendanceData.totalPages, p + 1))}
                  >
                    <span>Next</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* MODALS SECTION                                                        */}
      {/* ===================================================================== */}

      {/* 1. Add / Edit Meal Modal */}
      {isMealModalOpen && (
        <div className="notice-modal-backdrop" role="dialog" aria-modal="true" aria-label={editingMeal ? 'Edit Meal' : 'Add Meal'}>
          <div className="notice-modal-card" style={{ maxWidth: '440px' }}>
            <div className="notice-modal-header">
              <h2 className="notice-modal-title">{editingMeal ? 'Edit Meal' : 'Add Meal'}</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsMealModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMeal} className="notice-form-body">
              {mealFormError && (
                <div className="modal-error-alert" role="alert">
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{mealFormError}</span>
                </div>
              )}

              <div className="form-group-field">
                <label className="form-field-label">
                  Name <span className="field-required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Breakfast, Dinner"
                  value={mealFormName}
                  onChange={(e) => setMealFormName(e.target.value)}
                  className="modal-text-input"
                  required
                />
              </div>

              <div className="form-group-field">
                <label className="form-field-label">
                  Start Time <span className="field-required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 07:30 AM or 07:30"
                  value={mealFormStartTime}
                  onChange={(e) => setMealFormStartTime(e.target.value)}
                  className="modal-text-input"
                  required
                />
              </div>

              <div className="form-group-field">
                <label className="form-field-label">
                  End Time <span className="field-required">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 09:30 AM or 09:30"
                  value={mealFormEndTime}
                  onChange={(e) => setMealFormEndTime(e.target.value)}
                  className="modal-text-input"
                  required
                />
              </div>

              <div className="form-checkbox-row">
                <input
                  type="checkbox"
                  id="mealActiveCheck"
                  checked={mealFormActive}
                  onChange={(e) => setMealFormActive(e.target.checked)}
                  className="modal-checkbox-input"
                />
                <label htmlFor="mealActiveCheck" className="form-checkbox-label">
                  Active
                </label>
              </div>

              <div className="notice-modal-actions">
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsMealModalOpen(false)}
                  disabled={isMealSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-navy-primary"
                  disabled={isMealSubmitting}
                >
                  {isMealSubmitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Delete Meal Confirmation Modal */}
      {isDeleteModalOpen && mealToDelete && (
        <div className="notice-modal-backdrop" role="dialog" aria-modal="true" aria-label="Delete Meal Confirmation">
          <div className="notice-modal-card" style={{ maxWidth: '420px' }}>
            <div className="notice-modal-header">
              <h2 className="notice-modal-title">Delete Meal</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsDeleteModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-form-body">
              <p style={{ color: '#334155', fontSize: '0.95rem', margin: '0 0 1rem' }}>
                Are you sure you want to delete meal schedule <strong>"{mealToDelete.name}"</strong>?
              </p>
              <p style={{ color: '#64748B', fontSize: '0.85rem', margin: '0 0 1.25rem' }}>
                Meals referenced by active or historical student tokens cannot be deleted to preserve auditable logs.
              </p>

              <div className="notice-modal-actions">
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isDeleteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-card-reject"
                  onClick={handleConfirmDeleteMeal}
                  disabled={isDeleteSubmitting}
                  style={{ padding: '0.55rem 1rem' }}
                >
                  {isDeleteSubmitting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Filter Indent Plan Modal */}
      {isIndentFilterModalOpen && (
        <div className="notice-modal-backdrop" role="dialog" aria-modal="true" aria-label="Filter Indent Plan">
          <div className="notice-modal-card" style={{ maxWidth: '440px' }}>
            <div className="notice-modal-header">
              <h2 className="notice-modal-title">Filter Indent Plan</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsIndentFilterModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-form-body">
              <div className="form-group-field">
                <label className="form-field-label">Date</label>
                <input
                  type="date"
                  value={indentFilterDate}
                  onChange={(e) => setIndentFilterDate(e.target.value)}
                  className="modal-text-input"
                />
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Block</label>
                <select
                  value={indentFilterBlock}
                  onChange={(e) => setIndentFilterBlock(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Year</label>
                <select
                  value={indentFilterYear}
                  onChange={(e) => setIndentFilterYear(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Years</option>
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Department</label>
                <select
                  value={indentFilterDept}
                  onChange={(e) => setIndentFilterDept(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Departments</option>
                  <option value="CSE">Computer Science & Engineering (CSE)</option>
                  <option value="Data Science">Data Science (CSE-DS)</option>
                  <option value="AI&ML">AI & Machine Learning (CSE-AI&ML)</option>
                  <option value="ECE">Electronics & Communication (ECE)</option>
                  <option value="EEE">Electrical & Electronics (EEE)</option>
                  <option value="MECH">Mechanical Engineering (MECH)</option>
                  <option value="CIVIL">Civil Engineering (CIVIL)</option>
                  <option value="IT">Information Technology (IT)</option>
                </select>
              </div>

              <div className="notice-modal-actions">
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={handleResetIndentFilters}
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  className="btn-navy-primary"
                  onClick={handleApplyIndentFilters}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Filter Logs Modal (Attendance Tab) */}
      {isAttendanceFilterModalOpen && (
        <div className="notice-modal-backdrop" role="dialog" aria-modal="true" aria-label="Filter Logs">
          <div className="notice-modal-card" style={{ maxWidth: '440px' }}>
            <div className="notice-modal-header">
              <h2 className="notice-modal-title">Filter Logs</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsAttendanceFilterModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-form-body">
              <div className="form-group-field">
                <label className="form-field-label">Date</label>
                <input
                  type="date"
                  value={attFilterDate}
                  onChange={(e) => setAttFilterDate(e.target.value)}
                  className="modal-text-input"
                />
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Meal Type</label>
                <select
                  value={attFilterMeal}
                  onChange={(e) => setAttFilterMeal(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Meals</option>
                  <option value="BREAKFAST">Breakfast</option>
                  <option value="LUNCH">Lunch</option>
                  <option value="SNACKS">Snacks</option>
                  <option value="DINNER">Dinner</option>
                </select>
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Status</label>
                <select
                  value={attFilterStatus}
                  onChange={(e) => setAttFilterStatus(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ALLOWED">Allowed</option>
                  <option value="ABSENT">Absent</option>
                  <option value="DENIED">Denied</option>
                </select>
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Block</label>
                <select
                  value={attFilterBlock}
                  onChange={(e) => setAttFilterBlock(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Blocks</option>
                  {blocks.map((b) => (
                    <option key={b.id} value={b.name}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group-field">
                <label className="form-field-label">Gender</label>
                <select
                  value={attFilterGender}
                  onChange={(e) => setAttFilterGender(e.target.value)}
                  className="modal-select-input"
                >
                  <option value="ALL">All Genders</option>
                  <option value="MALE">Boys Hostel</option>
                  <option value="FEMALE">Girls Hostel</option>
                </select>
              </div>

              <div className="notice-modal-actions">
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={handleResetAttendanceFilters}
                >
                  Reset Filters
                </button>
                <button
                  type="button"
                  className="btn-navy-primary"
                  onClick={handleApplyAttendanceFilters}
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Attendance Correction Modal */}
      {isCorrectionModalOpen && correctionTarget && (
        <div
          className="notice-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-label="Correct Attendance"
        >
          <div className="notice-modal-card" style={{ maxWidth: '460px' }}>
            <div className="notice-modal-header">
              <h2 className="notice-modal-title">Correct Mess Attendance</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsCorrectionModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-form-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ backgroundColor: '#F8FAFC', padding: '0.85rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: '1rem' }}>{correctionTarget.studentName}</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.825rem', color: '#64748B' }}>
                  Roll No: <strong style={{ color: '#0F172A' }}>{correctionTarget.rollNo}</strong> · {correctionTarget.blockName || correctionTarget.block} (Room {correctionTarget.roomNumber || correctionTarget.room})
                </p>
                <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8rem', color: '#475569' }}>Meal Indent:</span>
                  <span className={`status-badge ${correctionTarget.indentMarked ? 'badge-verified' : 'badge-neutral'}`}>
                    {correctionTarget.indentMarked ? '✓ Indent Marked' : '✗ No Indent'}
                  </span>
                </div>
              </div>

              <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569' }}>
                Select the authoritative attendance state for <strong>{markingMeal}</strong> on <strong>{markingDate}</strong>:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn-mark-ate"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.65rem 1rem', fontSize: '0.9rem' }}
                  onClick={() => handleSaveCorrection('ATE')}
                >
                  <Check size={16} />
                  <span>Mark as Ate (Consumed)</span>
                </button>

                <button
                  type="button"
                  className="btn-mark-dne"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.65rem 1rem', fontSize: '0.9rem' }}
                  onClick={() => handleSaveCorrection('DID_NOT_EAT')}
                >
                  <Slash size={16} />
                  <span>Mark as Did Not Eat</span>
                </button>

                <button
                  type="button"
                  className="btn-light-secondary"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.65rem 1rem', fontSize: '0.9rem' }}
                  onClick={() => handleSaveCorrection('PENDING')}
                >
                  <RotateCw size={14} />
                  <span>Reset to Pending (Unmarked)</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsCorrectionModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessManagementPage;
