const assert = require('assert');

async function testDashboardApi() {
  console.log('=== Running Student Hostel Dashboard API Tests ===\n');

  // 1. Authenticate as MANI MANASVI GAVARA
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  const token = loginData.token;

  // 2. Query Dashboard without token (must return 401)
  const unauthRes = await fetch('http://localhost:5001/api/student/dashboard');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('[PASS] 1. Unauthenticated request to /api/student/dashboard rejected with 401');

  // 3. Query Dashboard with authenticated token
  const authRes = await fetch('http://localhost:5001/api/student/dashboard', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200, 'Authenticated request must succeed');
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.student.jntuNo, '25331A05H7');
  assert.strictEqual(authData.student.name, 'MANI MANASVI GAVARA');
  assert.strictEqual(authData.student.role, 'STUDENT');

  // Verify real data
  assert.strictEqual(authData.room.status, 'ALLOCATED');
  assert(authData.room.block === 'GH-1' || authData.room.block === 'Girls-Block-B', 'Block name match');
  assert.strictEqual(authData.room.roomNumber, '119');
  assert.strictEqual(authData.mess.bookedToday, 4, 'Must match 4 booked tokens in PostgreSQL data (all 4 meal types booked for today)');
  assert.strictEqual(authData.outings.limit, 5);
  assert.strictEqual(authData.leaves.active, 0);
  assert(authData.notifications.length > 0, 'Notifications must be populated');
  assert(authData.recentActivity.length > 0, 'Recent activity must be populated');

  console.log('[PASS] 2. Authenticated dashboard returns real student identity & records');
  console.log({
    student: authData.student.name,
    room: `${authData.room.block} - ${authData.room.roomNumber}`,
    messTokensToday: authData.mess.bookedToday,
    outingsLimit: authData.outings.limit,
    notificationCount: authData.notifications.length,
    activityCount: authData.recentActivity.length,
  });

  // 4. Authenticate as Rahul Varma (Unallocated student)
  const rahulLoginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '21A91A0501', password: 'Password@123' }),
  });
  const rahulLoginData = await rahulLoginRes.json();
  const rahulToken = rahulLoginData.token;

  const rahulDashRes = await fetch('http://localhost:5001/api/student/dashboard', {
    headers: { Authorization: `Bearer ${rahulToken}` },
  });
  const rahulDashData = await rahulDashRes.json();
  assert.strictEqual(rahulDashData.room.status, 'NOT_ALLOCATED');
  assert.strictEqual(rahulDashData.mess.bookedToday, 0);
  console.log('[PASS] 3. Unallocated student dashboard accurately reflects NOT_ALLOCATED real state');

  console.log('\nAll Dashboard API Tests Passed Successfully!');
}

testDashboardApi().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
