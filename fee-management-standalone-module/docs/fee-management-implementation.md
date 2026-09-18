# Fee Management & Fee Collection Implementation Documentation

## Overview

This document describes the complete architecture, database schema, transaction boundaries, validation rules, API endpoints, RBAC, realtime SSE synchronization, and testing strategy for the **Fee Management** and **Fee Collection** modules implemented in the Hostel Management System (HMS) Admin Portal.

---

## 1. System Architecture

The Fee subsystem integrates directly into the existing HMS Admin Portal infrastructure:
- **Client**: React 18 / TypeScript / Vite with Vanilla CSS design tokens (`FeeModules.css`), responsive layout, and SSE auto-reconciliation.
- **Server**: Express.js / TypeScript with Prisma ORM, role-based access control (`managementAuthMiddleware`), input validation, and audit logging.
- **Authoritative Database**: PostgreSQL 18.6 with Decimal/NUMERIC monetary storage, foreign key constraints, indexes, and ACID transaction boundaries.
- **Realtime**: Server-Sent Events (SSE) emitting domain events strictly **after** PostgreSQL transaction commit (`emitFeeEvent`).

```
[ Admin Portal UI ]
        │
        │ HTTP (REST + JSON) / SSE (EventSource)
        ▼
[ Management Auth Middleware ] (ADMIN role, RBAC capability checks)
        │
        ▼
[ Fee Management & Collection Routes & Controllers ]
        │
        ▼
[ Authoritative Service Layer (Decimal math, validation, duplicate protection) ]
        │
        ▼
[ PostgreSQL 18.6 Transaction (BEGIN ... COMMIT / ROLLBACK) ]
        │
        ├── FeePayment, PaymentAllocation, FeeReceipt, FeeRefund, FeeItem
        └── ActivityLog (Comprehensive audit record)
        │
        ▼ (After Commit)
[ SSE Broadcast: FEE_PAYMENT_CREATED, etc. ] ──► [ Connected Admin Clients ]
```

---

## 2. Authoritative Database Schema (PostgreSQL via Prisma)

13 normalized models were added to `backend/prisma/schema.prisma`:

1. **`AcademicYear`**
   - `id`, `name` (e.g., `2026-2027`), `code` (`2026-27`), `startDate`, `endDate`, `isCurrent`, `isArchived`, `createdBy`, `updatedBy`.
   - Constraints: unique `name` and `code`.
2. **`FeeStructure`**
   - `id`, `academicYearId`, `module` (`HOSTEL` | `COLLEGE`), `category`, `feeKind`, `name`, `amount` (Decimal), `applicabilityCriteria` (JSON), `isActive`, `effectiveDate`.
   - Constraints: unique compound `[academicYearId, module, category, feeKind]`.
3. **`BankAccount`**
   - `id`, `name`, `accountIdentifier` (e.g. `TUITION-001`), `bankName`, `accountNumber`, `ifsc`, `kind`, `module`, `displayLabel`, `isActive`.
   - Constraints: unique `accountIdentifier` and `accountNumber`.
4. **`ScholarshipType`**
   - `id`, `name`, `code`, `provider`, `defaultAmount`, `criteria`, `isActive`.
5. **`StudentScholarship`**
   - `id`, `studentId`, `scholarshipTypeId`, `academicYearId`, `sanctionedAmount`, `appliedAmount`, `remainingAmount`, `referenceNumber`, `remarks`, `status` (`ASSIGNED` | `APPROVED` | `APPLIED` | `CLOSED`), `approvedBy`.
6. **`Detention`**
   - `id`, `studentId`, `academicYearId`, `targetYearOfStudy`, `holdYearOfStudy`, `reason`, `status` (`ACTIVE` | `REVOKED` | `RESOLVED`), `detainedBy`.
7. **`InstitutionSettings`**
   - `id`, `mode` (`HOSTEL_ONLY` | `COLLEGE_ONLY` | `UNIFIED`), `institutionName`, `institutionCode`, `enableScholarships`, `enableDetentions`, `enableBulkExcel`, `updatedBy`.
8. **`FeeItem`**
   - `id`, `studentId`, `academicYearId`, `feeStructureId`, `module`, `feeType`, `amount` (Decimal), `dueDate`, `status` (`UNPAID` | `PARTIAL` | `PAID` | `OVERPAID`), `remarks`.
9. **`FeePayment`**
   - `id`, `studentId`, `academicYearId`, `amount` (Decimal), `paymentMethod` (`UPI` | `CHEQUE` | `SBI_COLLECT` | `CASH` | `BANK_TRANSFER`), `bankAccountId`, `upiApp`, `upiReference`, `chequeNumber`, `bankName`, `receivedBy`, `sbiCollectReference`, `verifiedBy`, `status` (`COMPLETED` | `REVERSED` | `REFUNDED`), `collectedBy`.
   - Constraints: unique references for `upiReference`, `chequeNumber`, and `sbiCollectReference`.
10. **`PaymentAllocation`**
    - `id`, `feePaymentId`, `feeItemId`, `amount` (Decimal).
11. **`FeeReceipt`**
    - `id`, `receiptNumber` (`R-YYYYMMDD-XXXX`), `feePaymentId`, `studentId`, `academicYearId`, `amount`, `paymentMethod`, `transactionRef`, `bankAccountId`, `issuedBy`, `issuedAt`.
    - Constraints: unique `receiptNumber` and `feePaymentId`.
12. **`FeeRefund`**
    - `id`, `feePaymentId`, `studentId`, `amount`, `reason`, `processedBy`, `createdAt`.
13. **`FeeImportBatch`**
    - `id`, `fileName`, `fileSize`, `totalRows`, `successRows`, `failedRows`, `errors` (JSON), `importedBy`.

---

## 3. Financial Calculation & Validation Rules

1. **Monetary Precision**: All currency operations utilize PostgreSQL `Decimal` types.
2. **Authoritative Due Calculation**:
   $$\text{due} = \max(\text{totalFee} - \text{paidAmount} - \text{concessions}, 0)$$
3. **Excess Payment & Refund Eligibility**:
   $$\text{excessPaid} = \max(\text{paidAmount} + \text{concessions} - \text{totalFee}, 0)$$
   $$\text{eligibleRefund} = \min(\text{payment.amount} - \text{priorRefunds}, \text{studentExcessPaid})$$
4. **Idempotent Synchronization**:
   - `POST /api/management/fee-collection/sync-fees` synchronizes fee structures to eligible students based on year, program, and room type without duplicating existing items or altering previously recorded payments.
5. **Biometric Attendance Assessment**:
   - For mess dining adjustments, working days and daily rates are evaluated server-side to calculate authoritative charge adjustments.

---

## 4. Payment Processing & Transaction Boundaries

Every payment follows strict ACID transaction boundaries in `prisma.$transaction`:

```
BEGIN
  1. Authenticate & Authorize Staff (ADMIN/MANAGEMENT role).
  2. Verify Student exists and is active.
  3. Verify BankAccount exists and isActive = true.
  4. Validate payment amount > 0.
  5. Validate duplicate references (UPI ref / Cheque No / SBI Collect ref).
  6. Fetch authoritative student fee items and current dues.
  7. Prevent unallocated overpayment unless explicitly configured.
  8. Create FeePayment record.
  9. Create PaymentAllocation records across fee items.
 10. Update FeeItem status (UNPAID -> PARTIAL -> PAID).
 11. Generate immutable unique receipt number (R-YYYYMMDD-XXXX).
 12. Create FeeReceipt record.
 13. Create ActivityLog audit entry.
COMMIT
  14. Emit realtime SSE event: FEE_PAYMENT_CREATED.
```

If any step fails, the entire transaction is rolled back with zero orphaned allocations or phantom receipts.

---

## 5. API Endpoints Reference

### Fee Management (`/api/management/fee-management/*`)
- `GET /kpi-stats` - Aggregate KPI metrics (total structures, hostel dues, college dues, students with dues, scholarships, detentions).
- `GET /academic-years` - Retrieve academic years.
- `POST /academic-years` - Create academic year.
- `GET /structures` - List fee structures.
- `POST /structures` - Create fee structure.
- `PUT /structures/:id` - Update fee structure.
- `PATCH /structures/:id/deactivate` - Soft-deactivate fee structure.
- `GET /bank-accounts` - List bank accounts.
- `POST /bank-accounts` - Create bank account.
- `PUT /bank-accounts/:id` - Update bank account.
- `PATCH /bank-accounts/:id/toggle-status` - Activate/deactivate bank account.
- `GET /scholarships` - List student scholarships.
- `POST /scholarships` - Assign scholarship to student.
- `PATCH /scholarships/:id/status` - Update status (`APPROVED`, `APPLIED`, `CLOSED`).
- `GET /detentions` - List academic detentions.
- `POST /detentions` - Record academic detention.
- `PATCH /detentions/:id/status` - Update detention status.
- `GET /institution-settings` - Get active institution settings.
- `PUT /institution-settings` - Update institution settings.

### Fee Collection (`/api/management/fee-collection/*`)
- `GET /students` - Server-side paginated, searchable, filtered student fee list.
- `POST /payments` - Process transactional payment (UPI, Cheque, SBI Collect) and generate receipt.
- `GET /students/:studentId/payments` - Retrieve payment transaction history.
- `POST /payments/:paymentId/refund` - Process validated refund with immutable audit trail.
- `POST /extra-fee` - Assess extra fee / fine (with optional biometric attendance calculation).
- `POST /promote` - Academic semester / year progression.
- `POST /sync-fees` - Idempotent fee structure synchronization.
- `GET /export-excel` - Export full student fee register as XLSX.
- `POST /import-excel` - Validate and import fee dues with row-level validation and error reporting.
- `POST /bulk-adjust` - Apply bulk fine or discount across students.

---

## 6. Realtime Architecture & Events

The realtime event service (`events.service.ts`) dispatches typed domain events over Server-Sent Events (SSE):
- `FEE_STRUCTURE_UPDATED`
- `FEE_ITEM_CREATED` / `FEE_ITEM_UPDATED`
- `FEE_PAYMENT_CREATED` / `FEE_PAYMENT_UPDATED`
- `FEE_REFUND_CREATED`
- `SCHOLARSHIP_UPDATED`
- `DETENTION_UPDATED`
- `ACADEMIC_YEAR_UPDATED`
- `BANK_ACCOUNT_UPDATED`
- `INSTITUTION_SETTINGS_UPDATED`
- `FEE_COLLECTION_STATS_UPDATED`

On reconnect, the client automatically reconciles state directly from PostgreSQL.

---

## 7. Testing & Verification Summary

### Automated Regression
- Total Suites: 22 (21 existing + 1 dedicated fee suite `test-fee-management-collection-api.cjs`).
- Total Tests: **416 / 416 PASS**.
- Coverage includes: RBAC unauthorized/authorized access, duplicate reference rejection, payment transaction rollback, receipt uniqueness, refund restrictions, biometric attendance calculation, academic promotion, sync idempotency, and XLSX export.

### Browser Verification
- Verified on Chrome via browser subagent:
  - Admin login (`ADMIN01` / `Password@123`).
  - Fee Management: 6 KPI cards, Fee Structures tab, Bank Accounts tab, Academic Years tab, Scholarships tab, Detentions tab, Institution Settings tab.
  - Fee Collection: Itemized breakdown, UPI payment collection (₹2,500 via PhonePe), unique receipt generation (`R-20260910-3789`), payment history display, and extra fee assessment (₹500 penalty).
  - Mobile responsiveness: 390x844 viewport verified with zero horizontal overflow.
