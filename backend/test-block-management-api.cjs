const assert = require('assert');
const http = require('http');
const { PrismaClient } = require('@prisma/client');

const API_BASE = 'http://localhost:5001/api';
const prisma = new PrismaClient();

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

async function putJson(endpoint, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'PUT',
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

async function deleteJson(endpoint, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('=== Running Step 11 Block Management API & Security Tests ===\n');

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

  // 1. Unauthenticated access rejected
  await test('1. Unauthenticated access to /api/management/blocks rejected with 401', async () => {
    const res = await getJson('/management/blocks');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Authentication required/i);
  });

  // 2. Student access rejected
  let studentToken = '';
  await test('2. Student access to /api/management/blocks rejected with 403 Forbidden', async () => {
    const loginRes = await postJson('/auth/login', {
      jntuNo: '25331A05H7',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    studentToken = loginRes.data.token;

    const res = await getJson('/management/blocks', studentToken);
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /Access denied/i);
  });

  // 3. Unauthorized management role rejected (simulated with deactivated/tampered session)
  await test('3. Invalid or inactive token rejected with 401/403', async () => {
    const res = await getJson('/management/blocks', 'invalid-token-12345');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.data.success, false);
  });

  // 4. Authorized management access succeeds
  let wardenToken = '';
  await test('4. Authorized warden authenticates and retrieves blocks with 200', async () => {
    const loginRes = await postJson('/management/auth/login', {
      username: 'WARDEN01',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    assert(loginRes.data.token);
    wardenToken = loginRes.data.token;

    const res = await getJson('/management/blocks', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(Array.isArray(res.data.blocks));
    assert(res.data.count >= 1);
  });

  // 5. Create block
  let createdBlockId = '';
  const testBlockCode = `TEST-BLK-${Date.now().toString(36).toUpperCase()}`;
  await test('5. Authorized warden creates new block with 201 Created and audit log', async () => {
    const res = await postJson(
      '/management/blocks',
      {
        name: 'South Research Wing',
        code: testBlockCode,
        description: 'Postgraduate research scholar wing',
        status: 'ACTIVE',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert(res.data.block && res.data.block.id);
    assert.strictEqual(res.data.block.code, testBlockCode);
    assert.strictEqual(res.data.block.name, 'South Research Wing');
    assert.strictEqual(res.data.block.status, 'ACTIVE');
    createdBlockId = res.data.block.id;
  });

  // 6. Duplicate code rejected
  await test('6. Duplicate block code creation rejected with 409 Conflict', async () => {
    const res = await postJson(
      '/management/blocks',
      {
        name: 'Duplicate Wing Attempt',
        code: testBlockCode, // same code
        description: 'Should fail with duplicate conflict',
        status: 'ACTIVE',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.data.success, false);
    assert.match(res.data.message, /already exists/i);
  });

  // 7. Retrieve blocks
  await test('7. GET /api/management/blocks returns array with allocation counts', async () => {
    const res = await getJson('/management/blocks', wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const found = res.data.blocks.find((b) => b.id === createdBlockId);
    assert(found, 'Created block must be in list');
    assert(typeof found.activeResidents === 'number');
    assert(typeof found.totalRooms === 'number');
  });

  // 8. Retrieve individual block
  await test('8. GET /api/management/blocks/:id returns specific block details', async () => {
    const res = await getJson(`/management/blocks/${createdBlockId}`, wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.block.id, createdBlockId);
    assert.strictEqual(res.data.block.code, testBlockCode);
    assert(typeof res.data.block.activeResidents === 'number');
  });

  // 9. Update block
  await test('9. PUT /api/management/blocks/:id updates fields and status', async () => {
    const res = await putJson(
      `/management/blocks/${createdBlockId}`,
      {
        name: 'South Research Wing - Renovated',
        description: 'Updated facility description with AC rooms',
        status: 'INACTIVE',
      },
      wardenToken
    );

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.block.name, 'South Research Wing - Renovated');
    assert.strictEqual(res.data.block.status, 'INACTIVE');
  });

  // 10. Invalid data rejected
  await test('10. Invalid block payload (short name, invalid status) rejected with 400', async () => {
    const res1 = await postJson(
      '/management/blocks',
      { name: 'A', code: 'VALID-CODE' },
      wardenToken
    );
    assert.strictEqual(res1.status, 400);

    const res2 = await postJson(
      '/management/blocks',
      { name: 'Valid Block', code: 'VB-01', status: 'UNKNOWN_STATUS' },
      wardenToken
    );
    assert.strictEqual(res2.status, 400);
  });

  // 11. Delete block (clean, without dependencies)
  await test('11. DELETE /api/management/blocks/:id deletes unallocated block with 200', async () => {
    const res = await deleteJson(`/management/blocks/${createdBlockId}`, wardenToken);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.deletedId, createdBlockId);

    // Verify block no longer exists
    const getRes = await getJson(`/management/blocks/${createdBlockId}`, wardenToken);
    assert.strictEqual(getRes.status, 404);
  });

  // 12. Dependent block deletion safely rejected
  await test('12. Deleting block with active resident allocations rejected with 409 Conflict', async () => {
    // Find GH-1 / Girls-Block-B (allocated to MANI MANASVI GAVARA and NAKKULLA RITHIKA)
    const gb = await prisma.block.findFirst({
      where: {
        OR: [
          { code: 'GH-1' },
          { name: 'Girls-Block-B' },
          { name: 'GH-1' },
        ],
      },
    });
    assert(gb, 'Hostel block GH-1 / Girls-Block-B must exist in PostgreSQL');

    const delRes = await deleteJson(`/management/blocks/${gb.id}`, wardenToken);
    assert.strictEqual(delRes.status, 409, 'Dependent block deletion must return 409 Conflict');
    assert.strictEqual(delRes.data.success, false);
    assert.match(delRes.data.message, /student record/i);
    assert(delRes.data.dependentCount >= 1);
  });

  // 13. Audit entry created in ActivityLog
  await test('13. Audit logging persists BLOCK_MANAGEMENT records in PostgreSQL', async () => {
    const logs = await prisma.activityLog.findMany({
      where: { actionType: 'BLOCK_MANAGEMENT' },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    assert(logs.length >= 2, 'ActivityLog must contain block creation/update/deletion records');
    assert.match(logs[0].description, /block/i);
  });

  // 14. Realtime event emitted via SSE
  await test('14. Management SSE stream receives block mutation domain events', async () => {
    const ssePromise = new Promise((resolve, reject) => {
      const req = http.request(
        `${API_BASE}/management/events-stream?token=${encodeURIComponent(wardenToken)}`,
        (res) => {
          let buffer = '';
          res.on('data', (chunk) => {
            buffer += chunk.toString();
            if (buffer.includes('BLOCK_CREATED') || buffer.includes('management_dashboard_event')) {
              req.destroy();
              resolve(buffer);
            }
          });
        }
      );
      req.on('error', reject);
      req.end();

      // Trigger block creation after connection established
      setTimeout(() => {
        postJson(
          '/management/blocks',
          {
            name: 'SSE Verification Block',
            code: `SSE-${Date.now().toString(36).toUpperCase()}`,
            description: 'Temporary block for SSE validation',
            status: 'ACTIVE',
          },
          wardenToken
        ).catch(reject);
      }, 300);

      setTimeout(() => reject(new Error('SSE connection timeout for Block events')), 4000);
    });

    const ssePayload = await ssePromise;
    assert(ssePayload.includes('BLOCK_CREATED'), 'SSE payload must include BLOCK_CREATED');
  });

  // 15. Data persists across database queries
  await test('15. Created block records persist authoritatively in PostgreSQL', async () => {
    const count = await prisma.block.count();
    assert(count >= 3, 'At least 3 blocks persist in PostgreSQL');

    // Clean up temporary SSE test block
    await prisma.block.deleteMany({
      where: { name: 'SSE Verification Block' },
    });
  });

  // 16. Authoritative statistics calculation from PostgreSQL Room and Allocation models
  await test('16. Authoritative statistics (totalCapacity, occupied, vacant, maintenance, vacancyRate) calculated from DB', async () => {
    const res = await getJson('/management/blocks', wardenToken);
    assert.strictEqual(res.status, 200);
    assert(Array.isArray(res.data.blocks));

    for (const b of res.data.blocks) {
      assert(typeof b.totalCapacity === 'number', 'totalCapacity must be a number');
      assert(typeof b.occupied === 'number', 'occupied must be a number');
      assert(typeof b.vacant === 'number', 'vacant must be a number');
      assert(typeof b.maintenance === 'number', 'maintenance must be a number');
      assert(typeof b.vacancyRate === 'string', 'vacancyRate must be a string formatted with %');
      assert(b.vacancyRate.endsWith('%'), 'vacancyRate must end with %');

      // Verify formula: vacant = total capacity - occupied - maintenance (bounded >= 0)
      const expectedVacant = Math.max(0, b.totalCapacity - b.occupied - b.maintenance);
      assert.strictEqual(b.vacant, expectedVacant, `Vacant calculation mismatch for block ${b.name}`);
    }
  });

  // 17. Admin account RBAC authentication and management
  let adminToken = '';
  await test('17. Admin account (ADMIN01) authenticates and has full Block Management authorization', async () => {
    const loginRes = await postJson('/management/auth/login', {
      username: 'ADMIN01',
      password: 'Password@123',
    });
    assert.strictEqual(loginRes.status, 200);
    assert(loginRes.data.token);
    adminToken = loginRes.data.token;

    const res = await getJson('/management/blocks', adminToken);
    assert.strictEqual(res.status, 200);
    assert(res.data.blocks.length >= 1);
  });

  // 18. Room dependency protection blocks deletion even if student count is 0
  await test('18. Deleting block with configured rooms is rejected with 409 Conflict', async () => {
    // Find block with configured rooms (e.g. BH-1 or GH-1)
    const bbA = await prisma.block.findFirst({
      where: { rooms: { some: {} } },
      include: { rooms: true },
    });
    assert(bbA, 'Hostel block with configured rooms must exist in PostgreSQL');
    assert(bbA.rooms.length > 0, 'Boys-Block-A must have at least 1 room configured');

    const delRes = await deleteJson(`/management/blocks/${bbA.id}`, adminToken);
    assert.strictEqual(delRes.status, 409, 'Must return 409 Conflict when rooms exist');
    assert.strictEqual(delRes.data.success, false);
    assert.match(delRes.data.message, /room/i);
    assert(delRes.data.dependentRoomCount >= 1);
  });

  // 19. Attempted deletion audit logging
  await test('19. Blocked deletion attempts are recorded in ActivityLog', async () => {
    const attemptedLog = await prisma.activityLog.findFirst({
      where: {
        actionType: 'BLOCK_MANAGEMENT',
        description: { contains: 'Blocked deletion' },
      },
      orderBy: { createdAt: 'desc' },
    });
    assert(attemptedLog, 'ActivityLog must record blocked deletion attempt');
  });

  // 20. Admin transactional creation, update, and clean deletion lifecycle
  await test('20. Complete Admin lifecycle: create block, verify stats, update, and safely delete', async () => {
    const testCode = `ADM-${Date.now().toString(36).toUpperCase()}`;
    const createRes = await postJson(
      '/management/blocks',
      {
        name: 'Admin Experimental Block',
        code: testCode,
        description: 'Temporary block for Admin lifecycle test',
        status: 'ACTIVE',
      },
      adminToken
    );
    assert.strictEqual(createRes.status, 201);
    const newId = createRes.data.block.id;
    assert.strictEqual(createRes.data.block.totalCapacity, 0);
    assert.strictEqual(createRes.data.block.occupied, 0);
    assert.strictEqual(createRes.data.block.vacant, 0);
    assert.strictEqual(createRes.data.block.vacancyRate, '0%');

    // Update
    const updateRes = await putJson(
      `/management/blocks/${newId}`,
      { name: 'Admin Experimental Block Updated', status: 'INACTIVE' },
      adminToken
    );
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.block.name, 'Admin Experimental Block Updated');
    assert.strictEqual(updateRes.data.block.status, 'INACTIVE');

    // Clean delete
    const delRes = await deleteJson(`/management/blocks/${newId}`, adminToken);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.data.deletedId, newId);
  });

  await prisma.$disconnect();

  console.log(`\n====================================================`);
  console.log(`         BLOCK MANAGEMENT TESTS PASSED              `);
  console.log(`====================================================`);
  console.log(`Total Passed: ${passed}/${total}`);
}

runTests().catch((err) => {
  console.error('Fatal error running block management tests:', err);
  process.exit(1);
});
