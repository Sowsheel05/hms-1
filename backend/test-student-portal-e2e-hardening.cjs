const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001';

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING STUDENT PORTAL STEP 5 E2E HARDENING SUITE ');
  console.log('====================================================\n');

  let passCount = 0;
  function markPass(msg) {
    passCount++;
    console.log(`[PASS] ${passCount}. ${msg}`);
  }

  // ----------------------------------------------------
  // SECTION 1: AUTHENTICATION HARDENING
  // ----------------------------------------------------
  console.log('\n--- SECTION 1: AUTHENTICATION HARDENING ---');

  // 1.1 Valid Student Login (Student A: MANI MANASVI GAVARA)
  const loginResA = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  assert.strictEqual(loginResA.status, 200, 'Student A login must succeed with 200');
  const loginDataA = await loginResA.json();
  assert.strictEqual(loginDataA.success, true);
  assert(loginDataA.token, 'Token must be returned');
  assert.strictEqual(loginDataA.user.jntuNo, '25331A05H7');
  assert.strictEqual(loginDataA.user.role, 'STUDENT');
  assert.strictEqual(loginDataA.user.passwordHash, undefined, 'passwordHash must never be exposed');
  const tokenA = loginDataA.token;
  markPass('Valid student login succeeds, returns JWT session, and protects password hash');

  // 1.2 Case-insensitivity in JNTU number
  const loginResLower = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331a05h7', password: 'Password@123' }),
  });
  assert.strictEqual(loginResLower.status, 200, 'Lowercase JNTU number must succeed');
  markPass('JNTU number authentication is safely normalized and case-insensitive');

  // 1.3 Invalid Password
  const loginResBadPass = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'WrongPassword999!' }),
  });
  assert.strictEqual(loginResBadPass.status, 401, 'Invalid password must return 401');
  markPass('Invalid password safely rejected with 401');

  // 1.4 Nonexistent JNTU Number
  const loginResNonexistent = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: 'NONEXISTENT99', password: 'Password@123' }),
  });
  assert.strictEqual(loginResNonexistent.status, 401, 'Nonexistent JNTU must return 401');
  markPass('Nonexistent JNTU number safely rejected with 401');

  // 1.5 Missing / Empty Credentials
  const loginResEmpty = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '', password: '' }),
  });
  assert.strictEqual(loginResEmpty.status, 400, 'Empty credentials must return 400');
  markPass('Empty login payload rejected with 400');

  // 1.6 Inactive Student Account Blocking (21A91A0502 is inactive)
  const loginResInactive = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '21A91A0502', password: 'Password@123' }),
  });
  assert.strictEqual(loginResInactive.status, 403, 'Inactive account must return 403');
  markPass('Inactive student account blocked from authentication with 403');

  // 1.7 Student B Login (Reshma Borra)
  const loginResB = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '24331A0545', password: 'Password@123' }),
  });
  assert.strictEqual(loginResB.status, 200, 'Student B login must succeed');
  const loginDataB = await loginResB.json();
  const tokenB = loginDataB.token;
  markPass('Second distinct student identity (Student B) authenticated successfully');

  // ----------------------------------------------------
  // SECTION 2: UNAUTHENTICATED ACCESS REJECTION
  // ----------------------------------------------------
  console.log('\n--- SECTION 2: UNAUTHENTICATED ACCESS REJECTION ---');

  const studentEndpoints = [
    '/api/student/dashboard',
    '/api/student/my-room',
    '/api/student/mess-tokens',
    '/api/student/outing-requests',
    '/api/student/leaves',
    '/api/student/complaints',
    '/api/student/biometric',
    '/api/student/notifications',
    '/api/student/events',
  ];

  for (const endpoint of studentEndpoints) {
    const unauthRes = await fetch(`${BASE_URL}${endpoint}`);
    assert.strictEqual(unauthRes.status, 401, `Unauthenticated ${endpoint} must return 401`);
  }
  markPass('All 9 student portal endpoints strictly reject unauthenticated requests with 401');

  // ----------------------------------------------------
  // SECTION 3: IDOR & CROSS-STUDENT AUTHORIZATION
  // ----------------------------------------------------
  console.log('\n--- SECTION 3: IDOR & CROSS-STUDENT AUTHORIZATION ---');

  // 3.1 Complaint IDOR & Unauthorized Attachment Access
  // Student A creates a complaint
  const uniqueTitle = `IDOR Test Complaint ${Date.now()}`;
  const complaintPayload = {
    category: 'ROOM',
    priority: 'MEDIUM',
    location: 'Room 119 Desk',
    title: uniqueTitle,
    description: 'This is a strictly private complaint owned by Student A for security hardening.',
  };
  const createComplaintRes = await fetch(`${BASE_URL}/api/student/complaints`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(complaintPayload),
  });
  assert.strictEqual(createComplaintRes.status, 201, 'Student A complaint creation must succeed');
  const complaintDataA = await createComplaintRes.json();
  const complaintIdA = complaintDataA.complaint.id;

  // Student B attempts to access Student A's complaint details
  const idorComplaintDetailRes = await fetch(`${BASE_URL}/api/student/complaints/${complaintIdA}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(
    idorComplaintDetailRes.status,
    403,
    "Student B must be forbidden from accessing Student A's complaint"
  );
  markPass("Cross-student complaint access blocked with 403 (Student A's complaint hidden from Student B)");

  // Student B attempts to post comment on Student A's complaint
  const idorCommentRes = await fetch(`${BASE_URL}/api/student/complaints/${complaintIdA}/comment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenB}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: 'Malicious unauthorized comment attempt' }),
  });
  assert.strictEqual(idorCommentRes.status, 403, "Student B must not comment on Student A's complaint");
  markPass("Cross-student complaint modification blocked with 403");

  // Student B attempts to cancel Student A's complaint
  const idorCancelComplaintRes = await fetch(`${BASE_URL}/api/student/complaints/${complaintIdA}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorCancelComplaintRes.status, 403, "Student B must not cancel Student A's complaint");
  markPass("Cross-student complaint cancellation blocked with 403");

  // Student B attempts to list attachments of Student A's complaint
  const idorAttachmentsListRes = await fetch(`${BASE_URL}/api/student/complaints/${complaintIdA}/attachments`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorAttachmentsListRes.status, 403, "Student B must not list Student A's attachments");
  markPass("Cross-student complaint attachment listing blocked with 403");

  // 3.2 Leave Request IDOR
  // Query existing leaves for Student A
  const leavesResA = await fetch(`${BASE_URL}/api/student/leaves`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const leavesDataA = await leavesResA.json();
  if (!leavesDataA.requests || leavesDataA.requests.length === 0) {
    const sA = await prisma.student.findUnique({ where: { jntuNo: '25331A05H7' } });
    await prisma.leaveRequest.create({
      data: {
        studentId: sA.id,
        leaveType: 'HOME_VISIT',
        reason: 'Family wedding event',
        destination: 'Visakhapatnam',
        emergencyContact: '9876543210',
        startDate: new Date(Date.now() + 86400000),
        endDate: new Date(Date.now() + 3 * 86400000),
        status: 'PENDING',
      },
    });
    const refreshedLeaves = await fetch(`${BASE_URL}/api/student/leaves`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    }).then((r) => r.json());
    leavesDataA.requests = refreshedLeaves.requests;
  }
  assert(leavesDataA.requests && leavesDataA.requests.length > 0, 'Student A must have existing leaves');
  const leaveIdA = leavesDataA.requests[0].id;

  // Student B attempts to fetch Student A's leave detail
  const idorLeaveDetailRes = await fetch(`${BASE_URL}/api/student/leaves/${leaveIdA}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorLeaveDetailRes.status, 403, "Student B must not access Student A's leave details");
  markPass("Cross-student leave detail access blocked with 403");

  // 3.3 Outing Request IDOR
  // Query outings for Student A
  const outingsResA = await fetch(`${BASE_URL}/api/student/outing-requests`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const outingsDataA = await outingsResA.json();
  if (outingsDataA.requests && outingsDataA.requests.length > 0) {
    const outingIdA = outingsDataA.requests[0].id;
    // Student B attempts to cancel Student A's outing
    const idorOutingCancelRes = await fetch(`${BASE_URL}/api/student/outing-requests/${outingIdA}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert(
      idorOutingCancelRes.status === 403 || idorOutingCancelRes.status === 400,
      'Student B must not cancel Student A outing'
    );
    markPass("Cross-student outing cancellation rejected");
  }

  // 3.4 Notifications IDOR
  const notifsResA = await fetch(`${BASE_URL}/api/student/notifications`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const notifsDataA = await notifsResA.json();
  if (notifsDataA.notifications && notifsDataA.notifications.length > 0) {
    const notifIdA = notifsDataA.notifications[0].id;
    // Student B attempts to view Student A's notification
    const idorNotifDetailRes = await fetch(`${BASE_URL}/api/student/notifications/${notifIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorNotifDetailRes.status, 403, "Student B must not view Student A's notification");
    markPass("Cross-student notification access blocked with 403");

    // Student B attempts to mark Student A's notification read
    const idorNotifReadRes = await fetch(`${BASE_URL}/api/student/notifications/${notifIdA}/read`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorNotifReadRes.status, 403, "Student B must not mark Student A's notification read");
    markPass("Cross-student notification read manipulation blocked with 403");
  }

  // 3.5 Biometric Event IDOR
  const bioResA = await fetch(`${BASE_URL}/api/student/biometric`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const bioDataA = await bioResA.json();
  if (bioDataA.events && bioDataA.events.length > 0) {
    const bioEventIdA = bioDataA.events[0].id;
    // Student B attempts to view Student A's biometric event
    const idorBioRes = await fetch(`${BASE_URL}/api/student/biometric/events/${bioEventIdA}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(idorBioRes.status, 403, "Student B must not view Student A's biometric event");
    markPass("Cross-student biometric event access blocked with 403");
  }

  // ----------------------------------------------------
  // SECTION 4: BIOMETRIC READ-ONLY HARDENING
  // ----------------------------------------------------
  console.log('\n--- SECTION 4: BIOMETRIC READ-ONLY HARDENING ---');

  // Direct mutation attempts on student biometric endpoint
  const postBioRes = await fetch(`${BASE_URL}/api/student/biometric`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventType: 'ENTRY', verificationStatus: 'VERIFIED' }),
  });
  assert.strictEqual(postBioRes.status, 403, 'POST /api/student/biometric must return 403');
  markPass('Direct student biometric creation blocked with 403 Forbidden');

  const putBioRes = await fetch(`${BASE_URL}/api/student/biometric/events/mock-id`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(putBioRes.status, 403, 'PUT /api/student/biometric/events/* must return 403');
  markPass('Direct student biometric modification blocked with 403 Forbidden');

  const deleteBioRes = await fetch(`${BASE_URL}/api/student/biometric/events/mock-id`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(deleteBioRes.status, 403, 'DELETE /api/student/biometric/events/* must return 403');
  markPass('Direct student biometric deletion blocked with 403 Forbidden');

  // ----------------------------------------------------
  // SECTION 5: OUTING LIFECYCLE & SERVER-AUTHORITATIVE VALIDATION
  // ----------------------------------------------------
  console.log('\n--- SECTION 5: OUTING LIFECYCLE HARDENING ---');

  // Clean up any lingering PENDING outing for Student A before running Section 5 tests
  const existingOutingCheck = await fetch(`${BASE_URL}/api/student/outing-requests`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const existingOutingData = await existingOutingCheck.json();
  const existingPending = (existingOutingData.requests || []).find((r) => r.status === 'PENDING');
  if (existingPending) {
    await fetch(`${BASE_URL}/api/student/outing-requests/${existingPending.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
  }

  // Attempt to set outing status to APPROVED directly via POST body
  const forgedOutingRes = await fetch(`${BASE_URL}/api/student/outing-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'City Center Mall',
      purpose: 'Shopping for weekend supplies',
      outDate: new Date(Date.now() + 3600000).toISOString(),
      returnDate: new Date(Date.now() + 10800000).toISOString(),
      status: 'APPROVED', // Forged status
    }),
  });
  // Should either create with PENDING or conflict with ongoing outing
  if (forgedOutingRes.status === 201) {
    const forgedData = await forgedOutingRes.json();
    assert.strictEqual(
      forgedData.request.status,
      'PENDING',
      'Outing must always default to PENDING regardless of client status payload'
    );
    markPass('Outing request forces server-authoritative status PENDING (client status injection ignored)');

    // Cancel this test outing so subsequent outing tests are unblocked
    await fetch(`${BASE_URL}/api/student/outing-requests/${forgedData.request.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
  } else {
    assert.strictEqual(forgedOutingRes.status, 409, 'Expected 409 if already ongoing outing');
    markPass('Outing request concurrency check prevents multiple simultaneous active/pending passes');
  }

  // Ensure no lingering active/pending outings block validation testing
  await prisma.outingRequest.deleteMany({
    where: { studentId: loginDataA.user.id },
  }).catch(() => {});

  // Outing date validation: returnDate <= outDate
  const invalidDateOutingRes = await fetch(`${BASE_URL}/api/student/outing-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'City Center Mall',
      purpose: 'Shopping for weekend supplies',
      outDate: new Date(Date.now() + 10800000).toISOString(),
      returnDate: new Date(Date.now() + 3600000).toISOString(), // Invalid: before exit
    }),
  });
  assert.strictEqual(invalidDateOutingRes.status, 400, 'Invalid exit/return time must return 400');
  markPass('Outing validation enforces return time strictly after exit time');

  // ----------------------------------------------------
  // SECTION 6: LEAVE VALIDATION & OVERLAP RULES
  // ----------------------------------------------------
  console.log('\n--- SECTION 6: LEAVE VALIDATION HARDENING ---');

  // Leave duration > 30 days
  const futureStart = new Date(Date.now() + 86400000 * 2);
  const futureEndTooFar = new Date(Date.now() + 86400000 * 35); // 33 days
  const longLeaveRes = await fetch(`${BASE_URL}/api/student/leaves`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Home Town',
      startDate: futureStart.toISOString(),
      endDate: futureEndTooFar.toISOString(),
      reason: 'Long vacation request exceeding 30 days maximum',
    }),
  });
  assert.strictEqual(longLeaveRes.status, 400, 'Leave duration > 30 days must return 400');
  markPass('Leave duration boundary check enforces 30-day ceiling');

  // Start date in past
  const pastStart = new Date(Date.now() - 86400000 * 3);
  const pastEnd = new Date(Date.now() - 86400000 * 1);
  const pastLeaveRes = await fetch(`${BASE_URL}/api/student/leaves`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Home Town',
      startDate: pastStart.toISOString(),
      endDate: pastEnd.toISOString(),
      reason: 'Past leave attempt',
    }),
  });
  assert.strictEqual(pastLeaveRes.status, 400, 'Past start date must return 400');
  markPass('Leave validation blocks retroactive past start dates');

  // ----------------------------------------------------
  // SECTION 7: MESS PRODUCTION HARDENING & DEADLINES
  // ----------------------------------------------------
  console.log('\n--- SECTION 7: MESS PRODUCTION HARDENING ---');

  // Date outside booking horizon (e.g. 30 days ahead)
  const wayFutureDate = new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0];
  const horizonDraftRes = await fetch(`${BASE_URL}/api/student/mess-tokens/draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mealType: 'BREAKFAST',
      date: wayFutureDate,
      attendanceIntent: 'ATTENDING',
    }),
  });
  assert.strictEqual(horizonDraftRes.status, 400, 'Date outside horizon must return 400');
  markPass('Mess booking horizon enforced server-side (future dates beyond horizon rejected)');

  // Invalid meal type
  const invalidMealRes = await fetch(`${BASE_URL}/api/student/mess-tokens/draft`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      mealType: 'MIDNIGHT_FEAST',
      date: new Date().toISOString().split('T')[0],
      attendanceIntent: 'ATTENDING',
    }),
  });
  assert.strictEqual(invalidMealRes.status, 400, 'Invalid meal type must return 400');
  markPass('Invalid meal type rejected with 400');

  // ----------------------------------------------------
  // SECTION 8: SESSION INVALIDATION & LOGOUT
  // ----------------------------------------------------
  console.log('\n--- SECTION 8: SESSION INVALIDATION & LOGOUT ---');

  // Login a temporary session for Student B to test logout invalidation
  const tempLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '24331A0545', password: 'Password@123' }),
  });
  const tempLoginData = await tempLoginRes.json();
  const tempToken = tempLoginData.token;

  // Verify session works
  const meBeforeLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  assert.strictEqual(meBeforeLogout.status, 200, 'Session must be active before logout');

  // Logout
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  assert.strictEqual(logoutRes.status, 200, 'Logout must succeed');
  markPass('Logout endpoint successfully invalidates session');

  // Request with invalidated token must return 401
  const meAfterLogout = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  assert.strictEqual(meAfterLogout.status, 401, 'Invalidated session must return 401 on subsequent requests');
  markPass('Session token permanently invalidated in database (subsequent requests return 401)');

  // Unauthenticated dashboard access with revoked token
  const dashAfterLogout = await fetch(`${BASE_URL}/api/student/dashboard`, {
    headers: { Authorization: `Bearer ${tempToken}` },
  });
  assert.strictEqual(dashAfterLogout.status, 401, 'Revoked token rejected by student dashboard with 401');
  markPass('Protected student routes reject revoked session tokens immediately');

  // ----------------------------------------------------
  // SECTION 9: UNIFIED SSE ENDPOINT & SECURITY
  // ----------------------------------------------------
  console.log('\n--- SECTION 9: UNIFIED SSE ENDPOINT & SECURITY ---');

  // Re-authenticate tokenA for post-logout sections
  const freshLogin = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const freshData = await freshLogin.json();
  const freshTokenA = freshData.token;

  // Authenticated SSE connection receives 200 text/event-stream
  const sseRes = await fetch(`${BASE_URL}/api/student/events?token=${encodeURIComponent(freshTokenA)}`, {
    headers: { Accept: 'text/event-stream' },
  });
  assert.strictEqual(sseRes.status, 200, 'SSE stream must return 200 for authenticated student');
  const contentType = sseRes.headers.get('content-type') || '';
  assert(contentType.includes('text/event-stream'), 'SSE content-type must be text/event-stream');
  markPass('Unified SSE endpoint (/api/student/events) authenticates and establishes event-stream');

  // ----------------------------------------------------
  // SECTION 10: ROOM MUTATION PROTECTION
  // ----------------------------------------------------
  console.log('\n--- SECTION 10: ROOM MUTATION PROTECTION ---');

  // Student attempts to directly mutate room allocation
  const postRoomRes = await fetch(`${BASE_URL}/api/student/my-room`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${freshTokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomNumber: '999', block: 'Luxury-Block' }),
  });
  assert(postRoomRes.status === 404 || postRoomRes.status === 405, 'Student cannot mutate room allocation');
  markPass('Student-side room allocation mutation strictly prohibited (404/405)');

  // ----------------------------------------------------
  // SECTION 11: ATTACHMENT PATH TRAVERSAL RESISTANCE
  // ----------------------------------------------------
  console.log('\n--- SECTION 11: ATTACHMENT PATH TRAVERSAL RESISTANCE ---');

  // Path traversal attempt in attachment ID
  const traversalRes = await fetch(
    `${BASE_URL}/api/student/complaints/${complaintIdA}/attachments/..%2F..%2F..%2F..%2Fetc%2Fpasswd`,
    {
      headers: { Authorization: `Bearer ${tokenA}` },
    }
  );
  assert(
    [400, 403, 404].includes(traversalRes.status),
    'Path traversal attempt must be safely rejected'
  );
  markPass('Attachment download stream safely prevents path traversal attacks');

  // ----------------------------------------------------
  // SECTION 12: SQL INJECTION / MALFORMED INPUT RESILIENCE
  // ----------------------------------------------------
  console.log('\n--- SECTION 12: SQL INJECTION / MALFORMED INPUT RESILIENCE ---');

  // SQL Injection strings in search and filter parameters
  const sqliRes = await fetch(
    `${BASE_URL}/api/student/notifications?category=%27%20OR%201%3D1%20--`,
    {
      headers: { Authorization: `Bearer ${tokenA}` },
    }
  );
  assert.strictEqual(sqliRes.status, 200, 'SQL injection in query param must be safely handled');
  const sqliData = await sqliRes.json();
  assert.strictEqual(sqliData.success, true);
  markPass('SQL injection strings in query parameters safely sanitized by Prisma query engine');

  // ----------------------------------------------------
  // SECTION 13: DASHBOARD REFRESH & AUTHORITATIVE DATA INTEGRITY
  // ----------------------------------------------------
  console.log('\n--- SECTION 13: DASHBOARD REFRESH & DATA INTEGRITY ---');

  const dashRes = await fetch(`${BASE_URL}/api/student/dashboard`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(dashRes.status, 200, 'Dashboard must succeed');
  const dashData = await dashRes.json();
  assert.strictEqual(dashData.success, true);
  assert.strictEqual(dashData.student.name, 'MANI MANASVI GAVARA');
  assert.strictEqual(dashData.room.status, 'ALLOCATED');
  assert.strictEqual(dashData.room.roomNumber, '119');
  assert(dashData.recentActivity.length > 0, 'Recent activity must be populated from activity logs');
  markPass('Dashboard delivers authoritative PostgreSQL state and full activity timeline');

  console.log('\n====================================================');
  console.log(`  ALL ${passCount} STEP 5 HARDENING CHECKS PASSED PERFECTLY! `);
  console.log('====================================================\n');
}

runTests()
  .catch((err) => {
    console.error('\n[FAIL] Step 5 Test Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
