# CHANGELOG & RELEASE NOTES

All notable changes to the Hostel Management System (HMS) application are documented in this file.

---

## 📌 Current Active Version: `v1.1.0`

**Status**: Active Production Version  
**Release Date**: September 21, 2026  
**Repositories Updated**: Root (`hms-root`), Frontend (`hms-frontend`), Backend (`hms-backend`)

---

## 🚀 Version History & Release Notes

### [v1.1.0] - 2026-09-21 (Current Active Version)

#### 🐞 Critical Fixes & Performance Enhancements
- **Resolved Infinite Backend Request Loop**: Fixed continuous `/api/management/events-stream` and `/api/management/dashboard` API request flooding caused by un-memoized React inline callback props.
- **Parent-Child Callback Optimization**: Memoized handlers (`onRefreshStateChange`, `registerRefreshHandler`, `onModuleNotice`) in `App.tsx` (`AuthenticatedManagementApp`) using `React.useCallback`.
- **SSE Stream Stabilization**: Refactored SSE subscriptions across all 12 management pages using `useRef` to maintain persistent, single-handshake SSE streams without reconnecting on filter/tab changes.
- **Fixed Unauthenticated / Invalid SSE Endpoints**: Replaced raw `EventSource` instantiations in `FeeCollectionPage`, `FeeManagementPage`, `OutingApprovalsPage`, `ManagementNotificationsPage`, and `ManagementOutingLogHistoryPage` with authenticated `managementApiService.subscribeToEvents(...)`.
- **Unified Login Integration**: Multi-role support (`UnifiedLoginPage.tsx`) for Student, Warden, Chief Warden, Accountant, and Admin portals.
- **Pre-Login Admission Workflow**: Enhanced pre-login student registration and hostel allocation with criteria evaluation and room booking.

---

### [v1.0.0] - 2026-09-15 (Admin Portal 10-Step Consolidation)

#### 🏢 Admin & Management Portal Modules
1. **Admin Dashboard (Step 1)**: Operational overview, attention metrics, quick action modules, and real-time biometric event feeds.
2. **Block Management (Step 2)**: Configuration, block allocation, floor mapping, and capacity management.
3. **Room Management & Bed Allocation (Step 3)**: Bed occupancy tracking, room auto-allocation, student reallocation, and vacating workflows.
4. **Mess Management & Indent Planning (Step 4)**: Meal menu configuration, mess token verification, indent planning, attendance marking, and 4-way CSV reporting.
5. **Outing Approvals & Gate Movement (Step 5)**: Outing pass authorization, gate exit/entry confirmation, and biometric correlation.
6. **Leaves & Disciplinary Suspension (Step 6)**: Student leave requests, approval hierarchy, campus absence tracking, and suspension issuance.
7. **Complaints & Maintenance Operations (Step 7)**: Maintenance ticket tracking, technician assignment, repair lifecycle management, and resolution confirmation.
8. **Guest Visits & Billing Management (Step 8)**: Guest check-in/checkout, host student mapping, itemized billing, and payment processing.
9. **Log History & System Audit (Step 9)**: Comprehensive administrative audit logs, gate movement transit history, and security traceability.
10. **User Management & Role Administration (Step 10)**: User account creation, role assignment (Warden, Chief Warden, Accountant, Admin), credential resets, and account disabling/enabling.

---

### [v0.8.0] - 2026-08-28 (Fee Management & Collection)

#### 💰 Fee System Engine
- **Fee Configuration**: Fee structures, institutional bank accounts, academic years, scholarships, and detentions.
- **Fee Collection**: Student fee dues, payment recording, receipt generation, fine adjustments, and CSV exports.

---

### [v0.5.0] - 2026-08-10 (Student Portal & Mess QR Ecosystem)

#### 🎓 Student Portal Workflows
- **Digital Mess Tokens**: Mess token booking, static/dynamic QR code generation, and meal history.
- **Outing Passes**: Outing requests, QR pass generation, and gate exit/entry tracking.
- **Complaints & Leaves**: Complaint submission, repair tracking, and leave application filing.
- **Hostel Applications**: Admission status evaluation and online room booking.

---

### [v0.1.0] - 2026-07-15 (Core Prototype & Database Schema)

#### 🛠️ Core Infrastructure
- Database schema initialization with PostgreSQL & Prisma ORM.
- Express.js backend API with JWT authentication and Bcrypt hashing.
- React + TypeScript + Vite frontend layout and component design system.

---

## 📋 Version Summary Table

| Version | Release Date | Key Deliverable | Status |
| :--- | :--- | :--- | :--- |
| **`v1.1.0`** | **2026-09-21** | **SSE Stream Stabilization, Callback Optimization, Bugfixes & Unified Login** | **🟢 ACTIVE / CURRENT** |
| `v1.0.0` | 2026-09-15 | Full Admin & Management Portal Steps 1–10 Consolidation | 🟡 Archived |
| `v0.8.0` | 2026-08-28 | Fee Structures & Student Fee Collection Engine | 🟡 Archived |
| `v0.5.0` | 2026-08-10 | Student Portal Workflows & Digital Mess QR Ecosystem | 🟡 Archived |
| `v0.1.0` | 2026-07-15 | PostgreSQL + Prisma Schema, Express API & Vite Setup | 🟡 Archived |
