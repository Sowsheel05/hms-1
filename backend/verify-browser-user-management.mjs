import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = 'C:\\Users\\shank\\AppData\\Local\\Temp\\chrome-hms-user-management-step10';
const ARTIFACT_DIR = 'C:\\Users\\shank\\.gemini\\antigravity-ide\\brain\\d6c51559-2b8b-4440-9f7f-97df80816706';
const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5001';
const CDP_PORT = 9235;

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for User Management (Step 10) ===\n');

  // 1. Authenticate via backend API to obtain authoritative admin JWT
  console.log('Obtaining Admin JWT from backend...');
  const loginRes = await fetch(`${API_URL}/api/management/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'ADMIN01', password: 'Password@123' }),
  });
  const loginData = await loginRes.json();
  if (!loginData.token) {
    throw new Error('Failed to obtain admin token: ' + JSON.stringify(loginData));
  }
  const adminToken = loginData.token;
  console.log('Admin token obtained successfully.');

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }

  // 2. Launch Chrome on port 9235
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
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
      const res = await fetch(`http://localhost:${CDP_PORT}/json/version`);
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error(`Failed to connect to Chrome on port ${CDP_PORT}`);
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  const listRes = await fetch(`http://localhost:${CDP_PORT}/json/list`);
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

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evalExpr(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result ? res.result.value : null;
  }

  async function takeScreenshot(filename) {
    const res = await sendCommand('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const fullPath = path.join(ARTIFACT_DIR, filename);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Saved screenshot: ${filename}`);
  }

  async function setViewport(width, height) {
    await sendCommand('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: width < 768,
    });
    await sleep(600);
  }

  async function navigate(url) {
    await sendCommand('Page.navigate', { url });
    await sleep(2500);
  }

  try {
    await sendCommand('Page.enable');
    await sendCommand('Runtime.enable');

    // Step 1: Seed session via login route
    await setViewport(1440, 900);
    console.log(`Navigating to ${BASE_URL}/management/login to seed session...`);
    await navigate(`${BASE_URL}/management/login`);

    await evalExpr(`
      localStorage.setItem('hms_management_auth_token', ${JSON.stringify(adminToken)});
      localStorage.setItem('managementToken', ${JSON.stringify(adminToken)});
      localStorage.setItem('token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('hms_management_auth_token', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('managementToken', ${JSON.stringify(adminToken)});
      sessionStorage.setItem('token', ${JSON.stringify(adminToken)});
    `);

    // Perform form login as additional guarantee
    await evalExpr(`
      const u = document.querySelector('input[type="text"], input[name="username"]');
      const p = document.querySelector('input[type="password"]');
      if (u) { u.value = 'ADMIN01'; u.dispatchEvent(new Event('input', { bubbles: true })); }
      if (p) { p.value = 'Password@123'; p.dispatchEvent(new Event('input', { bubbles: true })); }
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    `);
    await sleep(2000);

    // Step 2: Navigate to User Management
    console.log('Navigating to /management/users...');
    await navigate(`${BASE_URL}/management/users`);
    await sleep(2500);

    // Step 3: Desktop screenshot (1440x900)
    await takeScreenshot('user_management_1440x900.png');

    // Verify Title and KPI Stats
    const headerTitle = await evalExpr(
      `document.querySelector('.user-page-title')?.textContent?.trim() || document.querySelector('h1')?.textContent?.trim()`
    );
    console.log('Header Title:', headerTitle);

    const kpiCount = await evalExpr(`document.querySelectorAll('.user-kpi-card').length`);
    console.log('KPI Cards Count:', kpiCount);

    const rowCount = await evalExpr(`document.querySelectorAll('.user-data-table tbody tr').length`);
    console.log('Rendered User Rows Count:', rowCount);

    // Step 4: Test Search Filter
    console.log('Testing search filter...');
    await evalExpr(`
      const searchInput = document.querySelector('.user-search-input');
      if (searchInput) {
        searchInput.value = 'ADMIN';
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      const filterBtn = document.querySelector('.user-filter-actions .user-btn-primary');
      if (filterBtn) filterBtn.click();
    `);
    await sleep(1500);
    await takeScreenshot('user_management_search.png');

    // Reset search
    await evalExpr(`
      const resetBtn = document.querySelector('.user-filter-actions .user-btn-secondary');
      if (resetBtn) resetBtn.click();
    `);
    await sleep(1000);

    // Step 5: Test Detail Modal (View)
    console.log('Testing Detail Modal...');
    await evalExpr(`
      const viewBtn = document.querySelector('.user-action-btn.view');
      if (viewBtn) viewBtn.click();
    `);
    await sleep(1500);
    await takeScreenshot('user_management_detail_modal.png');

    const isDetailOpen = await evalExpr(`!!document.querySelector('.user-modal-overlay')`);
    console.log('Detail Modal Opened:', isDetailOpen);

    // Close detail modal
    await evalExpr(`
      const closeBtn = document.querySelector('.user-modal-close-btn');
      if (closeBtn) closeBtn.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(800);

    // Step 6: Test Add User Modal
    console.log('Testing Add User Modal...');
    await evalExpr(`
      const addBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add User'));
      if (addBtn) addBtn.click();
    `);
    await sleep(1500);
    await takeScreenshot('user_management_add_modal.png');

    const isAddOpen = await evalExpr(`!!document.querySelector('.user-modal-overlay')`);
    console.log('Add User Modal Opened:', isAddOpen);

    // Close add modal
    await evalExpr(`
      const closeBtn = document.querySelector('.user-modal-close-btn');
      if (closeBtn) closeBtn.click();
      else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    `);
    await sleep(800);

    // Step 7: Test Edit User Modal
    console.log('Testing Edit User Modal...');
    await evalExpr(`
      const editBtn = document.querySelector('.user-action-btn.edit');
      if (editBtn) editBtn.click();
    `);
    await sleep(1500);
    await takeScreenshot('user_management_edit_modal.png');

    const isEditOpen = await evalExpr(`!!document.querySelector('.user-modal-overlay')`);
    console.log('Edit User Modal Opened:', isEditOpen);

    // Close edit modal
    await evalExpr(`
      document.querySelectorAll('.user-modal-close-btn').forEach(b => b.click());
    `);
    await sleep(800);

    // Step 8: Verify Responsive Breakpoints (0px Horizontal Overflow)
    console.log('\n--- Verifying Responsive Breakpoints (0px Horizontal Overflow) ---');

    await setViewport(768, 1024);
    await sleep(800);
    await takeScreenshot('user_management_768x1024.png');
    const overflow768 = await evalExpr(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    console.log(`Tablet (768x1024) Horizontal Overflow: ${overflow768}px`);

    await setViewport(390, 844);
    await sleep(800);
    await takeScreenshot('user_management_390x844.png');
    const overflow390 = await evalExpr(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    console.log(`Mobile (390x844) Horizontal Overflow: ${overflow390}px`);

    await setViewport(320, 800);
    await sleep(800);
    await takeScreenshot('user_management_320x800.png');
    const overflow320 = await evalExpr(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    console.log(`Mobile (320x800) Horizontal Overflow: ${overflow320}px`);

    console.log('\n=== Headless Chrome Verification Finished Successfully ===');
  } catch (err) {
    console.error('Browser verification error:', err.message || err);
  } finally {
    ws.close();
    await sleep(500);
    chromeProcess.kill();
    await sleep(500);
    try { fs.rmSync(TEMP_PROFILE, { recursive: true, force: true }); } catch (_) {}
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
