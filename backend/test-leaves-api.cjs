const assert = require('assert');

async function testLeavesApi() {
  console.log('=== Running Student Hostel Leaves & Suspension API Tests ===\n');

  // 1. Authenticate as Student A (MANI MANASVI GAVARA - 25331A05H7)
  const loginARes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginAData = await loginARes.json();
  assert.strictEqual(loginARes.status, 200, 'Login A must succeed');
  const studentAToken = loginAData.token;
  const studentAId = loginAData.user.id;

  // 2. Authenticate as Student B (NAKKULLA RITHIKA - 25331A05H8)
  const loginBRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
  });
  const loginBData = await loginBRes.json();
  assert.strictEqual(loginBRes.status, 200, 'Login B must succeed');
  const studentBToken = loginBData.token;

  // Authenticate Warden for administrative test endpoints
  const wardenLoginRes = await fetch('http://localhost:5001/api/management/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
  });
  const wardenLoginData = await wardenLoginRes.json();
  const wardenToken = wardenLoginData.token;

  // Pre-test cleanup: reset any leftover leaves from interrupted test runs
  const preCheckRes = await fetch('http://localhost:5001/api/student/leaves', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  if (preCheckRes.status === 200) {
    const preCheckData = await preCheckRes.json();
    for (const req of (preCheckData.requests || [])) {
      if (req.status === 'PENDING') {
        await fetch(`http://localhost:5001/api/student/leaves/${req.id}/cancel`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${studentAToken}` },
        });
      } else if (req.status === 'APPROVED') {
        await fetch('http://localhost:5001/api/student/leaves/test/admin-transition', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${wardenToken}`,
          },
          body: JSON.stringify({
            leaveId: req.id,
            targetStatus: 'REJECTED',
            remarks: 'Pre-test baseline cleanup',
          }),
        });
      }
    }
  }

  // TEST 1: Unauthenticated request to /api/student/leaves
  const unauthRes = await fetch('http://localhost:5001/api/student/leaves');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('[PASS] 1. Unauthenticated request to /api/student/leaves rejected with 401');

  // TEST 2: Unauthenticated request to /api/student/leaves/status
  const unauthStatusRes = await fetch('http://localhost:5001/api/student/leaves/status');
  assert.strictEqual(unauthStatusRes.status, 401, 'Unauthenticated status request must return 401');
  console.log('[PASS] 2. Unauthenticated request to /api/student/leaves/status rejected with 401');

  // TEST 3: Authenticated fetch of student leaves & status
  const authRes = await fetch('http://localhost:5001/api/student/leaves', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200, 'Authenticated request must return 200');
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.student.jntuNo, '25331A05H7');
  assert.strictEqual(authData.currentStatus, 'ACTIVE', 'Initial status must be ACTIVE');
  assert.ok(authData.summary !== undefined);
  console.log('[PASS] 3. Authenticated student receives accurate initial leave data and status:', authData.currentStatus);

  // Future date generation
  const now = new Date();
  const dayMs = 24 * 3600 * 1000;
  const startFuture = new Date(now.getTime() + 2 * dayMs).toISOString();
  const endFuture = new Date(now.getTime() + 5 * dayMs).toISOString();
  const pastDate = new Date(now.getTime() - 3 * dayMs).toISOString();

  // TEST 4: Validation: Invalid leave type
  const invalidTypeRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'VACATION_TRIP', // Invalid
      destination: 'Hyderabad, Telangana',
      startDate: startFuture,
      endDate: endFuture,
      reason: 'Visiting family for festival',
    }),
  });
  assert.strictEqual(invalidTypeRes.status, 400, 'Invalid leave type must return 400');
  console.log('[PASS] 4. Invalid leave type rejected with 400');

  // TEST 5: Validation: Reason too short (< 5 chars)
  const shortReasonRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Hyderabad, Telangana',
      startDate: startFuture,
      endDate: endFuture,
      reason: 'Home',
    }),
  });
  assert.strictEqual(shortReasonRes.status, 400, 'Short reason must return 400');
  console.log('[PASS] 5. Reason shorter than 5 chars rejected with 400');

  // TEST 6: Validation: Missing destination
  const noDestRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      startDate: startFuture,
      endDate: endFuture,
      reason: 'Visiting family for Diwali',
    }),
  });
  assert.strictEqual(noDestRes.status, 400, 'Missing destination must return 400');
  console.log('[PASS] 6. Missing destination rejected with 400');

  // TEST 7: Validation: End date before start date
  const invalidDatesRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Vijayawada',
      startDate: endFuture,
      endDate: startFuture, // before start
      reason: 'Visiting home for celebration',
    }),
  });
  assert.strictEqual(invalidDatesRes.status, 400, 'End date before start date must return 400');
  console.log('[PASS] 7. End date before start date rejected with 400');

  // TEST 8: Validation: Start date in past
  const pastStartRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Vijayawada',
      startDate: pastDate,
      endDate: endFuture,
      reason: 'Visiting home for festival',
    }),
  });
  assert.strictEqual(pastStartRes.status, 400, 'Start date in past must return 400');
  console.log('[PASS] 8. Start date in past rejected with 400');

  // TEST 9: Validation: Duration > 30 days
  const longDurationRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'SPECIAL_LEAVE',
      destination: 'Delhi NCR',
      startDate: startFuture,
      endDate: new Date(now.getTime() + 45 * dayMs).toISOString(), // 45 days
      reason: 'Attending long educational summit',
    }),
  });
  assert.strictEqual(longDurationRes.status, 400, 'Duration > 30 days must return 400');
  console.log('[PASS] 9. Leave duration exceeding 30 days rejected with 400');

  // TEST 10: Creation: Valid Leave Application + Status Tampering Prevention
  const createRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Plot 42, Jubilee Hills, Hyderabad',
      startDate: startFuture,
      endDate: endFuture,
      reason: 'Visiting parents for family festival celebration',
      emergencyContact: '+91 98765 43210',
      status: 'APPROVED', // Client attempting status tampering!
    }),
  });
  const createData = await createRes.json();
  assert.strictEqual(createRes.status, 201, 'Valid leave application must return 201');
  assert.strictEqual(createData.success, true);
  assert.strictEqual(createData.leave.status, 'PENDING', 'Backend MUST enforce PENDING status regardless of client payload');
  assert.ok(createData.leave.requestNumber.startsWith('LEV-'), 'Must generate unique LEV ticket number');
  const leaveAId = createData.leave.id;
  console.log('[PASS] 10. Valid leave application created with status PENDING; client tampering attempt ignored');

  // TEST 11: Conflict/Overlap: Attempting second leave covering overlapping dates
  const overlapRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'MEDICAL',
      destination: 'Apollo Hospital',
      startDate: new Date(now.getTime() + 3 * dayMs).toISOString(), // inside existing range
      endDate: new Date(now.getTime() + 4 * dayMs).toISOString(),
      reason: 'Medical checkup and consultation',
    }),
  });
  assert.strictEqual(overlapRes.status, 400, 'Overlapping leave must be rejected with 400');
  console.log('[PASS] 11. Overlapping leave application rejected with 400');

  // TEST 12: Detail API: Authoritative leave detail view
  const detailRes = await fetch(`http://localhost:5001/api/student/leaves/${leaveAId}`, {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const detailData = await detailRes.json();
  assert.strictEqual(detailRes.status, 200, 'Detail request must return 200');
  assert.strictEqual(detailData.leave.id, leaveAId);
  assert.strictEqual(detailData.leave.canCancel, true);
  assert.ok(Array.isArray(detailData.leave.timeline));
  assert.strictEqual(detailData.leave.timeline[0].step, 'SUBMITTED');
  console.log('[PASS] 12. Authoritative leave details retrieved with complete timeline steps');

  // TEST 13: IDOR Prevention: Student B cannot view Student A's leave
  const idorDetailRes = await fetch(`http://localhost:5001/api/student/leaves/${leaveAId}`, {
    headers: { Authorization: `Bearer ${studentBToken}` },
  });
  assert.strictEqual(idorDetailRes.status, 403, 'IDOR detail access must return 403');
  console.log('[PASS] 13. IDOR protected: Student B cannot view Student A\'s leave (403 Forbidden)');

  // TEST 14: IDOR Prevention: Student B cannot cancel Student A's leave
  const idorCancelRes = await fetch(`http://localhost:5001/api/student/leaves/${leaveAId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentBToken}` },
  });
  assert.strictEqual(idorCancelRes.status, 403, 'IDOR cancel access must return 403');
  console.log('[PASS] 14. IDOR protected: Student B cannot cancel Student A\'s leave (403 Forbidden)');

  // TEST 15: Cancellation: Student A cancels their own PENDING leave
  const cancelRes = await fetch(`http://localhost:5001/api/student/leaves/${leaveAId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelRes.status, 200, 'Cancellation must return 200');
  assert.strictEqual(cancelData.leave.status, 'CANCELLED');
  console.log('[PASS] 15. Student successfully cancelled pending leave request');

  // TEST 16: Cancellation of already non-pending leave
  const reCancelRes = await fetch(`http://localhost:5001/api/student/leaves/${leaveAId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  assert.strictEqual(reCancelRes.status, 400, 'Cancelling already cancelled leave must return 400');
  console.log('[PASS] 16. Cancellation of non-pending leave rejected with 400');

  // TEST 17: Suspension Enforcement: Create an active suspension for Student A via controlled test helper
  const suspStart = new Date(now.getTime() - 1 * dayMs).toISOString();
  const suspEnd = new Date(now.getTime() + 10 * dayMs).toISOString();
  const suspRes = await fetch('http://localhost:5001/api/student/leaves/test/admin-suspension', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      studentId: studentAId,
      action: 'CREATE',
      reason: 'Disciplinary breach of hostel code Section 4.2',
      startDate: suspStart,
      endDate: suspEnd,
    }),
  });
  const suspData = await suspRes.json();
  assert.strictEqual(suspRes.status, 201, 'Admin suspension helper must return 201');
  const suspensionId = suspData.suspension.id;

  // Check student status under suspension
  const statusCheckRes = await fetch('http://localhost:5001/api/student/leaves/status', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const statusCheckData = await statusCheckRes.json();
  assert.strictEqual(statusCheckData.currentStatus, 'SUSPENDED', 'Student current status must be SUSPENDED');
  assert.ok(statusCheckData.activeSuspension !== null);
  console.log('[PASS] 17. Suspension active: Student status authoritatively evaluates to SUSPENDED');

  // TEST 18: Suspended student cannot apply for leave
  const blockedLeaveRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'HOME_LEAVE',
      destination: 'Hyderabad',
      startDate: new Date(now.getTime() + 15 * dayMs).toISOString(),
      endDate: new Date(now.getTime() + 18 * dayMs).toISOString(),
      reason: 'Want to go home while suspended',
    }),
  });
  assert.strictEqual(blockedLeaveRes.status, 403, 'Suspended student must be blocked with 403');
  const blockedData = await blockedLeaveRes.json();
  assert.ok(blockedData.message.includes('suspended'));
  console.log('[PASS] 18. Suspended student blocked from submitting leave application (403 Forbidden)');

  // TEST 19: Lift Suspension
  const liftRes = await fetch('http://localhost:5001/api/student/leaves/test/admin-suspension', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      action: 'LIFT',
      suspensionId,
    }),
  });
  assert.strictEqual(liftRes.status, 200, 'Lifting suspension must return 200');

  // Check student status restored
  const restoredStatusRes = await fetch('http://localhost:5001/api/student/leaves/status', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const restoredStatusData = await restoredStatusRes.json();
  assert.strictEqual(restoredStatusData.currentStatus, 'ACTIVE', 'Student current status must restore to ACTIVE');
  console.log('[PASS] 19. Suspension lifted: Student status restored to ACTIVE');

  // TEST 20: Controlled Admin Approval Test & Active Leave Status
  // Create a new leave starting now to tomorrow
  const activeStart = new Date(now.getTime() - 1000 * 60).toISOString(); // 1 min ago
  const activeEnd = new Date(now.getTime() + 2 * dayMs).toISOString();
  const createActiveRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'EMERGENCY',
      destination: 'Kakinada',
      startDate: new Date().toISOString(),
      endDate: activeEnd,
      reason: 'Urgent family emergency requirement',
      emergencyContact: '+91 99887 76655',
    }),
  });
  const activeLeaveData = await createActiveRes.json();
  assert.strictEqual(createActiveRes.status, 201);
  const activeLeaveId = activeLeaveData.leave.id;

  // Transition to APPROVED
  const approveRes = await fetch('http://localhost:5001/api/student/leaves/test/admin-transition', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      leaveId: activeLeaveId,
      targetStatus: 'APPROVED',
      remarks: 'Approved by Chief Warden upon parent verification',
      approverName: 'Dr. K. Srinivas (Chief Warden)',
    }),
  });
  assert.strictEqual(approveRes.status, 200);

  // Verify student status is now ON_LEAVE
  const onLeaveCheckRes = await fetch('http://localhost:5001/api/student/leaves', {
    headers: { Authorization: `Bearer ${studentAToken}` },
  });
  const onLeaveCheckData = await onLeaveCheckRes.json();
  assert.strictEqual(onLeaveCheckData.currentStatus, 'ON_LEAVE', 'Student status must be ON_LEAVE when approved leave is active');
  assert.ok(onLeaveCheckData.activeLeave !== null);
  assert.strictEqual(onLeaveCheckData.activeLeave.effectiveStatus, 'ACTIVE');
  console.log('[PASS] 20. Approved current leave accurately evaluated as ACTIVE and student status as ON_LEAVE');

  // Clean up active test leave and suspensions so remaining test suites run in good standing
  await fetch('http://localhost:5001/api/student/leaves/test/admin-transition', {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${wardenToken}`,
    },
    body: JSON.stringify({
      leaveId: activeLeaveId,
      targetStatus: 'REJECTED',
      remarks: 'Test completed cleanup',
    }),
  });

  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.suspension.updateMany({
    where: { studentId: studentAId, status: 'ACTIVE' },
    data: { status: 'LIFTED', liftedAt: new Date() },
  });
  await prisma.$disconnect();

  console.log('\n=== All 20 Student Leaves & Suspension Tests PASSED! ===\n');
}

testLeavesApi().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
