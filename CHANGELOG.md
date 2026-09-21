# CHANGELOG & RELEASE NOTES

All notable changes to the Hostel Management System (HMS) application are documented in this file.

---

## 📌 Current Active Version: `v1.1.0`

**Status**: Active Production Version  
**Release Date**: September 21, 2026  
**Repositories Updated**: Root (`hms-root`), Frontend (`hms-frontend`), Backend (`hms-backend`)

---

## 🚀 Release History

### [v1.1.0] - 2026-09-21 (Current Active Version)

#### 🐞 Critical Fixes & Performance Enhancements
- **Resolved Infinite Request Loop**: Eliminated non-stop `/api/management/events-stream` and `/api/management/dashboard` backend requests caused by cyclic React re-render loops.
- **Parent-Child Callback Optimization**: Memoized handlers (`onRefreshStateChange`, `registerRefreshHandler`, `onModuleNotice`) in `App.tsx` (`AuthenticatedManagementApp`) using `React.useCallback`.
- **SSE Stream Stabilization**: Refactored SSE subscriptions across all management pages (`ManagementDashboardPage`, `MessManagementPage`, `RoomManagementPage`, `ManagementLeavesPage`, `ManagementComplaintsPage`, `ManagementUserManagementPage`, `ManagementLogHistoryPage`, `ManagementOutingLogHistoryPage`, `ManagementNotificationsPage`, `OutingApprovalsPage`, `FeeCollectionPage`, `FeeManagementPage`) using `useRef` to maintain persistent SSE connections without tearing down and reconnecting during filter changes or tab switches.
- **Fixed Unauthenticated / Invalid SSE Endpoints**: Replaced raw `EventSource` calls missing auth token query parameters or targeting invalid endpoints with `managementApiService.subscribeToEvents(...)`.
- **Unified Login Integration**: Integrated `UnifiedLoginPage.tsx` supporting multi-role authentication (Student, Warden, Chief Warden, Admin, Management).
- **College Multi-Tenancy**: Added institutional scoping endpoints (`college.routes.ts`, `college.service.ts`) and dynamic branding support.

---

### [v1.0.0] - 2026-09-01 (Initial Base Release)

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
11. **Fee Management & Fee Collection (Step 11)**: Fee structure definition, bank account setup, student fee collection, payment receipts, and fine adjustments.

#### 🎓 Student Portal Features
- **Hostel Application & Status**: Student registration, admission criteria check, and hostel room booking.
- **Mess Tokens & QR Code**: Digital mess token booking, static/dynamic QR code generation, and meal history inspection.
- **Outing Passes & Gate Transit**: Outing request submission, approval tracking, and QR pass generation.
- **Complaints & Maintenance**: Maintenance issue reporting, repair status timeline, and feedback rating.
- **Leaves & Notices**: Leave application filing and institutional announcements / notifications center.

#### 🛠️ Core Technology Stack
- **Frontend**: React 19, TypeScript, Lucide React icons, Vite build system.
- **Backend**: Express.js, TypeScript, Prisma ORM, PostgreSQL database, JWT authentication, Bcrypt password hashing.
- **Realtime Infrastructure**: Server-Sent Events (SSE) for instant cross-portal updates.

---

## 📋 Version Summary Table

| Version | Release Date | Key Focus | Status |
| :--- | :--- | :--- | :--- |
| **`v1.1.0`** | **2026-09-21** | **SSE Stream Stabilization, Callback Optimization, Bugfixes & Unified Login** | **🟢 ACTIVE / CURRENT** |
| `v1.0.0` | 2026-09-01 | Full Functional Release (Steps 1 to 11 Management & Student Portals) | 🟡 Superceded by v1.1.0 |
