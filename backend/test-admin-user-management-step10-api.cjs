'use strict';
/**
 * Admin Portal Step 10 — User Management
 * Dedicated Integration Test Suite
 *
 * Tests the complete administrative identity management module backed by PostgreSQL 18.6:
 * 1. Admin authentication
 * 2. Unauthenticated access
 * 3. Student forbidden access
 * 4. Unauthorized management role
 * 5. User listing
 * 6. PostgreSQL authoritative user data
 * 7. Search by name
 * 8. Search by JNTU/staff ID
 * 9. Search by email
 * 10. Role filtering
 * 11. Status filtering
 * 12. Block/hostel filtering where supported
 * 13. Academic filtering where supported
 * 14. Combined search + filters
 * 15. Pagination
 * 16. Deterministic ordering
 * 17. User detail
 * 18. Sensitive field exclusion
 * 19. Create user validation
 * 20. Successful user creation if supported
 * 21. Duplicate identity protection
 * 22. Edit user validation
 * 23. Successful edit if supported
 * 24. Account status transition if supported
 * 25. Role authorization
 * 26. Privilege escalation protection
 * 27. Password security if supported
 * 28. ActivityLog creation
 * 29. Notification behavior
 * 30. SSE behavior
 * 31. IDOR protection
 * 32. Concurrency protection
 * 33. Database integrity
 * 34. Test fixture cleanup
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';
const USERS_URL = `${BASE_URL}/management/users`;

let adminToken = '';
let adminUser = null;
let wardenToken = '';
let wardenUser = null;
let studentToken = '';
let studentUser = null;
let maintToken = '';

let testFixtureUserIds = [];
let createdUserId = '';
const testTag = Math.floor(1000 + Math.random() * 9000);
const testJntu = `25ST10${testTag}`;
const testEmail = `step10_${testTag}@college.edu`;

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`[PASS] ${label}`);
  passed++;
}

function fail(label, err) {
  console.error(`[FAIL] ${label}`);
  console.error('       ' + (err?.message || err));
  failed++;
}

async function test(name, fn) {
  try {
    await fn();
    ok(name);
  } catch (err) {
    fail(name, err);
  }
}

async function cleanupFixtures() {
  try {
    if (testFixtureUserIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { studentId: { in: testFixtureUserIds } },
      });
      await prisma.activityLog.deleteMany({
        where: {
          OR: [
            { entityId: { in: testFixtureUserIds } },
            { studentId: { in: testFixtureUserIds } },
          ],
        },
      });
      await prisma.session.deleteMany({
        where: { studentId: { in: testFixtureUserIds } },
      });
      await prisma.student.deleteMany({
        where: { id: { in: testFixtureUserIds } },
      });
    }
    // Also cleanup by JNTU tag prefix
    await prisma.notification.deleteMany({
      where: {
        OR: [
          { student: { jntuNo: { startsWith: 'STEP10_' } } },
          { student: { jntuNo: { startsWith: '25ST10' } } },
          { student: { jntuNo: { startsWith: '25CONC' } } },
          { student: { jntuNo: { startsWith: 'CONC_' } } },
        ],
      },
    });
    await prisma.activityLog.deleteMany({
      where: {
        OR: [
          { description: { contains: 'STEP10_' } },
          { description: { contains: '25ST10' } },
          { description: { contains: '25CONC' } },
          { description: { contains: 'CONC_' } },
        ],
      },
    });
    await prisma.student.deleteMany({
      where: {
        OR: [
          { jntuNo: { startsWith: 'STEP10_' } },
          { jntuNo: { startsWith: '25ST10' } },
          { jntuNo: { startsWith: '25CONC' } },
          { jntuNo: { startsWith: 'CONC_' } },
        ],
      },
    });
  } catch (err) {
    console.error('Cleanup warning:', err.message);
  }
}

async function runSuite() {
  console.log('================================================================');
  console.log('  STARTING ADMIN USER MANAGEMENT STEP 10 AUTOMATED TEST SUITE');
  console.log('================================================================\n');

  try {
    await cleanupFixtures();

    // -----------------------------------------------------------------
    // TEST 1: Admin Authentication
    // -----------------------------------------------------------------
    await test('1. Admin authentication — login succeeds with ADMIN01', async () => {
      const res = await fetch(`${BASE_URL}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.token, 'Token must be returned');
      assert.strictEqual(data.user.role, 'ADMIN');
      adminToken = data.token;
      adminUser = data.user;

      // Also authenticate helper users
      const wardenRes = await fetch(`${BASE_URL}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
      });
      const wardenData = await wardenRes.json();
      wardenToken = wardenData.token;
      wardenUser = wardenData.user;

      const studentRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
      });
      const studentData = await studentRes.json();
      studentToken = studentData.token;
      studentUser = studentData.student;

      const maintRes = await fetch(`${BASE_URL}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
      });
      const maintData = await maintRes.json();
      maintToken = maintData.token;
    });

    // -----------------------------------------------------------------
    // TEST 2: Unauthenticated Access
    // -----------------------------------------------------------------
    await test('2. Unauthenticated access — rejected with 401 Unauthorized', async () => {
      const res = await fetch(USERS_URL);
      assert.strictEqual(res.status, 401);
    });

    // -----------------------------------------------------------------
    // TEST 3: Student Forbidden Access
    // -----------------------------------------------------------------
    await test('3. Student forbidden access — rejected with 403 Forbidden', async () => {
      const res = await fetch(USERS_URL, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // -----------------------------------------------------------------
    // TEST 4: Unauthorized Management Role
    // -----------------------------------------------------------------
    await test('4. Unauthorized management role — support staff rejected with 403 Forbidden', async () => {
      const res = await fetch(USERS_URL, {
        headers: { Authorization: `Bearer ${maintToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // -----------------------------------------------------------------
    // TEST 5: User Listing
    // -----------------------------------------------------------------
    await test('5. User listing — GET /api/management/users returns paginated list', async () => {
      const res = await fetch(`${USERS_URL}?page=1&pageSize=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.users));
      assert.ok(data.users.length > 0);
      assert.ok(data.pagination);
      assert.strictEqual(data.pagination.page, 1);
      assert.ok(data.pagination.total >= data.users.length);
    });

    // -----------------------------------------------------------------
    // TEST 6: PostgreSQL Authoritative User Data
    // -----------------------------------------------------------------
    await test('6. PostgreSQL authoritative user data — database query matches API summary count', async () => {
      const res = await fetch(`${USERS_URL}/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);

      const dbTotal = await prisma.student.count();
      const dbActive = await prisma.student.count({ where: { isActive: true } });
      const dbDisabled = await prisma.student.count({ where: { isActive: false } });

      assert.strictEqual(data.summary.totalUsers, dbTotal, 'Total users must match PostgreSQL');
      assert.strictEqual(data.summary.activeUsers, dbActive, 'Active users must match PostgreSQL');
      assert.strictEqual(data.summary.disabledUsers, dbDisabled, 'Disabled users must match PostgreSQL');
    });

    // -----------------------------------------------------------------
    // TEST 7: Search by Name
    // -----------------------------------------------------------------
    await test('7. Search by name — case-insensitive substring search against PostgreSQL', async () => {
      const sample = await prisma.student.findFirst({ where: { isActive: true } });
      assert.ok(sample, 'A sample user must exist');
      const searchWord = sample.name.substring(0, 4);

      const res = await fetch(`${USERS_URL}?search=${encodeURIComponent(searchWord)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.users.length > 0);
      assert.ok(
        data.users.some(
          (u) =>
            u.name.toLowerCase().includes(searchWord.toLowerCase()) ||
            u.jntuNo.toLowerCase().includes(searchWord.toLowerCase())
        )
      );
    });

    // -----------------------------------------------------------------
    // TEST 8: Search by JNTU / Staff ID
    // -----------------------------------------------------------------
    await test('8. Search by JNTU/staff ID — finds exact identifier', async () => {
      const res = await fetch(`${USERS_URL}?search=ADMIN01`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.users.some((u) => u.jntuNo === 'ADMIN01'));
    });

    // -----------------------------------------------------------------
    // TEST 9: Search by Email
    // -----------------------------------------------------------------
    await test('9. Search by email — finds user by email substring', async () => {
      const sample = await prisma.student.findFirst({ where: { isActive: true } });
      const emailDomain = sample.email.split('@')[1];

      const res = await fetch(`${USERS_URL}?search=${encodeURIComponent(emailDomain)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.users.length > 0);
      assert.ok(data.users.every((u) => u.email.includes(emailDomain)));
    });

    // -----------------------------------------------------------------
    // TEST 10: Role Filtering
    // -----------------------------------------------------------------
    await test('10. Role filtering — isolates accounts by role', async () => {
      const res = await fetch(`${USERS_URL}?role=STUDENT`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.users.length > 0);
      assert.ok(data.users.every((u) => u.role === 'STUDENT'));
    });

    // -----------------------------------------------------------------
    // TEST 11: Status Filtering
    // -----------------------------------------------------------------
    await test('11. Status filtering — ACTIVE returns only active accounts', async () => {
      const res = await fetch(`${USERS_URL}?status=ACTIVE`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.users.every((u) => u.isActive === true));
    });

    // -----------------------------------------------------------------
    // TEST 12: Block/Hostel Filtering Where Supported
    // -----------------------------------------------------------------
    await test('12. Block/hostel filtering — server-side query filters by block name', async () => {
      const userWithBlock = await prisma.student.findFirst({
        where: { blockName: { not: null } },
      });

      if (userWithBlock && userWithBlock.blockName) {
        const res = await fetch(`${USERS_URL}?block=${encodeURIComponent(userWithBlock.blockName)}`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
        const data = await res.json();
        assert.ok(data.users.length > 0);
        assert.ok(
          data.users.every((u) =>
            u.blockName.toLowerCase().includes(userWithBlock.blockName.toLowerCase())
          )
        );
      } else {
        // Fallback test
        const res = await fetch(`${USERS_URL}?block=Block-A`, {
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        assert.strictEqual(res.status, 200);
      }
    });

    // -----------------------------------------------------------------
    // TEST 13: Academic Filtering Where Supported
    // -----------------------------------------------------------------
    await test('13. Academic filtering — server-side query filters by academic identifier', async () => {
      const res = await fetch(`${USERS_URL}?academicYear=25`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      if (data.users.length > 0) {
        assert.ok(data.users.every((u) => u.jntuNo.includes('25')));
      }
    });

    // -----------------------------------------------------------------
    // TEST 14: Combined Search + Filters
    // -----------------------------------------------------------------
    await test('14. Combined search + filters — role + status + search target isolated', async () => {
      const res = await fetch(`${USERS_URL}?role=ADMIN&status=ACTIVE&search=ADMIN01`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.users.length, 1);
      assert.strictEqual(data.users[0].jntuNo, 'ADMIN01');
      assert.strictEqual(data.users[0].role, 'ADMIN');
      assert.strictEqual(data.users[0].isActive, true);
    });

    // -----------------------------------------------------------------
    // TEST 15: Pagination
    // -----------------------------------------------------------------
    await test('15. Pagination — total, page, pageSize, totalPages accurately returned', async () => {
      const res = await fetch(`${USERS_URL}?page=1&pageSize=3`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.pageSize, 3);
      assert.ok(data.pagination.totalPages >= 1);
      assert.strictEqual(data.users.length, Math.min(3, data.pagination.total));
    });

    // -----------------------------------------------------------------
    // TEST 16: Deterministic Ordering
    // -----------------------------------------------------------------
    await test('16. Deterministic ordering — users sorted descending by createdAt', async () => {
      const res = await fetch(`${USERS_URL}?pageSize=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      for (let i = 0; i < data.users.length - 1; i++) {
        const t1 = new Date(data.users[i].createdAt).getTime();
        const t2 = new Date(data.users[i + 1].createdAt).getTime();
        assert.ok(t1 >= t2, `User at index ${i} must be newer than or equal to index ${i + 1}`);
      }
    });

    // -----------------------------------------------------------------
    // TEST 17: User Detail
    // -----------------------------------------------------------------
    await test('17. User detail — GET /api/management/users/:id returns complete details', async () => {
      const res = await fetch(`${USERS_URL}/${adminUser.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.id, adminUser.id);
      assert.strictEqual(data.user.jntuNo, 'ADMIN01');
      assert.strictEqual(data.user.role, 'ADMIN');
      assert.ok(data.user._count, 'User detail should include counts of related records');
    });

    // -----------------------------------------------------------------
    // TEST 18: Sensitive Field Exclusion
    // -----------------------------------------------------------------
    await test('18. Sensitive field exclusion — password and passwordHash never exposed', async () => {
      const listRes = await fetch(`${USERS_URL}?pageSize=5`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const listData = await listRes.json();
      for (const u of listData.users) {
        assert.strictEqual(u.password, undefined);
        assert.strictEqual(u.passwordHash, undefined);
      }

      const detailRes = await fetch(`${USERS_URL}/${adminUser.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const detailData = await detailRes.json();
      assert.strictEqual(detailData.user.password, undefined);
      assert.strictEqual(detailData.user.passwordHash, undefined);
    });

    // -----------------------------------------------------------------
    // TEST 19: Create User Validation
    // -----------------------------------------------------------------
    await test('19. Create user validation — rejects missing required fields and short passwords', async () => {
      // Missing JNTU
      const res1 = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ name: 'Test', email: 'test@college.edu', role: 'STUDENT', password: 'Password@123' }),
      });
      assert.strictEqual(res1.status, 400);

      // Short password
      const res2 = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          jntuNo: 'SHORT_PW_10',
          name: 'Short PW',
          email: 'short@college.edu',
          role: 'STUDENT',
          password: '123',
        }),
      });
      assert.strictEqual(res2.status, 400);

      // Invalid role
      const res3 = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          jntuNo: 'INV_ROLE_10',
          name: 'Invalid Role',
          email: 'inv@college.edu',
          role: 'SUPER_HACKER',
          password: 'Password@123',
        }),
      });
      assert.strictEqual(res3.status, 400);
    });

    // -----------------------------------------------------------------
    // TEST 20: Successful User Creation
    // -----------------------------------------------------------------
    await test('20. Successful user creation — creates operational account in PostgreSQL', async () => {
      const res = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          jntuNo: testJntu,
          name: 'Step Ten Test Student',
          email: testEmail,
          role: 'STUDENT',
          password: 'Password@123',
          blockName: 'Girls-Block-B',
          roomNumber: '305',
          bedNumber: 'Bed-2',
        }),
      });
      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.user.jntuNo, testJntu);
      assert.strictEqual(data.user.passwordHash, undefined);
      createdUserId = data.user.id;
      testFixtureUserIds.push(createdUserId);

      // Verify in DB directly
      const dbUser = await prisma.student.findUnique({ where: { id: createdUserId } });
      assert.ok(dbUser);
      assert.strictEqual(dbUser.jntuNo, testJntu);
      assert.ok(await bcrypt.compare('Password@123', dbUser.passwordHash));
    });

    // -----------------------------------------------------------------
    // TEST 21: Duplicate Identity Protection
    // -----------------------------------------------------------------
    await test('21. Duplicate identity protection — duplicate JNTU and email rejected with 409', async () => {
      // Duplicate JNTU
      const res1 = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          jntuNo: testJntu,
          name: 'Duplicate JNTU',
          email: 'different@college.edu',
          role: 'STUDENT',
          password: 'Password@123',
        }),
      });
      assert.strictEqual(res1.status, 409);

      // Duplicate Email
      const res2 = await fetch(USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          jntuNo: `${testJntu}D`,
          name: 'Duplicate Email',
          email: testEmail,
          role: 'STUDENT',
          password: 'Password@123',
        }),
      });
      assert.strictEqual(res2.status, 409);
    });

    // -----------------------------------------------------------------
    // TEST 22: Edit User Validation
    // -----------------------------------------------------------------
    await test('22. Edit user validation — empty payload rejected with 400', async () => {
      const res = await fetch(`${USERS_URL}/${createdUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({}),
      });
      assert.strictEqual(res.status, 400);
    });

    // -----------------------------------------------------------------
    // TEST 23: Successful Edit
    // -----------------------------------------------------------------
    await test('23. Successful edit — updates profile fields in PostgreSQL', async () => {
      const res = await fetch(`${USERS_URL}/${createdUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Step Ten Student Renamed',
          roomNumber: '308',
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.user.name, 'Step Ten Student Renamed');
      assert.strictEqual(data.user.roomNumber, '308');

      // Verify in DB
      const dbUser = await prisma.student.findUnique({ where: { id: createdUserId } });
      assert.strictEqual(dbUser.name, 'Step Ten Student Renamed');
      assert.strictEqual(dbUser.roomNumber, '308');
    });

    // -----------------------------------------------------------------
    // TEST 24: Account Status Transition
    // -----------------------------------------------------------------
    await test('24. Account status transition — disable invalidates auth, enable restores auth', async () => {
      // Disable
      const disRes = await fetch(`${USERS_URL}/${createdUserId}/disable`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ reason: 'Step 10 status test' }),
      });
      assert.strictEqual(disRes.status, 200);
      const disData = await disRes.json();
      assert.strictEqual(disData.user.isActive, false);

      // Login attempt should be blocked
      const blockedLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: testJntu, password: 'Password@123' }),
      });
      assert.strictEqual(blockedLogin.status, 403);

      // Enable
      const enRes = await fetch(`${USERS_URL}/${createdUserId}/enable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(enRes.status, 200);
      const enData = await enRes.json();
      assert.strictEqual(enData.user.isActive, true);

      // Login attempt should now succeed
      const restoredLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: testJntu, password: 'Password@123' }),
      });
      assert.strictEqual(restoredLogin.status, 200);
    });

    // -----------------------------------------------------------------
    // TEST 25: Role Authorization
    // -----------------------------------------------------------------
    await test('25. Role authorization — warden cannot change user role to ADMIN', async () => {
      const res = await fetch(`${USERS_URL}/${createdUserId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${wardenToken}`,
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      assert.strictEqual(res.status, 403);
    });

    // -----------------------------------------------------------------
    // TEST 26: Privilege Escalation Protection
    // -----------------------------------------------------------------
    await test('26. Privilege escalation protection — self role change rejected for all users', async () => {
      // Admin cannot change own role
      const res1 = await fetch(`${USERS_URL}/${adminUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ role: 'STUDENT' }),
      });
      assert.strictEqual(res1.status, 400);

      // Warden cannot elevate self
      const res2 = await fetch(`${USERS_URL}/${wardenUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${wardenToken}`,
        },
        body: JSON.stringify({ role: 'ADMIN' }),
      });
      assert.ok(res2.status === 400 || res2.status === 403);
    });

    // -----------------------------------------------------------------
    // TEST 27: Password Security
    // -----------------------------------------------------------------
    await test('27. Password security — reset hashes password with bcrypt and never leaks hash', async () => {
      const res = await fetch(`${USERS_URL}/${createdUserId}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ newPassword: 'BrandNewPassword@456' }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.password, undefined);
      assert.strictEqual(data.passwordHash, undefined);

      // Verify login with new password
      const newLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: testJntu, password: 'BrandNewPassword@456' }),
      });
      assert.strictEqual(newLogin.status, 200);

      // Verify old password fails
      const oldLogin = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: testJntu, password: 'Password@123' }),
      });
      assert.strictEqual(oldLogin.status, 401);
    });

    // -----------------------------------------------------------------
    // TEST 28: ActivityLog Creation
    // -----------------------------------------------------------------
    await test('28. ActivityLog creation — administrative mutations produce audit logs', async () => {
      const logs = await prisma.activityLog.findMany({
        where: {
          entity: 'User',
          entityId: createdUserId,
        },
        orderBy: { createdAt: 'asc' },
      });
      assert.ok(logs.length >= 3, 'Must have at least USER_CREATED, USER_UPDATED, and PASSWORD_RESET');
      const actions = logs.map((l) => l.action);
      assert.ok(actions.includes('USER_CREATED'));
      assert.ok(actions.includes('PASSWORD_RESET'));

      // Check that no passwords or hashes leak into description or metadata
      for (const l of logs) {
        assert.ok(!l.description.toLowerCase().includes('brandnewpassword'));
        if (l.metadata) {
          assert.ok(!l.metadata.toLowerCase().includes('brandnewpassword'));
        }
      }
    });

    // -----------------------------------------------------------------
    // TEST 29: Notification Behavior
    // -----------------------------------------------------------------
    await test('29. Notification behavior — mutations create notifications in PostgreSQL', async () => {
      const notifications = await prisma.notification.findMany({
        where: { studentId: createdUserId },
        orderBy: { createdAt: 'desc' },
      });
      assert.ok(notifications.length >= 2, 'Notifications should be recorded for user events');
      assert.ok(notifications.some((n) => n.title.includes('Welcome') || n.title.includes('Account')));
    });

    // -----------------------------------------------------------------
    // TEST 30: SSE Behavior
    // -----------------------------------------------------------------
    await test('30. SSE behavior — management event stream connects and returns 200 text/event-stream', async () => {
      const sseRes = await fetch(`${BASE_URL}/management/events-stream?token=${encodeURIComponent(adminToken)}`, {
        headers: { Accept: 'text/event-stream' },
      });
      assert.strictEqual(sseRes.status, 200);
      assert.ok((sseRes.headers.get('content-type') || '').includes('text/event-stream'));
    });

    // -----------------------------------------------------------------
    // TEST 31: IDOR Protection
    // -----------------------------------------------------------------
    await test('31. IDOR protection — student cannot read or mutate other users', async () => {
      // Read
      const readRes = await fetch(`${USERS_URL}/${adminUser.id}`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(readRes.status, 403);

      // Mutate
      const mutRes = await fetch(`${USERS_URL}/${adminUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${studentToken}`,
        },
        body: JSON.stringify({ name: 'Hacked' }),
      });
      assert.strictEqual(mutRes.status, 403);
    });

    // -----------------------------------------------------------------
    // TEST 32: Concurrency Protection
    // -----------------------------------------------------------------
    await test('32. Concurrency protection — simultaneous creations with same identifier reject cleanly', async () => {
      const concJntu = `25CONC${Math.floor(1000 + Math.random() * 9000)}`;
      const payload = {
        jntuNo: concJntu,
        name: 'Concurrency Test',
        email: `conc_${Date.now()}@college.edu`,
        role: 'STUDENT',
        password: 'Password@123',
      };

      const [r1, r2] = await Promise.all([
        fetch(USERS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(payload),
        }),
        fetch(USERS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
          body: JSON.stringify(payload),
        }),
      ]);

      const statuses = [r1.status, r2.status];
      assert.ok(statuses.includes(201), 'One request should succeed with 201');
      assert.ok(statuses.includes(409), 'One request should fail with 409 Conflict');

      // Cleanup concurrency record
      const createdConc = await prisma.student.findUnique({ where: { jntuNo: concJntu } });
      if (createdConc) {
        testFixtureUserIds.push(createdConc.id);
      }
    });

    // -----------------------------------------------------------------
    // TEST 33: Database Integrity
    // -----------------------------------------------------------------
    await test('33. Database integrity — verify 0 invalid roles, 0 plaintext passwords in PostgreSQL', async () => {
      const validRoles = [
        'ADMIN',
        'SUPPORT_ADMIN',
        'HOSTEL_ADMIN',
        'CHIEF_WARDEN',
        'CHIEF_WARDEN_BOYS',
        'CHIEF_WARDEN_GIRLS',
        'WARDEN',
        'WARDEN_BOYS',
        'WARDEN_GIRLS',
        'STUDENT',
        'MAINTENANCE_STAFF',
        'MESS_STAFF',
        'OFFICE_STAFF',
        'FINANCE_OFFICER',
        'COLLEGE_DIRECTOR',
      ];

      const allUsers = await prisma.student.findMany({
        select: { id: true, role: true, passwordHash: true },
      });

      const invalidRoles = allUsers.filter((u) => !validRoles.includes(u.role));
      assert.strictEqual(invalidRoles.length, 0, 'No invalid roles should exist');

      const nonBcrypt = allUsers.filter(
        (u) => !u.passwordHash.startsWith('$2a$') && !u.passwordHash.startsWith('$2b$')
      );
      assert.strictEqual(nonBcrypt.length, 0, 'All stored passwords must be bcrypt hashes');
    });

    // -----------------------------------------------------------------
    // TEST 34: Test Fixture Cleanup
    // -----------------------------------------------------------------
    await test('34. Test fixture cleanup — remove all ephemeral test records', async () => {
      await cleanupFixtures();
      const checkClean = await prisma.student.count({
        where: {
          OR: [
            { jntuNo: { startsWith: 'STEP10_' } },
            { jntuNo: { startsWith: '25ST10' } },
            { jntuNo: { startsWith: '25CONC' } },
          ],
        },
      });
      assert.strictEqual(checkClean, 0, 'All Step 10 test fixtures must be cleaned up');
    });

    console.log('\n================================================================');
    console.log(`  STEP 10 TEST RESULTS: ${passed} PASSED / ${failed} FAILED (TOTAL: 34)`);
    console.log('================================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error running suite:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runSuite();
