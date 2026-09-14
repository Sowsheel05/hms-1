/**
 * Automated Verification Script for Pre-Login Student Registration Workflow
 * Tests the complete lifecycle:
 * Public Register -> PENDING -> Login Blocked -> Admin Review -> Rejection Check
 * Second Applicant -> Admin Approve & Allocate -> Student Account Activated -> Student Login Allowed -> Student Portal Access
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BASE_URL = 'http://localhost:5001';

async function main() {
  console.log('=== STARTING PRE-LOGIN STUDENT REGISTRATION WORKFLOW TEST ===\n');

  const timestamp = Date.now().toString().slice(-4);
  // JNTU format requires 8-12 alphanumeric characters
  const testJntuApproved = `REG${timestamp}AP`;
  const testJntuRejected = `REG${timestamp}RJ`;
  const testEmailApproved = `student_${timestamp}_ap@college.edu`;
  const testEmailRejected = `student_${timestamp}_rj@college.edu`;
  const testPassword = 'Password@123';

  console.log(`[TEST SETUP] Approved Student JNTU: ${testJntuApproved}, Email: ${testEmailApproved}`);
  console.log(`[TEST SETUP] Rejected Student JNTU: ${testJntuRejected}, Email: ${testEmailRejected}`);

  try {
    // -------------------------------------------------------------
    // STEP 1: PUBLIC REGISTRATION (APPLICANT 1 - APPROVED FLOW)
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Public Student Registration (POST /api/auth/register) ---');
    const regRes1 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Test Student ${timestamp}`,
        jntuNo: testJntuApproved,
        email: testEmailApproved,
        password: testPassword,
        phone: '9876543210',
        dob: '2004-05-15',
        gender: 'Male',
        branch: 'Computer Science & Engineering (CSE)',
        yearOfStudy: '1st Year',
        semester: 'Semester 1',
        section: 'A',
        guardianName: 'Ramesh Kumar',
        guardianRelation: 'Father',
        guardianPhone: '9876543211',
        emergencyContact: '9876543212',
        address: 'Plot 42, Jubilee Hills, Hyderabad',
        preferredBlock: 'Boys Hostel Block A',
        preferredRoomType: 'Non-AC Room (2 Sharing)',
        stayDuration: 'Full Academic Year',
        foodPreference: 'VEG',
      }),
    });

    const regData1 = await regRes1.json();
    console.log(`Response Status: ${regRes1.status}`);
    console.log(`Registration Success: ${regData1.success}`);
    console.log(`Application ID: ${regData1.applicationId}`);

    if (regRes1.status !== 201 || !regData1.success) {
      throw new Error(`Registration failed: ${JSON.stringify(regData1)}`);
    }

    const appRecord1 = await prisma.hostelApplication.findUnique({
      where: { applicationNumber: regData1.applicationId },
      include: { student: true },
    });

    if (!appRecord1) throw new Error('HostelApplication was not persisted in database.');
    if (appRecord1.status !== 'PENDING') throw new Error(`Expected status PENDING, got ${appRecord1.status}`);
    if (appRecord1.student.isActive !== false) throw new Error(`Student account must NOT be active! Found: ${appRecord1.student.isActive}`);
    console.log('✓ Public registration correctly created PENDING application with INACTIVE student account.');

    // -------------------------------------------------------------
    // STEP 2: VERIFY STUDENT LOGIN IS BLOCKED WHILE PENDING
    // -------------------------------------------------------------
    console.log('\n--- Step 2: Attempt Student Login Before Admin Approval (POST /api/auth/login) ---');
    const preLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jntuNo: testJntuApproved,
        password: testPassword,
      }),
    });

    const preLoginData = await preLoginRes.json();
    console.log(`Login Response Status: ${preLoginRes.status}`);
    console.log(`Login Message: ${preLoginData.message}`);

    if (preLoginRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for pending student login, got ${preLoginRes.status}`);
    }
    if (!preLoginData.message.includes('pending') && !preLoginData.message.includes('verification')) {
      throw new Error(`Expected message to indicate pending verification, got: ${preLoginData.message}`);
    }
    console.log('✓ Student login is securely blocked before Admin approval with informative pending status.');

    // -------------------------------------------------------------
    // STEP 3: REJECTION WORKFLOW (APPLICANT 2)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Register Applicant 2 and Verify Admin Rejection Workflow ---');
    const regRes2 = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Reject Test ${timestamp}`,
        jntuNo: testJntuRejected,
        email: testEmailRejected,
        password: testPassword,
        phone: '9876543220',
        dob: '2004-06-20',
        gender: 'Male',
        branch: 'Mechanical Engineering',
        yearOfStudy: '2nd Year',
        semester: 'Semester 3',
        guardianName: 'Suresh Rao',
        guardianRelation: 'Father',
        guardianPhone: '9876543221',
        emergencyContact: '9876543222',
        address: 'Secunderabad',
        preferredBlock: 'Boys Hostel Block A',
        preferredRoomType: 'Non-AC Room (2 Sharing)',
      }),
    });

    const regData2 = await regRes2.json();
    if (regRes2.status !== 201) throw new Error('Applicant 2 registration failed');

    // Admin login
    const adminLoginRes = await fetch(`${BASE_URL}/api/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'ADMIN01',
        password: 'Password@123',
      }),
    });
    const adminLoginData = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || !adminLoginData.token) {
      throw new Error('Admin login failed');
    }
    const adminToken = adminLoginData.token;
    console.log('✓ Admin authenticated successfully.');

    // Admin rejects Applicant 2
    const appId2 = regData2.application?.id || regData2.applicationId;
    const rejectRes = await fetch(`${BASE_URL}/api/management/hostel-applications/${appId2}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        status: 'REJECTED',
        rejectionReason: 'Applicant does not meet residency distance criteria.',
      }),
    });

    const rejectData = await rejectRes.json();
    console.log(`Reject Response Status: ${rejectRes.status}`);
    if (rejectRes.status !== 200 || !rejectData.success) {
      throw new Error(`Rejection failed: ${JSON.stringify(rejectData)}`);
    }

    // Verify rejected applicant login returns 403 with rejection reason
    const rejectLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jntuNo: testJntuRejected,
        password: testPassword,
      }),
    });
    const rejectLoginData = await rejectLoginRes.json();
    console.log(`Rejected Student Login Status: ${rejectLoginRes.status}`);
    console.log(`Rejected Student Login Message: ${rejectLoginData.message}`);
    if (rejectLoginRes.status !== 403 || !rejectLoginData.message.includes('rejected')) {
      throw new Error(`Expected login blocked with rejection notice! Got: ${JSON.stringify(rejectLoginData)}`);
    }
    console.log('✓ Rejected applicant correctly blocked with reason displayed.');

    // -------------------------------------------------------------
    // STEP 4: ADMIN APPROVAL & HOSTEL ROOM ALLOCATION (APPLICANT 1)
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Admin Approve & Room Allocation (POST /api/management/hostel-applications/:id/allocate) ---');
    // Find an active room with available beds
    const allRooms = await prisma.room.findMany({
      where: {
        status: 'ACTIVE',
        block: { status: 'ACTIVE' },
      },
      include: {
        block: true,
        allocations: { where: { status: 'ACTIVE' } },
      },
    });

    const room = allRooms.find((r) => r.allocations.length < r.capacity);
    if (!room) throw new Error('No room with available bed capacity found in database.');

    // Pick an available bed number
    const occupiedBeds = room.allocations.map((a) => a.bedNumber?.toLowerCase());
    let chosenBed = 'Bed 1';
    for (let i = 1; i <= room.capacity + 2; i++) {
      if (!occupiedBeds.includes(`bed ${i}`)) {
        chosenBed = `Bed ${i}`;
        break;
      }
    }

    console.log(`Allocating Application ${regData1.applicationId} to Block '${room.block.name}', Room '${room.roomNumber}', ${chosenBed}`);

    const appId1 = regData1.application?.id || regData1.applicationId;
    const allocRes = await fetch(`${BASE_URL}/api/management/hostel-applications/${appId1}/allocate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        roomId: room.id,
        bedNumber: chosenBed,
      }),
    });

    const allocData = await allocRes.json();
    console.log(`Allocation Response Status: ${allocRes.status}`);
    if (allocRes.status !== 200 || !allocData.success) {
      throw new Error(`Allocation failed: ${JSON.stringify(allocData)}`);
    }

    // Verify database state
    const studentAfterAlloc = await prisma.student.findUnique({
      where: { id: appRecord1.studentId },
      include: { roomAllocations: { where: { status: 'ACTIVE' } } },
    });

    if (!studentAfterAlloc.isActive) throw new Error('Student account was NOT activated upon approval!');
    if (studentAfterAlloc.allocationStatus !== 'ALLOCATED') throw new Error(`Expected ALLOCATED, got ${studentAfterAlloc.allocationStatus}`);
    if (studentAfterAlloc.roomAllocations.length === 0) throw new Error('No active RoomAllocation created!');
    console.log(`✓ Student account ACTIVATED: isActive = ${studentAfterAlloc.isActive}, allocationStatus = ${studentAfterAlloc.allocationStatus}`);
    console.log(`✓ RoomAllocation created: Room ${room.roomNumber}, Bed ${chosenBed}`);

    // -------------------------------------------------------------
    // STEP 5: STUDENT LOGIN AFTER APPROVAL & ACCESS EXISTING PORTAL
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Student Login After Admin Approval (POST /api/auth/login) ---');
    const studentLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jntuNo: testJntuApproved,
        password: testPassword,
      }),
    });

    const studentLoginData = await studentLoginRes.json();
    console.log(`Student Login Status: ${studentLoginRes.status}`);
    console.log(`Token Received: ${!!studentLoginData.token}`);
    console.log(`Student Role: ${studentLoginData.student?.role}`);

    if (studentLoginRes.status !== 200 || !studentLoginData.token) {
      throw new Error(`Student login failed after approval: ${JSON.stringify(studentLoginData)}`);
    }
    const studentToken = studentLoginData.token;
    console.log('✓ Approved student successfully logged in via existing Student Login!');

    // -------------------------------------------------------------
    // STEP 6: VERIFY STUDENT PORTAL ACCESS TO ALLOCATION & OVERVIEW
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Verify Authenticated Student Portal Access ---');
    const overviewRes = await fetch(`${BASE_URL}/api/student/hostel-application`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });

    const overviewData = await overviewRes.json();
    console.log(`Overview Status: ${overviewRes.status}`);
    console.log(`Allocated Block: ${overviewData.student?.blockName}`);
    console.log(`Allocated Room: ${overviewData.student?.roomNumber}`);
    console.log(`Allocated Bed: ${overviewData.student?.bedNumber}`);

    if (overviewRes.status !== 200 || !overviewData.success) {
      throw new Error(`Student hostel application overview failed: ${JSON.stringify(overviewData)}`);
    }
    if (overviewData.student?.roomNumber !== room.roomNumber) {
      throw new Error(`Expected room ${room.roomNumber}, got ${overviewData.student?.roomNumber}`);
    }

    // Access /api/student/my-room
    const myRoomRes = await fetch(`${BASE_URL}/api/student/my-room`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const myRoomData = await myRoomRes.json();
    console.log(`My Room Status: ${myRoomRes.status}`);
    if (myRoomRes.status !== 200) {
      throw new Error(`Access to /api/student/my-room failed: ${JSON.stringify(myRoomData)}`);
    }
    console.log(`✓ Existing Student Portal My Room accessible! Room: ${myRoomData.allocation?.room?.roomNumber}`);

    console.log('\n======================================================');
    console.log('🎉 ALL TESTS PASSED! PRE-LOGIN REGISTRATION WORKFLOW FULLY VERIFIED!');
    console.log('======================================================\n');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
