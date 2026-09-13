const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('====================================================');
  console.log('  STARTING ROOM ALLOCATION STEP 3 AUTOMATED TESTS');
  console.log('====================================================\n');

  let adminToken = '';
  let studentToken = '';

  // Helper test runner
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`• Testing: ${name}... `);
      await fn();
      console.log('\x1b[32mPASSED\x1b[0m');
      passed++;
    } catch (err) {
      console.log('\x1b[31mFAILED\x1b[0m');
      console.error('  Error:', err.message);
      failed++;
    }
  }

  // 1. Admin Authentication Setup
  await test('1. Admin Authentication — login succeeds with valid token', async () => {
    const res = await fetch(`${API_BASE}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.ok(data.token, 'Token should be returned');
    adminToken = data.token;
  });

  // 2. Student Authentication Setup
  await test('2. Student Authentication — setup for RBAC checks', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    studentToken = data.token;
  });

  // 3. Admin Authorization — 401 unauthenticated
  await test('3. Security — unauthenticated request returns 401', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending`);
    assert.strictEqual(res.status, 401);
  });

  // 4. Admin Authorization — 403 on student role
  await test('4. Security — student role forbidden from room allocation (403)', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 403);
  });

  // 5. Authoritative Pending Allocation Count from PostgreSQL
  await test('5. Authoritative Pending Count — reflects real PostgreSQL count', async () => {
    const dbCount = await prisma.student.count({
      where: { role: 'STUDENT', allocationStatus: 'PENDING', isActive: true },
    });

    const res = await fetch(`${API_BASE}/management/room-allocations/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.pendingCount, dbCount, 'Pending count must match PostgreSQL');
    assert.ok(data.data.length >= 1, 'Should contain at least 1 pending candidate');
  });

  // 6. Pending Candidate Metadata (VANA BHARGAV PRASAD)
  await test('6. Allocation Metadata — includes course info, contact, preferences, and documents', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    const candidate = data.data.find((c) => c.jntuNo === '23331A4462');
    assert.ok(candidate, 'VANA BHARGAV PRASAD (23331A4462) must be present');
    assert.strictEqual(candidate.name, 'VANA BHARGAV PRASAD');
    assert.strictEqual(candidate.courseInfo.degree, 'B.Tech');
    assert.strictEqual(candidate.courseInfo.department, 'Data Science (CSE-DS)');
    assert.strictEqual(candidate.courseInfo.year, '2nd Year');
    assert.strictEqual(candidate.preferences.blockPreference, 'Boys-Block-D');
    assert.strictEqual(candidate.preferences.floorPreference, 'First Floor');
    assert.strictEqual(candidate.preferences.roomPreference, 'Non-AC Room (2 Sharing)');
    assert.strictEqual(candidate.documents.biometricStatus, 'VERIFIED');
    assert.strictEqual(candidate.documents.photos, 'SUBMITTED');
  });

  // 7. Search by Resident Name
  await test('7. Search — filters by resident name correctly', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending?search=BHARGAV`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.data.length >= 1);
    assert.ok(data.data.every((c) => c.name.toUpperCase().includes('BHARGAV')));
  });

  // 8. Search by JNTU Number
  await test('8. Search — filters by JNTU registration number', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending?search=23331A4462`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.length, 1);
    assert.strictEqual(data.data[0].jntuNo, '23331A4462');
  });

  // 9. Search Nonexistent Resident
  await test('9. Search — returns empty list for nonexistent search query', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending?search=NONEXISTENT_XYZ_999`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.data.length, 0);
  });

  // 10. Filter by Block Preference
  await test('10. Filter — filters by Block preference', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending?block=Boys-Block-D`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(data.data.every((c) => c.preferences.blockPreference.includes('Boys-Block-D')));
  });

  // 11. Pagination
  await test('11. Pagination — limits output and provides page metadata', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/pending?page=1&limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.page, 1);
    assert.strictEqual(data.limit, 5);
    assert.ok(typeof data.totalPages === 'number');
  });

  // 12. Rejection Validation — missing reason rejected
  await test('12. Rejection Validation — rejects request when reason is empty', async () => {
    const student = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    const res = await fetch(`${API_BASE}/management/room-allocations/${student.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: '' }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(data.success, false);
  });

  // 13. Rejection Validation — nonexistent student returns 404
  await test('13. Rejection Validation — 404 on nonexistent student ID', async () => {
    const res = await fetch(`${API_BASE}/management/room-allocations/00000000-0000-0000-0000-000000000000/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ reason: 'Test rejection on invalid student' }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 14. Room Availability & Assignment Validation — nonexistent room returns 404
  await test('14. Assignment Validation — nonexistent room returns 404', async () => {
    const student = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    const res = await fetch(`${API_BASE}/management/room-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: '00000000-0000-0000-0000-000000000000',
        studentId: student.id,
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 15. Room Availability & Assignment Validation — nonexistent student returns 404
  await test('15. Assignment Validation — nonexistent student returns 404', async () => {
    const room = await prisma.room.findFirst({ where: { status: 'ACTIVE' } });
    const res = await fetch(`${API_BASE}/management/room-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: room.id,
        studentId: '00000000-0000-0000-0000-000000000000',
      }),
    });
    assert.strictEqual(res.status, 404);
  });

  // 16. Over-Capacity Assignment Rejection — full room cannot accept allocations
  await test('16. Capacity Validation — rejects assignment to fully occupied room (400)', async () => {
    // Find room 119 in Girls-Block-B which has capacity: 2, occ: 2
    const fullRoom = await prisma.room.findFirst({
      where: { roomNumber: '119' },
      include: { allocations: { where: { status: 'ACTIVE' } } },
    });
    assert.ok(fullRoom, 'Room 119 must exist');
    assert.strictEqual(fullRoom.allocations.length, fullRoom.capacity);

    const student = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    const res = await fetch(`${API_BASE}/management/room-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: fullRoom.id,
        studentId: student.id,
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 400);
    assert.ok(data.message.includes('full capacity') || data.message.includes('ROOM_FULL'));
  });

  // 17. Successful Transactional Room Allocation Workflow
  let testAllocId = '';
  await test('17. Successful Room Allocation — allocates student atomically in transaction', async () => {
    const student = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    const room101 = await prisma.room.findFirst({
      where: { roomNumber: '101', block: { name: 'Boys-Block-D' } },
    });
    assert.ok(room101, 'Room 101 in Boys-Block-D must exist');

    const res = await fetch(`${API_BASE}/management/room-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: room101.id,
        studentId: student.id,
        bedNumber: 'Bed-1',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 201);
    assert.strictEqual(data.success, true);
    assert.ok(data.allocation.id);
    testAllocId = data.allocation.id;

    // Verify DB state
    const updatedStudent = await prisma.student.findUnique({ where: { id: student.id } });
    assert.strictEqual(updatedStudent.allocationStatus, 'ALLOCATED');
    assert.strictEqual(updatedStudent.roomNumber, '101');
    assert.strictEqual(updatedStudent.bedNumber, 'Bed-1');

    // Verify ActivityLog was created
    const log = await prisma.activityLog.findFirst({
      where: { actionType: 'ROOM_MANAGEMENT', description: { contains: 'VANA BHARGAV PRASAD' } },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(log, 'ActivityLog record must be persisted in PostgreSQL');
  });

  // 18. Duplicate Allocation Prevention
  await test('18. Duplicate Prevention — rejects assigning already allocated resident (409)', async () => {
    const student = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    const room101 = await prisma.room.findFirst({
      where: { roomNumber: '101', block: { name: 'Boys-Block-D' } },
    });

    const res = await fetch(`${API_BASE}/management/room-allocations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: room101.id,
        studentId: student.id,
      }),
    });
    assert.strictEqual(res.status, 409);
  });

  // 19. Vacate Workflow
  await test('19. Vacate Allocation — successfully vacates active allocation', async () => {
    assert.ok(testAllocId, 'Allocation ID must exist');
    const res = await fetch(`${API_BASE}/management/room-allocations/${testAllocId}/vacate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    const allocInDb = await prisma.roomAllocation.findUnique({ where: { id: testAllocId } });
    assert.strictEqual(allocInDb.status, 'VACATED');
  });

  // 20. Rejection Workflow Test
  await test('20. Rejection Workflow — rejects pending allocation with audit logging', async () => {
    // Temporarily set student to PENDING to test rejection
    const student = await prisma.student.update({
      where: { jntuNo: '23331A4462' },
      data: { allocationStatus: 'PENDING' },
    });

    const res = await fetch(`${API_BASE}/management/room-allocations/${student.id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        reason: 'Block quota fulfilled for academic term 2026',
      }),
    });
    const data = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(data.success, true);

    const updated = await prisma.student.findUnique({ where: { id: student.id } });
    assert.strictEqual(updated.allocationStatus, 'NOT_ALLOCATED');

    // Verify rejection ActivityLog
    const log = await prisma.activityLog.findFirst({
      where: { actionType: 'ROOM_MANAGEMENT', action: 'REJECT', entityId: student.id },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(log, 'Rejection ActivityLog must be created');
    assert.ok(log.description.includes('Block quota fulfilled'));
  });

  // 21. Database Cleanup & Restoration
  await test('21. Database Integrity Restoration — restore VANA BHARGAV PRASAD to clean PENDING state', async () => {
    // Delete temporary test allocation record if exists
    if (testAllocId) {
      await prisma.roomAllocation.deleteMany({ where: { id: testAllocId } });
    }

    // Restore VANA BHARGAV PRASAD back to original pending candidate state
    await prisma.student.update({
      where: { jntuNo: '23331A4462' },
      data: {
        allocationStatus: 'PENDING',
        blockName: 'Boys-Block-D',
        floorName: 'First Floor',
        roomType: 'Non-AC Room (2 Sharing)',
        roomCapacity: 2,
        roomNumber: null,
        bedNumber: null,
      },
    });

    const restored = await prisma.student.findUnique({ where: { jntuNo: '23331A4462' } });
    assert.strictEqual(restored.allocationStatus, 'PENDING');
    assert.strictEqual(restored.roomNumber, null);
    assert.strictEqual(restored.bedNumber, null);
  });

  console.log('\n====================================================');
  console.log(`  TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

runTests().catch(async (err) => {
  console.error('Fatal test error:', err);
  await prisma.$disconnect();
  process.exit(1);
});
