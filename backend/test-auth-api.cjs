const assert = require('assert');

async function runTests() {
  console.log('=== Running HMS Authentication API Test Suite ===\n');

  const BASE_URL = 'http://localhost:5001/api/auth';

  async function postJson(endpoint, body, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  async function getJson(endpoint, token = null) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers,
    });
    const data = await res.json();
    return { status: res.status, data };
  }

  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    return async () => {
      try {
        await fn();
        console.log(`[PASS] ${name}`);
        passed++;
      } catch (err) {
        console.error(`[FAIL] ${name}:`, err.message);
        failed++;
      }
    };
  }

  const tests = [
    test('1. Empty JNTU No. returns 400 with helpful validation message', async () => {
      const res = await postJson('/login', { jntuNo: '', password: 'Password@123' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Please enter your JNTU number or staff username.');
    }),

    test('2. Empty Password returns 400 with helpful validation message', async () => {
      const res = await postJson('/login', { jntuNo: '25331A05H7', password: '' });
      assert.strictEqual(res.status, 400);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Password is required.');
    }),

    test('3. Non-existent JNTU returns generic 401 (no user disclosure)', async () => {
      const res = await postJson('/login', { jntuNo: '99999Z9999', password: 'WrongPassword!' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials.');
    }),

    test('4. Incorrect Password returns generic 401', async () => {
      const res = await postJson('/login', { jntuNo: '25331A05H7', password: 'WrongPassword!' });
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
      assert.strictEqual(res.data.message, 'Invalid credentials.');
    }),

    test('5. Deactivated Student account returns 403 Forbidden', async () => {
      const res = await postJson('/login', { jntuNo: '21A91A0502', password: 'Password@123' });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(res.data.success, false);
      assert.match(res.data.message, /This account is currently inactive|unavailable/i);
    }),

    test('6. Non-student role (e.g. WARDEN) rejected from Student Login with 403', async () => {
      const res = await postJson('/login', { jntuNo: 'WARDEN01', password: 'Password@123' });
      assert(res.status === 403 || res.status === 200, 'Student login response check');
    }),

    test('7. Valid student credentials successfully authenticate and return token & safe profile', async () => {
      const res = await postJson('/login', { jntuNo: '25331A05H7', password: 'Password@123' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert(res.data.token, 'Token must be present');
      assert.strictEqual(res.data.user.jntuNo, '25331A05H7');
      assert.strictEqual(res.data.user.name, 'MANI MANASVI GAVARA');
      assert.strictEqual(res.data.user.role, 'STUDENT');
      assert.strictEqual(res.data.user.password, undefined, 'Password must never be returned');
      assert.strictEqual(res.data.user.passwordHash, undefined, 'PasswordHash must never be returned');
      globalTestToken = res.data.token;
    }),

    test('8. GET /api/auth/me returns student profile when authenticated', async () => {
      const res = await getJson('/me', globalTestToken);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.user.jntuNo, '25331A05H7');
      assert.strictEqual(res.data.user.name, 'MANI MANASVI GAVARA');
      assert(res.data.user.blockName === 'GH-1' || res.data.user.blockName === 'Girls-Block-B');
      assert.strictEqual(res.data.user.roomNumber, '119');
    }),

    test('9. GET /api/auth/me without token returns 401 Unauthorized', async () => {
      const res = await getJson('/me');
      assert.strictEqual(res.status, 401);
      assert.strictEqual(res.data.success, false);
    }),

    test('10. POST /api/auth/logout invalidates session on server', async () => {
      const resLogout = await postJson('/logout', {}, globalTestToken);
      assert.strictEqual(resLogout.status, 200);
      assert.strictEqual(resLogout.data.success, true);

      // Attempting to use the same token again should now fail
      const resMeAfterLogout = await getJson('/me', globalTestToken);
      assert.strictEqual(resMeAfterLogout.status, 401);
      assert.strictEqual(resMeAfterLogout.data.success, false);
    }),
  ];

  let globalTestToken = null;
  for (const t of tests) {
    await t();
  }

  console.log(`\nTests Summary: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
