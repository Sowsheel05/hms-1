const http = require('http');
const assert = require('assert');

const API_BASE = 'http://localhost:5001/api';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path.startsWith('http') ? path : `${API_BASE}${path}`);
    const reqOptions = {
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(url, reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const contentType = res.headers['content-type'] || '';
        let body;
        if (contentType.includes('application/json')) {
          try {
            body = JSON.parse(buffer.toString('utf8'));
          } catch (e) {
            body = buffer.toString('utf8');
          }
        } else {
          body = buffer;
        }

        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
        });
      });
    });

    req.on('error', reject);

    if (options.body) {
      if (typeof options.body === 'object' && !(options.body instanceof Buffer)) {
        req.setHeader('Content-Type', 'application/json');
        req.write(JSON.stringify(options.body));
      } else {
        req.write(options.body);
      }
    }

    req.end();
  });
}

async function runTests() {
  console.log('========================================================');
  console.log('  TESTING MESS INDENT, ATTENDANCE & FOUR-WAY REPORTS   ');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    process.stdout.write(`• Testing: ${name}... `);
    try {
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`  Error: ${err.message}`);
      failed++;
    }
  }

  // 1. Authenticate Admin and Student
  let adminToken = '';
  let studentToken = '';
  let student1Id = '';
  let student2Id = '';
  let student3Id = '';
  let student4Id = '';

  await test('1. Authenticate Management Admin', async () => {
    const res = await request('/management/auth/login', {
      method: 'POST',
      body: { username: 'ADMIN01', password: 'Password@123' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    adminToken = res.body.token;
    assert.ok(adminToken);
  });

  await test('2. Authenticate Student (MANI MANASVI GAVARA)', async () => {
    const res = await request('/auth/login', {
      method: 'POST',
      body: { jntuNo: '25331A05H7', password: 'Password@123' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    studentToken = res.body.token;
    student1Id = res.body.user.id;
    assert.ok(studentToken);
    assert.ok(student1Id);
  });

  const testDate = '2026-09-20'; // Clean test date

  // Cleanup any leftover data on testDate to ensure test repeatability
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  await prisma.messAttendance.deleteMany({ where: { date: testDate } });
  await prisma.messIndent.deleteMany({ where: { date: testDate } });
  await prisma.messToken.deleteMany({ where: { date: testDate } });
  await prisma.$disconnect();

  // 3. Security Checks
  await test('3. Security — Student rejected from management attendance API (403)', async () => {
    const res = await request('/management/mess/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { studentId: student1Id, date: testDate, mealType: 'LUNCH', status: 'ATE' },
    });
    assert.strictEqual(res.status, 403);
  });

  await test('4. Security — Unauthenticated request to student indent rejected (401)', async () => {
    const res = await request('/student/mess/indent', {
      method: 'POST',
      body: { mealType: 'LUNCH', date: testDate, status: 'MARKED' },
    });
    assert.strictEqual(res.status, 401);
  });

  // 4. Student Indent Creation and Verification
  await test('5. Student Indent — Student marks Lunch indent', async () => {
    const res = await request('/student/mess/indent', {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentToken}` },
      body: { mealType: 'LUNCH', date: testDate, status: 'MARKED' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.indent.indentMarked, true);
    assert.strictEqual(res.body.indent.status, 'MARKED');
  });

  await test('6. Student Indent — Student can view own indent status', async () => {
    const res = await request(`/student/mess/indent?date=${testDate}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const lunch = res.body.meals.find((m) => m.mealType === 'LUNCH');
    assert.ok(lunch);
    assert.strictEqual(lunch.indentMarked, true);
    assert.strictEqual(lunch.status, 'MARKED');

    // Dinner should be NOT_MARKED
    const dinner = res.body.meals.find((m) => m.mealType === 'DINNER');
    assert.ok(dinner);
    assert.strictEqual(dinner.indentMarked, false);
  });

  await test('7. Meal Independence — Lunch indent does not mark Dinner indent', async () => {
    const res = await request(`/student/mess/indent?date=${testDate}&mealType=DINNER`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.meals[0].mealType, 'DINNER');
    assert.strictEqual(res.body.meals[0].indentMarked, false);
  });

  // 5. Attendance Marking Screen: ALL eligible students displayed
  let eligibleStudents = [];
  await test('8. Attendance Screen — Displays ALL eligible students with indent status', async () => {
    const res = await request(`/management/mess/attendance-marking?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    eligibleStudents = res.body.students;
    assert.ok(eligibleStudents.length >= 4, 'Should have at least 4 eligible students');

    // Student 1 must have indent marked
    const s1 = eligibleStudents.find((s) => s.id === student1Id);
    assert.ok(s1, 'Student 1 must be present on attendance screen');
    assert.strictEqual(s1.indentMarked, true);
    assert.strictEqual(s1.attendanceStatus, 'PENDING');

    // Pick distinct students 2, 3, 4 who have no indents
    const otherStudents = eligibleStudents.filter((s) => s.id !== student1Id);
    student2Id = otherStudents[0].id;
    student3Id = otherStudents[1].id;
    student4Id = otherStudents[2].id;

    assert.strictEqual(otherStudents[0].indentMarked, false);
    assert.strictEqual(otherStudents[0].attendanceStatus, 'PENDING');
  });

  // 6. Test Four-Way Scenarios on testDate
  // Student 1 (MANI): Indented = YES -> mark Attendance = ATE (Category 1: Indented & Ate)
  await test('9. Attendance Marking — Mark Student 1 as ATE (Indented & Consumed)', async () => {
    const res = await request('/management/mess/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { studentId: student1Id, date: testDate, mealType: 'LUNCH', status: 'ATE' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.attendance.status, 'ATE');
  });

  // Student 2: Indented = NO -> mark Attendance = ATE (Category 2: Unindented & Consumed)
  await test('10. Attendance Marking — Mark Student 2 as ATE (Unindented & Consumed)', async () => {
    const res = await request('/management/mess/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { studentId: student2Id, date: testDate, mealType: 'LUNCH', status: 'ATE' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.attendance.status, 'ATE');
  });

  // Student 3: Mark Indent = YES -> mark Attendance = DID_NOT_EAT (Category 3: Indented & Not Consumed)
  await test('11. Attendance Marking — Mark Student 3 Indent YES and Attendance DID_NOT_EAT', async () => {
    // Create indent for Student 3 directly or via internal table
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.messIndent.upsert({
      where: { studentId_date_mealType: { studentId: student3Id, date: testDate, mealType: 'LUNCH' } },
      update: { status: 'MARKED' },
      create: { studentId: student3Id, date: testDate, mealType: 'LUNCH', status: 'MARKED' },
    });
    await prisma.$disconnect();

    const res = await request('/management/mess/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { studentId: student3Id, date: testDate, mealType: 'LUNCH', status: 'DID_NOT_EAT' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.attendance.status, 'DID_NOT_EAT');
  });

  // Student 4: Indent = NO -> mark Attendance = DID_NOT_EAT (Category 4: Unindented & Not Consumed)
  await test('12. Attendance Marking — Mark Student 4 Indent NO and Attendance DID_NOT_EAT', async () => {
    const res = await request('/management/mess/attendance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { studentId: student4Id, date: testDate, mealType: 'LUNCH', status: 'DID_NOT_EAT' },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.attendance.status, 'DID_NOT_EAT');
  });

  // 7. Four-Way Reconciliation Reports Verification
  await test('13. Reports — GET /reports/summary computes authoritative 4-way totals', async () => {
    const res = await request(`/management/mess/reports/summary?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    const sum = res.body.summary;

    assert.ok(sum.indentedAndAte >= 1, 'Expected at least 1 indented & ate');
    assert.ok(sum.unindentedAndAte >= 1, 'Expected at least 1 unindented & ate');
    assert.ok(sum.indentedAndNotConsumed >= 1, 'Expected at least 1 indented & not consumed');
    assert.ok(sum.unindentedAndNotConsumed >= 1, 'Expected at least 1 unindented & not consumed');

    // Mathematical integrity check: Category 1 + 2 + 3 + 4 + pending == total
    const totalCalc = sum.indentedAndAte + sum.unindentedAndAte + sum.indentedAndNotConsumed + sum.unindentedAndNotConsumed + sum.attendancePending;
    assert.strictEqual(totalCalc, sum.totalStudents, 'The 4 categories + pending must exactly equal totalStudents');
  });

  await test('14. Reports — Category 1: GET /reports/indented-ate returns correct student', async () => {
    const res = await request(`/management/mess/reports/indented-ate?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const records = res.body.records;
    const found = records.find((r) => r.id === student1Id);
    assert.ok(found, 'Student 1 must be in Indented & Ate report');
    assert.strictEqual(found.indentStatus, 'MARKED');
    assert.strictEqual(found.attendanceStatus, 'ATE');
  });

  await test('15. Reports — Category 2: GET /reports/no-indent-ate returns correct student', async () => {
    const res = await request(`/management/mess/reports/no-indent-ate?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const records = res.body.records;
    const found = records.find((r) => r.id === student2Id);
    assert.ok(found, 'Student 2 must be in No Indent & Ate report');
    assert.strictEqual(found.indentStatus, 'NOT_MARKED');
    assert.strictEqual(found.attendanceStatus, 'ATE');
  });

  await test('16. Reports — Category 3: GET /reports/indented-not-ate returns correct student', async () => {
    const res = await request(`/management/mess/reports/indented-not-ate?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const records = res.body.records;
    const found = records.find((r) => r.id === student3Id);
    assert.ok(found, 'Student 3 must be in Indented & Not Consumed report');
    assert.strictEqual(found.indentStatus, 'MARKED');
    assert.strictEqual(found.attendanceStatus, 'DID_NOT_EAT');
  });

  await test('17. Reports — Category 4: GET /reports/no-indent-not-ate returns correct student', async () => {
    const res = await request(`/management/mess/reports/no-indent-not-ate?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert.strictEqual(res.status, 200);
    const records = res.body.records;
    const found = records.find((r) => r.id === student4Id);
    assert.ok(found, 'Student 4 must be in No Indent & Not Consumed report');
    assert.strictEqual(found.indentStatus, 'NOT_MARKED');
    assert.strictEqual(found.attendanceStatus, 'DID_NOT_EAT');
  });

  // 8. Pending Attendance Is Not Treated As DID_NOT_EAT
  await test('18. Pending State — Pending student is NOT in any of the four finalized reports', async () => {
    // Pick another student who is still PENDING
    const pendingStudent = eligibleStudents.find(
      (s) => s.id !== student1Id && s.id !== student2Id && s.id !== student3Id && s.id !== student4Id
    );
    if (pendingStudent) {
      const resAte = await request(`/management/mess/reports/indented-ate?date=${testDate}&mealType=LUNCH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resNoIndentAte = await request(`/management/mess/reports/no-indent-ate?date=${testDate}&mealType=LUNCH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resIndentNot = await request(`/management/mess/reports/indented-not-ate?date=${testDate}&mealType=LUNCH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const resNoIndentNot = await request(`/management/mess/reports/no-indent-not-ate?date=${testDate}&mealType=LUNCH`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });

      const inAny = [
        ...resAte.body.records,
        ...resNoIndentAte.body.records,
        ...resIndentNot.body.records,
        ...resNoIndentNot.body.records,
      ].some((r) => r.id === pendingStudent.id);

      assert.strictEqual(inAny, false, 'Pending student must not appear in finalized four reports');
    }
  });

  // 9. Attendance Correction (PATCH)
  await test('19. Attendance Correction — Operator corrects Student 4 to ATE', async () => {
    // Find attendance ID for student 4
    const resSheet = await request(`/management/mess/attendance-marking?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const s4Record = resSheet.body.students.find((s) => s.id === student4Id);
    assert.ok(s4Record.attendanceId, 'Student 4 must have an attendanceId');

    const resPatch = await request(`/management/mess/attendance/${s4Record.attendanceId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { status: 'ATE' },
    });
    assert.strictEqual(resPatch.status, 200);
    assert.strictEqual(resPatch.body.attendance.status, 'ATE');

    // Student 4 should now be in No Indent & Ate (Category 2)
    const resCat2 = await request(`/management/mess/reports/no-indent-ate?date=${testDate}&mealType=LUNCH`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const foundS4 = resCat2.body.records.find((r) => r.id === student4Id);
    assert.ok(foundS4, 'Student 4 should now be classified as Unindented & Consumed');
  });

  // 10. Export Tests
  await test('20. Export CSV — GET /reports/export?format=csv returns valid CSV file stream', async () => {
    const res = await request(
      `/management/mess/reports/export?category=indented-ate&date=${testDate}&mealType=LUNCH&format=csv`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/csv'));
    assert.ok(res.headers['content-disposition'].includes(`mess_indented_ate_${testDate}_lunch.csv`));

    const csvStr = res.body.toString('utf8');
    assert.ok(csvStr.includes('Student ID / Roll Number'));
    assert.ok(csvStr.includes('Attendance Status'));
    assert.ok(csvStr.includes('MANI MANASVI GAVARA'));
  });

  await test('21. Export XLSX — GET /reports/export?format=xlsx returns valid Excel spreadsheet', async () => {
    const res = await request(
      `/management/mess/reports/export?category=indented-ate&date=${testDate}&mealType=LUNCH&format=xlsx`,
      { headers: { Authorization: `Bearer ${adminToken}` } }
    );
    assert.strictEqual(res.status, 200);
    assert.ok(res.headers['content-type'].includes('spreadsheetml'));
    assert.ok(res.headers['content-disposition'].includes(`mess_indented_ate_${testDate}_lunch.xlsx`));
    assert.ok(Buffer.isBuffer(res.body) && res.body.length > 100);

    // Parse with XLSX to ensure data integrity
    const XLSX = require('xlsx');
    const workbook = XLSX.read(res.body, { type: 'buffer' });
    const sheet = workbook.Sheets['Reconciliation Report'];
    assert.ok(sheet, 'Workbook must contain Reconciliation Report sheet');
    const data = XLSX.utils.sheet_to_json(sheet);
    assert.ok(data.length >= 1);
    assert.ok(
      data.some((r) => r['Student Name'] === 'MANI MANASVI GAVARA'),
      'MANI MANASVI GAVARA must be present in exported Excel rows'
    );
  });

  console.log('\n========================================================');
  console.log(`  RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
