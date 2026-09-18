import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:5001/api';

async function runTest() {
  console.log('=== STARTING END-TO-END WORKFLOW VERIFICATION ===\n');

  const testRollNo = '25331A05K1';
  const testPassword = 'Password123';
  const testEmail = 'vikram.k1@example.com';

  // 0. Clean up test student if existed from previous run
  console.log(`[0] Checking and cleaning existing test records for ${testRollNo}...`);
  const existingStudent = await prisma.student.findUnique({ where: { jntuNo: testRollNo } });
  if (existingStudent) {
    await prisma.roomAllocation.deleteMany({ where: { studentId: existingStudent.id } });
    await prisma.hostelApplication.deleteMany({ where: { studentId: existingStudent.id } });
    await prisma.notification.deleteMany({ where: { studentId: existingStudent.id } });
    await prisma.activityLog.deleteMany({ where: { entityId: existingStudent.id } });
    await prisma.session.deleteMany({ where: { studentId: existingStudent.id } });
    await prisma.student.delete({ where: { id: existingStudent.id } });
    console.log('    Cleaned up previous test records.');
  }

  // 1. Submit 4-step Student Registration via public API
  console.log('\n[1] Submitting public Student Registration (4 Steps)...');
  const regPayload = {
    name: 'Vikram Sharma',
    dob: '2005-04-12',
    gender: 'Male',
    phone: '9876543299',
    email: testEmail,
    password: testPassword,
    jntuNo: testRollNo,
    branch: 'Computer Science and Engineering',
    yearOfStudy: '1st Year',
    section: 'A',
    semester: 'Semester 1',
    guardianName: 'Ramesh Sharma',
    guardianRelation: 'Father',
    guardianPhone: '9876543210',
    emergencyContact: '9876543211',
    address: 'Flat 402, Sai Residency, Jubilee Hills, Hyderabad',
    preferredBlock: 'Block A (Boys)',
    preferredRoomType: 'Non-AC Room (2 Sharing)',
    preferredFloor: 2,
    stayDuration: 'Academic Year (10 Months)',
    foodPreference: 'VEG',
    medicalConditions: 'None',
  };

  const regRes = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(regPayload)
  });
  const regJson = await regRes.json();
  console.log('    Registration response:', regRes.status, regJson.success, regJson.message);
  console.log('    Application Number:', regJson.application?.applicationNumber || regJson.applicationId);
  if (!regRes.ok || !regJson.success) {
    throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  }

  // 2. Check Database Record for newly registered student
  console.log('\n[2] Checking Database Record for newly registered student...');
  const studentDb = await prisma.student.findUnique({
    where: { jntuNo: testRollNo },
    include: { hostelApplications: true }
  });
  console.log('    Student in DB:', {
    id: studentDb?.id,
    name: studentDb?.name,
    jntuNo: studentDb?.jntuNo,
    isActive: studentDb?.isActive,
    allocationStatus: studentDb?.allocationStatus,
    applicationsCount: studentDb?.hostelApplications.length,
    applicationStatus: studentDb?.hostelApplications[0]?.status,
  });

  if (!studentDb || studentDb.isActive !== false || studentDb.allocationStatus !== 'PENDING') {
    throw new Error('Student state assertion failed: Student must exist, isActive=false, allocationStatus=PENDING');
  }

  // 3. Test Student Login while PENDING -> Must be rejected!
  console.log('\n[3] Testing Student Login while PENDING (must NOT have portal access)...');
  const pendingLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: testRollNo, password: testPassword })
  });
  const pendingLoginJson = await pendingLoginRes.json();
  if (pendingLoginRes.ok && pendingLoginJson.success) {
    throw new Error('FAILED: Student was able to log in while PENDING!');
  } else {
    console.log('    Login rejected as expected:', pendingLoginRes.status, pendingLoginJson.message);
  }

  // 4. Admin Login
  console.log('\n[4] Admin Logging into Management Portal...');
  const adminLoginRes = await fetch(`${API_BASE}/management/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' })
  });
  const adminLoginJson = await adminLoginRes.json();
  const adminToken = adminLoginJson.token;
  if (!adminToken) throw new Error(`Admin login failed: ${JSON.stringify(adminLoginJson)}`);
  console.log('    Admin logged in successfully. Token acquired.');

  // 5. Admin checks Room Allocation -> Pending Registrations
  console.log('\n[5] Admin checks Room Allocation -> Pending Registrations list...');
  const pendingRes = await fetch(`${API_BASE}/management/rooms/allocations/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const pendingJson = await pendingRes.json();
  console.log('    Total Pending Allocations in Room Allocation:', pendingJson.pendingCount);
  const foundPending = pendingJson.data?.find((item) => item.jntuNo === testRollNo);
  if (!foundPending) {
    throw new Error(`CRITICAL FAILURE: Student ${testRollNo} NOT visible in Room Allocation pending list!`);
  }
  console.log('    SUCCESS: Registered student flows directly into Room Allocation:');
  console.log('      Name:', foundPending.name);
  console.log('      JNTU:', foundPending.jntuNo);
  console.log('      DOB:', foundPending.dob);
  console.log('      Gender:', foundPending.gender);
  console.log('      Course:', foundPending.courseInfo);
  console.log('      Guardian:', foundPending.guardianInfo);
  console.log('      Preferences:', foundPending.preferences);

  // 6. Find an active room with vacancy for allocation
  console.log('\n[6] Finding active room with vacancy...');
  const roomsRes = await fetch(`${API_BASE}/management/rooms`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const roomsJson = await roomsRes.json();
  const rooms = roomsJson.rooms || roomsJson.data || [];
  const availableRoom = rooms.find((r) => r.status === 'ACTIVE' && r.occupancy < r.capacity);
  if (!availableRoom) {
    throw new Error('No room with vacancy available to test allocation.');
  }
  console.log(`    Selected Room: ${availableRoom.roomNumber} (${availableRoom.block?.name || 'Block'}), Capacity: ${availableRoom.capacity}, Current Occupancy: ${availableRoom.occupancy}`);

  // 7. Admin performs Accept & Allocate
  console.log('\n[7] Admin performs ACCEPT & ALLOCATE in Room Allocation Module...');
  const allocRes = await fetch(`${API_BASE}/management/rooms/allocations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      roomId: availableRoom.id,
      studentId: studentDb.id,
    })
  });
  const allocJson = await allocRes.json();
  console.log('    Allocation Response:', allocRes.status, allocJson.success, allocJson.message);
  if (!allocRes.ok || !allocJson.success) {
    throw new Error(`Allocation failed: ${JSON.stringify(allocJson)}`);
  }

  // 8. Verify Database State after allocation (Atomic Transaction Verification)
  console.log('\n[8] Verifying Database State after Accept & Allocate...');
  const studentAfterAlloc = await prisma.student.findUnique({
    where: { id: studentDb.id },
    include: {
      hostelApplications: true,
      roomAllocations: { include: { room: { include: { block: true } } } }
    }
  });
  console.log('    Student after allocation in DB:', {
    isActive: studentAfterAlloc?.isActive,
    allocationStatus: studentAfterAlloc?.allocationStatus,
    roomNumber: studentAfterAlloc?.roomNumber,
    blockName: studentAfterAlloc?.blockName,
    bedNumber: studentAfterAlloc?.bedNumber,
    applicationStatus: studentAfterAlloc?.hostelApplications[0]?.status,
    allocatedRoomNumber: studentAfterAlloc?.roomAllocations[0]?.room?.roomNumber,
  });

  if (
    !studentAfterAlloc?.isActive ||
    studentAfterAlloc?.allocationStatus !== 'ALLOCATED' ||
    studentAfterAlloc?.hostelApplications[0]?.status !== 'APPROVED' ||
    studentAfterAlloc?.roomAllocations.length === 0
  ) {
    throw new Error('FAILED: Allocation did not update student to active/allocated or did not approve application!');
  }

  // Check room occupancy increment via active allocations count
  const activeAllocCount = await prisma.roomAllocation.count({
    where: { roomId: availableRoom.id, status: 'ACTIVE' }
  });
  console.log(`    Room Active Occupancy in DB: was ${availableRoom.occupancy}, now ${activeAllocCount}`);
  if (activeAllocCount !== availableRoom.occupancy + 1) {
    throw new Error('FAILED: Room active allocation count was not incremented!');
  }

  // Check Activity Log
  const activity = await prisma.activityLog.findFirst({
    where: { action: 'ALLOCATE' },
    orderBy: { createdAt: 'desc' }
  });
  console.log('    Activity Log created:', activity?.action, activity?.description);

  // Check pending list count decremented
  const pendingResAfter = await fetch(`${API_BASE}/management/rooms/allocations/pending`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const pendingJsonAfter = await pendingResAfter.json();
  const foundInPendingAfter = pendingJsonAfter.data?.find((item) => item.jntuNo === testRollNo);
  if (foundInPendingAfter) {
    throw new Error('FAILED: Allocated student still shows in Pending Registrations!');
  }
  console.log(`    Pending count updated: was ${pendingJson.pendingCount}, now ${pendingJsonAfter.pendingCount}`);

  // 9. Student Login to Existing Student Portal
  console.log('\n[9] Testing Student Login after Accept & Allocate...');
  const studentLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: testRollNo, password: testPassword })
  });
  const studentLoginJson = await studentLoginRes.json();
  console.log('    Student Login Result:', studentLoginRes.status, studentLoginJson.success);
  if (!studentLoginRes.ok || !studentLoginJson.success) {
    throw new Error(`Student login failed after approval: ${JSON.stringify(studentLoginJson)}`);
  }
  const studentToken = studentLoginJson.token;
  const loggedStudent = studentLoginJson.user;
  console.log('    Logged in student details from token:', {
    name: loggedStudent?.name,
    jntuNo: loggedStudent?.jntuNo,
    blockName: loggedStudent?.blockName,
  });

  // 10. Access Student Portal Profile & Data
  console.log('\n[10] Testing Student Portal access (/api/auth/me)...');
  const profileRes = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${studentToken}` }
  });
  const profileJson = await profileRes.json();
  console.log('    Student /api/auth/me response:', profileRes.status, {
    name: profileJson.student?.name,
    roomNumber: profileJson.student?.roomNumber,
    blockName: profileJson.student?.blockName,
    allocationStatus: profileJson.student?.allocationStatus,
  });

  // 11. Test REJECTION Workflow on a second registration
  console.log('\n[11] Testing REJECTION workflow on a separate candidate...');
  const rejectRollNo = '25331A05K2';
  const existingReject = await prisma.student.findUnique({ where: { jntuNo: rejectRollNo } });
  if (existingReject) {
    await prisma.hostelApplication.deleteMany({ where: { studentId: existingReject.id } });
    await prisma.student.delete({ where: { id: existingReject.id } });
  }

  const reg2Res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Rajesh Varma',
      dob: '2005-06-15',
      gender: 'Male',
      phone: '9876543288',
      email: 'rajesh.k2@example.com',
      password: 'Password123',
      jntuNo: rejectRollNo,
      branch: 'AIML',
      yearOfStudy: '1st Year',
      section: 'B',
      semester: 'Semester 1',
      guardianName: 'Suresh Varma',
      guardianRelation: 'Father',
      guardianPhone: '9876543220',
      emergencyContact: '9876543221',
      address: 'Kukatpally, Hyderabad',
      preferredBlock: 'Block B (Boys)',
      preferredRoomType: 'Non-AC Room (3 Sharing)',
      preferredFloor: 1,
      stayDuration: 'Academic Year (10 Months)',
      foodPreference: 'NON_VEG',
      medicalConditions: 'None',
    })
  });
  const reg2Json = await reg2Res.json();
  console.log('    Candidate 2 registration:', reg2Json.success, reg2Json.message);

  const rejectStudentDb = await prisma.student.findUnique({ where: { jntuNo: rejectRollNo } });
  if (!rejectStudentDb) throw new Error('Failed to create rejection candidate');

  // Admin rejects candidate from Room Allocation module
  const rejectionReason = 'Hostel capacity unavailable for selected block';
  console.log(`    Admin rejecting ${rejectRollNo} with reason: "${rejectionReason}"...`);
  const rejectRes = await fetch(`${API_BASE}/management/rooms/allocations/reject`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      studentId: rejectStudentDb.id,
      reason: rejectionReason,
    })
  });
  const rejectJson = await rejectRes.json();
  console.log('    Reject response:', rejectRes.status, rejectJson.success, rejectJson.message);

  // Verify DB state of rejected student
  const studentDbAfterReject = await prisma.student.findUnique({
    where: { id: rejectStudentDb.id },
    include: { hostelApplications: true }
  });
  console.log('    Rejected student DB state:', {
    isActive: studentDbAfterReject?.isActive,
    allocationStatus: studentDbAfterReject?.allocationStatus,
    applicationStatus: studentDbAfterReject?.hostelApplications[0]?.status,
    rejectionReason: studentDbAfterReject?.hostelApplications[0]?.rejectionReason,
  });

  if (
    studentDbAfterReject?.isActive !== false ||
    studentDbAfterReject?.hostelApplications[0]?.status !== 'REJECTED'
  ) {
    throw new Error('FAILED: Rejected student state incorrect!');
  }

  // Verify rejected student CANNOT log in to Student Portal
  console.log('    Verifying rejected student cannot log in...');
  const rejectLoginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: rejectRollNo, password: 'Password123' })
  });
  const rejectLoginJson = await rejectLoginRes.json();
  if (rejectLoginRes.ok && rejectLoginJson.success) {
    throw new Error('FAILED: Rejected student was able to log in!');
  }
  console.log('    Rejected student login blocked as expected:', rejectLoginRes.status, rejectLoginJson.message);

  console.log('\n=== ALL 11 WORKFLOW VERIFICATION STEPS PASSED WITH 100% SUCCESS! ===\n');
}

runTest()
  .catch((err) => {
    console.error('\nTEST FAILED:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
