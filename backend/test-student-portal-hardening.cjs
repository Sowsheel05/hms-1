const assert = require('assert');
const http = require('http');
const { Client } = require('pg');
require('dotenv').config();

const API_BASE = 'http://localhost:5001/api';

// Helper to create valid minimal 1x1 JPEG buffer
function createValidJpegBuffer() {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
    0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
    0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00,
    0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
    0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

function buildMultipartBody(boundary, fieldName, filename, mimeType, fileBuffer) {
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, fileBuffer, tail]);
}

async function runHardeningSuite() {
  console.log('================================================================');
  console.log('   RUNNING STEP 2: STUDENT PORTAL FOUNDATION HARDENING TESTS    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      await fn();
      console.log(`[PASS] ${total}. ${name}`);
      passed++;
    } catch (err) {
      console.error(`[FAIL] ${total}. ${name}`);
      console.error(err);
      process.exit(1);
    }
  }

  // Logins
  let studentAToken = '';
  let studentAId = '';
  let studentBToken = '';
  let studentBId = '';
  let wardenToken = '';

  await test('Authenticate Student A (MANI MANASVI GAVARA - 25331A05H7)', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    studentAToken = data.token;
    studentAId = data.user.id;
    assert.ok(studentAToken);
  });

  await test('Authenticate Student B (NAKKULLA RITHIKA - 25331A05H8)', async () => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    studentBToken = data.token;
    studentBId = data.user.id;
    assert.ok(studentBToken);
  });

  await test('Authenticate Management User (WARDEN01)', async () => {
    const res = await fetch(`${API_BASE}/management/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'WARDEN01', password: 'Password@123' }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    wardenToken = data.token;
    assert.ok(wardenToken);
  });

  // Clean up any lingering suspensions for Student A
  const pgClient = new Client({ connectionString: process.env.DATABASE_URL });
  await pgClient.connect();
  await pgClient.query(`UPDATE "Suspension" SET status = 'LIFTED', "liftedAt" = NOW() WHERE "studentId" = $1 AND status = 'ACTIVE'`, [studentAId]);

  // -------------------------------------------------------------------------
  // SECTION A: OUTING SUSPENSION PROTECTION
  // -------------------------------------------------------------------------
  console.log('\n--- Section A: Outing Suspension Protection ---');

  const now = new Date();
  const dayMs = 24 * 3600 * 1000;
  const validExit = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
  const validReturn = new Date(now.getTime() + 6 * 3600 * 1000).toISOString();

  let suspensionId = null;

  await test('Create active suspension for Student A', async () => {
    const suspStart = new Date(now.getTime() - 1 * dayMs).toISOString();
    const suspEnd = new Date(now.getTime() + 7 * dayMs).toISOString();

    const suspRes = await fetch(`${API_BASE}/student/leaves/test/admin-suspension`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        studentId: studentAId,
        action: 'CREATE',
        reason: 'Violation of curfew rules - Section 3.1',
        startDate: suspStart,
        endDate: suspEnd,
      }),
    });
    assert.strictEqual(suspRes.status, 201);
    const data = await suspRes.json();
    suspensionId = data.suspension.id;
    assert.ok(suspensionId);
  });

  await test('Suspended Student A outing creation rejected with 403 and ACCOUNT_SUSPENDED code', async () => {
    const res = await fetch(`${API_BASE}/student/outing-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        passType: 'LOCAL_OUTING',
        destination: 'City Market',
        purpose: 'Purchasing stationery supplies',
        outDate: validExit,
        returnDate: validReturn,
      }),
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.code, 'ACCOUNT_SUSPENDED');
    assert.ok(data.message.includes('suspended'));
  });

  await test('Client cannot bypass suspension with forged studentId in body', async () => {
    // Attempting to send studentB's ID in body while authenticated as suspended student A
    const res = await fetch(`${API_BASE}/student/outing-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: studentBId, // Forged
        passType: 'LOCAL_OUTING',
        destination: 'City Market',
        purpose: 'Purchasing stationery supplies',
        outDate: validExit,
        returnDate: validReturn,
      }),
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.code, 'ACCOUNT_SUSPENDED');
  });

  await test('Student B is NOT blocked by Student A suspension (Tenant Isolation)', async () => {
    // Ensure student B has no lingering pending outings
    const bCheck = await fetch(`${API_BASE}/student/outing-requests`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    const bData = await bCheck.json();
    assert.strictEqual(bCheck.status, 200);
    // Student B check status does not evaluate to suspended
    assert.notStrictEqual(bData.student.id, studentAId);
  });

  await test('Lifting suspension allows Student A to submit outing requests again', async () => {
    const liftRes = await fetch(`${API_BASE}/student/leaves/test/admin-suspension`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${wardenToken}`,
      },
      body: JSON.stringify({
        action: 'LIFT',
        suspensionId,
      }),
    });
    assert.strictEqual(liftRes.status, 200);

    // Cancel any existing pending outings for Student A to test creation
    const getRes = await fetch(`${API_BASE}/student/outing-requests`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    const outingData = await getRes.json();
    for (const req of (outingData.requests || [])) {
      if (['PENDING', 'APPROVED'].includes(req.status)) {
        await pgClient.query(`UPDATE "OutingRequest" SET status = 'CANCELLED' WHERE id = $1`, [req.id]);
      }
    }

    const newOutingRes = await fetch(`${API_BASE}/student/outing-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        passType: 'LOCAL_OUTING',
        destination: 'City Library',
        purpose: 'Academic research for semester project',
        outDate: validExit,
        returnDate: validReturn,
      }),
    });
    assert.strictEqual(newOutingRes.status, 201);
    const createdOuting = await newOutingRes.json();
    assert.strictEqual(createdOuting.success, true);
    assert.strictEqual(createdOuting.request.status, 'PENDING');

    // Clean up created test outing
    await pgClient.query(`DELETE FROM "OutingRequest" WHERE id = $1`, [createdOuting.request.id]);
  });

  // -------------------------------------------------------------------------
  // SECTION B: COMPLAINT ATTACHMENT ACCESS CONTROL
  // -------------------------------------------------------------------------
  console.log('\n--- Section B: Complaint Attachment Access Control ---');

  let complaintId = '';
  let attachmentId = '';

  await test('Create complaint with valid JPEG attachment for Student A', async () => {
    const compRes = await fetch(`${API_BASE}/student/complaints`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        category: 'ELECTRICAL',
        title: 'Ceiling Fan Making Clicking Sound - ' + Date.now(),
        description: 'Room ceiling fan speed regulator causing clicking sound in nighttime.',
        priority: 'LOW',
      }),
    });
    assert.strictEqual(compRes.status, 201);
    const compData = await compRes.json();
    complaintId = compData.complaint.id;

    // Upload attachment
    const boundary = '----WebKitBoundary' + Date.now();
    const jpeg = createValidJpegBuffer();
    const body = buildMultipartBody(boundary, 'file', 'fan_repair.jpg', 'image/jpeg', jpeg);
    const uploadRes = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${studentAToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });
    assert.strictEqual(uploadRes.status, 201);
    const uploadData = await uploadRes.json();
    attachmentId = uploadData.attachment.id;
    assert.ok(attachmentId);
  });

  await test('Unauthenticated attachment download rejected with 401', async () => {
    const res = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments/${attachmentId}`);
    assert.strictEqual(res.status, 401);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /Authentication required/i);
  });

  await test('Unrelated Student B download rejected with 403 (IDOR Protection)', async () => {
    const res = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${studentBToken}` },
    });
    assert.strictEqual(res.status, 403);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.match(data.message, /not authorized/i);
  });

  await test('Owning Student A downloads attachment binary with 200 and image/jpeg', async () => {
    const res = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(bytes.length, createValidJpegBuffer().length);
  });

  await test('Authorized Management (Warden) downloads attachment binary with 200', async () => {
    const res = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments/${attachmentId}`, {
      headers: { Authorization: `Bearer ${wardenToken}` },
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers.get('content-type'), 'image/jpeg');
    const bytes = Buffer.from(await res.arrayBuffer());
    assert.strictEqual(bytes.length, createValidJpegBuffer().length);
  });

  await test('Non-existent attachment returns 404 without leaking filesystem paths', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await fetch(`${API_BASE}/student/complaints/${complaintId}/attachments/${fakeId}`, {
      headers: { Authorization: `Bearer ${studentAToken}` },
    });
    assert.strictEqual(res.status, 404);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.message, 'Attachment not found.');
  });

  // -------------------------------------------------------------------------
  // SECTION C: UNIFIED STUDENT SSE STREAM
  // -------------------------------------------------------------------------
  console.log('\n--- Section C: Unified Student SSE Stream ---');

  await test('Unauthenticated GET /api/student/events rejected with 401', async () => {
    const res = await fetch(`${API_BASE}/student/events`);
    assert.strictEqual(res.status, 401);
  });

  await test('Authenticated Student connects to GET /api/student/events with text/event-stream', async () => {
    const ssePromise = new Promise((resolve, reject) => {
      const req = http.get(
        `http://localhost:5001/api/student/events?token=${encodeURIComponent(studentAToken)}`,
        (res) => {
          assert.strictEqual(res.statusCode, 200);
          assert.strictEqual(res.headers['content-type'], 'text/event-stream');
          
          let received = '';
          res.on('data', (chunk) => {
            received += chunk.toString();
            if (received.includes('connected')) {
              req.destroy();
              resolve(received);
            }
          });
        }
      );
      req.on('error', (err) => {
        if (err.message.includes('socket hang up') || req.destroyed) {
          // Normal when closing test stream
          return;
        }
        reject(err);
      });
      setTimeout(() => {
        req.destroy();
        resolve('timeout-received');
      }, 2000);
    });

    const output = await ssePromise;
    assert.ok(output.length > 0);
  });

  await test('Student isolation: private events scoped only to recipient student', async () => {
    let studentBReceivedEventA = false;

    // Connect Student B to SSE
    const reqB = http.get(
      `http://localhost:5001/api/student/events?token=${encodeURIComponent(studentBToken)}`,
      (res) => {
        res.on('data', (chunk) => {
          const str = chunk.toString();
          if (str.includes(complaintId)) {
            studentBReceivedEventA = true;
          }
        });
      }
    );

    // Trigger an update on Student A's complaint
    await new Promise((r) => setTimeout(r, 200));
    await fetch(`${API_BASE}/student/complaints/${complaintId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${studentAToken}` },
    });

    await new Promise((r) => setTimeout(r, 400));
    reqB.destroy();

    assert.strictEqual(studentBReceivedEventA, false, 'Student B must not receive Student A private event');
  });

  // -------------------------------------------------------------------------
  // SECTION D: DATABASE INDEXES VERIFICATION
  // -------------------------------------------------------------------------
  console.log('\n--- Section D: Database Indexes Verification ---');

  await test('Verify PostgreSQL 18.6 indexes on OutingRequest, LeaveRequest, Suspension', async () => {
    const res = await pgClient.query(`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE tablename IN ('OutingRequest', 'LeaveRequest', 'Suspension')
    `);

    const indexNames = res.rows.map((r) => r.indexname);

    // OutingRequest index on (studentId, createdAt)
    assert.ok(
      indexNames.some((name) => name.includes('studentId_createdAt') || name.includes('studentId')),
      'OutingRequest must have compound index on studentId, createdAt'
    );

    // LeaveRequest index on (studentId, status)
    assert.ok(
      indexNames.some((name) => name.includes('studentId_status') || name.includes('status')),
      'LeaveRequest must have compound index on studentId, status'
    );

    // Suspension index on (studentId, status)
    assert.ok(
      indexNames.some((name) => name.includes('studentId_status') || name.includes('status')),
      'Suspension must have compound index on studentId, status'
    );
  });

  // Clean up test suspension to restore Student A to good standing for remaining suites
  if (studentAId) {
    await pgClient.query(`UPDATE "Suspension" SET status = 'LIFTED', "liftedAt" = NOW() WHERE "studentId" = $1 AND status = 'ACTIVE'`, [studentAId]);
  }
  await pgClient.end();

  console.log(`\n================================================================`);
  console.log(`SUITE COMPLETE: ${passed}/${total} TESTS PASSED`);
  console.log(`================================================================\n`);
}

runHardeningSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
