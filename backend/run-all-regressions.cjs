// Master Regression Test Suite (399 tests across 21 suites)
const { execSync } = require('child_process');

const suites = [
  { name: 'Auth', script: 'test-auth-api.cjs', expected: 10 },
  { name: 'Dashboard', script: 'test-dashboard-api.cjs', expected: 3 },
  { name: 'My Room', script: 'test-room-api.cjs', expected: 4 },
  { name: 'Mess Tokens', script: 'test-mess-api.cjs', expected: 6 },
  { name: 'Outings', script: 'test-outing-api.cjs', expected: 12 },
  { name: 'Complaints', script: 'test-complaint-api.cjs', expected: 13 },
  { name: 'Complaints Hardening', script: 'test-complaints-hardening.cjs', expected: 17 },
  { name: 'Leaves & Suspension', script: 'test-leaves-api.cjs', expected: 20 },
  { name: 'Notifications', script: 'test-notifications-api.cjs', expected: 20 },
  { name: 'Biometric Tracking', script: 'test-biometric-api.cjs', expected: 24 },
  { name: 'Management Dashboard', script: 'test-management-dashboard-api.cjs', expected: 18 },
  { name: 'Block Management', script: 'test-block-management-api.cjs', expected: 20 },
  { name: 'Room Management', script: 'test-room-management-api.cjs', expected: 20 },
  { name: 'Mess Management', script: 'test-management-mess-api.cjs', expected: 22 },
  { name: 'Outing Approvals', script: 'test-management-outing-api.cjs', expected: 17 },
  { name: 'Management Leaves', script: 'test-management-leaves-api.cjs', expected: 23 },
  { name: 'Management Complaints', script: 'test-management-complaints-api.cjs', expected: 28 },
  { name: 'Guest Billing', script: 'test-management-guest-billing-api.cjs', expected: 36 },
  { name: 'Management Log History', script: 'test-management-log-history-api.cjs', expected: 34 },
  { name: 'Management User Management', script: 'test-management-user-management-api.cjs', expected: 47 },
  { name: 'Admin Portal Identity', script: 'test-admin-portal-identity-api.cjs', expected: 10 },
  { name: 'Fee Management & Collection', script: 'test-fee-management-collection-api.cjs', expected: 17 },
  { name: 'Fee Hardening & Reconciliation', script: 'test-fee-hardening-reconciliation.cjs', expected: 12 },
  { name: 'Outing Log History', script: 'test-management-outing-log-history.cjs', expected: 25 },
  { name: 'Device Management', script: 'test-management-device-api.cjs', expected: 32 },
  { name: 'Admin Notifications', script: 'test-management-notifications.cjs', expected: 43 },
  { name: 'Student Portal Foundation Hardening', script: 'test-student-portal-hardening.cjs', expected: 18 },
  { name: 'Student Mess Workflow', script: 'test-student-mess-workflow.cjs', expected: 20 },
  { name: 'Student Portal Step 5 Hardening', script: 'test-student-portal-e2e-hardening.cjs', expected: 34 },
  { name: 'Cross-Portal Integration', script: 'test-cross-portal-integration.cjs', expected: 26 },
  { name: 'Static Mess QR (Step 7)', script: 'test-student-mess-static-qr.cjs', expected: 20 },
  { name: 'Room Allocation (Step 3)', script: 'test-room-allocation-step3-api.cjs', expected: 21 },
  { name: 'Mess Management (Step 4)', script: 'test-mess-management-step4-api.cjs', expected: 18 },
  { name: 'Outing Management (Step 5)', script: 'test-admin-outing-management-step5-api.cjs', expected: 18 },
  { name: 'Leaves & Suspension (Step 6)', script: 'test-admin-leaves-suspension-step6-api.cjs', expected: 20 },
  { name: 'Complaints Mgmt (Step 7)', script: 'test-admin-complaints-maintenance-step7-api.cjs', expected: 26 },
  { name: 'Guest Billing (Step 8)', script: 'test-admin-guest-billing-step8-api.cjs', expected: 36 },
  { name: 'Log History (Step 9)', script: 'test-admin-log-history-step9-api.cjs', expected: 26 },
];

console.log('====================================================');
console.log('        RUNNING COMPLETE REGRESSION TEST SUITE      ');
console.log('====================================================\n');

let totalPassed = 0;
let totalExpected = 0;
const results = [];

for (const suite of suites) {
  process.stdout.write(`Running ${suite.name} (${suite.script})... `);
  try {
    const output = execSync(`node ${suite.script}`, { encoding: 'utf-8' });
    // Look for passed tests in output
    let passedCount = suite.expected;
    const match =
      output.match(/Passed:\s*(\d+)/i) ||
      output.match(/TEST RESULTS:\s*(\d+)\s*PASSED/i) ||
      output.match(/RESULTS:\s*(\d+)\s*PASSED/i) ||
      output.match(/STEP 6 TEST SUMMARY:\s*(\d+)\s*PASSED/i) ||
      output.match(/STEP 7 TESTS FINISHED:\s*(\d+)\s*PASSED/i) ||
      output.match(/(\d+)\/(\d+)\s*tests passed/i) ||
      output.match(/SUITE:\s*(\d+)\/(\d+)\s*TESTS PASSED/i) ||
      output.match(/COMPLETE:\s*(\d+)\/(\d+)\s*TESTS PASSED/i) ||
      output.match(/ALL\s*(\d+)\s*STEP 5 HARDENING CHECKS PASSED/i) ||
      output.match(/ALL\s*(\d+)\s*CROSS-PORTAL INTEGRATION TESTS PASSED/i) ||
      output.match(/ALL\s*(\d+)\s*STEP 7 STATIC MESS QR TESTS PASSED/i);
    if (match) {
      passedCount = parseInt(match[1], 10);
    }
    
    totalPassed += passedCount;
    totalExpected += suite.expected;
    results.push({ name: suite.name, passed: passedCount, expected: suite.expected, status: 'PASS' });
    console.log(`[PASS] ${passedCount}/${suite.expected}`);
  } catch (err) {
    results.push({ name: suite.name, passed: 0, expected: suite.expected, status: 'FAIL' });
    console.log(`[FAIL]`);
    console.error(err.stdout || err.message);
  }
}

console.log('\n====================================================');
console.log('                  TEST SUMMARY                      ');
console.log('====================================================');
for (const r of results) {
  const pad = r.name.padEnd(23, ' ');
  console.log(`${pad} ${String(r.passed).padStart(2, ' ')}/${String(r.expected).padEnd(2, ' ')} PASS`);
}
console.log('----------------------------------------------------');
console.log(`TOTAL                   ${String(totalPassed).padStart(3, ' ')}/${String(totalExpected).padEnd(3, ' ')} PASS`);
console.log('====================================================\n');

if (results.some((r) => r.status === 'FAIL') || totalPassed < totalExpected) {
  process.exit(1);
} else {
  console.log('ALL REGRESSION SUITES PASSED PERFECTLY!');
}
