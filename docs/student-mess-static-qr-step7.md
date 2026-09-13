# HMS Student Portal — Step 7: Static Mess QR Implementation

## 1. Objective
Introduce **ONE permanent static QR code** for the HMS Mess verification workflow within the Student Portal.
The QR code is identical for:
- Every student
- Every meal (Breakfast, Lunch, Snacks, Dinner)
- Every date (today, tomorrow, future horizon)
- Every MessToken
- Every booking and intent state
- Every session and page refresh

> "One permanent static QR is used as the HMS Mess verification entry point. The QR is identical for every student, meal, and date. Student-specific meal eligibility is determined from the authoritative PostgreSQL MessToken data and is not encoded in the QR."

---

## 2. Static QR Architecture
The static QR is an application entry-point gateway, NOT a dynamic credential.
- **Payload**: `HMS_MESS_ENTRY`
- **Application Entry Point**: `/mess/verify`
- **Resolution Principle**: Server-authoritative entitlement resolution in PostgreSQL. Scanning the QR guides an authorized verifier (e.g. hostel staff or warden scanner) to the verification gateway, where the resident's active indent is queried in real time.

```
       ONE PERMANENT STATIC QR
                 |
                 v
        HMS MESS VERIFICATION
                 |
                 v
         Identify Resident
                 |
                 v
        Identify Meal / Date
                 |
                 v
         Query PostgreSQL
                 |
                 v
      Check MessToken / Indent
                 |
                 v
           VALID / INVALID
```

---

## 3. Why One QR is Shared
- **Zero Token Leakage**: Unique per-token QRs create credential harvesting vectors if photographed or shared.
- **Offline & Paper Compatibility**: Physical printouts of the static QR can be mounted at mess dining hall turnstiles and service lines permanently without daily reprint overhead.
- **Decoupled Life Cycle**: Meal bookings, cancellations, skips, and draft updates do not require QR re-generation, invalidation, or cache-busting.
- **Server Authority**: The QR does not prove meal eligibility; PostgreSQL does.

---

## 4. QR Payload & Cleanliness
The QR payload is strictly deterministic and safe:
- **Payload**: `HMS_MESS_ENTRY`
- **Absence of Sensitive Data**:
  - NO Student ID
  - NO JNTU Number
  - NO MessToken ID
  - NO Room Number
  - NO Meal ID / Name
  - NO Date / Timestamp
  - NO JWT / Session Token
  - NO API Secrets / Hashes

---

## 5. Security Model
- **Non-Credential Status**: Scanning the QR alone grants no permissions, marks no tokens consumed, and reveals no private records.
- **Authentication**: Access to student mess configuration requires a valid student session (`401 Unauthorized` for unauthenticated requests).
- **IDOR Protection**: Student A cannot mutate or observe Student B's mess indents or drafts (`403 Forbidden`).
- **Input Sanitization**: All endpoint parameters are strictly parameterized by the Prisma query engine against SQL injection.

---

## 6. Student UI
- **On-Demand Token QR**:
  - In `MessTokensPage.tsx`, each confirmed eating meal slot (`isBooked` with `ATTENDING` intent) features a direct **`Token QR`** button in the card footer alongside the token reference.
  - Zero clutter: Standalone banner cards and redundant daily pass sections are eliminated.
  - Residents access their verification QR on-demand right where they inspect their confirmed meals.
- **Mobile-Friendly Modal** (`StaticMessQrModal`):
  - Clicking **`Token QR`** opens a high-contrast 240px scannable QR frame.
  - Tag: **PERMANENT STATIC ENTRY POINT**.
  - Server-authoritative callout and target metadata (`/mess/verify`).
  - Dismissible via **[CLOSE]** button, backdrop click, or `Escape` key.

---

## 7. Relationship Between QR and MessToken
| Attribute | Static Mess QR | MessToken (PostgreSQL) |
| :--- | :--- | :--- |
| **Scope** | Global (1 permanent QR) | Individual resident, meal, and date |
| **Dynamic?** | Never changes | Changes (DRAFT, BOOKED, SKIPPED, CONSUMED) |
| **Authoritative?** | Verification Entry Point | Source of truth for attendance intent |
| **Storage** | Static configuration | PostgreSQL `MessToken` table |
| **Exposure** | Publicly safe | Private to authenticated resident & staff |

---

## 8. Future Warden Verification Architecture
When the authorized Warden scanner is implemented in subsequent phases:
1. Warden authenticates with role `WARDEN` / `CHIEF_WARDEN`.
2. Warden scans the static QR code on student device or physical mess stand.
3. System routes to `/mess/verify`.
4. Warden verifies resident identity and target meal slot.
5. Backend queries PostgreSQL `MessToken` record for `(studentId, date, mealType)`.
6. Validates: `isLocked === true`, `status === 'BOOKED'`, `attendanceIntent === 'ATTENDING'`, `consumedAt === null`.
7. Transitions token to `CONSUMED` atomically with audit log.

---

## 9. Database Impact
- **Zero Schema Pollution**: No `qrCode`, `qrToken`, or `qrSecret` columns added to `MessToken` or `Student`.
- **Zero SQLite / Mock Stores**: PostgreSQL 18.6 remains the sole authoritative store.
- **Integrity**: Existing `MessToken` unique constraints (`studentId_date_mealType`) and foreign keys remain 100% intact.

---

## 10. Realtime Behavior
- **Zero QR Realtime Events**: No `QR_GENERATED` or `QR_ROTATED` events.
- **Preserved Unified SSE**: The single `/api/student/events` EventSource connection remains untouched.
- **Zero Polling**: No `setInterval` or `setTimeout` polling workarounds.

---

## 11. Tests & Regression
- **Dedicated Suite**: `backend/test-student-mess-static-qr.cjs` (20 automated tests).
  1. Static QR payload endpoint exists and responds with 200 OK.
  2. Payload is strictly deterministic (`HMS_MESS_ENTRY`).
  3. Payload is identical across repeated requests and aliases (`/mess/qr`, `/mess-qr`).
  4. Payload contains no student ID or user identifiers.
  5. Payload contains no MessToken ID or token references.
  6. Payload contains no meal identifiers.
  7. Payload contains no dates or timestamps.
  8. Cross-student invariance: Student A and Student B receive the exact same QR.
  9. Meal invariance: All 4 meals share the same permanent static QR.
  10. Date invariance: Different dates share the same QR.
  11. Draft invariance: Saving drafts does not alter the QR.
  12. Lock invariance: Locking indents does not alter the QR.
  13. Refresh invariance: Consecutive queries return identical payload.
  14. Session invariance: Logging out and in anew yields identical payload.
  15. Ownership integrity: MessToken ownership checks remain intact.
  16. Booking rules: Cutoff deadlines and horizon validations remain enforced.
  17. Disciplinary controls: Inactive students are blocked.
  18. Realtime stream: Single unified SSE stream preserved.
  19. Security: Unauthenticated access rejected with 401.
  20. Database authority: Zero QR tables created in PostgreSQL.
- **Full Regression**: **646 / 646 tests passed (31/31 suites, 100% pass rate)**.

---

## 12. Browser Verification
- Verified in browser using subagent (`step7_static_mess_qr_1789219465002.webp`):
  - Student A (`25331A05H7`) login -> Mess Tokens page -> HMS Mess QR section visible -> Modal opened -> Closed -> Selected next day -> QR remains identical -> Logout.
  - Student B (`24331A0545`) login -> Mess Tokens page -> HMS Mess QR section visible -> Modal opened -> Confirmed identical entry point `/mess/verify` -> Closed -> Logout.

---

## 13. Responsive Verification
- Verified responsive layout across mobile (`390x844`), tablet (`768x1024`), and desktop (`1440x900`).
- Clean image rendering, zero horizontal overflow, and fully accessible dialogs.

---

## 14. Security Verification
- Unauthenticated access returns `401 Unauthorized`.
- QR payload is static, deterministic, and safe for public display.
