const assert = require('assert');
const http = require('http');

async function testBiometricApi() {
  console.log('=== Running Student Biometric Tracking API Tests ===\n');

  // 1. Authenticate Student A (MANI MANASVI GAVARA - 25331A05H7)
  const loginARes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginAData = await loginARes.json();
  assert.strictEqual(loginARes.status, 200, 'Student A login must succeed');
  const tokenA = loginAData.token;
  const studentAId = loginAData.user.id;

  // 2. Authenticate Student B (NAKKULLA RITHIKA - 25331A05H8)
  const loginBRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
  });
  const loginBData = await loginBRes.json();
  assert.strictEqual(loginBRes.status, 200, 'Student B login must succeed');
  const tokenB = loginBData.token;
  const studentBId = loginBData.user.id;

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.biometricEvent.deleteMany({
    where: { studentId: { in: [studentAId, studentBId] } },
  });

  // TEST 1: Unauthenticated GET /api/student/biometric returns 401
  const unauthOverviewRes = await fetch('http://localhost:5001/api/student/biometric');
  assert.strictEqual(unauthOverviewRes.status, 401);
  console.log('[PASS] 1. Unauthenticated GET /api/student/biometric rejected with 401');

  // TEST 2: Unauthenticated GET /api/student/biometric/today returns 401
  const unauthTodayRes = await fetch('http://localhost:5001/api/student/biometric/today');
  assert.strictEqual(unauthTodayRes.status, 401);
  console.log('[PASS] 2. Unauthenticated GET /api/student/biometric/today rejected with 401');

  // TEST 3: Unauthenticated GET /api/student/biometric/summary returns 401
  const unauthSummaryRes = await fetch('http://localhost:5001/api/student/biometric/summary');
  assert.strictEqual(unauthSummaryRes.status, 401);
  console.log('[PASS] 3. Unauthenticated GET /api/student/biometric/summary rejected with 401');

  // TEST 4: Unauthenticated GET /api/student/biometric/events/:id returns 401
  const unauthDetailRes = await fetch('http://localhost:5001/api/student/biometric/events/00000000-0000-0000-0000-000000000000');
  assert.strictEqual(unauthDetailRes.status, 401);
  console.log('[PASS] 4. Unauthenticated GET /api/student/biometric/events/:id rejected with 401');

  // TEST 5: Authenticated student receives biometric overview
  const authOverviewRes = await fetch('http://localhost:5001/api/student/biometric', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(authOverviewRes.status, 200);
  const overviewData = await authOverviewRes.json();
  assert.strictEqual(overviewData.success, true);
  assert.ok(overviewData.today);
  assert.ok(Array.isArray(overviewData.events));
  assert.ok(overviewData.pagination);
  console.log('[PASS] 5. Authenticated student receives biometric overview structure');

  // TEST 6: Student mutation restriction: POST /api/student/biometric rejected with 403
  const studentPostRes = await fetch('http://localhost:5001/api/student/biometric', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ eventType: 'ENTRY' }),
  });
  assert.strictEqual(studentPostRes.status, 403);
  console.log('[PASS] 6. Student self-reporting attempt POST /api/student/biometric rejected with 403');

  // TEST 7: Student mutation restriction: PUT /api/student/biometric rejected with 403
  const studentPutRes = await fetch('http://localhost:5001/api/student/biometric', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(studentPutRes.status, 403);
  console.log('[PASS] 7. Student mutation attempt PUT /api/student/biometric rejected with 403');

  // TEST 8: Student mutation restriction: DELETE /api/student/biometric rejected with 403
  const studentDelRes = await fetch('http://localhost:5001/api/student/biometric', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(studentDelRes.status, 403);
  console.log('[PASS] 8. Student deletion attempt DELETE /api/student/biometric rejected with 403');

  // TEST 9: Ingestion validation: missing parameters rejected with 400
  const ingestMissingRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.strictEqual(ingestMissingRes.status, 400);
  console.log('[PASS] 9. Ingestion rejected missing studentId/eventType with 400');

  // TEST 10: Ingestion validation: invalid eventType rejected with 400
  const ingestInvalidTypeRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: studentAId, eventType: 'FLY_AWAY' }),
  });
  assert.strictEqual(ingestInvalidTypeRes.status, 400);
  console.log('[PASS] 10. Ingestion rejected invalid eventType with 400');

  // TEST 11: Ingestion validation: invalid verificationStatus rejected with 400
  const ingestInvalidStatusRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: studentAId, eventType: 'ENTRY', verificationStatus: 'MAYBE' }),
  });
  assert.strictEqual(ingestInvalidStatusRes.status, 400);
  console.log('[PASS] 11. Ingestion rejected invalid verificationStatus with 400');

  // TEST 12: Ingestion validation: impossible future timestamp rejected with 400
  const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours in future
  const ingestFutureRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId: studentAId, eventType: 'ENTRY', eventTimestamp: futureTime.toISOString() }),
  });
  assert.strictEqual(ingestFutureRes.status, 400);
  console.log('[PASS] 12. Ingestion rejected future timestamp with 400');

  // TEST 13: Ingestion of valid ENTRY event for Student A
  const now = new Date();
  const entryTime = new Date(now.getTime() - 2 * 60 * 60 * 1000); // 2 hours ago
  const ingestEntryRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentAId,
      eventType: 'ENTRY',
      verificationStatus: 'VERIFIED',
      eventTimestamp: entryTime.toISOString(),
      gate: 'Main Gate',
      deviceId: 'DEV-GATE-01',
      deviceLabel: 'Turnstile #1 - Main Gate',
    }),
  });
  assert.strictEqual(ingestEntryRes.status, 201);
  const entryData = await ingestEntryRes.json();
  assert.strictEqual(entryData.success, true);
  const entryEventId = entryData.event.id;
  console.log('[PASS] 13. Valid ENTRY event ingested and persisted for Student A:', entryEventId);

  // TEST 14: Today presence state evaluates to INSIDE_HOSTEL after ENTRY
  const todayEntryCheckRes = await fetch('http://localhost:5001/api/student/biometric/today', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(todayEntryCheckRes.status, 200);
  const todayEntryCheckData = await todayEntryCheckRes.json();
  assert.strictEqual(todayEntryCheckData.today.status, 'INSIDE_HOSTEL');
  assert.strictEqual(todayEntryCheckData.today.statusLabel, 'Present / Inside Hostel');
  assert.ok(todayEntryCheckData.today.entryCount >= 1);
  console.log('[PASS] 14. Today status authoritatively evaluated as INSIDE_HOSTEL');

  // TEST 15: Ingestion of valid EXIT event for Student A
  const exitTime = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
  const ingestExitRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentAId,
      eventType: 'EXIT',
      verificationStatus: 'VERIFIED',
      eventTimestamp: exitTime.toISOString(),
      gate: 'Main Gate',
      deviceId: 'DEV-GATE-02',
      deviceLabel: 'Exit Turnstile #2',
    }),
  });
  assert.strictEqual(ingestExitRes.status, 201);
  const exitData = await ingestExitRes.json();
  const exitEventId = exitData.event.id;
  console.log('[PASS] 15. Valid EXIT event ingested and persisted for Student A:', exitEventId);

  // TEST 16: Today presence state evaluates to OUTSIDE_HOSTEL after EXIT
  const todayExitCheckRes = await fetch('http://localhost:5001/api/student/biometric/today', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(todayExitCheckRes.status, 200);
  const todayExitCheckData = await todayExitCheckRes.json();
  assert.strictEqual(todayExitCheckData.today.status, 'OUTSIDE_HOSTEL');
  assert.strictEqual(todayExitCheckData.today.statusLabel, 'Outside Hostel');
  assert.ok(todayExitCheckData.today.exitCount >= 1);
  console.log('[PASS] 16. Today status authoritatively evaluated as OUTSIDE_HOSTEL');

  // TEST 17: Rejected event (REJECTED) does NOT alter OUTSIDE_HOSTEL presence status
  const ingestRejectedRes = await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentAId,
      eventType: 'ENTRY',
      verificationStatus: 'REJECTED',
      rejectionReason: 'Fingerprint mismatch',
      gate: 'North Gate',
      deviceId: 'DEV-GATE-03',
    }),
  });
  assert.strictEqual(ingestRejectedRes.status, 201);
  const rejTodayRes = await fetch('http://localhost:5001/api/student/biometric/today', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  const rejTodayData = await rejTodayRes.json();
  assert.strictEqual(rejTodayData.today.status, 'OUTSIDE_HOSTEL', 'Rejected event must not grant inside presence');
  console.log('[PASS] 17. Rejected biometric event retained for audit but does not grant inside presence');

  // TEST 18: IDOR Protection: Student B cannot view Student A's event
  const idorRes = await fetch(`http://localhost:5001/api/student/biometric/events/${entryEventId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorRes.status, 403, 'Student B viewing Student A event must be 403');
  console.log('[PASS] 18. IDOR protection: Student B forbidden from viewing Student A event (403)');

  // TEST 19: Single Event Detail: Student A can retrieve own event with full metadata
  const detailRes = await fetch(`http://localhost:5001/api/student/biometric/events/${entryEventId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.event.id, entryEventId);
  assert.strictEqual(detailData.event.eventType, 'ENTRY');
  assert.strictEqual(detailData.event.gate, 'Main Gate');
  assert.strictEqual(detailData.event.verificationStatus, 'VERIFIED');
  console.log('[PASS] 19. Student retrieves single event details with complete gate/verification metadata');

  // TEST 20: History pagination and filtering by eventType
  const filteredRes = await fetch('http://localhost:5001/api/student/biometric?eventType=EXIT&limit=5', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(filteredRes.status, 200);
  const filteredData = await filteredRes.json();
  assert.ok(filteredData.events.every((e) => e.eventType === 'EXIT'));
  console.log('[PASS] 20. Event filtering by eventType=EXIT functions accurately');

  // TEST 21: Daily summaries endpoint returns 7-day attendance cards
  const summaryRes = await fetch('http://localhost:5001/api/student/biometric/summary?days=7', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(summaryRes.status, 200);
  const summaryData = await summaryRes.json();
  assert.strictEqual(summaryData.success, true);
  assert.ok(Array.isArray(summaryData.dailySummaries));
  assert.strictEqual(summaryData.dailySummaries.length, 7);
  console.log('[PASS] 21. Daily attendance summaries returned for 7-day breakdown');

  // Ensure no conflicting active outings or quota exhaust for Student A
  await prisma.student.update({
    where: { id: studentAId },
    data: { monthlyOutingMax: 5 },
  });
  await prisma.outingRequest.deleteMany({
    where: { studentId: studentAId },
  });

  const futureExit = new Date(Date.now() + 10 * 60 * 1000); // 10 mins from now
  const returnSameDay = new Date(futureExit.getTime() + 4 * 60 * 60 * 1000); // 4 hours later same day
  const createOutingRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      purpose: 'Weekend Library Research Assignment',
      destination: 'Central University Library',
      emergencyContact: '9876543210',
      outDate: futureExit.toISOString(),
      returnDate: returnSameDay.toISOString(),
    }),
  });
  const createdOuting = await createOutingRes.json();
  assert.strictEqual(createOutingRes.status, 201, `Create outing must return 201: ${JSON.stringify(createdOuting)}`);
  const outingId = createdOuting.request.id;

  // Approve the outing directly via Prisma in backend test
  await prisma.outingRequest.update({
    where: { id: outingId },
    data: { status: 'APPROVED' },
  });

  // Now trigger biometric EXIT for Student A
  await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentAId,
      eventType: 'EXIT',
      verificationStatus: 'VERIFIED',
      gate: 'Main Gate',
      deviceId: 'DEV-GATE-01',
    }),
  });

  // Verify outing status updated to OUT
  const checkOuting1 = await prisma.outingRequest.findUnique({ where: { id: outingId } });
  assert.strictEqual(checkOuting1.status, 'OUT', 'Approved outing must transition to OUT on biometric exit');
  assert.ok(checkOuting1.actualExitTime, 'actualExitTime must be populated');
  console.log('[PASS] 22. Outing pass correlated: APPROVED -> OUT with actualExitTime on biometric EXIT');

  // TEST 23: Outing correlation: OUT outing transitions to RETURNED upon biometric ENTRY
  await fetch('http://localhost:5001/api/test/biometric/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      studentId: studentAId,
      eventType: 'ENTRY',
      verificationStatus: 'VERIFIED',
      gate: 'Main Gate',
      deviceId: 'DEV-GATE-01',
    }),
  });

  const checkOuting2 = await prisma.outingRequest.findUnique({ where: { id: outingId } });
  assert.strictEqual(checkOuting2.status, 'RETURNED', 'OUT outing must transition to RETURNED on biometric entry');
  assert.ok(checkOuting2.actualReturnTime, 'actualReturnTime must be populated');
  console.log('[PASS] 23. Outing pass correlated: OUT -> RETURNED with actualReturnTime on biometric ENTRY');

  // TEST 24: Real-time SSE delivery: Student A receives event on their stream
  const ssePromise = new Promise((resolve, reject) => {
    const req = http.request(
      'http://localhost:5001/api/student/biometric/events-stream',
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      (res) => {
        let buffer = '';
        res.on('data', (chunk) => {
          buffer += chunk.toString();
          if (buffer.includes('event: biometric_event')) {
            req.destroy();
            resolve(buffer);
          }
        });
      }
    );
    req.on('error', reject);
    req.end();

    // Trigger biometric event
    setTimeout(() => {
      fetch('http://localhost:5001/api/test/biometric/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentAId,
          eventType: 'ENTRY',
          verificationStatus: 'VERIFIED',
          gate: 'Main Gate Turnstile 1',
        }),
      }).catch(reject);
    }, 200);

    setTimeout(() => reject(new Error('SSE timeout')), 3000);
  });

  const ssePayload = await ssePromise;
  assert.ok(ssePayload.includes('BIOMETRIC_EVENT_RECORDED'));
  console.log('[PASS] 24. Real-time SSE delivery verified for authenticated student stream');

  await prisma.outingRequest.delete({ where: { id: outingId } }).catch(() => {});
  await prisma.$disconnect();

  console.log('\n====================================================');
  console.log('Passed: 24/24 tests in Biometric Tracking suite!');
  console.log('====================================================\n');
}

testBiometricApi().catch((err) => {
  console.error('Biometric API Test Failed:', err);
  process.exit(1);
});
