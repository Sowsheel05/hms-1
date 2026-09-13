import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

// Check the exact student used in the test
const student = await p.student.findFirst({ where: { jntuNo: '25331A05H7' } });
console.log('Student:', student?.name, student?.id);

if (!student) { console.log('Student NOT FOUND'); await p.$disconnect(); process.exit(1); }

const sysNotifs = await p.notification.findMany({
  where: { studentId: student.id, category: 'SYSTEM' },
  select: { title: true, createdAt: true, isRead: true },
  orderBy: { createdAt: 'asc' },
  take: 20,
});
console.log('SYSTEM notifs count:', sysNotifs.length);
console.log('SYSTEM notifs:', JSON.stringify(sysNotifs, null, 2));

const hasRoomAlloc = sysNotifs.some(n => n.title.includes('Room Allocation'));
const hasMessMenu = sysNotifs.some(n => n.title.includes('Mess Menu'));
console.log('Has Room Allocation:', hasRoomAlloc);
console.log('Has Mess Menu:', hasMessMenu);

// Show total notifications count
const total = await p.notification.count({ where: { studentId: student.id } });
console.log('Total notifs for this student:', total);

await p.$disconnect();
