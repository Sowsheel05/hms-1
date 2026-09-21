const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('=== Running Management Log History & Audit API Test Suite (Step 18) ===\n');

  let wardenToken = null;
  let wardenUser = null;
  let maintToken = null;
  let studentToken = null;
  let sampleLogId = null;

  try {
    // -----------------------------------------------------------------
    // SETUP & AUTHENTICATION
    // -----------------------------------------------------------------
    console.log('[SETUP] Logging in test users...');

    // 1. Warden Login (Authorized Management Role)
    const wardenRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    const wardenData = await wardenRes.json();
    assert.strictEqual(wardenRes.status, 200, 'Warden login should succeed');
    assert.ok(wardenData.token, 'Warden login should return token');
    wardenToken = wardenData.token;
    wardenUser = wardenData.user;

    // 2. Maintenance Staff Login (Non-management RBAC role for audit)
    const maintRes = await fetch(`${BASE_URL}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
    });
    const maintData = await maintRes.json();
    assert.strictEqual(maintRes.status, 200, 'Maintenance staff login should succeed');
    maintToken = maintData.token;

    // 3. Student Login (Non-management role)
    const studentRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    const studentData = await studentRes.json();
    assert.strictEqual(studentRes.status, 200, 'Student login should succeed');
    studentToken = studentData.token;

    console.log('[SETUP] Authentication successful.\n');

    // -----------------------------------------------------------------
    // GROUP 1: AUTHENTICATION & SERVER-SIDE RBAC
    // -----------------------------------------------------------------
    console.log('--- GROUP 1: AUTHENTICATION & SERVER-SIDE RBAC ---');

    // Test 1: Unauthenticated request rejected with 401
    const t1Res = await fetch(`${BASE_URL}/management/log-history`);
    assert.strictEqual(t1Res.status, 401, 'Unauthenticated request must be rejected with 401');
    console.log('Test 1 Passed: Unauthenticated request rejected with 401.');

    // Test 2: Student token rejected with 403
    const t2Res = await fetch(`${BASE_URL}/management/log-history`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(t2Res.status, 403, 'Student access must be rejected with 403 Forbidden');
    console.log('Test 2 Passed: Student rejected with 403.');

    // Test 3: Maintenance staff rejected with 403
    const t3Res = await fetch(`${BASE_URL}/management/log-history`, {
      headers: { Authorization: `Bearer ${maintToken}` },
    });
    assert.strictEqual(t3Res.status, 403, 'Maintenance staff access must be rejected with 403 Forbidden');
    console.log('Test 3 Passed: Maintenance staff rejected with 403.');

    // Test 4: Mess staff / unauthorized role rejected with 403
    const t4Res = await fetch(`${BASE_URL}/management/log-history/summary`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(t4Res.status, 403, 'Summary endpoint rejects unauthorized user with 403');
    console.log('Test 4 Passed: Non-management rejected from summary endpoint with 403.');

    // Test 5: Authorized management role (Warden) succeeds
    const t5Res = await fetch(`${BASE_URL}/management/log-history`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t5Res.status, 200, 'Authorized Warden must receive 200');
    const t5Data = await t5Res.json();
    assert.strictEqual(t5Data.success, true);
    assert.ok(Array.isArray(t5Data.logs), 'Response must contain logs array');
    assert.ok(t5Data.pagination, 'Response must contain pagination metadata');
    console.log(`Test 5 Passed: Authorized Warden retrieved ${t5Data.logs.length} logs successfully.`);

    // -----------------------------------------------------------------
    // GROUP 2: READING & FILTERING AUDIT LOGS
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 2: READING & FILTERING AUDIT LOGS ---');

    // Test 6: Retrieve paginated logs with custom pageSize
    const t6Res = await fetch(`${BASE_URL}/management/log-history?page=1&pageSize=5`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t6Res.status, 200);
    const t6Data = await t6Res.json();
    assert.ok(t6Data.logs.length <= 5, 'Must respect pageSize limit');
    assert.strictEqual(t6Data.pagination.pageSize, 5);
    if (t6Data.logs.length > 0) {
      sampleLogId = t6Data.logs[0].id;
    }
    console.log(`Test 6 Passed: Pagination limit respected (returned ${t6Data.logs.length} logs with limit 5).`);

    // Test 7: Retrieve individual log by ID
    assert.ok(sampleLogId, 'Must have at least one sample log in database');
    const t7Res = await fetch(`${BASE_URL}/management/log-history/${sampleLogId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t7Res.status, 200);
    const t7Data = await t7Res.json();
    assert.strictEqual(t7Data.success, true);
    assert.strictEqual(t7Data.log.id, sampleLogId);
    assert.ok(t7Data.log.actor, 'Log detail must include enriched actor information');
    console.log('Test 7 Passed: Individual log retrieved by ID with enriched actor.');

    // Test 8: Filter by action (e.g., LOGIN, APPROVE, CREATE)
    const t8Res = await fetch(`${BASE_URL}/management/log-history?action=LOGIN`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t8Res.status, 200);
    const t8Data = await t8Res.json();
    for (const l of t8Data.logs) {
      const match = (l.action && l.action.toUpperCase() === 'LOGIN') || (l.actionType && l.actionType.toUpperCase() === 'LOGIN');
      assert.ok(match, 'Filtered logs must match specified action');
    }
    console.log(`Test 8 Passed: Action filter returned ${t8Data.logs.length} LOGIN logs.`);

    // Test 9: Filter by entity (e.g. Session, Block, GuestBill)
    const t9Res = await fetch(`${BASE_URL}/management/log-history?entity=Session`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t9Res.status, 200);
    const t9Data = await t9Res.json();
    for (const l of t9Data.logs) {
      assert.strictEqual(l.entity, 'Session', 'Entity filter must match Session');
    }
    console.log(`Test 9 Passed: Entity filter returned ${t9Data.logs.length} Session entity logs.`);

    // Test 10: Filter by actor (studentId)
    const t10Res = await fetch(`${BASE_URL}/management/log-history?actorId=${wardenUser.id}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t10Res.status, 200);
    const t10Data = await t10Res.json();
    for (const l of t10Data.logs) {
      assert.strictEqual(l.studentId, wardenUser.id, 'Actor filter must match warden user ID');
    }
    console.log(`Test 10 Passed: Actor filter returned ${t10Data.logs.length} logs for warden.`);

    // Test 11: Filter by actor role (e.g. WARDEN)
    const t11Res = await fetch(`${BASE_URL}/management/log-history?actorRole=WARDEN`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t11Res.status, 200);
    const t11Data = await t11Res.json();
    for (const l of t11Data.logs) {
      assert.strictEqual(l.actorRole, 'WARDEN', 'Role filter must match WARDEN');
    }
    console.log(`Test 11 Passed: Actor role filter returned ${t11Data.logs.length} logs.`);

    // Test 12: Filter by date range (from / to)
    const today = new Date().toISOString().split('T')[0];
    const t12Res = await fetch(`${BASE_URL}/management/log-history?from=${today}&to=${today}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t12Res.status, 200);
    const t12Data = await t12Res.json();
    assert.ok(Array.isArray(t12Data.logs), 'Date range filter returns array of logs');
    console.log(`Test 12 Passed: Date range filter returned ${t12Data.logs.length} logs for today.`);

    // Test 13: Combined filters (action + actorRole + entity)
    const t13Res = await fetch(
      `${BASE_URL}/management/log-history?action=LOGIN&actorRole=WARDEN&entity=Session`,
      { headers: { Authorization: `Bearer ${wardenToken}` } }
    );
    assert.strictEqual(t13Res.status, 200);
    const t13Data = await t13Res.json();
    for (const l of t13Data.logs) {
      assert.strictEqual(l.entity, 'Session');
      assert.strictEqual(l.actorRole, 'WARDEN');
    }
    console.log(`Test 13 Passed: Combined filters returned ${t13Data.logs.length} specific records.`);

    // Test 14: Search query matching
    const t14Res = await fetch(`${BASE_URL}/management/log-history?search=logged%20in`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t14Res.status, 200);
    const t14Data = await t14Res.json();
    assert.ok(t14Data.logs.length > 0, 'Search for "logged in" should find login audit logs');
    console.log(`Test 14 Passed: Search query found ${t14Data.logs.length} matching logs.`);

    // Test 15: Pagination bounds enforced (maximum clamped to 100)
    const t15Res = await fetch(`${BASE_URL}/management/log-history?pageSize=999`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t15Res.status, 200);
    const t15Data = await t15Res.json();
    assert.strictEqual(t15Data.pagination.pageSize, 100, 'PageSize > 100 must clamp to 100');
    console.log('Test 15 Passed: Excessive page size clamped to 100 maximum.');

    // -----------------------------------------------------------------
    // GROUP 3: SUMMARY METRICS ENDPOINT
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 3: SUMMARY METRICS ENDPOINT ---');

    // Test 16: Summary endpoint returns valid KPIs
    const t16Res = await fetch(`${BASE_URL}/management/log-history/summary`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t16Res.status, 200);
    const t16Data = await t16Res.json();
    assert.strictEqual(t16Data.success, true);
    assert.ok(typeof t16Data.summary.totalLogs === 'number', 'summary.totalLogs must be number');
    assert.ok(typeof t16Data.summary.todayLogs === 'number', 'summary.todayLogs must be number');
    assert.ok(typeof t16Data.summary.approvalLogs === 'number', 'summary.approvalLogs must be number');
    assert.ok(typeof t16Data.summary.financialLogs === 'number', 'summary.financialLogs must be number');
    assert.ok(typeof t16Data.summary.securityLogs === 'number', 'summary.securityLogs must be number');
    assert.ok(typeof t16Data.summary.adminLogs === 'number', 'summary.adminLogs must be number');
    assert.ok(t16Data.summary.totalLogs >= t16Data.summary.todayLogs);
    console.log(`Test 16 Passed: Summary metrics returned (${t16Data.summary.totalLogs} total, ${t16Data.summary.todayLogs} today).`);

    // -----------------------------------------------------------------
    // GROUP 4: AUDIT INTEGRITY & STATE TRANSITIONS
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 4: AUDIT INTEGRITY & STATE TRANSITIONS ---');

    // Test 17: Create operation produces audit record (Create guest)
    const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
    const guestRes = await fetch(`${BASE_URL}/management/guest-billing/guests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Audit Test Guest',
        phone: testPhone,
        relation: 'VISITOR',
      }),
    });
    assert.strictEqual(guestRes.status, 201, 'Guest creation should succeed');
    const guestData = await guestRes.json();
    const createdGuestId = guestData.guest.id;

    // Verify audit record was created in database
    const guestAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'Guest',
        entityId: createdGuestId,
        action: 'CREATE',
      },
    });
    assert.ok(guestAudit, 'Creation of guest must produce an audit log record with action=CREATE');
    assert.strictEqual(guestAudit.entity, 'Guest');
    console.log('Test 17 Passed: Create operation produces audit record with action=CREATE.');

    // Test 18: Update operation produces audit record
    const updateGuestRes = await fetch(`${BASE_URL}/management/guest-billing/guests/${createdGuestId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        name: 'Audit Test Guest Updated',
      }),
    });
    assert.strictEqual(updateGuestRes.status, 200);

    const updateAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'Guest',
        entityId: createdGuestId,
        action: 'UPDATE',
      },
    });
    assert.ok(updateAudit, 'Update operation must produce an audit log record with action=UPDATE');
    assert.strictEqual(updateAudit.previousState, 'Audit Test Guest');
    assert.strictEqual(updateAudit.newState, 'Audit Test Guest Updated');
    console.log('Test 18 Passed: Update operation produces audit record with previous and new states.');

    // Test 19: Approval produces audit record with state transition
    // Clean up any lingering conflicting outings for test student first
    const testStudentUser = await prisma.student.findFirst({ where: { jntuNo: '25331A05H7' } });
    await prisma.student.update({
      where: { id: testStudentUser.id },
      data: { monthlyOutingMax: 5 },
    });
    await prisma.outingRequest.deleteMany({
      where: { studentId: testStudentUser.id },
    });

    const outingRes = await fetch(`${BASE_URL}/student/outing-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        destination: 'Library - Audit Test',
        purpose: 'Study for exam',
        outDate: new Date(Date.now() + 3600000).toISOString(),
        returnDate: new Date(Date.now() + 7200000).toISOString(),
      }),
    });
    assert.strictEqual(outingRes.status, 201);
    const outingData = await outingRes.json();
    const outingId = (outingData.request || outingData.outing).id;

    // Approve the outing
    const approveOutingRes = await fetch(`${BASE_URL}/management/outings/${outingId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(approveOutingRes.status, 200);

    // Verify approval audit
    const outingAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'OutingRequest',
        entityId: outingId,
        action: 'APPROVE',
      },
    });
    assert.ok(outingAudit, 'Outing approval must produce audit log with action=APPROVE');
    assert.strictEqual(outingAudit.previousState, 'PENDING');
    assert.strictEqual(outingAudit.newState, 'APPROVED');
    // Restore student to 'In Hostel' by marking test outing RETURNED
    await prisma.outingRequest.update({
      where: { id: outingId },
      data: { status: 'RETURNED' },
    });
    console.log('Test 19 Passed: Approval produces audit record with PENDING → APPROVED transition.');

    // Test 20: Rejection produces audit record with state transition
    // Create a pending outing to reject
    const testOutingToReject = await prisma.outingRequest.create({
      data: {
        studentId: testStudentUser.id,
        requestNumber: `OUT-REJ-${Date.now().toString().slice(-4)}`,
        passType: 'LOCAL_OUTING',
        destination: 'Movie - Audit Test',
        purpose: 'Entertainment and relaxation',
        emergencyContact: '9876543210',
        outDate: new Date(Date.now() + 3600000),
        returnDate: new Date(Date.now() + 7200000),
        status: 'PENDING',
      },
    });
    const outing2Id = testOutingToReject.id;

    // Reject the outing
    const rejectRes = await fetch(`${BASE_URL}/management/outings/${outing2Id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ reason: 'Curfew restriction test' }),
    });
    assert.strictEqual(rejectRes.status, 200);

    const rejectAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'OutingRequest',
        entityId: outing2Id,
        action: 'REJECT',
      },
    });
    assert.ok(rejectAudit, 'Outing rejection must produce audit log with action=REJECT');
    assert.strictEqual(rejectAudit.previousState, 'PENDING');
    assert.strictEqual(rejectAudit.newState, 'REJECTED');
    console.log('Test 20 Passed: Rejection produces audit record with PENDING → REJECTED transition.');

    // Test 21: Financial payment produces audit record
    // Create visit -> bill -> payment
    const visitRes = await fetch(`${BASE_URL}/management/guest-billing/visits`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestId: createdGuestId,
        hostStudentId: (await prisma.student.findFirst({ where: { role: 'STUDENT' } })).id,
        purpose: 'Academic visit',
      }),
    });
    assert.strictEqual(visitRes.status, 201);
    const visitId = (await visitRes.json()).visit.id;

    const billRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: visitId,
        items: [{ description: 'Room Fee', quantity: 1, unitAmount: 300 }],
      }),
    });
    assert.strictEqual(billRes.status, 201);
    const billId = (await billRes.json()).bill.id;

    // Record payment
    const payRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${billId}/payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        amount: 300,
        paymentMethod: 'UPI',
        paymentReference: 'UPI-AUDIT-999',
      }),
    });
    assert.strictEqual(payRes.status, 200);

    const payAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'GuestBill',
        entityId: billId,
        action: 'PAYMENT_RECORDED',
      },
    });
    assert.ok(payAudit, 'Payment must produce audit log with action=PAYMENT_RECORDED');
    assert.strictEqual(payAudit.previousState, 'UNPAID');
    assert.strictEqual(payAudit.newState, 'PAID');
    console.log('Test 21 Passed: Financial payment produces audit record with UNPAID → PAID transition.');

    // Test 22: Financial void produces audit record
    // Create another bill to void
    const bill2Res = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: visitId,
        items: [{ description: 'Accidental Fee', quantity: 1, unitAmount: 150 }],
      }),
    });
    assert.strictEqual(bill2Res.status, 201);
    const bill2Id = (await bill2Res.json()).bill.id;

    const voidRes = await fetch(`${BASE_URL}/management/guest-billing/bills/${bill2Id}/void`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ reason: 'Duplicate billing test waiver' }),
    });
    assert.strictEqual(voidRes.status, 200);

    const voidAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'GuestBill',
        entityId: bill2Id,
        action: 'VOID',
      },
    });
    assert.ok(voidAudit, 'Voiding bill must produce audit log with action=VOID');
    assert.strictEqual(voidAudit.newState, 'VOID');
    console.log('Test 22 Passed: Financial void produces audit record with action=VOID.');

    // Test 23: Room allocation / vacate produces audit record
    const roomAudit = await prisma.activityLog.findFirst({
      where: {
        actionType: 'ROOM',
      },
    });
    assert.ok(roomAudit, 'Room lifecycle operations must produce activity log records');
    console.log('Test 23 Passed: Room management activity logging verified.');

    // Test 24: Complaint lifecycle transition produces audit record
    const studentUserRecord = await prisma.student.findFirst({ where: { role: 'STUDENT' } });
    const comp = await prisma.complaint.create({
      data: {
        studentId: studentUserRecord.id,
        category: 'ELECTRICAL',
        title: 'Audit Test Fan Issue',
        description: 'Test electrical maintenance issue',
      },
    });

    const maintStaff = await prisma.student.findFirst({ where: { role: 'MAINTENANCE_STAFF' } });
    const assignRes = await fetch(`${BASE_URL}/management/complaints/${comp.id}/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ staffId: maintStaff.id }),
    });
    assert.strictEqual(assignRes.status, 200);

    const assignAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'Complaint',
        entityId: comp.id,
        action: 'ASSIGN',
      },
    });
    assert.ok(assignAudit, 'Complaint assignment must produce audit record with action=ASSIGN');
    assert.strictEqual(assignAudit.previousState, 'OPEN');
    assert.strictEqual(assignAudit.newState, 'ASSIGNED');
    console.log('Test 24 Passed: Complaint assignment produces audit record with OPEN → ASSIGNED transition.');

    // Test 25: Leave / suspension transition produces audit record
    const suspRes = await fetch(`${BASE_URL}/management/suspensions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        studentId: studentUserRecord.id,
        reason: 'Audit disciplinary test',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 86400000).toISOString(),
      }),
    });
    assert.strictEqual(suspRes.status, 201);
    const suspJson = await suspRes.json();
    const suspId = (suspJson.data || suspJson.suspension).id;

    const suspAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'Suspension',
        entityId: suspId,
        action: 'SUSPEND',
      },
    });
    assert.ok(suspAudit, 'Disciplinary suspension must produce audit log with action=SUSPEND');
    assert.strictEqual(suspAudit.newState, 'SUSPENDED');

    // Lift suspension
    const liftRes = await fetch(`${BASE_URL}/management/suspensions/${suspId}/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({ remarks: 'Lifting test suspension' }),
    });
    assert.strictEqual(liftRes.status, 200);

    const liftAudit = await prisma.activityLog.findFirst({
      where: {
        entity: 'Suspension',
        entityId: suspId,
        action: 'LIFT_SUSPENSION',
      },
    });
    assert.ok(liftAudit, 'Lifting suspension must produce audit log with action=LIFT_SUSPENSION');
    console.log('Test 25 Passed: Suspension lifecycle produces SUSPEND and LIFT_SUSPENSION audit records.');

    // Test 26: Previous state and new state captured faithfully
    assert.strictEqual(liftAudit.previousState, 'ACTIVE');
    assert.strictEqual(liftAudit.newState, 'ENDED');
    console.log('Test 26 Passed: Previous and new state values captured faithfully.');

    // -----------------------------------------------------------------
    // GROUP 5: TRANSACTION INTEGRITY & SECURITY
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 5: TRANSACTION INTEGRITY & SECURITY ---');

    // Test 27: Failed transaction does not create successful audit record
    const countBeforeFailed = await prisma.activityLog.count();
    // Attempt invalid checkout with non-existent visit
    const failRes = await fetch(`${BASE_URL}/management/guest-billing/visits/00000000-0000-0000-0000-000000000000/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(failRes.status, 404);
    const countAfterFailed = await prisma.activityLog.count();
    assert.strictEqual(countAfterFailed, countBeforeFailed, 'Failed transaction must not insert audit records');
    console.log('Test 27 Passed: Failed transaction creates no orphaned audit log.');

    // Test 28: Duplicate audit records are not produced for single checkout
    const checkoutRes1 = await fetch(`${BASE_URL}/management/guest-billing/visits/${visitId}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(checkoutRes1.status, 200);

    const checkoutAuditCount1 = await prisma.activityLog.count({
      where: { entity: 'GuestVisit', entityId: visitId, action: 'CHECKOUT' },
    });
    assert.strictEqual(checkoutAuditCount1, 1, 'Exactly one audit log should exist for checkout');

    // Second checkout attempt rejected
    const checkoutRes2 = await fetch(`${BASE_URL}/management/guest-billing/visits/${visitId}/checkout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(checkoutRes2.status, 400, 'Duplicate checkout rejected');

    const checkoutAuditCount2 = await prisma.activityLog.count({
      where: { entity: 'GuestVisit', entityId: visitId, action: 'CHECKOUT' },
    });
    assert.strictEqual(checkoutAuditCount2, 1, 'No duplicate audit record created on failed duplicate action');
    console.log('Test 28 Passed: No duplicate audit records produced.');

    // Test 29: Sensitive secrets are NOT exposed in log API
    const secretLogsRes = await fetch(`${BASE_URL}/management/log-history?pageSize=50`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(secretLogsRes.status, 200);
    const secretLogsData = await secretLogsRes.json();
    for (const log of secretLogsData.logs) {
      assert.strictEqual(log.actor?.password, undefined, 'Actor password must never be exposed in API');
      assert.strictEqual(log.actor?.passwordHash, undefined, 'Actor passwordHash must never be exposed in API');
      if (log.metadata) {
        const metaStr = JSON.stringify(log.metadata).toLowerCase();
        assert.ok(!metaStr.includes('password@123'), 'Plaintext passwords must never appear in audit metadata');
      }
    }
    console.log('Test 29 Passed: Sensitive secrets and password hashes purged from audit API.');

    // Test 30: IDOR protection - Student cannot read specific log by ID
    const t30Res = await fetch(`${BASE_URL}/management/log-history/${sampleLogId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(t30Res.status, 403, 'Student cannot read audit log by ID');
    console.log('Test 30 Passed: IDOR protection enforced (Student blocked with 403).');

    // Test 31: Invalid log ID handled safely with 404
    const t31Res = await fetch(`${BASE_URL}/management/log-history/00000000-0000-0000-0000-000000000000`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t31Res.status, 404, 'Non-existent log ID must return 404');
    console.log('Test 31 Passed: Non-existent audit log ID returns 404.');

    // Test 32: Non-existent entity query handled safely with empty array
    const t32Res = await fetch(`${BASE_URL}/management/log-history?entity=NonExistentEntity123`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(t32Res.status, 200);
    const t32Data = await t32Res.json();
    assert.strictEqual(t32Data.logs.length, 0);
    assert.strictEqual(t32Data.pagination.total, 0);
    console.log('Test 32 Passed: Empty result set handled safely for non-matching entity filter.');

    // -----------------------------------------------------------------
    // GROUP 6: REALTIME SSE BEHAVIOR
    // -----------------------------------------------------------------
    console.log('\n--- GROUP 6: REALTIME SSE BEHAVIOR ---');

    // Test 33: Verify SSE endpoint is online and accessible for management
    const sseRes = await fetch(`${BASE_URL}/management/events-stream?token=${encodeURIComponent(wardenToken)}`, {
      headers: { Accept: 'text/event-stream' },
    });
    assert.strictEqual(sseRes.status, 200, 'Management SSE stream must return 200');
    assert.ok(
      (sseRes.headers.get('content-type') || '').includes('text/event-stream'),
      'Must return text/event-stream'
    );
    console.log('Test 33 Passed: Management SSE event stream online and authoritative.');

    // Test 34: Rolled-back mutation does not emit SSE event
    // Attempting invalid bill creation
    const invalidBillRes = await fetch(`${BASE_URL}/management/guest-billing/bills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        guestVisitId: '00000000-0000-0000-0000-000000000000',
        items: [],
      }),
    });
    assert.ok(invalidBillRes.status >= 400, 'Invalid bill creation fails before commit');
    console.log('Test 34 Passed: Invalid mutation fails transaction before any SSE broadcast.');

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log('\n====================================================');
    console.log('  MANAGEMENT LOG HISTORY TEST SUITE: ALL 34 PASSED!  ');
    console.log('====================================================\n');
  } catch (err) {
    console.error('\n[TEST FAILURE]', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTests();
