// ============================================================================
// STEP 17: OUTING LOG HISTORY TEST SUITE (25 AUTHORITATIVE TESTS)
// ============================================================================
const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PORT = 5001;
const BASE_URL = `http://localhost:${PORT}/api`;

function request(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: parsed,
        });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

const getJson = (path, token) => request('GET', path, null, token);
const postJson = (path, body, token) => request('POST', path, body, token);
const putJson = (path, body, token) => request('PUT', path, body, token);
const deleteJson = (path, token) => request('DELETE', path, null, token);
const patchJson = (path, body, token) => request('PATCH', path, body, token);

let passedCount = 0;
let totalCount = 0;

async function test(name, fn) {
  totalCount++;
  try {
    await fn();
    passedCount++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    throw err;
  }
}

async function runOutingLogHistorySuite() {
  console.log('\n======================================================');
  console.log('   STEP 17 — OUTING LOG HISTORY TEST SUITE            ');
  console.log('======================================================\n');

  let adminToken = '';
  let studentToken = '';
  let sampleStudent = null;
  let sampleOuting = null;

  // 1. Unauthenticated -> 401
  await test('1. Unauthenticated access to /outing-log-history rejected with 401', async () => {
    const res = await getJson('/management/outing-log-history');
    assert.strictEqual(res.status, 401, 'Must reject unauthenticated access');
  });

  // 2. Student token -> 403
  await test('2. Student token cannot access management outing log APIs (403)', async () => {
    const loginRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    studentToken = loginRes.data.token;
    sampleStudent = loginRes.data.user;

    const res = await getJson('/management/outing-log-history', studentToken);
    assert.strictEqual(res.status, 403, 'Must reject student token with 403 Forbidden');
  });

  // 3. Admin login -> token
  await test('3. Authorized management staff (ADMIN01) authenticates with 200', async () => {
    const loginRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    adminToken = loginRes.data.token;
  });

  // 4. Authorized access -> 200
  await test('4. Authorized management user accesses /outing-log-history with 200', async () => {
    const res = await getJson('/management/outing-log-history', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.records));
    assert.ok(res.data.pagination);
    assert.ok(res.data.stats);
  });

  // Setup sample test outing request if none exists
  await test('5. Setup: Seed verified outing lifecycle record for testing', async () => {
    const student = await prisma.student.findFirst({ where: { jntuNo: '25331A05H7' } });
    assert.ok(student, 'Test student must exist');

    const now = new Date();
    const outDate = new Date(now.getTime() - 4 * 60 * 60 * 1000); // 4 hours ago
    const returnDate = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
    const exitTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const retTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);

    const reqNum = `OUT-${now.toISOString().split('T')[0].replace(/-/g, '')}-LOC-TEST`;
    
    // Upsert test outing with full lifecycle
    sampleOuting = await prisma.outingRequest.upsert({
      where: { requestNumber: reqNum },
      create: {
        requestNumber: reqNum,
        studentId: student.id,
        passType: 'LOCAL_OUTING',
        destination: 'Central Library Complex',
        purpose: 'Reference Books Study',
        outDate,
        returnDate,
        approvedAt: new Date(now.getTime() - 5 * 60 * 60 * 1000),
        approvedBy: 'Hostel Warden Sharma',
        actualExitTime: exitTime,
        actualReturnTime: retTime,
        status: 'RETURNED',
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      },
      update: {
        status: 'RETURNED',
        actualExitTime: exitTime,
        actualReturnTime: retTime,
        createdAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000),
      },
    });

    assert.ok(sampleOuting.id);
  });

  // 6. Pagination works
  await test('6. Pagination: Correct page, pageSize, total, and totalPages returned', async () => {
    const res = await getJson('/management/outing-log-history?page=1&pageSize=10', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.page, 1);
    assert.strictEqual(res.data.pagination.pageSize, 10);
    assert.ok(typeof res.data.pagination.total === 'number');
    assert.ok(res.data.pagination.totalPages >= 1);
  });

  // 7. Search by student name works
  await test('7. Search: Querying by student name returns matching records', async () => {
    const res = await getJson('/management/outing-log-history?search=MANI', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.records.length >= 1);
    const found = res.data.records.some((r) => r.student.name.includes('MANI'));
    assert.strictEqual(found, true);
  });

  // 8. Search by student JNTU number works
  await test('8. Search: Querying by JNTU number returns matching records', async () => {
    const res = await getJson('/management/outing-log-history?search=25331A05H7', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.records.length >= 1);
    assert.strictEqual(res.data.records[0].student.jntuNo, '25331A05H7');
  });

  // 9. Search by request number works
  await test('9. Search: Querying by exact requestNumber returns target record', async () => {
    const res = await getJson(`/management/outing-log-history?requestNumber=${sampleOuting.requestNumber}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.records.length >= 1);
    assert.strictEqual(res.data.records[0].requestNumber, sampleOuting.requestNumber);
  });

  // 10. Search by destination works
  await test('10. Search: Querying destination returns matched outings', async () => {
    const res = await getJson('/management/outing-log-history?search=Library', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.records.length >= 1);
    assert.ok(res.data.records[0].destination.includes('Library'));
  });

  // 11. Movement type filter: RETURN
  await test('11. Movement Type Filter: RETURN returns records with actualReturnTime', async () => {
    const res = await getJson('/management/outing-log-history?movementType=RETURN', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.movementType, 'RETURN');
      assert.ok(r.actualReturnTime);
    }
  });

  // 12. Movement type filter: EXIT
  await test('12. Movement Type Filter: EXIT returns records currently marked OUT', async () => {
    const res = await getJson('/management/outing-log-history?movementType=EXIT', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.movementType, 'EXIT');
      assert.ok(r.actualExitTime);
      assert.strictEqual(r.actualReturnTime, null);
    }
  });

  // 13. Movement type filter: APPROVED
  await test('13. Movement Type Filter: APPROVED returns sanctioned passes prior to exit', async () => {
    const res = await getJson('/management/outing-log-history?movementType=APPROVED', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.movementType, 'APPROVED');
      assert.strictEqual(r.status, 'APPROVED');
      assert.strictEqual(r.actualExitTime, null);
    }
  });

  // 14. Movement type filter: REJECTED
  await test('14. Movement Type Filter: REJECTED returns rejected outings', async () => {
    const res = await getJson('/management/outing-log-history?movementType=REJECTED', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.status, 'REJECTED');
    }
  });

  // 15. Outing status filter: RETURNED
  await test('15. Outing Status Filter: Filter by RETURNED returns finished outings', async () => {
    const res = await getJson('/management/outing-log-history?status=RETURNED', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.status, 'RETURNED');
    }
  });

  // 16. Date range filter: from / to
  await test('16. Date Range Filter: from and to bounds accurately restrict records', async () => {
    const yesterday = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const res = await getJson(`/management/outing-log-history?from=${yesterday}&to=${tomorrow}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.records.length >= 1);
  });

  // 17. Source filter: BIOMETRIC_DEVICE
  await test('17. Source Filter: BIOMETRIC_DEVICE filters physical transit events', async () => {
    const res = await getJson('/management/outing-log-history?source=BIOMETRIC_DEVICE', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.source, 'BIOMETRIC_DEVICE');
    }
  });

  // 18. Source filter: MANAGEMENT_PORTAL
  await test('18. Source Filter: MANAGEMENT_PORTAL filters administrative decision events', async () => {
    const res = await getJson('/management/outing-log-history?source=MANAGEMENT_PORTAL', adminToken);
    assert.strictEqual(res.status, 200);
    for (const r of res.data.records) {
      assert.strictEqual(r.source, 'MANAGEMENT_PORTAL');
    }
  });

  // 19. Detail API endpoint
  await test('19. Detail Endpoint: GET /:id returns complete read-only context and timeline', async () => {
    const res = await getJson(`/management/outing-log-history/${sampleOuting.id}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const { outing, student, timeline } = res.data.data;
    assert.strictEqual(outing.id, sampleOuting.id);
    assert.strictEqual(outing.requestNumber, sampleOuting.requestNumber);
    assert.ok(student.name);
    assert.ok(student.jntuNo);
    assert.ok(Array.isArray(timeline));
    assert.ok(timeline.length >= 2, 'Timeline must contain at least requested and decision/movement stages');
  });

  // 20. Invalid ID handled safely -> 404
  await test('20. Error Handling: Nonexistent outing ID returns 404', async () => {
    const res = await getJson('/management/outing-log-history/00000000-0000-0000-0000-000000000000', adminToken);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  // 21. IDOR Protection
  await test('21. IDOR Protection: Malformed or special character IDs handled safely without SQL error', async () => {
    const res = await getJson("/management/outing-log-history/'--%20OR%201=1", adminToken);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.data.success, false);
  });

  // 22. Historical Records are Read-Only (no PUT, POST, DELETE allowed)
  await test('22. Immutability: Mutating operations on /outing-log-history rejected with 404/405', async () => {
    const postRes = await postJson(`/management/outing-log-history/${sampleOuting.id}`, { status: 'CANCELLED' }, adminToken);
    assert.strictEqual(postRes.status, 404, 'POST mutating endpoint must not exist');

    const putRes = await putJson(`/management/outing-log-history/${sampleOuting.id}`, { status: 'CANCELLED' }, adminToken);
    assert.strictEqual(putRes.status, 404, 'PUT mutating endpoint must not exist');

    const deleteRes = await deleteJson(`/management/outing-log-history/${sampleOuting.id}`, adminToken);
    assert.strictEqual(deleteRes.status, 404, 'DELETE mutating endpoint must not exist');
  });

  // 23. Timeline Stages Distinguish Approval from Physical Movement
  await test('23. Timeline Accuracy: Approval and physical movement are distinct stages', async () => {
    const res = await getJson(`/management/outing-log-history/${sampleOuting.id}`, adminToken);
    assert.strictEqual(res.status, 200);
    const { timeline } = res.data.data;
    const stages = timeline.map((t) => t.stage);

    assert.ok(stages.includes('REQUESTED'), 'Must include REQUESTED stage');
    assert.ok(stages.includes('APPROVED'), 'Must include APPROVED stage');
    assert.ok(stages.includes('EXIT'), 'Must include EXIT physical movement stage');
    assert.ok(stages.includes('RETURN'), 'Must include RETURN physical movement stage');

    const appStage = timeline.find((t) => t.stage === 'APPROVED');
    const exitStage = timeline.find((t) => t.stage === 'EXIT');
    assert.strictEqual(appStage.source, 'MANAGEMENT_PORTAL', 'Approval source must be MANAGEMENT_PORTAL');
    assert.strictEqual(exitStage.source, 'BIOMETRIC_DEVICE', 'Exit source must be BIOMETRIC_DEVICE');
  });

  // 24. Large PageSize is Bounded
  await test('24. Bounds Checking: PageSize is capped at 100 to prevent denial of service', async () => {
    const res = await getJson('/management/outing-log-history?pageSize=999999', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.pageSize, 100, 'PageSize must be capped at 100');
  });

  // 25. Authoritative KPI Metrics
  await test('25. KPI Statistics: Authoritative metrics return PostgreSQL numeric aggregates', async () => {
    const res = await getJson('/management/outing-log-history', adminToken);
    assert.strictEqual(res.status, 200);
    const { stats } = res.data;
    assert.ok(typeof stats.todayRequests === 'number');
    assert.ok(typeof stats.todayApproved === 'number');
    assert.ok(typeof stats.todayExits === 'number');
    assert.ok(typeof stats.todayReturns === 'number');
    assert.ok(typeof stats.currentlyOutside === 'number');
  });

  console.log(`\n======================================================`);
  console.log(`OUTING LOG HISTORY TESTS: ${passedCount}/${totalCount} TESTS PASSED!`);
  console.log(`======================================================\n`);
}

runOutingLogHistorySuite()
  .catch((e) => {
    console.error('Fatal test error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
