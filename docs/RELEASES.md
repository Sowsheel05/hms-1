# HOSTEL MANAGEMENT SYSTEM (HMS) — VERSION & RELEASE HISTORY

This document maintains the authoritative version ledger and release details for the Hostel Management System (HMS).

---

## 🟢 CURRENT VERSION: `v1.1.0` (Active Production Version)

- **Version Number**: `1.1.0`
- **Release Status**: **🟢 Active Production**
- **Release Date**: September 21, 2026
- **Repositories**: `hms-root`, `hms-frontend`, `hms-backend`

---

## 📜 Complete Version History & Changelog

### 🟢 `v1.1.0` — Performance Optimization & SSE Stream Stabilization (Current Version)
**Release Date**: September 21, 2026

#### Key Features & Technical Deliverables:
- **Infinite Request Loop Resolution**: Eliminated continuous `/api/management/events-stream` and `/api/management/dashboard` backend API request flooding caused by un-memoized inline callbacks.
- **Parent-Child Callback Memoization**: Optimized `App.tsx` (`AuthenticatedManagementApp`) with `useCallback` for `handleModuleNotice`, `handleRefreshStateChange`, and `handleRegisterRefreshHandler`.
- **Single-Handshake SSE Stream**: Refactored SSE subscriptions across all 12 management pages using `useRef` to maintain persistent, single-handshake Server-Sent Events (SSE) connections without tearing down/reconnecting during tab or filter state updates.
- **Unauthenticated SSE Endpoint Fix**: Fixed raw `EventSource` instantiations in `FeeCollectionPage`, `FeeManagementPage`, `OutingApprovalsPage`, `ManagementNotificationsPage`, and `ManagementOutingLogHistoryPage` to use authenticated `managementApiService.subscribeToEvents(...)`.
- **Pre-login Registration & Room Allocation**: Enhanced pre-login student admissions workflow with auto-eligibility criteria checks and bed allocation.
- **Mess Attendance Roster**: Enhanced mess roster visualization, fixed outing modal scroll alignment, and clean auth storage logout cleanup.

---

### 🔵 `v1.0.0` — Admin & Management Portal 10-Step Consolidation
**Release Date**: September 15, 2026

#### Step-by-Step Management Modules Introduced:
- **Step 1: Admin Dashboard Metrics (`v1.0.0-step1`)**
  - Operational KPI cards (Residents, Bed Occupancy, Outing Transit, Pending Requests).
  - Attention metrics, recent activity feeds, and real-time biometric event streams.
- **Step 2: Block Management (`v1.0.0-step2`)**
  - Block configuration, floor mapping, capacity tracking, and dependency-checked safe deletion.
- **Step 3: Room Management & Allocation (`v1.0.0-step3`)**
  - Room inventory, bed occupancy tracking, auto-allocation algorithms, room switching/reallocation, and vacate workflows.
- **Step 4: Mess Management & 4-Way Indent Reporting (`v1.0.0-step4`)**
  - Meal configuration, mess token verification, indent planning, manual & biometric attendance, and 4-way CSV export reporting.
- **Step 5: Outing Approvals & Gate Movements (`v1.0.0-step5`)**
  - Resident outing request approval hierarchy, gate exit/entry timestamps, and biometric hardware correlation.
- **Step 6: Leaves & Suspension Management (`v1.0.0-step6`)**
  - Student leave authorization, campus absence logs, and disciplinary suspension issuance.
- **Step 7: Maintenance Complaints Operations (`v1.0.0-step7`)**
  - Ticket lifecycle tracking, technician assignment, work order updates, and resolution confirmation.
- **Step 8: Guest Visit Tracking & Billing (`v1.0.0-step8`)**
  - Guest check-in/checkout records, host student mapping, itemized room & amenity billing, and payment processing.
- **Step 9: System Audit & Log History (`v1.0.0-step9`)**
  - Comprehensive administrative audit trail, gate transit history, and security traceability.
- **Step 10: User Management & Role Hierarchy (`v1.0.0-step10`)**
  - User account provisioning, role assignment (Warden, Chief Warden, Accountant, Admin), credential resets, and security access control.

---

### 🟣 `v0.8.0` — Fee Management & Fee Collection Engine
**Release Date**: August 28, 2026

#### Features Delivered:
- **Fee Structures**: Institutional fee category definition, academic year mapping, scholarship deductions, and fine calculation.
- **Fee Collection**: Student fee due lookup, payment recording, bank account selection, itemized receipts, and CSV data exports.

---

### 🟡 `v0.5.0` — Student Portal Hardening & QR Token Ecosystem
**Release Date**: August 10, 2026

#### Features Delivered:
- **Digital Mess Tokens**: Token booking system, meal verification, static QR embeds, and dynamic countdown timers.
- **Student Requests**: Outing request submission, leave filing, and maintenance complaint tracking.
- **Student Hostel Application**: Admission status check, hostel application submission, and room allocation confirmation.

---

### ⚪ `v0.1.0` — Core Architecture & Database Setup
**Release Date**: July 15, 2026

#### Core Infrastructure:
- Prisma ORM schema design with PostgreSQL database.
- Express.js REST API with JWT authentication and Bcrypt password security.
- React + TypeScript + Vite frontend project setup with modern CSS styling system.

---

## 📊 Summary of Application Versions

| Version Tag | Release Date | Key Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **`v1.1.0`** | **2026-09-21** | **SSE Stream Stabilization, Callback Optimization & Bugfixes** | **🟢 ACTIVE (Current)** |
| `v1.0.0` | 2026-09-15 | Admin & Management Portal Steps 1 – 10 Consolidation | 🟡 Archived (V1 Base) |
| `v0.8.0` | 2026-08-28 | Fee Structure & Student Fee Collection Engine | 🟡 Archived |
| `v0.5.0` | 2026-08-10 | Student Portal Workflow, Mess QR Tokens & Hardening | 🟡 Archived |
| `v0.1.0` | 2026-07-15 | Core Database Schema, Express Backend & Vite Frontend | 🟡 Archived |
