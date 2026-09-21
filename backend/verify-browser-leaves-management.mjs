import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import os from 'os';

const prisma = new PrismaClient();

function getChromePath() {
  const candidates = [
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const CHROME_PATH = getChromePath();
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome-hms-leaves-management-test');
const ARTIFACT_DIR = path.join(os.tmpdir(), 'hms-browser-artifacts');

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for Leaves & Suspension Management (Step 6) ===\n');

  let tempLeaveId = null;

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // Ensure there is at least one PENDING leave request for testing modal interactions
  const pendingCount = await prisma.leaveRequest.count({ where: { status: 'PENDING' } });
  if (pendingCount === 0) {
    const student = await prisma.student.findFirst();
    if (student) {
      const created = await prisma.leaveRequest.create({
        data: {
          studentId: student.id,
          leaveType: 'HOME',
          reason: 'Family wedding ceremony in hometown',
          startDate: new Date(Date.now() + 86400000),
          endDate: new Date(Date.now() + 4 * 86400000),
          status: 'PENDING',
          emergencyContact: '9876543210',
        },
      });
      tempLeaveId = created.id;
      console.log(`Created temporary PENDING leave request #${created.id} for modal verification`);
    }
  }

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }

  // Launch Chrome on port 9228
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9228',
      `--user-data-dir=${TEMP_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
    { stdio: 'ignore' }
  );

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://localhost:9228/json/version');
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Failed to connect to Chrome on port 9228');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  // Connect to target page
  const listRes = await fetch('http://localhost:9228/json/list');
  const targets = await listRes.json();
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let msgId = 1;
  const pendingRequests = new Map();

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id);
      pendingRequests.delete(data.id);
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    }
  };

  await new Promise((res) => (ws.onopen = res));

  async function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  }

  async function captureScreenshot(filename) {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, Buffer.from(data, 'base64'));
    console.log(`[Screenshot saved] -> ${filename}`);
  }

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await sleep(400);
  }

  try {
    // 1. Authenticate Admin via LocalStorage and Navigate to Leaves Management
    console.log('\nStep 1: Authenticating Admin and Navigating to Leaves & Suspension Management...');
    await send('Page.navigate', { url: 'http://localhost:5173/management/login' });
    await sleep(1500);

    const loginRes = await fetch('http://localhost:5001/api/management/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      throw new Error('Admin login failed');
    }

    await evaluate(`
      localStorage.setItem('hms_management_auth_token', '${loginData.token}');
      localStorage.setItem('managementToken', '${loginData.token}');
      sessionStorage.setItem('hms_management_auth_token', '${loginData.token}');
      localStorage.setItem('user', JSON.stringify(${JSON.stringify(loginData.user)}));
    `);

    await send('Page.navigate', { url: 'http://localhost:5173/management/leaves' });
    await sleep(2500);

    // 2. Verify Page Title & Header
    console.log('\nStep 2: Verifying Page Structure & KPI Stats...');
    const pageTitle = await evaluate(`document.title`);
    console.log('Page Title:', pageTitle);

    const headerText = await evaluate(`document.querySelector('.leaves-main-title')?.textContent || document.querySelector('.management-header-title')?.textContent || ''`);
    console.log('Header Title:', headerText);

    const kpiCardsCount = await evaluate(`document.querySelectorAll('.leaves-kpi-card').length`);
    console.log(`KPI Stat Cards Count: ${kpiCardsCount}`);

    // Verify 1440x900 Desktop View
    await captureScreenshot('leaves_mgmt_1440x900.png');

    // 3. Verify Leave Request Card View
    console.log('\nStep 3: Verifying Leave Request Cards Grid...');
    const cardCount = await evaluate(`document.querySelectorAll('.leave-request-card').length`);
    console.log(`Rendered Leave Request Cards: ${cardCount}`);

    // 4. Test View Details Modal
    console.log('\nStep 4: Opening Leave Details Modal...');
    const hasViewBtn = await evaluate(`(() => {
      const btn = document.querySelector('.btn-view-leave') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('View'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);

    if (hasViewBtn) {
      await sleep(600);
      await captureScreenshot('leaves_mgmt_detail_modal.png');
      // Close modal
      await evaluate(`(() => {
        const closeBtn = document.querySelector('.modal-header button, .btn-modal-close') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.textContent.includes('✕') || b.getAttribute('aria-label') === 'Close');
        if (closeBtn) closeBtn.click();
      })()`);
      await sleep(400);
    }

    // 5. Test Approve Modal
    console.log('\nStep 5: Testing Approve Modal...');
    const hasApproveBtn = await evaluate(`(() => {
      const btn = document.querySelector('.btn-approve-leave') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Approve'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);

    if (hasApproveBtn) {
      await sleep(600);
      await captureScreenshot('leaves_mgmt_approve_modal.png');
      // Close modal without approving to preserve fixture
      await evaluate(`(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(400);
    }

    // 6. Test Reject Modal
    console.log('\nStep 6: Testing Reject Modal...');
    const hasRejectBtn = await evaluate(`(() => {
      const btn = document.querySelector('.btn-reject-leave') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Reject'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()`);

    if (hasRejectBtn) {
      await sleep(600);
      await captureScreenshot('leaves_mgmt_reject_modal.png');
      // Close modal
      await evaluate(`(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(400);
    }

    // 7. Test Suspensions Tab & Modal Interactions
    console.log('\nStep 7: Switching to Disciplinary Suspensions Tab...');
    await evaluate(`(() => {
      const suspTab = document.getElementById('tab-suspensions') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Disciplinary Suspensions') || b.textContent.includes('Suspension'));
      if (suspTab) suspTab.click();
    })()`);
    await sleep(1500);

    const suspCardCount = await evaluate(`document.querySelectorAll('.suspension-card').length`);
    console.log(`Rendered Disciplinary Suspension Cards: ${suspCardCount}`);

    // Open Enforce Suspension Modal
    console.log('Opening Enforce Suspension Modal...');
    await evaluate(`(() => {
      const addBtn = document.getElementById('btn-add-suspension') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Enforce Disciplinary Sanction') || b.textContent.includes('Add Suspension'));
      if (addBtn) addBtn.click();
    })()`);
    await sleep(600);
    await captureScreenshot('leaves_mgmt_suspension_modal.png');

    // Close Add Modal
    await evaluate(`(() => {
      const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    })()`);
    await sleep(400);

    // Open Edit Suspension Modal if a card exists
    if (suspCardCount > 0) {
      console.log('Opening Edit Suspension Modal...');
      await evaluate(`(() => {
        const editBtn = document.querySelector('.btn-edit-suspension') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Edit Sanction') || b.textContent.includes('Edit'));
        if (editBtn) editBtn.click();
      })()`);
      await sleep(600);
      await captureScreenshot('leaves_mgmt_edit_susp_modal.png');

      // Close Edit Modal
      await evaluate(`(() => {
        const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(400);
    }

    // Switch back to Leaves tab for responsive testing
    await evaluate(`(() => {
      const leavesTab = document.getElementById('tab-leaves') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Leave Requests'));
      if (leavesTab) leavesTab.click();
    })()`);
    await sleep(600);

    // 8. Responsive Testing & Overflow Verification
    console.log('\nStep 8: Testing Tablet Viewport (768x1024) & Overflow...');
    await setViewport(768, 1024);
    const tabletOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Tablet (768x1024) Horizontal Overflow: ${Math.max(0, tabletOverflow)}px`);
    await captureScreenshot('leaves_mgmt_768x1024.png');

    console.log('\nStep 9: Testing Mobile Standard Viewport (390x844) & Overflow...');
    await setViewport(390, 844);
    const mobileOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile (390x844) Horizontal Overflow: ${Math.max(0, mobileOverflow)}px`);
    await captureScreenshot('leaves_mgmt_390x844.png');

    console.log('\nStep 10: Testing Mobile Small Viewport (320x800) & Overflow...');
    await setViewport(320, 800);
    const smallMobileOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile Small (320x800) Horizontal Overflow: ${Math.max(0, smallMobileOverflow)}px`);
    await captureScreenshot('leaves_mgmt_320x800.png');

    console.log('\n=== All Browser & Responsive Verifications Completed Successfully! ===');
  } catch (err) {
    console.error('Browser verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (tempLeaveId) {
      await prisma.leaveRequest.delete({ where: { id: tempLeaveId } }).catch(() => {});
      console.log('Cleaned up temporary PENDING leave request.');
    }
    await prisma.$disconnect();
    ws.close();
    chromeProcess.kill();
  }
}

main();
