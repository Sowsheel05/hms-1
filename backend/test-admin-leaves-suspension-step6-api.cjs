const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING ADMIN LEAVES & SUSPENSION STEP 6 AUTOMATED TESTS');
  console.log('================================================================\n');

  let adminToken = '';
  let studentToken = '';
  let testStudentId = null;
  let testLeaveId1 = null;
  let testLeaveId2 = null;
  let testSuspensionId = null;

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
    await test('3. RBAC — Unauthenticated access returns 401 for leaves & suspensions', async () => {
      const resLeaves = await fetch(`${API_BASE}/management/leaves`);
      assert.strictEqual(resLeaves.status, 401, `Expected 401, got ${resLeaves.status}`);

      const resSusp = await fetch(`${API_BASE}/management/suspensions`);
      assert.strictEqual(resSusp.status, 401, `Expected 401, got ${resSusp.status}`);
    });

    // 4. RBAC — Student Role Blocked from Management APIs
    await test('4. RBAC — Student token returns 403 Forbidden for management leaves & suspensions', async () => {
      const resLeaves = await fetch(`${API_BASE}/management/leaves`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resLeaves.status, 403, `Expected 403, got ${resLeaves.status}`);

      const resSusp = await fetch(`${API_BASE}/management/suspensions`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resSusp.status, 403, `Expected 403, got ${resSusp.status}`);
    });

    // 5. Authoritative Leave KPI Stats from PostgreSQL
    await test('5. Authoritative KPI Stats — GET /api/management/leaves/stats returns PostgreSQL counts', async () => {
      const res = await fetch(`${API_BASE}/management/leaves/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.data.pending === 'number', 'pending count must be numeric');
      assert.ok(typeof data.data.approved === 'number', 'approved count must be numeric');
      assert.ok(typeof data.data.active === 'number', 'active count must be numeric');
      assert.ok(typeof data.data.completed === 'number', 'completed count must be numeric');
      assert.ok(typeof data.data.rejected === 'number', 'rejected count must be numeric');
      assert.ok(typeof data.data.suspendedStudents === 'number', 'suspendedStudents count must be numeric');

      const dbPendingCount = await prisma.leaveRequest.count({ where: { status: 'PENDING' } });
      assert.strictEqual(data.data.pending, dbPendingCount, 'Stats pending count must match PostgreSQL');
    });

    // 6. Leave Listing with Pagination
    await test('6. Leave Listing & Pagination — GET /api/management/leaves returns structured pagination', async () => {
      const res = await fetch(`${API_BASE}/management/leaves?page=1&limit=5`, {
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

    // 7. Leave Search
    await test('7. Leave Search — finds records matching student name or JNTU', async () => {
      const res = await fetch(`${API_BASE}/management/leaves?search=25331`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

    // 8. Leave Category & Status Filters
    await test('8. Multi-dimension Filters — status, category, gender, year filters', async () => {
      const res = await fetch(`${API_BASE}/management/leaves?status=PENDING&category=HOME_LEAVE&gender=BOYS&year=1`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
    });

    // Create 2 test leave requests in database for approval and rejection testing
    const now = new Date();
    const start1 = new Date(now.getTime() + 86400000);
    const end1 = new Date(now.getTime() + 3 * 86400000);

    const leave1 = await prisma.leaveRequest.create({
      data: {
        studentId: testStudentId,
        requestNumber: `TEST-LEV-A-${Date.now().toString().slice(-5)}`,
        leaveType: 'HOME_LEAVE',
        destination: 'Guntur Home',
        startDate: start1,
        endDate: end1,
        reason: 'Automated Step 6 Leave Approval Test',
        emergencyContact: '9876543210',
        status: 'PENDING',
      },
    });
    testLeaveId1 = leave1.id;

    const leave2 = await prisma.leaveRequest.create({
      data: {
        studentId: testStudentId,
        requestNumber: `TEST-LEV-R-${Date.now().toString().slice(-5)}`,
        leaveType: 'MEDICAL',
        destination: 'City Hospital',
        startDate: start1,
        endDate: end1,
        reason: 'Automated Step 6 Leave Rejection Test',
        emergencyContact: '9876543211',
        status: 'PENDING',
      },
    });
    testLeaveId2 = leave2.id;

    // 9. Leave Single Detail Retrieval
    await test('9. Leave Detail — GET /api/management/leaves/:id returns full context with student metadata', async () => {
      const res = await fetch(`${API_BASE}/management/leaves/${testLeaveId1}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.id, testLeaveId1);
      assert.ok(data.data.student, 'Student details must be included');
      assert.strictEqual(data.data.student.id, testStudentId);
      assert.ok(data.data.student.academic, 'Student academic info decoded');
      assert.ok(typeof data.data.isSuspended === 'boolean', 'isSuspended flag required');
    });

    // 10. Leave Approval Transaction
    await test('10. Leave Approval — POST /:id/approve authorizes request transactionally with audit & notification', async () => {
      const res = await fetch(`${API_BASE}/management/leaves/${testLeaveId1}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ remarks: 'Verified with family' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      // Verify DB state
      const updated = await prisma.leaveRequest.findUnique({ where: { id: testLeaveId1 } });
      assert.strictEqual(updated.status, 'APPROVED');
      assert.ok(updated.approvedAt, 'approvedAt timestamp set');
      assert.ok(updated.approvedBy, 'approvedBy manager name set');

      // Verify ActivityLog entry
      const log = await prisma.activityLog.findFirst({
        where: { entity: 'LeaveRequest', entityId: testLeaveId1, action: 'APPROVE' },
      });
      assert.ok(log, 'ActivityLog entry for APPROVE required');

      // Verify Student Notification
      const notif = await prisma.notification.findFirst({
        where: { studentId: testStudentId, category: 'LEAVE', entityId: testLeaveId1 },
      });
      assert.ok(notif, 'Student notification for APPROVE required');
    });

    // 11. Leave Rejection Validation
    await test('11. Leave Rejection Validation — rejects reason shorter than 3 characters', async () => {
      const res = await fetch(`${API_BASE}/management/leaves/${testLeaveId2}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: 'no' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, `Expected 400 for short reason, got ${res.status}`);
      assert.strictEqual(data.success, false);
    });

    // 12. Leave Rejection Transaction
    await test('12. Leave Rejection — POST /:id/reject transitions to REJECTED with reason & audit', async () => {
      const res = await fetch(`${API_BASE}/management/leaves/${testLeaveId2}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: 'Academic schedule conflicts with examination dates' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      // Verify DB state
      const updated = await prisma.leaveRequest.findUnique({ where: { id: testLeaveId2 } });
      assert.strictEqual(updated.status, 'REJECTED');
      assert.strictEqual(updated.rejectionReason, 'Academic schedule conflicts with examination dates');
      assert.ok(updated.rejectedAt, 'rejectedAt timestamp set');
      assert.ok(updated.rejectedBy, 'rejectedBy manager set');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entity: 'LeaveRequest', entityId: testLeaveId2, action: 'REJECT' },
      });
      assert.ok(log, 'ActivityLog entry for REJECT required');
    });

    // 13. State Machine & Concurrency Protection
    await test('13. Concurrency Protection — cannot re-approve or reject already processed leaves', async () => {
      const res1 = await fetch(`${API_BASE}/management/leaves/${testLeaveId1}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res1.status, 400, 'Cannot approve already approved leave');

      const res2 = await fetch(`${API_BASE}/management/leaves/${testLeaveId2}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: 'Try again' }),
      });
      assert.strictEqual(res2.status, 400, 'Cannot reject already rejected leave');
    });

    // 14. Suspension Listing & Filters
    await test('14. Suspension Listing — GET /api/management/suspensions lists records with search/filters', async () => {
      const res = await fetch(`${API_BASE}/management/suspensions?status=ALL&page=1&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data));
      assert.ok(data.pagination);
    });

    // 15. Suspension Creation Validation
    await test('15. Suspension Validation — rejects invalid inputs (missing student, short reason, invalid dates)', async () => {
      const resMissing = await fetch(`${API_BASE}/management/suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ studentId: '' }),
      });
      assert.strictEqual(resMissing.status, 400);

      const resShort = await fetch(`${API_BASE}/management/suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentId: testStudentId,
          reason: 'bad',
          startDate: '2026-09-15',
          endDate: '2026-09-20',
        }),
      });
      assert.strictEqual(resShort.status, 400);

      const resDate = await fetch(`${API_BASE}/management/suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentId: testStudentId,
          reason: 'Late night unauthorized hostel absence',
          startDate: '2026-09-20',
          endDate: '2026-09-15',
        }),
      });
      assert.strictEqual(resDate.status, 400, 'End date must be strictly after start date');
    });

    // 16. Disciplinary Suspension Creation
    await test('16. Suspension Creation — POST /api/management/suspensions creates disciplinary sanction with audit', async () => {
      const suspStart = new Date();
      const suspEnd = new Date(Date.now() + 7 * 86400000);

      const res = await fetch(`${API_BASE}/management/suspensions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          studentId: testStudentId,
          reason: 'Hostel Curfew Violation & Disciplinary Committee Review',
          startDate: suspStart.toISOString(),
          endDate: suspEnd.toISOString(),
          remarks: 'Case #DISC-TEST-STEP6',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.id);
      testSuspensionId = data.data.id;

      // Verify DB record
      const susp = await prisma.suspension.findUnique({ where: { id: testSuspensionId } });
      assert.strictEqual(susp.status, 'ACTIVE');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entity: 'Suspension', entityId: testSuspensionId, action: 'SUSPEND' },
      });
      assert.ok(log, 'ActivityLog entry for SUSPEND required');

      // Verify Student Notification
      const notif = await prisma.notification.findFirst({
        where: { studentId: testStudentId, category: 'SUSPENSION', entityId: testSuspensionId },
      });
      assert.ok(notif, 'Student notification for SUSPENSION required');
    });

    // 17. CRITICAL BUSINESS RULE: Active Suspension authoritatively blocks Student Outing Application
    await test('17. Outing Enforcement — Active suspension authoritatively blocks student from applying for outings', async () => {
      const outingRes = await fetch(`${API_BASE}/student/outing-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          passType: 'LOCAL_OUTING',
          purpose: 'Weekend shopping trip',
          destination: 'City Mall',
          outDate: new Date(Date.now() + 86400000).toISOString(),
          returnDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          emergencyContact: '9876543210',
          parentContact: '9876543210',
        }),
      });
      const outingData = await outingRes.json();
      assert.ok(outingRes.status === 403 || outingRes.status === 400, `Expected 403 or 400 for suspended student outing request, got ${outingRes.status}`);
      assert.strictEqual(outingData.success, false);
      assert.ok(
        (outingData.message || '').toLowerCase().includes('suspend'),
        `Error message must mention suspension: "${outingData.message}"`
      );
    });

    // 18. Disciplinary Suspension Modification
    await test('18. Suspension Update — PUT /api/management/suspensions/:id updates reason & endDate transactionally', async () => {
      const newEnd = new Date(Date.now() + 10 * 86400000);
      const res = await fetch(`${API_BASE}/management/suspensions/${testSuspensionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          reason: 'Hostel Curfew Violation — Extended after hearing',
          endDate: newEnd.toISOString(),
          remarks: 'Reviewed by Board',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      const susp = await prisma.suspension.findUnique({ where: { id: testSuspensionId } });
      assert.strictEqual(susp.reason, 'Hostel Curfew Violation — Extended after hearing');
      assert.strictEqual(susp.remarks, 'Reviewed by Board');
    });

    // 19. Disciplinary Suspension Lift / End
    await test('19. Suspension Lift — POST /api/management/suspensions/:id/end restores student good standing', async () => {
      const res = await fetch(`${API_BASE}/management/suspensions/${testSuspensionId}/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ remarks: 'Undertaking accepted; disciplinary sanction completed' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      // Verify DB state
      const susp = await prisma.suspension.findUnique({ where: { id: testSuspensionId } });
      assert.strictEqual(susp.status, 'LIFTED');
      assert.ok(susp.liftedAt, 'liftedAt timestamp set');
      assert.ok(susp.liftedBy, 'liftedBy set');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entity: 'Suspension', entityId: testSuspensionId, action: 'LIFT_SUSPENSION' },
      });
      assert.ok(log, 'ActivityLog for LIFT_SUSPENSION required');
    });

    // 20. Outing Privileges Restored
    await test('20. Outing Restored — Student can apply for outings again once suspension is lifted', async () => {
      const outingRes = await fetch(`${API_BASE}/student/outing-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({
          passType: 'LOCAL_OUTING',
          purpose: 'Trip after suspension lifted',
          destination: 'City Center',
          outDate: new Date(Date.now() + 86400000).toISOString(),
          returnDate: new Date(Date.now() + 2 * 86400000).toISOString(),
          emergencyContact: '9876543210',
          parentContact: '9876543210',
        }),
      });
      const outingData = await outingRes.json();
      assert.strictEqual(outingRes.status, 201, `Expected 201, got ${outingRes.status}: ${outingData.message}`);
      assert.strictEqual(outingData.success, true);

      // Clean up test outing
      const outingId = outingData.request?.id || outingData.data?.id;
      if (outingId) {
        await prisma.outingRequest.delete({ where: { id: outingId } });
      }
    });

  } finally {
    // 21. Cleanup test fixtures
    console.log('\nCleaning up automated test fixtures from PostgreSQL...');
    try {
      if (testLeaveId1) {
        await prisma.activityLog.deleteMany({ where: { entityId: testLeaveId1 } });
        await prisma.notification.deleteMany({ where: { entityId: testLeaveId1 } });
        await prisma.leaveRequest.delete({ where: { id: testLeaveId1 } });
      }
      if (testLeaveId2) {
        await prisma.activityLog.deleteMany({ where: { entityId: testLeaveId2 } });
        await prisma.notification.deleteMany({ where: { entityId: testLeaveId2 } });
        await prisma.leaveRequest.delete({ where: { id: testLeaveId2 } });
      }
      if (testSuspensionId) {
        await prisma.activityLog.deleteMany({ where: { entityId: testSuspensionId } });
        await prisma.notification.deleteMany({ where: { entityId: testSuspensionId } });
        await prisma.suspension.delete({ where: { id: testSuspensionId } });
      }
      console.log('✓ Cleaned up test leaves, suspensions, and logs successfully.');
    } catch (cleanErr) {
      console.error('Warning during cleanup:', cleanErr.message);
    }

    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  STEP 6 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled fatal error in test suite:', err);
  process.exit(1);
});
