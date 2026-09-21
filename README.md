# 🏫 Hostel Management System (HMS)

**Authoritative Multi-Portal Student & Management Hostel Platform**

[![Version](https://img.shields.io/badge/version-1.1.0-blue.svg)](file:///c:/Users/SOWSHEEL/OneDrive/Desktop/hmsv2/hms/hms/CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-active--production-green.svg)](file:///c:/Users/SOWSHEEL/OneDrive/Desktop/hmsv2/hms/hms/docs/RELEASES.md)

---

## 📌 Current Active Version: `v1.1.0`

Detailed release notes and historical version documentation can be found in:
- 📖 [CHANGELOG.md](file:///c:/Users/SOWSHEEL/OneDrive/Desktop/hmsv2/hms/hms/CHANGELOG.md)
- 🚀 [RELEASES.md](file:///c:/Users/SOWSHEEL/OneDrive/Desktop/hmsv2/hms/hms/docs/RELEASES.md)

---

## 🚀 Key Features Overview

### 🏢 Management & Administration Portal (`/management/*`)
- **Admin Dashboard (Step 1)**: Key operational KPIs, attention metrics, recent activity feeds, and real-time biometric event streams.
- **Block Management (Step 2)**: Block creation, floor mapping, capacity tracking, and safety check deletions.
- **Room Management & Bed Allocation (Step 3)**: Bed occupancy tracking, auto-allocation, student reallocation, and vacate workflows.
- **Mess Management & Indent Planning (Step 4)**: Meal menu configuration, token verification, indent planning, attendance marking, and 4-way CSV reports.
- **Outing Approvals & Gate Transit (Step 5)**: Resident pass approvals, physical gate exit/entry timestamps, and biometric hardware correlation.
- **Leaves & Disciplinary Suspension (Step 6)**: Leave authorizations, campus absence tracking, and suspension management.
- **Maintenance Complaints Operations (Step 7)**: Ticket lifecycles, technician assignment, work order updates, and resolution confirmation.
- **Guest Visits & Billing (Step 8)**: Guest check-in/checkout, host student mapping, itemized billing, and payment processing.
- **System Audit & Log History (Step 9)**: Administrative audit logging, gate movement history, and security traceability.
- **User Management & Role Hierarchy (Step 10)**: Account administration, role assignment (Warden, Chief Warden, Accountant, Admin), credential resets, and account controls.
- **Fee Management & Collection (Step 11)**: Fee structure configuration, bank account setup, student fee collection, receipts, and fine management.

### 🎓 Student Portal (`/dashboard`, `/mess-tokens`, `/outing-requests`, etc.)
- **Pre-Login Admission & Registration**: Student registration, admission criteria check, and hostel room booking.
- **Digital Mess Tokens & QR**: Token booking, static/dynamic QR code generation, and meal history.
- **Outing Requests & Passes**: Request submission, approval tracking, and QR pass generation for gate transit.
- **Complaints & Leaves**: Complaint submission, repair progress timeline, and leave applications.

---

## 🛠️ Technology Stack & Architecture

- **Frontend**: React 19, TypeScript, Vite, Lucide React icons, Vanilla CSS design system.
- **Backend**: Express.js, TypeScript, Prisma ORM, PostgreSQL database, JWT authentication, Bcrypt password hashing.
- **Real-Time Data Sync**: Server-Sent Events (SSE) via `/api/management/events-stream` & `/api/student/events`.

---

## 💻 Quickstart Commands

### 1. Install Dependencies
```bash
# In backend
cd backend && npm install

# In frontend
cd ../frontend && npm install
```

### 2. Database Migration & Seed
```bash
cd backend
npm run prisma:push
npm run prisma:seed
```

### 3. Run Development Server
```bash
# Run backend dev server (Port 5001)
cd backend && npm run dev

# Run frontend dev server (Port 5173)
cd frontend && npm run dev
```

---

## 📋 Release Summary

| Version | Release Date | Status | Description |
| :--- | :--- | :--- | :--- |
| **`v1.1.0`** | **2026-09-21** | **🟢 ACTIVE** | **SSE Stream Stabilization, Callback Optimization, Bugfixes & Unified Login** |
| `v1.0.0` | 2026-09-15 | 🟡 Base Release | Admin Portal Steps 1–10 & Full Student Portal Consolidation |
| `v0.8.0` | 2026-08-28 | 🟡 Archived | Fee Management & Student Fee Collection Engine |
| `v0.5.0` | 2026-08-10 | 🟡 Archived | Student Portal Workflows & Digital Mess QR Ecosystem |
| `v0.1.0` | 2026-07-15 | 🟡 Archived | PostgreSQL + Prisma Schema, Express API & Vite Setup |