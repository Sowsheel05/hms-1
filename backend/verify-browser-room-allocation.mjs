import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome-hms-room-allocation-test');
const ARTIFACT_DIR = path.join(os.tmpdir(), 'hms-browser-artifacts');

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for Room Allocation ===\n');

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // Launch Chrome with remote debugging
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9223',
      `--user-data-dir=${TEMP_PROFILE}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--window-size=1440,900',
    ],
    { stdio: 'ignore' }
  );

  let versionData = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://localhost:9223/json/version');
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Failed to connect to Chrome on port 9223');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  // Connect to target page
  const listRes = await fetch('http://localhost:9223/json/list');
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

  // 1. Authenticate Admin via LocalStorage and Navigate to Room Allocation
  console.log('\nStep 1: Authenticating Admin and Navigating to Room Allocation...');
  await send('Page.navigate', { url: 'http://localhost:5173/management/login' });
  await sleep(1500);

  // Obtain admin token via API
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

  await send('Page.navigate', { url: 'http://localhost:5173/management/rooms' });
  await sleep(2500);

  // 2. Verify Page Title & Status Indicator
  console.log('Step 2: Verifying Page Title and Authoritative Status Indicator...');
  const title = await evaluate(`document.querySelector('.room-allocation-main-title')?.innerText`);
  const badgeText = await evaluate(`document.querySelector('.pending-allocations-badge')?.innerText`);
  console.log(`Page Title: "${title}"`);
  console.log(`Status Indicator: "${badgeText}"`);

  if (!title || !title.includes('Room Allocation')) {
    throw new Error(`Expected title "Room Allocation", got "${title}"`);
  }
  if (!badgeText || !badgeText.includes('pending allocations')) {
    throw new Error(`Expected badge with "pending allocations", got "${badgeText}"`);
  }

  // 3. Verify Candidate Card
  console.log('Step 3: Verifying Pending Resident Card Details...');
  const studentName = await evaluate(`document.querySelector('.student-full-name')?.innerText`);
  const studentJntu = await evaluate(`document.querySelector('.student-jntu-id')?.innerText`);
  console.log(`Resident: "${studentName}" (${studentJntu})`);

  if (!studentName || !studentName.includes('VANA BHARGAV PRASAD')) {
    throw new Error(`Expected student VANA BHARGAV PRASAD, got "${studentName}"`);
  }
  if (!studentJntu || !studentJntu.includes('23331A4462')) {
    throw new Error(`Expected JNTU 23331A4462, got "${studentJntu}"`);
  }

  // 4. Test Search Functionality
  console.log('Step 4: Testing Realtime Server-Side Search...');
  await evaluate(`{
    const input = document.querySelector('.allocation-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'BHARGAV');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  await sleep(1000);
  let cardCount = await evaluate(`document.querySelectorAll('.pending-resident-card').length`);
  console.log(`Cards matching 'BHARGAV': ${cardCount}`);
  if (cardCount !== 1) throw new Error(`Expected 1 card for 'BHARGAV', got ${cardCount}`);

  // Test Nonexistent Search
  await evaluate(`{
    const input = document.querySelector('.allocation-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, 'NONEXISTENT_QUERY_XYZ');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  await sleep(1000);
  const emptyStateText = await evaluate(`document.querySelector('.empty-state-title')?.innerText`);
  console.log(`Empty state on nonexistent search: "${emptyStateText}"`);
  if (!emptyStateText || !emptyStateText.includes('No pending allocations')) {
    throw new Error(`Expected empty state on nonexistent search, got "${emptyStateText}"`);
  }

  // Clear Search
  await evaluate(`{
    const input = document.querySelector('.allocation-search-input');
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }`);
  await sleep(1000);

  // 5. Test Modals: View Modal
  console.log('Step 5: Testing View Resident Modal...');
  await evaluate(`document.querySelector('.btn-card-view')?.click()`);
  await sleep(500);
  const viewModalTitle = await evaluate(`document.querySelector('.notice-modal-title')?.innerText`);
  console.log(`View Modal Title: "${viewModalTitle}"`);
  await captureScreenshot('room_allocation_view_modal.png');
  // Close view modal
  await evaluate(`document.querySelector('.notice-close-btn')?.click()`);
  await sleep(300);

  // 6. Test Modals: Assign Modal (Room Selection)
  console.log('Step 6: Testing Assign Modal (Room Selection)...');
  await evaluate(`document.querySelector('.btn-card-assign')?.click()`);
  await sleep(500);
  const assignModalTitle = await evaluate(`document.querySelector('.notice-modal-title')?.innerText`);
  const availableRoomsCount = await evaluate(`document.querySelectorAll('.room-select-item').length`);
  console.log(`Assign Modal Title: "${assignModalTitle}", Available Rooms Listed: ${availableRoomsCount}`);
  await captureScreenshot('room_allocation_assign_modal.png');
  // Select first room
  await evaluate(`document.querySelector('.room-select-item')?.click()`);
  await sleep(300);
  // Close modal without submitting
  await evaluate(`document.querySelector('.notice-close-btn')?.click()`);
  await sleep(300);

  // 7. Test Modals: Reject Modal
  console.log('Step 7: Testing Reject Confirmation Modal...');
  await evaluate(`document.querySelector('.btn-card-reject')?.click()`);
  await sleep(500);
  const rejectModalTitle = await evaluate(`document.querySelector('.notice-modal-title')?.innerText`);
  console.log(`Reject Modal Title: "${rejectModalTitle}"`);
  // Close modal without submitting
  await evaluate(`document.querySelector('.notice-close-btn')?.click()`);
  await sleep(300);

  // 8. Test Modals: Map Biometric Status Modal
  console.log('Step 8: Testing Map Biometric Status Modal...');
  await evaluate(`{
    const btns = Array.from(document.querySelectorAll('.btn-navy-primary'));
    const bioBtn = btns.find(b => b.innerText.includes('Biometric'));
    bioBtn?.click();
  }`);
  await sleep(500);
  const bioModalTitle = await evaluate(`document.querySelector('.notice-modal-title')?.innerText`);
  console.log(`Biometric Modal Title: "${bioModalTitle}"`);
  await evaluate(`document.querySelector('.notice-close-btn')?.click()`);
  await sleep(300);

  // 9. Responsive Viewport Verification & Screenshots
  console.log('\nStep 9: Verifying Responsive Viewports (320px, 390px, 768px, 1440px)...');

  const viewports = [
    { width: 1440, height: 900, name: 'room_allocation_1440x900.png', label: 'Desktop (1440x900)' },
    { width: 768, height: 1024, name: 'room_allocation_768x1024.png', label: 'Tablet (768x1024)' },
    { width: 390, height: 844, name: 'room_allocation_390x844.png', label: 'Mobile standard (390x844)' },
    { width: 320, height: 800, name: 'room_allocation_320x800.png', label: 'Mobile small (320x800)' },
  ];

  for (const vp of viewports) {
    await setViewport(vp.width, vp.height);
    const overflowX = await evaluate(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`${vp.label}: horizontal overflow = ${overflowX}px`);
    if (overflowX > 1) {
      throw new Error(`Horizontal overflow detected on ${vp.label}: ${overflowX}px`);
    }
    await captureScreenshot(vp.name);
  }

  console.log('\n====================================================');
  console.log('  ALL BROWSER CDP VERIFICATION STEPS PASSED PERFECTLY!');
  console.log('====================================================\n');

  ws.close();
  chromeProcess.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal Browser CDP Test Error:', err);
  process.exit(1);
});
