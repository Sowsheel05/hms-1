# HMS — Mess Indent, Attendance & Four-Way Reporting Implementation

## Executive Summary

This document describes the complete **Mess Indent → Mess Attendance → Consumption Reconciliation → Four-Way Reports → Export** workflow implemented into the Hostel Management System (HMS).

The architecture maintains strict independence between **Mess Indent** (`MARKED` / `NOT_MARKED`) and **Mess Attendance** (`PENDING` / `ATE` / `DID_NOT_EAT`), ensuring that students who eat without an indent, or who indent but fail to consume, are correctly tracked, reconciled, and audited for hostel mess management and kitchen inventory control.

---

## 1. Business Logic & Four-Way Reconciliation Model

Every eligible student for a given date and meal type is classified into an authoritative state:

### Independent State Machine
1. **Indent Status**:
   - `MARKED`: Student explicitly registered an indent for the meal.
   - `NOT_MARKED`: No indent record submitted.
2. **Attendance Status**:
   - `PENDING`: Meal session is in progress or unmarked by operator.
   - `ATE`: Student physically presented at the mess and consumed the meal.
   - `DID_NOT_EAT`: Student did not consume the meal.

> [!IMPORTANT]
> A missing indent does NOT block attendance marking. Likewise, marking an indent does NOT automatically mark attendance. An unmarked attendance record is classified as `PENDING` and is **strictly excluded** from finalized four-way reports to avoid false reporting.

### Four-Way Classification Matrix
For finalized records (`attendanceStatus` in `[ATE, DID_NOT_EAT]`):

| Category | Technical Key | Display Title | Indent | Attendance | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Category 1** | `INDENTED_ATE` | **Indented & Consumed** | `MARKED` | `ATE` | Student planned and consumed their meal. |
| **Category 2** | `NO_INDENT_ATE` | **Unindented & Consumed** | `NOT_MARKED` | `ATE` | Student consumed without a prior indent. |
| **Category 3** | `INDENTED_NOT_ATE` | **Indented & Not Consumed** | `MARKED` | `DID_NOT_EAT` | Wasted/unused meal indent. Critical for kitchen food wastage auditing. |
| **Category 4** | `NO_INDENT_NOT_ATE` | **Unindented & Not Consumed** | `NOT_MARKED` | `DID_NOT_EAT` | Student neither planned nor ate. |

### Mathematical Balance Invariant
For any cohort scope (Hostel / Block / Meal / Date):
$$\text{Total Eligible Students} = \text{Cat 1} + \text{Cat 2} + \text{Cat 3} + \text{Cat 4} + \text{Attendance Pending}$$

---

## 2. Database Schema (PostgreSQL & Prisma)

Two new models with strict uniqueness constraints and optimized indexing were introduced to `backend/prisma/schema.prisma`:

### `MessIndent`
```prisma
model MessIndent {
  id        String   @id @default(uuid())
  studentId String
  date      String   // ISO YYYY-MM-DD
  mealType  String   // BREAKFAST | LUNCH | SNACKS | DINNER
  status    String   @default("MARKED") // MARKED | NOT_MARKED
  markedAt  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date, mealType])
  @@index([date, mealType])
  @@index([studentId, date])
}
```

### `MessAttendance`
```prisma
model MessAttendance {
  id        String   @id @default(uuid())
  studentId String
  date      String   // ISO YYYY-MM-DD
  mealType  String   // BREAKFAST | LUNCH | SNACKS | DINNER
  status    String   // ATE | DID_NOT_EAT | PENDING
  markedAt  DateTime @default(now())
  markedBy  String?  // Staff/Admin username or scanner identity
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  student Student @relation(fields: [studentId], references: [id], onDelete: Cascade)

  @@unique([studentId, date, mealType])
  @@index([date, mealType])
  @@index([studentId, date])
}
```

---

## 3. Backend APIs Added & Modified

### Student Portal Endpoints (`backend/src/routes/mess.routes.ts`)
- `POST /api/student/mess/indent`: Create or update meal indent (`MARKED`). Prevents suspended students from indenting.
- `GET /api/student/mess/indent`: Retrieve current student's indent status for given date and meal type.
- `GET /api/student/mess-tokens`: Extended to return `indent: { id, status, markedAt, createdAt }` on every daily meal slot.
- `POST /api/student/mess-tokens/lock`: Automatically upserts synchronized `MessIndent` record in an atomic PostgreSQL transaction.

### Management & Mess Operator Endpoints (`backend/src/routes/mess-management.routes.ts`)
- `GET /api/management/mess/attendance-marking`: Lists ALL eligible active students with indent status, attendance state, room/block metadata, and summary counts.
- `POST /api/management/mess/attendance`: Mark individual student attendance (`ATE` or `DID_NOT_EAT`). Synchronizes with `MessToken` if consumed, records `markedBy`, triggers real-time SSE dispatch, and appends to `ActivityLog`.
- `PATCH /api/management/mess/attendance/:id`: Correct or reset attendance state (`ATE`, `DID_NOT_EAT`, or `PENDING`).
- `GET /api/management/mess/reports/summary`: Authoritative four-way reconciliation counts including Total Students, Indented & Ate, No Indent & Ate, Indented & Not Eat, No Indent & Not Eat, and Attendance Pending.
- `GET /api/management/mess/reports/data`: Paginated student records classified by category (`INDENTED_ATE`, `NO_INDENT_ATE`, `INDENTED_NOT_ATE`, `NO_INDENT_NOT_ATE`, `PENDING`, or `ALL`).
- `GET /api/management/mess/reports/indented-ate`: Alias for Category 1.
- `GET /api/management/mess/reports/no-indent-ate`: Alias for Category 2.
- `GET /api/management/mess/reports/indented-not-ate`: Alias for Category 3.
- `GET /api/management/mess/reports/no-indent-not-ate`: Alias for Category 4.
- `GET /api/management/mess/reports/export`: Filtered dataset export supporting Excel (`.xlsx`) using backend `xlsx` library and CSV streams (`.csv`).

---

## 4. Role-Based Access Control (RBAC)

- **Student**:
  - Can view and mark their own meal indents.
  - Strictly blocked from accessing management attendance or reporting APIs (returns `403 Forbidden`).
- **Warden / Mess Operator**:
  - Can view all eligible students.
  - Can mark and correct student-by-student attendance.
  - Can access four-way reports and trigger exports.
- **Admin**:
  - Full access to attendance marking, report reconciliation, and meal configuration.

---

## 5. UI Implementation

### Student Portal (`frontend/src/pages/MessTokensPage.tsx`)
- Meal cards display authoritative indent status box:
  - `[✓ Indent Marked]` with formatted date and `Marked at: HH:MM AM/PM`.
  - `[✗ Indent Not Marked]` with quick configure action.

### Mess Management Portal (`frontend/src/pages/MessManagementPage.tsx`)
- **Mess Attendance Tab**:
  - Date picker, Meal selector, Block filter, and Student Search.
  - Real-time summary ribbon (Total Eligible, Indent Marked, No Indent, Ate, Did Not Eat, Pending).
  - Student table listing all eligible residents with their indent status, current attendance badge, and quick inline `[ Ate ]` / `[ Did Not Eat ]` action buttons.
  - Correction modal allowing operator to modify or reset attendance to `Pending`.
- **Four-Way Reports Tab**:
  - 6 KPI summary cards matching Phase 9 & 10 requirements.
  - Mathematical integrity banner with balance check formula.
  - Category subnav tabs for Reports 1 through 4, Attendance Pending, and All Finalized Records.
  - Export buttons for **Excel (.xlsx)** and **CSV (.csv)** respecting current filters and maintaining filenames (`mess_<category>_<date>_<meal>.<ext>`).

---

## 6. Automated & Regression Testing

1. **`backend/test-mess-indent-attendance-reports.cjs`**: 21/21 automated tests pass cleanly covering authentication, RBAC, indent creation, meal independence, attendance marking, four-way reconciliation, pending exclusion, corrections, and CSV/XLSX exports.
2. **`backend/test-mess-management-step4-api.cjs`**: 18/18 tests pass covering meal schedules, analytics, indent planning, and scanner logs.
3. **`backend/test-student-mess-workflow.cjs`**: 20/20 tests pass verifying student locking, tokens, and deadline enforcement.
4. **`backend/test-student-portal-e2e-hardening.cjs`**: 34/34 tests pass covering identity, IDOR resistance, and security.
5. **Frontend Production Build**: `tsc -b && vite build` built in 6.70s with 0 errors.
6. **Browser Subagent**: Verified in Chrome desktop and responsive viewports for both Admin and Student roles.
