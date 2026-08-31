import { spawn } from 'child_process';
import process from 'process';

const isWin = process.platform === 'win32';
const npxCmd = isWin ? 'npx.cmd' : 'npx';

console.log('[DevRunner] 啟動後端 API 伺服器 (port 3001)...');
const backend = spawn('node', ['server.js'], { stdio: 'inherit', shell: isWin });

console.log('[DevRunner] 啟動前端 Vite 開發伺服器 (port 3000)...');
const frontend = spawn(npxCmd, ['vite', '--port=3000', '--host=0.0.0.0'], { stdio: 'inherit', shell: isWin });

function cleanup() {
  console.log('\n[DevRunner] 正在安全關閉所有伺服器...');
  try { backend.kill(); } catch { /* ignore */ }
  try { frontend.kill(); } catch { /* ignore */ }
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);

backend.on('error', (err) => console.error('[Backend Error]:', err));
frontend.on('error', (err) => console.error('[Frontend Error]:', err));
