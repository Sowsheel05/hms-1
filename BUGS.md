# HMS (Hostel Management System) — Bug Report

> **Generated:** 2026-09-16
> **Scope:** Full codebase audit (backend, frontend, configuration)
> **Total Bugs Found:** 22

---

## Summary by Severity

| Severity | Count |
|----------|-------|
| **CRITICAL** | 7 |
| **HIGH** | 7 |
| **MEDIUM** | 8 |
| **LOW** | 0 |

---

## CRITICAL

### C1. Hardcoded JWT Secret Fallback
- **File:** `backend/src/config/index.ts:7`
- **Code:** `jwtSecret: process.env.JWT_SECRET || 'hms_secure_student_hostel_jwt_secret_2026'`
- **Description:** If `JWT_SECRET` environment variable is not set, the system falls back to a publicly known, predictable secret string. Any attacker who discovers this default can forge valid JWT tokens for any student or management user.
- **Fix:** Remove the fallback; fail hard with an error if `JWT_SECRET` is not configured in production.

### C2. CORS Accepts All Origins with Credentials
- **File:** `backend/src/index.ts:18-25`
- **Code:** `origin: (origin, callback) => { callback(null, true); }, credentials: true`
- **Description:** The CORS configuration allows requests from ANY origin with credentials (cookies, Authorization headers). Combined with `credentials: true`, any malicious website can make authenticated requests on behalf of a logged-in user.
- **Fix:** Replace with an explicit allowlist of trusted origins from `CORS_ORIGIN` environment variable.

### C3. JWT Token Accepted via URL Query Parameter
- **File:** `backend/src/middleware/auth.middleware.ts:32-33`, `backend/src/middleware/management.middleware.ts:56-57`, `backend/src/routes/complaint.routes.ts:984`
- **Code:** `token = req.query.token.trim();`
- **Description:** Authentication tokens can be passed via `?token=...` URL query parameter. URLs are logged in server access logs, browser history, proxy logs, and transmitted via the Referer header. This is a token leakage vulnerability.
- **Fix:** Remove query parameter token support; enforce Bearer token in Authorization header only.

### C4. Dummy Bcrypt Hash for Timing Attack Mitigation is Predictable
- **File:** `backend/src/services/auth.service.ts:60`, `backend/src/routes/management.routes.ts:93`
- **Code:** `await bcrypt.compare(password, '$2a$10$wN35rB7z.Mv1B78.9K2e6.03u9GfLgKqQYwXqWwOqX7g8mC4uGk4u');`
- **Description:** The hardcoded bcrypt hash used as a dummy comparison for timing attack mitigation is a well-known hash. An attacker can identify the original plaintext and use it to refine timing-based attacks against the real password verification.
- **Fix:** Use a dynamically generated random hash per request, or use a dedicated constant-time comparison utility.

### C5. Student JWT Stored in localStorage (XSS Vulnerability)
- **File:** `frontend/src/services/api.ts:512`
- **Code:** `localStorage.setItem('hms_student_auth_token', token)`
- **Description:** Student authentication tokens are stored in `localStorage`, making them accessible to any JavaScript executed by the page. A stored XSS vulnerability would allow an attacker to exfiltrate all student tokens.
- **Fix:** Use `httpOnly` cookies for JWT storage, or at minimum use in-memory storage with session restoration via refresh tokens.

### C6. Management SSE Token in URL Query String
- **File:** `frontend/src/services/api.ts:1808`
- **Code:** `new EventSource(\`/api/management/events-stream?token=${encodeURIComponent(token)}\`)`
- **Description:** Management SSE (Server-Sent Events) connection includes the JWT in the URL. EventSource URLs are logged by browser history and can be leaked via the Referer header to third-party sites.
- **Fix:** Use Authorization header (EventSource doesn't support custom headers — use a proxy or short-lived tokens).

### C7. Management Auth Token Stored with Multiple Inconsistent Keys
- **File:** `frontend/src/services/api.ts:1636-1683`
- **Code:** Stores management token in 5 different storage keys: `hms_management_auth_token`, `managementToken`, `token`, plus sessionStorage equivalents and in-memory variable.
- **Description:** Inconsistent storage keys cause confusion, potential session fixation, and make it difficult to reliably invalidate sessions. An attacker who clears one key may still have valid sessions in others.
- **Fix:** Use a single, well-defined storage key and clear all variants on logout.

---

## HIGH

### H1. Missing Route Registrations in Server Entry Point
- **File:** `backend/src/index.ts`
- **Description:** The main Express app only registers 10 route modules, but the codebase contains 25+ route files (fee-management, fee-collection, device, admin-notification, guest-billing, log-history, device, hostel-application-management, complaint-management, outing-log-history, user-management, leave-management, etc.). These routes exist but are never mounted, making their frontend pages unreachable or producing 404s.
- **Fix:** Import and register all route modules in `index.ts`.

### H2. Biometric Event Recording for Inactive Students
- **File:** `backend/src/services/biometric.service.ts:356`
- **Code:** `recordIngestedEvent()` — no check for `student.isActive` before recording events
- **Description:** The biometric event ingestion service does not verify that a student account is active before recording events. Inactive, deleted, or suspended students can still have biometric events recorded and correlated with outing requests, leading to data integrity issues.
- **Fix:** Add `if (!student || !student.isActive)` guard after student lookup.

### H3. Admin Test Endpoints Without Authentication
- **File:** `backend/src/routes/leave.routes.ts:661-803`
- **Code:** `router.post('/leaves/test/admin-transition', ...)` and `router.post('/leaves/test/admin-suspension', ...)` — both lack `authenticateManagement` middleware
- **Description:** Two administrative test helper endpoints for leave transitions and suspensions have NO authentication or authorization checks. Any unauthenticated user can approve/reject leaves, create suspensions, or lift suspensions.
- **Fix:** Add `authenticateManagement` (or `authenticateManagementOrMaintenance`) middleware to both endpoints, and restrict to WARDEN/ADMIN roles.

### H4. Non-Cryptographic Randomness for JWT jwtid
- **File:** `backend/src/services/auth.service.ts:115`, `backend/src/routes/management.routes.ts:140`
- **Code:** `jwtid: Math.random().toString(36).substring(2) + '-' + Date.now().toString(36)`
- **Description:** JWT `jwtid` (unique token identifier) uses `Math.random()` which is not cryptographically secure. An attacker could predict or collide with token IDs, potentially causing session conflicts.
- **Fix:** Use `crypto.randomUUID()` for JWT `jwtid` generation.

### H5. Non-Unique Complaint Comment IDs
- **File:** `backend/src/routes/complaint.routes.ts:582`
- **Code:** `id: Math.random().toString(36).substring(2, 9)`
- **Description:** Complaint comment IDs use `Math.random()` with only ~78 million possible values (3.6^7). With high-volume complaint systems, collision probability becomes non-trivial, potentially causing comment ID conflicts.
- **Fix:** Use `crypto.randomUUID()` or database-generated auto-increment IDs.

### H6. Duplicate SSE Event Emission in Management Dashboard
- **File:** `backend/src/services/events.service.ts:249-262`
- **Code:** `emitManagementDashboardUpdate()` writes two different event types: `management_dashboard_event` AND `management_dashboard_update`
- **Description:** Every management dashboard update emits the same data under two different SSE event names, causing management clients to receive and process every update twice. This doubles network traffic and processing load.
- **Fix:** Pick one event name consistently; update all frontend listeners to use the single name.

### H7. Inconsistent Room Capacity in Fallback Query Path
- **File:** `backend/src/routes/room.routes.ts:74`
- **Code:** `const capacity = student.roomCapacity || 2;`
- **Description:** When fetching room details via the legacy fallback path (before full RoomAllocation migration), room capacity is read from the `student` record (`student.roomCapacity`) rather than the actual `Room` table. Different students in the same room may have different (stale) capacity values, leading to inconsistent occupancy reporting.
- **Fix:** Always query capacity from the Room table; remove reliance on student-level denormalized capacity.

---

## MEDIUM

### M1. Duplicate Authentication Middleware for Attachments
- **File:** `backend/src/routes/complaint.routes.ts:969-1048`
- **Code:** Custom `authenticateAttachmentAccess` middleware (180 lines) duplicates logic from `authenticateStudent` and `authenticateManagementOrMaintenance`
- **Description:** Attachment access authentication reimplements session lookup, JWT verification, and RBAC checks instead of reusing existing middleware. This violates DRY, creates maintenance burden, and risks divergence from the canonical authentication logic.
- **Fix:** Compose existing `authenticateStudent` and `authenticateManagementOrMaintenance` middleware; use a role-based check inside the handler instead of a duplicate middleware.

### M2. Login Rate Limiter Too Permissive
- **File:** `backend/src/middleware/rate-limiter.ts:5`
- **Code:** `max: 100` (100 requests per 15-minute window per IP)
- **Description:** 100 login attempts per 15 minutes (≈6.7 per minute) is too generous for a login endpoint. This allows brute-force password attacks at a meaningful rate.
- **Fix:** Reduce to 10-20 attempts per 15-minute window, or implement progressive backoff.

### M3. Frontend Route Protection Uses window.location Instead of Router
- **File:** `frontend/src/App.tsx:417-453`
- **Code:** Manual `window.location.pathname` checking with `window.history.pushState`
- **Description:** Manual routing with `pushState` and popstate listener is fragile. Deep-link refresh on non-root paths can serve incorrect content before the auth check completes. No proper route matching or 404 handling exists.
- **Fix:** Migrate to React Router (or a proper client-side router) with route guards.

### M4. JWT jwtid Uses Math.random() in Student Auth
- **File:** `backend/src/services/auth.service.ts:115`
- **Code:** `jwtid: Math.random().toString(36).substring(2) + '-' + Date.now().toString(36)`
- **Description:** Same issue as H4 — `Math.random()` is not suitable for security-sensitive identifiers. While less severe than in management routes (different token type), it still presents a collision risk.
- **Fix:** Use `crypto.randomUUID()`.

### M5. Management Dashboard Data Parsing Assumption
- **File:** `frontend/src/services/api.ts:1782`
- **Code:** `return { success: data.success, ...data.data }`
- **Description:** The frontend expects management dashboard responses to be wrapped under a `data` key (since backend returns `{ success: true, data: {...} }`), but the `apiService.getDashboard()` returns both `success` and the spread of `data.data` at the top level. If the backend response structure changes or other endpoints are consumed through this path, it will break silently or produce incorrect data.
- **Fix:** Document the expected response shape and add a runtime validation guard.

### M6. Logout Endpoint Doesn't Invalidate via Header (Token in Body)
- **File:** `backend/src/routes/auth.routes.ts:112-131`
- **Code:** Logout extracts token from `req.headers.authorization` but doesn't verify the request body or use the same token parsing as other routes
- **Description:** The logout endpoint manually parses the Bearer token instead of using the `authenticateStudent` middleware. While functional, it duplicates parsing logic and skips the session validation that other endpoints enforce.
- **Fix:** Use `authenticateStudent` middleware for logout, or extract token parsing into a shared utility.

### M7. Biometric Service Missing Student Active Check in recordIngestedEvent
- **File:** `backend/src/services/biometric.service.ts:356-365`
- **Code:** Student lookup by `dto.studentId` without checking `student.isActive`
- **Description:** Biometric events can be ingested for students whose accounts are inactive or suspended. This means a disabled student's biometric events could still trigger outing status changes and other correlations.
- **Fix:** Add active student check after lookup; reject events for inactive students.

### M8. EventEmitter Memory Leak in SSE Service
- **File:** `backend/src/services/events.service.ts:174-198`
- **Code:** `registerClient()` adds Response objects to a Map without any TTL or connection timeout enforcement
- **Description:** SSE connections that are dropped at the network level (without a proper close event) will leave orphaned Response objects in the connection maps. Over time, this causes a memory leak. The heartbeat ping (`startHeartbeat`) detects dead connections only if the `res.write()` fails, but TCP half-open connections may never trigger this.
- **Fix:** Implement a connection timeout (e.g., 60 seconds) that forcibly removes stale connections even without a close event.

---

## Additional Notes

### project-structure.md vs Actual Codebase
The `project-structure.md` file is significantly outdated. It documents ~50 files but the actual codebase contains 200+ files. Missing from the documentation:
- All fee management, fee collection, device management, and audit services
- All management sub-routes (fee-management, fee-collection, device, guest-billing, log-history, etc.)
- Multiple frontend pages (fee, device, guest billing, user management, log history, outing log history, etc.)
- All CSS/style files in frontend
- All test and verification scripts
- The `audit.service.ts`, `fee-management.service.ts`, `fee-collection.service.ts`, `device.service.ts`, `outing-log-history.service.ts`, etc.

### Recommended Priority Actions
1. **Immediate:** Fix C1-C3 (hardcoded secrets, CORS, token leakage) — these are exploitable now.
2. **Urgent:** Fix H1 (register all routes), H3 (unauthenticated admin endpoints).
3. **Soon:** Fix all HIGH and MEDIUM items in order of severity.
