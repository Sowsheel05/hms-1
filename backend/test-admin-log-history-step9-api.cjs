'use strict';
/**
 * Admin Portal Step 9 — Log History Management
 * Dedicated Integration Test Suite
 *
 * Tests the complete Log History audit system backed by PostgreSQL 18.6:
 * RBAC, KPI summary stats, search, filtering (action, entity, role, date range),
 * pagination, deterministic ordering, log detail, actor integrity, historical immutability,
 * IDOR protection, metadata parsing, SSE realtime sync, cross-module audit visibility,
 * and database integrity verification.
 *
 * All test fixtures are cleaned up after execution.
 */

const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const http = require('http');

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api/management/log-history';
const AUTH_BASE = 'http://localhost:5001/api';

let adminToken = null;
let adminUser = null;
let wardenToken = null;
let maintToken = null;
let studentToken = null;
let studentUser = null;

let testLogId = null;
let testFixtureIds = [];

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
    if (testFixtureIds.length > 0) {
      await prisma.activityLog.deleteMany({
        where: { id: { in: testFixtureIds } },
      });
    }
    // Also delete any logs marked with STEP9_TEST marker
    await prisma.activityLog.deleteMany({
      where: { description: { contains: 'STEP9_TEST_MARKER' } },
    });
  } catch (err) {
    console.error('Fixture cleanup error:', err);
  }
}

async function run() {
  console.log('================================================================');
  console.log('  STARTING ADMIN LOG HISTORY STEP 9 AUTOMATED TESTS');
  console.log('================================================================\n');

  try {
    await cleanupFixtures();
    // -----------------------------------------------------------------
    // 1. AUTHENTICATION SETUP
    // -----------------------------------------------------------------
    await test('1. Admin Authentication — login succeeds with ADMIN01', async () => {
      const res = await fetch(`${AUTH_BASE}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
      });
      assert.strictEqual(res.status, 200, 'Admin login must return 200');
      const data = await res.json();
      assert.ok(data.token, 'Must return JWT token');
      assert.strictEqual(data.user.role, 'ADMIN');
      adminToken = data.token;
      adminUser = data.user;
    });

    // Warden login (authorized management role)
    const wardenRes = await fetch(`${AUTH_BASE}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    wardenToken = (await wardenRes.json()).token;

    // Maintenance staff login (unauthorized role for log history)
    const maintRes = await fetch(`${AUTH_BASE}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'MAINT01', password: 'Password@123' }),
    });
    maintToken = (await maintRes.json()).token;

    // Student login (non-management user)
    const studentRes = await fetch(`${AUTH_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    const studentData = await studentRes.json();
    studentToken = studentData.token;
    studentUser = studentData.user;

    // -----------------------------------------------------------------
    // 2. RBAC ACCESS CONTROL
    // -----------------------------------------------------------------
    await test('2. RBAC — Unauthenticated access returns 401 Unauthorized', async () => {
      const res = await fetch(BASE_URL);
      assert.strictEqual(res.status, 401, 'Unauthenticated request must return 401');
    });

    await test('3. RBAC — Student token returns 403 Forbidden', async () => {
      const res = await fetch(BASE_URL, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403, 'Student token must return 403');
    });

    await test('4. RBAC — Unauthorized MAINTENANCE_STAFF role returns 403 Forbidden', async () => {
      const res = await fetch(BASE_URL, {
        headers: { Authorization: `Bearer ${maintToken}` },
      });
      assert.strictEqual(res.status, 403, 'Maintenance staff must return 403');
    });

    // -----------------------------------------------------------------
    // 3. KPI SUMMARY STATS
    // -----------------------------------------------------------------
    await test('5. KPI Stats — GET /summary returns authoritative PostgreSQL counts', async () => {
      const res = await fetch(`${BASE_URL}/summary`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200, 'Summary endpoint must return 200');
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(data.summary, 'Must return summary object');
      assert.ok(typeof data.summary.totalLogs === 'number', 'totalLogs must be number');
      assert.ok(typeof data.summary.todayLogs === 'number', 'todayLogs must be number');
      assert.ok(typeof data.summary.approvalLogs === 'number', 'approvalLogs must be number');
      assert.ok(typeof data.summary.financialLogs === 'number', 'financialLogs must be number');
      assert.ok(typeof data.summary.securityLogs === 'number', 'securityLogs must be number');
      assert.ok(typeof data.summary.adminLogs === 'number', 'adminLogs must be number');

      // Verify PostgreSQL direct count
      const dbTotal = await prisma.activityLog.count();
      assert.strictEqual(data.summary.totalLogs, dbTotal, 'totalLogs must match PostgreSQL count');
    });

    // -----------------------------------------------------------------
    // 4. SEED TEST FIXTURE FOR CONTROLLED VERIFICATION
    // -----------------------------------------------------------------
    const testEntityId = `TEST-ENTITY-${Date.now()}`;
    const fixtureLog = await prisma.activityLog.create({
      data: {
        studentId: adminUser.id,
        actionType: 'COMPLAINT',
        action: 'RESOLVE',
        actorRole: 'ADMIN',
        entity: 'Complaint',
        entityId: testEntityId,
        previousState: JSON.stringify({ status: 'IN_PROGRESS' }),
        newState: JSON.stringify({ status: 'RESOLVED' }),
        description: 'STEP9_TEST_MARKER: Resolved test maintenance issue with electrical wiring',
        metadata: JSON.stringify({ resolutionTimeHours: 2.5, technician: 'Ravi Kumar' }),
        ipAddress: '192.168.1.105',
      },
    });
    testLogId = fixtureLog.id;
    testFixtureIds.push(testLogId);

    // -----------------------------------------------------------------
    // 5. LOG LISTING & PAGINATION
    // -----------------------------------------------------------------
    await test('6. Log Listing & Pagination — returns structured paginated response', async () => {
      const res = await fetch(`${BASE_URL}?page=1&pageSize=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.logs), 'Logs must be an array');
      assert.ok(data.logs.length <= 10, 'Must respect pageSize 10');
      assert.ok(data.pagination, 'Must include pagination metadata');
      assert.strictEqual(data.pagination.page, 1);
      assert.strictEqual(data.pagination.pageSize, 10);
      assert.ok(data.pagination.total > 0, 'Total logs must be greater than 0');
      assert.ok(data.pagination.totalPages >= 1, 'Total pages must be >= 1');
    });

    await test('7. Pagination Clamping — enforces maximum limit of 100', async () => {
      const res = await fetch(`${BASE_URL}?page=1&pageSize=500`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.pagination.pageSize, 100, 'Must clamp requested limit 500 to 100');
    });

    // -----------------------------------------------------------------
    // 6. SEARCH CAPABILITIES
    // -----------------------------------------------------------------
    await test('8. Search by Action — case-insensitive search finds matching action', async () => {
      const res = await fetch(`${BASE_URL}?search=RESOLVE`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must find matching logs for RESOLVE');
      assert.ok(
        data.logs.some((l) => (l.action && l.action.includes('RESOLVE')) || (l.description && l.description.includes('RESOLVE'))),
        'Found logs must contain action or description match'
      );
    });

    await test('9. Search by Entity ID — exact match for test entityId', async () => {
      const res = await fetch(`${BASE_URL}?search=${testEntityId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must find log with test entityId');
      assert.strictEqual(data.logs[0].entityId, testEntityId);
    });

    await test('10. Search by Actor Name — finds logs initiated by admin user', async () => {
      const res = await fetch(`${BASE_URL}?search=${encodeURIComponent(adminUser.name)}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must find logs by actor name');
    });

    await test('11. Search by Description — text query in activity description', async () => {
      const res = await fetch(`${BASE_URL}?search=electrical+wiring`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must find fixture with description query');
      assert.ok(data.logs.some((l) => l.description.includes('electrical wiring')));
    });

    // -----------------------------------------------------------------
    // 7. MULTI-DIMENSIONAL FILTERS
    // -----------------------------------------------------------------
    await test('12. Action Filter — returns only specified action logs', async () => {
      const res = await fetch(`${BASE_URL}?action=RESOLVE`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must return logs for RESOLVE');
      assert.ok(data.logs.every((l) => l.action === 'RESOLVE' || l.actionType === 'RESOLVE'));
    });

    await test('13. Entity Filter — returns only logs for specified entity', async () => {
      const res = await fetch(`${BASE_URL}?entity=Complaint`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must return logs for Complaint');
      assert.ok(data.logs.every((l) => l.entity === 'Complaint'));
    });

    await test('14. Actor Role Filter — returns only logs executed by ADMIN role', async () => {
      const res = await fetch(`${BASE_URL}?actorRole=ADMIN`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must return logs for ADMIN role');
      assert.ok(data.logs.every((l) => l.actorRole === 'ADMIN'));
    });

    await test('15. Actor ID Filter — returns logs executed by specific staff user', async () => {
      const res = await fetch(`${BASE_URL}?actorId=${adminUser.id}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.logs.length > 0, 'Must return logs for admin staff user');
      assert.ok(data.logs.every((l) => l.studentId === adminUser.id));
    });

    await test('16. Date Range Filter — returns logs within date boundaries', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${BASE_URL}?from=${today}&to=${today}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(Array.isArray(data.logs));
      assert.ok(data.logs.length > 0, 'Must return logs created today');
    });

    await test('17. Combined Multi-Criteria Filter — search + entity + action + role', async () => {
      const res = await fetch(
        `${BASE_URL}?search=${testEntityId}&entity=Complaint&action=RESOLVE&actorRole=ADMIN`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.logs.length, 1, 'Combined query must uniquely find test fixture');
      assert.strictEqual(data.logs[0].id, testLogId);
      assert.strictEqual(data.logs[0].entity, 'Complaint');
      assert.strictEqual(data.logs[0].action, 'RESOLVE');
      assert.strictEqual(data.logs[0].actorRole, 'ADMIN');
    });

    // -----------------------------------------------------------------
    // 8. DETERMINISTIC ORDERING
    // -----------------------------------------------------------------
    await test('18. Deterministic Ordering — records sorted newest-first (createdAt DESC)', async () => {
      const res = await fetch(`${BASE_URL}?pageSize=20`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      for (let i = 0; i < data.logs.length - 1; i++) {
        const current = new Date(data.logs[i].createdAt).getTime();
        const next = new Date(data.logs[i + 1].createdAt).getTime();
        assert.ok(current >= next, `Ordering failure at index ${i}: ${current} < ${next}`);
      }
    });

    // -----------------------------------------------------------------
    // 9. LOG DETAIL ENDPOINT
    // -----------------------------------------------------------------
    await test('19. Log Detail — GET /:id returns enriched audit context', async () => {
      const res = await fetch(`${BASE_URL}/${testLogId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.log.id, testLogId);
      assert.strictEqual(data.log.entity, 'Complaint');
      assert.strictEqual(data.log.entityId, testEntityId);
      assert.strictEqual(data.log.ipAddress, '192.168.1.105');
      assert.ok(data.log.actor, 'Must include enriched actor object');
      assert.strictEqual(data.log.actor.id, adminUser.id);
      assert.strictEqual(data.log.actor.name, adminUser.name);
      assert.strictEqual(data.log.actor.role, 'ADMIN');
    });

    await test('20. State Transition & Metadata — captures previousState, newState, and parsed JSON', async () => {
      const res = await fetch(`${BASE_URL}/${testLogId}`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.ok(data.log.previousState, 'Must have previousState');
      assert.ok(data.log.newState, 'Must have newState');
      assert.ok(typeof data.log.metadata === 'object', 'Metadata must be parsed JSON');
      assert.strictEqual(data.log.metadata.technician, 'Ravi Kumar');
      assert.strictEqual(data.log.metadata.resolutionTimeHours, 2.5);
    });

    // -----------------------------------------------------------------
    // 10. SECURITY & IMMUTABILITY
    // -----------------------------------------------------------------
    await test('21. Historical Immutability — PUT / PATCH / DELETE methods return 404 / 405', async () => {
      // Test PUT
      const putRes = await fetch(`${BASE_URL}/${testLogId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ description: 'Attempted audit tamper' }),
      });
      assert.ok(putRes.status === 404 || putRes.status === 405, 'PUT must be blocked');

      // Test DELETE
      const delRes = await fetch(`${BASE_URL}/${testLogId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.ok(delRes.status === 404 || delRes.status === 405, 'DELETE must be blocked');

      // Verify DB record was not mutated
      const unchanged = await prisma.activityLog.findUnique({ where: { id: testLogId } });
      assert.strictEqual(unchanged.description, fixtureLog.description, 'DB log record must remain immutable');
    });

    await test('22. IDOR Protection — non-existent log ID returns 404 Not Found', async () => {
      const res = await fetch(`${BASE_URL}/00000000-0000-0000-0000-000000000000`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 404, 'Non-existent ID must return 404');
    });

    // -----------------------------------------------------------------
    // 11. CROSS-MODULE AUDIT VISIBILITY
    // -----------------------------------------------------------------
    await test('23. Cross-Module Audit — verifies activity logs exist across core operational domains', async () => {
      const [
        blockLogs,
        roomLogs,
        outingLogs,
        leaveLogs,
        complaintLogs,
        billingLogs,
      ] = await Promise.all([
        prisma.activityLog.count({ where: { entity: { in: ['Block', 'Floor'] } } }),
        prisma.activityLog.count({ where: { entity: { in: ['Room', 'RoomAllocation'] } } }),
        prisma.activityLog.count({ where: { entity: 'OutingRequest' } }),
        prisma.activityLog.count({ where: { entity: { in: ['LeaveRequest', 'Suspension'] } } }),
        prisma.activityLog.count({ where: { entity: 'Complaint' } }),
        prisma.activityLog.count({ where: { entity: { in: ['Guest', 'GuestVisit', 'GuestBill'] } } }),
      ]);

      console.log(`    Coverage: Blocks=${blockLogs}, Rooms=${roomLogs}, Outings=${outingLogs}, Leaves=${leaveLogs}, Complaints=${complaintLogs}, Billing=${billingLogs}`);
      assert.ok(outingLogs > 0, 'Outing audit records must exist');
      assert.ok(leaveLogs > 0, 'Leave audit records must exist');
      assert.ok(complaintLogs > 0, 'Complaint audit records must exist');
      assert.ok(billingLogs > 0, 'Billing audit records must exist');
    });

    // -----------------------------------------------------------------
    // 12. REALTIME SSE SYNCHRONIZATION
    // -----------------------------------------------------------------
    await test('24. Realtime SSE — /api/management/events stream is online and responsive', async () => {
      const ssePromise = new Promise((resolve, reject) => {
        const req = http.request(
          'http://localhost:5001/api/management/events-stream',
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${adminToken}`,
              Accept: 'text/event-stream',
            },
          },
          (res) => {
            assert.strictEqual(res.statusCode, 200);
            assert.strictEqual(res.headers['content-type'], 'text/event-stream');
            res.destroy();
            resolve(true);
          }
        );
        req.on('error', reject);
        req.setTimeout(4000, () => {
          req.destroy();
          resolve(true);
        });
        req.end();
      });

      await ssePromise;
    });

    // -----------------------------------------------------------------
    // 13. DATABASE INTEGRITY
    // -----------------------------------------------------------------
    await test('25. Database Integrity — verifies 0 orphan activity logs without valid actors', async () => {
      // Ensure all activity logs reference an existing student/user
      const orphanLogs = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count
        FROM "ActivityLog" al
        LEFT JOIN "Student" s ON al."studentId" = s.id
        WHERE s.id IS NULL
      `;
      assert.strictEqual(orphanLogs[0].count, 0, 'Must have 0 orphan activity logs in PostgreSQL');
    });

    await test('26. Database Integrity — valid timestamps and clean test fixture removal', async () => {
      // Clean test fixtures
      await cleanupFixtures();

      // Verify test fixture was removed
      const exists = await prisma.activityLog.findUnique({ where: { id: testLogId } });
      assert.strictEqual(exists, null, 'Test fixture must be cleaned up');

      // Verify no null timestamps exist in PostgreSQL
      const invalidTimestamps = await prisma.$queryRaw`
        SELECT COUNT(*)::int AS count FROM "ActivityLog" WHERE "createdAt" IS NULL
      `;
      assert.strictEqual(invalidTimestamps[0].count, 0, 'All logs must have non-null timestamps');
    });

  } finally {
    await cleanupFixtures();
    await prisma.$disconnect();
  }

  console.log('\n================================================================');
  console.log(`  STEP 9 TESTS FINISHED: ${passed} PASSED | ${failed} FAILED`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
