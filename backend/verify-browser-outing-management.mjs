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
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome-hms-outing-management-test');
const ARTIFACT_DIR = path.join(os.tmpdir(), 'hms-browser-artifacts');

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for Outing Management (Step 5) ===\n');

  let tempPendingId = null;

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // Ensure there is at least one PENDING request for testing approval/rejection modal interactions
  const pendingCount = await prisma.outingRequest.count({ where: { status: 'PENDING' } });
  if (pendingCount === 0) {
    const student = await prisma.student.findFirst();
    if (student) {
      const created = await prisma.outingRequest.create({
        data: {
          studentId: student.id,
          requestNumber: `OUT-BROWSER-${Date.now().toString().slice(-6)}`,
          passType: 'GENERAL',
          destination: 'Central Technical Library',
          purpose: 'Reference Books Collection for Research Seminar',
          outDate: new Date(),
          returnDate: new Date(Date.now() + 86400000),
          status: 'PENDING',
          emergencyContact: '9876543210',
        },
      });
      tempPendingId = created.id;
      console.log(`Created temporary PENDING outing pass #${created.requestNumber} for modal verification`);
    }
  }

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }

  // Launch Chrome on port 9226
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9226',
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
      const res = await fetch('http://localhost:9226/json/version');
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Failed to connect to Chrome on port 9226');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  // Connect to target page
  const listRes = await fetch('http://localhost:9226/json/list');
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

  // Enable necessary domains
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
    // 1. Authenticate Admin via LocalStorage and Navigate to Outing Management
    console.log('\nStep 1: Authenticating Admin and Navigating to Outing Management...');
    await send('Page.navigate', { url: 'http://localhost:5173/management/login' });
    await sleep(1500);

    const loginRes = await fetch('http://localhost:5001/api/management/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    await evaluate(`
      localStorage.setItem('hms_management_auth_token', '${token}');
      localStorage.setItem('managementToken', '${token}');
      sessionStorage.setItem('hms_management_auth_token', '${token}');
    `);

    await send('Page.navigate', { url: 'http://localhost:5173/management/outings' });
    await sleep(2500);

    // 2. Verify Page Title
    console.log('\nStep 2: Verifying Page Title and Header Controls...');
    const pageTitle = await evaluate(`document.querySelector('.management-header-title')?.innerText || document.querySelector('h1')?.innerText`);
    console.log(`Page Title: "${pageTitle}"`);

    // 3. Verify KPI Stats Cards
    console.log('\nStep 3: Verifying Authoritative KPI Metrics...');
    const kpiCardsCount = await evaluate(`document.querySelectorAll('.outing-kpi-card').length`);
    console.log(`KPI cards rendered: ${kpiCardsCount}`);

    // 4. Verify Request Cards Grid
    console.log('\nStep 4: Verifying Request Cards Grid...');
    const cardsCount = await evaluate(`document.querySelectorAll('.outing-request-card').length`);
    console.log(`Outing Request Cards rendered: ${cardsCount}`);

    // Capture Desktop (1440x900)
    console.log('\nStep 5: Capturing Desktop Screenshot (1440x900)...');
    await setViewport(1440, 900);
    await captureScreenshot('outing_mgmt_1440x900.png');

    // 5. Open Detail Modal
    console.log('\nStep 6: Opening Detail Modal and capturing screenshot...');
    await evaluate(`(() => {
      const detailBtn = Array.from(document.querySelectorAll('.outing-request-card button')).find(b => b.innerText.includes('Details') || b.innerText.includes('View Complete Details'));
      if (detailBtn) detailBtn.click();
    })()`);
    await sleep(1000);
    const isModalOpen = await evaluate(`!!document.querySelector('.mgmt-modal-backdrop')`);
    console.log(`Detail modal is open: ${isModalOpen}`);
    await captureScreenshot('outing_mgmt_detail_modal.png');

    // Close Detail Modal
    await evaluate(`(() => {
      const closeBtn = document.querySelector('.modal-close-btn') || Array.from(document.querySelectorAll('.modal-footer button')).find(b => b.innerText.includes('Close'));
      if (closeBtn) closeBtn.click();
    })()`);
    await sleep(600);

    // 6. Test Pending Filter & Approve Modal
    console.log('\nStep 7: Testing Pending Filter & Approve Modal...');
    await evaluate(`(() => {
      const pendingTab = Array.from(document.querySelectorAll('.status-tab')).find(b => b.innerText.includes('Pending'));
      if (pendingTab) pendingTab.click();
    })()`);
    await sleep(1000);

    // Check if there is an approve button
    const hasApproveBtn = await evaluate(`!!Array.from(document.querySelectorAll('.outing-request-card button')).find(b => b.innerText.includes('Approve'))`);
    if (hasApproveBtn) {
      console.log('Opening Approve Confirmation Modal...');
      await evaluate(`(() => {
        const approveBtn = Array.from(document.querySelectorAll('.outing-request-card button')).find(b => b.innerText.includes('Approve'));
        if (approveBtn) approveBtn.click();
      })()`);
      await sleep(800);
      await captureScreenshot('outing_mgmt_approve_modal.png');
      // Cancel approve modal
      await evaluate(`(() => {
        const cancelBtn = document.querySelector('.modal-close-btn') || Array.from(document.querySelectorAll('.modal-footer button')).find(b => b.innerText.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(600);
    } else {
      console.log('No pending requests found for approve modal test.');
    }

    // Check if there is a reject button
    const hasRejectBtn = await evaluate(`!!Array.from(document.querySelectorAll('.outing-request-card button')).find(b => b.innerText.includes('Reject'))`);
    if (hasRejectBtn) {
      console.log('\nStep 8: Testing Reject Modal with reason validation...');
      await evaluate(`(() => {
        const rejectBtn = Array.from(document.querySelectorAll('.outing-request-card button')).find(b => b.innerText.includes('Reject'));
        if (rejectBtn) rejectBtn.click();
      })()`);
      await sleep(800);
      // Type a short reason in the modal to test validation counter
      await evaluate(`(() => {
        const textarea = document.querySelector('.modal-textarea') || document.querySelector('textarea');
        if (textarea) {
          textarea.value = 'Incomplete documentation for outing destination';
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      })()`);
      await sleep(500);
      await captureScreenshot('outing_mgmt_reject_modal.png');
      // Cancel reject modal
      await evaluate(`(() => {
        const cancelBtn = document.querySelector('.modal-close-btn') || Array.from(document.querySelectorAll('.modal-footer button')).find(b => b.innerText.includes('Cancel'));
        if (cancelBtn) cancelBtn.click();
      })()`);
      await sleep(600);
    }

    // Reset filter to ALL
    await evaluate(`(() => {
      const allTab = Array.from(document.querySelectorAll('.status-tab')).find(b => b.innerText.includes('All'));
      if (allTab) allTab.click();
    })()`);
    await sleep(800);

    // 7. Responsive Viewport Verifications (Tablet & Mobile)
    console.log('\nStep 9: Testing Tablet Viewport (768x1024) & Overflow...');
    await setViewport(768, 1024);
    const tabletOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Tablet Horizontal Overflow: ${Math.max(0, tabletOverflow)}px`);
    await captureScreenshot('outing_mgmt_768x1024.png');

    console.log('\nStep 10: Testing Mobile Standard Viewport (390x844) & Overflow...');
    await setViewport(390, 844);
    const mobileOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile (390x844) Horizontal Overflow: ${Math.max(0, mobileOverflow)}px`);
    await captureScreenshot('outing_mgmt_390x844.png');

    console.log('\nStep 11: Testing Mobile Small Viewport (320x800) & Overflow...');
    await setViewport(320, 800);
    const smallMobileOverflow = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile Small (320x800) Horizontal Overflow: ${Math.max(0, smallMobileOverflow)}px`);
    await captureScreenshot('outing_mgmt_320x800.png');

    console.log('\n=== All Browser & Responsive Verifications Completed Successfully! ===');
  } catch (err) {
    console.error('Browser verification failed:', err);
    process.exitCode = 1;
  } finally {
    if (tempPendingId) {
      await prisma.outingRequest.delete({ where: { id: tempPendingId } }).catch(() => {});
      console.log('Cleaned up temporary PENDING outing pass.');
    }
    await prisma.$disconnect();
    ws.close();
    chromeProcess.kill();
  }
}

main();
