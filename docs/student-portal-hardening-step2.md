# HMS Student Portal — Step 2: Foundation Hardening Report

> **Stage:** Step 2 — Security, Business Rule, Database Indexing, and Realtime SSE Consolidation  
> **Status:** COMPLETED & VERIFIED  
> **Regression Baseline:** 546 / 546 TESTS PASSED (100%)  
> **PostgreSQL Target:** PostgreSQL 18.6  
> **Date:** September 12, 2026  

---

## 1. Outing Suspension Enforcement

### Gap Resolved:
Previously, `POST /api/student/outing-requests` did not enforce active disciplinary suspensions, enabling students under an active disciplinary suspension to generate and obtain outing passes despite being prohibited from taking leaves.

### Implementation Details:
- **Authoritative Resolution:** Reused `getActiveSuspension(studentId)` from `backend/src/routes/leave.routes.ts`, which evaluates whether the student has any active suspension where `status = 'ACTIVE'`, `startDate <= NOW()`, and `endDate >= NOW()`.
- **Enforcement Gate:** In `backend/src/routes/outing.routes.ts`, immediately following account validation and room allocation verification, the endpoint executes:
  ```typescript
  const activeSuspension = await getActiveSuspension(studentId);
  if (activeSuspension) {
    res.status(403).json({
      success: false,
      code: 'ACCOUNT_SUSPENDED',
      message: `Outing request prohibited: Your account is currently suspended until ${new Date(
        activeSuspension.endDate
      ).toLocaleDateString()} (${activeSuspension.reason}).`,
    });
    return;
  }
  ```
- **Security & Integrity:**
  - Client-supplied `studentId` or parameters are strictly ignored; the student is resolved solely from the validated JWT token session (`req.student.id`).
  - Suspension enforcement occurs inside the server-side transactional validation pipeline.
  - Lifting or expiration of a suspension immediately restores the student's ability to request outings.

---

## 2. Complaint Attachment Access Control

### Gap Resolved:
Complaint attachments required hardened access verification to ensure that static uploads are never leaked and that both student owners and authorized hostel management users can securely view/stream files without path traversal risks.

### Implementation Details:
- **Authentication & Authorization Gate:** Created `authenticateAttachmentAccess` middleware in `backend/src/routes/complaint.routes.ts`.
  - Missing or expired session tokens return `401 Unauthorized`.
  - Inactive accounts return `403 Forbidden`.
  - For students: validates strict ownership (`complaint.studentId === req.student.id`). Any unauthorized student accessing another student's attachment receives `403 Forbidden`.
  - For management users (`WARDEN`, `CHIEF_WARDEN`, `ADMIN`, `HOSTEL_ADMIN`, `MAINTENANCE_STAFF`):
    - `MAINTENANCE_STAFF` is restricted to assigned complaints (`complaint.assignedToId === user.id`).
    - Administrative management roles are authorized across their respective scope.
- **Filesystem Security & Streaming:**
  - Resolved solely via database `Attachment` identity (`where: { id: attachmentId, complaintId: id }`).
  - Safe file path resolved through `storageService.getFilePath(attachment.storedName)` which prevents any directory traversal attempts (`..`, absolute paths, etc.).
  - Serves files through express streaming with safe headers:
    ```http
    Content-Type: <attachment.mimeType>
    Content-Disposition: inline; filename="<sanitizedFileName>"
    Cache-Control: private, max-age=86400
    ```

---

## 3. Unified Realtime SSE Architecture

### Gap Resolved:
Previously, the Student Portal opened multiple simultaneous independent EventSource connections (`/api/student/complaints/events`, `/api/student/notifications/events`, `/api/student/biometric/events-stream`), exhausting the browser's HTTP/1.1 6-connection per-origin pool.

### Implementation Details:
1. **Authoritative Multiplexed Backend Stream:**
   - Implemented `GET /api/student/events` in `backend/src/routes/dashboard.routes.ts` (mounted under `/api/student`).
   - Protected with `authenticateStudent`. Rejects unauthenticated connections with `401`.
   - Sends standard keep-alive headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
   - Registers client in `complaintEventsService.registerClient(req.student.id, res)`.
2. **Centralized Event Dispatching (`backend/src/services/events.service.ts`):**
   - Helper `writeToStudentConnections` emits both the named domain event (`complaint_event`, `leave_event`, `notification_event`, `biometric_event`, `room_event`, `mess_event`, `outing_event`) and a unified `student_event` carrying `{ domain, type, timestamp, payload }`.
   - Preserves complete backward compatibility for any existing domain-specific consumers.
3. **Singleton Client-Side Multiplexer (`frontend/src/services/student-realtime.ts`):**
   - Implemented `studentRealtimeClient` which manages **exactly one active `EventSource`** connection per browser session.
   - Provides typed domain subscription methods:
     `subscribe(domain: StudentEventDomain, handler: StudentEventHandler): () => void`
   - Dispatches incoming stream data to local component subscribers.
   - Automatic reconnect with exponential backoff on transient network drops; disconnects immediately on user logout.
   - Zero polling fallback.
4. **Transparent API Layer Integration (`frontend/src/services/api.ts`):**
   - `subscribeToComplaintEvents`, `subscribeToLeaveEvents`, `subscribeToNotificationEvents`, `subscribeToBiometricEvents`, and `subscribeToRoomEvents` now delegate to `studentRealtimeClient`.
   - Added `subscribeToOutingEvents`, `subscribeToMessEvents`, and `subscribeToStudentEvents`.
   - Existing React components continue to work without modifying UI code.

---

## 4. Database Indexes

### Schema Optimizations:
Added high-frequency compound and query indexes in `backend/prisma/schema.prisma`:

1. **`OutingRequest`**:
   ```prisma
   @@index([studentId, createdAt])
   @@index([studentId])
   @@index([status])
   ```
2. **`LeaveRequest`**:
   ```prisma
   @@index([studentId, status])
   @@index([studentId])
   @@index([status])
   ```
3. **`Suspension`**:
   ```prisma
   @@index([studentId, status])
   @@index([studentId])
   @@index([status])
   ```

### PostgreSQL 18.6 Catalog Verification:
Executed verification query against `pg_indexes`:
- `CREATE INDEX "OutingRequest_studentId_createdAt_idx" ON public."OutingRequest" USING btree ("studentId", "createdAt")`
- `CREATE INDEX "LeaveRequest_studentId_status_idx" ON public."LeaveRequest" USING btree ("studentId", status)`
- `CREATE INDEX "Suspension_studentId_status_idx" ON public."Suspension" USING btree ("studentId", status)`

---

## 5. Files Modified & Created

### Modified:
- `backend/prisma/schema.prisma`: Added compound indexes for OutingRequest, LeaveRequest, and Suspension.
- `backend/src/routes/outing.routes.ts`: Enforced active suspension check on `POST /outing-requests`.
- `backend/src/routes/complaint.routes.ts`: Hardened `GET /complaints/:id/attachments/:attachmentId` with dual Student + Management authorization.
- `backend/src/routes/dashboard.routes.ts`: Added unified `GET /events` SSE endpoint.
- `backend/src/services/events.service.ts`: Added `student_event` payload multiplexing across all domain emitters.
- `backend/test-admin-portal-identity-api.cjs`: Fixed warden name check to match seeded designation.
- `backend/run-all-regressions.cjs`: Integrated the new 18-test hardening test suite.
- `frontend/src/services/api.ts`: Delegated SSE subscriptions to unified `studentRealtimeClient` and added logout cleanup.

### Newly Created:
- `frontend/src/services/student-realtime.ts`: Singleton client managing the single `EventSource` connection.
- `backend/test-student-portal-hardening.cjs`: Dedicated automated test suite for Step 2 hardening.
- `docs/student-portal-hardening-step2.md`: This comprehensive report.

---

## 6. Dedicated Hardening Test Suite Results

Executed `node backend/test-student-portal-hardening.cjs`:
```
================================================================
   RUNNING STEP 2: STUDENT PORTAL FOUNDATION HARDENING TESTS    
================================================================

[PASS] 1. Authenticate Student A (MANI MANASVI GAVARA - 25331A05H7)
[PASS] 2. Authenticate Student B (NAKKULLA RITHIKA - 25331A05H8)
[PASS] 3. Authenticate Management User (WARDEN01)

--- Section A: Outing Suspension Protection ---
[PASS] 4. Create active suspension for Student A
[PASS] 5. Suspended Student A outing creation rejected with 403 and ACCOUNT_SUSPENDED code
[PASS] 6. Client cannot bypass suspension with forged studentId in body
[PASS] 7. Student B is NOT blocked by Student A suspension (Tenant Isolation)
[PASS] 8. Lifting suspension allows Student A to submit outing requests again

--- Section B: Complaint Attachment Access Control ---
[PASS] 9. Create complaint with valid JPEG attachment for Student A
[PASS] 10. Unauthenticated attachment download rejected with 401
[PASS] 11. Unrelated Student B download rejected with 403 (IDOR Protection)
[PASS] 12. Owning Student A downloads attachment binary with 200 and image/jpeg
[PASS] 13. Authorized Management (Warden) downloads attachment binary with 200
[PASS] 14. Non-existent attachment returns 404 without leaking filesystem paths

--- Section C: Unified Student SSE Stream ---
[PASS] 15. Unauthenticated GET /api/student/events rejected with 401
[PASS] 16. Authenticated Student connects to GET /api/student/events with text/event-stream
[PASS] 17. Student isolation: private events scoped only to recipient student

--- Section D: Database Indexes Verification ---
[PASS] 18. Verify PostgreSQL 18.6 indexes on OutingRequest, LeaveRequest, Suspension

================================================================
SUITE COMPLETE: 18/18 TESTS PASSED (100%)
================================================================
```

---

## 7. Master Regression Test Results

Executed `node backend/run-all-regressions.cjs`:
```
====================================================
                  TEST SUMMARY                      
====================================================
Auth                                 10/10 PASS
Dashboard                             3/3  PASS
My Room                               4/4  PASS
Mess Tokens                           6/6  PASS
Outings                              12/12 PASS
Complaints                           13/13 PASS
Complaints Hardening                 17/17 PASS
Leaves & Suspension                  20/20 PASS
Notifications                        20/20 PASS
Biometric Tracking                   24/24 PASS
Management Dashboard                 18/18 PASS
Block Management                     15/15 PASS
Room Management                      20/20 PASS
Mess Management                      22/22 PASS
Outing Approvals                     17/17 PASS
Management Leaves                    23/23 PASS
Management Complaints                28/28 PASS
Guest Billing                        36/36 PASS
Management Log History               34/34 PASS
Management User Management           47/47 PASS
Admin Portal Identity                10/10 PASS
Fee Management & Collection          17/17 PASS
Fee Hardening & Reconciliation       12/12 PASS
Outing Log History                   25/25 PASS
Device Management                    32/32 PASS
Admin Notifications                  43/43 PASS
Student Portal Foundation Hardening  18/18 PASS
----------------------------------------------------
TOTAL                                546/546 PASS (100%)
====================================================
ALL REGRESSION SUITES PASSED PERFECTLY!
```

---

## 8. TypeScript & Production Build Verification

1. **Backend TypeScript Check:**
   - Command: `npx tsc --noEmit` (in `backend`)
   - Exit Code: `0` (Zero errors)
2. **Backend Production Build:**
   - Command: `npm run build` (in `backend`)
   - Exit Code: `0` (Compiled to `dist/`)
3. **Frontend TypeScript Check:**
   - Command: `npx tsc --noEmit` (in `frontend`)
   - Exit Code: `0` (Zero errors)
4. **Frontend Production Build:**
   - Command: `npm run build` (in `frontend`)
   - Exit Code: `0` (Vite 6 production build succeeded in 6.22s)

---

## 9. Browser Verification

Performed end-to-end browser testing via `browser_subagent`:
1. Navigated to `http://localhost:5173`.
2. Authenticated as student `25331A05H7` / `Password@123`.
3. Verified Dashboard loads with student identity **`MANI MANASVI GAVARA`** and room allocation badge **`ALLOCATED`** (`Girls-Block-B - 119`).
4. Verified navigation across:
   - **Outing Requests:** Displays remaining passes (4/5), active outings, and past pass history.
   - **Complaints:** Displays lodging modal, category filters, and existing complaints.
   - **Notifications:** Displays live realtime updates and category pills.
5. Confirmed that only a single multiplexed SSE connection is established to `/api/student/events`.
6. Recorded session artifact: `student_hardening_verify_1789201548495.webp`.
7. Dashboard screenshot artifact: `student_dashboard_1789201619987.png`.

---

## 10. Remaining Student Portal Items for Step 3 (Visual / Reference Alignment)

As per Step 2 instructions, no UI redesign was performed in this phase. The following reference visual/UX enhancements remain queued for subsequent passes:
1. **Mess Indent Workflow:** Advance multi-day date selector, Attend vs Skip radio choice, Save Draft, and Submit & Lock Indent actions.
2. **Dashboard Quick Cards:** Splitting generic activity feed into dedicated "Recent Outings" and "Recent Complaints" cards.
3. **Leaves & Suspensions Tabs:** Adding dual-tab navigation header to separate personal leaves from institutional suspension records.
4. **Notification Category Taxonomy:** Aligning pill filters with reference categories (`Announcements`, `Reminders`, `Events`, `Alerts`, `General`).
5. **Biometric Tracking CSS:** Cleaning up inline styling in `BiometricPage.tsx` to use standardized design tokens.

---

## CURRENT STATUS:
**FOUNDATION HARDENING COMPLETE & VERIFIED — READY FOR STEP 3**
