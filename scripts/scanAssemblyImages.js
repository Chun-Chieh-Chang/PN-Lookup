/**
 * scanAssemblyImages.js
 *
 * 組件圖掃描引擎：從組件圖（PDF/圖面）頁面文字中提取組成零件清單，
 * 與 master 品號/別稱比對，產出 BOM 關係報告供人工確認。
 *
 * 背景問題：
 *   Excel 原始資料可能並非全部品項。組件圖頁面內通常會列出組成該組件所需
 *   的全部零件（PART NO. / DESCRIPTION / MATERIAL），若僅以圖檔檔名比對，
 *   會漏掉這些「頁面內零件」。本腳本負責把這部分納入查核範圍。
 *
 * 用法：
 *   node scripts/scanAssemblyImages.js            # 產生報告 data/assembly-scan-report.json
 *   node scripts/scanAssemblyImages.js --apply    # 將組件圖已知零件寫入 master BOM
 *   node scripts/scanAssemblyImages.js --auto     # 自動納入未收錄品號為新零件並建 BOM
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { convertUnifiedSeedToMaster } from './buildMaster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const MASTER_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');
const REPORT_PATH = join(ROOT_DIR, 'data', 'assembly-scan-report.json');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');

// Node 環境 polyfill（pdfjs legacy build 需要 DOM 型別）
globalThis.DOMMatrix = class DOMMatrix {
  constructor() { this.a = this.d = 1; this.b = this.c = this.e = this.f = 0; }
  multiplySelf() {}
};
globalThis.Path2D = class {};
globalThis.DOMPoint = class {};

// 組件圖資料夾（相對 ROOT_DIR）
const ASSEMBLY_DIRS = [
  join('rawdata', '圖檔', '客戶圖面', 'Sub-Assembly'),
  join('rawdata', '圖檔', '產品資料', '廠內組件圖面'),
  join('rawdata', '圖檔', '產品資料', '綜合圖面'),
];

function walkDir(dir, out) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir)) {
    const fp = join(dir, e);
    if (statSync(fp).isDirectory()) {
      walkDir(fp, out);
    } else if (/\.(pdf|png|jpe?g)$/i.test(e)) {
      out.push(fp);
    }
  }
}

// 品號正規化（與前端 imageLibrary.normalize 一致）
function norm(s) {
  return String(s || '').replace(/[^A-Z0-9]+/gi, '').toUpperCase();
}

// 疑似品號 token：1~4 英文字母 + 數字 + 破折號，長度 >= 5
const PART_NO_TOKEN_RE = /^[A-Z]{0,4}\d{1,4}(?:-[A-Z0-9]+)+$/i;

function extractPartNoCandidates(text) {
  const out = new Set();
  const tokens = String(text || '').split(/[\s,;:()[\].]+/);
  for (const t of tokens) {
    if (!PART_NO_TOKEN_RE.test(t)) continue;
    // 排除日期（如 2023-05-15）
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) continue;
    // 排除 ISO/IEC 標準尾號（如 8536-4、80369-7）
    if (/^(ISO|IEC|EN)\d/i.test(t)) continue;
    if (/^\d{3,5}-\d{1,2}$/.test(t)) continue;
    out.add(t.toUpperCase());
  }
  return [...out];
}

async function extractPdfText(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(filePath).buffer);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  let text = '';
  try {
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map((x) => x.str || '').join(' ') + '\n';
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return text;
}

// 檔名 → 組件品號（如 BD-8003875_Rev.04.pdf → BD-8003875）
function assemblyIdFromFileName(fileName) {
  return fileName
    .replace(/\.[^.]+$/, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '')
    .replace(/[-_]?C$/i, '')
    .trim();
}

async function main() {
  const master = readMaster();

  // master 品號/別稱索引（normalize → 標準品號）
  const index = new Map();
  for (const p of master.parts) {
    index.set(norm(p.partNo), p.partNo);
    for (const a of (p.alternates || [])) {
      const ak = norm(a);
      if (!index.has(ak)) index.set(ak, p.partNo);
    }
  }

  const allFiles = [];
  for (const d of ASSEMBLY_DIRS) walkDir(d, allFiles);
  console.log(`掃描組件圖 ${allFiles.length} 張...`);

  const report = [];
  const bomLinks = []; // { assembly, child }

  for (const f of allFiles) {
    const fileName = f.split(/[\\/]/).pop();
    let assemblyId = assemblyIdFromFileName(fileName);
    // 檔名尾綴 -C（客戶版本）若不在 master，而去掉 -C 存在時，合併至標準品號
    if (!index.has(norm(assemblyId)) && /-C$/i.test(assemblyId)) {
      const base = assemblyId.replace(/-C$/i, '');
      if (index.has(norm(base))) assemblyId = base;
    }
    let text = '';

    if (/\.pdf$/i.test(fileName)) {
      try {
        text = await extractPdfText(f);
      } catch (e) {
        report.push({ file: fileName, assemblyId, ok: false, reason: `PDF 無法讀取: ${e.message}` });
        continue;
      }
    }

    const candidates = extractPartNoCandidates(text);
    if (candidates.length === 0) {
      report.push({ file: fileName, assemblyId, ok: false, reason: '未提取到品號' });
      continue;
    }

    const known = [];
    const unknown = [];
    const seen = new Set();
    for (const c of candidates) {
      if (seen.has(c)) continue;
      seen.add(c);
      const key = norm(c);
      if (index.has(key)) {
        const std = index.get(key);
        if (!known.some((x) => x.partNo === std)) {
          known.push({ candidate: c, partNo: std });
        }
      } else if (key.length >= 5) {
        if (!unknown.includes(c)) unknown.push(c);
      }
    }

    unknown.sort();
    report.push({ file: fileName, assemblyId, ok: known.length > 0, known, unknown });

    for (const p of known) {
      if (p.partNo !== assemblyId) {
        bomLinks.push({ assembly: assemblyId, child: p.partNo });
      }
    }
  }

  // 寫入報告
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`報告已寫入 ${REPORT_PATH}`);

  const okRows = report.filter((r) => r.ok);
  const withUnknown = report.filter((r) => r.unknown && r.unknown.length > 0);
  console.log('\n== 掃描結果 ==');
  console.log(`組件圖總數: ${report.length}`);
  console.log(`含已知零件 (可建立 BOM): ${okRows.length}`);
  console.log(`含未收錄新品號: ${withUnknown.length}`);

  // 未收錄品號統計（Excel 外候補）
  const union = new Map();
  for (const r of report) {
    for (const u of (r.unknown || [])) {
      union.set(u, (union.get(u) || 0) + 1);
    }
  }
  if (union.size > 0) {
    console.log('\n⚠️ 以下品號僅於組件圖頁面內出現（未收錄於 Excel/master），建議人工確認：');
    const top = [...union.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    for (const [pn, cnt] of top) {
      console.log(`   ${pn}      出現於 ${cnt} 張組件圖`);
    }
    if (union.size > 40) console.log(`   ... 其餘 ${union.size - 40} 個候補請見報告`);
  }

  // --apply / --auto：寫入 master
  const shouldApply = process.argv.includes('--apply') || process.argv.includes('--auto');
  if (shouldApply && bomLinks.length > 0) {
    const data = readMaster();
    const autoFlag = process.argv.includes('--auto');

    // --auto：將「組件圖檔名對應的組件」補建成新零件（只收錄組件本身，不收錄材質/日期等雜訊）
    if (autoFlag) {
      const existing = new Set(data.parts.map((p) => norm(p.partNo)));
      const assemblyIds = new Set(report.map((r) => r.assemblyId).filter(Boolean));
      let addedParts = 0;
      for (const asm of assemblyIds) {
        if (asm.length < 5 || existing.has(norm(asm))) continue;
        // 過濾明顯非品號（純數字、含空格、太短）
        if (!/^[A-Z0-9][A-Z0-9-]{4,}$/i.test(asm)) continue;
        data.parts.push({
          id: asm, partNo: asm, name: asm, customer: '',
          category: '組件圖候補', color: '', material: '', notes: '由 scanAssemblyImages 依組件圖檔名自動收錄',
          alternates: [],
        });
        existing.add(norm(asm));
        addedParts++;
      }
      if (addedParts > 0) console.log(`✅ 自動收錄 ${addedParts} 個組件圖品項為新零件`);
    }

    let added = 0;
    for (const { assembly, child } of bomLinks) {
      if (!data.bom.children[assembly]) data.bom.children[assembly] = [];
      if (!data.bom.children[assembly].includes(child)) {
        data.bom.children[assembly].push(child);
        added++;
      }
    }
    data.bom.parents = {};
    for (const [a, kids] of Object.entries(data.bom.children)) {
      for (const kid of kids) {
        if (!data.bom.parents[kid]) data.bom.parents[kid] = [];
        if (!data.bom.parents[kid].includes(a)) data.bom.parents[kid].push(a);
      }
    }
    writeFileSync(MASTER_PATH, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`✅ 已將 ${added} 組新 BOM 關係寫入 master.json${autoFlag ? '，並自動收錄組件圖品項' : ''}`);
  } else if (shouldApply && bomLinks.length === 0) {
    console.log('ℹ️ --apply 但無新增 BOM 關係');
  }
}

function readMaster() {
  if (existsSync(MASTER_PATH)) {
    return JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));
  }
  if (!existsSync(RAW_SEED_PATH)) {
    console.error(`❌ 找不到種子檔 ${RAW_SEED_PATH}`);
    process.exit(1);
  }
  const seed = JSON.parse(readFileSync(RAW_SEED_PATH, 'utf-8'));
  return convertUnifiedSeedToMaster(seed);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });