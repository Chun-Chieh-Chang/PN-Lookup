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
 *   node scripts/scanAssemblyImages.js --extract  # 全圖檔角色化提取（組件/零件/物料）→ data/drawings-extract.json
 *                                                  （v7.8.7 圖檔優先管線：buildMaster 以此為第一事實來源）
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
const EXTRACT_PATH = join(ROOT_DIR, 'data', 'drawings-extract.json');
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
const extractMode = argv.includes('--extract');
const parentOfArg = argv.includes('--parent-of') ? argv[argv.indexOf('--parent-of') + 1] : null;

// 圖檔角色（v7.8.7 圖檔優先管線）：依目錄判定
// 組件 = 內文零件清單可建立 BOM；零件/物料 = 檔名即自身品號，不建立 BOM
function roleOf(rel) {
  const p = rel.replace(/\\/g, '/');
  if (/物料資料\//.test(p)) return '物料';
  if (/廠內零件圖面/.test(p) || /ICU原料圖面/.test(p)) return '零件';
  return '組件';
}

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

async function extractPdfText(filePath, { withLines = false } = {}) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(readFileSync(filePath).buffer);
  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;
  let text = '';
  const lines = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, 6); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      text += tc.items.map((x) => x.str || '').join(' ') + '\n';
      if (withLines) {
        const items = tc.items.map((x) => ({ str: x.str || '', x: x.transform[4], y: x.transform[5] }));
        const rows = new Map();
        for (const it of items) {
          const key = Math.round(it.y / 4);
          if (!rows.has(key)) rows.set(key, []);
          rows.get(key).push(it);
        }
        for (const r of rows.values()) {
          const line = r
            .sort((a, b) => a.x - b.x)
            .map((it) => it.str.trim())
            .filter(Boolean)
            .join(' ');
          if (line) lines.push(line);
        }
      }
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return withLines ? { text, lines } : text;
}

// v7.8.7 圖檔內文標題欄提取（領域規則：內文「零件編號 / PART NO.」欄位為品號最終確認依據、
// 「REV / Revision」為版本依據；SPC 圖另以「PART / Description / Revision」對應品號/品名/版本）
const PN_LABEL_RE = /(PART\s*NO\.?|^P\/N\s*$|^PART\s*$|DRAWING\s*#|FILE\s*NO\.?|零件編號)/i;
const REV_LABEL_RE = /(^REV\b|REVISION)/i;
const TITLE_LABEL_RE = /^TITLE\s*$/i;
const NON_REV_TOKEN = /^(DATE|CKD|NO|BY|DRA|DESCRIPTION|CHECK|APPROVED)$/i;
const DATE_TOKEN_RE = /^\d{4}-\d{2}-\d{2}$/;

function titleBlockToken(line, { relatedTo = null } = {}) {
  if (!line) return null;
  for (const t of line.split(/\s+/)) {
    if (!/^[A-Z0-9][A-Z0-9._\-]*$/i.test(t) || t.length < 4) continue;
    if (/^X{2,}$/i.test(t)) continue;
    if (!/\d/.test(t)) continue;
    if (DATE_TOKEN_RE.test(t)) continue;
    if (/mm$/i.test(t)) continue;
    if (/^\d{3,5}-\d{1,2}$/.test(t)) continue;
    if (relatedTo) {
      const tn = norm(t);
      if (!(tn === relatedTo || (tn.length > relatedTo.length && tn.startsWith(relatedTo)) || (relatedTo.length > tn.length && relatedTo.startsWith(tn)))) continue;
    }
    return t;
  }
  return null;
}

// REV 欄位值限制：單字母版次（A-Z）、字母+數字（E1）、或純數字（1、04）；排除雜訊（SO、VISION 等）
const REV_TOKEN_RE = /^[A-Z]$|^[A-Z][0-9]$|^\d{1,2}$/;

function parseTitleBlock(lines, { spc = false, fileName = '' } = {}) {
  const out = {};
  const fpNorm = fileName ? norm(assemblyIdFromFileName(fileName)) : '';
  const cands = [];
  const related = (tok) => titleBlockToken(tok, { relatedTo: fpNorm });
  const tryLineEnd = (line) => {
    if (!line) return null;
    let found = null;
    for (const t of line.split(/\s+/).reverse()) {
      const r = titleBlockToken(t, { relatedTo: fpNorm });
      if (r) { found = r; break; }
    }
    return found;
  };
  // 候選 A：FILE NO. 標籤（標題欄檔案編號；MOULDEX 佈局：標籤行下方 1~3 行行尾、
  // 或全圖 DIM. CLASSIFICATION / CRITICAL MAJOR 標記行的行尾即品號，如 CRITICAL MAJOR ALL OTHERS MINOR SA0002）
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;
    const m = line.match(/FILE\s*NO\.?/i);
    if (!m) continue;
    const rest = line.slice(m.index + m[0].length).trim();
    const t1 = titleBlockToken(
      rest.replace(/\([^)]*\)/g, '').replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '').replace(/[-_]?MC$/i, '').replace(/[-_]?C$/i, '').trim()
    );
    if (t1) cands.push(t1);
    for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
      const t = tryLineEnd(lines[j]);
      if (t) { cands.push(t); break; }
    }
    for (const line2 of lines) {
      if (!/DIM\. CLASSIFICATION|CRITICAL MAJOR/i.test(line2)) continue;
      const t = tryLineEnd(line2);
      if (t) { cands.push(t); break; }
    }
    break;
  }
  // 候選 B：其他品號標籤（PART NO. / P/N / Drawing # / 零件編號；值在同行或下一行）
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;
    const m = line.match(PN_LABEL_RE);
    if (!m) continue;
    const rest = line.slice(m.index + m[0].length).trim();
    const t = titleBlockToken(rest) || related(lines[i + 1]);
    if (t) cands.push(t);
  }
  // 候選 C：獨立品號行（整行恰一個 token 且與檔名品號關聯，如 SC0008 的標題欄單獨品號行）
  if (fpNorm) {
    for (const line of lines) {
      const trimmed = (line || '').trim();
      if (!trimmed || trimmed.split(/\s+/).length !== 1) continue;
      const t = titleBlockToken(trimmed, { relatedTo: fpNorm });
      if (t) { cands.push(t); break; }
    }
  }
  // 檔名與品號基本一致為命名慣例：多候選時優先取與檔名品號一致的（防 BOM 表頭誤取）
  const chosen = cands.find((c) => fpNorm && norm(c) === fpNorm) || cands[0] || null;
  if (chosen) out.partNo = chosen;
  for (let i = 0; i < lines.length; i++) {
    const line = (lines[i] || '').trim();
    if (!line) continue;
    if (!out.rev) {
      const r = line.match(REV_LABEL_RE);
      if (r) {
        const rest = line.slice(r.index + r[0].length).trim();
        const tok = rest.split(/\s+/)[0];
        if (tok && REV_TOKEN_RE.test(tok) && !NON_REV_TOKEN.test(tok)) out.rev = tok;
      }
    }
    if (!out.name) {
      if (TITLE_LABEL_RE.test(line) || (spc && /^Description$/i.test(line))) {
        const tok = titleBlockToken(lines[i + 1]);
        if (tok) out.name = tok;
      }
    }
  }
  // 客戶圖格式 fallback：無 PART 標籤時，前 6 行內品號格式 token，
  // 且須與檔名品號關聯（檔名與內文品號基本一致為命名慣例；避免誤取圖框名/尺寸）
  if (!out.partNo && fpNorm) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const tok = titleBlockToken(lines[i], { relatedTo: fpNorm });
      if (tok) {
        out.partNo = tok;
        break;
      }
    }
  }
  return Object.keys(out).length ? out : null;
}

// 檔名 → 組件品號（如 BD-8003875_Rev.04.pdf → BD-8003875）
// 規則：本體（剝除括號/版本/-C/中文描述後）為有效品號格式且非文件編號 → 本體優先；
//       否則取括號內品號（排除 Rev/Rec 版次、純數字 1~3 位、含底線/空格尺寸、XXXX 占位符）
//       例：PFM-DWG-30125-01(126-006)_Rev.AB.pdf → 本體為文件編號 → 126-006
//           PL-9001(Rev.B)_空白包裝袋(140_120).pdf → 本體 PL-9001（尺寸 140_120 排除）
//           9X.20860.005(6X.20860.405)(PL-9001包裝袋...).pdf → 本體 9X.20860.005
function assemblyIdFromFileName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '');
  const parens = [...base.matchAll(/\(([^)]*)\)/g)].map((m) => m[1].trim());
  // 本體剝除：移除括號、版本尾綴、-C、mdx 標記（領域規則：mdx 不屬品號）、
  //           中文描述後綴、BD 客戶代稱前綴（領域規則：BD 不屬品號）
  //           例：BD_404028_Rev.1 → 404028；BD(BARD)-RM5003037含規格書 → RM5003037
  let baseClean = base
    .replace(/\([^)]*\)/g, '')
    .replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '')
    .replace(/[-_ ]?mdx$/i, '')
    .trim();
  baseClean = baseClean.replace(/[^\x00-\x7F].*$/, '');
  baseClean = baseClean.replace(/^BD[-_]/i, '').replace(/[_\-]+$/, '').trim();
  // 僅「含括號」的檔名才剝除尾綴 -C（如 (Rev.A)-C.pdf）；避免誤傷 -MC 品號（75-0485-MC_29 → 75-0485-MC）
  if (/\(/.test(base)) {
    baseClean = baseClean.replace(/[-_]?C$/i, '');
  }
  // 本體第一 token 為有效品號格式（排除 PFM-DWG 文件編號、SPC 圖號註冊）→ 本體優先
  // （品號位於檔名首段為命名慣例；尾綴如 _A021-signed 210714 不影響判定）
  const firstToken = baseClean.split(/[_ ]+/)[0];
  if (/^[A-Z0-9][A-Z0-9_.\-]*$/i.test(firstToken) && !/^(PFM-DWG-|SPC\d+_\d+_)/i.test(firstToken)) {
    return firstToken;
  }
  const parenPn = parens.find((p) =>
    !/^(Rev|Rec)/i.test(p) && !/^\d{1,3}$/.test(p) && !/X{2,}/i.test(p) && !/[_ ]/.test(p)
  );
  if (parenPn) {
    return parenPn
      .replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '')
      .replace(/[-_]?C$/i, '')
      .trim();
  }
  return baseClean;
}

// 將檔名衍生組件 ID 解析為 master 標準品號（版本/來源後綴剝除 → 內文自身品號前綴比對）
function resolveAssemblyId(assemblyId, knownList, index) {
  const normA = norm(assemblyId);
  if (index.has(normA)) return index.get(normA);

  // 家族前綴合併：core 為某 master 品號的前綴且後續首字元非數字（X3299 → X3299AAM，
  // BD-X3299 圖與 BD-X3299AAM 圖同 Rev.7 同內容；R1-1585 不會誤合併 R1-15853 因後續為數字）
  if (normA.length >= 3) {
    for (const [nk, pn] of index) {
      if (nk.length > normA.length && nk.startsWith(normA) && !/\d/.test(nk[normA.length])) {
        return pn;
      }
    }
  }

  // BD- 圖型前綴（非品號一部分）：BD-X3299AAM → X3299AAM（未命中 master 則回傳剝除後的核心，
  // 使 BD-8013945 → 8013945 可作為待登錄品號；若 core 為既有品號的家族前綴如 X3299 → X3299AAM 則合併）
  const bd = assemblyId.match(/^BD[-_](.+)$/i);
  if (bd) {
    const core = bd[1].trim();
    const direct = index.get(norm(core));
    if (direct) return direct;
    // 家族前綴合併：core 為某 master 品號的前綴且後續首字元非數字（BD-X3299 → X3299AAM）
    for (const [nk, pn] of index) {
      if (nk.length > norm(core).length && nk.startsWith(norm(core)) && !/\d/.test(nk[norm(core).length])) {
        return pn;
      }
    }
    return core;
  }

  // 逐層剝除常見後綴（_mdx / -MC_xx / -C / _xx / Rev），每剝一層即查 master
  let cur = assemblyId;
  let stripped = assemblyId;
  const steps = [
    (s) => s.replace(/[-_ ]?mdx$/i, ''),
    // -MC = Mouldex Component（客戶供應商/來源標記，不屬品號）：75-0485-MC → 75-0485
    (s) => s.replace(/[-_]?MC[_ ]?\d{1,3}$/i, ''),
    (s) => s.replace(/[-_]?MC$/i, ''),
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

  // 中文描述後綴剝除（「PL-9001_包裝袋」→ PL-9001）：品號格式不含中文（PART_NO_TOKEN_RE 亦排除），
  // 中文段為描述性文字；僅當剝除後為純 ASCII 品號格式才採用
  const asciiHead = stripped.replace(/[^A-Za-z0-9_.\-].*$/, '').trim();
  if (asciiHead && asciiHead !== stripped && /^[A-Z0-9][A-Z0-9_.\-]*$/i.test(asciiHead)) {
    return asciiHead;
  }

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

// 檔名品號有效判定：排除 SPC/PFM/BD 文件編號、占位符 XXXX、過短（130/140/220）、
// 純字母無數字（BARD/SK — 無法確認是品號，改記 pendingCandidates 待人工確認）
function sanitizeFilePartNo(id) {
  if (!id || typeof id !== 'string') return null;
  if (!/^[A-Z0-9][A-Z0-9_.\-]*$/i.test(id)) return null;
  if (id.length < 4 || !/\d/.test(id)) return null;
  if (/X{2,}/i.test(id)) return null;
  if (/^(SPC\d+_\d+_(RAW|CIV)\d+|PFM-DWG-|BD[-_][A-Z0-9]+)$/i.test(id)) return null;
  return id;
}

// 疑義候選：檔名第一 token 為品號格式但無法確認（純字母、過短）→ 待人工確認清單
function pendingCandidateFromFileName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, '').replace(/\([^)]*\)/g, '').replace(/[_ ]?Rev\.? ?[A-Z0-9]*$/i, '');
  const token = (base.split(/[_()\s]+/)[0] || '').trim();
  if (!token) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._\-]*$/.test(token)) return null;
  if (/X{2,}/i.test(token)) return null;
  if (/^(SPC|PFM-DWG)/i.test(token)) return null;
  if (token.length >= 4 && /\d/.test(token)) return null; // 有數字且夠長 = 有效候選（已有 filePartNo 路徑）
  return token;
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
  if (scanAll || extractMode) {
    walkDir(ALL_IMAGE_DIR, allFiles);
  } else {
    for (const d of ASSEMBLY_DIRS) walkDir(d, allFiles);
  }
  console.log(`掃描圖檔 ${allFiles.length} 張...${scanAll || extractMode ? '（全資料夾模式）' : ''}${extractMode ? '（角色化提取）' : ''}${parentOfArg ? `（反向識別 ${parentOfArg}）` : ''}`);

  const report = [];
  const bomLinks = []; // { assembly, child }
  const extractItems = []; // v7.8.7 圖檔優先管線：全部圖檔角色化提取
  const titleBlocks = new Map(); // f → { partNo, rev, name }（內文標題欄）

  for (const f of allFiles) {
    const rel = f.replace(/\\/g, '/');
    const fileName = rel.split('/').pop();
    const rawAssemblyId = assemblyIdFromFileName(fileName);
    let text = '';

    if (/\.pdf$/i.test(fileName)) {
      try {
        const pdfResult = await extractPdfText(f, { withLines: extractMode });
        text = typeof pdfResult === 'string' ? pdfResult : pdfResult.text;
        if (extractMode) {
          const spc = /^SPC\d/i.test(fileName);
          const titleBlock = parseTitleBlock(pdfResult.lines, { spc, fileName });
          titleBlocks.set(f, titleBlock);
        }
      } catch (e) {
        const role = extractMode ? roleOf(rel) : null;
        report.push({ file: fileName, assemblyId: rawAssemblyId, ok: false, reason: `PDF 無法讀取: ${e.message}` });
        if (extractMode) {
          const filePartNo = sanitizeFilePartNo(resolveAssemblyId(rawAssemblyId, [], index));
          extractItems.push({
            rel, file: fileName, role, ok: false,
            reason: `PDF 無法讀取: ${e.message}`,
            filePartNo, pendingCandidate: filePartNo ? null : pendingCandidateFromFileName(fileName),
            assemblyId: filePartNo, known: [], unknown: [], bomLinks: [],
            titleBlock: null,
          });
        }
        continue;
      }
    }

    const candidates = extractPartNoCandidates(text);
    if (candidates.length === 0) {
      const role = extractMode ? roleOf(rel) : null;
      report.push({ file: fileName, assemblyId: rawAssemblyId, ok: false, reason: '未提取到品號' });
      if (extractMode) {
        const filePartNo = sanitizeFilePartNo(resolveAssemblyId(rawAssemblyId, [], index));
        extractItems.push({
          rel, file: fileName, role, ok: false,
          reason: '未提取到品號',
          filePartNo, pendingCandidate: filePartNo ? null : pendingCandidateFromFileName(fileName),
          assemblyId: filePartNo, known: [], unknown: [], bomLinks: [],
          titleBlock: null, review: null,
        });
      }
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
    const role = extractMode ? roleOf(rel) : null;

    // 檔名品號：組件圖 = 解析後的組件 ID；零件/物料圖 = 剝除版本後綴的自身品號
    const filePartNo = sanitizeFilePartNo(assemblyId);
    const pendingCandidate = filePartNo ? null : pendingCandidateFromFileName(fileName);

    report.push({ file: fileName, assemblyId, ok: known.length > 0, known, unknown });
    if (extractMode) {
      const titleBlock = titleBlocks.get(f) || null;
      let review = null;
      if (titleBlock && titleBlock.partNo && filePartNo) {
        // 剝除 -MC/-C 後綴標記後比較（75-0485-MC ≡ 75-0485）；仍不同才標記
        const stripSuffix = (s) => s.replace(/[-_]?MC$/i, '').replace(/[-_]?C$/i, '');
        if (norm(stripSuffix(titleBlock.partNo)) !== norm(stripSuffix(filePartNo))) {
          review = `內文欄位品號 ${titleBlock.partNo} 與檔名品號 ${filePartNo} 不一致`;
        }
      }
      extractItems.push({
        rel, file: fileName, role, ok: known.length > 0,
        filePartNo, pendingCandidate,
        assemblyId,
        titleBlock,
        review,
        known, unknown,
        bomLinks: [],
      });
    }

    // BOM 連結：僅組件圖的內文零件清單（零件/物料圖內文不建立父子關係）
    if (role !== '零件' && role !== '物料') {
      for (const p of known) {
        // 排除含中文/空格等非品號字元的檔名衍生組件（如「PN-0002_… 包裝說明書」）
        // 排除文件編號格式（SPC 圖號註冊 SPCxxxx_NN_RAW/CIVxxxx、PFM-DWG）與未剝除的 BD- 前綴
        const nonPn = /^(SPC\d+_\d+_(RAW|CIV)\d+|PFM-DWG-|BD[-_][A-Z0-9]+)$/i.test(assemblyId);
        if (p.partNo !== assemblyId && !nonPn && /^[A-Z0-9][A-Z0-9_.\-]*$/i.test(assemblyId)) {
          bomLinks.push({ assembly: assemblyId, child: p.partNo });
          const last = extractItems[extractItems.length - 1];
          if (last) last.bomLinks.push({ assembly: assemblyId, child: p.partNo });
        }
      }
    }
  }

  // 寫入報告
  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`報告已寫入 ${REPORT_PATH}`);

  if (extractMode) {
    const roleCount = {};
    let withFilePartNo = 0;
    for (const it of extractItems) {
      roleCount[it.role] = (roleCount[it.role] || 0) + 1;
      if (it.filePartNo) withFilePartNo++;
    }
    const filePns = new Set(extractItems.map((it) => it.filePartNo).filter(Boolean));
    const pendingMap = new Map();
    for (const it of extractItems) {
      if (it.pendingCandidate) pendingMap.set(it.pendingCandidate, (pendingMap.get(it.pendingCandidate) || 0) + 1);
    }
    writeFileSync(EXTRACT_PATH, JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalFiles: extractItems.length,
      roles: roleCount,
      uniqueFilePartNos: filePns.size,
      pendingCandidates: Object.fromEntries([...pendingMap.entries()].sort((a, b) => b[1] - a[1])),
      items: extractItems,
    }, null, 2), 'utf-8');
    console.log(`角色化提取已寫入 ${EXTRACT_PATH}`);
    console.log(`  角色分佈: ${JSON.stringify(roleCount)}`);
    console.log(`  檔名品號提取: ${withFilePartNo}/${extractItems.length} 張, 唯一 ${filePns.size} 個`);
    if (pendingMap.size > 0) {
      console.log(`  待人工確認候選（純字母/過短）: ${[...pendingMap.entries()].map(([t, n]) => `${t}(${n})`).join(', ')}`);
    }
    // 孤兒圖（檔名品號未登錄 master）統計
    const unregPns = new Set([...filePns].filter((pn) => !index.has(norm(pn))));
    const orphanFiles = extractItems.filter((it) => !it.filePartNo || !index.has(norm(it.filePartNo)));
    console.log(`  未登錄 master 的檔名品號: ${unregPns.size} 個 → 對應圖檔 ${orphanFiles.length} 張（待收錄）`);
  }

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