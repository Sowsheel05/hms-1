import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BASE_URL = 'http://localhost:5001/api';

async function runNewOutingTest() {
  console.log('===============================================================');
  console.log('       HMS NEW OUTING REQUEST TEST & VERIFICATION SUITE        ');
  console.log('===============================================================\n');

  const studentJntu = '25331A05K1';
  const studentPassword = 'Password123';

  // 0. Clean up any ongoing outings for student to start clean
  console.log(`[Phase 0] Preparing clean slate for student ${studentJntu}...`);
  const studentInDb = await prisma.student.findUnique({
    where: { jntuNo: studentJntu },
    include: { hostelApplications: { orderBy: { createdAt: 'desc' }, take: 1 } },
  });

  if (!studentInDb) {
    throw new Error(`Student ${studentJntu} not found in database. Please run seed/workflow first.`);
  }

  // Clear any existing outings for this student to ensure a fresh test
  await prisma.outingRequest.deleteMany({
    where: { studentId: studentInDb.id },
  });
  console.log(`✓ Cleared previous outing records for ${studentInDb.name} (${studentInDb.jntuNo}).`);
  console.log(`  Room: ${studentInDb.roomNumber}, Block: ${studentInDb.blockName}, Bed: ${studentInDb.bedNumber}\n`);

  // 1. Student Login
  console.log('[Phase 1] Student Authenticates into Portal...');
  const studentLoginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: studentJntu, password: studentPassword }),
  });
  const studentLoginData = await studentLoginRes.json();
  if (!studentLoginRes.ok || !studentLoginData.token) {
    throw new Error(`Student login failed: ${JSON.stringify(studentLoginData)}`);
  }
  const studentToken = studentLoginData.token;
  console.log(`✓ Logged in as Student: ${studentLoginData.user.name} (${studentLoginData.user.jntuNo})`);
  console.log(`  Allocation Status: ${studentLoginData.user.role}, Room: ${studentLoginData.user.roomNumber}\n`);

  // 2. Check initial outing summary
  console.log('[Phase 2] Fetching initial student outing dashboard...');
  const initialSummaryRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const initialSummary = await initialSummaryRes.json();
  console.log(`  Current Status: ${initialSummary.summary?.currentStatus}`);
  console.log(`  Remaining This Month: ${initialSummary.summary?.remainingThisMonth} / ${initialSummary.summary?.monthlyLimit}`);
  console.log(`  Pending Requests: ${initialSummary.summary?.pendingCount}\n`);

  // 3. Student Submits a Brand New Outing Request
  console.log('[Phase 3] Student submits a NEW Outing Request...');
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const departureDate = new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString();
  const returnDate = new Date(tomorrow.setHours(19, 30, 0, 0)).toISOString();

  const newOutingPayload = {
    passType: 'LOCAL_OUTING',
    destination: 'Inorbit Mall & Electronics Mart, HITEC City',
    purpose: 'Procuring Arduino sensor kits, jumper cables, and reference textbooks',
    emergencyContact: '9876543210',
    outDate: departureDate,
    returnDate: returnDate,
    remarks: 'Will return to hostel before 8:00 PM check-in.',
  };

  const createRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify(newOutingPayload),
  });

  const createData = await createRes.json();
  console.log(`  HTTP Status: ${createRes.status}`);
  console.log(`  Response:`, createData);

  if (!createRes.ok || !createData.success) {
    throw new Error(`Failed to submit outing request: ${JSON.stringify(createData)}`);
  }

  const createdOuting = createData.request || createData.outing;
  console.log(`✓ Outing Request submitted successfully!`);
  console.log(`  Outing ID: ${createdOuting.id}`);
  console.log(`  Request Number: ${createdOuting.requestNumber || 'N/A'}`);
  console.log(`  Status: ${createdOuting.status}`);
  console.log(`  Destination: ${createdOuting.destination}`);
  console.log(`  Out Date: ${new Date(createdOuting.outDate).toLocaleString()}`);
  console.log(`  Return Date: ${new Date(createdOuting.returnDate).toLocaleString()}\n`);

  // 4. Student verifies pending status in portal
  console.log('[Phase 4] Verifying Student Portal reflects PENDING status...');
  const studentListRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentListData = await studentListRes.json();
  const fetchedRequest = studentListData.requests?.find((r) => r.id === createdOuting.id);
  if (!fetchedRequest || fetchedRequest.status !== 'PENDING') {
    throw new Error(`Outing request not found in student list with PENDING status!`);
  }
  console.log(`✓ Student Portal reflects Outing Request status: ${fetchedRequest.status}`);
  console.log(`  Student Dashboard Status: "${studentListData.summary?.currentStatus}"\n`);

  // 5. Admin logs into Management Portal
  console.log('[Phase 5] Admin Logs in (ADMIN01)...');
  const adminLoginRes = await fetch(`${BASE_URL}/management/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
  });
  const adminLoginData = await adminLoginRes.json();
  if (!adminLoginRes.ok || !adminLoginData.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLoginData)}`);
  }
  const adminToken = adminLoginData.token;
  console.log(`✓ Admin authenticated. Name: ${adminLoginData.user?.name || adminLoginData.user?.username}\n`);

  // 6. Admin checks Outing Requests list
  console.log('[Phase 6] Admin views Outing Requests queue (/api/management/outings)...');
  const adminListRes = await fetch(`${BASE_URL}/management/outings?status=PENDING`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const adminListData = await adminListRes.json();
  const outingsList = adminListData.data || adminListData.outings || [];
  const outingInAdminQueue = outingsList.find((o) => o.id === createdOuting.id);

  if (!outingInAdminQueue) {
    throw new Error(`Outing ${createdOuting.id} not found in Admin PENDING queue! Total items: ${outingsList.length}`);
  }
  console.log(`✓ Outing Request appeared in Admin Queue:`);
  console.log(`  Outing ID: ${outingInAdminQueue.id}`);
  console.log(`  Student: ${outingInAdminQueue.student?.name} (${outingInAdminQueue.student?.jntuNo})`);
  console.log(`  Room: ${outingInAdminQueue.student?.roomNumber} (${outingInAdminQueue.student?.blockName})`);
  console.log(`  Destination: ${outingInAdminQueue.destination}`);
  console.log(`  Pass Type: ${outingInAdminQueue.passType}\n`);

  // 7. Admin clicks [ Manage ] to view full details (including Guardian verification)
  console.log('[Phase 7] Admin inspects Manage Outing Pass modal details (/api/management/outings/:id)...');
  const manageRes = await fetch(`${BASE_URL}/management/outings/${createdOuting.id}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const manageData = await manageRes.json();
  if (!manageRes.ok || !manageData.success) {
    throw new Error(`Failed to load Manage details: ${JSON.stringify(manageData)}`);
  }

  const details = manageData.data || manageData.outing;
  console.log(`✓ Manage Modal Details Loaded:`);
  console.log(`  - Student Name: ${details.student?.name}`);
  console.log(`  - Student JNTU No: ${details.student?.jntuNo}`);
  console.log(`  - Room / Bed: Room ${details.student?.roomNumber} / ${details.student?.bedNumber}`);
  console.log(`  - Block / Hostel: ${details.student?.blockName}`);
  console.log(`  - Guardian Name: ${details.student?.parentName || details.guardian?.name || 'N/A'}`);
  console.log(`  - Guardian Relation: ${details.student?.parentRelation || details.guardian?.relation || 'N/A'}`);
  console.log(`  - MANDATORY PARENT PHONE FOR VERIFICATION: ${details.student?.parentPhone || details.guardian?.phone || 'N/A'}`);
  console.log(`  - Emergency Contact: ${details.emergencyContact || details.student?.emergencyContact || 'N/A'}`);
  console.log(`  - Purpose: ${details.purpose}`);
  console.log(`  - Destination: ${details.destination}\n`);

  // 8. Admin approves the Outing Pass inside the Manage modal
  console.log('[Phase 8] Admin clicks [ Approve ] inside Manage modal...');
  const approveRes = await fetch(`${BASE_URL}/management/outings/${createdOuting.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      remarks: 'Verified parent confirmation call. Approved for project supplies.',
    }),
  });
  const approveData = await approveRes.json();
  console.log(`  HTTP Status: ${approveRes.status}`);
  console.log(`  Response:`, approveData);

  if (!approveRes.ok || !approveData.success) {
    throw new Error(`Failed to approve outing: ${JSON.stringify(approveData)}`);
  }
  const approvedItem = approveData.data || approveData.outing;
  console.log(`✓ Admin successfully approved Outing Pass!`);
  console.log(`  Status after approval: ${approvedItem?.status}`);
  console.log(`  Approved By: ${approvedItem?.approvedBy}`);
  console.log(`  Approved At: ${approvedItem?.approvedAt}\n`);

  // 9. Student Portal verifies real-time status update to APPROVED
  console.log('[Phase 9] Student Portal verifies real-time reflection of APPROVED status...');
  const studentVerifyRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  const studentVerifyData = await studentVerifyRes.json();
  const approvedOuting = studentVerifyData.requests?.find((r) => r.id === createdOuting.id);

  if (!approvedOuting || approvedOuting.status !== 'APPROVED') {
    throw new Error(`Expected status APPROVED but got: ${approvedOuting?.status}`);
  }
  console.log(`✓ Student Portal reflects updated status:`);
  console.log(`  Outing ID: ${approvedOuting.id}`);
  console.log(`  Status: ${approvedOuting.status}`);
  console.log(`  Approved By: ${approvedOuting.approvedBy}`);
  console.log(`  Approved At: ${new Date(approvedOuting.approvedAt).toLocaleString()}`);
  console.log(`  Portal Summary Current Status: "${studentVerifyData.summary?.currentStatus}"\n`);

  // 10. Business Constraint Verification: Prevent duplicate active outing
  console.log('[Phase 10] Testing duplicate active outing prevention (Conflict rule)...');
  const duplicateAttemptRes = await fetch(`${BASE_URL}/student/outing-requests`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify(newOutingPayload),
  });
  const duplicateAttemptData = await duplicateAttemptRes.json();
  console.log(`  Duplicate attempt HTTP Status: ${duplicateAttemptRes.status}`);
  console.log(`  Message: "${duplicateAttemptData.message}"`);
  if (duplicateAttemptRes.status === 409) {
    console.log(`✓ Correctly rejected duplicate outing request with 409 Conflict!\n`);
  } else {
    throw new Error(`Expected 409 Conflict but received ${duplicateAttemptRes.status}`);
  }

  // 11. Security Verification: Student cannot approve outing passes (RBAC)
  console.log('[Phase 11] Testing RBAC: Student token cannot access admin approval endpoint...');
  const rbacRes = await fetch(`${BASE_URL}/management/outings/${createdOuting.id}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({ remarks: 'Hacked attempt' }),
  });
  console.log(`  Student attempt HTTP Status: ${rbacRes.status}`);
  if (rbacRes.status === 401 || rbacRes.status === 403) {
    console.log(`✓ RBAC strictly enforced: Unauthorized access blocked (${rbacRes.status}).\n`);
  } else {
    throw new Error(`Expected 401 or 403 but received ${rbacRes.status}`);
  }

  console.log('===============================================================');
  console.log('🎉 ALL NEW OUTING REQUEST TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================');
}

runNewOutingTest()
  .catch((err) => {
    console.error('\n❌ TEST FAILED:', err);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });
