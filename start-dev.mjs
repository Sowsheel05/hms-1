import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function startProcess(name, cmd, args, cwd, color) {
  const proc = spawn(cmd, args, {
    cwd,
    shell: true,
    stdio: 'pipe',
  });

  proc.stdout.on('data', (data) => {
    process.stdout.write(`${color}[${name}]\x1b[0m ${data}`);
  });

  proc.stderr.on('data', (data) => {
    process.stderr.write(`${color}[${name}]\x1b[0m ${data}`);
  });

  proc.on('close', (code) => {
    console.log(`${color}[${name}]\x1b[0m exited with code ${code}`);
  });

  return proc;
}

console.log('\x1b[36m=== Launching HMS Application (Backend & Frontend) ===\x1b[0m\n');

const backend = startProcess('Backend', 'npm', ['run', 'dev'], path.join(__dirname, 'backend'), '\x1b[35m');
const frontend = startProcess('Frontend', 'npm', ['run', 'dev'], path.join(__dirname, 'frontend'), '\x1b[32m');

process.on('SIGINT', () => {
  backend.kill('SIGINT');
  frontend.kill('SIGINT');
  process.exit();
});
