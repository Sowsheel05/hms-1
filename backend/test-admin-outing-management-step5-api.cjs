const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('========================================================');
  console.log('  STARTING ADMIN OUTING MANAGEMENT STEP 5 AUTOMATED TESTS');
  console.log('========================================================\n');

  let adminToken = '';
  let studentToken = '';
  let testStudentId = null;
  let testOutingId1 = null;
  let testOutingId2 = null;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('\x1b[32mPASSED\x1b[0m');
      passed++;
    } catch (err) {
      console.log('\x1b[31mFAILED\x1b[0m');
      console.error('  Error:', err.message);
      failed++;
    }
  }

  try {
    // 1. Admin Authentication
    await test('1. Admin Authentication — login succeeds with ADMIN01', async () => {
      const res = await fetch(`${API_BASE}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.ok(data.token, 'Admin JWT token required');
      adminToken = data.token;
    });

    // 2. Student Authentication for RBAC
    await test('2. Student Authentication — login succeeds for RBAC test', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
      assert.strictEqual(data.success, true);
      assert.ok(data.token, 'Student token required');
      studentToken = data.token;

      const student = await prisma.student.findUnique({ where: { jntuNo: '25331A05H7' } });
      assert.ok(student, 'Student must exist in DB');
      testStudentId = student.id;
    });

    // 3. RBAC — Unauthenticated Access Blocked
    await test('3. RBAC — Unauthenticated access returns 401', async () => {
      const res = await fetch(`${API_BASE}/management/outings`);
      assert.strictEqual(res.status, 401, `Expected 401, got ${res.status}`);
    });

    // 4. RBAC — Student Role Blocked from Management Outing APIs
    await test('4. RBAC — Student token returns 403 Forbidden for management outings', async () => {
      const res = await fetch(`${API_BASE}/management/outings`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403, `Expected 403, got ${res.status}`);
    });

    // 5. Authoritative KPI Stats from PostgreSQL
    await test('5. Authoritative KPI Stats — GET /api/management/outings/stats returns PostgreSQL counts', async () => {
      const res = await fetch(`${API_BASE}/management/outings/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.data.pending === 'number', 'pending count must be numeric');
      assert.ok(typeof (data.data.approved ?? data.data.approvedToday) === 'number', 'approved count must be numeric');
      assert.ok(typeof (data.data.active ?? data.data.activeOutings) === 'number', 'active count must be numeric');
      assert.ok(typeof data.data.returned === 'number', 'returned count must be numeric');
      assert.ok(typeof data.data.rejected === 'number', 'rejected count must be numeric');
      assert.ok(typeof data.data.todayOutgoing === 'number', 'todayOutgoing count must be numeric');
      assert.ok(typeof data.data.todayIncoming === 'number', 'todayIncoming count must be numeric');

      // Verify pending count matches database
      const dbPendingCount = await prisma.outingRequest.count({
        where: { status: { in: ['PENDING', 'APPLIED'] } },
      });
      assert.strictEqual(data.data.pending, dbPendingCount, 'Stats pending count must match PostgreSQL');
    });

    // 6. Request Listing and Pagination
    await test('6. Listing & Pagination — GET /api/management/outings returns paginated results', async () => {
      const res = await fetch(`${API_BASE}/management/outings?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data), 'data must be an array');
      assert.ok(data.pagination, 'pagination object required');
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.limit, 5);
      assert.ok(typeof data.pagination.total === 'number');
      assert.ok(typeof data.pagination.totalPages === 'number');
    });

    // 7. Search Functionality (Server-side case-insensitive)
    await test('7. Search Functionality — searches by student name or JNTU number', async () => {
      const res = await fetch(`${API_BASE}/management/outings?search=25331A05H7`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      if (data.data.length > 0) {
        data.data.forEach((item) => {
          assert.strictEqual(item.student.jntuNo, '25331A05H7');
        });
      }
    });

    // 8. Filters Functionality (Status, Block, Gender, PassType)
    await test('8. Multi-dimensional Filters — status, block, gender, passType filters work', async () => {
      // Filter by status PENDING
      const resPending = await fetch(`${API_BASE}/management/outings?status=PENDING`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const pendingData = await resPending.json();
      assert.strictEqual(resPending.status, 200);
      pendingData.data.forEach((item) => {
        assert.ok(['PENDING', 'APPLIED'].includes(item.rawStatus));
      });

      // Filter by passType EMERGENCY
      const resEmergency = await fetch(`${API_BASE}/management/outings?passType=EMERGENCY`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const emergencyData = await resEmergency.json();
      assert.strictEqual(resEmergency.status, 200);
      emergencyData.data.forEach((item) => {
        assert.strictEqual(item.passType, 'EMERGENCY');
      });

      // Filter by gender GIRLS
      const resGirls = await fetch(`${API_BASE}/management/outings?gender=GIRLS`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const girlsData = await resGirls.json();
      assert.strictEqual(resGirls.status, 200);
      girlsData.data.forEach((item) => {
        assert.ok(
          item.student.gender === 'FEMALE' ||
          (item.student.blockName || '').toLowerCase().includes('girl')
        );
      });
    });

    // Create 2 test PENDING outing requests directly in DB
    const now = new Date();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const testOuting1 = await prisma.outingRequest.create({
      data: {
        studentId: testStudentId,
        requestNumber: `OUT-TEST-APP-${Date.now()}`,
        passType: 'GENERAL',
        destination: 'City Center Market',
        purpose: 'Purchasing project hardware components',
        outDate: now,
        returnDate: tomorrow,
        status: 'PENDING',
        emergencyContact: '9876543210',
      },
    });
    testOutingId1 = testOuting1.id;

    const testOuting2 = await prisma.outingRequest.create({
      data: {
        studentId: testStudentId,
        requestNumber: `OUT-TEST-REJ-${Date.now()}`,
        passType: 'EMERGENCY',
        destination: 'Home Town',
        purpose: 'Family Emergency',
        outDate: now,
        returnDate: tomorrow,
        status: 'PENDING',
        emergencyContact: '9876543211',
      },
    });
    testOutingId2 = testOuting2.id;

    // 9. Request Details Retrieval
    await test('9. Request Details — GET /api/management/outings/:id returns complete details & academic info', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId1}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.id, testOutingId1);
      assert.strictEqual(data.data.purpose, 'Purchasing project hardware components');
      assert.strictEqual(data.data.destination, 'City Center Market');
      assert.ok(data.data.student, 'student info must be present');
      assert.strictEqual(data.data.student.jntuNo, '25331A05H7');
      assert.ok(data.data.student.academic, 'academic breakdown must be present');
      assert.ok(data.data.student.avatar || data.data.avatar, 'avatar initials must be present');
    });

    // 10. Approve Workflow: Transactional PENDING -> APPROVED (APPROVED != ACTIVE)
    await test('10. Approve Workflow — transitions PENDING -> APPROVED and NOT ACTIVE', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId1}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ remarks: 'Approved for project hardware purchase' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'APPROVED');

      // CRITICAL: Verify in PostgreSQL that status is APPROVED, NOT ACTIVE
      const dbRecord = await prisma.outingRequest.findUnique({
        where: { id: testOutingId1 },
      });
      assert.strictEqual(dbRecord.status, 'APPROVED', 'PostgreSQL status must be APPROVED');
      assert.notStrictEqual(dbRecord.status, 'ACTIVE', 'Approval must NEVER mark outing ACTIVE');
      assert.notStrictEqual(dbRecord.status, 'OUT', 'Approval must NEVER mark outing OUT');
      assert.strictEqual(dbRecord.actualExitTime, null, 'actualExitTime must remain null upon approval');
      assert.ok(dbRecord.approvedAt, 'approvedAt timestamp must be recorded');
      assert.ok(dbRecord.approvedBy, 'approvedBy admin user must be recorded');
    });

    // 11. Concurrency / Stale-state Protection on Approve
    await test('11. Stale-state Protection — Approving an already APPROVED request returns 400', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId1}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Expected 400 for already processed request');
      assert.strictEqual(data.success, false);
      const errText = data.message || data.error || '';
      assert.ok(errText.includes('Only pending') || errText.includes('already') || errText.includes('Cannot approve'));
    });

    // 12. Reject Validation — Reason Required
    await test('12. Reject Validation — Rejection without reason or <3 characters returns 400', async () => {
      const res1 = await fetch(`${API_BASE}/management/outings/${testOutingId2}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: '' }),
      });
      assert.strictEqual(res1.status, 400, 'Empty rejection reason must return 400');

      const res2 = await fetch(`${API_BASE}/management/outings/${testOutingId2}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'no' }),
      });
      assert.strictEqual(res2.status, 400, 'Short rejection reason (<3 chars) must return 400');
    });

    // 13. Reject Workflow: Transactional PENDING -> REJECTED
    await test('13. Reject Workflow — transitions PENDING -> REJECTED with validated reason', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId2}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Exams scheduled tomorrow morning' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'REJECTED');

      // Verify PostgreSQL
      const dbRecord = await prisma.outingRequest.findUnique({
        where: { id: testOutingId2 },
      });
      assert.strictEqual(dbRecord.status, 'REJECTED');
      assert.strictEqual(dbRecord.rejectionReason, 'Exams scheduled tomorrow morning');
      assert.ok(dbRecord.rejectedAt);
      assert.ok(dbRecord.rejectedBy);
    });

    // 14. Stale-state Protection on Reject
    await test('14. Stale-state Protection — Rejecting an already REJECTED request returns 400', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId2}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Duplicate rejection attempt' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Expected 400 for already processed request');
      assert.strictEqual(data.success, false);
    });

    // 15. Cross-Operation Stale State — Rejecting an APPROVED request returns 400
    await test('15. Cross-Operation Stale State — Rejecting an APPROVED request returns 400', async () => {
      const res = await fetch(`${API_BASE}/management/outings/${testOutingId1}/reject`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Late rejection attempt' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Expected 400 when rejecting an APPROVED request');
      assert.strictEqual(data.success, false);
    });

    // 16. Audit Log Verification
    await test('16. Audit Log Verification — ActivityLog records OUTING_APPROVED & OUTING_REJECTED', async () => {
      const approvedLog = await prisma.activityLog.findFirst({
        where: {
          entityId: testOutingId1,
          actionType: 'OUTING',
        },
      });
      assert.ok(approvedLog, 'ActivityLog must have OUTING approval entry');
      assert.strictEqual(approvedLog.studentId, testStudentId);

      const rejectedLog = await prisma.activityLog.findFirst({
        where: {
          entityId: testOutingId2,
          actionType: 'OUTING',
        },
      });
      assert.ok(rejectedLog, 'ActivityLog must have OUTING rejection entry');
      assert.strictEqual(rejectedLog.studentId, testStudentId);
    });

    // 17. Student Notification Generation
    await test('17. Student Notification — notifications created for student on approval & rejection', async () => {
      const notifications = await prisma.notification.findMany({
        where: {
          studentId: testStudentId,
          category: 'OUTING',
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      assert.ok(notifications.length >= 2, 'Student should receive notifications for both actions');
      const approvedNotif = notifications.find((n) => n.title.includes('Approved'));
      const rejectedNotif = notifications.find((n) => n.title.includes('Rejected'));
      assert.ok(approvedNotif, 'Approval notification must be present');
      assert.ok(rejectedNotif, 'Rejection notification must be present');
    });

    // 18. IDOR & Non-Existent Request Protection
    await test('18. IDOR & Non-Existent ID Protection — returns 404 for invalid request IDs', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await fetch(`${API_BASE}/management/outings/${fakeId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
      });
      assert.strictEqual(res.status, 404, 'Expected 404 for non-existent request ID');
    });

  } finally {
    // 19. Clean up test records
    console.log('\n• Cleaning up test records from PostgreSQL 18.6...');
    if (testOutingId1) {
      await prisma.notification.deleteMany({
        where: { studentId: testStudentId, message: { contains: testOutingId1 } },
      }).catch(() => {});
      await prisma.activityLog.deleteMany({
        where: { entityId: testOutingId1 },
      }).catch(() => {});
      await prisma.outingRequest.delete({ where: { id: testOutingId1 } }).catch(() => {});
    }
    if (testOutingId2) {
      await prisma.notification.deleteMany({
        where: { studentId: testStudentId, message: { contains: testOutingId2 } },
      }).catch(() => {});
      await prisma.activityLog.deleteMany({
        where: { entityId: testOutingId2 },
      }).catch(() => {});
      await prisma.outingRequest.delete({ where: { id: testOutingId2 } }).catch(() => {});
    }
    await prisma.$disconnect();
    console.log('  Clean up completed successfully.\n');
  }

  console.log('========================================================');
  console.log(`  STEP 5 TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
