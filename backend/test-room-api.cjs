const assert = require('assert');

async function testRoomApi() {
  console.log('=== Running Student Hostel My Room API Tests ===\n');

  // 1. Authenticate as MANI MANASVI GAVARA (Allocated student)
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  const manasviToken = loginData.token;

  // 2. Query My Room without token (must return 401)
  const unauthRes = await fetch('http://localhost:5001/api/student/my-room');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('[PASS] 1. Unauthenticated request to /api/student/my-room rejected with 401');

  // 3. Query My Room with authenticated token
  const authRes = await fetch('http://localhost:5001/api/student/my-room', {
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200, 'Authenticated request must return 200');
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.student.jntuNo, '25331A05H7');
  assert.strictEqual(authData.student.name, 'MANI MANASVI GAVARA');

  // Verify room allocation
  assert.strictEqual(authData.allocation.status, 'ALLOCATED');
  assert(authData.allocation.block === 'GH-1' || authData.allocation.block === 'Girls-Block-B', 'Block name match');
  assert.strictEqual(authData.allocation.roomNumber, '119');
  assert.strictEqual(authData.allocation.floor, '1');
  assert.strictEqual(authData.allocation.bedNumber, 'Bed-1');
  assert.strictEqual(authData.allocation.roomType, 'Non-AC Room (2 Sharing)');

  // Verify room overview & occupancy
  assert(authData.room.capacity >= 1);
  assert(authData.room.occupancy >= 1);

  // Verify roommates
  assert(authData.roommates.length >= 1);
  const currentStudentEntry = authData.roommates.find((r) => r.isCurrentStudent);
  const roommateEntry = authData.roommates.find((r) => !r.isCurrentStudent);

  assert(currentStudentEntry, 'Current student must be present in occupants');
  assert.strictEqual(currentStudentEntry.name, 'MANI MANASVI GAVARA');
  assert.strictEqual(currentStudentEntry.bedNumber, 'Bed-1');

  if (roommateEntry) {
    assert.strictEqual(roommateEntry.isCurrentStudent, false);
  }

  // Verify privacy: no password or passwordHash anywhere in the payload
  const stringified = JSON.stringify(authData);
  assert(!stringified.includes('passwordHash'), 'Must never leak passwordHash');
  assert(!stringified.includes('Password@123'), 'Must never leak password');

  console.log('[PASS] 2. Authenticated student receives accurate room allocation and roommates');
  console.log({
    room: `${authData.room.block} - ${authData.room.roomNumber}`,
    occupancyStatus: authData.room.occupancyStatus,
    capacity: authData.room.capacity,
    occupancy: authData.room.occupancy,
    roommates: authData.roommates.map((r) => `${r.name} (${r.bedNumber})${r.isCurrentStudent ? ' [You]' : ''}`),
  });

  // 4. Test IDOR prevention: try passing different studentId in query or headers
  const idorRes = await fetch('http://localhost:5001/api/student/my-room?studentId=FAKE_ID_123&jntuNo=21A91A0501', {
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  const idorData = await idorRes.json();
  assert.strictEqual(idorData.student.jntuNo, '25331A05H7', 'Backend must ignore client-supplied student ID parameters');
  console.log('[PASS] 3. IDOR prevented: server strictly uses authenticated session token');

  // 5. Authenticate as Rahul Varma (Unallocated student)
  const rahulLoginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '21A91A0501', password: 'Password@123' }),
  });
  const rahulLoginData = await rahulLoginRes.json();
  const rahulToken = rahulLoginData.token;

  const rahulRoomRes = await fetch('http://localhost:5001/api/student/my-room', {
    headers: { Authorization: `Bearer ${rahulToken}` },
  });
  const rahulRoomData = await rahulRoomRes.json();
  assert.strictEqual(rahulRoomData.status ?? 200, 200);
  assert.strictEqual(rahulRoomData.allocation.status, 'NOT_ALLOCATED');
  assert.strictEqual(rahulRoomData.room, null);
  assert.strictEqual(rahulRoomData.roommates.length, 0);
  console.log('[PASS] 4. Unallocated student returns clean empty state without room data');

  console.log('\nAll My Room API Tests Passed Successfully!');
}

testRoomApi().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
