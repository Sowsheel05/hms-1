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
  ExternalLink,
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
  const [markingIndentFilter, setMarkingIndentFilter] = useState<'ALL' | 'MARKED' | 'SKIPPED' | 'NOT_MARKED'>('ALL');
  const [markingAttStatusFilter, setMarkingAttStatusFilter] = useState<'ALL' | 'ATE' | 'DID_NOT_EAT' | 'PENDING'>('ALL');
  const [markingPage, setMarkingPage] = useState<number>(1);
  const [markingData, setMarkingData] = useState<AttendanceMarkingResponse | null>(null);
  const [isMarkingLoading, setIsMarkingLoading] = useState<boolean>(false);

  // Auto-Save Engine State
  const [pendingSaves, setPendingSaves] = useState<{ studentId: string; status: 'ATE' | 'DID_NOT_EAT' | 'PENDING' }[]>([]);
  const [isAutoSaving, setIsAutoSaving] = useState<boolean>(false);
  const [lastAutoSaveTime, setLastAutoSaveTime] = useState<Date | null>(null);

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
        attendanceStatus: markingAttStatusFilter,
        indentStatus: markingIndentFilter,
        search: markingSearch.trim() || undefined,
        page,
        limit: 50,
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
  }, [markingDate, markingMeal, markingBlock, markingSearch, markingIndentFilter, markingAttStatusFilter, markingPage]);

  // Debounced Auto-Save Effect
  useEffect(() => {
    if (pendingSaves.length === 0) return;
    
    const timer = setTimeout(async () => {
      setIsAutoSaving(true);
      const itemsToSave = [...pendingSaves];
      setPendingSaves([]); 
      
      try {
        await managementApiService.batchMarkAttendance({
          date: markingDate,
          mealType: markingMeal,
          items: itemsToSave,
        });
        setLastAutoSaveTime(new Date());
        await fetchAttendanceMarking(markingPage, true);
      } catch (err: any) {
        setPendingSaves(prev => [...itemsToSave, ...prev]);
        showToast('Auto-save failed, retrying...', 'error');
      } finally {
        setIsAutoSaving(false);
      }
    }, 800); 

    return () => clearTimeout(timer);
  }, [pendingSaves, markingDate, markingMeal, markingPage, fetchAttendanceMarking]);

  const handleStudentStatusUpdate = (student: AttendanceMarkingStudent, targetStatus: 'ATE' | 'DID_NOT_EAT' | 'PENDING') => {
    const oldStatus = student.attendanceStatus;
    if (oldStatus === targetStatus) return;

    setMarkingData(prev => {
      if (!prev) return prev;
      const updatedStudents = prev.students.map(s => {
        if (s.studentId === student.studentId || s.id === student.id) {
          return {
            ...s,
            attendanceStatus: targetStatus,
            attendanceTime: targetStatus !== 'PENDING' ? new Date().toISOString() : null
          };
        }
        return s;
      });

      // Optimistically update summary ribbon counts
      let ateDiff = 0;
      let dneDiff = 0;
      let pendingDiff = 0;

      if (oldStatus === 'ATE') ateDiff--;
      if (oldStatus === 'DID_NOT_EAT') dneDiff--;
      if (oldStatus === 'PENDING') pendingDiff--;

      if (targetStatus === 'ATE') ateDiff++;
      if (targetStatus === 'DID_NOT_EAT') dneDiff++;
      if (targetStatus === 'PENDING') pendingDiff++;

      const updatedSummary = prev.summary ? {
        ...prev.summary,
        ateCount: Math.max(0, prev.summary.ateCount + ateDiff),
        didNotEatCount: Math.max(0, prev.summary.didNotEatCount + dneDiff),
        pendingCount: Math.max(0, prev.summary.pendingCount + pendingDiff),
      } : prev.summary;

      return {
        ...prev,
        summary: updatedSummary,
        students: updatedStudents,
      };
    });

    setPendingSaves(prev => {
      const targetId = student.id || student.studentId;
      const filtered = prev.filter(p => p.studentId !== targetId);
      return [...filtered, { studentId: targetId, status: targetStatus }];
    });
  };

  const handleMarkAllIndentedAte = () => {
    if (!markingData) return;
    const indentedPending = markingData.students.filter(s => s.indentMarked && s.attendanceStatus !== 'ATE');
    if (indentedPending.length === 0) {
      showToast('All indented students on this page are already marked Ate.');
      return;
    }
    
    const itemsToSave = indentedPending.map(s => ({ studentId: s.id || s.studentId, status: 'ATE' as const }));
    setMarkingData(prev => {
      if (!prev) return prev;
      const updatedStudents = prev.students.map(s => {
        if (s.indentMarked && s.attendanceStatus !== 'ATE') {
          return { ...s, attendanceStatus: 'ATE' as const, attendanceTime: new Date().toISOString() };
        }
        return s;
      });

      const ateDiff = indentedPending.length;
      const updatedSummary = prev.summary ? {
        ...prev.summary,
        ateCount: prev.summary.ateCount + ateDiff,
        pendingCount: Math.max(0, prev.summary.pendingCount - ateDiff),
      } : prev.summary;

      return {
        ...prev,
        summary: updatedSummary,
        students: updatedStudents,
      };
    });

    setPendingSaves(prev => {
      const existingIds = new Set(itemsToSave.map(i => i.studentId));
      const filtered = prev.filter(p => !existingIds.has(p.studentId));
      return [...filtered, ...itemsToSave];
    });
  };

  const handleOpenCorrection = (student: AttendanceMarkingStudent) => {
    setCorrectionTarget(student);
    setIsCorrectionModalOpen(true);
  };

  const handleSaveCorrection = async (newStatus: 'ATE' | 'DID_NOT_EAT' | 'PENDING') => {
    if (!correctionTarget) return;
    setIsCorrectionSubmitting(true);
    try {
      handleStudentStatusUpdate(correctionTarget, newStatus);
      showToast(`Attendance updated to ${newStatus === 'ATE' ? 'Ate (Consumed)' : newStatus === 'DID_NOT_EAT' ? 'Did Not Eat' : 'Pending'}`);

      if (correctionTarget.attendanceId) {
        await managementApiService.correctAttendance(correctionTarget.attendanceId, newStatus);
      } else if (newStatus !== 'PENDING') {
        await managementApiService.markAttendance({
          studentId: correctionTarget.id || correctionTarget.studentId,
          date: markingDate,
          mealType: markingMeal,
          status: newStatus,
        });
      }

      setIsCorrectionModalOpen(false);
      setCorrectionTarget(null);
      await fetchAttendanceMarking(markingPage, true);
    } catch (err: any) {
      showToast(err.message || 'Failed to update attendance.', 'error');
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
  }, [activeTab, markingDate, markingMeal, markingBlock, markingSearch, markingIndentFilter, markingAttStatusFilter, fetchAttendanceMarking]);

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
          {/* Top Info Banner */}
          <div style={{ backgroundColor: '#F1F5F9', padding: '0.75rem 1.25rem', borderBottom: '1px solid #E2E8F0', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UtensilsCrossed size={18} style={{ color: '#151B54' }} />
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800, color: '#151B54' }}>Daily Mess Attendance Entry</h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.2rem 0.55rem', borderRadius: '12px', backgroundColor: '#EEF2FF', color: '#151B54', border: '1px solid #C7D2FE' }}>
                {markingMeal} • {markingDate}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem' }}>
              {isAutoSaving ? (
                <span style={{ color: '#D97706', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#FEF3C7', padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                  <RotateCw size={14} className="spin-anim" /> Syncing ({pendingSaves.length} pending)...
                </span>
              ) : lastAutoSaveTime ? (
                <span style={{ color: '#059669', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem', backgroundColor: '#D1FAE5', padding: '0.25rem 0.65rem', borderRadius: '6px' }}>
                  <CheckCircle2 size={14} /> Synced live at {lastAutoSaveTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              ) : (
                <span style={{ color: '#64748B', fontWeight: 600 }}>💡 Tap student cards to mark attendance</span>
              )}
            </div>
          </div>

          {/* Action & Filter Controls Box */}
          <div className="mess-action-toolbar" style={{ backgroundColor: '#FFFFFF', padding: '1rem 1.25rem', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div className="mess-filter-group" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
              
              {/* Date Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Date</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <Calendar size={15} style={{ color: '#151B54' }} />
                  <input
                    type="date"
                    value={markingDate}
                    onChange={(e) => {
                      setMarkingDate(e.target.value);
                      setMarkingPage(1);
                    }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}
                    aria-label="Attendance Date"
                  />
                </div>
              </div>

              {/* Meal Slot Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Meal Slot</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <UtensilsCrossed size={15} style={{ color: '#151B54' }} />
                  <select
                    value={markingMeal}
                    onChange={(e) => {
                      setMarkingMeal(e.target.value);
                      setMarkingPage(1);
                    }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}
                    aria-label="Attendance Meal"
                  >
                    <option value="BREAKFAST">🍳 Breakfast</option>
                    <option value="LUNCH">🍲 Lunch</option>
                    <option value="SNACKS">☕ Snacks</option>
                    <option value="DINNER">🍛 Dinner</option>
                  </select>
                </div>
              </div>

              {/* Hostel Block Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Hostel Block</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <Filter size={15} style={{ color: '#151B54' }} />
                  <select
                    value={markingBlock}
                    onChange={(e) => {
                      setMarkingBlock(e.target.value);
                      setMarkingPage(1);
                    }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', fontWeight: 600, color: '#0F172A', cursor: 'pointer' }}
                    aria-label="Filter by Block"
                  >
                    <option value="ALL">🏢 All Blocks</option>
                    {blocks.map((b) => (
                      <option key={b.id} value={b.name}>
                        🏢 {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

            </div>

            {/* Search Box & Quick Batch Action */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginLeft: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: '240px' }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Search Student</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#F8FAFC', border: '1px solid #CBD5E1', borderRadius: '8px', padding: '0.45rem 0.75rem', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                  <Search size={15} style={{ color: '#64748B' }} />
                  <input
                    type="text"
                    placeholder="Roll No or Student Name..."
                    value={markingSearch}
                    onChange={(e) => {
                      setMarkingSearch(e.target.value);
                      setMarkingPage(1);
                    }}
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '0.875rem', color: '#0F172A', width: '100%' }}
                    aria-label="Search students by name or roll number"
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn-mark-ate"
                onClick={handleMarkAllIndentedAte}
                disabled={!markingData || markingData.students.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.85rem', height: '38px', borderRadius: '8px', fontWeight: 700 }}
              >
                <Check size={16} />
                <span>Mark All Indented</span>
              </button>
            </div>
          </div>

          {/* Metric Summary Cards (Deep Navy CampusStay Theme #151B54) */}
          {markingData?.summary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem', padding: '1rem 1.25rem 0.5rem' }}>
              {/* Total Eligible Card */}
              <div
                onClick={() => { setMarkingIndentFilter('ALL'); setMarkingAttStatusFilter('ALL'); setMarkingPage(1); }}
                style={{
                  backgroundColor: '#151B54',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  outline: markingIndentFilter === 'ALL' && markingAttStatusFilter === 'ALL' ? '3px solid #38BDF8' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Click to view All Students"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>TOTAL ELIGIBLE</span>
                  <Users size={16} style={{ color: '#38BDF8' }} />
                </div>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1 }}>{markingData.summary.totalStudents}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, paddingTop: '0.4rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.12)', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <span style={{ color: '#38BDF8' }}>✓ Indented: {markingData.summary.indentMarkedCount}</span>
                  <span style={{ color: '#C084FC' }}>🚫 Skipped: {markingData.summary.indentSkippedCount || 0}</span>
                  <span style={{ color: '#94A3B8' }}>✗ No Indent: {markingData.summary.noIndentCount}</span>
                </div>
              </div>

              {/* Attended / Ate Card */}
              <div
                onClick={() => { setMarkingAttStatusFilter('ATE'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
                style={{
                  backgroundColor: '#151B54',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  borderLeft: '4px solid #10B981',
                  outline: markingAttStatusFilter === 'ATE' ? '3px solid #10B981' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Click to view Attended (Ate)"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#A7F3D0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>✓ ATE / ALLOWED</span>
                  <CheckCircle2 size={16} style={{ color: '#10B981' }} />
                </div>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#10B981', letterSpacing: '-0.02em', lineHeight: 1 }}>{markingData.summary.ateCount}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, paddingTop: '0.4rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ color: '#34D399' }}>Consumed</span>
                  <span style={{ color: '#A7F3D0' }}>
                    {markingData.summary.totalStudents > 0 ? Math.round((markingData.summary.ateCount / markingData.summary.totalStudents) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Absent / Did Not Eat Card */}
              <div
                onClick={() => { setMarkingAttStatusFilter('DID_NOT_EAT'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
                style={{
                  backgroundColor: '#151B54',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  borderLeft: '4px solid #EF4444',
                  outline: markingAttStatusFilter === 'DID_NOT_EAT' ? '3px solid #EF4444' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Click to view Absent (Did Not Eat)"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FCA5A5', textTransform: 'uppercase', letterSpacing: '0.04em' }}>✗ ABSENT (NOT EAT)</span>
                  <Slash size={16} style={{ color: '#EF4444' }} />
                </div>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#F87171', letterSpacing: '-0.02em', lineHeight: 1 }}>{markingData.summary.didNotEatCount}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, paddingTop: '0.4rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ color: '#F87171' }}>Did Not Eat</span>
                  <span style={{ color: '#FCA5A5' }}>
                    {markingData.summary.totalStudents > 0 ? Math.round((markingData.summary.didNotEatCount / markingData.summary.totalStudents) * 100) : 0}%
                  </span>
                </div>
              </div>

              {/* Pending Card */}
              <div
                onClick={() => { setMarkingAttStatusFilter('PENDING'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
                style={{
                  backgroundColor: '#151B54',
                  color: 'white',
                  borderRadius: '12px',
                  padding: '1.15rem 1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                  borderLeft: '4px solid #F59E0B',
                  outline: markingAttStatusFilter === 'PENDING' ? '3px solid #F59E0B' : 'none',
                  transition: 'all 0.15s ease'
                }}
                title="Click to view Pending"
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#FDE68A', textTransform: 'uppercase', letterSpacing: '0.04em' }}>○ PENDING</span>
                  <Clock size={16} style={{ color: '#F59E0B' }} />
                </div>
                <span style={{ fontSize: '2.2rem', fontWeight: 800, color: '#FBBF24', letterSpacing: '-0.02em', lineHeight: 1 }}>{markingData.summary.pendingCount}</span>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600, paddingTop: '0.4rem', marginTop: '0.2rem', borderTop: '1px solid rgba(255,255,255,0.12)' }}>
                  <span style={{ color: '#FBBF24' }}>Awaiting Action</span>
                  <span style={{ color: '#FDE68A' }}>
                    {markingData.summary.totalStudents > 0 ? Math.round((markingData.summary.pendingCount / markingData.summary.totalStudents) * 100) : 0}%
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Quick Segment Filter Pills */}
          <div style={{ padding: '0.75rem 1.25rem 0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginRight: '0.25rem' }}>FILTER VIEW:</span>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingIndentFilter === 'ALL' && markingAttStatusFilter === 'ALL' ? { backgroundColor: '#151B54', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingIndentFilter('ALL'); setMarkingAttStatusFilter('ALL'); setMarkingPage(1); }}
            >
              All ({markingData?.summary?.totalStudents || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingIndentFilter === 'MARKED' && markingAttStatusFilter === 'ALL' ? { backgroundColor: '#151B54', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingIndentFilter('MARKED'); setMarkingAttStatusFilter('ALL'); setMarkingPage(1); }}
            >
              Who Kept Indent ({markingData?.summary?.indentMarkedCount || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingIndentFilter === 'SKIPPED' && markingAttStatusFilter === 'ALL' ? { backgroundColor: '#7E22CE', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingIndentFilter('SKIPPED'); setMarkingAttStatusFilter('ALL'); setMarkingPage(1); }}
            >
              🚫 Skipped / Not Coming ({markingData?.summary?.indentSkippedCount || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingIndentFilter === 'NOT_MARKED' && markingAttStatusFilter === 'ALL' ? { backgroundColor: '#151B54', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingIndentFilter('NOT_MARKED'); setMarkingAttStatusFilter('ALL'); setMarkingPage(1); }}
            >
              No Indent ({markingData?.summary?.noIndentCount || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingAttStatusFilter === 'ATE' ? { backgroundColor: '#059669', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingAttStatusFilter('ATE'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
            >
              ✓ Ate ({markingData?.summary?.ateCount || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingAttStatusFilter === 'DID_NOT_EAT' ? { backgroundColor: '#DC2626', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingAttStatusFilter('DID_NOT_EAT'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
            >
              ✗ Absent ({markingData?.summary?.didNotEatCount || 0})
            </button>
            <button
              type="button"
              className="btn-light-secondary btn-sm"
              style={markingAttStatusFilter === 'PENDING' ? { backgroundColor: '#D97706', color: 'white', fontWeight: 700 } : {}}
              onClick={() => { setMarkingAttStatusFilter('PENDING'); setMarkingIndentFilter('ALL'); setMarkingPage(1); }}
            >
              ○ Pending ({markingData?.summary?.pendingCount || 0})
            </button>
          </div>

          {/* Student Cards Grid */}
          {isMarkingLoading ? (
            <div className="allocation-loading-state" style={{ padding: '3rem 1rem' }}>
              <RotateCw size={32} className="spin-anim" style={{ color: '#151B54', margin: '0 auto 0.75rem' }} />
              <p style={{ fontWeight: 600, color: '#334155' }}>Loading student list for {markingMeal} ({markingDate})...</p>
            </div>
          ) : !markingData || markingData.students.length === 0 ? (
            <div className="allocation-empty-state" style={{ padding: '3rem 1rem' }}>
              <Users size={48} style={{ color: '#94A3B8', margin: '0 auto 0.5rem' }} />
              <h3 className="empty-state-title" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0F172A' }}>No matching students found</h3>
              <p className="empty-state-desc" style={{ color: '#64748B' }}>Try clearing your search query or selecting a different filter.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem', padding: '1.25rem' }}>
              {markingData.students.map((student) => {
                const isAte = student.attendanceStatus === 'ATE';
                const isDne = student.attendanceStatus === 'DID_NOT_EAT';
                const isIndented = student.indentMarked;
                const initial = student.studentName ? student.studentName.charAt(0).toUpperCase() : 'S';

                return (
                  <div
                    key={student.studentId}
                    style={{
                      border: '1px solid',
                      borderColor: isAte ? '#A7F3D0' : isDne ? '#FECACA' : '#E2E8F0',
                      backgroundColor: isAte ? '#F0FDF4' : isDne ? '#FEF2F2' : '#FFFFFF',
                      borderTop: `4px solid ${isAte ? '#10B981' : isDne ? '#EF4444' : isIndented ? '#F59E0B' : '#94A3B8'}`,
                      borderRadius: '12px',
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                      transition: 'all 0.15s ease-in-out',
                    }}
                  >
                    {/* Card Body: Click to open popup */}
                    <div
                      onClick={() => handleOpenCorrection(student)}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}
                      title="Click for detailed popup view"
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                          <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            backgroundColor: isAte ? '#D1FAE5' : isDne ? '#FEE2E2' : '#EEF2FF',
                            color: isAte ? '#047857' : isDne ? '#B91C1C' : '#151B54',
                            fontWeight: 800,
                            fontSize: '1.05rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            border: `2px solid ${isAte ? '#10B981' : isDne ? '#EF4444' : '#C7D2FE'}`,
                            flexShrink: 0
                          }}>
                            {initial}
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                            <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {student.studentName}
                            </span>
                            <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#151B54', backgroundColor: '#EEF2FF', padding: '0.1rem 0.45rem', borderRadius: '4px', width: 'fit-content', marginTop: '0.15rem' }}>
                              {student.rollNo}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleOpenCorrection(student); }}
                          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: '0.2rem', color: '#64748B' }}
                          title="Open Details Popup"
                        >
                          <ExternalLink size={15} />
                        </button>
                      </div>

                      {/* Hostel & Room Info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', backgroundColor: '#F8FAFC', padding: '0.4rem 0.6rem', borderRadius: '6px', border: '1px solid #F1F5F9' }}>
                        <span style={{ color: '#475569', fontWeight: 600 }}>{student.blockName || student.block}</span>
                        <span style={{ fontWeight: 700, color: '#334155' }}>Rm {student.roomNumber || student.room}</span>
                      </div>

                      {/* Indent Status Pill */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{
                          fontSize: '0.725rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          backgroundColor: isIndented ? '#DCFCE7' : '#F1F5F9',
                          color: isIndented ? '#15803D' : '#64748B'
                        }}>
                          {isIndented ? '✓ INDENT KEPT' : '✗ NO INDENT'}
                        </span>
                        
                        <span style={{ fontSize: '0.725rem', fontWeight: 700, color: isAte ? '#059669' : isDne ? '#DC2626' : '#D97706' }}>
                          {isAte ? '✓ ALLOWED' : isDne ? '✗ ABSENT' : '○ PENDING'}
                        </span>
                      </div>
                    </div>

                    {/* Quick Direct 1-Tap Attendance Buttons */}
                    <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <button
                        type="button"
                        onClick={() => handleStudentStatusUpdate(student, 'ATE')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isAte ? '#10B981' : '#CBD5E1',
                          backgroundColor: isAte ? '#10B981' : '#FFFFFF',
                          color: isAte ? '#FFFFFF' : '#059669',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          boxShadow: isAte ? '0 2px 4px rgba(16,185,129,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title="Mark student as Ate (Consumed)"
                      >
                        <Check size={14} />
                        <span>{isAte ? 'ATE' : 'Mark Ate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStudentStatusUpdate(student, 'DID_NOT_EAT')}
                        style={{
                          flex: 1,
                          padding: '0.45rem 0.5rem',
                          borderRadius: '6px',
                          border: '1px solid',
                          borderColor: isDne ? '#EF4444' : '#CBD5E1',
                          backgroundColor: isDne ? '#EF4444' : '#FFFFFF',
                          color: isDne ? '#FFFFFF' : '#DC2626',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          cursor: 'pointer',
                          boxShadow: isDne ? '0 2px 4px rgba(239,68,68,0.2)' : 'none',
                          transition: 'all 0.15s ease'
                        }}
                        title="Mark student as Absent (Did Not Eat)"
                      >
                        <Slash size={13} />
                        <span>{isDne ? 'ABSENT' : 'Absent'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination Controls */}
          {markingData && markingData.pagination.totalPages > 1 && (
            <div className="pagination-controls-bar" style={{ padding: '0.75rem 1.25rem', marginTop: '0.5rem' }}>
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
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
            if (e.target === e.currentTarget) setIsCorrectionModalOpen(false);
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
            <div className="notice-modal-header" style={{ backgroundColor: '#151B54', color: 'white', padding: '1rem 1.25rem' }}>
              <h2 className="notice-modal-title" style={{ color: 'white', fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Student Mess Attendance Action</h2>
              <button
                type="button"
                className="notice-close-btn"
                onClick={() => setIsCorrectionModalOpen(false)}
                aria-label="Close"
                style={{ color: '#94A3B8' }}
              >
                <X size={18} />
              </button>
            </div>

            <div className="notice-form-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', padding: '1.25rem' }}>
              {/* Student Summary Info */}
              <div style={{ backgroundColor: '#F8FAFC', padding: '1rem', borderRadius: '10px', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  backgroundColor: correctionTarget.attendanceStatus === 'ATE' ? '#D1FAE5' : correctionTarget.attendanceStatus === 'DID_NOT_EAT' ? '#FEE2E2' : '#EEF2FF',
                  color: correctionTarget.attendanceStatus === 'ATE' ? '#047857' : correctionTarget.attendanceStatus === 'DID_NOT_EAT' ? '#B91C1C' : '#151B54',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${correctionTarget.attendanceStatus === 'ATE' ? '#10B981' : correctionTarget.attendanceStatus === 'DID_NOT_EAT' ? '#EF4444' : '#C7D2FE'}`,
                  flexShrink: 0
                }}>
                  {correctionTarget.studentName ? correctionTarget.studentName.charAt(0).toUpperCase() : 'S'}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0F172A', fontSize: '1.05rem', lineHeight: 1.2 }}>{correctionTarget.studentName}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
                    <span style={{ fontWeight: 700, color: '#151B54', backgroundColor: '#EEF2FF', padding: '0.1rem 0.45rem', borderRadius: '4px' }}>
                      {correctionTarget.rollNo}
                    </span>
                    <span style={{ color: '#64748B', fontWeight: 600 }}>
                      {correctionTarget.blockName || correctionTarget.block} • Rm {correctionTarget.roomNumber || correctionTarget.room}
                    </span>
                  </div>
                </div>
              </div>

              {/* Meal Context & Indent Callout */}
              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: correctionTarget.indentMarked ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${correctionTarget.indentMarked ? '#BBF7D0' : '#FECACA'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '0.725rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block' }}>TARGET MEAL SLOT</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#0F172A' }}>{markingMeal} ({markingDate})</span>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: '6px', backgroundColor: correctionTarget.indentMarked ? '#10B981' : '#EF4444', color: '#FFFFFF' }}>
                  {correctionTarget.indentMarked ? '✓ INDENT KEPT' : '✗ NO INDENT'}
                </span>
              </div>

              {/* Attendance State Selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <label style={{ fontSize: '0.775rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Select Attendance Status:</label>
                
                <button
                  type="button"
                  className="btn-mark-ate"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.75rem 1rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '8px', backgroundColor: '#10B981', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  onClick={() => handleSaveCorrection('ATE')}
                >
                  <Check size={18} />
                  <span>Mark as Ate (Allowed / Consumed)</span>
                </button>

                <button
                  type="button"
                  className="btn-mark-dne"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.75rem 1rem', fontSize: '0.95rem', fontWeight: 700, borderRadius: '8px', backgroundColor: '#EF4444', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  onClick={() => handleSaveCorrection('DID_NOT_EAT')}
                >
                  <Slash size={18} />
                  <span>Mark as Did Not Eat (Absent)</span>
                </button>

                <button
                  type="button"
                  className="btn-light-secondary"
                  disabled={isCorrectionSubmitting}
                  style={{ justifyContent: 'center', padding: '0.75rem 1rem', fontSize: '0.875rem', fontWeight: 600, borderRadius: '8px', color: '#475569', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                  onClick={() => handleSaveCorrection('PENDING')}
                >
                  <RotateCw size={15} />
                  <span>Reset to Pending (Unmarked)</span>
                </button>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.25rem', paddingTop: '0.75rem', borderTop: '1px solid #F1F5F9' }}>
                <button
                  type="button"
                  className="btn-light-secondary"
                  onClick={() => setIsCorrectionModalOpen(false)}
                  style={{ padding: '0.45rem 1rem', fontWeight: 600 }}
                >
                  Close
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
