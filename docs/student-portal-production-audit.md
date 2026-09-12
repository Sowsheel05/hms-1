# HMS Student Portal — Production Audit and Reference Gap Analysis

> **Audit Type:** Production Readiness, Architecture, Security, and Reference UI/UX Gap Analysis  
> **Target System:** Hostel Management System (HMS) — Student Portal  
> **Target Environment:** Production (PostgreSQL 18.6, Node/Express/Prisma backend, React 19/Vite frontend)  
> **Audit Status:** COMPLETED (AUDIT ONLY — ZERO CODE MODIFICATIONS APPLIED)  
> **Date:** September 12, 2026  

---

## 1. Executive Summary

This audit establishes the definitive production baseline and reference gap analysis for the **HMS Student Portal**. The audit was conducted strictly in read-only analysis mode across the entire full-stack codebase (`frontend/src`, `backend/src`, `backend/prisma`, test automation suites, and schema definitions). No application code, database migrations, package dependencies, or configuration settings were modified.

The HMS Student Portal is a robust, feature-rich sub-system with comprehensive end-to-end functionality spanning eight core functional modules:
1. **Authentication & Session Management**
2. **Student Dashboard**
3. **My Room (Accommodation & Roommates)**
4. **Mess Tokens (Daily Meal Indent Management)**
5. **Outing Requests (Pass Workflow & Active Tracking)**
6. **Complaints (Incident Lifecycle, Categorization, & Attachments)**
7. **Leaves & Suspension (Application, Warden Approval, & Penalty Tracking)**
8. **Biometric Tracking (Check-in/Check-out Audit Log & Gate Sync)**
9. **Notifications (Categorized Alerts, Announcements, & Realtime Badge Sync)**

### Key Audit Findings:
- **Architectural Strengths:** Strong server-side RBAC using Express middleware, clean Prisma ORM schema models, zero client-side business authority, relational referential integrity, and comprehensive automated test coverage for backend API contracts.
- **Reference UI/UX Alignment:** The portal closely mimics the reference system's visual hierarchy (navy primary actions, rounded status cards, modal workflows, quick actions, tabbed navigation). However, notable UX deviations exist in **Meal Indent Draft/Lock semantics**, **Suspension history tab segregation**, **Notification category taxonomy**, and **Biometric styling uniformity**.
- **Realtime / SSE Bottleneck:** Multiple independent Server-Sent Events (SSE) connections are maintained per client (`/complaints/events`, `/leaves/events`, `/notifications/events`, `/biometric/events-stream`), which risks exhausting the HTTP/1.1 per-origin connection pool limit (6 concurrent connections) in production browsers.
- **Security & Concurrency Considerations:** While Single-Record IDOR protections are strictly implemented across single GET/PUT endpoints, **Outing requests currently do not validate active suspensions** (unlike Leaves, which do), allowing suspended students to potentially submit outing passes. In addition, static file attachments uploaded for complaints lack authenticated download gates.
- **Current Production Readiness Status:** **`NEEDS HARDENING`**. The core system is stable and operational, but requires targeted backend validation hardening, unified SSE streaming, and specific frontend reference UI refinements before general production deployment.

---

## 2. Current Student Portal Architecture

### 2.1 System Architecture Topology
The HMS Student Portal operates as a single-page application (SPA) decoupled from a monolithic Node.js REST and SSE API backend, communicating over JSON HTTP endpoints and text/event-stream transports:

```
[ Browser / Client: React 19 + TypeScript + Vite ]
         |
         +--> [ REST API: Bearer JWT Token ] --> [ Express Router (Port 5001) ]
         |                                           |
         |                                           +--> [ Auth Middleware: verifyToken + requireRole('STUDENT') ]
         |                                           |
         |                                           +--> [ Prisma ORM 5.22 ]
         |                                                   |
         |                                                   +--> [ PostgreSQL 18.6 Authoritative DB ]
         |
         +--> [ Realtime SSE Streams: EventSource ] ---> [ in-memory EventsService (Pub/Sub) ]
```

### 2.2 Client-Side Architecture
- **Framework & Build:** React 19.0.0, TypeScript 5.6.3, Vite 6.0.1.
- **Styling Architecture:** Custom CSS design system located in `frontend/src/index.css` using modern CSS custom properties (`--primary: #1e3a8a`, `--surface`, `--border`, `--text-main`, `--radius-lg`, etc.). No Tailwind dependency.
- **State Management:** Reactive component-level state combined with centralized API service wrappers in `frontend/src/services/api.ts` and `frontend/src/services/events.ts`.
- **Navigation & Routing:** Dynamic view state rendering controlled via `App.tsx` and persistent sidebar in `frontend/src/components/Sidebar.tsx`.

### 2.3 Server-Side Architecture
- **Runtime & Web Framework:** Node.js, TypeScript via `tsx` (runtime) / `tsc` (build), Express 4.21.1.
- **Database Engine:** PostgreSQL 18.6 accessed exclusively via Prisma Client 5.22.0. Zero SQLite usage.
- **Authentication & Authorization:** Stateful/Stateless Hybrid JWT (HS256) with role verification (`STUDENT`, `ADMIN`, `WARDEN`). Strict tenant isolation enforcing `req.user.studentId` or resolving `req.user.userId -> Student.id`.
- **Concurrency & Transactions:** Critical write paths (e.g. Complaint creation with attachments, Room allocation changes, Leave request submissions) execute inside `prisma.$transaction`.

---

## 3. Current Frontend Inventory

| Page / Component | File Location | Key Capabilities & Features | Reference UI Alignment |
| :--- | :--- | :--- | :--- |
| **App Routing & State** | `frontend/src/App.tsx` | Active page dispatch, identity banner, suspension warning toasts, modal state container. | Aligned |
| **Sidebar Navigation** | `frontend/src/components/Sidebar.tsx` | Persistent desktop sidebar, mobile drawer, student profile badge, active route highlight, unread badges. | High (consistent styling & icons) |
| **Dashboard Header** | `frontend/src/components/DashboardHeader.tsx` | Title, subtitle, notifications bell with realtime count, quick action trigger. | High |
| **Student Dashboard** | `frontend/src/pages/DashboardPage.tsx` | Room summary, mess token summary, active outing summary, leave balances, recent activity list, notifications preview. | Medium (Missing separate Recent Complaints/Outings/Announcements cards) |
| **My Room** | `frontend/src/pages/MyRoomPage.tsx` | Block, floor, room number, room type, bed designation, capacity status, verified roommates list with contacts. | High |
| **Mess Tokens** | `frontend/src/pages/MessTokensPage.tsx` | Today's meal cards (Breakfast, Lunch, Snacks, Dinner), meal timings, diet preference toggle, token status, instant booking. | Medium (Lacks multi-day date selector, Attendance vs Skip choice, Draft & Lock indent controls) |
| **Outing Requests** | `frontend/src/pages/OutingRequestsPage.tsx` | Outing pass history table, status badges, remaining passes KPI, Create Outing modal (type, destination, start/end, reason). | High |
| **Complaints** | `frontend/src/pages/ComplaintsPage.tsx` | Total / In-Progress / Resolved metrics, complaint list, status timeline, Raise Complaint modal with multi-file photo upload. | High |
| **Leaves & Suspension** | `frontend/src/pages/LeavesPage.tsx` | Active leave card, total leaves taken, leave balance, leave history table, Apply Leave modal, active suspension alert banner. | Medium (Lacks separate tabbed navigation for Historical Suspensions) |
| **Biometric Tracking** | `frontend/src/pages/BiometricPage.tsx` | Today's punch summary, campus status (IN/OUT), device identification, punch log history table with verification modes. | Medium (Heavy inline styling, needs CSS token normalization) |
| **Notifications** | `frontend/src/pages/NotificationsPage.tsx` | Categorized notification feed, mark single/all as read, unread counter, category pill filters. | Medium (Category taxonomy does not match Reference `[Announcements, Reminders, Events, Alerts, General]`) |
| **Design System / CSS** | `frontend/src/index.css` | Design tokens, color palette, card components, form controls, modals, tables, badges, responsive media queries. | High |

---

## 4. Current Backend Inventory

| Endpoint Route | HTTP Method | Auth / Role Middleware | Business Logic & Validations | Controller / Route File |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/login` | `POST` | Public / Rate-limited | Validates email/username & bcrypt password. Issues JWT with role & studentId. | `backend/src/routes/auth.routes.ts` |
| `/api/auth/me` | `GET` | `verifyToken` | Returns authenticated user profile, student record, and room context. | `backend/src/routes/auth.routes.ts` |
| `/api/student/dashboard` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Aggregates room details, mess status, active outings, leave count, and recent activity. | `backend/src/routes/dashboard.routes.ts` |
| `/api/student/room` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Queries `RoomAllocation` for student and fetches active roommates in the same room. | `backend/src/routes/room.routes.ts` |
| `/api/student/mess/today` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Returns meal status and tokens for the current date. | `backend/src/routes/mess.routes.ts` |
| `/api/student/mess/book` | `POST` | `verifyToken`, `requireRole('STUDENT')` | Books single meal token for today. Checks duplication and meal slot validity. | `backend/src/routes/mess.routes.ts` |
| `/api/student/mess/preference` | `PUT` | `verifyToken`, `requireRole('STUDENT')` | Updates vegetarian/non-vegetarian preference. | `backend/src/routes/mess.routes.ts` |
| `/api/student/outing-requests` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Fetches student's outing requests with pagination & status filters. | `backend/src/routes/outing.routes.ts` |
| `/api/student/outing-requests` | `POST` | `verifyToken`, `requireRole('STUDENT')` | Validates time range and overlapping requests. Submits outing for warden review. | `backend/src/routes/outing.routes.ts` |
| `/api/student/complaints` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Lists student's complaints with status and attachments. | `backend/src/routes/complaint.routes.ts` |
| `/api/student/complaints` | `POST` | `verifyToken`, `requireRole('STUDENT')` | Validates title, category, description; processes uploads with multer; creates complaint. | `backend/src/routes/complaint.routes.ts` |
| `/api/student/complaints/:id` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Enforces ownership (`complaint.studentId === req.user.studentId`). Returns details. | `backend/src/routes/complaint.routes.ts` |
| `/api/student/leaves` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Fetches leave history and active suspension status. | `backend/src/routes/leave.routes.ts` |
| `/api/student/leaves` | `POST` | `verifyToken`, `requireRole('STUDENT')` | Enforces suspension check (rejects if suspended). Validates dates & overlap. | `backend/src/routes/leave.routes.ts` |
| `/api/student/biometric/logs` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Queries `BiometricLog` records for student with date filtering. | `backend/src/routes/biometric.routes.ts` |
| `/api/student/biometric/status` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Returns current physical campus state (IN/OUT) based on latest gate punch. | `backend/src/routes/biometric.routes.ts` |
| `/api/student/notifications` | `GET` | `verifyToken`, `requireRole('STUDENT')` | Fetches targeted student notifications and global broadcasts. | `backend/src/routes/notification.routes.ts` |
| `/api/student/notifications/:id/read` | `PUT` | `verifyToken`, `requireRole('STUDENT')` | Marks notification as read with ownership validation. | `backend/src/routes/notification.routes.ts` |
| `/api/student/notifications/read-all` | `PUT` | `verifyToken`, `requireRole('STUDENT')` | Bulk marks all unread notifications as read for this student. | `backend/src/routes/notification.routes.ts` |

---

## 5. Current PostgreSQL & Prisma Inventory

### 5.1 Primary Models in Scope
1. **`User` & `Student`**: One-to-one relationship. `Student` holds demographic, academic, contact, and parent information.
2. **`Room` & `RoomAllocation`**: Relational room allocation linked by `roomId` and `studentId` with historical timestamps (`startDate`, `endDate`, `status: ACTIVE | TRANSFERRED | VACATED`).
3. **`MessToken` & `MessAttendance`**: Tracks meal tokens per student, date, and meal type (`BREAKFAST`, `LUNCH`, `SNACKS`, `DINNER`).
4. **`OutingRequest`**: Outing passes with status lifecycle (`PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `COMPLETED`).
5. **`Complaint` & `Attachment`**: Student grievance records with category, priority, status lifecycle, and uploaded file metadata.
6. **`LeaveRequest` & `Suspension`**: Extended leave workflow and disciplinary suspension records with start/end dates and active flags.
7. **`BiometricLog`**: Gate punch logs with device identifiers, punch direction (`IN`/`OUT`), and verification method.
8. **`Notification`**: Direct and broadcast notifications with read tracking (`isRead`, `readAt`).

### 5.2 Schema Deficiencies & Risk Assessment
- **Denormalized Room Fields on `Student`**: The `Student` model maintains legacy denormalized columns (`roomNumber`, `bedNumber`, `blockName`, `allocationStatus`) alongside the authoritative `RoomAllocation` table. Updates must ensure continuous synchronization to prevent data drift.
- **Missing Compound Query Indexes**:
  - `OutingRequest(studentId, createdAt DESC)`: Currently only indexed on `id`.
  - `LeaveRequest(studentId, status)`: Needs index for rapid dashboard badge calculation.
  - `Attachment(complaintId)`: Foreign key index needed for attachment resolution.
- **Concurrency Protections**: The current `RoomAllocation` schema relies on application-level transaction checks rather than a PostgreSQL partial unique index (`CREATE UNIQUE INDEX active_room_allocation_idx ON "RoomAllocation" ("studentId") WHERE status = 'ACTIVE'`).

---

## 6. Current Realtime Architecture

### 6.1 Server-Sent Events (SSE) Implementation
Realtime synchronization is powered by an in-memory event emitter service (`backend/src/services/events.service.ts`):
- Clients connect via standard HTML5 `EventSource`.
- Dedicated channels:
  - `/api/student/complaints/events`
  - `/api/student/leaves/events`
  - `/api/student/notifications/events`
  - `/api/student/biometric/events-stream`
- Connection keep-alive heartbeat runs at 15-second intervals (`: keepalive\n\n`).

### 6.2 Realtime Architecture Audit Findings
1. **Connection Pool Exhaustion:** When a student opens the portal, the frontend spawns 4 to 5 simultaneous SSE streams across different page components. Standard HTTP/1.1 browsers enforce a limit of **6 concurrent connections per origin**. Additional requests (API calls, image loads) can block or stall.
   - **Recommendation:** Implement a single multiplexed SSE gateway endpoint (`/api/student/events/stream`) dispatching typed domain events (`COMPLAINT_UPDATED`, `LEAVE_APPROVED`, `NOTIFICATION_RECEIVED`, `BIOMETRIC_PUNCH`).
2. **Horizontal Scaling Limitation:** `events.service.ts` stores SSE response handlers in Node.js heap memory (`Map<string, Response[]>`). In a multi-instance or clustered production deployment, an event emitted on Server A will not reach a student connected to Server B without a Redis Pub/Sub adapter.
3. **Database-Backed Count Consistency:** Unread notification counts and badge totals are recalculated from PostgreSQL upon reconnection, preventing drift. Zero client-side polling (`setInterval`/`setTimeout`) was found in active production views.

---

## 7. Security & Authorization Audit

### 7.1 IDOR (Insecure Direct Object Reference) Protection
- **Single-Record Lookups:** Endpoints such as `GET /api/student/complaints/:id`, `GET /api/student/leaves/:id`, and `PUT /api/student/notifications/:id/read` explicitly enforce student ownership:
  ```typescript
  if (record.studentId !== req.user.studentId) {
    return res.status(403).json({ success: false, message: "Unauthorized access to record" });
  }
  ```
- **List Queries:** All collection queries automatically filter by `where: { studentId: req.user.studentId }`.

### 7.2 Critical Authorization Gaps Identified
1. **Suspension Bypass in Outing Requests:**
   - **Vulnerability:** `leave.routes.ts` strictly checks if the student has an active suspension before allowing a leave application. However, `outing.routes.ts` does **not** check `prisma.suspension.findFirst({ where: { studentId, isActive: true } })`.
   - **Impact:** A student placed under disciplinary suspension cannot apply for leaves, but **can successfully submit outing requests**.
   - **Remediation Required:** Add mandatory suspension check in `POST /api/student/outing-requests`.
2. **Unauthenticated Static Attachments:**
   - Complaint attachments stored in `/uploads/complaints/` are currently served as static files via Express without verifying the requesting user's identity or relation to the complaint.
   - **Remediation Required:** Route attachment downloads through an authenticated streaming controller (`/api/student/complaints/:id/attachments/:attachmentId`).
3. **Server-Side Booking Cutoffs:**
   - Mess token booking endpoints (`POST /api/student/mess/book`) validate the date and slot, but lack strict time-of-day cutoff rules (e.g. locking Breakfast booking at 07:00 AM, Lunch at 10:00 AM).

---

## 8. Reference UI/UX Analysis

A detailed comparison between the reference portal design and the existing HMS frontend revealed several visual and UX refinements:

### 8.1 Visual & Layout Commonalities
- **Color Palette & Styling:** The deep navy (`#1e3a8a`), slate backgrounds (`#f8fafc`), crisp card borders (`#e2e8f0`), and rounded corners (`12px`) accurately match the reference design system.
- **Top Header & Identity:** Standardized greeting (`Good morning / afternoon, {Name}!`), student ID, room badge, and notification bell align with reference specifications.
- **KPI Summary Cards:** The 4-column metric cards on Dashboard and page-specific counter cards adhere to the reference aesthetic.

### 8.2 Discrepancies & Deviations from Reference
1. **Mess Tokens / Indent Management Workflow:**
   - *Reference Design:* Contains a top multi-day date navigator, individual meal cards with "Will Attend" vs "Skip Meal" attendance radio options, a "Save Draft" action, and a final "Submit & Lock Indent" button with clear status indicators.
   - *Current HMS:* Provides today-only instant booking buttons without draft/lock lifecycle or multi-day advance planning.
2. **Dashboard Quick Widgets:**
   - *Reference Design:* Dedicated sections for "Recent Outings", "Recent Complaints", and "Announcements".
   - *Current HMS:* Features a unified "Recent Activity" list and a "Notifications Preview" widget.
3. **Leaves & Suspension Page Structure:**
   - *Reference Design:* Clear dual-tab layout separating "Leaves" and "Suspensions".
   - *Current HMS:* All content lives on a single page with suspensions displayed solely as an alert banner when active.
4. **Notification Filtering Taxonomy:**
   - *Reference Design:* Categorized by `[All, Announcements, Reminders, Events, Alerts, General]`.
   - *Current HMS:* Categorized by domain models `[All, Outings, Leaves, Complaints, Suspensions, Room, System]`.
5. **Biometric Tracking Consistency:**
   - *Reference Design:* Standard design system cards and table layouts.
   - *Current HMS:* Uses ad-hoc inline styles (`style={{ ... }}`) rather than classes from `index.css`.

---

## 9. Feature-by-Feature Gap Matrix

| Area | Reference Requirement | Current HMS Implementation | Gap Identified | Severity | Recommended Change |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication** | Student login with password change & session persistence | Complete JWT auth with role guard | None | **LOW** | None |
| **Dashboard** | Dedicated cards for Recent Outings, Recent Complaints, and Announcements | Combined Activity Feed and Notification summary | Missing specific segmented cards for Complaints vs Outings | **MEDIUM** | Split unified activity feed into dedicated Recent Complaints and Recent Outings cards |
| **My Room** | Block, floor, room number, capacity, room type, roommates list | Fully rendered with roommates and contact details | Minor spacing and responsive card layout tweaks | **LOW** | Polish responsive grid layout for mobile screens |
| **Mess Tokens** | Multi-day date selector, Attend/Skip choices, Draft & Lock indent workflow | Single-day instant booking per slot | Missing multi-day indenting, attend/skip toggle, and draft/lock states | **HIGH** | Upgrade backend & UI to support date range indents and lock status |
| **Outing Requests** | Outing modal, reason, destination, dates, status tracking | Comprehensive outing management with pass counters | Active suspension is not checked on submission | **CRITICAL** | Add active suspension check in backend outing creation route |
| **Complaints** | Complaint metrics, status pipeline, photo attachments | Total/In-progress/Resolved metrics, multi-file upload | Attachments lack authenticated access control | **HIGH** | Implement authenticated attachment download endpoint |
| **Leaves & Suspension**| Tabbed interface for Leaves vs Suspensions, balance tracker | Single page with alert banner for suspensions | Missing dedicated historical suspensions tab view | **MEDIUM** | Introduce tabs: "Leave Requests" and "Disciplinary Records" |
| **Biometric Tracking** | Punch history table, IN/OUT status, time, gate device | Functional log and status | Inline styles used instead of standard CSS tokens | **MEDIUM** | Refactor component styling to utilize standard CSS tokens |
| **Notifications** | Category pills: Announcements, Reminders, Events, Alerts, General | Category pills: Outings, Leaves, Complaints, System | Category taxonomy mismatch with reference specifications | **MEDIUM** | Align notification category filter pills with reference categories |
| **Realtime Sync** | Single responsive event pipeline | 4-5 simultaneous SSE streams per client | Risks HTTP/1.1 connection limit exhaustion | **HIGH** | Multiplex events into a single unified `/api/student/events` stream |

---

## 10. Critical Blockers

1. **Disciplinary Suspension Bypass in Outings:**
   - Suspended students are prohibited from leaving the premises or generating outing passes. While the Leave module enforces this, `POST /api/student/outing-requests` lacks this validation. This is a critical business rule violation that must be resolved prior to production launch.
2. **Realtime Connection Starvation:**
   - Opening multiple tabs or navigating between pages with multiple SSE streams quickly exhausts browser socket pools (HTTP/1.1 limit of 6 per domain), causing network stalls and broken API requests.

---

## 11. High-Priority Improvements

1. **Mess Indent Draft & Lock Lifecycle:** Upgrade the mess token mechanism to support weekly/daily indents with attendance declarations ("Will Attend" / "Skip") and server-enforced lock deadlines.
2. **Authenticated Media Gateway:** Protect uploaded complaint photographs from unauthenticated public scraping by routing attachment access through an authorized backend controller.
3. **Partial Unique Indexes on Active Room Allocations:** Prevent concurrent or orphaned active room allocation records in PostgreSQL.

---

## 12. Medium-Priority Improvements

1. **Dashboard Widget Granularity:** Align dashboard layout with reference by presenting separate quick-view cards for Recent Outings and Recent Complaints.
2. **Leaves vs Suspensions Tabbed Navigation:** Introduce distinct tab controls on the Leaves page to cleanly separate personal leave history from institutional disciplinary records.
3. **Notification Taxonomy Standardization:** Map internal notification types to user-friendly reference categories (`Announcements`, `Reminders`, `Events`, `Alerts`, `General`).
4. **Biometric View Refactoring:** Clean up inline styles in `BiometricPage.tsx` to ensure visual parity with the global design system.

---

## 13. Low-Priority Improvements

1. **Printable Outing Gate Pass:** Provide a print/download view for approved outing passes with a verification QR code.
2. **Table Pagination Refinements:** Standardize pagination controls across Outings, Complaints, and Biometric logs.
3. **Empty State Micro-Illustrations:** Enhance empty state cards with custom SVG icons instead of generic placeholders.

---

## 14. Database Changes Required (Future Implementation Phase)

> *Note: No schema migrations were applied during this audit.*

1. **Indexes to add in future migration:**
   ```prisma
   // OutingRequest
   @@index([studentId, createdAt])
   
   // LeaveRequest
   @@index([studentId, status])
   
   // Attachment
   @@index([complaintId])
   
   // Suspension
   @@index([studentId, isActive])
   ```
2. **Mess Indent Model Expansion:**
   - Support `attendanceStatus: ATTENDING | SKIPPED`.
   - Support `isLocked: Boolean` and `lockedAt: DateTime?`.

---

## 15. Backend Changes Required (Future Implementation Phase)

1. **Hardening `backend/src/routes/outing.routes.ts`:**
   - Check `prisma.suspension.findFirst({ where: { studentId, isActive: true } })`. If found, return HTTP 403.
2. **Multiplexed SSE Endpoint (`backend/src/routes/events.routes.ts`):**
   - Provide `/api/student/events` sending event types `{ type: 'COMPLAINT' | 'LEAVE' | 'NOTIFICATION' | 'BIOMETRIC', payload: ... }`.
3. **Authenticated Attachment Streaming (`backend/src/routes/complaint.routes.ts`):**
   - Serve complaint attachments only if `req.user.studentId === complaint.studentId` or user is warden/admin.

---

## 16. Frontend Changes Required (Future Implementation Phase)

1. **Single SSE Consumer:** Update `frontend/src/services/events.ts` to connect to a single stream and dispatch to local page handlers.
2. **Dashboard Layout Update:** In `DashboardPage.tsx`, replace the single activity column with two dedicated cards: "Recent Outings" and "Recent Complaints".
3. **Mess Tokens Indent UI:** In `MessTokensPage.tsx`, implement the reference meal card controls (Attendance radio options, Save Draft, and Lock Indent).
4. **Leaves & Suspensions Tab View:** In `LeavesPage.tsx`, wrap the content in a 2-tab navigation header.
5. **Normalize `BiometricPage.tsx`:** Replace inline CSS with `.table`, `.card`, `.badge-success`, `.badge-warning` classes.

---

## 17. Realtime Changes Required (Future Implementation Phase)

- Deprecate individual page SSE streams (`/complaints/events`, `/leaves/events`, `/biometric/events-stream`).
- Standardize all student portal realtime updates onto `/api/student/events`.
- Verify automatic reconnection and state refresh on network recovery without infinite retry loops.

---

## 18. Testing Changes Required (Future Implementation Phase)

1. **Automated Regression Script:** Create `backend/test-student-portal-hardening.cjs` verifying:
   - Outing request rejection during active suspension.
   - Unauthorized access rejection for complaint attachments.
   - Multiplexed SSE connection and event broadcast.
   - Mess token lock boundary enforcement.
2. **Frontend Build Verification:** Ensure `npm run build` (`tsc -b && vite build`) executes cleanly with zero TypeScript errors.

---

## 19. Responsive Verification Requirements

The Student Portal must be tested and verified against standard viewports:
- **Mobile Devices (375px - 480px):** Sidebar collapses to slide-over drawer; tables support horizontal scroll or card fallback; modals render full-width with thumb-friendly buttons.
- **Tablets (768px - 1024px):** 2-column card layouts collapse cleanly; quick action bars wrap gracefully.
- **Desktop (1280px+):** Fixed sidebar layout with fluid main container (`max-width: 1400px`).

---

## 20. Production Readiness Assessment

| Evaluation Dimension | Rating (1-5) | Summary Analysis |
| :--- | :---: | :--- |
| **Authentication & RBAC** | 5 / 5 | Robust JWT authentication with strict server-side role validation. |
| **Database & Schema Integrity** | 4 / 5 | PostgreSQL models are sound; needs a few targeted indexes and constraint hardening. |
| **Business Logic & Validations**| 4 / 5 | Thorough checks across all modules; outing suspension check needed. |
| **Realtime Scalability** | 3 / 5 | Working SSE implementation, but multiple parallel streams require consolidation. |
| **UI/UX Consistency** | 4 / 5 | High visual appeal; minor gaps compared to reference workflows. |
| **Security & Privacy** | 4 / 5 | Excellent IDOR defense; static attachments need authenticated streaming. |
| **Overall Score** | **4.0 / 5.0** | **Production-Capable with Hardening Required** |

---

## 21. Recommended Implementation Sequence

To transition the Student Portal into full production readiness without disrupting existing functionality, the following phased sequence is recommended:

- **Phase 1: Security & Business Rule Hardening**
  - Add active suspension check to Outing Request creation.
  - Implement authenticated attachment streaming for complaints.
- **Phase 2: Realtime Architecture Consolidation**
  - Implement unified `/api/student/events` SSE stream.
  - Refactor frontend SSE hooks to consume the multiplexed stream.
- **Phase 3: Reference UI/UX Alignment**
  - Refactor Mess Tokens to include Attendance/Skip and Lock Indent flows.
  - Implement Leaves vs Suspensions tabbed interface.
  - Separate Dashboard Recent Outings and Recent Complaints cards.
  - Normalize Biometric page CSS styles.
- **Phase 4: Database Optimization & Indexing**
  - Add compound indexes for high-frequency student queries.
- **Phase 5: End-to-End Regression & Responsive Verification**
  - Execute backend automated test suites and verify production Vite build.

---

## CURRENT STATUS:
**NEEDS HARDENING**
