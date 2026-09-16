# HMS (Hostel Management System) — Project Structure Report

> **WARNING:** This file is the authoritative source for understanding the project structure. If you are unfamiliar with this codebase, READ THIS FILE FIRST before attempting to navigate or modify any code.

> **Last Updated:** 2026-09-16
> **Total Files:** 300+ (see breakdown below)
> **Backend Routes:** 25+ route modules
> **Frontend Pages:** 30+ page components

---

## 1. Project Directory Tree

```
hms/
├── .gitignore
├── README.md
├── BUGS.md                          # Bug report — all known issues with severity, file paths, and fixes
├── package.json                     # Root monorepo scripts (dev, build, start)
├── project-structure.md             # THIS FILE — authoritative structure documentation
├── start-dev.mjs                    # Concurrent dev server launcher (backend + frontend)
│
├── backend/
│   ├── .env                         # Environment variables (DATABASE_URL, JWT_SECRET, PORT, etc.)
│   ├── .env.example                 # Template environment file
│   ├── .gitignore
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   │
│   ├── check-hardening-db.cjs       # Database hardening verification script
│   ├── check-postgres-health.cjs    # PostgreSQL health check
│   ├── export-sqlite-data.cjs       # Export legacy SQLite data to JSON
│   ├── import-data-to-postgres.cjs  # Import data from SQLite to PostgreSQL
│   ├── run-all-regressions.cjs      # Master regression test runner (15 suites, 221 tests)
│   ├── verify-step*.cjs             # Step-by-step verification scripts (steps 7-19)
│   ├── seed-test-leave-data.cjs     # Seed test leave data
│   │
│   ├── test-*.cjs                   # Test suites (50+ test files covering all APIs)
│   │   ├── test-auth-api.cjs
│   │   ├── test-dashboard-api.cjs
│   │   ├── test-room-api.cjs
│   │   ├── test-room-allocation-step3-api.cjs
│   │   ├── test-mess-api.cjs
│   │   ├── test-mess-management-step4-api.cjs
│   │   ├── test-mess-indent-attendance-reports.cjs
│   │   ├── test-student-mess-workflow.cjs
│   │   ├── test-student-mess-static-qr.cjs
│   │   ├── test-outing-api.cjs
│   │   ├── test-management-outing-api.cjs
│   │   ├── test-management-outing-log-history.cjs
│   │   ├── test-complaint-api.cjs
│   │   ├── test-complaints-hardening.cjs
│   │   ├── test-admin-complaints-maintenance-step7-api.cjs
│   │   ├── test-leaves-api.cjs
│   │   ├── test-management-leaves-api.cjs
│   │   ├── test-admin-leaves-suspension-step6-api.cjs
│   │   ├── test-notifications-api.cjs
│   │   ├── test-management-notifications.cjs
│   │   ├── test-admin-notifications.cjs
│   │   ├── test-biometric-api.cjs
│   │   ├── test-management-dashboard-api.cjs
│   │   ├── test-management-device-api.cjs
│   │   ├── test-block-management-api.cjs
│   │   ├── test-room-management-api.cjs
│   │   ├── test-management-mess-api.cjs
│   │   ├── test-management-user-management-api.cjs
│   │   ├── test-admin-user-management-step10-api.cjs
│   │   ├── test-admin-portal-identity-api.cjs
│   │   ├── test-admin-guest-billing-step8-api.cjs
│   │   ├── test-admin-log-history-step9-api.cjs
│   │   ├── test-fee-management-collection-api.cjs
│   │   ├── test-fee-hardening-reconciliation.cjs
│   │   ├── test-management-guest-billing-api.cjs
│   │   ├── test-cross-portal-integration.cjs
│   │   ├── test-prelogin-registration-workflow.cjs
│   │   ├── test-student-portal-hardening.cjs
│   │   ├── test-student-portal-e2e-hardening.cjs
│   │   └── ...
│   │
│   ├── prisma/
│   │   ├── dev.db                   # Legacy SQLite (retained as backup)
│   │   ├── dev.db.backup            # Legacy SQLite snapshot backup
│   │   ├── schema.prisma            # Authoritative Prisma schema (PostgreSQL 18.6)
│   │   ├── seed.ts                  # Database seeder script
│   │   ├── sqlite-backup-data.json  # Migrated historical export
│   │   └── migrations/
│   │       ├── 20260908000000_initial_baseline/migration.sql
│   │       └── 20260910000000_step12_room_management/migration.sql
│   │
│   └── src/
│       ├── index.ts                 # Express server entry point & middleware bootstrap
│       │
│       ├── config/
│       │   └── index.ts             # Env vars, JWT config, ports, CORS config
│       │
│       ├── middleware/
│       │   ├── auth.middleware.ts   # Student JWT authentication middleware
│       │   ├── management.middleware.ts # Warden/Management RBAC middleware (WARDEN, CHIEF_WARDEN, ADMIN, HOSTEL_ADMIN, MAINTENANCE_STAFF)
│       │   └── rate-limiter.ts      # In-memory login rate limiting (100 req/15min/IP)
│       │
│       ├── routes/
│       │   ├── auth.routes.ts        # Student auth (register, login, logout, me)
│       │   ├── dashboard.routes.ts   # Student dashboard metrics & SSE events
│       │   ├── room.routes.ts        # Student "My Room" accommodation details
│       │   ├── mess.routes.ts        # Student mess tokens, booking, QR, indent marking
│       │   ├── mess-management.routes.ts # Management mess administration
│       │   ├── outing.routes.ts      # Student outing requests (create, cancel, list)
│       │   ├── complaint.routes.ts   # Student complaints, comments, attachments (multer)
│       │   ├── complaint-management.routes.ts # Management complaint processing
│       │   ├── leave.routes.ts       # Student leaves & admin suspension test helpers
│       │   ├── leave-management.routes.ts # Management leave approval/rejection
│       │   ├── notification.routes.ts # Student notifications (list, read, count)
│       │   ├── admin-notification.routes.ts # Management broadcast notifications
│       │   ├── biometric.routes.ts   # Student biometric overview, events, SSE
│       │   ├── device.routes.ts      # Device management (CRUD, credentials, telemetry)
│       │   ├── block.routes.ts       # Block management CRUD
│       │   ├── room-management.routes.ts # Room CRUD, allocations, capacity
│       │   ├── management.routes.ts   # Management auth, dashboard, SSE, sub-router host
│       │   ├── management.routes.ts  # Sub-routers: blocks, rooms, room-allocations, mess, outings, leaves, suspensions, complaints, guest-billing, log-history, outing-log-history, devices, users, fee-management, fee-collection, notifications, hostel-applications
│       │   ├── fee-management.routes.ts # Fee structure, items, academic years, scholarships
│       │   ├── fee-collection.routes.ts # Fee payment, fines, reconciliation
│       │   ├── guest-billing.routes.ts # Guest visits, check-ins, itemized bills
│       │   ├── log-history.routes.ts  # Activity log, audit trail queries
│       │   ├── outing-log-history.routes.ts # Outing historical records
│       │   ├── user-management.routes.ts # User accounts, roles, credentials
│       │   ├── hostel-application.routes.ts # Student hostel application submission
│       │   └── hostel-application-management.routes.ts # Management application review
│       │
│       └── services/
│           ├── auth.service.ts        # Hashing, token generation, credential verification
│           ├── biometric.service.ts   # Presence calculation, gate correlation, event ingestion
│           ├── events.service.ts       # SSE broker (EventEmitter), domain event dispatch
│           ├── management.service.ts   # Dashboard aggregation, occupancy metrics
│           ├── notification.service.ts # Notification creation, broadcast, stats
│           ├── prisma.service.ts       # PrismaClient singleton
│           ├── storage.service.ts      # Local file upload (JPG/PNG/WebP, magic bytes)
│           ├── audit.service.ts        # Audit log records, metadata sanitization
│           ├── device.service.ts       # Device CRUD, API key rotation, telemetry
│           ├── fee-management.service.ts # Fee structure management
│           ├── fee-collection.service.ts # Fee payment processing
│           ├── device.service.ts       # Biometric device management
│           └── ...
│
├── frontend/
│   ├── index.html                    # SPA HTML template
│   ├── package.json
│   ├── package-lock.json
│   ├── tsconfig.json
│   ├── tsconfig.node.json
│   ├── tsconfig.tsbuildinfo
│   ├── vite.config.ts                # Vite bundler & API proxy config
│   │
│   ├── public/
│   │   └── favicon.svg              # App branding icon
│   │
│   └── src/
│       ├── App.tsx                   # Root layout, student/management portal routing
│       ├── index.css                 # Design tokens, layouts, animations, responsive styles
│       ├── main.tsx                  # React DOM bootstrap
│       │
│       ├── components/
│       │   ├── DashboardHeader.tsx  # Student operational header with live status
│       │   ├── LoginForm.tsx         # Student authentication form
│       │   ├── ManagementHeader.tsx  # Management portal operational header
│       │   ├── ManagementSidebar.tsx # Management sidebar (14 modules)
│       │   ├── Sidebar.tsx           # Student navigation sidebar (8 modules)
│       │   ├── PasswordInput.tsx     # Accessible toggleable password field
│       │   ├── PlaceholderModule.tsx # Locked module placeholder
│       │   └── StaticMessQr.tsx      # Static mess QR display component
│       │
│       ├── config/
│       │   └── branding.ts           # Institutional branding config (app name, colors, etc.)
│       │
│       ├── context/
│       │   ├── AuthContext.tsx       # Student auth state, token, profile
│       │   └── ManagementAuthContext.tsx # Warden/Management auth state, token, RBAC
│       │
│       ├── pages/
│       │   ├── LoginPage.tsx         # Student login screen
│       │   ├── DashboardPage.tsx     # Student operational overview
│       │   ├── MyRoomPage.tsx        # Room, bed, roommate details
│       │   ├── MessTokensPage.tsx    # Meal token booking & QR
│       │   ├── OutingRequestsPage.tsx # Outing pass booking
│       │   ├── ComplaintsPage.tsx    # Ticket submission & comment timeline
│       │   ├── LeavesPage.tsx        # Leave applications & suspension warnings
│       │   ├── NotificationsPage.tsx # In-app notification center
│       │   ├── HostelApplicationPage.tsx # Hostel application status
│       │   ├── StudentRegistrationPage.tsx # New student registration
│       │   ├── ManagementLoginPage.tsx # Warden/Admin login
│       │   ├── ManagementDashboardPage.tsx # Warden operational overview
│       │   ├── BlockManagementPage.tsx # Block configuration & occupancy
│       │   ├── RoomManagementPage.tsx # Room inventory & bed allocation
│       │   ├── MessManagementPage.tsx # Mess token admin & scanner
│       │   ├── OutingApprovalsPage.tsx # Warden outing review & gate monitor
│       │   ├── ManagementLeavesPage.tsx # Management leave approval
│       │   ├── ManagementComplaintsPage.tsx # Management complaint processing
│       │   ├── GuestBillingManagementPage.tsx # Guest visit & billing admin
│       │   ├── ManagementLogHistoryPage.tsx # System log & audit view
│       │   ├── ManagementOutingLogHistoryPage.tsx # Outing log history
│       │   ├── OutingLogHistoryPage.tsx # Student outing history
│       │   ├── FeeManagementPage.tsx # Fee structure & configuration
│       │   ├── FeeCollectionPage.tsx # Fee payment & reconciliation
│       │   ├── ManagementDevicePage.tsx # Device management & turnstile registry
│       │   ├── ManagementNotificationsPage.tsx # Management notification center
│       │   ├── ManagementUserManagementPage.tsx # User accounts & role admin
│       │   ├── ManagementHostelApplicationsPage.tsx # Student registration review
│       │   └── ...
│       │
│       ├── routes/
│       │   └── ProtectedRoute.tsx    # Route guard enforcing authentication
│       │
│       ├── services/
│       │   ├── api.ts               # Unified typed HTTP client (student + management)
│       │   └── student-realtime.ts  # SSE client for student events
│       │
│       └── styles/
│           ├── index.css            # Global styles, design tokens
│           ├── OutingLogHistory.css
│           ├── FeeModules.css
│           ├── DeviceManagement.css
│           ├── AdminNotifications.css
│           └── ...
│
└── docs/
    ├── notifications-implementation-plan.md
    ├── notifications-implementation.md
    ├── mess-indent-attendance-four-way-reporting.md
    ├── hms-final-integration-step6.md
    ├── fee-management-implementation.md
    ├── fee-management-implementation-plan.md
    ├── device-management-implementation.md
    ├── device-management-implementation-plan.md
    ├── admin-dashboard-step1-report.md
    ├── admin-block-management-step2-report.md
    ├── student-mess-workflow-step3.md
    ├── student-mess-static-qr-step7.md
    ├── outing-log-history-implementation.md
    ├── outing-log-history-implementation-plan.md
    ├── student-portal-production-audit.md
    ├── student-portal-hardening-step2.md
    ├── student-portal-production-hardening-step5.md
    ├── student-portal-ui-step4.md
    └── ...
```

---

## 2. Architecture Summaries

### 2.1 Frontend Architecture
- **Framework:** React 18 with TypeScript, bundled using Vite
- **Routing:** Manual `window.location` + `history.pushState` (see **BUGS.md M3** — migration to React Router recommended)
- **Contexts:**
  - `AuthContext.tsx`: Student authentication, token in localStorage (see **BUGS.md C5**)
  - `ManagementAuthContext.tsx`: Warden/Management auth, multi-key token storage (see **BUGS.md C7**)
- **Styling:** Vanilla CSS in `index.css` with institutional design tokens. Zero Tailwind dependency.

### 2.2 Backend Architecture
- **Runtime:** Node.js + Express.js + TypeScript
- **Database:** PostgreSQL 18.6 via Prisma ORM
- **Authentication:** JWT tokens with server-side session table for invalidation
- **RBAC:** Two-tier — student middleware (`authenticateStudent`) + management middleware (`authenticateManagement`)
- **Realtime:** SSE via `events.service.ts` (EventEmitter-based broker)
- **Security:** Rate limiting on login, multer file upload validation, bcrypt password hashing

### 2.3 Database Schema (Prisma)
Core models: Student, Session, Block, Room, RoomAllocation, OutingRequest, MessToken, MessIndent, LeaveRequest, Suspension, Complaint, Attachment, BiometricEvent, Notification, ActivityLog, Device, Fee, HostelApplication, GuestVisit, AuditLog.

### 2.4 API Routes Summary
| Prefix | Auth Required | Description |
|--------|--------------|-------------|
| `/api/auth/*` | Public | Registration, login, logout |
| `/api/student/*` | Student | Dashboard, room, mess, outings, complaints, leaves, biometric, notifications |
| `/api/management/*` | Management | Dashboard, blocks, rooms, mess, outings, leaves, complaints, fees, devices, users |
| `/api/test/*` | Test | Biometric event simulation |

---

## 3. Bug Report

> **See `BUGS.md` for the complete, prioritized list of all known bugs (22 total).**

Quick reference:
- **7 CRITICAL** — Hardcoded secrets, CORS misconfig, token leakage, predictable hashes, XSS storage risks
- **7 HIGH** — Missing routes, unauthenticated admin endpoints, non-crypto randomness, data inconsistency
- **8 MEDIUM** — Code duplication, permissive rate limiting, fragile routing, session management issues

---

## 4. Testing

- **Runner:** Node.js native `fetch` + `assert` (no external test framework)
- **Master Suite:** `backend/run-all-regressions.cjs` — orchestrates 15 test suites (221 tests)
- **Coverage:** 100% passing against PostgreSQL 18.6
- **Regression:** Run `npm run build` first, then `node backend/run-all-regressions.cjs`

---

## 5. Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start both backend (port 5001) and frontend (port 5173) |
| `npm run dev:backend` | Backend only |
| `npm run dev:frontend` | Frontend only |
| `npm run build` | Build both for production |
