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
 *   node scripts/scanAssemblyImages.js --all      # 掃描 rawdata/圖檔 全部子資料夾（預設僅掃組件圖資料夾）
 *   node scripts/scanAssemblyImages.js --parent-of <PN>   # 反向識別：找出哪些產品圖面包含該品號
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
const ALL_IMAGE_DIR = join('rawdata', '圖檔');

// 命令列參數
const argv = process.argv.slice(2);
const scanAll = argv.includes('--all');
const parentOfArg = argv.includes('--parent-of') ? argv[argv.indexOf('--parent-of') + 1] : null;

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
// 括號內品號優先：<文件編號>(<品號>)_Rev.X（如 PFM-DWG-30125-01(126-006)_Rev.AB.pdf → 126-006）
function assemblyIdFromFileName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const parens = [...base.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim());
  const parenPn = parens.find((p) => !/^Rev/i.test(p) && !/^\d{1,3}$/.test(p));
  if (parenPn) {
    return parenPn
      .replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '')
      .replace(/[-_]?C$/i, '')
      .trim();
  }
  return base
    .replace(/\([^)]*\)/g, '')
    .replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '')
    .replace(/[-_]?C$/i, '')
    .trim();
}

// 將檔名衍生組件 ID 解析為 master 標準品號（版本/來源後綴剝除 → 內文自身品號前綴比對）
function resolveAssemblyId(assemblyId, knownList, index) {
  const normA = norm(assemblyId);
  if (index.has(normA)) return index.get(normA);

  // BD- 圖型前綴（非品號一部分）：BD-X3299AAM → X3299AAM（未命中 master 則保留原樣，由非品號過濾排除）
  const bd = assemblyId.match(/^BD[-_](.+)$/i);
  if (bd) {
    const core = bd[1];
    const hit = index.get(norm(core));
    if (hit) return hit;
    return assemblyId;
  }

  // 逐層剝除常見後綴（_mdx / -MC_xx / -C / _xx / Rev），每剝一層即查 master
  let cur = assemblyId;
  let stripped = assemblyId;
  const steps = [
    (s) => s.replace(/_mdx$/i, ''),
    (s) => s.replace(/[-_]?MC[_ ]?\d{1,3}$/i, ''),
    (s) => s.replace(/[-_]?C$/i, ''),
    (s) => s.replace(/_\d{1,3}$/i, ''),
    (s) => s.replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, ''),
  ];
  for (const step of steps) {
    const next = step(cur).trim();
    if (next !== cur) {
      cur = next;
      stripped = next;
      const hit = index.get(norm(cur));
      if (hit) return hit;
    }
  }
  // 圖號註冊格式自身圖：組件 ID = <圖號>_<版次>_<品號>（如 SPC0014799_10_R1-2361、C74-49554-MC_05_C74-49554_mdx）
  // 僅當內文已知品號為組件 ID 尾段 token、前一 token 為純數字版次、且前方尚有圖號 token 時判定自身圖
  // （避免誤殺 BD-X3299AAM 等「家族前綴+核心品號」真實組件；SPC0005450_04_RAW0000336 尾段非 master 品號亦不受影響）
  for (const k of knownList) {
    const nk = norm(k.partNo);
    if (nk.length < 4) continue;
    const toks = cur.split(/[_ ]+/);
    if (toks.length >= 3) {
      const last = toks[toks.length - 1];
      const prev = toks[toks.length - 2];
      if (/^\d{1,3}$/.test(prev) && norm(last) === nk) return k.partNo;
    }
  }
  // 未命中 master 也回傳最乾淨的剝除形式（合併同家族版本，供後續登錄/比對）
  if (stripped !== assemblyId) return stripped;

  // 圖面內文標註的自身品號：候選品號為組件 ID 正規化前綴且後一碼非數字（邊界防誤判）
  for (const k of knownList) {
    const nk = norm(k.partNo);
    if (nk.length >= 4 && normA.startsWith(nk)) {
      const nextChar = normA[nk.length];
      if (!nextChar || !/\d/.test(nextChar)) return k.partNo;
    }
  }
  return assemblyId;
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
  if (scanAll) {
    walkDir(ALL_IMAGE_DIR, allFiles);
  } else {
    for (const d of ASSEMBLY_DIRS) walkDir(d, allFiles);
  }
  console.log(`掃描圖檔 ${allFiles.length} 張...${scanAll ? '（全資料夾模式）' : ''}${parentOfArg ? `（反向識別 ${parentOfArg}）` : ''}`);

  const report = [];
  const bomLinks = []; // { assembly, child }

  for (const f of allFiles) {
    const fileName = f.split(/[\\/]/).pop();
    const rawAssemblyId = assemblyIdFromFileName(fileName);
    let text = '';

    if (/\.pdf$/i.test(fileName)) {
      try {
        text = await extractPdfText(f);
      } catch (e) {
        report.push({ file: fileName, assemblyId: rawAssemblyId, ok: false, reason: `PDF 無法讀取: ${e.message}` });
        continue;
      }
    }

    const candidates = extractPartNoCandidates(text);
    if (candidates.length === 0) {
      report.push({ file: fileName, assemblyId: rawAssemblyId, ok: false, reason: '未提取到品號' });
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
    const assemblyId = resolveAssemblyId(rawAssemblyId, known, index);
    report.push({ file: fileName, assemblyId, ok: known.length > 0, known, unknown });

    for (const p of known) {
      // 排除含中文/空格等非品號字元的檔名衍生組件（如「PN-0002_… 包裝說明書」）
      // 排除文件編號格式（SPC 圖號註冊 SPCxxxx_NN_RAW/CIVxxxx、PFM-DWG）與未剝除的 BD- 前綴
      const nonPn = /^(SPC\d+_\d+_(RAW|CIV)\d+|PFM-DWG-|BD[-_][A-Z0-9]+)$/i.test(assemblyId);
      if (p.partNo !== assemblyId && !nonPn && /^[A-Z0-9][A-Z0-9_.\-]*$/i.test(assemblyId)) {
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
  console.log(`圖檔總數: ${report.length}`);
  console.log(`含已知零件 (可建立 BOM): ${okRows.length}`);
  console.log(`含未收錄新品號: ${withUnknown.length}`);

  // --parent-of <PN>：反向識別該品號可組成哪些產品
  let bomLinksToApply = bomLinks;
  if (parentOfArg) {
    const pnNorm = norm(parentOfArg);
    const parentRows = report.filter((r) =>
      (r.known || []).some((k) => norm(k.partNo) === pnNorm || norm(k.candidate) === pnNorm)
    );
    bomLinksToApply = bomLinks.filter((l) => norm(l.child) === pnNorm);
    console.log(`\n== 反向識別：${parentOfArg} 可組成以下產品 ==`);
    if (parentRows.length === 0) {
      console.log(`   ⚠️ 未在任何已掃描圖面內文中找到 ${parentOfArg}`);
    }
    for (const r of parentRows) {
      console.log(`   ${r.assemblyId}   (來源: ${r.file})`);
    }
  }

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
  const shouldApply = argv.includes('--apply') || argv.includes('--auto');
  if (shouldApply && bomLinksToApply.length > 0) {
    const data = readMaster();
    const autoFlag = argv.includes('--auto');

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
    for (const { assembly, child } of bomLinksToApply) {
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
    console.log(`✅ 已將 ${added} 組新 BOM 關係寫入 master.json${autoFlag ? '，並自動收錄組件圖品項' : ''}${parentOfArg ? `（反向識別 ${parentOfArg}）` : ''}`);
  } else if (shouldApply && bomLinksToApply.length === 0) {
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