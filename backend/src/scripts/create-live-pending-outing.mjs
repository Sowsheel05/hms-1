import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function createLivePendingOuting() {
  const student = await prisma.student.findUnique({ where: { jntuNo: '25331A05H7' } });
  if (!student) {
    console.error('Student 25331A05H7 not found.');
    return;
  }

  // Set any previous active/pending to RETURNED so student can submit cleanly
  await prisma.outingRequest.updateMany({
    where: { studentId: student.id, status: { in: ['PENDING', 'APPROVED', 'OUT'] } },
    data: { status: 'RETURNED' },
  });

  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.token;

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const outDate = new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString();
  const returnDate = new Date(tomorrow.setHours(18, 0, 0, 0)).toISOString();

  const createRes = await fetch('http://localhost:5001/api/student/outing-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      passType: 'LOCAL_OUTING',
      destination: 'Central Library Academic Complex, KPHB',
      purpose: 'Competitive exams preparation and reference material study',
      emergencyContact: '9876543210',
      outDate,
      returnDate,
      remarks: 'Will return before dinner session.',
    }),
  });
  const createJson = await createRes.json();
  console.log('✓ Successfully created fresh PENDING outing request for live UI inspection:');
  console.log(createJson);
}

createLivePendingOuting()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
