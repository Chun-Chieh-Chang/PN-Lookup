// v7.9.1 batchWatcher：批次完成後自動執行 buildMaster → verify → 升版 → commit → push
// 輪詢 data/batch-run.log 出現「===== 完成」後觸發；每 5 分鐘檢查一次
import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const LOG = join(ROOT, 'data', 'batch-run.log');
const FLAG = join(ROOT, 'data', 'batch-done.flag');
const STATE = join(ROOT, 'data', 'batch-watcher.state.json');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  appendFileSync(join(ROOT, 'data', 'batch-watcher.log'), line + '\n');
}

function run(cmd) {
  log(`執行: ${cmd}`);
  try {
    const out = execSync(cmd, { cwd: ROOT, encoding: 'utf-8', timeout: 300000 });
    log(out.split('\n').filter((l) => /Merged|Total|PASS|SUCCESS|FAIL|Error|error/.test(l)).slice(0, 30).join('\n') || '(no matched output)');
    return { ok: true };
  } catch (e) {
    log(`失敗: ${e.message?.slice(0, 500)}`);
    return { ok: false };
  }
}

function bumpVersion() {
  const vf = join(ROOT, 'src', 'version.ts');
  if (!existsSync(vf)) return false;
  const cur = readFileSync(vf, 'utf-8').match(/APP_VERSION = 'v([\d.]+)'/);
  if (!cur) return false;
  const parts = cur[1].split('.').map(Number);
  parts[2] = (parts[2] || 0) + 1;
  const next = `v${parts.join('.')}`;
  writeFileSync(vf, cur.input.replace(cur[0], `APP_VERSION = '${next}'`), 'utf-8');
  log(`版本 ${cur[1]} → ${next}`);
  return true;
}

async function waitForBatch() {
  let idleLoops = 0;
  while (true) {
    if (!existsSync(LOG)) { await new Promise((r) => setTimeout(r, 60000)); continue; }
    const content = readFileSync(LOG, 'utf-8');
    if (/===== 完成/.test(content)) return { ok: true, content };
    // 進度快照
    const prog = content.match(/完成 (\d+)\/(\d+)/g);
    if (prog && prog.length && idleLoops % 6 === 0) log(`進度: ${prog[prog.length - 1]}`);
    if (idleLoops > 60) {
      // 偵測批次程序是否消失（異常結束）
      try {
        const list = execSync('powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name=\'node.exe\'\\" | Where-Object { $_.CommandLine -match \'semanticExtract\' } | Measure-Object | Select-Object -ExpandProperty Count"', { encoding: 'utf-8' });
        if (Number(list.trim()) === 0) {
          log('⚠ 批次程序已消失且無完成標記 — 判定批次異常，不執行後續（待人工處理）');
          return { ok: false, content };
        }
      } catch { /* ignore */ }
      idleLoops = 0;
    }
    idleLoops++;
    await new Promise((r) => setTimeout(r, 300000));
  }
}

const state = { pid: process.pid, startedAt: new Date().toISOString() };
writeFileSync(STATE, JSON.stringify(state, null, 2));

(async () => {
  log(`watcher 啟動（PID ${process.pid}）`);
  if (existsSync(FLAG)) {
    log('先前已完成標記存在 — 沿用，直接執行後續');
  } else {
    const batch = await waitForBatch();
    if (!batch.ok) {
      log('批次異常中止，watcher 退出（需重跑批次後再啟 watcher）');
      process.exit(2);
    }
    const done = (batch.content.match(/完成：(\d+)\/(\d+)/) || [])[0] || '未知';
    log(`批次完成（${done}）`);
  }
  await new Promise((r) => setTimeout(r, 15000));
  // v7.9.1 retry 循環：補跑失敗筆（最多 3 輪，批間 90s 避限流）
  for (let round = 1; round <= 3; round++) {
    const failCount = JSON.parse(readFileSync(join(ROOT, 'data', 'semantic-extract.json'), 'utf-8')).items.filter((i) => !i.ok).length;
    if (failCount === 0) { log(`失敗筆數 0，無需重試`); break; }
    log(`retry 第 ${round} 輪：失敗 ${failCount} 筆`);
    run(`node scripts/semanticExtract.js --retry-failed --provider=agnes --batch=3 --rest=30000`);
    const remain = JSON.parse(readFileSync(join(ROOT, 'data', 'semantic-extract.json'), 'utf-8')).items.filter((i) => !i.ok).length;
    log(`retry 第 ${round} 輪後剩餘失敗：${remain}`);
    if (remain === 0) break;
  }
  const ok1 = run('node scripts/buildMaster.js');
  const ok2 = ok1.ok && run('node scripts/verifyCoreLogic.js');
  const ok3 = ok2 && run('npm run build');
  const bumped = bumpVersion();
  if (ok3) {
    run('git add -A');
    run('git commit -m "v7.9.1: 圖檔語意識別全量批次 — SB0001 規則 BOM 兜底、dwgNo 人工真值修正(MDXE-153-02/404028/R1-10134)、語意補缺合併" --allow-empty');
    run('git push');
    writeFileSync(FLAG, JSON.stringify({ completedAt: new Date().toISOString(), ok: true, version: bumped ? 'bumped' : 'unchanged' }, null, 2));
    log('✅ 全部完成（buildMaster + verify + build + commit + push）');
  } else {
    writeFileSync(FLAG, JSON.stringify({ completedAt: new Date().toISOString(), ok: false }, null, 2));
    log('❌ 後續步驟失敗，待人工檢查');
  }
  process.exit(0);
})().catch((e) => {
  log('watcher 異常: ' + e.message);
  process.exit(1);
});