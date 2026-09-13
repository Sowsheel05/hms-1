const assert = require('assert');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const API_BASE = 'http://localhost:5001/api';

async function runTests() {
  console.log('========================================================');
  console.log('  STARTING MESS MANAGEMENT STEP 4 AUTOMATED TESTS');
  console.log('========================================================\n');

  let adminToken = '';
  let studentToken = '';
  let createdMealId = null;

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

  try {
    // 1. Admin Authentication
    await test('1. Admin Authentication — login succeeds with ADMIN01', async () => {
      const res = await fetch(`${API_BASE}/management/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token, 'Admin JWT token required');
      adminToken = data.token;
    });

    // 2. Student Authentication for RBAC
    await test('2. Student Authentication — login succeeds for RBAC test', async () => {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.token, 'Student token required');
      studentToken = data.token;
    });

    // 3. Security: Unauthenticated access rejected
    await test('3. Security — unauthenticated request to /management/mess/meals returns 401', async () => {
      const res = await fetch(`${API_BASE}/management/mess/meals`);
      assert.strictEqual(res.status, 401);
    });

    // 4. Security: Student role forbidden
    await test('4. Security — student token rejected with 403 on /management/mess/meals', async () => {
      const res = await fetch(`${API_BASE}/management/mess/meals`, {
        headers: { Authorization: `Bearer ${studentToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // 5. Authoritative Meal Configurations (PostgreSQL 18.6)
    await test('5. Configuration — GET /meals returns 4 authoritative active meals', async () => {
      const res = await fetch(`${API_BASE}/management/mess/meals`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.meals), 'meals should be an array');
      assert.ok(data.meals.length >= 4, 'should have at least 4 default meals');

      const mealTypes = data.meals.map((m) => m.mealType);
      assert.ok(mealTypes.includes('BREAKFAST'), 'Should include BREAKFAST');
      assert.ok(mealTypes.includes('LUNCH'), 'Should include LUNCH');
      assert.ok(mealTypes.includes('SNACKS'), 'Should include SNACKS');
      assert.ok(mealTypes.includes('DINNER'), 'Should include DINNER');

      // Verify db matches
      const dbCount = await prisma.mealConfig.count();
      assert.strictEqual(data.meals.length, dbCount, 'Database count must match API count');
    });

    // 6. Meal Creation Validation
    await test('6. Configuration — POST /meals rejects invalid or missing fields (400)', async () => {
      const res = await fetch(`${API_BASE}/management/mess/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: '',
          startTime: 'invalid',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 400);
      assert.strictEqual(data.success, false);
    });

    // 7. Meal Creation Success & Audit Log
    await test('7. Configuration — POST /meals creates new meal and logs activity', async () => {
      const res = await fetch(`${API_BASE}/management/mess/meals`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          mealType: 'SPECIAL_DINNER',
          name: 'Weekend Special Dinner',
          startTime: '08:00 PM',
          endTime: '10:30 PM',
          description: 'Special weekend buffet',
          cutoffHour: 19,
          cutoffMinute: 0,
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 201);
      assert.strictEqual(data.success, true);
      assert.ok(data.meal && data.meal.id, 'Created meal must have ID');
      createdMealId = data.meal.id;
      assert.strictEqual(data.meal.mealType, 'SPECIAL_DINNER');

      // Verify saved in PostgreSQL
      const saved = await prisma.mealConfig.findUnique({ where: { id: createdMealId } });
      assert.ok(saved, 'Must exist in PostgreSQL MealConfig');
      assert.strictEqual(saved.name, 'Weekend Special Dinner');

      // Verify activity log
      const log = await prisma.activityLog.findFirst({
        where: {
          action: 'CREATE',
          entity: 'MealConfig',
          description: { contains: 'Weekend Special Dinner' },
        },
      });
      assert.ok(log, 'ActivityLog must record CREATE for MealConfig');
    });

    // 8. Meal Update
    await test('8. Configuration — PUT /meals/:id updates timings and description', async () => {
      assert.ok(createdMealId, 'createdMealId must be set');
      const res = await fetch(`${API_BASE}/management/mess/meals/${createdMealId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          name: 'Weekend Gala Dinner',
          startTime: '08:15 PM',
          endTime: '10:45 PM',
          description: 'Updated description for gala dinner',
        }),
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.meal.name, 'Weekend Gala Dinner');
      assert.strictEqual(data.meal.startTime, '08:15 PM');

      // Verify in DB
      const updated = await prisma.mealConfig.findUnique({ where: { id: createdMealId } });
      assert.strictEqual(updated.name, 'Weekend Gala Dinner');
      assert.strictEqual(updated.startHour, 20);
      assert.strictEqual(updated.startMinute, 15);
    });

    // 9. Meal Toggle Active
    await test('9. Configuration — PATCH /meals/:id/toggle activates/deactivates meal', async () => {
      assert.ok(createdMealId, 'createdMealId must be set');
      // Toggle to inactive
      const res1 = await fetch(`${API_BASE}/management/mess/meals/${createdMealId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data1 = await res1.json();
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(data1.meal.isActive, false);

      // Toggle back to active
      const res2 = await fetch(`${API_BASE}/management/mess/meals/${createdMealId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data2 = await res2.json();
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(data2.meal.isActive, true);
    });

    // 10. Meal Safe Deletion — Conflict on meals with existing tokens
    await test('10. Configuration — DELETE /meals/:id on meal with tokens returns 409 Conflict', async () => {
      // Find default BREAKFAST meal which has historical tokens
      const breakfast = await prisma.mealConfig.findFirst({ where: { mealType: 'BREAKFAST' } });
      assert.ok(breakfast, 'BREAKFAST meal must exist');

      const res = await fetch(`${API_BASE}/management/mess/meals/${breakfast.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 409, 'Expected 409 Conflict when deleting meal with tokens');
      assert.strictEqual(data.success, false);
      assert.ok(data.message.toLowerCase().includes('cannot delete'), 'Should return safe deactivation message');
    });

    // 11. Meal Deletion — Success on test meal without tokens
    await test('11. Configuration — DELETE /meals/:id removes unused meal from DB', async () => {
      assert.ok(createdMealId, 'createdMealId must be set');
      const res = await fetch(`${API_BASE}/management/mess/meals/${createdMealId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);

      // Verify removed from DB
      const check = await prisma.mealConfig.findUnique({ where: { id: createdMealId } });
      assert.strictEqual(check, null, 'Meal must be deleted from PostgreSQL');
    });

    // 12. Analytics Endpoint
    await test('12. Analytics — GET /analytics returns 4 meal cards and chart datasets', async () => {
      const res = await fetch(`${API_BASE}/management/mess/analytics?days=7`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.cards), 'cards should be an array');
      assert.strictEqual(data.cards.length, 4, 'Should have 4 meal cards');
      assert.ok(data.chart, 'chart object should exist');
      assert.ok(Array.isArray(data.chart.labels), 'chart labels should be an array');
      assert.ok(data.distribution, 'distribution object should exist');
      assert.strictEqual(typeof data.distribution.totalScans, 'number');
      assert.strictEqual(typeof data.distribution.totalAllowed, 'number');
      assert.strictEqual(typeof data.distribution.totalDenied, 'number');
      assert.strictEqual(typeof data.distribution.allowedPercentage, 'number');
    });

    // 13. Indent Plan Endpoint
    await test('13. Indent Plan — GET /indent-plan calculates counts and student records', async () => {
      const res = await fetch(`${API_BASE}/management/mess/indent-plan`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.summary), 'summary must be an array');
      assert.strictEqual(data.summary.length, 4, 'Must have 4 meal cards for indent');
      assert.ok(Array.isArray(data.students), 'students must be an array');
      assert.strictEqual(typeof data.totalStudents, 'number');

      // Verify student structure if present
      if (data.students.length > 0) {
        const student = data.students[0];
        assert.ok(student.studentId, 'Student must have studentId');
        assert.ok(student.studentName, 'Student must have studentName');
        assert.ok(student.meal, 'Student must have meal');
        assert.ok(student.dietaryPreference, 'Student must have dietaryPreference');
      }
    });

    // 14. Indent Plan Filtering
    await test('14. Indent Plan — filters properly by search query', async () => {
      const res = await fetch(`${API_BASE}/management/mess/indent-plan?search=MANI`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      for (const s of data.students) {
        assert.ok(
          s.studentName.toUpperCase().includes('MANI') || s.studentId.includes('MANI'),
          'Filtered student must match search query'
        );
      }
    });

    // 15. Attendance Logs Endpoint
    await test('15. Attendance — GET /attendance returns summary cards and paginated logs', async () => {
      const res = await fetch(`${API_BASE}/management/mess/attendance?page=1&limit=10`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(Array.isArray(data.summary), 'summary should be an array');
      assert.strictEqual(data.summary.length, 4, 'Should have 4 attendance meal cards');
      assert.ok(Array.isArray(data.data), 'data should be an array');
      assert.strictEqual(data.page, 1);
      assert.strictEqual(data.limit, 10);
      assert.strictEqual(typeof data.total, 'number');
      assert.strictEqual(typeof data.totalPages, 'number');

      // Verify each record has BIOMETRIC badge and student details
      if (data.data.length > 0) {
        const rec = data.data[0];
        assert.ok(rec.id, 'Record must have id');
        assert.ok(rec.studentName, 'Record must have studentName');
        assert.ok(rec.studentId, 'Record must have studentId');
        assert.strictEqual(rec.badge, 'BIOMETRIC', 'badge must be BIOMETRIC');
        assert.ok(['Allowed', 'Denied', 'Absent'].includes(rec.status), 'Valid status');
      }
    });

    // 16. Attendance Filtering
    await test('16. Attendance — filters by status=Absent', async () => {
      const res = await fetch(`${API_BASE}/management/mess/attendance?status=Absent`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      for (const rec of data.data) {
        assert.strictEqual(rec.status, 'Absent');
      }
    });

    // 17. Attendance CSV Export
    await test('17. Attendance — GET /attendance/export/csv returns valid CSV stream', async () => {
      const res = await fetch(`${API_BASE}/management/mess/attendance/export/csv`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type');
      assert.ok(contentType && contentType.includes('text/csv'), 'Content-Type must be text/csv');
      const disposition = res.headers.get('content-disposition');
      assert.ok(disposition && disposition.includes('attachment'), 'Must be attachment');

      const csvText = await res.text();
      assert.ok(
        csvText.startsWith('Student Name,Student ID,Meal,Status,Verification,Date,Time,Block,Gender'),
        'Must contain proper CSV header'
      );
    });

    // 18. Non-Regression: Original /overview endpoint still functions
    await test('18. Non-Regression — GET /overview endpoint preserved and functional', async () => {
      const res = await fetch(`${API_BASE}/management/mess/overview`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(data.success, true);
      assert.ok(data.data, 'data object should exist');
      assert.ok(data.data.summary, 'summary object should exist');
      assert.ok(Array.isArray(data.data.mealBreakdown), 'mealBreakdown array should exist');
    });

  } finally {
    await prisma.$disconnect();
  }

  console.log('\n========================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled Test Runner Error:', err);
  process.exit(1);
});
