import {
  FeeKpiStats,
  AcademicYearItem,
  FeeStructureItem,
  BankAccountItem,
  ScholarshipTypeItem,
  StudentScholarshipItem,
  DetentionItem,
  InstitutionSettingsItem,
  StudentFeeItemSummary,
  FeeCollectionStudentsResponse,
  FeePaymentItem,
} from './fee-types';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || '';

function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('token') || localStorage.getItem('managementToken') || '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const feeManagementApi = {
  // =========================================================================
  // FEE MANAGEMENT API
  // =========================================================================
  async getFeeKpiStats(): Promise<{ success: boolean; stats: FeeKpiStats }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/kpi-stats`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve KPI stats.');
    return data;
  },

  async getAcademicYears(): Promise<{ success: boolean; academicYears: AcademicYearItem[] }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/academic-years`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve academic years.');
    return data;
  },

  async createAcademicYear(dto: {
    code: string;
    name: string;
    startDate: string;
    endDate: string;
    isCurrent?: boolean;
  }): Promise<{ success: boolean; academicYear: AcademicYearItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/academic-years`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create academic year.');
    return data;
  },

  async setCurrentAcademicYear(id: string): Promise<{ success: boolean; academicYear: AcademicYearItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/academic-years/${id}/set-current`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to set current academic year.');
    return data;
  },

  async getFeeStructures(query?: {
    module?: string;
    academicYearId?: string;
    category?: string;
    status?: string;
    search?: string;
  }): Promise<{ success: boolean; feeStructures: FeeStructureItem[] }> {
    const p = new URLSearchParams();
    if (query?.module) p.set('module', query.module);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.category) p.set('category', query.category);
    if (query?.status) p.set('status', query.status);
    if (query?.search) p.set('search', query.search);

    const res = await fetch(`${API_BASE_URL}/api/fee-management/fee-structures?${p.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve fee structures.');
    return data;
  },

  async createFeeStructure(dto: {
    academicYearId: string;
    module: string;
    category?: string;
    feeKind: string;
    name: string;
    amount: number;
    applicability?: any;
    effectiveFrom?: string;
    effectiveTo?: string;
  }): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/fee-structures`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create fee structure.');
    return data;
  },

  async updateFeeStructure(
    id: string,
    dto: {
      name?: string;
      amount?: number;
      category?: string;
      feeKind?: string;
      applicability?: any;
      effectiveFrom?: string;
      effectiveTo?: string;
    }
  ): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/fee-structures/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update fee structure.');
    return data;
  },

  async toggleFeeStructureStatus(id: string): Promise<{ success: boolean; feeStructure: FeeStructureItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/fee-structures/${id}/toggle-status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to toggle fee structure status.');
    return data;
  },

  async getBankAccounts(): Promise<{ success: boolean; bankAccounts: BankAccountItem[] }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/bank-accounts`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve bank accounts.');
    return data;
  },

  async createBankAccount(dto: {
    name: string;
    accountIdentifier: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    kind: string;
    module?: string;
    displayLabel?: string;
  }): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/bank-accounts`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create bank account.');
    return data;
  },

  async updateBankAccount(
    id: string,
    dto: {
      name?: string;
      bankName?: string;
      accountNumber?: string;
      ifsc?: string;
      kind?: string;
      module?: string;
      displayLabel?: string;
    }
  ): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/bank-accounts/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update bank account.');
    return data;
  },

  async toggleBankAccountStatus(id: string): Promise<{ success: boolean; bankAccount: BankAccountItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/bank-accounts/${id}/toggle-status`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to toggle bank account status.');
    return data;
  },

  async getScholarshipTypes(): Promise<{ success: boolean; scholarshipTypes: ScholarshipTypeItem[] }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/scholarship-types`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve scholarship types.');
    return data;
  },

  async createScholarshipType(dto: {
    code: string;
    name: string;
    provider?: string;
    maxAmount?: number;
    description?: string;
  }): Promise<{ success: boolean; scholarshipType: ScholarshipTypeItem }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/scholarship-types`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create scholarship type.');
    return data;
  },

  async getStudentScholarships(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
    scholarshipTypeId?: string;
  }): Promise<{ success: boolean; scholarships: StudentScholarshipItem[] }> {
    const p = new URLSearchParams();
    if (query?.studentSearch) p.set('studentSearch', query.studentSearch);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.status) p.set('status', query.status);
    if (query?.scholarshipTypeId) p.set('scholarshipTypeId', query.scholarshipTypeId);

    const res = await fetch(`${API_BASE_URL}/api/fee-management/scholarships?${p.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve student scholarships.');
    return data;
  },

  async assignScholarship(dto: {
    studentId: string;
    scholarshipTypeId: string;
    academicYearId: string;
    sanctionedAmount: number;
    referenceNumber?: string;
    remarks?: string;
  }): Promise<{ success: boolean; scholarship: StudentScholarshipItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/scholarships/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to assign scholarship.');
    return data;
  },

  async applyScholarshipConcession(dto: {
    scholarshipId: string;
    targetFeeItemId: string;
    amountToApply: number;
  }): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/scholarships/apply`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to apply scholarship concession.');
    return data;
  },

  async getDetentions(query?: {
    studentSearch?: string;
    academicYearId?: string;
    status?: string;
  }): Promise<{ success: boolean; detentions: DetentionItem[] }> {
    const p = new URLSearchParams();
    if (query?.studentSearch) p.set('studentSearch', query.studentSearch);
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.status) p.set('status', query.status);

    const res = await fetch(`${API_BASE_URL}/api/fee-management/detentions?${p.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve detentions.');
    return data;
  },

  async recordDetention(dto: {
    studentId: string;
    academicYearId: string;
    currentYearOfStudy: string;
    detainedYearOfStudy: string;
    reason: string;
    remarks?: string;
  }): Promise<{ success: boolean; detention: DetentionItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/detentions`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record detention.');
    return data;
  },

  async revokeDetention(id: string, remarks?: string): Promise<{ success: boolean; detention: DetentionItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/detentions/${id}/revoke`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ remarks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to revoke detention.');
    return data;
  },

  async getInstitutionSettings(): Promise<{ success: boolean; settings: InstitutionSettingsItem }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/settings`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve institution settings.');
    return data;
  },

  async updateInstitutionSettings(dto: Partial<InstitutionSettingsItem>): Promise<{ success: boolean; settings: InstitutionSettingsItem; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-management/settings`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to update institution settings.');
    return data;
  },

  // =========================================================================
  // FEE COLLECTION API
  // =========================================================================
  async getStudentsWithFees(query?: {
    academicYearId?: string;
    search?: string;
    module?: string;
    paymentStatus?: string;
    dueStatus?: string;
    page?: number;
    limit?: number;
  }): Promise<FeeCollectionStudentsResponse> {
    const p = new URLSearchParams();
    if (query?.academicYearId) p.set('academicYearId', query.academicYearId);
    if (query?.search) p.set('search', query.search);
    if (query?.module) p.set('module', query.module);
    if (query?.paymentStatus) p.set('paymentStatus', query.paymentStatus);
    if (query?.dueStatus) p.set('dueStatus', query.dueStatus);
    if (query?.page) p.set('page', query.page.toString());
    if (query?.limit) p.set('limit', query.limit.toString());

    const res = await fetch(`${API_BASE_URL}/api/fee-collection/students?${p.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve student fees.');
    return data;
  },

  async recordFeePayment(dto: {
    studentId: string;
    academicYearId: string;
    feeItemId?: string;
    allocations?: Array<{ feeItemId: string; amount: number }>;
    amount: number;
    paymentMethod: 'UPI' | 'CHEQUE' | 'SBI_COLLECT';
    bankAccountId: string;
    upiApp?: string;
    upiReference?: string;
    chequeNumber?: string;
    bankName?: string;
    receivedBy?: string;
    sbiCollectReference?: string;
    verifiedBy?: string;
  }): Promise<{ success: boolean; receiptNumber: string; receiptDetails: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/record-payment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to record fee payment.');
    return data;
  },

  async getReceiptDetails(receiptNumber: string): Promise<{ success: boolean; receipt: any; snapshot: any }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/receipt/${encodeURIComponent(receiptNumber)}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve receipt.');
    return data;
  },

  async getStudentPaymentHistory(studentId: string, academicYearId?: string): Promise<{ success: boolean; payments: FeePaymentItem[] }> {
    const p = new URLSearchParams();
    if (academicYearId) p.set('academicYearId', academicYearId);

    const res = await fetch(`${API_BASE_URL}/api/fee-collection/student/${studentId}/payments?${p.toString()}`, {
      headers: getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to retrieve payment history.');
    return data;
  },

  async processRefund(dto: {
    feeItemId: string;
    paymentId?: string;
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; refund: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/refund`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to process refund.');
    return data;
  },

  async addExtraFee(dto: {
    studentId: string;
    academicYearId: string;
    feeType: string;
    module?: 'HOSTEL' | 'COLLEGE';
    amount?: number;
    isBiometricAttendance?: boolean;
    startDate?: string;
    endDate?: string;
    workingDays?: number;
    dailyRate?: number;
  }): Promise<{ success: boolean; feeItem: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/extra-fee`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to add extra fee.');
    return data;
  },

  async promoteStudents(dto: {
    studentIds: string[];
    currentAcademicYearId: string;
    targetAcademicYearId: string;
    promotionType: 'SEMESTER' | 'ACADEMIC_YEAR';
  }): Promise<{ success: boolean; result: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/promote-students`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to promote students.');
    return data;
  },

  async syncFeeItems(academicYearId: string): Promise<{ success: boolean; result: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/sync-fee-items`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ academicYearId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to sync fee items.');
    return data;
  },

  async bulkFeeAdjustment(dto: {
    feeItemIds: string[];
    adjustmentType: 'DISCOUNT' | 'FINE';
    amount: number;
    reason: string;
  }): Promise<{ success: boolean; result: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/bulk-adjustment`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to apply bulk adjustment.');
    return data;
  },

  async bulkRemoveFee(dto: {
    feeItemIds: string[];
    reason: string;
  }): Promise<{ success: boolean; result: any; message: string }> {
    const res = await fetch(`${API_BASE_URL}/api/fee-collection/bulk-remove`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to remove fee items.');
    return data;
  },
};
