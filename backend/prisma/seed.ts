import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding HMS database with real test accounts and dashboard state...');

  const studentPasswordHash = await bcrypt.hash('Password@123', 10);
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Primary Student (from reference screenshots): MANI MANASVI GAVARA
  const student1 = await prisma.student.upsert({
    where: { jntuNo: '25331A05H7' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'MANI MANASVI GAVARA',
      email: 'vemalivardhan@gmail.com',
      allocationStatus: 'ALLOCATED',
      blockName: 'GH-1',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '25331A05H7',
      passwordHash: studentPasswordHash,
      name: 'MANI MANASVI GAVARA',
      email: 'vemalivardhan@gmail.com',
      role: 'STUDENT',
      allocationStatus: 'ALLOCATED',
      blockName: 'GH-1',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
      isActive: true,
    },
  });

  // Clean existing child records for clean deterministic seed
  await prisma.complaint.deleteMany({ where: { studentId: student1.id } });
  await prisma.messToken.deleteMany({ where: { studentId: student1.id } });
  await prisma.outingRequest.deleteMany({ where: { studentId: student1.id } });
  await prisma.leaveRequest.deleteMany({ where: { studentId: student1.id } });
  await prisma.notification.deleteMany({ where: { studentId: student1.id } });
  await prisma.activityLog.deleteMany({ where: { studentId: student1.id } });

  // 4 Mess tokens booked for today (Breakfast, Lunch, Snacks, Dinner)
  const dateTag = todayStr.replace(/-/g, '');
  await prisma.messToken.createMany({
    data: [
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-BRK-101`,
        date: todayStr,
        mealType: 'BREAKFAST',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-LUN-102`,
        date: todayStr,
        mealType: 'LUNCH',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-SNK-103`,
        date: todayStr,
        mealType: 'SNACKS',
        status: 'BOOKED',
      },
      {
        studentId: student1.id,
        tokenNumber: `MT-${dateTag}-DIN-104`,
        date: todayStr,
        mealType: 'DINNER',
        status: 'BOOKED',
      },
    ],
  });

  // Real Notifications
  await prisma.notification.createMany({
    data: [
      {
        studentId: student1.id,
        title: 'Room Allocation Confirmed',
        message: 'You have been officially allocated Bed-1 in Girls-Block-B, Room 119.',
        type: 'SUCCESS',
        isRead: false,
      },
      {
        studentId: student1.id,
        title: 'Mess Menu Updated',
        message: 'Weekly residential hostel menu has been refreshed for the upcoming cycle.',
        type: 'INFO',
        isRead: true,
      },
    ],
  });

  // Real Activity Logs
  await prisma.activityLog.createMany({
    data: [
      {
        studentId: student1.id,
        actionType: 'MESS',
        description: 'Booked 2 meal tokens for today (Breakfast, Lunch)',
      },
      {
        studentId: student1.id,
        actionType: 'ROOM',
        description: 'Room Girls-Block-B - 119 verified and allocated',
      },
      {
        studentId: student1.id,
        actionType: 'LOGIN',
        description: 'Successful authenticated portal session established',
      },
    ],
  });

  // 2. Roommate: NAKKULLA RITHIKA (Allocated, but 0 mess tokens today to verify independent data)
  const student2 = await prisma.student.upsert({
    where: { jntuNo: '25331A05H8' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'NAKKULLA RITHIKA',
      email: 'rithika.n@college.edu',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-2',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '25331A05H8',
      passwordHash: studentPasswordHash,
      name: 'NAKKULLA RITHIKA',
      email: 'rithika.n@college.edu',
      role: 'STUDENT',
      allocationStatus: 'ALLOCATED',
      blockName: 'Girls-Block-B',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-2',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
      monthlyOutingMax: 5,
      isActive: true,
    },
  });

  // Clean existing child records for student2
  await prisma.complaint.deleteMany({ where: { studentId: student2.id } });
  await prisma.messToken.deleteMany({ where: { studentId: student2.id } });
  await prisma.outingRequest.deleteMany({ where: { studentId: student2.id } });
  await prisma.leaveRequest.deleteMany({ where: { studentId: student2.id } });

  // 11 Baseline OPEN complaints for management dashboard and complaints tracking
  const initialComplaints = [
    { category: 'ELECTRICAL', title: 'Ceiling fan regulator sparking', description: 'The ceiling fan regulator sparks when turned up.', location: 'Girls-Block-B, Room 119', priority: 'HIGH' },
    { category: 'PLUMBING', title: 'Water tap leaking heavily', description: 'Bathroom sink tap continues dripping heavily.', location: 'Girls-Block-B, Room 119', priority: 'MEDIUM' },
    { category: 'CARPENTRY', title: 'Wardrobe hinge loose', description: 'The main door hinge of wardrobe 2 is detached.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'CLEANLINESS', title: 'Floor cleaning requested', description: 'Balcony area requires floor scrub and wash.', location: 'Girls-Block-B, Floor 1', priority: 'LOW' },
    { category: 'INTERNET', title: 'Wi-Fi repeater unstable signal', description: 'Wi-Fi disconnects frequently during evening study hours.', location: 'Girls-Block-B, Wing 1', priority: 'HIGH' },
    { category: 'ELECTRICAL', title: 'Tube light flickering in study room', description: 'Overhead tube light flickers continuously.', location: 'Girls-Block-B, Room 120', priority: 'MEDIUM' },
    { category: 'PLUMBING', title: 'Shower mixer valve stuck', description: 'Water temperature control valve cannot be adjusted.', location: 'Girls-Block-B, Room 120', priority: 'HIGH' },
    { category: 'CARPENTRY', title: 'Study chair armrest cracked', description: 'Wooden study chair has a cracked left armrest.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'INTERNET', title: 'LAN port not responding', description: 'Ethernet RJ45 socket in desk 1 has no link light.', location: 'Girls-Block-B, Room 119', priority: 'MEDIUM' },
    { category: 'OTHER', title: 'Window mesh screen torn', description: 'Mosquito screen on north window is torn at bottom.', location: 'Girls-Block-B, Room 119', priority: 'LOW' },
    { category: 'ELECTRICAL', title: 'Geyser heating element trip', description: 'Water heater trips circuit breaker when powered on.', location: 'Girls-Block-B, Room 119', priority: 'URGENT' },
  ];

  for (let i = 0; i < initialComplaints.length; i++) {
    const c = initialComplaints[i];
    await prisma.complaint.create({
      data: {
        studentId: i % 2 === 0 ? student1.id : student2.id,
        ticketNumber: `CMP-${dateTag}-${String(i + 101).padStart(3, '0')}`,
        category: c.category,
        title: c.title,
        description: c.description,
        location: c.location,
        priority: c.priority,
        status: 'OPEN',
      },
    });
  }

  // 3. Unallocated Student (to verify empty state for room allocation)
  const studentUnallocated = await prisma.student.upsert({
    where: { jntuNo: '21A91A0501' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'Rahul Varma',
      email: 'rahul.v@college.edu',
      allocationStatus: 'NOT_ALLOCATED',
      blockName: null,
      floorName: null,
      roomNumber: null,
      bedNumber: null,
      roomType: null,
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '21A91A0501',
      passwordHash: studentPasswordHash,
      name: 'Rahul Varma',
      email: 'rahul.v@college.edu',
      role: 'STUDENT',
      allocationStatus: 'NOT_ALLOCATED',
      isActive: true,
    },
  });

  // 4. Deactivated Student
  await prisma.student.upsert({
    where: { jntuNo: '21A91A0502' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: false,
      role: 'STUDENT',
    },
    create: {
      jntuNo: '21A91A0502',
      passwordHash: studentPasswordHash,
      name: 'Inactive Student',
      email: 'inactive.student@college.edu',
      role: 'STUDENT',
      isActive: false,
    },
  });

  // 5a. College Institutional Administrator Account
  await prisma.student.upsert({
    where: { jntuNo: 'ADMIN_COLLEGE' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'ADMIN',
      name: 'College Administrator (Alliance)',
      email: 'admin@alliance.edu.in',
    },
    create: {
      jntuNo: 'ADMIN_COLLEGE',
      passwordHash: studentPasswordHash,
      name: 'College Administrator (Alliance)',
      email: 'admin@alliance.edu.in',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // 5b. Company Level-1 Support & Marketing Administrator Account
  await prisma.student.upsert({
    where: { jntuNo: 'SUPPORT_ADMIN' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'ADMIN',
      name: 'Campusly Support & Marketing Admin',
      email: 'support@campusly.io',
    },
    create: {
      jntuNo: 'SUPPORT_ADMIN',
      passwordHash: studentPasswordHash,
      name: 'Campusly Support & Marketing Admin',
      email: 'support@campusly.io',
      role: 'ADMIN',
      isActive: true,
    },
  });

  // 5b. Chief Warden / Warden Boys accounts
  await prisma.student.upsert({
    where: { jntuNo: 'CW_BOYS' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'WARDEN_BOYS',
      name: 'Chief Warden (Boys Hostel)',
      email: 'chiefwarden.boys@college.edu',
      blockName: 'Boys Hostel',
    },
    create: {
      jntuNo: 'CW_BOYS',
      passwordHash: studentPasswordHash,
      name: 'Chief Warden (Boys Hostel)',
      email: 'chiefwarden.boys@college.edu',
      role: 'WARDEN_BOYS',
      blockName: 'Boys Hostel',
      isActive: true,
    },
  });

  await prisma.student.upsert({
    where: { jntuNo: 'WARDEN_BOYS' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'WARDEN_BOYS',
      name: 'Boys Hostel Warden',
      email: 'warden.boys@college.edu',
      blockName: 'Boys Hostel',
    },
    create: {
      jntuNo: 'WARDEN_BOYS',
      passwordHash: studentPasswordHash,
      name: 'Boys Hostel Warden',
      email: 'warden.boys@college.edu',
      role: 'WARDEN_BOYS',
      blockName: 'Boys Hostel',
      isActive: true,
    },
  });

  // 5c. Chief Warden / Warden Girls accounts
  await prisma.student.upsert({
    where: { jntuNo: 'CW_GIRLS' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'WARDEN_GIRLS',
      name: 'Chief Warden (Girls Hostel)',
      email: 'chiefwarden.girls@college.edu',
      blockName: 'Girls Hostel',
    },
    create: {
      jntuNo: 'CW_GIRLS',
      passwordHash: studentPasswordHash,
      name: 'Chief Warden (Girls Hostel)',
      email: 'chiefwarden.girls@college.edu',
      role: 'WARDEN_GIRLS',
      blockName: 'Girls Hostel',
      isActive: true,
    },
  });

  await prisma.student.upsert({
    where: { jntuNo: 'WARDEN_GIRLS' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'WARDEN_GIRLS',
      name: 'Girls Hostel Warden',
      email: 'warden.girls@college.edu',
      blockName: 'Girls Hostel',
    },
    create: {
      jntuNo: 'WARDEN_GIRLS',
      passwordHash: studentPasswordHash,
      name: 'Girls Hostel Warden',
      email: 'warden.girls@college.edu',
      role: 'WARDEN_GIRLS',
      blockName: 'Girls Hostel',
      isActive: true,
    },
  });

  // 5d. Office Staff account (Fee & Finance Management Only)
  await prisma.student.upsert({
    where: { jntuNo: 'OFFICE_STAFF' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'OFFICE_STAFF',
      name: 'Office Fee Accountant',
      email: 'office.fees@college.edu',
    },
    create: {
      jntuNo: 'OFFICE_STAFF',
      passwordHash: studentPasswordHash,
      name: 'Office Fee Accountant',
      email: 'office.fees@college.edu',
      role: 'OFFICE_STAFF',
      isActive: true,
    },
  });

  // 5e. Maintenance Staff account
  await prisma.student.upsert({
    where: { jntuNo: 'MAINT01' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'MAINTENANCE_STAFF',
    },
    create: {
      jntuNo: 'MAINT01',
      passwordHash: studentPasswordHash,
      name: 'Maintenance Technician',
      email: 'maintenance@college.edu',
      role: 'MAINTENANCE_STAFF',
      isActive: true,
    },
  });

  // 6. Authoritative Hostel Blocks (BH-1, BH-2 for Boys, GH-1 for Girls)
  const initialBlocks = [
    {
      name: 'BH-1',
      code: 'BH-1',
      description: 'Alliance Boys Residential Block 1 (Ground + 3 Floors).',
      status: 'ACTIVE',
      collegeCode: 'ACM-01',
    },
    {
      name: 'BH-2',
      code: 'BH-2',
      description: 'Alliance Boys Residential Block 2 (Ground + 3 Floors).',
      status: 'ACTIVE',
      collegeCode: 'ACM-01',
    },
    {
      name: 'GH-1',
      code: 'GH-1',
      description: 'Alliance Girls Residential Block 1 (Ground + 3 Floors).',
      status: 'ACTIVE',
      collegeCode: 'ACM-01',
    },
    {
      name: 'HITS-BH-A',
      code: 'HITS-BH-A',
      description: 'Harsha Tech Boys Block A (4 Floors).',
      status: 'ACTIVE',
      collegeCode: 'HITS-01',
    },
    {
      name: 'HITS-GH-B',
      code: 'HITS-GH-B',
      description: 'Harsha Tech Girls Block B (4 Floors).',
      status: 'ACTIVE',
      collegeCode: 'HITS-01',
    },
    {
      name: 'CEC-BH-1',
      code: 'CEC-BH-1',
      description: 'City Engineering Boys Block 1.',
      status: 'ACTIVE',
      collegeCode: 'CEC-01',
    },
    {
      name: 'CEC-GH-1',
      code: 'CEC-GH-1',
      description: 'City Engineering Girls Block 1.',
      status: 'ACTIVE',
      collegeCode: 'CEC-01',
    },
  ];

  for (const b of initialBlocks) {
    await prisma.block.upsert({
      where: { code: b.code },
      update: { name: b.name, status: b.status, description: b.description, collegeCode: b.collegeCode },
      create: b,
    });
  }

  // 7. Authoritative Rooms & Allocations for BH-1, BH-2, GH-1
  const bh1Block = await prisma.block.findUnique({ where: { code: 'BH-1' } });
  const bh2Block = await prisma.block.findUnique({ where: { code: 'BH-2' } });
  const gh1Block = await prisma.block.findUnique({ where: { code: 'GH-1' } });

  // Seed Floor Plan Rooms for GH-1 (Girls Hostel)
  if (gh1Block) {
    const gh1Rooms = [
      { roomNumber: '101', floor: 1, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '102', floor: 1, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '119', floor: 1, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '120', floor: 1, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '201', floor: 2, capacity: 3, roomType: 'Non-AC Room (3 Sharing)', status: 'ACTIVE' },
      { roomNumber: '202', floor: 2, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'UNDER_MAINTENANCE' },
      { roomNumber: '301', floor: 3, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'ACTIVE' },
    ];

    for (const r of gh1Rooms) {
      await prisma.room.upsert({
        where: { blockId_roomNumber: { blockId: gh1Block.id, roomNumber: r.roomNumber } },
        update: { floor: r.floor, capacity: r.capacity, roomType: r.roomType, status: r.status },
        create: { blockId: gh1Block.id, ...r },
      });
    }

    const room119 = await prisma.room.findUnique({
      where: { blockId_roomNumber: { blockId: gh1Block.id, roomNumber: '119' } },
    });

    if (room119) {
      const existingAlloc1 = await prisma.roomAllocation.findFirst({
        where: { studentId: student1.id, status: 'ACTIVE' },
      });
      if (!existingAlloc1) {
        await prisma.roomAllocation.create({
          data: {
            roomId: room119.id,
            studentId: student1.id,
            bedNumber: 'Bed-1',
            status: 'ACTIVE',
            allocatedAt: new Date('2026-08-01T09:00:00.000Z'),
          },
        });
      }
    }
  }

  // Seed Floor Plan Rooms for BH-1 (Boys Hostel 1)
  if (bh1Block) {
    const bh1Rooms = [
      { roomNumber: '101', floor: 1, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '102', floor: 1, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '201', floor: 2, capacity: 3, roomType: 'Non-AC Room (3 Sharing)', status: 'ACTIVE' },
      { roomNumber: '202', floor: 2, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'UNDER_MAINTENANCE' },
      { roomNumber: '301', floor: 3, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'ACTIVE' },
    ];

    for (const r of bh1Rooms) {
      await prisma.room.upsert({
        where: { blockId_roomNumber: { blockId: bh1Block.id, roomNumber: r.roomNumber } },
        update: { floor: r.floor, capacity: r.capacity, roomType: r.roomType, status: r.status },
        create: { blockId: bh1Block.id, ...r },
      });
    }
  }

  // Seed Floor Plan Rooms for BH-2 (Boys Hostel 2)
  if (bh2Block) {
    const bh2Rooms = [
      { roomNumber: '101', floor: 1, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '102', floor: 1, capacity: 3, roomType: 'Non-AC Room (3 Sharing)', status: 'ACTIVE' },
      { roomNumber: '201', floor: 2, capacity: 2, roomType: 'AC Room (2 Sharing)', status: 'ACTIVE' },
      { roomNumber: '301', floor: 3, capacity: 2, roomType: 'Non-AC Room (2 Sharing)', status: 'ACTIVE' },
    ];

    for (const r of bh2Rooms) {
      await prisma.room.upsert({
        where: { blockId_roomNumber: { blockId: bh2Block.id, roomNumber: r.roomNumber } },
        update: { floor: r.floor, capacity: r.capacity, roomType: r.roomType, status: r.status },
        create: { blockId: bh2Block.id, ...r },
      });
    }
  }

  // 8. Pending Room Allocation Candidate (from reference screenshot): VANA BHARGAV PRASAD
  const pendingStudent = await prisma.student.upsert({
    where: { jntuNo: '23331A4462' },
    update: {
      passwordHash: studentPasswordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'VANA BHARGAV PRASAD',
      email: 'bhargavvana80@gmail.com',
      allocationStatus: 'PENDING',
      blockName: 'Boys-Block-D',
      floorName: 'First Floor',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
    },
    create: {
      jntuNo: '23331A4462',
      passwordHash: studentPasswordHash,
      name: 'VANA BHARGAV PRASAD',
      email: 'bhargavvana80@gmail.com',
      role: 'STUDENT',
      allocationStatus: 'PENDING',
      blockName: 'Boys-Block-D',
      floorName: 'First Floor',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      isActive: true,
    },
  });

  // 9. Outing Requests from reference screenshots (KUMARI CHINTA, Sivaparvathi Gunturu)
  const outingStudent1 = await prisma.student.upsert({
    where: { jntuNo: '25331A0236' },
    update: { passwordHash: studentPasswordHash, isActive: true, role: 'STUDENT', name: 'KUMARI CHINTA', blockName: 'Girls-Block-B' },
    create: { jntuNo: '25331A0236', passwordHash: studentPasswordHash, name: 'KUMARI CHINTA', email: 'kumari.chinta@college.edu', role: 'STUDENT', blockName: 'Girls-Block-B', isActive: true },
  });

  await prisma.outingRequest.upsert({
    where: { id: 'outing-demo-01' },
    update: {},
    create: {
      id: 'outing-demo-01',
      requestNumber: 'OUT-20260904-001',
      studentId: outingStudent1.id,
      purpose: 'To meet my sister in srikakulam',
      passType: 'LOCAL_OUTING',
      status: 'PENDING',
      outDate: new Date('2026-09-04T08:30:00.000Z'),
      returnDate: new Date('2026-09-04T16:30:00.000Z'),
    },
  });

  const outingStudent2 = await prisma.student.upsert({
    where: { jntuNo: '24331A1249' },
    update: { passwordHash: studentPasswordHash, isActive: true, role: 'STUDENT', name: 'Sivaparvathi Gunturu', blockName: 'Girls-Block-A' },
    create: { jntuNo: '24331A1249', passwordHash: studentPasswordHash, name: 'Sivaparvathi Gunturu', email: 'siva.g@college.edu', role: 'STUDENT', blockName: 'Girls-Block-A', isActive: true },
  });

  await prisma.outingRequest.upsert({
    where: { id: 'outing-demo-02' },
    update: {},
    create: {
      id: 'outing-demo-02',
      requestNumber: 'OUT-20260826-002',
      studentId: outingStudent2.id,
      purpose: 'Going with friends',
      passType: 'LOCAL_OUTING',
      status: 'PENDING',
      outDate: new Date('2026-08-26T21:04:00.000Z'),
      returnDate: new Date('2026-08-27T09:04:00.000Z'),
    },
  });

  // 11. Authoritative Meal Configurations in PostgreSQL
  const defaultMealConfigs = [
    {
      mealType: 'BREAKFAST',
      name: 'Breakfast',
      startTime: '07:30 AM',
      endTime: '09:30 AM',
      description: 'Morning breakfast & beverages',
      startHour: 7,
      startMinute: 30,
      endHour: 9,
      endMinute: 30,
      cutoffHour: 7,
      cutoffMinute: 0,
    },
    {
      mealType: 'LUNCH',
      name: 'Lunch',
      startTime: '12:30 PM',
      endTime: '02:30 PM',
      description: 'Afternoon standard meal',
      startHour: 12,
      startMinute: 30,
      endHour: 14,
      endMinute: 30,
      cutoffHour: 11,
      cutoffMinute: 30,
    },
    {
      mealType: 'SNACKS',
      name: 'Evening Snacks',
      startTime: '05:00 PM',
      endTime: '06:30 PM',
      description: 'Tea, coffee & evening refreshments',
      startHour: 17,
      startMinute: 0,
      endHour: 18,
      endMinute: 30,
      cutoffHour: 16,
      cutoffMinute: 0,
    },
    {
      mealType: 'DINNER',
      name: 'Dinner',
      startTime: '07:30 PM',
      endTime: '09:30 PM',
      description: 'Night dinner menu',
      startHour: 19,
      startMinute: 30,
      endHour: 21,
      endMinute: 30,
      cutoffHour: 18,
      cutoffMinute: 30,
    },
  ];

  for (const mc of defaultMealConfigs) {
    await prisma.mealConfig.upsert({
      where: { mealType: mc.mealType },
      update: mc,
      create: mc,
    });
  }

  console.log('Database seeded successfully:');
  console.log(`- Administrator: System Administrator (ADMIN01)`);
  console.log(`- Chief Warden Boys: Chief Warden (Boys Hostel) (CW_BOYS)`);
  console.log(`- Chief Warden Girls: Chief Warden (Girls Hostel) (CW_GIRLS)`);
  console.log(`- Blocks: Seeded 3 authoritative blocks (BH-1, BH-2, GH-1)`);
  console.log(`- Meal Configs: Seeded 4 meal configurations (BREAKFAST, LUNCH, SNACKS, DINNER)`);
  console.log(`- Pending Candidate: ${pendingStudent.name} (${pendingStudent.jntuNo})`);
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
