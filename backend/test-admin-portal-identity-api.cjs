// Authoritative Admin Portal Identity & RBAC Test Suite (Step 20 Baseline)
const assert = require('assert');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001/api';

async function postJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function getJson(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, headers: res.headers, data };
}

async function runTests() {
  console.log('=== Running Admin Portal Identity & Role Architecture Tests ===\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${total}. ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  let adminToken = '';
  let wardenToken = '';
  let studentToken = '';

  // 1. Admin credentials resolve to ADMIN
  await test('1. Admin credentials (ADMIN01) authenticate and resolve strictly to ADMIN role', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200, 'Admin login must succeed with 200');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'ADMIN', 'Role must be ADMIN');
    assert.strictEqual(res.data.user.jntuNo, 'ADMIN01');
    assert.strictEqual(res.data.user.name, 'System Administrator');
    assert.ok(res.data.token, 'Must return JWT session token');
    adminToken = res.data.token;
  });

  // 2. Admin receives Admin portal authorization
  await test('2. Admin receives authoritative Admin portal authorization (200 on /api/management/dashboard)', async () => {
    const res = await getJson('/management/dashboard', adminToken);
    assert.strictEqual(res.status, 200, 'Admin must have access to management dashboard');
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.residents, 'Dashboard must contain resident metrics');
    assert.ok(res.data.data.rooms, 'Dashboard must contain room metrics');
  });

  // 3. Admin profile returns ADMIN
  await test('3. Admin profile endpoint (/api/management/auth/me) returns role ADMIN and authoritative user details', async () => {
    const res = await getJson('/management/auth/me', adminToken);
    assert.strictEqual(res.status, 200, 'Profile check must succeed');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'ADMIN');
    assert.strictEqual(res.data.user.jntuNo, 'ADMIN01');
    assert.strictEqual(res.data.user.name, 'System Administrator');
  });

  // 4. Warden credentials resolve to WARDEN
  await test('4. Warden credentials (WARDEN01) authenticate and resolve strictly to WARDEN role', async () => {
    const res = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'Password@123',
    });
    assert.strictEqual(res.status, 200, 'Warden login must succeed with 200');
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role, 'WARDEN', 'Role must be WARDEN');
    assert.strictEqual(res.data.user.jntuNo, 'WARDEN01');
    assert.ok(res.data.user.name.includes('Warden'), 'Warden name must include Warden');
    assert.ok(res.data.token, 'Must return JWT session token');
    wardenToken = res.data.token;
  });

  // 5. Warden is not converted to ADMIN
  await test('5. Warden is preserved as separate role and not converted to ADMIN', async () => {
    assert.notStrictEqual(wardenToken, adminToken);
    const res = await getJson('/management/auth/me', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.user.role, 'WARDEN', 'Warden profile role must remain WARDEN');
    assert.notStrictEqual(res.data.user.role, 'ADMIN', 'Warden role must never be ADMIN');
  });

  // 6. Student remains STUDENT
  await test('6. Student credentials (25331A05H7) resolve to STUDENT and are prohibited from Admin portal login (403)', async () => {
    // Check student login in auth route
    const studentAuthRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(studentAuthRes.status, 200);
    assert.strictEqual(studentAuthRes.data.user.role, 'STUDENT');
    studentToken = studentAuthRes.data.token;

    // Check student attempting management/admin login
    const mgmtLoginRes = await postJson('/management/auth/login', {
      username: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(mgmtLoginRes.status, 403, 'Student account must be denied with 403');
    assert.strictEqual(mgmtLoginRes.data.success, false);
    assert.match(mgmtLoginRes.data.message, /student accounts cannot access/i);
  });

  // 7. No role-selection mechanism exists
  await test('7. No role-selection mechanism exists: backend determines role authoritatively from credentials', async () => {
    // Passing a spoofed role parameter in the body has no effect; backend is authoritative
    const spoofRes = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'Password@123',
      role: 'ADMIN', // Attacker attempt to claim ADMIN role
    });
    assert.strictEqual(spoofRes.status, 200);
    assert.strictEqual(spoofRes.data.user.role, 'WARDEN', 'Backend must ignore client-sent role and resolve authoritatively to WARDEN');

    // Admin login with spoofed role also resolves strictly from database
    const adminSpoofRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
      role: 'STUDENT',
    });
    assert.strictEqual(adminSpoofRes.status, 200);
    assert.strictEqual(adminSpoofRes.data.user.role, 'ADMIN', 'Backend must resolve ADMIN authoritatively');
  });

  // 8. Student cannot access Admin APIs
  await test('8. Student cannot access Admin APIs: /api/management/dashboard rejects student session with 403', async () => {
    const res = await getJson('/management/dashboard', studentToken);
    assert.strictEqual(res.status, 403, 'Student JWT token must be rejected with 403');
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Account lacks management administrative privileges/i);
  });

  // 9. Warden cannot accidentally gain Admin identity
  await test('9. Warden cannot accidentally gain Admin identity in session, tokens, or profile verification', async () => {
    const wardenProfile = await getJson('/management/auth/me', wardenToken);
    assert.strictEqual(wardenProfile.data.user.role, 'WARDEN');
    assert.notStrictEqual(wardenProfile.data.user.role, 'ADMIN');

    // Verify in PostgreSQL that WARDEN01 role is intact
    const dbWarden = await prisma.student.findUnique({
      where: { jntuNo: 'WARDEN01' },
      select: { role: true, name: true },
    });
    assert.strictEqual(dbWarden.role, 'WARDEN', 'Database record for WARDEN01 must be WARDEN');
  });

  // 10. Role information is sourced from authoritative backend state
  await test('10. Role information is sourced strictly from authoritative PostgreSQL database state', async () => {
    const dbAdmin = await prisma.student.findUnique({
      where: { jntuNo: 'ADMIN01' },
      select: { role: true, name: true, isActive: true },
    });
    assert.ok(dbAdmin, 'ADMIN01 must exist in PostgreSQL');
    assert.strictEqual(dbAdmin.role, 'ADMIN', 'Database record for ADMIN01 must be ADMIN');
    assert.strictEqual(dbAdmin.isActive, true, 'ADMIN01 must be active');

    const dbStudent = await prisma.student.findUnique({
      where: { jntuNo: '25331A05H7' },
      select: { role: true, name: true },
    });
    assert.strictEqual(dbStudent.role, 'STUDENT', 'Database record for 25331A05H7 must be STUDENT');
  });

  console.log(`\nAll ${passed}/${total} Admin Portal Identity & Role Architecture tests passed!\n`);
}

runTests()
  .catch((err) => {
    console.error('Fatal error in tests:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
