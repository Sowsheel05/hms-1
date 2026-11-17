const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Ensure primary demo student
  await prisma.student.upsert({
    where: { jntuNo: '25331A05H7' },
    update: {
      passwordHash,
      isActive: true,
      role: 'STUDENT',
      name: 'MANI MANASVI GAVARA',
      email: 'manasvi.g@college.edu',
      allocationStatus: 'ALLOCATED',
      blockName: 'GH-1',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      monthlyOutingMax: 5,
    },
    create: {
      jntuNo: '25331A05H7',
      passwordHash,
      name: 'MANI MANASVI GAVARA',
      email: 'manasvi.g@college.edu',
      role: 'STUDENT',
      allocationStatus: 'ALLOCATED',
      blockName: 'GH-1',
      floorName: '1',
      roomNumber: '119',
      bedNumber: 'Bed-1',
      roomType: 'Non-AC Room (2 Sharing)',
      roomCapacity: 2,
      monthlyOutingMax: 5,
      isActive: true,
    },
  });

  console.log('✔ Demo student 25331A05H7 ready with Password@123');
}

main().catch(console.error).finally(() => prisma.$disconnect());
