# HMS Fee Management & Fee Collection Implementation Plan

## 1. Executive Summary & Context
This document outlines the authoritative architectural, database, backend API, frontend UX, security, and verification design for two production-grade modules integrated directly into the existing Hostel Management System (HMS) Admin Portal:
1. **Module 1: Fee Management** (`/management/fee-management`)
2. **Module 2: Fee Collection** (`/management/fee-collection`)

The implementation strictly maintains HMS identity, uses PostgreSQL 18.6 with Prisma ORM (never SQLite or mock data), uses server-authoritative Decimal financial precision, guarantees PostgreSQL transaction atomicity, implements full audit logging and SSE real-time updates, and preserves all existing HMS functionalities and regression tests.

---

## 2. Existing Architecture Analysis
### 2.1 Backend Architecture
- **Framework**: Node.js + Express 4.x + TypeScript (`backend/src/index.ts`)
- **Database / ORM**: PostgreSQL 18.6 accessed via `@prisma/client` (`prisma.service.ts`).
- **Management Routes**: Mounted under `/api/management/*` (`backend/src/routes/management.routes.ts`).
- **Authentication & RBAC**:
  - `authenticateManagement` verifies management JWTs and active PostgreSQL `Session` tokens.
  - Roles: `ADMIN`, `HOSTEL_ADMIN`, `WARDEN`, `CHIEF_WARDEN`, `MAINTENANCE_STAFF`, `STUDENT`.
  - `requireRoles(...)` middleware enforces fine-grained route authorization.
- **Audit System**: `auditService.recordLog(...)` writes to `ActivityLog` with metadata sanitization and supports Prisma interactive transactions (`tx`).
- **Realtime Infrastructure**: Server-Sent Events (SSE) via `complaintEventsService` (`events.service.ts`), listening at `/api/management/events-stream`.
- **Existing Models**: `Student` (contains users and accounts), `Session`, `Block`, `Room`, `RoomAllocation`, `MessToken`, `OutingRequest`, `LeaveRequest`, `Suspension`, `Complaint`, `Attachment`, `BiometricEvent`, `GuestVisit`, `GuestBill`, `ActivityLog`, `Notification`.

### 2.2 Frontend Architecture
- **Framework**: React 19 + TypeScript + Vite 6 (`frontend/src`).
- **Design System**: Vanilla CSS with curated navy/indigo/slate tokens, rounded cards, responsive grids, modal dialogs, and mobile-friendly layouts (`frontend/src/index.css`, `ManagementPortal.css`).
- **Layout & Routing**: `App.tsx` handles path routing; `ManagementSidebar.tsx` renders Admin Portal navigation items; `ManagementHeader.tsx` renders portal status and action controls.
- **API Client**: `api.ts` provides typed methods, error handling, auth headers, and SSE subscription.

---

## 3. Database Design & Models
### 3.1 Models to Reuse
- **`Student`**: Core resident and administrative user model (`id`, `jntuNo`, `name`, `email`, `role`, `isActive`, `roomNumber`, `blockName`).
- **`Session`**: Authoritative token storage.
- **`ActivityLog`**: System-wide audit log.
- **`Notification`**: Direct student notifications for fee assessments and payments.
- **`BiometricEvent`**: Biometric punch records used for attendance-based mess extra fee calculation.

### 3.2 Models to Add in `schema.prisma`
All monetary amounts will use `Decimal @db.Decimal(12, 2)` to eliminate JavaScript floating-point errors.

1. **`AcademicYear`**
   - `id`: UUID (Primary Key)
   - `code`: String (Unique, e.g., "2026-2027")
   - `name`: String (e.g., "Academic Year 2026-2027")
   - `startDate`: DateTime
   - `endDate`: DateTime
   - `isCurrent`: Boolean (default: false)
   - `status`: String (default: "ACTIVE" - ACTIVE, UPCOMING, PAST)
   - `createdBy`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

2. **`FeeStructure`**
   - `id`: UUID (Primary Key)
   - `academicYearId`: String (FK -> AcademicYear)
   - `module`: String ("HOSTEL" | "COLLEGE")
   - `category`: String (e.g., "REGULAR", "MANAGEMENT", "CONVENOR", "GENERAL")
   - `feeKind`: String (College: "ADMISSION", "SPECIAL", "TUITION", "PENDING_DUES_REJOIN"; Hostel: "MESS_FEE", "ROOM_RENT", "AMENITIES", "MAINTENANCE", "CAUTION_DEPOSIT")
   - `name`: String (e.g., "Hostel Annual Mess & Room 2026-27")
   - `amount`: Decimal @db.Decimal(12, 2)
   - `applicability`: String? (JSON criteria: yearOfStudy, block, program)
   - `status`: String (default: "ACTIVE" - ACTIVE, INACTIVE)
   - `effectiveFrom`: DateTime?
   - `effectiveTo`: DateTime?
   - `createdBy`: String?
   - `updatedBy`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

3. **`BankAccount`**
   - `id`: UUID (Primary Key)
   - `name`: String (e.g., "College Tuition Fee Account")
   - `accountIdentifier`: String (Unique, e.g., "TUITION-001", "HOSTEL-001")
   - `bankName`: String (e.g., "State Bank of India")
   - `accountNumber`: String
   - `ifsc`: String
   - `kind`: String ("DEPOSIT", "MESS", "TUITION", "SPECIAL", "HOSTEL", "GENERAL")
   - `module`: String ("HOSTEL", "COLLEGE", "BOTH")
   - `displayLabel`: String (e.g., "SBI - Tuition Account (*4589)")
   - `status`: String (default: "ACTIVE" - ACTIVE, INACTIVE)
   - `createdBy`: String?
   - `updatedBy`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

4. **`ScholarshipType`**
   - `id`: UUID (Primary Key)
   - `code`: String (Unique, e.g., "JVD", "MERIT_01")
   - `name`: String (e.g., "Jagananna Vidya Deevena")
   - `provider`: String ("GOVERNMENT", "INSTITUTION", "PRIVATE")
   - `maxAmount`: Decimal? @db.Decimal(12, 2)
   - `description`: String?
   - `status`: String (default: "ACTIVE")
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

5. **`StudentScholarship`**
   - `id`: UUID (Primary Key)
   - `studentId`: String (FK -> Student)
   - `scholarshipTypeId`: String (FK -> ScholarshipType)
   - `academicYearId`: String (FK -> AcademicYear)
   - `sanctionedAmount`: Decimal @db.Decimal(12, 2)
   - `appliedAmount`: Decimal @db.Decimal(12, 2) (default: 0.00)
   - `remainingAmount`: Decimal @db.Decimal(12, 2)
   - `referenceNumber`: String?
   - `remarks`: String?
   - `status`: String (default: "ASSIGNED" - ASSIGNED, APPROVED, APPLIED, REJECTED, CLOSED)
   - `approvedBy`: String?
   - `approvedAt`: DateTime?
   - `appliedAt`: DateTime?
   - `createdBy`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

6. **`Detention`**
   - `id`: UUID (Primary Key)
   - `studentId`: String (FK -> Student)
   - `academicYearId`: String (FK -> AcademicYear)
   - `currentYearOfStudy`: String (e.g., "3rd Year")
   - `detainedYearOfStudy`: String (e.g., "3rd Year" or "2nd Year")
   - `reason`: String
   - `status`: String (default: "ACTIVE" - ACTIVE, REVOKED, COMPLETED)
   - `detainedBy`: String?
   - `detainedAt`: DateTime (default: now())
   - `revokedBy`: String?
   - `revokedAt`: DateTime?
   - `remarks`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

7. **`InstitutionSettings`**
   - `id`: String (Primary Key, e.g., "GLOBAL")
   - `institutionMode`: String (default: "BOTH" - HOSTEL_ONLY, COLLEGE_ONLY, BOTH)
   - `institutionName`: String (default: "Harsha Institution of Technology & Sciences")
   - `institutionCode`: String (default: "HITS-01")
   - `enableScholarships`: Boolean (default: true)
   - `enableDetentions`: Boolean (default: true)
   - `enableBulkUploads`: Boolean (default: true)
   - `updatedBy`: String?
   - `updatedAt`: DateTime (updatedAt)

8. **`FeeItem` (Student Fee Assessment)**
   - `id`: UUID (Primary Key)
   - `studentId`: String (FK -> Student)
   - `academicYearId`: String (FK -> AcademicYear)
   - `feeStructureId`: String? (FK -> FeeStructure, nullable for extra fees)
   - `feeType`: String (e.g., "Tuition Fee", "Mess Fee", "Special Fee", "Lab Fee")
   - `module`: String ("HOSTEL", "COLLEGE")
   - `totalFee`: Decimal @db.Decimal(12, 2)
   - `paidAmount`: Decimal @db.Decimal(12, 2) (default: 0.00)
   - `concessionAmount`: Decimal @db.Decimal(12, 2) (default: 0.00)
   - `dueAmount`: Decimal @db.Decimal(12, 2)
   - `excessPaid`: Decimal @db.Decimal(12, 2) (default: 0.00)
   - `refundedAmount`: Decimal @db.Decimal(12, 2) (default: 0.00)
   - `status`: String (default: "UNPAID" - UNPAID, PARTIAL, PAID, OVERPAID)
   - `isExtraFee`: Boolean (default: false)
   - `extraFeeDetails`: String? (JSON calculation inputs e.g. biometric attendance days)
   - `createdBy`: String?
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

9. **`FeePayment`**
   - `id`: UUID (Primary Key)
   - `studentId`: String (FK -> Student)
   - `academicYearId`: String (FK -> AcademicYear)
   - `bankAccountId`: String (FK -> BankAccount)
   - `amount`: Decimal @db.Decimal(12, 2)
   - `paymentMethod`: String ("UPI", "CHEQUE", "SBI_COLLECT")
   - `transactionReference`: String (Unique per method where applicable)
   - `methodDetails`: String? (JSON: upiApp, chequeNumber, bankName, verifiedBy, receivedBy)
   - `status`: String (default: "COMPLETED" - COMPLETED, VOID, REFUNDED)
   - `receiptNumber`: String (Unique)
   - `recordedBy`: String
   - `recordedById`: String
   - `createdAt`: DateTime (default: now())
   - `updatedAt`: DateTime (updatedAt)

10. **`PaymentAllocation`**
    - `id`: UUID (Primary Key)
    - `paymentId`: String (FK -> FeePayment)
    - `feeItemId`: String (FK -> FeeItem)
    - `amount`: Decimal @db.Decimal(12, 2)
    - `createdAt`: DateTime (default: now())

11. **`FeeReceipt`**
    - `id`: UUID (Primary Key)
    - `receiptNumber`: String (Unique, e.g., "R-20260910-1042")
    - `paymentId`: String (Unique, FK -> FeePayment)
    - `studentId`: String (FK -> Student)
    - `academicYearId`: String (FK -> AcademicYear)
    - `totalAmount`: Decimal @db.Decimal(12, 2)
    - `receiptData`: String (Authoritative JSON snapshot of student, items, bank account, payment method, recordedBy)
    - `createdAt`: DateTime (default: now())

12. **`FeeRefund`**
    - `id`: UUID (Primary Key)
    - `feeItemId`: String (FK -> FeeItem)
    - `paymentId`: String? (FK -> FeePayment)
    - `studentId`: String (FK -> Student)
    - `amount`: Decimal @db.Decimal(12, 2)
    - `reason`: String
    - `status`: String (default: "COMPLETED" - REQUESTED, APPROVED, COMPLETED, REJECTED)
    - `processedBy`: String
    - `processedById`: String
    - `createdAt`: DateTime (default: now())

13. **`FeeImportBatch`**
    - `id`: UUID (Primary Key)
    - `batchType`: String ("DUES_IMPORT", "FEE_ADJUSTMENT", "CREATE_FEE_ITEMS", "REMOVE_FEE")
    - `fileName`: String
    - `totalRows`: Int
    - `successRows`: Int
    - `failedRows`: Int
    - `status`: String ("COMPLETED", "FAILED", "PARTIAL")
    - `errorReport`: String? (JSON array of row validation errors)
    - `uploadedBy`: String
    - `createdAt`: DateTime (default: now())

---

## 4. Financial Calculations & PostgreSQL Transaction Boundaries
### 4.1 Authoritative Mathematical Rules
- **Item Due**: `due = max(totalFee - paidAmount - concessionAmount, 0)`
- **Paid Percentage**: `totalFee > 0 ? min(round((paidAmount / totalFee) * 100, 2), 100) : 100`
- **Excess Paid**: `max(paidAmount + concessionAmount - totalFee, 0)`
- **Refund Eligibility**: `refundAmount <= excessPaid` OR documented authorized adjustment.
- **Zero Floating-Point Drift**: Server-side arithmetic conducted using Decimal operations (`Prisma.Decimal`).

### 4.2 Payment PostgreSQL Transaction Flow
```
BEGIN TRANSACTION (Interactive Prisma Client)
1. Verify management session & RBAC authorization
2. Verify student exists and is active
3. Fetch target FeeItem(s) with row lock / transactional snapshot
4. Re-calculate actual current due from database (reject stale/tampered frontend amounts)
5. Verify payment amount > 0 and <= due (unless intentional overpayment)
6. Verify BankAccount exists and status === 'ACTIVE'
7. Verify reference uniqueness (UPI ID, Cheque No, SBI Collect Ref)
8. Create FeePayment record
9. Create PaymentAllocation record(s)
10. Update FeeItem balances (paidAmount, dueAmount, status)
11. Generate unique receipt number: R-YYYYMMDD-XXXX
12. Create FeeReceipt with frozen snapshot
13. Create ActivityLog audit record inside transaction
14. Create Notification for student
COMMIT TRANSACTION
15. Emit SSE Realtime Events: FEE_PAYMENT_CREATED, FEE_COLLECTION_STATS_UPDATED
16. Return authoritative receipt payload to client
```
If ANY step fails, PostgreSQL automatically rolls back the entire transaction.

---

## 5. API Design & Endpoints
All endpoints are secured by `authenticateManagement` and RBAC permission checks:

### 5.1 Fee Management (`/api/management/fee-management/*`)
- `GET  /api/management/fee-management/kpi-stats` - Top dashboard KPI summary (authoritative aggregation).
- `GET  /api/management/fee-management/fee-structures` - List structures with filter queries (module, year, category, search).
- `POST /api/management/fee-management/fee-structures` - Create fee structure.
- `PUT  /api/management/fee-management/fee-structures/:id` - Edit fee structure.
- `PATCH /api/management/fee-management/fee-structures/:id/status` - Soft activate/deactivate.
- `POST /api/management/fee-management/fee-structures/:id/apply` - Apply structure to eligible students.
- `GET  /api/management/fee-management/bank-accounts` - List bank accounts.
- `POST /api/management/fee-management/bank-accounts` - Create bank account.
- `PUT  /api/management/fee-management/bank-accounts/:id` - Update bank account.
- `PATCH /api/management/fee-management/bank-accounts/:id/status` - Soft toggle active/inactive.
- `GET  /api/management/fee-management/academic-years` - List academic years.
- `POST /api/management/fee-management/academic-years` - Create academic year with date validation.
- `PATCH /api/management/fee-management/academic-years/:id/set-current` - Designate active year.
- `GET  /api/management/fee-management/scholarship-types` - List scholarship types.
- `POST /api/management/fee-management/scholarship-types` - Create scholarship type.
- `GET  /api/management/fee-management/scholarships` - List student scholarships with filters.
- `POST /api/management/fee-management/scholarships` - Assign scholarship to student.
- `POST /api/management/fee-management/scholarships/:id/approve` - Approve scholarship.
- `POST /api/management/fee-management/scholarships/:id/apply` - Transactionally apply scholarship to student fee items.
- `GET  /api/management/fee-management/detentions` - List detentions.
- `POST /api/management/fee-management/detentions` - Create detention record (academic standing).
- `PATCH /api/management/fee-management/detentions/:id/revoke` - Revoke detention.
- `GET  /api/management/fee-management/settings` - Get institution settings.
- `PUT  /api/management/fee-management/settings` - Update institution settings.

### 5.2 Fee Collection (`/api/management/fee-collection/*`)
- `GET  /api/management/fee-collection/students` - Server-side paginated and filtered list of students with fee breakdowns.
- `GET  /api/management/fee-collection/students/:studentId` - Detailed fee items and payment history for a single student.
- `POST /api/management/fee-collection/payments` - Record payment (Pay Full / Pay Partial; UPI, Cheque, SBI Collect) inside transaction.
- `GET  /api/management/fee-collection/receipts/:receiptNumber` - Fetch complete receipt data for viewing/printing.
- `POST /api/management/fee-collection/refunds` - Process authorized refund transactionally.
- `POST /api/management/fee-collection/extra-fee` - Add extra fee (manual or biometric attendance calculation).
- `POST /api/management/fee-collection/promote` - Promote student semester or academic year.
- `POST /api/management/fee-collection/sync-fees` - Idempotent fee synchronization for an academic year.
- `POST /api/management/fee-collection/send-notifications` - Send fee due notifications to students.
- `GET  /api/management/fee-collection/export-excel` - Stream authoritative Excel/XLSX export.
- `POST /api/management/fee-collection/import-excel` - Multipart Excel upload with schema/row validation & transactional execution.
- `POST /api/management/fee-collection/bulk-adjust` - Bulk fee adjustments with transaction rollback on error.
- `POST /api/management/fee-collection/bulk-remove` - Bulk removal of unallocated fee items.

---

## 6. RBAC & Security Safeguards
1. **No Student Access**: Students accessing `/api/management/*` receive HTTP 403.
2. **Least Privilege**:
   - `ADMIN` & `HOSTEL_ADMIN`: Full capabilities (`MANAGE_FEE_STRUCTURES`, `MANAGE_BANK_ACCOUNTS`, `MANAGE_ACADEMIC_YEARS`, `COLLECT_FEES`, `PROCESS_REFUNDS`, `IMPORT_FEE_DATA`, `EXPORT_FEE_DATA`).
   - `WARDEN` & `CHIEF_WARDEN`: `VIEW_FEES`, `COLLECT_FEES`, `EXPORT_FEE_DATA`, `SYNC_FEES`. Cannot alter bank accounts or delete audit history.
   - `MAINTENANCE_STAFF`: HTTP 403 forbidden for all financial endpoints.
3. **No Frontend Trust**:
   - Dues, balances, and payable amounts are ALWAYS re-queried and validated from PostgreSQL.
   - Bank accounts are checked for existence and `ACTIVE` status.
   - Duplicate payment references (UPI reference, Cheque number, SBI Collect ID) are checked and rejected.

---

## 7. Realtime Synchronization
- REST request enters -> PostgreSQL interactive transaction executes -> Transaction commits -> SSE event is broadcasted via `complaintEventsService`.
- Events:
  - `FEE_STRUCTURE_UPDATED`
  - `FEE_ITEM_CREATED` / `FEE_ITEM_UPDATED`
  - `FEE_PAYMENT_CREATED` / `FEE_REFUND_CREATED`
  - `SCHOLARSHIP_UPDATED`
  - `DETENTION_UPDATED`
  - `ACADEMIC_YEAR_UPDATED`
  - `BANK_ACCOUNT_UPDATED`
  - `INSTITUTION_SETTINGS_UPDATED`
  - `FEE_COLLECTION_STATS_UPDATED`
- Frontend subscribes via EventSource. On reconnect, stale UI state is reconciled with a background refetch.

---

## 8. Frontend UI/UX Architecture
1. **Branding & Design System**:
   - Navy primary headers (`#1e293b`, `#0f172a`), clean white workspace (`#ffffff`, `#f8fafc`), rounded cards, crisp status badges.
   - No CampusStay branding; strictly uses HMS branding (`APP_BRANDING`).
2. **Fee Management Page (`/management/fee-management`)**:
   - Dynamic KPI metric cards at top with real PostgreSQL figures.
   - Tab switching:
     1. Fee Structures (with All/Hostel/College filters, search, add/edit modals)
     2. Bank Accounts (grid of accounts with status pills, copy IFSC, edit/toggle modals)
     3. Academic Years (table with start/end dates, active status, add modal)
     4. Scholarships (student search, sanctioned/applied amounts, approve/apply workflows)
     5. Detentions (detention records, progression modal, academic standing indicators)
     6. Institution Settings (unified mode toggles, module switches, instant save)
   - Navigation card: "Student accounts live in Fee Collection" linking to `/management/fee-collection`.
3. **Fee Collection Page (`/management/fee-collection`)**:
   - Header with search, academic year selector, action buttons (Filter, Add Extra Fee, Promote, Detain, Sync Fee Items, Notifications, Export/Import Excel).
   - Student fee table with expandable breakdown (Fee Type, Total Fee, Paid, Due, Excess Paid, Refund, Paid %, Status, Actions).
   - Responsive design: Converts to cards on mobile (<768px).
   - Payment Modal: Dynamic fields based on UPI, Cheque, SBI Collect, BankAccount selector, validation, atomic submission.
   - Receipt Modal: Printable receipt with receipt number `R-YYYYMMDD-XXXX`, details, print styling.
   - Extra Fee Modal: Biometric attendance integration option with date range & working days.
   - Promotion & Detention Modals: Academic year progression and detention handling.

---

## 9. Migration & Seeding Strategy
1. **Schema Migration**:
   - Add new models in `backend/prisma/schema.prisma`.
   - Execute `npx prisma db push` to synchronize PostgreSQL 18.6 schema without dropping existing data.
   - Regenerate Prisma Client: `npx prisma generate`.
2. **Deterministic Seed Data**:
   - Seed baseline `AcademicYear` ("2026-2027", "2025-2026").
   - Seed standard `BankAccount` records (Hostel accounts, Tuition account, Special fee account).
   - Seed representative `FeeStructure` records (Hostel Mess, Room Rent, College Tuition, Special Fee).
   - Seed default `InstitutionSettings`.
   - Seed standard `ScholarshipType` ("JVD - Jagananna Vidya Deevena", "Merit Concession").
   - Synchronize fee items for existing student accounts so the fee collection dashboard has realistic, authoritative records to interact with immediately.

---

## 10. Testing & Verification Strategy
1. **Automated Backend Regression Suite**:
   - Build `backend/test-fee-management-collection-api.cjs` covering:
     - Auth & RBAC enforcement (401 unauthenticated, 403 student/maintenance staff, 200 admin).
     - Academic year CRUD & date range validation.
     - Fee structure CRUD, deactivation, and applicability.
     - Bank account CRUD, active status check.
     - Scholarship assignment, approval, and transactional fee application (with excess capping).
     - Detention creation & progression rules.
     - Fee item synchronization & idempotency.
     - Payment processing: Full & partial payments, UPI, Cheque, SBI Collect, duplicate prevention, inactive account rejection.
     - Receipt generation & immutability.
     - Refund workflow & excess limits.
     - Biometric attendance extra fee calculation.
     - Bulk Excel import validation & transaction safety.
     - Realtime SSE event emission after commit.
   - Integrate into `backend/run-all-regressions.cjs` and verify all existing 399 tests plus new tests pass (100% pass rate).
2. **Compilation & Build Validation**:
   - `npm run build` in both `backend` and `frontend`.
   - `npx tsc --noEmit` clean in both folders.
3. **End-to-End Real Browser Verification**:
   - Admin login.
   - Fee Management tabs inspection.
   - Creation of fee structures and bank accounts.
   - Fee Collection operations: search, payment collection (UPI, Cheque, SBI Collect), receipt inspection, printing view, refund, extra fee, promotion.
   - Responsive verification at 320px, 375px, 768px, 1024px, 1440px.
   - Realtime multi-tab synchronization check.
