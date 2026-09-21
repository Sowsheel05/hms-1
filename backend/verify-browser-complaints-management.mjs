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
const TEMP_PROFILE = path.join(os.tmpdir(), 'chrome-hms-complaints-management-test');
const ARTIFACT_DIR = path.join(os.tmpdir(), 'hms-browser-artifacts');

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function main() {
  console.log('=== Starting Headless Chrome CDP Verification for Complaints & Maintenance Management (Step 7) ===\n');

  let tempComplaintIds = [];

  // Ensure test student exists
  const student = await prisma.student.findFirst({ where: { role: 'STUDENT' } });
  const staff = await prisma.student.findFirst({ where: { role: 'MAINTENANCE_STAFF', isActive: true } });

  if (student && staff) {
    // Check if we have complaints in each lifecycle stage for modal verification
    const hasOpen = await prisma.complaint.findFirst({ where: { status: 'OPEN' } });
    if (!hasOpen) {
      const c = await prisma.complaint.create({
        data: {
          studentId: student.id,
          ticketNumber: `CMP-BROWSER-OPEN-${Date.now().toString().slice(-4)}`,
          title: 'Ceiling fan regulator not working',
          description: 'The ceiling fan regulator knob is stuck at maximum speed and cannot be dimmed.',
          category: 'ELECTRICAL',
          priority: 'MEDIUM',
          status: 'OPEN',
          location: 'Room 119 - Fan Regulator',
        },
      });
      tempComplaintIds.push(c.id);
    }

    const hasAssigned = await prisma.complaint.findFirst({ where: { status: 'ASSIGNED' } });
    if (!hasAssigned) {
      const c = await prisma.complaint.create({
        data: {
          studentId: student.id,
          ticketNumber: `CMP-BROWSER-ASGN-${Date.now().toString().slice(-4)}`,
          title: 'Window latch loose',
          description: 'Left window sliding latch is loose and rattles during wind.',
          category: 'CARPENTRY',
          priority: 'LOW',
          status: 'ASSIGNED',
          assignedToId: staff.id,
          assignedTo: staff.name,
          assignedAt: new Date(),
          assignedBy: 'System Administrator',
          location: 'Room 119 - Window',
        },
      });
      tempComplaintIds.push(c.id);
    }

    const hasInProgress = await prisma.complaint.findFirst({ where: { status: 'IN_PROGRESS' } });
    if (!hasInProgress) {
      const c = await prisma.complaint.create({
        data: {
          studentId: student.id,
          ticketNumber: `CMP-BROWSER-PROG-${Date.now().toString().slice(-4)}`,
          title: 'Washroom flush valve repair',
          description: 'Water leaking into cistern bowl continuously.',
          category: 'PLUMBING',
          priority: 'HIGH',
          status: 'IN_PROGRESS',
          assignedToId: staff.id,
          assignedTo: staff.name,
          assignedAt: new Date(Date.now() - 3600000),
          assignedBy: 'System Administrator',
          location: 'Room 119 - Cistern',
        },
      });
      tempComplaintIds.push(c.id);
    }

    const hasResolved = await prisma.complaint.findFirst({ where: { status: 'RESOLVED' } });
    if (!hasResolved) {
      const c = await prisma.complaint.create({
        data: {
          studentId: student.id,
          ticketNumber: `CMP-BROWSER-RES-${Date.now().toString().slice(-4)}`,
          title: 'Wi-Fi access point reboot required',
          description: 'Floor corridor AP dropped connectivity.',
          category: 'INTERNET',
          priority: 'MEDIUM',
          status: 'RESOLVED',
          assignedToId: staff.id,
          assignedTo: staff.name,
          assignedAt: new Date(Date.now() - 7200000),
          assignedBy: 'System Administrator',
          resolutionNotes: 'Power cycled PoE injector switch and verified signal strength across 5GHz and 2.4GHz bands.',
          resolvedBy: staff.name,
          resolvedAt: new Date(Date.now() - 1800000),
          location: 'Wing B Corridor',
        },
      });
      tempComplaintIds.push(c.id);
    }
  }

  if (!fs.existsSync(TEMP_PROFILE)) {
    fs.mkdirSync(TEMP_PROFILE, { recursive: true });
  }
  if (!fs.existsSync(ARTIFACT_DIR)) {
    fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
  }

  // Launch Chrome on port 9230
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=9230',
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
      const res = await fetch('http://localhost:9230/json/version');
      versionData = await res.json();
      break;
    } catch {
      await sleep(300);
    }
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    console.error('Failed to connect to Chrome on port 9230');
    chromeProcess.kill();
    process.exit(1);
  }

  console.log('Connected to Chrome:', versionData['Browser']);

  const listRes = await fetch('http://localhost:9230/json/list');
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
    await sleep(400);
  }

  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');

  try {
    // 1. Navigate to Management Login
    console.log('Navigating to http://localhost:5173/management/login...');
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/management/login' });
    await sleep(1500);

    // 2. Perform Admin Login
    console.log('Logging in as ADMIN01...');
    await evalExpr(`
      const u = document.querySelector('input[type="text"], input[name="username"]');
      const p = document.querySelector('input[type="password"]');
      if (u) { u.value = 'ADMIN01'; u.dispatchEvent(new Event('input', { bubbles: true })); }
      if (p) { p.value = 'Password@123'; p.dispatchEvent(new Event('input', { bubbles: true })); }
      const btn = document.querySelector('button[type="submit"]');
      if (btn) btn.click();
    `);
    await sleep(2000);

    // 3. Navigate to Complaints & Maintenance Management
    console.log('Navigating to http://localhost:5173/management/complaints...');
    await sendCommand('Page.navigate', { url: 'http://localhost:5173/management/complaints' });
    await sleep(2500);

    // 4. Capture Desktop 1440x900
    await setViewport(1440, 900);
    await sleep(1000);
    await takeScreenshot('complaints_mgmt_1440x900.png');

    // Verify Title and KPI Stats
    const pageTitle = await evalExpr(`document.querySelector('.complaints-main-title')?.textContent`);
    console.log('Page Title:', pageTitle);

    const kpiCount = await evalExpr(`document.querySelectorAll('.kpi-stat-card').length`);
    console.log('KPI Cards Count:', kpiCount);

    const cardsCount = await evalExpr(`document.querySelectorAll('.complaint-request-card').length`);
    console.log('Rendered Complaint Cards Count:', cardsCount);

    // 5. Verify Detail Modal
    console.log('Testing Detail Modal...');
    await evalExpr(`
      const detailBtn = document.querySelector('.complaint-request-card .btn-secondary');
      if (detailBtn) detailBtn.click();
    `);
    await sleep(1000);
    await takeScreenshot('complaints_mgmt_detail_modal.png');

    const hasDetailModal = await evalExpr(`!!document.querySelector('.complaint-detail-modal')`);
    console.log('Detail Modal Rendered:', hasDetailModal);

    // Close Detail Modal
    await evalExpr(`
      const closeBtn = document.querySelector('#btn-close-detail-modal, .modal-close-btn');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(600);

    // 6. Verify Assign Modal
    console.log('Testing Assign Modal...');
    await evalExpr(`
      const assignBtn = document.querySelector('.btn-action-primary.assign-btn');
      if (assignBtn) assignBtn.click();
    `);
    await sleep(1000);
    await takeScreenshot('complaints_mgmt_assign_modal.png');

    const hasAssignModal = await evalExpr(`!!document.querySelector('.assign-modal')`);
    console.log('Assign Modal Rendered:', hasAssignModal);

    // Close Assign Modal
    await evalExpr(`
      const closeBtn = document.querySelector('#btn-close-assign-modal, .assign-modal .btn-secondary');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(600);

    // 7. Verify Resolve Modal
    console.log('Testing Resolve Modal...');
    await evalExpr(`
      const resolveBtn = document.querySelector('.btn-action-primary.resolve-btn');
      if (resolveBtn) resolveBtn.click();
    `);
    await sleep(1000);
    await takeScreenshot('complaints_mgmt_resolve_modal.png');

    const hasResolveModal = await evalExpr(`!!document.querySelector('.resolve-modal')`);
    console.log('Resolve Modal Rendered:', hasResolveModal);

    // Close Resolve Modal
    await evalExpr(`
      const closeBtn = document.querySelector('#btn-close-resolve-modal, .resolve-modal .btn-secondary');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(600);

    // 8. Verify Close Modal
    console.log('Testing Close Modal...');
    await evalExpr(`
      const closeBtn = document.querySelector('.btn-action-primary.close-btn');
      if (closeBtn) closeBtn.click();
    `);
    await sleep(1000);
    await takeScreenshot('complaints_mgmt_close_modal.png');

    const hasCloseModal = await evalExpr(`!!document.querySelector('.close-confirm-modal')`);
    console.log('Close Modal Rendered:', hasCloseModal);

    // Close Close Modal
    await evalExpr(`
      const cancelBtn = document.querySelector('#btn-close-close-modal, .close-confirm-modal .btn-secondary');
      if (cancelBtn) cancelBtn.click();
    `);
    await sleep(600);

    // 9. Responsive Verification across all 4 Viewports
    console.log('\n--- Verifying Responsive Breakpoints (0px Horizontal Overflow) ---');

    // Tablet 768x1024
    await setViewport(768, 1024);
    await sleep(600);
    await takeScreenshot('complaints_mgmt_768x1024.png');
    const tabletOverflow = await evalExpr(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Tablet (768x1024) Horizontal Overflow: ${tabletOverflow}px`);

    // Mobile 390x844
    await setViewport(390, 844);
    await sleep(600);
    await takeScreenshot('complaints_mgmt_390x844.png');
    const mobile390Overflow = await evalExpr(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile (390x844) Horizontal Overflow: ${mobile390Overflow}px`);

    // Mobile 320x800
    await setViewport(320, 800);
    await sleep(600);
    await takeScreenshot('complaints_mgmt_320x800.png');
    const mobile320Overflow = await evalExpr(`document.documentElement.scrollWidth - window.innerWidth`);
    console.log(`Mobile (320x800) Horizontal Overflow: ${mobile320Overflow}px`);

  } catch (err) {
    console.error('Browser Verification Error:', err);
  } finally {
    // Clean up temporary browser fixtures
    if (tempComplaintIds.length > 0) {
      await prisma.complaint.deleteMany({
        where: { id: { in: tempComplaintIds } },
      });
      console.log(`Cleaned up ${tempComplaintIds.length} temporary browser verification complaint(s)`);
    }

    await prisma.$disconnect();
    ws.close();
    chromeProcess.kill();
    console.log('\n=== Headless Chrome Verification Finished ===');
  }
}

main().catch(console.error);
