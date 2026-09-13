import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_PROFILE = 'C:\\Users\\shank\\AppData\\Local\\Temp\\chrome-hms-mess-management-test';
const ARTIFACT_DIR = 'C:\\Users\\shank\\.gemini\\antigravity-ide\\brain\\d6c51559-2b8b-4440-9f7f-97df80816706';

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for Mess Management ===\n');

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }

  // Launch Chrome with remote debugging on 9224
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9224',
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
      const res = await fetch('http://localhost:9224/json/version');
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Failed to connect to Chrome on port 9224');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  // Connect to target page
  const listRes = await fetch('http://localhost:9224/json/list');
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
    // 1. Authenticate Admin via LocalStorage and Navigate to Mess Management
    console.log('\nStep 1: Authenticating Admin and Navigating to Mess Management...');
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

    await send('Page.navigate', { url: 'http://localhost:5173/management/mess' });
    await sleep(2500);

    // 2. Verify Page Title
    console.log('\nStep 2: Verifying Page Title and Subtitle...');
    const pageTitle = await evaluate(`document.querySelector('.mess-main-title')?.innerText`);
    const pageSubTitle = await evaluate(`document.querySelector('.mess-sub-title')?.innerText`);
    console.log(`Page Title: "${pageTitle}"`);
    console.log(`Subtitle: "${pageSubTitle}"`);

    if (!pageTitle || !pageTitle.includes('Mess Management')) {
      throw new Error(`Expected title to include "Mess Management", got "${pageTitle}"`);
    }

    // 3. Tab 1: Configuration
    console.log('\nStep 3: Verifying Tab 1: Configuration...');
    const mealCardsCount = await evaluate(`document.querySelectorAll('.meal-config-card').length`);
    console.log(`Configured Meal Cards rendered: ${mealCardsCount}`);
    if (mealCardsCount < 4) {
      throw new Error(`Expected at least 4 meal cards, got ${mealCardsCount}`);
    }

    // Capture Desktop Screenshot
    await setViewport(1440, 900);
    await captureScreenshot('mess_mgmt_1440x900.png');

    // 4. Test Add Meal Modal
    console.log('\nStep 4: Opening Add Meal Modal...');
    await evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Meal'));
      if (btn) btn.click();
    `);
    await sleep(600);
    const modalVisible = await evaluate(`Boolean(document.querySelector('.notice-modal-backdrop'))`);
    console.log(`Add Meal Modal visible: ${modalVisible}`);
    await captureScreenshot('mess_mgmt_add_modal.png');

    // Close Modal
    await evaluate(`
      const cancelBtn = Array.from(document.querySelectorAll('.notice-modal-card button')).find(b => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    `);
    await sleep(400);

    // 5. Test Tab 2: Analytics
    console.log('\nStep 5: Switching to Tab 2: Analytics...');
    await evaluate(`{
      const tabs = Array.from(document.querySelectorAll('.mess-nav-tab-btn'));
      const analyticsTab = tabs.find(t => t.innerText.includes('Analytics'));
      if (analyticsTab) analyticsTab.click();
    }`);
    await sleep(1500);
    const analyticsCards = await evaluate(`document.querySelectorAll('.analytics-summary-card').length`);
    console.log(`Analytics Cards rendered: ${analyticsCards}`);
    await captureScreenshot('mess_mgmt_analytics_tab.png');

    // 6. Test Tab 3: Indent Plan
    console.log('\nStep 6: Switching to Tab 3: Indent Plan...');
    await evaluate(`{
      const tabs = Array.from(document.querySelectorAll('.mess-nav-tab-btn'));
      const indentTab = tabs.find(t => t.innerText.includes('Indent Plan'));
      if (indentTab) indentTab.click();
    }`);
    await sleep(1500);
    const indentSummaryCards = await evaluate(`document.querySelectorAll('.indent-meal-card').length`);
    console.log(`Indent Summary Cards rendered: ${indentSummaryCards}`);

    // Open Indent Filter Modal
    await evaluate(`{
      const filterBtn = document.querySelector('.indent-action-btns button');
      if (filterBtn) filterBtn.click();
    }`);
    await sleep(500);
    await captureScreenshot('mess_mgmt_indent_filter_modal.png');

    // Close Modal
    await evaluate(`{
      const cancelBtn = Array.from(document.querySelectorAll('.notice-modal-card button')).find(b => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    }`);
    await sleep(400);
    await captureScreenshot('mess_mgmt_indent_tab.png');

    // 7. Test Tab 4: Attendance
    console.log('\nStep 7: Switching to Tab 4: Attendance...');
    await evaluate(`{
      const tabs = Array.from(document.querySelectorAll('.mess-nav-tab-btn'));
      const attendanceTab = tabs.find(t => t.innerText.includes('Attendance'));
      if (attendanceTab) attendanceTab.click();
    }`);
    await sleep(1500);
    const attendanceSummaryCards = await evaluate(`document.querySelectorAll('.attendance-summary-card').length`);
    console.log(`Attendance Summary Cards rendered: ${attendanceSummaryCards}`);

    // Open Attendance Filter Modal
    await evaluate(`{
      const filterBtn = Array.from(document.querySelectorAll('.attendance-action-btns button')).find(b => b.innerText.includes('Filter'));
      if (filterBtn) filterBtn.click();
    }`);
    await sleep(500);
    await captureScreenshot('mess_mgmt_attendance_filter_modal.png');

    // Close Modal
    await evaluate(`{
      const cancelBtn = Array.from(document.querySelectorAll('.notice-modal-card button')).find(b => b.innerText.includes('Cancel'));
      if (cancelBtn) cancelBtn.click();
    }`);
    await sleep(400);
    await captureScreenshot('mess_mgmt_attendance_tab.png');

    // 8. Responsive Viewport Verifications (0px horizontal scroll)
    console.log('\nStep 8: Responsive Verification across Viewports...');
    // Switch back to Configuration for responsive checks
    await evaluate(`{
      const tabs = Array.from(document.querySelectorAll('.mess-nav-tab-btn'));
      const configTab = tabs.find(t => t.innerText.includes('Configuration'));
      if (configTab) configTab.click();
    }`);
    await sleep(600);

    const viewports = [
      { name: 'Tablet (768x1024)', w: 768, h: 1024, file: 'mess_mgmt_768x1024.png' },
      { name: 'Mobile Standard (390x844)', w: 390, h: 844, file: 'mess_mgmt_390x844.png' },
      { name: 'Mobile Small (320x800)', w: 320, h: 800, file: 'mess_mgmt_320x800.png' },
    ];

    for (const vp of viewports) {
      console.log(`• Testing Viewport: ${vp.name}...`);
      await setViewport(vp.w, vp.h);
      await sleep(500);

      const overflowCheck = await evaluate(`({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        windowInnerWidth: window.innerWidth,
      })`);

      const hasOverflow =
        overflowCheck.scrollWidth > overflowCheck.windowInnerWidth ||
        overflowCheck.bodyScrollWidth > overflowCheck.windowInnerWidth;

      console.log(`  ScrollWidth: ${overflowCheck.scrollWidth}px, Window: ${overflowCheck.windowInnerWidth}px`);
      if (hasOverflow) {
        console.error(`  [OVERFLOW DETECTED] in ${vp.name}`);
        throw new Error(`Horizontal overflow detected in ${vp.name}`);
      } else {
        console.log(`  \x1b[32m[PASS] 0px horizontal overflow\x1b[0m`);
      }

      await captureScreenshot(vp.file);
    }

    console.log('\n========================================================');
    console.log('  ALL BROWSER MESS MANAGEMENT VERIFICATIONS PASSED!     ');
    console.log('========================================================\n');
  } finally {
    ws.close();
    chromeProcess.kill();
  }
}

main().catch((err) => {
  console.error('Browser Verification Failed:', err);
  process.exit(1);
});
