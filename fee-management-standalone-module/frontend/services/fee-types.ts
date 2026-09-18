export interface FeeKpiStats {
  feeStructuresCount: number;
  hostelDue: number;
  collegeDue: number;
  studentsWithDuesCount: number;
  scholarshipsPendingCount: number;
  activeDetentionsCount: number;
}

export interface AcademicYearItem {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    structures?: number;
    feeItems?: number;
    payments?: number;
    scholarships?: number;
    detentions?: number;
  };
}

export interface FeeStructureItem {
  id: string;
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  module: 'HOSTEL' | 'COLLEGE';
  category: string;
  feeKind: string;
  name: string;
  amount: number | string;
  applicability?: string | null;
  status: 'ACTIVE' | 'INACTIVE';
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    feeItems?: number;
  };
}

export interface BankAccountItem {
  id: string;
  name: string;
  accountIdentifier: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  kind: string;
  module: string;
  displayLabel: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    payments?: number;
  };
}

export interface ScholarshipTypeItem {
  id: string;
  code: string;
  name: string;
  provider: string;
  maxAmount?: number | null;
  description?: string | null;
  status: string;
  createdAt: string;
}

export interface StudentScholarshipItem {
  id: string;
  studentId: string;
  student?: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  scholarshipTypeId: string;
  scholarshipType?: ScholarshipTypeItem;
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  sanctionedAmount: number | string;
  appliedAmount: number | string;
  remainingAmount: number | string;
  referenceNumber?: string | null;
  remarks?: string | null;
  status: 'ASSIGNED' | 'APPROVED' | 'APPLIED' | 'REJECTED' | 'CLOSED';
  approvedBy?: string | null;
  approvedAt?: string | null;
  appliedAt?: string | null;
  createdAt: string;
}

export interface DetentionItem {
  id: string;
  studentId: string;
  student?: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber?: string | null;
    blockName?: string | null;
  };
  academicYearId: string;
  academicYear?: {
    id: string;
    code: string;
    name: string;
  };
  currentYearOfStudy: string;
  detainedYearOfStudy: string;
  reason: string;
  status: 'ACTIVE' | 'REVOKED' | 'COMPLETED';
  detainedBy?: string | null;
  detainedAt: string;
  revokedBy?: string | null;
  revokedAt?: string | null;
  remarks?: string | null;
  createdAt: string;
}

export interface InstitutionSettingsItem {
  id: string;
  institutionMode: 'HOSTEL_ONLY' | 'COLLEGE_ONLY' | 'BOTH';
  institutionName: string;
  institutionCode: string;
  enableScholarships: boolean;
  enableDetentions: boolean;
  enableBulkUploads: boolean;
  updatedBy?: string | null;
  updatedAt: string;
}

export interface FeeItemDetail {
  id: string;
  feeType: string;
  module: string;
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  excessPaid: number;
  refundedAmount: number;
  paidPercent: number;
  status: string;
  isExtraFee: boolean;
  extraFeeDetails?: any;
}

export interface StudentFeeItemSummary {
  student: {
    id: string;
    name: string;
    jntuNo: string;
    email: string;
    roomNumber: string | null;
    blockName: string | null;
    role: string;
  };
  academicYear: {
    id: string;
    code: string;
    name: string;
  };
  totalFee: number;
  paidAmount: number;
  concessionAmount: number;
  dueAmount: number;
  excessPaid: number;
  refundedAmount: number;
  paidPercent: number;
  overallStatus: 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERPAID';
  hasActiveDetention: boolean;
  detentionDetails?: any;
  items: FeeItemDetail[];
}

export interface FeeCollectionStudentsResponse {
  success: boolean;
  academicYear: {
    id: string;
    code: string;
    name: string;
  } | null;
  students: StudentFeeItemSummary[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface FeePaymentItem {
  id: string;
  studentId: string;
  academicYearId: string;
  bankAccountId: string;
  bankAccount?: BankAccountItem;
  amount: number | string;
  paymentMethod: string;
  transactionReference: string;
  methodDetails?: string | null;
  status: string;
  receiptNumber: string;
  recordedBy: string;
  recordedById: string;
  createdAt: string;
  allocations?: Array<{
    id: string;
    amount: number | string;
    feeItem?: {
      id: string;
      feeType: string;
      totalFee: number;
      dueAmount: number;
    };
  }>;
  receipt?: {
    id: string;
    receiptNumber: string;
    totalAmount: number | string;
    receiptData: string;
  };
}
