const assert = require('assert');
const http = require('http');

const API_BASE = 'http://localhost:5001/api';

async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
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

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('=== Running Step 10 Management Dashboard API & Security Tests ===\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${total}. ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // 1. Unauthenticated rejection
  await test('1. Unauthenticated GET /api/management/dashboard rejected with 401', async () => {
    const res = await getJson('/management/dashboard');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Authentication required/i);
  });

  // 2. Student rejection from Management Dashboard & Login
  let studentToken = '';
  await test('2a. Student login succeeds at /api/auth/login for token generation', async () => {
    const res = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.token, 'Student token required');
    studentToken = res.data.token;
  });

  await test('2b. Student role rejected from GET /api/management/dashboard with 403 Forbidden', async () => {
    const res = await getJson('/management/dashboard', studentToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Access denied/i);
  });

  await test('2c. Student credentials rejected from POST /api/management/auth/login with 403', async () => {
    const res = await postJson('/management/auth/login', {
      username: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Student accounts cannot access the management portal/i);
  });

  // 3. Unauthorized management rejection
  await test('3a. Invalid management credentials rejected with 401', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'WrongPassword!',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  await test('3b. Empty identifier or password rejected with 400', async () => {
    const res1 = await postJson('/management/auth/login', { password: 'Password@123' });
    assert.strictEqual(res1.status, 400);

    const res2 = await postJson('/management/auth/login', { username: 'WARDEN01', password: '' });
    assert.strictEqual(res2.status, 400);
  });

  // 4. Authorized management success
  let wardenToken = '';
  await test('4a. Authorized warden credentials authenticate successfully with 200 and JWT', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token, 'Warden token must be generated');
    assert.strictEqual(res.data.user.jntuNo, 'WARDEN01');
    assert.strictEqual(res.data.user.role, 'WARDEN');
    wardenToken = res.data.token;
  });

  await test('4b. Warden GET /api/management/auth/me returns authenticated management profile', async () => {
    const res = await getJson('/management/auth/me', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.jntuNo, 'WARDEN01');
    assert.strictEqual(res.data.user.role, 'WARDEN');
  });

  let dashboardData = null;
  await test('4c. Authorized warden accesses GET /api/management/dashboard with 200', async () => {
    const res = await getJson('/management/dashboard', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.data, 'Dashboard data must exist');
    dashboardData = res.data.data;
  });

  // 5. Correct resident metrics
  await test('5. Dashboard returns authoritative Resident Presence Metrics from PostgreSQL', async () => {
    const r = dashboardData.residents;
    assert(typeof r.totalResidents === 'number');
    assert(r.totalResidents >= 3, 'At least 3 active students in PostgreSQL');
    assert(r.activeResidents >= 1, 'At least 1 allocated resident in PostgreSQL');
    assert(typeof r.currentlyInside === 'number');
    assert(typeof r.currentlyOutside === 'number');
    assert.strictEqual(r.currentlyInside + r.currentlyOutside, r.totalResidents, 'Inside + outside must match total');
    assert(typeof r.onLeave === 'number');
    assert(typeof r.suspended === 'number');
  });

  // 6. Correct room metrics
  await test('6. Dashboard returns authoritative Room Occupancy Metrics from PostgreSQL', async () => {
    const rm = dashboardData.rooms;
    assert(typeof rm.totalRooms === 'number');
    assert(rm.totalRooms >= 2, 'At least 2 distinct rooms in database');
    assert(rm.occupied >= 1, 'At least 1 occupied room');
    assert(typeof rm.partiallyOccupied === 'number');
    assert(rm.vacant >= 1, 'At least 1 vacant room');
    assert(typeof rm.occupancyPercentage === 'number');
    assert(rm.occupancyPercentage >= 0 && rm.occupancyPercentage <= 100);
    assert(rm.totalCapacity >= 4, 'Total capacity computed dynamically');
    assert(rm.allocatedBeds >= 2, 'Allocated beds matches real student occupants');
  });

  // 7. Correct outing metrics
  await test('7. Dashboard returns authoritative Outing Metrics (pending, approved, out)', async () => {
    const reqs = dashboardData.requests;
    assert(typeof reqs.pendingOutings === 'number');
    assert(typeof reqs.approvedOutings === 'number');
    assert(typeof reqs.outOutings === 'number');
  });

  // 8. Correct leave metrics
  await test('8. Dashboard returns authoritative Leave Metrics (pending leaves, active leaves, suspensions)', async () => {
    const reqs = dashboardData.requests;
    assert(typeof reqs.pendingLeaves === 'number');
    assert(typeof reqs.activeLeaves === 'number');
    assert(typeof reqs.activeSuspensions === 'number');
  });

  // 9. Correct complaint metrics
  await test('9. Dashboard returns authoritative Complaint Metrics (open, in-progress, resolved)', async () => {
    const reqs = dashboardData.requests;
    assert(typeof reqs.openComplaints === 'number');
    assert(typeof reqs.inProgressComplaints === 'number');
    assert(typeof reqs.resolvedComplaints === 'number');
    assert(reqs.openComplaints >= 11, 'At least 11 open complaints in PostgreSQL');
    assert.strictEqual(
      reqs.actionableTotal,
      reqs.pendingOutings + reqs.pendingLeaves + reqs.openComplaints
    );
  });

  // 10. Correct biometric presence metrics
  await test('10. Dashboard derives presence from verified BiometricEvents and passes', async () => {
    const r = dashboardData.residents;
    const bio = dashboardData.recentBiometricEvents;
    assert(Array.isArray(bio));
    assert(bio.length > 0, 'Recent biometric events must be populated');
    assert(bio[0].eventType && bio[0].verificationStatus && bio[0].student.name);
    assert(r.currentlyInside >= 0 && r.currentlyInside <= r.totalResidents);
    assert(r.currentlyOutside >= 0 && r.currentlyOutside <= r.totalResidents);
  });

  // 11. Recent activity
  await test('11. Dashboard returns recent ActivityLog records with actor, actionType, timestamp', async () => {
    const act = dashboardData.recentActivity;
    assert(Array.isArray(act));
    assert(act.length > 0, 'Recent activity must be populated');
    assert(act[0].id && act[0].activityType && act[0].description);
    assert(act[0].timestamp, 'ISO timestamp required');
  });

  // 12. No unauthorized student data exposure
  await test('12. No sensitive credentials or unauthorized student data exposed in dashboard', async () => {
    const jsonStr = JSON.stringify(dashboardData);
    assert(!jsonStr.includes('passwordHash'), 'Password hashes must never be exposed');
    assert(!jsonStr.includes('Password@123'), 'Passwords must never be exposed');
    assert(!jsonStr.includes('jwtSecret'), 'JWT secrets must never be exposed');

    // Categorized Attention Items
    const att = dashboardData.attention;
    assert(Array.isArray(att));
    assert(att.length > 0, 'Attention items must reflect open complaints or pending requests');
    for (const item of att) {
      assert(['OUTING', 'LEAVE', 'COMPLAINT', 'SUSPENSION'].includes(item.category));
      assert(typeof item.isAvailable === 'boolean');
    }
  });

  // 13. Real-time Management SSE Stream
  await test('13. GET /api/management/events-stream establishes real-time SSE stream with 200', async () => {
    const res = await fetch(`${API_BASE}/management/events-stream`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    const contentType = res.headers.get('content-type') || '';
    assert(contentType.includes('text/event-stream'), 'Content-Type must be text/event-stream');
    res.body?.cancel();
  });

  console.log(`\n====================================================`);
  console.log(`         MANAGEMENT DASHBOARD TESTS PASSED          `);
  console.log(`====================================================`);
  console.log(`Total Passed: ${passed}/${total}`);
}

runTests().catch((err) => {
  console.error('Fatal error running management tests:', err);
  process.exit(1);
});
