const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('================================================================');
  console.log('  STARTING ADMIN COMPLAINTS & MAINTENANCE STEP 7 AUTOMATED TESTS');
  console.log('================================================================\n');

  let adminToken = '';
  let studentToken = '';
  let testStudent = null;
  let maintenanceStaff = null;
  let testComplaint1 = null;
  let testComplaint2 = null;

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

      testStudent = await prisma.student.findUnique({ where: { jntuNo: '25331A05H7' } });
      assert.ok(testStudent, 'Test student must exist in PostgreSQL');
    });

    // 3. RBAC — Unauthenticated Access Blocked
    await test('3. RBAC — Unauthenticated access returns 401 for complaints management', async () => {
      const resList = await fetch(`${API_BASE}/management/complaints`);
      assert.strictEqual(resList.status, 401, `Expected 401, got ${resList.status}`);

      const resStats = await fetch(`${API_BASE}/management/complaints/stats`);
      assert.strictEqual(resStats.status, 401, `Expected 401, got ${resStats.status}`);
    });

    // 4. RBAC — Student Role Forbidden
    await test('4. RBAC — Student token returns 403 Forbidden for management endpoints', async () => {
      const resList = await fetch(`${API_BASE}/management/complaints`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resList.status, 403, `Expected 403, got ${resList.status}`);

      const resStats = await fetch(`${API_BASE}/management/complaints/stats`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resStats.status, 403, `Expected 403, got ${resStats.status}`);

      const resStaff = await fetch(`${API_BASE}/management/complaints/maintenance-staff`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(resStaff.status, 403, `Expected 403, got ${resStaff.status}`);
    });

    // 5. Authoritative Complaint KPI Statistics from PostgreSQL
    await test('5. Authoritative KPI Stats — GET /api/management/complaints/stats returns PostgreSQL counts', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/stats`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(typeof data.data.total === 'number', 'total must be numeric');
      assert.ok(typeof data.data.open === 'number', 'open must be numeric');
      assert.ok(typeof data.data.assigned === 'number', 'assigned must be numeric');
      assert.ok(typeof data.data.inProgress === 'number', 'inProgress must be numeric');
      assert.ok(typeof data.data.resolved === 'number', 'resolved must be numeric');
      assert.ok(typeof data.data.closed === 'number', 'closed must be numeric');
      assert.ok(typeof data.data.highPriority === 'number', 'highPriority must be numeric');
      assert.ok(typeof data.data.unassigned === 'number', 'unassigned must be numeric');

      const dbTotal = await prisma.complaint.count();
      const dbOpen = await prisma.complaint.count({ where: { status: 'OPEN' } });
      assert.strictEqual(data.data.total, dbTotal, 'Total must match PostgreSQL');
      assert.strictEqual(data.data.open, dbOpen, 'Open must match PostgreSQL');
    });

    // 6. Maintenance Staff List
    await test('6. Maintenance Staff List — GET /api/management/complaints/maintenance-staff returns active staff', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/maintenance-staff`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data), 'Staff list must be array');
      assert.ok(data.data.length > 0, 'At least one maintenance staff required');

      const staff = data.data.find((s) => s.role === 'MAINTENANCE_STAFF');
      assert.ok(staff, 'Active staff with MAINTENANCE_STAFF role found');
      maintenanceStaff = staff;
    });

    // 7. Complaint Listing with Pagination
    await test('7. Complaint Listing & Pagination — GET /api/management/complaints returns structured pagination', async () => {
      const res = await fetch(`${API_BASE}/management/complaints?page=1&limit=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data), 'data must be an array');
      assert.ok(data.pagination, 'pagination object required');
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.limit, 5);
      assert.ok(data.pagination.total >= 0);
      assert.ok(data.pagination.totalPages >= 1);
    });

    // 8. Search Functionality
    await test('8. Search Functionality — searches by ticket number, title, description, and student', async () => {
      const sample = await prisma.complaint.findFirst({
        include: { student: true },
      });
      assert.ok(sample, 'Need sample complaint for search test');

      const query = sample.ticketNumber || sample.title.substring(0, 5);
      const res = await fetch(`${API_BASE}/management/complaints?search=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data.length > 0, 'Search should find at least one complaint');
      const found = data.data.some((c) => c.id === sample.id);
      assert.ok(found, 'Search must return the target complaint');
    });

    // 9. Status Filtering
    await test('9. Status Filtering — GET /api/management/complaints?status=OPEN filters accurately', async () => {
      const res = await fetch(`${API_BASE}/management/complaints?status=OPEN&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      data.data.forEach((c) => {
        assert.strictEqual(c.status, 'OPEN', `Complaint status must be OPEN, got ${c.status}`);
      });
    });

    // 10. Priority Filtering
    await test('10. Priority Filtering — GET /api/management/complaints?priority=HIGH filters accurately', async () => {
      const res = await fetch(`${API_BASE}/management/complaints?priority=HIGH&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      data.data.forEach((c) => {
        assert.strictEqual(c.priority, 'HIGH', `Complaint priority must be HIGH, got ${c.priority}`);
      });
    });

    // 11. Category Filtering
    await test('11. Category Filtering — GET /api/management/complaints?category=ROOM filters accurately', async () => {
      const res = await fetch(`${API_BASE}/management/complaints?category=ROOM&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      data.data.forEach((c) => {
        assert.strictEqual(c.category, 'ROOM', `Complaint category must be ROOM, got ${c.category}`);
      });
    });

    // 12. Create Authorized Test Fixture Complaints for Lifecycle Testing
    await test('12. Test Setup — Create test complaints in PostgreSQL for state machine testing', async () => {
      const uniqueSuffix = Date.now().toString().slice(-6);
      testComplaint1 = await prisma.complaint.create({
        data: {
          studentId: testStudent.id,
          ticketNumber: `TEST-CMP-1-${uniqueSuffix}`,
          title: 'Flickering ceiling light in study corner',
          description: 'The overhead fluorescent tube light constantly flickers when powered on.',
          category: 'ELECTRICAL',
          priority: 'MEDIUM',
          status: 'OPEN',
          location: 'Room 119 - Desk Area',
        },
      });
      assert.ok(testComplaint1.id, 'Test complaint 1 created');

      testComplaint2 = await prisma.complaint.create({
        data: {
          studentId: testStudent.id,
          ticketNumber: `TEST-CMP-2-${uniqueSuffix}`,
          title: 'Washroom pipe leakage',
          description: 'Water leaking steadily from the under-sink drainage joint.',
          category: 'PLUMBING',
          priority: 'HIGH',
          status: 'OPEN',
          location: 'Room 119 - Attached Washroom',
        },
      });
      assert.ok(testComplaint2.id, 'Test complaint 2 created');
    });

    // 13. Complaint Detail Endpoint
    await test('13. Complaint Detail — GET /api/management/complaints/:id returns full context', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.id, testComplaint1.id);
      assert.strictEqual(data.data.title, testComplaint1.title);
      assert.ok(data.data.student, 'Student details must be included');
      assert.strictEqual(data.data.student.id, testStudent.id);
      assert.ok(Array.isArray(data.data.attachments), 'attachments array required');
      assert.ok(Array.isArray(data.data.commentsList), 'commentsList array required');
    });

    // 14. Assignment Validation: Missing or invalid staffId
    await test('14. Assignment Validation — missing or invalid staffId returns 400 or 404', async () => {
      // Missing staffId
      const resMissing = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      assert.strictEqual(resMissing.status, 400, 'Missing staffId must return 400');

      // Non-existent staffId
      const resInvalid = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ staffId: '00000000-0000-0000-0000-000000000000' }),
      });
      assert.strictEqual(resInvalid.status, 404, 'Non-existent staffId must return 404');
    });

    // 15. Successful Assignment: OPEN -> ASSIGNED
    await test('15. Successful Assignment — assigns complaint to active maintenance technician', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ staffId: maintenanceStaff.id }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${data.message}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'ASSIGNED');
      assert.strictEqual(data.data.assignedToId, maintenanceStaff.id);
      assert.strictEqual(data.data.assignedTo, maintenanceStaff.name);
      assert.ok(data.data.assignedAt, 'assignedAt timestamp required');

      // Verify PostgreSQL database mutation
      const dbRecord = await prisma.complaint.findUnique({ where: { id: testComplaint1.id } });
      assert.strictEqual(dbRecord.status, 'ASSIGNED');
      assert.strictEqual(dbRecord.assignedToId, maintenanceStaff.id);

      // Verify ActivityLog entry
      const log = await prisma.activityLog.findFirst({
        where: { entityId: testComplaint1.id, action: 'ASSIGN' },
      });
      assert.ok(log, 'ActivityLog record must exist for ASSIGN');

      // Verify Notification entry
      const notif = await prisma.notification.findFirst({
        where: { studentId: testStudent.id, entityId: testComplaint1.id },
      });
      assert.ok(notif, 'Notification must be created for student');
    });

    // 16. Invalid Assignment Transition: Cannot re-assign non-OPEN complaint via assign endpoint
    await test('16. Invalid Assignment Transition — cannot assign non-OPEN complaint', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ staffId: maintenanceStaff.id }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Assigning an already ASSIGNED complaint must return 400');
      assert.strictEqual(data.success, false);
    });

    // 17. Valid Status Transition: ASSIGNED -> IN_PROGRESS
    await test('17. Start Work Transition — ASSIGNED -> IN_PROGRESS succeeds', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${data.message}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'IN_PROGRESS');

      // Verify DB state
      const dbRecord = await prisma.complaint.findUnique({ where: { id: testComplaint1.id } });
      assert.strictEqual(dbRecord.status, 'IN_PROGRESS');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entityId: testComplaint1.id, action: 'START' },
      });
      assert.ok(log, 'ActivityLog record must exist for START');
    });

    // 18. Invalid Status Transition: Cannot resolve complaint that is not IN_PROGRESS
    await test('18. Invalid Transition Check — cannot resolve an OPEN complaint directly', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ resolutionNotes: 'Replaced the valve and sealed the pipe.' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Resolving an OPEN complaint directly must return 400');
      assert.strictEqual(data.success, false);
    });

    // 19. Resolution Validation: resolutionNotes minimum length >= 10 chars
    await test('19. Resolution Validation — resolutionNotes < 10 chars returns 400', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ resolutionNotes: 'Done fix' }), // only 8 chars
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Short resolution notes must return 400');
      assert.strictEqual(data.success, false);
    });

    // 20. Successful Resolution: IN_PROGRESS -> RESOLVED
    await test('20. Successful Resolution — IN_PROGRESS -> RESOLVED persists resolution notes', async () => {
      const notes = 'Replaced faulty fluorescent starter and ballast with standard LED tube fixture.';
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ resolutionNotes: notes }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${data.message}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'RESOLVED');
      assert.strictEqual(data.data.resolutionNotes, notes);
      assert.ok(data.data.resolvedAt, 'resolvedAt timestamp required');

      // Verify DB
      const dbRecord = await prisma.complaint.findUnique({ where: { id: testComplaint1.id } });
      assert.strictEqual(dbRecord.status, 'RESOLVED');
      assert.strictEqual(dbRecord.resolutionNotes, notes);

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entityId: testComplaint1.id, action: 'RESOLVE' },
      });
      assert.ok(log, 'ActivityLog record must exist for RESOLVE');
    });

    // 21. Closure Validation: Cannot close non-RESOLVED complaint
    await test('21. Closure Validation — cannot close an OPEN complaint directly', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400, 'Closing an OPEN complaint must return 400');
      assert.strictEqual(data.success, false);
    });

    // 22. Successful Closure: RESOLVED -> CLOSED
    await test('22. Successful Closure — RESOLVED -> CLOSED officially closes complaint', async () => {
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${data.message}`);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.data.status, 'CLOSED');
      assert.ok(data.data.closedAt, 'closedAt timestamp required');

      // Verify DB
      const dbRecord = await prisma.complaint.findUnique({ where: { id: testComplaint1.id } });
      assert.strictEqual(dbRecord.status, 'CLOSED');

      // Verify ActivityLog
      const log = await prisma.activityLog.findFirst({
        where: { entityId: testComplaint1.id, action: 'CLOSE' },
      });
      assert.ok(log, 'ActivityLog record must exist for CLOSE');
    });

    // 23. Unified Status Transition Endpoint: POST /api/management/complaints/:id/status
    await test('23. Unified Status Endpoint — transitions testComplaint2 through full lifecycle', async () => {
      // 23a. Transition OPEN -> ASSIGNED
      const resAssign = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'ASSIGNED', staffId: maintenanceStaff.id }),
      });
      const dataAssign = await resAssign.json();
      assert.strictEqual(resAssign.status, 200);
      assert.strictEqual(dataAssign.data.status, 'ASSIGNED');

      // 23b. Transition ASSIGNED -> IN_PROGRESS
      const resStart = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'IN_PROGRESS' }),
      });
      const dataStart = await resStart.json();
      assert.strictEqual(resStart.status, 200);
      assert.strictEqual(dataStart.data.status, 'IN_PROGRESS');

      // 23c. Transition IN_PROGRESS -> RESOLVED
      const resResolve = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({
          status: 'RESOLVED',
          resolutionNotes: 'Tightened PVC coupling and sealed with waterproof plumbers thread tape.',
        }),
      });
      const dataResolve = await resResolve.json();
      assert.strictEqual(resResolve.status, 200);
      assert.strictEqual(dataResolve.data.status, 'RESOLVED');

      // 23d. Transition RESOLVED -> CLOSED
      const resClose = await fetch(`${API_BASE}/management/complaints/${testComplaint2.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ status: 'CLOSED' }),
      });
      const dataClose = await resClose.json();
      assert.strictEqual(resClose.status, 200);
      assert.strictEqual(dataClose.data.status, 'CLOSED');
    });

    // 24. Administrative Follow-up Comment Endpoint
    await test('24. Administrative Note — POST /api/management/complaints/:id/comment appends comment', async () => {
      const commentText = 'Maintenance inspection verified by Assistant Warden.';
      const res = await fetch(`${API_BASE}/management/complaints/${testComplaint1.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ comment: commentText }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.data.commentsList), 'commentsList array required');
      const found = data.data.commentsList.some((c) => c.text === commentText);
      assert.ok(found, 'Comment text must be present in commentsList');
    });

    // 25. IDOR & Non-existent IDs Protection
    await test('25. Non-existent Complaint ID — returns 404 Not Found', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const resDetail = await fetch(`${API_BASE}/management/complaints/${nonExistentId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(resDetail.status, 404);

      const resAssign = await fetch(`${API_BASE}/management/complaints/${nonExistentId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
        body: JSON.stringify({ staffId: maintenanceStaff.id }),
      });
      assert.strictEqual(resAssign.status, 404);
    });

    // 26. Database Integrity Verification & Teardown
    await test('26. Database Integrity & Cleanup — cleans test fixtures with 0 invalid records', async () => {
      // Clean up test fixtures created during this run
      await prisma.notification.deleteMany({
        where: { entityId: { in: [testComplaint1.id, testComplaint2.id] } },
      });
      await prisma.activityLog.deleteMany({
        where: { entityId: { in: [testComplaint1.id, testComplaint2.id] } },
      });
      await prisma.complaint.deleteMany({
        where: { id: { in: [testComplaint1.id, testComplaint2.id] } },
      });

      // Verify no orphan complaint records or impossible states in PostgreSQL
      const invalidComplaints = await prisma.complaint.count({
        where: {
          status: {
            notIn: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED', 'REJECTED'],
          },
        },
      });
      assert.strictEqual(invalidComplaints, 0, 'No complaints with invalid statuses must exist in DB');

      // Verify assigned complaints have assignedToId populated
      const invalidAssigned = await prisma.complaint.count({
        where: {
          status: { in: ['ASSIGNED', 'IN_PROGRESS'] },
          assignedToId: null,
        },
      });
      assert.strictEqual(invalidAssigned, 0, 'Assigned complaints must have assignedToId in DB');

      const totalCount = await prisma.complaint.count();
      console.log(`\n  Authoritative PostgreSQL Complaint Count: ${totalCount}`);
    });

  } catch (criticalErr) {
    console.error('Critical test error:', criticalErr);
    failed++;
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log(`  STEP 7 TESTS FINISHED: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
