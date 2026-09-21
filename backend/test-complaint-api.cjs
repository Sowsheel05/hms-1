const assert = require('assert');

async function testComplaintApi() {
  console.log('=== Running Student Hostel Complaints API Tests ===\n');

  // 1. Authenticate as MANI MANASVI GAVARA (Allocated student)
  const loginRes = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H7', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, 'Login must succeed');
  const manasviToken = loginData.token;

  // 2. Unauthenticated request to /api/student/complaints must return 401
  const unauthRes = await fetch('http://localhost:5001/api/student/complaints');
  assert.strictEqual(unauthRes.status, 401, 'Unauthenticated request must return 401');
  console.log('[PASS] 1. Unauthenticated request to /api/student/complaints rejected with 401');

  // 3. Authenticated request to /api/student/complaints
  const authRes = await fetch('http://localhost:5001/api/student/complaints', {
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  const authData = await authRes.json();
  assert.strictEqual(authRes.status, 200, 'Authenticated request must return 200');
  assert.strictEqual(authData.success, true);
  assert.strictEqual(authData.student.jntuNo, '25331A05H7');
  assert.strictEqual(typeof authData.summary.total, 'number');
  assert.strictEqual(typeof authData.summary.open, 'number');
  assert.strictEqual(typeof authData.summary.inProgress, 'number');
  assert.strictEqual(typeof authData.summary.resolved, 'number');
  const initialTotal = authData.summary.total;
  const initialCancelled = authData.summary.cancelled || 0;
  const initialOpen = authData.summary.open || 0;
  console.log('[PASS] 2. Authenticated student receives accurate initial complaints state:', authData.summary);

  // 4. Validation tests
  // 4a. Missing title
  const noTitleRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'ELECTRICAL',
      description: 'The ceiling fan regulator is broken and sparking.',
    }),
  });
  assert.strictEqual(noTitleRes.status, 400, 'Missing title must return 400');
  console.log('[PASS] 3. Missing title rejected with 400');

  // 4b. Short description
  const shortDescRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'ELECTRICAL',
      title: 'Fan broken',
      description: 'Fix it', // <10 chars
    }),
  });
  assert.strictEqual(shortDescRes.status, 400, 'Short description must return 400');
  console.log('[PASS] 4. Short description rejected with 400');

  // 4c. Invalid category
  const invalidCatRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'INVALID_CATEGORY',
      title: 'Fan broken',
      description: 'The fan regulator is completely non-functional.',
    }),
  });
  assert.strictEqual(invalidCatRes.status, 400, 'Invalid category must return 400');
  console.log('[PASS] 5. Invalid category rejected with 400');

  // 5. Valid Complaint Creation
  const testTitle = 'Ceiling fan speed regulator sparking - ' + Date.now();
  const validRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'ELECTRICAL',
      title: testTitle,
      description: 'The fan regulator in room 119 is sparking and stuck on high speed.',
      priority: 'HIGH',
      status: 'RESOLVED', // Client privilege tamper attempt! Must be forced to OPEN
    }),
  });
  const validData = await validRes.json();
  assert.strictEqual(validRes.status, 201, 'Valid complaint creation must return 201 Created');
  assert.strictEqual(validData.success, true);
  assert.strictEqual(validData.complaint.status, 'OPEN', 'Status must be server-enforced OPEN');
  assert(validData.complaint.ticketNumber.startsWith('CMP-'), 'Ticket number must start with CMP-');
  assert.strictEqual(validData.complaint.category, 'ELECTRICAL');
  assert(validData.complaint.location === 'GH-1 - Room 119' || validData.complaint.location === 'Girls-Block-B - Room 119', 'Location auto-populated with room');
  const complaintId = validData.complaint.id;
  console.log('[PASS] 6. Valid complaint created with auto-assigned ticket number & location:', validData.complaint.ticketNumber);

  // 6. Duplicate Complaint Prevention
  const dupRes = await fetch('http://localhost:5001/api/student/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      category: 'ELECTRICAL',
      title: testTitle,
      description: 'The fan regulator in room 119 is sparking and stuck on high speed.',
      priority: 'HIGH',
    }),
  });
  assert.strictEqual(dupRes.status, 409, 'Duplicate complaint within 3 minutes must return 409 Conflict');
  const dupData = await dupRes.json();
  console.log('[PASS] 7. Duplicate complaint prevented with 409 Conflict:', dupData.message);

  // 7. Student adds follow-up comment to own complaint
  const commentRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/comment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      comment: 'Please send an electrician after 3:00 PM when we return from classes.',
    }),
  });
  const commentData = await commentRes.json();
  assert.strictEqual(commentRes.status, 200, 'Adding comment must return 200 OK');
  assert.strictEqual(commentData.success, true);
  assert.strictEqual(commentData.complaint.commentsList.length, 1);
  assert.strictEqual(commentData.complaint.commentsList[0].author, 'MANI MANASVI GAVARA');
  console.log('[PASS] 8. Student successfully added follow-up comment to complaint');

  // 8. IDOR Protection: Student B attempts to comment on or cancel Student A's complaint
  const student2Login = await fetch('http://localhost:5001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jntuNo: '25331A05H8', password: 'Password@123' }),
  });
  const student2Data = await student2Login.json();
  const student2Token = student2Data.token;

  const idorCancelRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${student2Token}` },
  });
  assert.strictEqual(idorCancelRes.status, 403, 'Student B cancelling Student A complaint must be rejected with 403');
  console.log('[PASS] 9. IDOR protected: Student B cannot cancel Student A complaint (403 Forbidden)');

  // 9. Student A cancels own OPEN complaint
  const cancelRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  assert.strictEqual(cancelRes.status, 200, 'Cancelling own OPEN complaint must return 200');
  const cancelData = await cancelRes.json();
  assert.strictEqual(cancelData.complaint.status, 'CANCELLED');
  console.log('[PASS] 10. Student successfully cancelled own OPEN complaint');

  // 10. Repeat cancellation of already cancelled complaint
  const repeatCancelRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  assert.strictEqual(repeatCancelRes.status, 400, 'Cancelling non-OPEN complaint must return 400');
  console.log('[PASS] 11. Repeat cancellation rejected with 400');

  // 11. Attempting to add note to cancelled complaint
  const noteOnCancelledRes = await fetch(`http://localhost:5001/api/student/complaints/${complaintId}/comment`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${manasviToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ comment: 'Another note' }),
  });
  assert.strictEqual(noteOnCancelledRes.status, 400, 'Adding comment on cancelled complaint must return 400');
  console.log('[PASS] 12. Cannot add follow-up notes on cancelled complaints (400 Bad Request)');

  // 12. Verify updated aggregate summary
  const updatedRes = await fetch('http://localhost:5001/api/student/complaints', {
    headers: { Authorization: `Bearer ${manasviToken}` },
  });
  const updatedData = await updatedRes.json();
  assert.strictEqual(updatedData.summary.total, initialTotal + 1);
  assert.strictEqual(updatedData.summary.cancelled, initialCancelled + 1);
  assert.strictEqual(updatedData.summary.open, initialOpen);
  console.log(`[PASS] 13. Authoritative summary correctly reflects ${updatedData.summary.total} total, ${updatedData.summary.cancelled} cancelled, ${initialOpen} open`);

  console.log('\nAll Complaints API Tests Passed Successfully!');
}

testComplaintApi().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
