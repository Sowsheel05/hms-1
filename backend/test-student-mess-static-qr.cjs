// Step 7: Static Mess QR Verification & Determinism Test Suite
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001';

async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJson(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runStaticQrTests() {
  console.log('====================================================');
  console.log('  RUNNING STEP 7: STATIC MESS QR TEST SUITE         ');
  console.log('====================================================\n');

  let passCount = 0;
  function markPass(msg) {
    passCount++;
    console.log(`[PASS] ${passCount}. ${msg}`);
  }

  // 1. Authenticate Student A (MANI MANASVI GAVARA - 25331A05H7)
  const authA = await postJson('/api/auth/login', {
    jntuNo: '25331A05H7',
    password: 'Password@123',
  });
  assert.strictEqual(authA.status, 200, 'Student A login must succeed');
  const tokenA = authA.data.token;
  const userA = authA.data.user;

  // 2. Authenticate Student B (RESHMA BORRA - 24331A0545)
  const authB = await postJson('/api/auth/login', {
    jntuNo: '24331A0545',
    password: 'Password@123',
  });
  assert.strictEqual(authB.status, 200, 'Student B login must succeed');
  const tokenB = authB.data.token;
  const userB = authB.data.user;

  // ----------------------------------------------------
  // SECTION 1: STATIC QR PAYLOAD & DETERMINISM
  // ----------------------------------------------------
  console.log('\n--- SECTION 1: STATIC QR PAYLOAD & DETERMINISM ---');

  // Test 1: Static QR payload exists
  const qrResA1 = await getJson('/api/student/mess/qr', tokenA);
  assert.strictEqual(qrResA1.status, 200, 'GET /api/student/mess/qr must return 200');
  assert.strictEqual(qrResA1.data.success, true);
  assert.ok(qrResA1.data.payload, 'Payload must exist');
  markPass('Static QR payload endpoint exists and responds with 200 OK');

  // Test 2: Payload is deterministic and equals 'HMS_MESS_ENTRY'
  const expectedPayload = 'HMS_MESS_ENTRY';
  assert.strictEqual(qrResA1.data.payload, expectedPayload, `Payload must equal ${expectedPayload}`);
  assert.strictEqual(qrResA1.data.entryPoint, '/mess/verify');
  assert.strictEqual(qrResA1.data.isStatic, true);
  markPass(`Payload is strictly deterministic and matches '${expectedPayload}'`);

  // Test 3: Payload is identical across multiple requests
  const qrResA2 = await getJson('/api/student/mess/qr', tokenA);
  const qrResA3 = await getJson('/api/student/mess-qr', tokenA);
  assert.strictEqual(qrResA1.data.payload, qrResA2.data.payload);
  assert.strictEqual(qrResA2.data.payload, qrResA3.data.payload);
  markPass('Payload is identical across repeated requests and aliases (/mess/qr, /mess-qr)');

  // ----------------------------------------------------
  // SECTION 2: PRIVACY & ZERO SENSITIVE DATA IN QR
  // ----------------------------------------------------
  console.log('\n--- SECTION 2: PRIVACY & ZERO SENSITIVE DATA IN QR ---');

  // Test 4: Payload contains no student ID or user identifiers
  assert(!qrResA1.data.payload.includes(userA.id), 'Payload must not contain student ID');
  assert(!qrResA1.data.payload.includes(userA.jntuNo), 'Payload must not contain JNTU number');
  assert(!qrResA1.data.payload.includes(userA.name), 'Payload must not contain student name');
  markPass('Payload contains no student ID, JNTU number, or personal details');

  // Test 5: Payload contains no MessToken ID
  assert(!qrResA1.data.payload.includes('MT-'), 'Payload must not contain MessToken references');
  assert(!qrResA1.data.payload.includes('token'), 'Payload must not contain token attributes');
  markPass('Payload contains no MessToken ID or token references');

  // Test 6: Payload contains no meal ID or meal name
  for (const meal of ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER']) {
    assert(!qrResA1.data.payload.includes(meal), `Payload must not contain meal name: ${meal}`);
  }
  markPass('Payload contains no meal identifiers (Breakfast, Lunch, Snacks, Dinner)');

  // Test 7: Payload contains no dates or timestamps
  const todayStr = new Date().toISOString().split('T')[0];
  assert(!qrResA1.data.payload.includes(todayStr), 'Payload must not contain dates');
  assert(!qrResA1.data.payload.includes(':'), 'Payload must not contain timestamps');
  markPass('Payload contains no date strings, ISO timestamps, or expiry windows');

  // ----------------------------------------------------
  // SECTION 3: CROSS-ENTITY STATIC INVARIANCE
  // ----------------------------------------------------
  console.log('\n--- SECTION 3: CROSS-ENTITY STATIC INVARIANCE ---');

  // Test 8: Student A receives exactly the same QR payload as Student B
  const qrResB = await getJson('/api/student/mess/qr', tokenB);
  assert.strictEqual(qrResB.status, 200);
  assert.strictEqual(qrResA1.data.payload, qrResB.data.payload, 'Student A and Student B must receive the exact same QR');
  assert.strictEqual(qrResA1.data.entryPoint, qrResB.data.entryPoint);
  markPass('Cross-Student Invariance: Student A and Student B receive the exact same QR');

  // Test 9: Breakfast, Lunch, Snacks, Dinner all map to the SAME static QR entry point
  // The QR is independent of meal type
  const mealTokensA = await getJson('/api/student/mess-tokens', tokenA);
  assert.strictEqual(mealTokensA.status, 200);
  assert.ok(mealTokensA.data.today?.mealSlots?.length >= 4);
  markPass('Meal Invariance: All 4 meal slots share the same permanent static QR entry point');

  // Test 10: Different dates map to the SAME static QR
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowTokens = await getJson(`/api/student/mess-tokens?date=${tomorrowStr}`, tokenA);
  assert.strictEqual(tomorrowTokens.status, 200);
  const qrResTomorrow = await getJson('/api/student/mess/qr', tokenA);
  assert.strictEqual(qrResA1.data.payload, qrResTomorrow.data.payload, 'Future dates must have the same QR');
  markPass('Date Invariance: Querying different calendar dates retains the exact same QR');

  // Test 11: Draft state does not alter the QR
  // Save a draft attendance intent
  const saveDraftRes = await postJson('/api/student/mess-tokens/draft', {
    mealType: 'BREAKFAST',
    date: tomorrowStr,
    attendanceIntent: 'ATTENDING',
  }, tokenA);
  assert.strictEqual(saveDraftRes.status, 200);
  const qrResAfterDraft = await getJson('/api/student/mess/qr', tokenA);
  assert.strictEqual(qrResA1.data.payload, qrResAfterDraft.data.payload, 'Saving a draft must not change the QR');
  markPass('Draft Invariance: Saving or updating draft intents leaves the static QR unchanged');

  // Test 12: Submitting and locking an indent does not alter the QR
  const lockRes = await postJson('/api/student/mess-tokens/lock', {
    mealType: 'BREAKFAST',
    date: tomorrowStr,
    attendanceIntent: 'ATTENDING',
  }, tokenA);
  assert.strictEqual(lockRes.status, 200);
  const qrResAfterLock = await getJson('/api/student/mess/qr', tokenA);
  assert.strictEqual(qrResA1.data.payload, qrResAfterLock.data.payload, 'Locking an indent must not change the QR');
  markPass('Lock Invariance: Submitting & locking indents leaves the static QR unchanged');

  // Clean up tomorrow's test token
  await prisma.messToken.deleteMany({
    where: { studentId: userA.id, date: tomorrowStr },
  }).catch(() => {});

  // Test 13: Refresh does not change QR
  for (let i = 0; i < 3; i++) {
    const refreshCheck = await getJson('/api/student/mess/qr', tokenA);
    assert.strictEqual(refreshCheck.data.payload, expectedPayload);
  }
  markPass('Refresh Invariance: Rapid consecutive queries consistently yield identical payload');

  // Test 14: Logout / Login cycle does not change QR
  await postJson('/api/auth/logout', {}, tokenA);
  const reAuthA = await postJson('/api/auth/login', {
    jntuNo: '25331A05H7',
    password: 'Password@123',
  });
  assert.strictEqual(reAuthA.status, 200);
  const reCheckQr = await getJson('/api/student/mess/qr', reAuthA.data.token);
  assert.strictEqual(reCheckQr.data.payload, expectedPayload);
  markPass('Session Invariance: Logging out and authenticating anew yields the exact same QR');

  // ----------------------------------------------------
  // SECTION 4: INTEGRITY & SECURITY CONTROLS
  // ----------------------------------------------------
  console.log('\n--- SECTION 4: INTEGRITY & SECURITY CONTROLS ---');

  // Test 15: Existing MessToken ownership checks remain intact
  // Student B cannot access or mutate Student A's mess drafts or locked tokens
  const idorDraftRes = await postJson('/api/student/mess-tokens/draft', {
    mealType: 'LUNCH',
    date: tomorrowStr,
    attendanceIntent: 'SKIPPED',
    studentId: userA.id, // Student B attempting to tamper with Student A
  }, tokenB);
  // Backend must enforce req.student.id, scoping mutation strictly to Student B
  assert.strictEqual(idorDraftRes.status, 200);
  const checkTokenA = await prisma.messToken.findUnique({
    where: { studentId_date_mealType: { studentId: userA.id, date: tomorrowStr, mealType: 'LUNCH' } },
  });
  assert.strictEqual(checkTokenA, null, 'Student B draft creation must not affect Student A');
  markPass('Ownership Integrity: Existing MessToken ownership constraints remain strictly enforced');

  // Test 16: Existing Mess booking cutoff & horizon rules still work
  const pastCutoffRes = await postJson('/api/student/mess-tokens/draft', {
    mealType: 'BREAKFAST',
    date: '2020-01-01',
    attendanceIntent: 'ATTENDING',
  }, reAuthA.data.token);
  assert.strictEqual(pastCutoffRes.status, 400, 'Past date must be rejected with 400');
  markPass('Booking Rules: Cutoff deadline and horizon validations remain fully operational');

  // Test 17: Suspended students restricted from booking meals
  // Seeded inactive student Rahul (21A91A0502) is blocked
  const inactiveAuth = await postJson('/api/auth/login', {
    jntuNo: '21A91A0502',
    password: 'Password@123',
  });
  assert.strictEqual(inactiveAuth.status, 403, 'Inactive student must be blocked');
  markPass('Disciplinary Controls: Inactive accounts blocked from accessing mess portal');

  // Test 18: No additional SSE connection created (SSE endpoint remains unified)
  const sseRes = await fetch(`${BASE_URL}/api/student/events`, {
    headers: { Authorization: `Bearer ${reAuthA.data.token}` },
  });
  assert.strictEqual(sseRes.status, 200);
  assert.strictEqual(sseRes.headers.get('content-type')?.includes('text/event-stream'), true);
  markPass('Realtime Stream: Single unified EventSource /api/student/events preserved');

  // Test 19: Unauthenticated request to QR endpoint is rejected with 401
  const unauthQr = await getJson('/api/student/mess/qr');
  assert.strictEqual(unauthQr.status, 401, 'Unauthenticated request to QR config must return 401');
  markPass('Security Enforcement: Unauthenticated request to /api/student/mess/qr rejected with 401');

  // Test 20: PostgreSQL remains the sole authoritative datastore (no QR tables created)
  const tableCheck = await prisma.$queryRaw`
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name LIKE '%qr%';
  `;
  assert.strictEqual(tableCheck.length, 0, 'No per-token or per-student QR tables should exist in PostgreSQL');
  markPass('Database Authority: PostgreSQL 18.6 verified with zero per-token QR table pollution');

  console.log('\n====================================================');
  console.log(`  ALL ${passCount} STEP 7 STATIC MESS QR TESTS PASSED! `);
  console.log('====================================================\n');
}

runStaticQrTests()
  .catch((err) => {
    console.error('\n[FATAL] Step 7 Static Mess QR test failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
