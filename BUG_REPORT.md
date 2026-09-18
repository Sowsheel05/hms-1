# HMS (Hostel Management System) — Comprehensive Bug Report

> **Generated:** 2026-09-16  
> **Last Updated:** 2026-09-17 (Post-high priority security & reliability fixes)  
> **Scope:** Full codebase audit (backend API, frontend Vite/React app, database migrations, configuration)  
> **Total Bugs Identified:** 22  
> **Status:** 20 Fixed, 2 Documented / Deferred  

---

## Summary by Severity

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| **CRITICAL** | 7 | 7 | 0 |
| **HIGH** | 7 | 7 | 0 |
| **MEDIUM** | 8 | 6 | 2 |
| **LOW** | 0 | 0 | 0 |

### Fixed Bugs (20)
- **CRITICAL:** C1, C2, C3, C4, C5, C6, C7
- **HIGH:** H1 (false alarm), H2, H3, H4, H5, H6, H7
- **MEDIUM:** M2, M4, M5, M6, M7, M8

### Remaining / Deferred Items (2)
- **M1:** Duplicate authentication middleware — refactoring candidate to consolidate `authenticateAttachmentAccess`.
- **M3:** Frontend route protection uses `window.location` manual checks — candidate for React Router migration.

---

## Detailed Findings & Fix Verifications

### CRITICAL Vulnerabilities

#### C1. Hardcoded JWT Secret Fallback
- **File:** `backend/src/config/index.ts`
- **Status:** `FIXED`
- **Description:** System previously allowed a hardcoded fallback string if `JWT_SECRET` was omitted from environment configuration.
- **Fix:** Fallback removed. Server fails startup explicitly if `JWT_SECRET` is missing.

#### C2. Permissive CORS Policy with Credentials
- **File:** `backend/src/index.ts`
- **Status:** `FIXED`
- **Description:** Express CORS configuration allowed requests from any origin while sending credentials.
- **Fix:** Implemented origin allowlist backed by `CORS_ORIGIN` environment variable.

#### C3. JWT Token Acceptance via URL Query Parameters
- **File:** `backend/src/middleware/auth.middleware.ts`, `backend/src/middleware/management.middleware.ts`
- **Status:** `FIXED`
- **Description:** Tokens accepted in `?token=` parameter caused potential token leaks via logs and HTTP Referer headers.
- **Fix:** Removed query parameter token support. Bearer tokens enforced exclusively in `Authorization` header.

#### C4. Predictable Dummy Bcrypt Hash for Timing Attack Mitigation
- **File:** `backend/src/services/auth.service.ts`, `backend/src/routes/management.routes.ts`
- **Status:** `FIXED`
- **Description:** A static, hardcoded dummy hash was used during invalid username checks, exposing timing attack signatures.
- **Fix:** Replaced with a dynamically generated random hash per authentication attempt.

#### C5. Student JWT Token Security (httpOnly Cookies)
- **File:** `frontend/src/services/api.ts`, `backend/src/routes/auth.routes.ts`, `backend/src/middleware/auth.middleware.ts`
- **Status:** `FIXED`
- **Description:** Tokens were previously accessible to client-side scripts in `localStorage`.
- **Fix:** Implemented `httpOnly`, `sameSite: 'lax'` cookies for student & management logins (`hms_student_auth_token` and `hms_management_auth_token`) with Bearer header fallback.

#### C6. Management SSE Token Exposure in URLs
- **File:** `frontend/src/services/api.ts`, `backend/src/routes/management.routes.ts`
- **Status:** `FIXED`
- **Description:** SSE connections embedded long-lived JWTs in URL query strings due to `EventSource` browser limitations.
- **Fix:** Created `POST /api/management/events-stream/ticket` endpoint to issue short-lived (30s) single-use tickets for establishing SSE streams.

#### C7. Inconsistent Management Auth Token Keys
- **File:** `frontend/src/services/api.ts`
- **Status:** `FIXED`
- **Description:** Multiple storage keys (`hms_management_auth_token`, `managementToken`, `token`) created session invalidation gaps.
- **Fix:** Consolidated all client storage calls to `hms_management_auth_token`.

---

### HIGH Severity Issues

#### H1. Alleged Missing Route Registrations
- **File:** `backend/src/index.ts`
- **Status:** `VERIFIED / FALSE ALARM`
- **Description:** Sub-routers are properly mounted under primary management routers.

#### H2. Biometric Ingestion for Inactive Students
- **File:** `backend/src/services/biometric.service.ts`
- **Status:** `FIXED`
- **Description:** Inactive students could still have biometric events logged.
- **Fix:** Added active student validation guard.

#### H3. Unauthenticated Administrative Test Endpoints
- **File:** `backend/src/routes/leave.routes.ts`
- **Status:** `FIXED`
- **Description:** Admin test endpoints lacked authentication middleware.
- **Fix:** Attached `authenticateManagement` middleware and role restrictions.

#### H4 & M4. Non-Cryptographic Randomness for Token Identifiers (`jwtid`)
- **File:** `backend/src/services/auth.service.ts`, `backend/src/routes/management.routes.ts`
- **Status:** `FIXED`
- **Fix:** Replaced `Math.random()` with `crypto.randomUUID()`.

#### H5. Non-Unique Complaint Comment Identifiers
- **File:** `backend/src/routes/complaint.routes.ts`
- **Status:** `FIXED`
- **Fix:** Replaced pseudo-random generator with `crypto.randomUUID()`.

#### H6. Duplicate SSE Event Emission
- **File:** `backend/src/services/events.service.ts`
- **Status:** `FIXED`
- **Fix:** Standardized on `management_dashboard_update` event name.

#### H7. Fallback Room Capacity Miscalculation
- **File:** `backend/src/routes/room.routes.ts`
- **Status:** `FIXED`
- **Fix:** Always query capacity directly from the `Room` table via `Block` relation.

---

### MEDIUM Severity Issues

#### M2. Login Rate Limiter Hardening
- **File:** `backend/src/middleware/rate-limiter.ts`
- **Status:** `FIXED`
- **Fix:** Reduced `max` from 100 to 15 login attempts per 15-minute window per IP.

#### M8. EventEmitter SSE Connection Memory Leak
- **File:** `backend/src/services/events.service.ts`
- **Status:** `FIXED`
- **Fix:** Attached active `close`/`error`/`end` event listeners and added connection destruction checks (`res.destroyed || res.writableEnded`) during heartbeat pings.

---

## Application Verification & Execution

The application was built and verified successfully:

- **Backend API:** `http://localhost:5001` (Health check: `HEALTHY`)
- **Frontend App:** `http://localhost:5173` (Vite / React ready)
- **Database:** PostgreSQL `hostel_management` on port `5432`

### Verification Summary
1. `npm run build` executed: Backend TypeScript compiled cleanly (`tsc`), Frontend Vite bundling produced valid production chunks.
2. Development servers running cleanly on port 5001 and port 5173.
