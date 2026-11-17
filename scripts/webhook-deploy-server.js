/**
 * Lightweight GitHub Push Webhook Listener for HMS
 * 
 * When configured as a webhook in your GitHub repo:
 * Settings -> Webhooks -> Add Webhook
 * Payload URL: http://your-server-ip:9000/webhook
 * Content type: application/json
 * Secret: (Optional, set via WEBHOOK_SECRET env var)
 * Events: Just the push event
 */

const http = require('http');
const crypto = require('crypto');
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.WEBHOOK_PORT || 9000;
const SECRET = process.env.WEBHOOK_SECRET || '';
const TARGET_BRANCH = process.env.DEPLOY_BRANCH || 'feat/security-hardening-and-fee-management';

let isDeploying = false;

function verifySignature(payload, signature) {
  if (!SECRET) return true; // Secret check skipped if not configured
  if (!signature) return false;
  const hmac = crypto.createHmac('sha256', SECRET);
  const digest = 'sha256=' + hmac.update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

function runDeployScript() {
  if (isDeploying) {
    console.log('[Webhook] Deployment already in progress, skipping duplicate trigger.');
    return;
  }

  isDeploying = true;
  console.log('[Webhook] 🚀 Starting automated deployment triggered by GitHub push...');

  const rootDir = path.resolve(__dirname, '..');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? 'powershell' : 'bash';
  const args = isWindows
    ? ['-ExecutionPolicy', 'Bypass', '-File', path.join(rootDir, 'scripts', 'deploy.ps1'), '-Branch', TARGET_BRANCH]
    : [path.join(rootDir, 'scripts', 'deploy.sh'), TARGET_BRANCH];

  const deployProcess = spawn(command, args, { cwd: rootDir, stdio: 'inherit' });

  deployProcess.on('close', (code) => {
    isDeploying = false;
    if (code === 0) {
      console.log('[Webhook] ✅ Automated deployment finished successfully!');
    } else {
      console.error(`[Webhook] ❌ Deployment exited with error code ${code}`);
    }
  });

  deployProcess.on('error', (err) => {
    isDeploying = false;
    console.error('[Webhook] ❌ Failed to execute deploy script:', err);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', deploying: isDeploying }));
    return;
  }

  if (req.method === 'POST' && req.url === '/webhook') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });

    req.on('end', () => {
      const signature = req.headers['x-hub-signature-256'];
      if (!verifySignature(body, signature)) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid HMAC signature' }));
        return;
      }

      let eventData;
      try {
        eventData = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Malformed JSON payload' }));
        return;
      }

      const pushedRef = eventData.ref || '';
      console.log(`[Webhook] Received push event for ref: ${pushedRef}`);

      // Check if pushed branch matches our target branch (or main/master)
      if (
        pushedRef === `refs/heads/${TARGET_BRANCH}` ||
        pushedRef === 'refs/heads/main' ||
        pushedRef === 'refs/heads/master'
      ) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Deployment triggered successfully', ref: pushedRef }));
        runDeployScript();
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Branch ignored', ref: pushedRef }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`[Webhook Listener] Server running on port ${PORT}`);
  console.log(`[Webhook Listener] Listening for GitHub push events on target branch: ${TARGET_BRANCH}`);
});
