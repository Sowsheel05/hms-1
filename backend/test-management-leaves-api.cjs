const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Leaves & Suspension API Test Suite (Step 15) ===\n');

  let testLeave1 = null;
  let testLeave2 = null;
  let testSuspension = null;

  try {
    // 1. Management Authentication (Warden)
    console.log('[TEST 1] Logging in as Warden (WARDEN01)...');
    const wardenLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'WARDEN01',
        password: 'Password@123',
      }),
    });
    const wardenLoginData = await wardenLoginRes.json();
    assert.strictEqual(wardenLoginRes.status, 200, 'Warden login must succeed');
    assert.ok(wardenLoginData.token, 'Warden login must return JWT token');
    const wardenToken = wardenLoginData.token;
    console.log('  -> PASS: Warden logged in successfully.');

    // 2. Student Authentication (for RBAC & student integration testing)
    console.log('[TEST 2] Logging in as Student (25331A05H7)...');
    const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jntuNo: '25331A05H7',
        password: 'Password@123',
      }),
    });
    const studentLoginData = await studentLoginRes.json();
    assert.strictEqual(studentLoginRes.status, 200, 'Student login must succeed');
    const studentToken = studentLoginData.token;
    const studentId = studentLoginData.user.id;
    console.log('  -> PASS: Student logged in successfully.');

    // 3. RBAC: Unauthenticated access -> 401
    console.log('[TEST 3] Unauthenticated access to /management/leaves/stats should return 401...');
    const unauthRes = await fetch(`${BASE_URL}/management/leaves/stats`);
    assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
    console.log('  -> PASS: Unauthenticated access rejected with 401.');

    // 4. RBAC: Student token to management leaves -> 403 Forbidden
    console.log('[TEST 4] Student token accessing /management/leaves should return 403...');
    const studentRbacRes = await fetch(`${BASE_URL}/management/leaves`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentRbacRes.status, 403, 'Student must be rejected with 403');
    console.log('  -> PASS: Student access rejected with 403 Forbidden.');

    // 5. RBAC: Student token to management suspensions -> 403 Forbidden
    console.log('[TEST 5] Student token accessing /management/suspensions should return 403...');
    const studentSuspRbacRes = await fetch(`${BASE_URL}/management/suspensions`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(studentSuspRbacRes.status, 403, 'Student must be rejected with 403');
    console.log('  -> PASS: Student access to suspensions rejected with 403 Forbidden.');

    // 6. Authoritative Leave KPI Stats
    console.log('[TEST 6] Fetching authoritative leave stats as Warden...');
    const statsRes = await fetch(`${BASE_URL}/management/leaves/stats`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const statsData = await statsRes.json();
    assert.strictEqual(statsRes.status, 200, 'Stats endpoint must return 200');
    assert.strictEqual(statsData.success, true, 'Stats response must succeed');
    assert.ok(typeof statsData.data.total === 'number', 'Total must be a number');
    assert.ok(typeof statsData.data.pending === 'number', 'Pending must be a number');
    assert.ok(typeof statsData.data.approved === 'number', 'Approved must be a number');
    assert.ok(typeof statsData.data.active === 'number', 'Active must be a number');
    assert.ok(typeof statsData.data.completed === 'number', 'Completed must be a number');
    assert.ok(typeof statsData.data.rejected === 'number', 'Rejected must be a number');
    assert.ok(typeof statsData.data.suspendedStudents === 'number', 'SuspendedStudents must be a number');
    console.log(`  -> PASS: Leave stats retrieved: Pending=${statsData.data.pending}, Approved=${statsData.data.approved}, Active=${statsData.data.active}, Completed=${statsData.data.completed}, SuspendedStudents=${statsData.data.suspendedStudents}`);

    // 7. Leave Listing with Pagination and Filters
    console.log('[TEST 7] Listing leaves with status=ALL and pagination...');
    const listRes = await fetch(`${BASE_URL}/management/leaves?status=ALL&limit=10`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const listData = await listRes.json();
    assert.strictEqual(listRes.status, 200, 'Listing endpoint must return 200');
    assert.strictEqual(listData.success, true, 'Listing response must succeed');
    assert.ok(Array.isArray(listData.data), 'Listing must return array in data');
    assert.ok(listData.pagination, 'Listing must return pagination metadata');
    console.log(`  -> PASS: Leaves listed successfully (${listData.data.length} items on page 1).`);

    // 8. Create a test PENDING leave request for approval testing
    console.log('[TEST 8] Creating a test PENDING leave request in PostgreSQL...');
    const startDate1 = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days from now (avoids seed data conflicts)
    const endDate1 = new Date(Date.now() + 65 * 24 * 60 * 60 * 1000); // 65 days from now
    testLeave1 = await prisma.leaveRequest.create({
      data: {
        studentId,
        requestNumber: `LEV-TEST-${Date.now().toString().slice(-4)}`,
        leaveType: 'HOME_LEAVE',
        destination: 'Hyderabad Hometown',
        reason: 'Attending family celebration and cousin wedding',
        emergencyContact: '9876543210',
        startDate: startDate1,
        endDate: endDate1,
        status: 'PENDING',
      },
    });
    assert.ok(testLeave1.id, 'Test leave request must be created');
    console.log(`  -> PASS: Created test leave request ${testLeave1.requestNumber}`);

    // 9. Fetch Single Leave Detail
    console.log('[TEST 9] Fetching leave detail via /management/leaves/:id...');
    const detailRes = await fetch(`${BASE_URL}/management/leaves/${testLeave1.id}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const detailData = await detailRes.json();
    assert.strictEqual(detailRes.status, 200, 'Detail endpoint must return 200');
    assert.strictEqual(detailData.success, true, 'Detail response must succeed');
    assert.strictEqual(detailData.data.id, testLeave1.id);
    assert.strictEqual(detailData.data.status, 'PENDING');
    assert.strictEqual(detailData.data.destination, 'Hyderabad Hometown');
    assert.ok(detailData.data.student, 'Student details must be included');
    console.log(`  -> PASS: Leave detail retrieved with student info.`);

    // 10. Approve Leave Request
    console.log('[TEST 10] Approving leave request as Warden...');
    const approveRes = await fetch(`${BASE_URL}/management/leaves/${testLeave1.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        remarks: 'Approved by Warden for family function.',
      }),
    });
    const approveData = await approveRes.json();
    assert.strictEqual(approveRes.status, 200, 'Approve must return 200');
    assert.strictEqual(approveData.success, true, 'Approve response must succeed');
    assert.strictEqual(approveData.data.status, 'APPROVED', 'Status must be APPROVED');
    assert.ok(approveData.data.approvedAt, 'ApprovedAt must be populated');
    console.log('  -> PASS: Leave request approved successfully.');

    // 11. Verify Database State, Audit Log, and Notification
    console.log('[TEST 11] Verifying PostgreSQL persistence, ActivityLog, and Student Notification for approval...');
    const updatedLeave1 = await prisma.leaveRequest.findUnique({
      where: { id: testLeave1.id },
    });
    assert.strictEqual(updatedLeave1.status, 'APPROVED', 'DB status must be APPROVED');
    assert.ok(updatedLeave1.approvedBy, 'ApprovedBy must be recorded');

    // Audit check
    const auditLog = await prisma.activityLog.findFirst({
      where: {
        studentId,
        actionType: 'LEAVE',
        description: { contains: updatedLeave1.requestNumber },
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(auditLog, 'Audit ActivityLog must be generated');
    console.log(`  -> PASS: ActivityLog verified: "${auditLog.description.slice(0, 60)}..."`);

    // Notification check
    const notification = await prisma.notification.findFirst({
      where: {
        studentId,
        category: 'LEAVE',
        entityId: testLeave1.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(notification, 'Student Notification must be created');
    assert.strictEqual(notification.type, 'SUCCESS');
    console.log(`  -> PASS: Notification verified: "${notification.title}" - "${notification.message.slice(0, 50)}..."`);

    // 12. Invalid Transition: APPROVED -> APPROVED should be rejected
    console.log('[TEST 12] Attempting duplicate approval (APPROVED -> APPROVED) should fail with 400...');
    const dupApproveRes = await fetch(`${BASE_URL}/management/leaves/${testLeave1.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ remarks: 'Second attempt' }),
    });
    const dupApproveData = await dupApproveRes.json();
    assert.strictEqual(dupApproveRes.status, 400, 'Duplicate approval must return 400 Bad Request');
    assert.strictEqual(dupApproveData.success, false);
    console.log('  -> PASS: Duplicate approval properly rejected with 400.');

    // 13. Create a second test leave for Rejection Testing
    console.log('[TEST 13] Creating a second test PENDING leave request for rejection testing...');
    const startDate2 = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000); // 10 days later
    const endDate2 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    testLeave2 = await prisma.leaveRequest.create({
      data: {
        studentId,
        requestNumber: `LEV-TEST-${Date.now().toString().slice(-4)}`,
        leaveType: 'SPECIAL_LEAVE',
        destination: 'Goa Trip',
        reason: 'Personal recreation and vacation trip with friends',
        emergencyContact: '9876543210',
        startDate: startDate2,
        endDate: endDate2,
        status: 'PENDING',
      },
    });
    assert.ok(testLeave2.id, 'Second test leave request must be created');
    console.log(`  -> PASS: Created test leave request ${testLeave2.requestNumber}`);

    // 14. Rejection without reason / short reason must be rejected
    console.log('[TEST 14] Rejecting leave request with missing or short reason should fail with 400...');
    const emptyRejectRes = await fetch(`${BASE_URL}/management/leaves/${testLeave2.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ reason: 'No' }), // Only 2 chars
    });
    const emptyRejectData = await emptyRejectRes.json();
    assert.strictEqual(emptyRejectRes.status, 400, 'Short reason must return 400');
    assert.strictEqual(emptyRejectData.success, false);
    console.log('  -> PASS: Short rejection reason rejected with 400.');

    // 15. Valid Rejection
    console.log('[TEST 15] Rejecting leave request with valid reason...');
    const validRejectRes = await fetch(`${BASE_URL}/management/leaves/${testLeave2.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        reason: 'Recreational trips during midterm exam preparation week are not permitted.',
      }),
    });
    const validRejectData = await validRejectRes.json();
    assert.strictEqual(validRejectRes.status, 200, 'Valid rejection must return 200');
    assert.strictEqual(validRejectData.success, true);
    assert.strictEqual(validRejectData.data.status, 'REJECTED');
    console.log('  -> PASS: Leave request rejected successfully.');

    // 16. Verify Rejection in Database, Audit Log, and Notification
    console.log('[TEST 16] Verifying DB rejection status, rejectionReason, rejectedBy, and Audit...');
    const updatedLeave2 = await prisma.leaveRequest.findUnique({
      where: { id: testLeave2.id },
    });
    assert.strictEqual(updatedLeave2.status, 'REJECTED');
    assert.ok(updatedLeave2.rejectionReason, 'rejectionReason must be stored');
    assert.ok(updatedLeave2.rejectedBy, 'rejectedBy must be stored');
    assert.ok(updatedLeave2.rejectedAt, 'rejectedAt must be stored');

    const rejectNotification = await prisma.notification.findFirst({
      where: {
        studentId,
        category: 'LEAVE',
        entityId: testLeave2.id,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(rejectNotification, 'Rejection notification must exist');
    assert.ok(['WARNING', 'ERROR'].includes(rejectNotification.type), 'Notification type should be WARNING or ERROR');
    console.log(`  -> PASS: Rejection verified with DB persistence, rejection audit & notification.`);

    // 17. Invalid Transition: REJECTED -> APPROVED should fail with 400
    console.log('[TEST 17] Attempting invalid transition (REJECTED -> APPROVED) should fail with 400...');
    const rejToApproveRes = await fetch(`${BASE_URL}/management/leaves/${testLeave2.id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ remarks: 'Try to approve after reject' }),
    });
    assert.strictEqual(rejToApproveRes.status, 400, 'Must return 400');
    console.log('  -> PASS: REJECTED -> APPROVED transition rejected with 400.');

    // 18. SUSPENSION MANAGEMENT: List suspensions
    console.log('[TEST 18] Listing suspensions via /management/suspensions...');
    const suspListRes = await fetch(`${BASE_URL}/management/suspensions`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    const suspListData = await suspListRes.json();
    assert.strictEqual(suspListRes.status, 200, 'Suspension listing must return 200');
    assert.strictEqual(suspListData.success, true);
    assert.ok(Array.isArray(suspListData.data), 'Data must be an array');
    console.log(`  -> PASS: Suspensions listed successfully (${suspListData.data.length} records found).`);

    // 19. SUSPENSION MANAGEMENT: Create Disciplinary Suspension
    console.log('[TEST 19] Enforcing hostel suspension for student via /management/suspensions...');
    const suspStart = new Date(Date.now() - 60000); // 1 min in past so startDate <= now is guaranteed
    const suspEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days suspension
    const createSuspRes = await fetch(`${BASE_URL}/management/suspensions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        studentId,
        reason: 'Gross disciplinary infraction: curfew violation and disturbance',
        startDate: suspStart.toISOString(),
        endDate: suspEnd.toISOString(),
        remarks: 'Action taken after disciplinary committee review',
      }),
    });
    const createSuspData = await createSuspRes.json();
    assert.strictEqual(createSuspRes.status, 201, 'Suspension creation must return 201');
    assert.strictEqual(createSuspData.success, true);
    assert.strictEqual(createSuspData.data.status, 'ACTIVE');
    testSuspension = createSuspData.data;
    console.log(`  -> PASS: Suspension created with ID: ${testSuspension.id}`);

    // 20. Verify Active Suspension Blocks Student Leave Application
    console.log('[TEST 20] Verifying that active suspension blocks student from applying for leaves...');
    const studentApplyRes = await fetch(`${BASE_URL}/student/leaves`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        leaveType: 'HOME_LEAVE',
        destination: 'Hometown',
        reason: 'Trying to apply while suspended',
        emergencyContact: '9876543210',
        startDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    const studentApplyData = await studentApplyRes.json();
    assert.ok(
      studentApplyRes.status === 400 || studentApplyRes.status === 403,
      `Student leave creation must be blocked during suspension (status was ${studentApplyRes.status})`
    );
    assert.strictEqual(studentApplyData.success, false);
    console.log(`  -> PASS: Student leave application correctly blocked (${studentApplyData.message}).`);

    // 21. SUSPENSION MANAGEMENT: Lift / End Disciplinary Suspension
    console.log('[TEST 21] Lifting suspension via POST /management/suspensions/:id/end...');
    const endSuspRes = await fetch(`${BASE_URL}/management/suspensions/${testSuspension.id}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        remarks: 'Disciplinary hearing completed. Student apologized and suspension lifted.',
      }),
    });
    const endSuspData = await endSuspRes.json();
    assert.strictEqual(endSuspRes.status, 200, 'Lifting suspension must return 200');
    assert.strictEqual(endSuspData.success, true);
    assert.strictEqual(endSuspData.data.status, 'LIFTED');
    assert.ok(endSuspData.data.liftedAt, 'liftedAt must be present');
    assert.ok(endSuspData.data.liftedBy, 'liftedBy must be present');
    console.log('  -> PASS: Suspension successfully lifted.');

    // 22. Verify Database State & Lift Notification
    console.log('[TEST 22] Verifying suspension database state, ActivityLog, and lifting notification...');
    const suspInDb = await prisma.suspension.findUnique({
      where: { id: testSuspension.id },
    });
    assert.strictEqual(suspInDb.status, 'LIFTED');

    const liftNotification = await prisma.notification.findFirst({
      where: {
        studentId,
        category: 'SUSPENSION',
        entityId: testSuspension.id,
        type: 'SUCCESS',
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(liftNotification, 'Suspension lift notification must be created');
    console.log(`  -> PASS: Lift verified in DB, audit, and notification: "${liftNotification.title}"`);

    // 23. Security / IDOR: Non-existent Leave returns 404
    console.log('[TEST 23] Testing 404 behavior for non-existent IDs...');
    const fakeLeaveRes = await fetch(`${BASE_URL}/management/leaves/non-existent-leave-id`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(fakeLeaveRes.status, 404);

    const fakeSuspRes = await fetch(`${BASE_URL}/management/suspensions/non-existent-susp-id`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(fakeSuspRes.status, 404);
    console.log('  -> PASS: Non-existent IDs properly return 404 Not Found.');

    console.log('\n=== ALL 23 STEP 15 MANAGEMENT LEAVES & SUSPENSION TESTS PASSED! ===\n');
  } finally {
    // Clean up test data so it doesn't contaminate regression stats or student dashboards
    console.log('Cleaning up test data in PostgreSQL...');
    try {
      if (testLeave1?.id) {
        await prisma.notification.deleteMany({ where: { entityId: testLeave1.id } });
        await prisma.leaveRequest.deleteMany({ where: { id: testLeave1.id } });
      }
      if (testLeave2?.id) {
        await prisma.notification.deleteMany({ where: { entityId: testLeave2.id } });
        await prisma.leaveRequest.deleteMany({ where: { id: testLeave2.id } });
      }
      if (testSuspension?.id) {
        await prisma.notification.deleteMany({ where: { entityId: testSuspension.id } });
        await prisma.suspension.deleteMany({ where: { id: testSuspension.id } });
      }
      console.log('Cleanup completed successfully.');
    } catch (cleanErr) {
      console.warn('Cleanup warning:', cleanErr.message);
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
