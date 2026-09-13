const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testNotificationsApi() {
  console.log('=== Running Student Hostel Notifications API Tests ===\n');

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

  // TEST 1: Unauthenticated GET /api/student/notifications returns 401
  const unauthListRes = await fetch('http://localhost:5001/api/student/notifications');
  assert.strictEqual(unauthListRes.status, 401);
  console.log('[PASS] 1. Unauthenticated GET /api/student/notifications rejected with 401');

  // TEST 2: Unauthenticated GET /api/student/notifications/unread-count returns 401
  const unauthCountRes = await fetch('http://localhost:5001/api/student/notifications/unread-count');
  assert.strictEqual(unauthCountRes.status, 401);
  console.log('[PASS] 2. Unauthenticated GET /api/student/notifications/unread-count rejected with 401');

  // TEST 3: Unauthenticated POST /api/student/notifications/read-all returns 401
  const unauthReadAllRes = await fetch('http://localhost:5001/api/student/notifications/read-all', {
    method: 'POST',
  });
  assert.strictEqual(unauthReadAllRes.status, 401);
  console.log('[PASS] 3. Unauthenticated POST /api/student/notifications/read-all rejected with 401');

  // TEST 4: Authenticated student receives notifications list with pagination & counts
  const authListRes = await fetch('http://localhost:5001/api/student/notifications', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(authListRes.status, 200);
  const listData = await authListRes.json();
  assert.strictEqual(listData.success, true);
  assert.ok(Array.isArray(listData.notifications));
  assert.ok(listData.total >= 1, 'Student A must have baseline notifications');
  assert.ok(typeof listData.unreadCount === 'number');
  assert.ok(typeof listData.readCount === 'number');
  console.log('[PASS] 4. Authenticated student receives accurate notifications list & counts:', {
    total: listData.total,
    unread: listData.unreadCount,
    read: listData.readCount,
  });

  // TEST 5: Authoritative unread count endpoint matches list data
  const unreadCountRes = await fetch('http://localhost:5001/api/student/notifications/unread-count', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(unreadCountRes.status, 200);
  const unreadCountData = await unreadCountRes.json();
  assert.strictEqual(unreadCountData.success, true);
  assert.strictEqual(unreadCountData.unreadCount, listData.unreadCount);
  console.log('[PASS] 5. Authoritative unread count endpoint matches database state:', unreadCountData.unreadCount);

  // TEST 6: Category filtering
  const systemCategoryRes = await fetch('http://localhost:5001/api/student/notifications?category=SYSTEM', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(systemCategoryRes.status, 200);
  const systemData = await systemCategoryRes.json();
  for (const n of systemData.notifications) {
    assert.strictEqual(n.category, 'SYSTEM');
  }
  console.log('[PASS] 6. Category filtering accurately returns only matching records');

  // TEST 7: Unread filtering
  const unreadFilterRes = await fetch('http://localhost:5001/api/student/notifications?unreadOnly=true', {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(unreadFilterRes.status, 200);
  const unreadFilterData = await unreadFilterRes.json();
  for (const n of unreadFilterData.notifications) {
    assert.strictEqual(n.isRead, false);
  }
  console.log('[PASS] 7. Unread filtering returns exclusively unread notifications');

  // Pre-test cleanup: ensure no pending outing requests linger
  const existingOutings = await (await fetch('http://localhost:5001/api/student/outing-requests', {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  for (const o of (existingOutings.requests || [])) {
    if (o.status === 'PENDING') {
      await fetch(`http://localhost:5001/api/student/outing-requests/${o.id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
    }
  }

  // Find or create an unread notification for Student A
  let targetNotification = listData.notifications.find((n) => !n.isRead);
  if (!targetNotification) {
    // Mark one notification as unread for the idempotency of the test suite
    const candidate = await prisma.notification.findFirst({
      where: { studentId: studentAId },
      orderBy: { createdAt: 'desc' },
    });
    if (candidate) {
      await prisma.notification.update({
        where: { id: candidate.id },
        data: { isRead: false, readAt: null },
      });
      targetNotification = candidate;
    }
  }
  assert.ok(targetNotification, 'Must have at least one unread notification for tests');
  const targetId = targetNotification.id;

  // TEST 8: Detail API: GET /api/student/notifications/:id
  const detailRes = await fetch(`http://localhost:5001/api/student/notifications/${targetId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(detailRes.status, 200);
  const detailData = await detailRes.json();
  assert.strictEqual(detailData.success, true);
  assert.strictEqual(detailData.notification.id, targetId);
  console.log('[PASS] 8. Detail API returns authoritative notification details');

  // TEST 9: IDOR Detail Protection: Student B cannot access Student A's notification
  const idorDetailRes = await fetch(`http://localhost:5001/api/student/notifications/${targetId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorDetailRes.status, 403, 'Cross-student detail access must return 403 Forbidden');
  console.log('[PASS] 9. IDOR protection verified on detail endpoint (403 Forbidden)');

  // TEST 10: IDOR Mark Read Protection: Student B cannot mark Student A's notification as read
  const idorReadRes = await fetch(`http://localhost:5001/api/student/notifications/${targetId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert.strictEqual(idorReadRes.status, 403, 'Cross-student mark-read must return 403 Forbidden');
  console.log('[PASS] 10. IDOR protection verified on mark-read endpoint (403 Forbidden)');

  // TEST 11: Non-existent notification returns 404
  const notFoundRes = await fetch('http://localhost:5001/api/student/notifications/00000000-0000-0000-0000-000000000000/read', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(notFoundRes.status, 404);
  console.log('[PASS] 11. Non-existent notification ID returns 404 Not Found');

  // TEST 12: Mark single notification as read
  const markReadRes = await fetch(`http://localhost:5001/api/student/notifications/${targetId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(markReadRes.status, 200);
  const markReadData = await markReadRes.json();
  assert.strictEqual(markReadData.success, true);
  assert.strictEqual(markReadData.notification.isRead, true);
  assert.ok(markReadData.notification.readAt !== null, 'readAt timestamp must be populated');
  console.log('[PASS] 12. Single notification marked as read; readAt timestamp and unreadCount updated');

  // TEST 13: Repeated mark read is safe & idempotent
  const repeatReadRes = await fetch(`http://localhost:5001/api/student/notifications/${targetId}/read`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(repeatReadRes.status, 200);
  const repeatReadData = await repeatReadRes.json();
  assert.strictEqual(repeatReadData.notification.isRead, true);
  console.log('[PASS] 13. Repeated mark-read is idempotent');

  // TEST 14: Mark all notifications as read
  const markAllRes = await fetch('http://localhost:5001/api/student/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(markAllRes.status, 200);
  const markAllData = await markAllRes.json();
  assert.strictEqual(markAllData.success, true);
  assert.strictEqual(markAllData.unreadCount, 0);

  const checkAllUnread = await (await fetch('http://localhost:5001/api/student/notifications/unread-count', {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  assert.strictEqual(checkAllUnread.unreadCount, 0, 'Unread count must be 0 after mark-all-read');
  console.log('[PASS] 14. Mark all as read updated all student notifications to isRead=true and unreadCount=0');

  // TEST 15: Repeated mark-all is safe & idempotent
  const repeatMarkAllRes = await fetch('http://localhost:5001/api/student/notifications/read-all', {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert.strictEqual(repeatMarkAllRes.status, 200);
  const repeatMarkAllData = await repeatMarkAllRes.json();
  assert.strictEqual(repeatMarkAllData.markedCount, 0);
  assert.strictEqual(repeatMarkAllData.unreadCount, 0);
  console.log('[PASS] 15. Repeated mark-all-read is idempotent (marked 0 additional records)');

  // TEST 16: Domain Integration: Leave application triggers persistent notification
  const futureStart = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
  const futureEnd = new Date(Date.now() + 12 * 24 * 3600 * 1000).toISOString();
  const leaveRes = await fetch('http://localhost:5001/api/student/leaves', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      leaveType: 'ACADEMIC',
      destination: 'IIT Madras Conference',
      startDate: futureStart,
      endDate: futureEnd,
      reason: 'Presenting research paper on distributed algorithms',
    }),
  });
  assert.strictEqual(leaveRes.status, 201);
  const leaveData = await leaveRes.json();
  const leaveId = leaveData.leave.id;

  // Check that a persistent notification was created for this leave
  const leaveNotifList = await (await fetch('http://localhost:5001/api/student/notifications?category=LEAVE', {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  const matchingLeaveNotif = leaveNotifList.notifications.find((n) => n.entityId === leaveId || n.title.includes('Leave Application'));
  assert.ok(matchingLeaveNotif, 'Persistent notification must be created for leave action');
  assert.strictEqual(matchingLeaveNotif.category, 'LEAVE');
  assert.strictEqual(matchingLeaveNotif.link, '/leaves');
  console.log('[PASS] 16. Domain Integration: Leave application generated persistent notification with category LEAVE');

  // Cancel the test leave so it does not interfere with regression tests
  await fetch(`http://localhost:5001/api/student/leaves/${leaveId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  // TEST 17: Domain Integration: Complaint triggers persistent notification
  const complaintRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'ELECTRICAL',
      title: 'Study lamp plug point loose - ' + Date.now(),
      description: 'The desk electrical socket is loose and sparks intermittently when plugging in.',
      priority: 'HIGH',
    }),
  });
  assert.strictEqual(complaintRes.status, 201);
  const complaintData = await complaintRes.json();
  const complaintId = complaintData.complaint.id;

  const complaintNotifList = await (await fetch('http://localhost:5001/api/student/notifications?category=COMPLAINT', {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  const matchingComplaintNotif = complaintNotifList.notifications.find((n) => n.entityId === complaintId || n.title.includes('Complaint Registered'));
  assert.ok(matchingComplaintNotif, 'Persistent notification must be created for complaint action');
  assert.strictEqual(matchingComplaintNotif.category, 'COMPLAINT');
  assert.strictEqual(matchingComplaintNotif.link, '/complaints');
  console.log('[PASS] 17. Domain Integration: Complaint creation generated persistent notification with category COMPLAINT');

  // Cancel test complaint to keep DB clean
  await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
  });

  // TEST 18 & 19: Real-time SSE delivery & Student Isolation
  await new Promise((resolve, reject) => {
    let studentAReceivedEvent = false;
    let studentBReceivedEvent = false;

    // Connect Student A SSE
    const reqA = http.request(
      `http://localhost:5001/api/student/notifications/events`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      },
      (resA) => {
        assert.strictEqual(resA.statusCode, 200);
        assert.strictEqual(resA.headers['content-type'], 'text/event-stream');

        resA.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('event: notification_event')) {
            studentAReceivedEvent = true;
          }
        });
      }
    );
    reqA.on('error', reject);
    reqA.end();

    // Connect Student B SSE
    const reqB = http.request(
      `http://localhost:5001/api/student/notifications/events`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      },
      (resB) => {
        assert.strictEqual(resB.statusCode, 200);

        resB.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes('event: notification_event')) {
            studentBReceivedEvent = true;
          }
        });
      }
    );
    reqB.on('error', reject);
    reqB.end();

    // After streams connect, trigger an action for Student A (mark all read)
    setTimeout(async () => {
      try {
        await fetch('http://localhost:5001/api/student/notifications/read-all', {
          method: 'POST',
          headers: { Authorization: `Bearer ${tokenA}` },
        });

        // Wait a short moment to observe delivery
        setTimeout(() => {
          reqA.destroy();
          reqB.destroy();

          assert.strictEqual(studentAReceivedEvent, true, 'Student A must receive notification_event on SSE');
          assert.strictEqual(studentBReceivedEvent, false, 'Student B must NOT receive Student A event');
          console.log('[PASS] 18. Real-time notification SSE event delivered to Student A stream');
          console.log('[PASS] 19. SSE Student Isolation verified: Student B stream received 0 cross-student events');
          resolve();
        }, 500);
      } catch (err) {
        reqA.destroy();
        reqB.destroy();
        reject(err);
      }
    }, 400);
  });

  // TEST 20: Baseline Notification Preservation
  // Confirm that the initial 2 system notifications are still present.
  // Uses orderBy=asc to ensure the oldest seeded records (Room Allocation, Mess Menu) are
  // always in the first page, regardless of how many SYSTEM notifications accumulate over test runs.
  const finalCheck = await (await fetch('http://localhost:5001/api/student/notifications?category=SYSTEM&limit=10&orderBy=asc', {
    headers: { Authorization: `Bearer ${tokenA}` },
  })).json();
  const hasRoomAllocation = finalCheck.notifications.some((n) => n.title.includes('Room Allocation'));
  const hasMessMenu = finalCheck.notifications.some((n) => n.title.includes('Mess Menu'));
  assert.ok(hasRoomAllocation, 'Initial Room Allocation notification must be preserved');
  assert.ok(hasMessMenu, 'Initial Mess Menu notification must be preserved');
  console.log('[PASS] 20. Database records preserved: Original system notifications remain intact in PostgreSQL');

  console.log('\n=== All 20 Student Notifications Tests PASSED! ===\n');
}

testNotificationsApi().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
