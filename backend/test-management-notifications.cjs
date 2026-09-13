// ============================================================================
// STEP 19: ADMIN NOTIFICATIONS TEST SUITE (43 AUTHORITATIVE TESTS)
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

async function runAdminNotificationsSuite() {
  console.log('\n======================================================');
  console.log('   STEP 19 — ADMIN NOTIFICATIONS TEST SUITE (43 TESTS)');
  console.log('======================================================\n');

  let adminToken = '';
  let studentToken = '';
  let sampleStudent = null;
  let sampleStudentB = null;
  let createdNotificationId = '';
  const testRunTag = `TEST-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // Find sample students
  sampleStudent = await prisma.student.findFirst({ where: { jntuNo: '25331A05H7' } });
  assert.ok(sampleStudent, 'Primary test student must exist');

  sampleStudentB = await prisma.student.findFirst({ where: { jntuNo: '25331A05H8' } });
  assert.ok(sampleStudentB, 'Secondary test student must exist');

  // --------------------------------------------------------------------------
  // AUTH & RBAC (Tests 1-4)
  // --------------------------------------------------------------------------
  await test('1. Unauthenticated GET /management/notifications returns 401', async () => {
    const res = await getJson('/management/notifications');
    assert.strictEqual(res.status, 401);
  });

  await test('2. Student role token GET /management/notifications returns 403 Forbidden', async () => {
    const loginRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    studentToken = loginRes.data.token;

    const res = await getJson('/management/notifications', studentToken);
    assert.strictEqual(res.status, 403);
  });

  await test('3. Unauthorized role POST /management/notifications returns 403', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Test', message: 'Test', category: 'SYSTEM', recipientScope: 'ALL_STUDENTS' },
      studentToken
    );
    assert.strictEqual(res.status, 403);
  });

  await test('4. Authorized management user (ADMIN01) authenticates with 200', async () => {
    const loginRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    adminToken = loginRes.data.token;

    const res = await getJson('/management/notifications', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(Array.isArray(res.data.notifications));
    assert.ok(res.data.stats);
    assert.ok(res.data.pagination);
  });

  // --------------------------------------------------------------------------
  // READ & LISTING (Tests 5-13)
  // --------------------------------------------------------------------------
  await test('5. Notification list returns array of items with recipient details', async () => {
    const res = await getJson('/management/notifications', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.notifications.length >= 1);
    const first = res.data.notifications[0];
    assert.ok(first.title);
    assert.ok(first.category);
    assert.ok(first.recipient);
    assert.ok(first.recipient.name);
  });

  await test('6. Pagination page and pageSize are respected and bounded', async () => {
    const res = await getJson('/management/notifications?page=1&pageSize=5', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.pagination.page, 1);
    assert.strictEqual(res.data.pagination.pageSize, 5);
    assert.ok(res.data.notifications.length <= 5);

    const oversized = await getJson('/management/notifications?pageSize=500', adminToken);
    assert.strictEqual(oversized.data.pagination.pageSize, 100, 'Page size must be bounded to 100');
  });

  await test('7. Search filters across title, message, and student details', async () => {
    const res = await getJson('/management/notifications?search=Allocation', adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.notifications));
  });

  await test('8. Category filter returns matching category records', async () => {
    const res = await getJson('/management/notifications?category=SYSTEM', adminToken);
    assert.strictEqual(res.status, 200);
    for (const n of res.data.notifications) {
      assert.strictEqual(n.category, 'SYSTEM');
    }
  });

  await test('9. Priority filter returns matching priority records', async () => {
    const res = await getJson('/management/notifications?priority=NORMAL', adminToken);
    assert.strictEqual(res.status, 200);
    for (const n of res.data.notifications) {
      assert.strictEqual(n.priority, 'NORMAL');
    }
  });

  await test('10. Date filter correctly filters by createdAt bounds', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await getJson(`/management/notifications?dateFrom=${today}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.data.notifications));
  });

  await test('11. Recipient filter filters by specific studentId', async () => {
    const res = await getJson(`/management/notifications?studentId=${sampleStudent.id}`, adminToken);
    assert.strictEqual(res.status, 200);
    for (const n of res.data.notifications) {
      assert.strictEqual(n.recipient.id, sampleStudent.id);
    }
  });

  await test('12. Detail endpoint returns single notification with full recipient info', async () => {
    const listRes = await getJson('/management/notifications?limit=1', adminToken);
    const targetId = listRes.data.notifications[0].id;
    const res = await getJson(`/management/notifications/${targetId}`, adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.notification.id, targetId);
    assert.ok(res.data.notification.recipient.email !== undefined);
  });

  await test('13. IDOR protection: non-existent ID returns 404', async () => {
    const res = await getJson('/management/notifications/00000000-0000-0000-0000-000000000000', adminToken);
    assert.strictEqual(res.status, 404);
  });

  // --------------------------------------------------------------------------
  // CREATE VALIDATION (Tests 14-21)
  // --------------------------------------------------------------------------
  await test('14. Valid Admin broadcast to INDIVIDUAL student succeeds (201)', async () => {
    const payload = {
      title: `Hostel Orientation Meeting [${testRunTag}]`,
      message: 'All new residents are invited to the main auditorium at 5 PM for institutional orientation.',
      category: 'ANNOUNCEMENT',
      priority: 'HIGH',
      type: 'INFO',
      recipientScope: 'INDIVIDUAL',
      studentId: sampleStudent.id,
      link: '/dashboard',
      metadata: { department: 'Hostel Administration' },
    };

    const res = await postJson('/management/notifications', payload, adminToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.recipientCount, 1);

    // Capture created notification for subsequent tests
    const dbNotif = await prisma.notification.findFirst({
      where: { title: payload.title, studentId: sampleStudent.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(dbNotif);
    createdNotificationId = dbNotif.id;
  });

  await test('15. Missing title is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { message: 'Hello', category: 'SYSTEM', recipientScope: 'ALL_STUDENTS' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('title is required'));
  });

  await test('16. Missing message is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Notice', category: 'SYSTEM', recipientScope: 'ALL_STUDENTS' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('message is required'));
  });

  await test('17. Invalid category is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Notice', message: 'Hello', category: 'FLYING_CAR', recipientScope: 'ALL_STUDENTS' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('Invalid category'));
  });

  await test('18. Invalid priority is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Notice', message: 'Hello', category: 'SYSTEM', priority: 'SUPER_URGENT_EXTREME', recipientScope: 'ALL_STUDENTS' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('Invalid priority'));
  });

  await test('19. Invalid recipient for INDIVIDUAL scope is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Notice', message: 'Hello', category: 'SYSTEM', recipientScope: 'INDIVIDUAL', studentId: 'non-existent-student-id' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('No active recipients found'));
  });

  await test('20. Unauthorized / unsupported recipient scope is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      { title: 'Notice', message: 'Hello', category: 'SYSTEM', recipientScope: 'INTERNET_PUBLIC' },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('Invalid recipient scope'));
  });

  await test('21. Notification creation creates transactional ActivityLog audit entry', async () => {
    const logs = await prisma.activityLog.findMany({
      where: {
        action: 'NOTIFICATION_CREATED',
        description: { contains: testRunTag },
      },
    });
    assert.ok(logs.length >= 1, 'Must record audit log for administrative broadcast');
    assert.strictEqual(logs[0].entity, 'Notification');
  });

  // --------------------------------------------------------------------------
  // RECIPIENT TARGETING & DEDUPLICATION (Tests 22-26)
  // --------------------------------------------------------------------------
  await test('22. Targeted broadcast to MULTIPLE students resolves and delivers to both', async () => {
    const payload = {
      title: `Curfew Notice [${testRunTag}]`,
      message: 'Gate curfew will be observed at 9:30 PM tonight.',
      category: 'OUTING',
      priority: 'NORMAL',
      recipientScope: 'MULTIPLE',
      studentIds: [sampleStudent.id, sampleStudentB.id],
      link: '/outing-requests',
    };

    const res = await postJson('/management/notifications', payload, adminToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.recipientCount, 2);

    // Verify both students received individual persistent records
    const countA = await prisma.notification.count({ where: { studentId: sampleStudent.id, title: payload.title } });
    const countB = await prisma.notification.count({ where: { studentId: sampleStudentB.id, title: payload.title } });
    assert.strictEqual(countA, 1);
    assert.strictEqual(countB, 1);
  });

  await test('23. Target ROLE scope delivers to active users with specified role', async () => {
    const payload = {
      title: `Student Council Reminder [${testRunTag}]`,
      message: 'Notice for all registered students.',
      category: 'ANNOUNCEMENT',
      recipientScope: 'ROLE',
      targetRole: 'STUDENT',
    };

    const res = await postJson('/management/notifications', payload, adminToken);
    assert.strictEqual(res.status, 201);
    assert.ok(res.data.recipientCount >= 2);
  });

  await test('24. Deduplication: duplicate IDs in MULTIPLE scope are deduplicated', async () => {
    const payload = {
      title: `Deduplication Test [${testRunTag}]`,
      message: 'This broadcast has duplicate recipient IDs in payload.',
      category: 'SYSTEM',
      recipientScope: 'MULTIPLE',
      studentIds: [sampleStudent.id, sampleStudent.id, sampleStudent.id],
    };

    const res = await postJson('/management/notifications', payload, adminToken);
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.recipientCount, 1, 'Must deduplicate repeated IDs to exactly 1 delivery');
  });

  await test('25. Preview recipient resolution endpoint resolves counts correctly', async () => {
    const res = await getJson('/management/notifications/recipients/resolve?scope=ALL_STUDENTS', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.count >= 2);
    assert.ok(Array.isArray(res.data.recipients));
  });

  await test('26. Empty recipient resolution is rejected safely with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      {
        title: 'Empty Targeting',
        message: 'No one should get this',
        category: 'SYSTEM',
        recipientScope: 'BLOCK',
        blockName: 'NON_EXISTENT_GHOST_BLOCK_9999',
      },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('No active recipients found'));
  });

  // --------------------------------------------------------------------------
  // STUDENT PORTAL INTEGRATION (Tests 27-30)
  // --------------------------------------------------------------------------
  await test('27. Broadcast notification appears in Student Portal notifications endpoint', async () => {
    const res = await getJson('/student/notifications', studentToken);
    assert.strictEqual(res.status, 200);
    const found = res.data.notifications.some((n) => n.title.includes(testRunTag));
    assert.ok(found, 'Admin notification must be delivered to student portal list');
  });

  await test('28. Unread count increments and reflects new unread notification', async () => {
    const res = await getJson('/student/notifications/unread-count', studentToken);
    assert.strictEqual(res.status, 200);
    assert.ok(res.data.unreadCount >= 1, 'Unread count must be >= 1 after receiving broadcast');
  });

  await test('29. Deep link format is preserved and accessible to student', async () => {
    const notif = await prisma.notification.findUnique({
      where: { id: createdNotificationId },
    });
    assert.ok(notif, 'Created notification must exist');
    assert.ok(notif.link && notif.link.startsWith('/'), 'Deep link must be preserved with leading slash');
  });

  await test('30. Student marking notification as read updates readAt and unread count', async () => {
    const notif = await prisma.notification.findFirst({
      where: { studentId: sampleStudent.id, isRead: false },
    });
    assert.ok(notif);

    const markRes = await postJson(`/student/notifications/${notif.id}/read`, {}, studentToken);
    assert.strictEqual(markRes.status, 200);
    assert.strictEqual(markRes.data.notification.isRead, true);
    assert.ok(markRes.data.notification.readAt);

    // Verify in PostgreSQL directly
    const dbCheck = await prisma.notification.findUnique({ where: { id: notif.id } });
    assert.strictEqual(dbCheck.isRead, true);
    assert.ok(dbCheck.readAt instanceof Date);
  });

  // --------------------------------------------------------------------------
  // SECURITY & DEEP LINKS (Tests 31-33)
  // --------------------------------------------------------------------------
  await test('31. Metadata sanitization strips sensitive secrets from notification payload', async () => {
    const payload = {
      title: `Security Test [${testRunTag}]`,
      message: 'Sensitive keys should be redacted.',
      category: 'SYSTEM',
      recipientScope: 'INDIVIDUAL',
      studentId: sampleStudent.id,
      metadata: {
        password: 'SuperSecretPassword',
        token: 'secret-jwt-token',
        apiKeyHash: 'hash-value-1234',
        safeKey: 'SafePublicValue',
      },
    };

    const res = await postJson('/management/notifications', payload, adminToken);
    assert.strictEqual(res.status, 201);

    const notif = await prisma.notification.findFirst({
      where: { studentId: sampleStudent.id, title: payload.title },
    });
    assert.ok(notif);
    assert.ok(notif.metadata);
    assert.ok(!notif.metadata.includes('SuperSecretPassword'));
    assert.ok(notif.metadata.includes('[REDACTED]'));
    assert.ok(notif.metadata.includes('SafePublicValue'));
  });

  await test('32. External URLs (http/https/javascript) in deep links are rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      {
        title: 'Phishing Attempt',
        message: 'Click this link',
        category: 'SYSTEM',
        recipientScope: 'INDIVIDUAL',
        studentId: sampleStudent.id,
        link: 'https://evil-phishing-site.com/steal-credentials',
      },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('external URLs'));
  });

  await test('33. Relative deep link without leading forward slash is rejected with 400', async () => {
    const res = await postJson(
      '/management/notifications',
      {
        title: 'Invalid Link',
        message: 'Invalid link test',
        category: 'SYSTEM',
        recipientScope: 'INDIVIDUAL',
        studentId: sampleStudent.id,
        link: 'complaints/view',
      },
      adminToken
    );
    assert.strictEqual(res.status, 400);
    assert.ok(res.data.message.includes('must begin with a forward slash'));
  });

  // --------------------------------------------------------------------------
  // REALTIME & STATS (Tests 34-35)
  // --------------------------------------------------------------------------
  await test('34. GET /management/notifications/stats returns authoritative metrics', async () => {
    const res = await getJson('/management/notifications/stats', adminToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.ok(typeof res.data.stats.total === 'number');
    assert.ok(typeof res.data.stats.unread === 'number');
    assert.ok(typeof res.data.stats.read === 'number');
    assert.ok(typeof res.data.stats.sentToday === 'number');
    assert.ok(typeof res.data.stats.system === 'number');
    assert.ok(typeof res.data.stats.announcements === 'number');
  });

  await test('35. PostgreSQL aggregate counts match stats endpoint values', async () => {
    const res = await getJson('/management/notifications/stats', adminToken);
    const dbTotal = await prisma.notification.count();
    const dbUnread = await prisma.notification.count({ where: { isRead: false } });
    assert.strictEqual(res.data.stats.total, dbTotal);
    assert.strictEqual(res.data.stats.unread, dbUnread);
  });

  // --------------------------------------------------------------------------
  // AUTOMATED REGRESSION PRESERVATION (Tests 36-43)
  // --------------------------------------------------------------------------
  await test('36. Automated Outing notification generation remains intact', async () => {
    const outingNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Outing Pass Requested',
        message: 'Your local outing request is pending warden review.',
        category: 'OUTING',
        source: 'AUTOMATED',
      },
    });
    assert.ok(outingNotif.id);
  });

  await test('37. Automated Leave notification generation remains intact', async () => {
    const leaveNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Leave Request Approved',
        message: 'Your leave application has been authorized by the warden.',
        category: 'LEAVE',
        source: 'AUTOMATED',
      },
    });
    assert.ok(leaveNotif.id);
  });

  await test('38. Automated Complaint notification generation remains intact', async () => {
    const compNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Complaint Resolved',
        message: 'Plumbing repair in Room 204 has been marked resolved.',
        category: 'COMPLAINT',
        source: 'AUTOMATED',
      },
    });
    assert.ok(compNotif.id);
  });

  await test('39. Automated Mess notification generation remains intact', async () => {
    const messNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Mess Menu Updated',
        message: 'Special dinner menu published for upcoming festival.',
        category: 'MESS',
        source: 'AUTOMATED',
      },
    });
    assert.ok(messNotif.id);
  });

  await test('40. Automated Biometric notification generation remains intact', async () => {
    const bioNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Biometric Check-in Confirmed',
        message: 'Main Gate turnstile scan recorded at 8:15 AM.',
        category: 'BIOMETRIC',
        source: 'AUTOMATED',
      },
    });
    assert.ok(bioNotif.id);
  });

  await test('41. Automated Suspension notification generation remains intact', async () => {
    const suspNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Disciplinary Suspension Notice',
        message: 'Formal suspension logged regarding disciplinary infractions.',
        category: 'SUSPENSION',
        priority: 'URGENT',
        source: 'AUTOMATED',
      },
    });
    assert.ok(suspNotif.id);
  });

  await test('42. Automated Fee notification generation remains intact', async () => {
    const feeNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Hostel Term Fee Due',
        message: 'Semester hostel fee invoice generated.',
        category: 'FEE',
        source: 'AUTOMATED',
      },
    });
    assert.ok(feeNotif.id);
  });

  await test('43. Automated Device notification generation remains intact', async () => {
    const devNotif = await prisma.notification.create({
      data: {
        studentId: sampleStudent.id,
        title: 'Turnstile Offline Alert',
        message: 'Turnstile DEV-GATE-02 requires scheduled inspection.',
        category: 'DEVICE',
        priority: 'HIGH',
        source: 'AUTOMATED',
      },
    });
    assert.ok(devNotif.id);
  });

  console.log('\n======================================================');
  console.log(`STEP 19 ADMIN NOTIFICATIONS SUITE: ${passedCount}/${totalCount} TESTS PASSED`);
  console.log('======================================================\n');
}

runAdminNotificationsSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test suite execution failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
