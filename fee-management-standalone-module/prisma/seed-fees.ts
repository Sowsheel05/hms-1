import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function seedFees() {
  console.log('Seeding baseline fee configuration and accounts...');

  // 1. Institution Settings
  await prisma.institutionSettings.upsert({
    where: { id: 'GLOBAL' },
    create: {
      id: 'GLOBAL',
      institutionMode: 'BOTH',
      institutionName: 'Harsha Institution of Technology & Sciences',
      institutionCode: 'HITS-01',
      enableScholarships: true,
      enableDetentions: true,
      enableBulkUploads: true,
    },
    update: {},
  });

  // 2. Academic Years
  const year2026 = await prisma.academicYear.upsert({
    where: { code: '2026-2027' },
    create: {
      code: '2026-2027',
      name: 'Academic Year 2026-2027',
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      endDate: new Date('2027-05-31T23:59:59.999Z'),
      isCurrent: true,
      status: 'ACTIVE',
      createdBy: 'ADMIN',
    },
    update: { isCurrent: true },
  });

  const year2025 = await prisma.academicYear.upsert({
    where: { code: '2025-2026' },
    create: {
      code: '2025-2026',
      name: 'Academic Year 2025-2026',
      startDate: new Date('2025-06-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T23:59:59.999Z'),
      isCurrent: false,
      status: 'PAST',
      createdBy: 'ADMIN',
    },
    update: { isCurrent: false },
  });

  // 3. Bank Accounts
  const accounts = [
    {
      name: 'Hostel Maintenance & Mess Account',
      accountIdentifier: 'HOSTEL-001',
      bankName: 'State Bank of India',
      accountNumber: '38291048291',
      ifsc: 'SBIN0004521',
      kind: 'MESS',
      module: 'HOSTEL',
      displayLabel: 'SBI - Hostel Operations (*8291)',
    },
    {
      name: 'Hostel Caution Deposit Account',
      accountIdentifier: 'HOSTEL-002',
      bankName: 'HDFC Bank',
      accountNumber: '50100482918231',
      ifsc: 'HDFC0001289',
      kind: 'DEPOSIT',
      module: 'HOSTEL',
      displayLabel: 'HDFC - Caution Deposit (*8231)',
    },
    {
      name: 'College Tuition Fee Account',
      accountIdentifier: 'TUITION-001',
      bankName: 'Canara Bank',
      accountNumber: '194820194829',
      ifsc: 'CNRB0002819',
      kind: 'TUITION',
      module: 'COLLEGE',
      displayLabel: 'Canara - College Tuition (*4829)',
    },
    {
      name: 'Special & Examination Fee Account',
      accountIdentifier: 'SPECIAL-001',
      bankName: 'State Bank of India',
      accountNumber: '49201948291',
      ifsc: 'SBIN0004521',
      kind: 'SPECIAL',
      module: 'COLLEGE',
      displayLabel: 'SBI - Special Fee (*8291)',
    },
  ];

  for (const acc of accounts) {
    await prisma.bankAccount.upsert({
      where: { accountIdentifier: acc.accountIdentifier },
      create: {
        name: acc.name,
        accountIdentifier: acc.accountIdentifier,
        bankName: acc.bankName,
        accountNumber: acc.accountNumber,
        ifsc: acc.ifsc,
        kind: acc.kind,
        module: acc.module,
        displayLabel: acc.displayLabel,
        status: 'ACTIVE',
        createdBy: 'ADMIN',
      },
      update: {},
    });
  }

  // 4. Fee Structures
  const structures = [
    {
      academicYearId: year2026.id,
      module: 'HOSTEL',
      category: 'REGULAR',
      feeKind: 'MESS_FEE',
      name: 'Annual Hostel Mess & Dining Charges',
      amount: new Prisma.Decimal('45000.00'),
      status: 'ACTIVE',
    },
    {
      academicYearId: year2026.id,
      module: 'HOSTEL',
      category: 'REGULAR',
      feeKind: 'ROOM_RENT',
      name: 'Hostel Accommodation & Room Rent',
      amount: new Prisma.Decimal('35000.00'),
      status: 'ACTIVE',
    },
    {
      academicYearId: year2026.id,
      module: 'COLLEGE',
      category: 'REGULAR',
      feeKind: 'TUITION',
      name: 'Annual College Tuition Fee',
      amount: new Prisma.Decimal('85000.00'),
      status: 'ACTIVE',
    },
    {
      academicYearId: year2026.id,
      module: 'COLLEGE',
      category: 'REGULAR',
      feeKind: 'SPECIAL',
      name: 'Special Institutional & Lab Amenities Fee',
      amount: new Prisma.Decimal('15000.00'),
      status: 'ACTIVE',
    },
  ];

  for (const s of structures) {
    const existing = await prisma.feeStructure.findFirst({
      where: {
        academicYearId: s.academicYearId,
        feeKind: s.feeKind,
        module: s.module,
      },
    });
    if (!existing) {
      await prisma.feeStructure.create({
        data: {
          academicYearId: s.academicYearId,
          module: s.module,
          category: s.category,
          feeKind: s.feeKind,
          name: s.name,
          amount: s.amount,
          status: s.status,
          createdBy: 'ADMIN',
        },
      });
    }
  }

  // 5. Scholarship Types
  const scholarshipTypes = [
    {
      code: 'JVD',
      name: 'Jagananna Vidya Deevena (Govt. Fee Reimbursement)',
      provider: 'GOVERNMENT',
      maxAmount: new Prisma.Decimal('85000.00'),
      description: 'Full college tuition fee reimbursement by government.',
    },
    {
      code: 'MERIT_CONCESSION',
      name: 'Institutional Merit Scholarship',
      provider: 'INSTITUTION',
      maxAmount: new Prisma.Decimal('25000.00'),
      description: 'Merit concession for top academic rankers.',
    },
  ];

  for (const st of scholarshipTypes) {
    await prisma.scholarshipType.upsert({
      where: { code: st.code },
      create: {
        code: st.code,
        name: st.name,
        provider: st.provider,
        maxAmount: st.maxAmount,
        description: st.description,
        status: 'ACTIVE',
      },
      update: {},
    });
  }

  // 6. Synchronize initial fee items for existing students in 2026-2027
  const students = await prisma.student.findMany({
    where: { role: 'STUDENT', isActive: true },
    select: { id: true, name: true, jntuNo: true },
  });

  const activeStructures = await prisma.feeStructure.findMany({
    where: { academicYearId: year2026.id, status: 'ACTIVE' },
  });

  for (const st of students) {
    for (const struct of activeStructures) {
      const existing = await prisma.feeItem.findFirst({
        where: {
          studentId: st.id,
          academicYearId: year2026.id,
          feeStructureId: struct.id,
        },
      });
      if (!existing) {
        const amt = struct.amount;
        await prisma.feeItem.create({
          data: {
            studentId: st.id,
            academicYearId: year2026.id,
            feeStructureId: struct.id,
            feeType: struct.name,
            module: struct.module,
            totalFee: amt,
            paidAmount: new Prisma.Decimal('0.00'),
            concessionAmount: new Prisma.Decimal('0.00'),
            dueAmount: amt,
            excessPaid: new Prisma.Decimal('0.00'),
            refundedAmount: new Prisma.Decimal('0.00'),
            status: 'UNPAID',
            createdBy: 'SEED',
          },
        });
      }
    }
  }

  console.log(`Seeded baseline fee configuration and synchronized fees for ${students.length} students.`);
}

seedFees()
  .catch((e) => {
    console.error('Seed fee error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
