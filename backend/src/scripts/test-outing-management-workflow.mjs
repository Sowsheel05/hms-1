import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runTest() {
  console.log('=== HMS OUTING REQUEST MANAGEMENT WORKFLOW VERIFICATION ===\n');

  // Ensure test accounts have no ongoing uncompleted outings before fresh run
  const testStudent1 = await prisma.student.findUnique({ where: { jntuNo: '25331A05H7' } });
  const testStudent2 = await prisma.student.findUnique({ where: { jntuNo: '25331A05H8' } });

  if (testStudent1) {
    await prisma.outingRequest.updateMany({
      where: { studentId: testStudent1.id, status: { in: ['PENDING', 'APPROVED', 'OUT'] } },
      data: { status: 'RETURNED' },
    });
  }
  if (testStudent2) {
    await prisma.outingRequest.updateMany({
      where: { studentId: testStudent2.id, status: { in: ['PENDING', 'APPROVED', 'OUT'] } },
      data: { status: 'RETURNED' },
    });
  }
  console.log('✓ Prepared test accounts in clean state.');

  // 1. Authenticate Student
  console.log('\nStep 1: Authenticating Student (25331A05H7)...');
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jntuNo: '25331A05H7',
      password: 'Password@123',
    }),
  });

  const studentLoginData = await studentLoginRes.json();
  if (!studentLoginRes.ok || !studentLoginData.token) {
    console.error('Student login failed:', studentLoginData);
    process.exit(1);
  }
  const studentToken = studentLoginData.token;
  console.log('✓ Student authenticated successfully. Name:', studentLoginData.user?.name);

  // 2. Student Submits Outing Request
  console.log('\nStep 2: Student raises an Outing Request...');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const outDate = new Date(tomorrow.getTime() + 2 * 60 * 60 * 1000).toISOString();
  const returnDate = new Date(tomorrow.getTime() + 6 * 60 * 60 * 1000).toISOString();

  const createReqRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Hyderabad Hitech City',
      purpose: 'Technical book purchase & project material',
      outDate,
      returnDate,
      emergencyContact: '9876543210',
    }),
  });

  const createReqData = await createReqRes.json();
  if (!createReqRes.ok) {
    console.error('Failed to create outing request:', createReqData);
    process.exit(1);
  }
  const outing1 = createReqData.request || createReqData.data;
  const outing1Id = outing1?.id;
  console.log(`✓ Outing Request #1 created with ID: ${outing1Id}`);
  console.log(`✓ Initial Status: ${outing1?.status}`);
  if (outing1?.status !== 'PENDING') {
    throw new Error(`Expected PENDING status, got ${outing1?.status}`);
  }

  // 3. Authenticate Admin
  console.log('\nStep 3: Authenticating Admin (ADMIN01)...');
  const adminLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'ADMIN01',
      password: 'Password@123',
    }),
  });

  const adminLoginData = await adminLoginRes.json();
  if (!adminLoginRes.ok || !adminLoginData.token) {
    console.error('Admin login failed:', adminLoginData);
    process.exit(1);
  }
  const adminToken = adminLoginData.token;
  console.log('✓ Admin authenticated successfully.');

  // 4. Admin List Outings
  console.log('\nStep 4: Admin views Outing Requests list...');
  const listRes = await fetch(`${BASE_URL}/management/outings?status=PENDING`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const listData = await listRes.json();
  if (!listRes.ok) {
    console.error('Failed to list outings:', listData);
    process.exit(1);
  }
  const items = Array.isArray(listData.data) ? listData.data : (listData.data?.items || []);
  const foundOuting1 = items.find((o) => o.id === outing1Id);
  console.log(`✓ Outing appears in Admin List. Total pending: ${items.length}`);
  if (!foundOuting1) {
    throw new Error('Created outing not found in Admin pending list');
  }
  console.log(`✓ Destination: ${foundOuting1.destination}, Student: ${foundOuting1.student?.name}`);

  // 5. Admin Clicks [ Manage ] -> Fetches Detail
  console.log('\nStep 5: Admin clicks [ Manage ] to view complete Outing Pass details...');
  const detailRes = await fetch(`${BASE_URL}/management/outings/${outing1Id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const detailData = await detailRes.json();
  if (!detailRes.ok) {
    console.error('Failed to get outing detail:', detailData);
    process.exit(1);
  }
  const detail = detailData.data;
  console.log('✓ Manage Details loaded:');
  console.log('  - Student Name:', detail.student?.name);
  console.log('  - Student JNTU No:', detail.student?.jntuNo);
  console.log('  - Room / Bed:', `${detail.student?.roomNumber} / ${detail.student?.bedNumber}`);
  console.log('  - Branch / Year / Sec:', `${detail.student?.department} / ${detail.student?.year} / ${detail.student?.section}`);
  console.log('  - Parent Name:', detail.student?.parentName);
  console.log('  - Parent Relation:', detail.student?.parentRelation);
  console.log('  - MANDATORY Parent Phone:', detail.student?.parentPhone);
  console.log('  - Emergency Contact:', detail.student?.emergencyContact || detail.emergencyContact);
  console.log('  - Outing Destination:', detail.destination);
  console.log('  - Outing Purpose:', detail.purpose);
  console.log('  - Current Status:', detail.status);

  if (!detail.student?.parentPhone) {
    throw new Error('MANDATORY REQUIREMENT FAILED: parentPhone is missing from Manage details!');
  }

  // 6. Admin Approves Request
  console.log('\nStep 6: Admin clicks [ Approve ] inside Manage modal...');
  const approveRes = await fetch(`${BASE_URL}/management/outings/${outing1Id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({}),
  });
  const approveData = await approveRes.json();
  if (!approveRes.ok) {
    console.error('Failed to approve outing:', approveData);
    process.exit(1);
  }
  console.log('✓ Admin Approved Outing:', approveData.message);
  console.log('  - Status after approval:', approveData.data?.status);
  console.log('  - Reviewed By:', approveData.data?.approvedBy);
  console.log('  - Reviewed At:', approveData.data?.approvedAt);

  // 7. Student Portal Reflects Decision
  console.log('\nStep 7: Student portal verifies APPROVED status reflection...');
  const studentCheckRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentCheckData = await studentCheckRes.json();
  const studentPass1 = studentCheckData.requests?.find((r) => r.id === outing1Id);
  console.log('✓ Student Portal reflects Outing Pass #1 status:', studentPass1?.status);
  if (studentPass1?.status !== 'APPROVED') {
    throw new Error(`Expected student portal to show APPROVED, got ${studentPass1?.status}`);
  }

  // 8. Workflow Test for Rejection (using Student 2: 25331A05H8)
  console.log('\nStep 8: Authenticating Student 2 (25331A05H8) for Rejection test...');
  const student2LoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jntuNo: '25331A05H8',
      password: 'Password@123',
    }),
  });
  const student2LoginData = await student2LoginRes.json();
  if (!student2LoginRes.ok || !student2LoginData.token) {
    console.error('Student 2 login failed:', student2LoginData);
    process.exit(1);
  }
  const student2Token = student2LoginData.token;
  console.log('✓ Student 2 authenticated successfully. Name:', student2LoginData.user?.name);

  // Cancel any previous pending request for student 2 if present
  const student2Existing = await (await fetch(`${BASE_URL}/student/outing-requests`, {
    headers: { Authorization: `Bearer ${student2Token}` },
  })).json();
  const student2Pending = student2Existing.requests?.find(r => r.status === 'PENDING');
  if (student2Pending) {
    await fetch(`${BASE_URL}/student/outing-requests/${student2Pending.id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${student2Token}` },
    });
  }

  console.log('Student 2 raises Outing Request #2...');
  const createReq2Res = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${student2Token}`,
    },
    body: JSON.stringify({
      passType: 'NIGHT_OUT',
      destination: 'Vijayawada Outstation',
      purpose: 'Weekend family function',
      outDate,
      returnDate,
      emergencyContact: '9123456780',
    }),
  });
  const createReq2Data = await createReq2Res.json();
  if (!createReq2Res.ok) {
    console.error('Failed to create outing request 2:', createReq2Data);
    process.exit(1);
  }
  const outing2 = createReq2Data.request || createReq2Data.data;
  const outing2Id = outing2?.id;
  console.log(`✓ Outing Request #2 created with ID: ${outing2Id}, Status: ${outing2?.status}`);

  console.log('\nStep 9: Admin opens Manage -> clicks [ Reject ] with reason...');
  const rejectionReasonText = 'Night out passes are restricted this weekend due to mid-semester exams.';
  const rejectRes = await fetch(`${BASE_URL}/management/outings/${outing2Id}/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({ reason: rejectionReasonText }),
  });
  const rejectData = await rejectRes.json();
  if (!rejectRes.ok) {
    console.error('Failed to reject outing:', rejectData);
    process.exit(1);
  }
  console.log('✓ Admin Rejected Outing:', rejectData.message);
  console.log('  - Status after rejection:', rejectData.data?.status);
  console.log('  - Rejection Reason recorded:', rejectData.data?.rejectionReason);
  console.log('  - Reviewed By:', rejectData.data?.rejectedBy);

  // 10. Student Portal Reflects Rejection & Reason
  console.log('\nStep 10: Student portal verifies REJECTED status & reason reflection...');
  const studentCheck2Res = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  const studentCheck2Data = await studentCheck2Res.json();
  const studentPass2 = studentCheck2Data.requests?.find((r) => r.id === outing2Id);
  console.log('✓ Student Portal reflects Outing Pass #2 status:', studentPass2?.status);
  console.log('✓ Student Portal displays Rejection Reason:', studentPass2?.rejectionReason);

  if (studentPass2?.status !== 'REJECTED') {
    throw new Error(`Expected student portal to show REJECTED, got ${studentPass2?.status}`);
  }
  if (studentPass2?.rejectionReason !== rejectionReasonText) {
    throw new Error('Rejection reason does not match!');
  }

  // 11. Security / RBAC / IDOR Verification
  console.log('\nStep 11: Testing RBAC & IDOR security enforcement...');
  const idorRes1 = await fetch(`${BASE_URL}/management/outings`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log('  - Student accessing /management/outings HTTP status:', idorRes1.status);
  if (idorRes1.status !== 401 && idorRes1.status !== 403) {
    throw new Error(`Security violation: student accessed /management/outings with status ${idorRes1.status}`);
  }

  const idorRes2 = await fetch(`${BASE_URL}/management/outings/${outing1Id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({}),
  });
  console.log('  - Student accessing /management/outings/:id/approve HTTP status:', idorRes2.status);
  if (idorRes2.status !== 401 && idorRes2.status !== 403) {
    throw new Error(`Security violation: student accessed /management/outings/:id/approve with status ${idorRes2.status}`);
  }
  console.log('✓ RBAC & IDOR controls strictly enforced (401/403 returned).');

  console.log('\n🎉 ALL 11 OUTING REQUEST WORKFLOW ACCEPTANCE CRITERIA VERIFIED SUCCESSFULLY!');
}

runTest().catch((err) => {
  console.error('\n❌ Test execution failed:', err);
  process.exit(1);
});
