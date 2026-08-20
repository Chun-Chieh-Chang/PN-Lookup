// v7.9.0 圖檔語意識別：pdfjs 文字層（無文字層則 tesseract.js OCR）→ Gemini 結構化提取
// 輸出：PART NO. / Description / DWG NO. / Material / BOM
// 用法：
//   node scripts/semanticExtract.js --sample          # 18 張樣本
//   node scripts/semanticExtract.js --file <rel路徑>   # 單張
//   node scripts/semanticExtract.js --ocr-only <rel路徑> # 只做 OCR 文字 dump（驗證用）
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');
const OUT_PATH = resolve(DATA_DIR, 'semantic-extract.json');
const OUT_XLSX_PATH = resolve(DATA_DIR, 'semantic-extract.xlsx');

// Node 環境 pdfjs wasm 載入 polyfill：file:// URL → 讀檔
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  if (typeof url === 'string' && url.startsWith('file://')) {
    const fp = decodeURIComponent(url.slice('file://'.length)).replace(/\//g, '\\');
    const buf = readFileSync(fp);
    return new Response(new Uint8Array(buf), { status: 200 });
  }
  return origFetch(url, init);
};

const SAMPLE_NAMES = [
  'SA0002(Rev.D)-C.pdf',
  'SB0001(Rev.B)-C.pdf',
  'SC0003(Rev.D)-C.pdf',
  'SD0002(Rev.E)-C.pdf',
  '3M41459(Rev.F)-C.pdf',
  'MDXE-153-02_E.pdf',
  'BD-8003875_Rev.04.pdf',
  'A01-200-111(Rev.A)-C.pdf',
  'A01-210-251-1(Rev.B)-C.pdf',
  'R1-10134-MC_08_mdx.pdf',
  'ICU原料料號對照表.pdf',
  'ICL-0001(Rev.L)_內箱標籤貼紙 (AK-1050).pdf',
  '9X.20860.002(6X.20860.402)(PL-9002包裝袋 (120mm X 220mm))_A02-signed 210701.pdf',
  'BD(BARD)-RM5003037含規格書(原VLV_88-109).pdf',
  'BD-8013945_Rev.1.pdf',
  'VLV-135-015_Rev.C.pdf',
  'F17-999-615(Rev.A)-C.pdf',
  'SPC0005450_04_RAW0000336_mdx.pdf',
];

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_PAGES = 4;
const MAX_LINES = 2500;

// 分工 prompt：標題欄提取（laguna-s-2.1-free 主力）只取 4 欄
const TITLE_PROMPT = `你是醫療器材工程圖解析專家。輸入是一張工程圖 PDF 的文字層，每行格式為 [y=座標] 文字內容（y 相近的行屬同一表格列）。
請嚴格只輸出一個 JSON 物件，不得有其他文字、思考過程或 markdown 圍欄。格式：
{"partNo": "品號", "description": "品名規格", "dwgNo": "圖號", "material": "原料"}
領域規則：
1. partNo：取自標題欄 PART NO. / 零件編號欄（零件編號）；與圖檔名品號一致（檔名 SB0001(Rev.B)-C.pdf → SB0001）；去掉版本尾綴（-C、-E、-MC、-mdx、(Rev.X) 等）；「MOULDEX」開頭的編號（如 M05003-R01）是模具編號非品號，不可取；純品號格式（如 SB0001、A01-200-111、MDXE-153-02、E13-999-421、8003875）。
2. description：品名規格（DESCRIPTION / 零件名稱欄），可含英文縮寫。
3. dwgNo：圖號（DWG NO. / 檔案編號欄）；純圖號；無則 null。
4. material：原料（MATERIAL / 材質欄）；無則 null。`;

// 分工 prompt：BOM 提取（hy3-free 主力）只取零件清單
const BOM_PROMPT = `你是醫療器材工程圖零件表解析專家。輸入是一張工程圖 PDF 的文字層，每行格式為 [y=座標] 文字內容（y 相近的行屬同一表格列，可用於判斷列邊界）。
請嚴格只輸出一個 JSON 物件，不得有其他文字、思考過程或 markdown 圍欄。格式：
{"bom": [{"partNo": "", "description": "", "qty": "", "material": ""}]}
領域規則：
1. bom：KEY UNIT / PART LIST / 零件表 表格列，每列取 PART NO./品號、DESCRIPTION 品名、QTY 數量、MATERIAL 原料；表格行錯位時依 y 座標與品號格式判斷列邊界。
2. 若文字層含有 KEY UNIT 表頭但找不到完整列，仍須依 y 座標與品號格式盡力逐列提取，不可回空陣列。
3. 圖面沒有零件清單表格 → bom 為 []。
4. 檔名含 -MC / mdx 的加工複本 → bom 為 []。
5. 對照表/規格書類（檔名含 對照表、規格書、SPEC）→ bom 為 []。
6. 品號格式如 SB0001、A01-200-111、MDXE-153-02、E13-999-421、22-690250；「適用」「材料」「組裝目標」等註記非品號；「mdx」「MC」為加工標記非品號。`;

async function extractPdfLines(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const wasmDir = resolve(ROOT, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/';
  const data = new Uint8Array(readFileSync(filePath).buffer);
  const doc = await pdfjs.getDocument({
    data,
    wasmUrl: wasmDir,
    useSystemFonts: true,
  }).promise;
  const lines = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const page = await doc.getPage(i);
      const tc = await page.getTextContent();
      const items = tc.items.map((x) => ({ str: x.str || '', x: x.transform[4], y: x.transform[5] }));
      const rows = new Map();
      for (const it of items) {
        const key = Math.round(it.y / 4);
        if (!rows.has(key)) rows.set(key, []);
        rows.get(key).push(it);
      }
      for (const [key, r] of rows.entries()) {
        const line = r.sort((a, b) => a.x - b.x).map((it) => it.str.trim()).filter(Boolean).join(' ');
        if (line) lines.push(`[y=${key * 4}] ${line}`);
      }
      page.cleanup();
    }
  } finally {
    await loadingTaskDestroy(doc);
  }
  return lines.slice(0, MAX_LINES);
}

async function loadingTaskDestroy(doc) {
  try { await doc.cleanup?.(); } catch { /* ignore */ }
  try { await doc.destroy?.(); } catch { /* ignore */ }
}

async function ocrPdf(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createWorker } = await import('tesseract.js');
  const wasmDir = resolve(ROOT, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/';
  const data = new Uint8Array(readFileSync(filePath).buffer);
  const doc = await pdfjs.getDocument({
    data,
    wasmUrl: wasmDir,
    useSystemFonts: true,
  }).promise;
  const worker = await createWorker(['eng', 'chi_sim'], 1, {
    logger: (m) => { if (m.status === 'recognizing text') process.stdout.write(`\rOCR ${Math.round(m.progress * 100)}%   `); },
  });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const lines = [];
  try {
    for (let i = 1; i <= Math.min(doc.numPages, MAX_PAGES); i++) {
      const page = await doc.getPage(i);
      const viewport = page.getViewport({ scale: 5 });
      const { createCanvas } = await import('@napi-rs/canvas');
      const cv = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = cv.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;
      page.cleanup();
      // v7.9.1 OCR 單頁超時保護：tesseract worker 偶發死鎖（SB0087 卡 50min+）→ 180s 超時拋錯
      const recognize = worker.recognize(cv.toBuffer('image/png'));
      const { data: ocrText } = await Promise.race([
        recognize,
        new Promise((_, rej) => setTimeout(() => rej(new Error(`OCR 單頁超時（第 ${i} 頁 >180s）`)), 180000)),
      ]);
      lines.push(...ocrText.text.split('\n').map((l) => l.trim()).filter(Boolean));
    }
  } finally {
    await worker.terminate();
    await loadingTaskDestroy(doc);
  }
  process.stdout.write('\n');
  return lines.slice(0, MAX_LINES);
}

async function geminiExtract(textLines, fileName) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });
  const content = textLines.join('\n');
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: `${COMBO_PROMPT}\n\n圖檔名：${fileName}\n===== 圖面文字層開始 =====\n${content}\n===== 圖面文字層結束 =====`,
        config: { temperature: 0.1, responseMimeType: 'application/json' },
      });
      const raw = resp.text.trim();
      const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ''));
      return { ok: true, data: json };
    } catch (e) {
      if (attempt === 2) return { ok: false, error: e.message };
    }
  }
}

// v7.9.0 本機模型 provider（OpenAI 相容端點，讀 auth.json 憑證，免費無 quota）
const ZEN_ENDPOINT = 'https://opencode.ai/zen/v1/chat/completions';
const ZEN_MODEL_DEFAULT = 'laguna-s-2.1-free';
const AGNES_ENDPOINT = 'https://apihub.agnes-ai.com/v1/chat/completions';
const AGNES_MODEL = 'agnes-2.0-flash';

function loadProviderKey(prefer = 'opencode') {
  const authPaths = [
    process.env.AGNES_API_KEY,
    'C:/Users/ws61/.local/share/opencode/auth.json',
    `${process.env.USERPROFILE}/.local/share/opencode/auth.json`,
  ];
  for (const p of authPaths) {
    if (!p) continue;
    if (p.startsWith('sk-')) return p;
    try {
      const a = JSON.parse(readFileSync(p, 'utf-8'));
      if (prefer === 'opencode' && a.opencode?.key) return a.opencode.key;
      if (prefer === 'agnes' && a.agnes?.key) return a.agnes.key;
      if (a.opencode?.key) return a.opencode.key;
    } catch { /* 下一個 */ }
  }
  return null;
}

// 強化 JSON 提取：全文 → 去掉圍欄 → 由後往前嘗試每一段 {...}
function extractJson(text) {
  if (!text) return null;
  const clean = text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  try { return JSON.parse(clean); } catch {}
  const starts = [...clean.matchAll(/\{/g)].map((m) => m.index);
  for (let i = starts.length - 1; i >= 0; i--) {
    try { return JSON.parse(clean.slice(starts[i])); } catch {}
  }
  return null;
}

async function zenExtract(textLines, fileName, model, prompt) {
  const key = loadProviderKey('opencode');
  if (!key) return { ok: false, error: '找不到 opencode/zen API key（auth.json）' };
  const content = textLines.join('\n');
  const body = {
    model,
    messages: [{ role: 'user', content: `${prompt}\n\n圖檔名：${fileName}\n===== 圖面文字層開始 =====\n${content}\n===== 圖面文字層結束 =====` }],
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(ZEN_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body),
      });
      const d = await resp.json();
      if (!resp.ok) {
        if ((resp.status === 429 || resp.status === 503) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 30000));
          continue;
        }
        return { ok: false, error: `zen ${resp.status}: ${d.error?.message || JSON.stringify(d).slice(0, 200)}` };
      }
      const content = d.choices?.[0]?.message?.content?.trim();
      if (!content) return { ok: false, error: 'zen 回應空白' };
      const json = extractJson(content);
      if (!json) return { ok: false, error: 'zen 回應非 JSON' };
      return { ok: true, data: json };
    } catch (e) {
      if (attempt === 3) return { ok: false, error: e.message };
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// 多模型分工：標題欄（laguna-s-2.1-free）＋ BOM（hy3-free），互為 fallback
async function zenDualExtract(textLines, fileName, titleModel, bomModel) {
  const [title, bom] = await Promise.all([
    zenExtract(textLines, fileName, titleModel, TITLE_PROMPT),
    zenExtract(textLines, fileName, bomModel, BOM_PROMPT),
  ]);
  const titleOk = title.ok && (title.data.partNo || title.data.description || title.data.material);
  const bomOk = bom.ok && Array.isArray(bom.data.bom);
  if (titleOk && bomOk) return { ok: true, data: { ...title.data, bom: bom.data.bom }, models: { title: titleModel, bom: bomModel } };
  if (!titleOk && bomOk) {
    const t2 = await zenExtract(textLines, fileName, bomModel, TITLE_PROMPT);
    if (t2.ok) return { ok: true, data: { ...t2.data, bom: bom.data.bom }, models: { title: bomModel, bom: bomModel } };
    return { ok: true, data: { partNo: null, description: null, dwgNo: null, material: null, bom: bom.data.bom }, models: { title: null, bom: bomModel }, warn: title.error };
  }
  if (titleOk && !bomOk) {
    const b2 = await zenExtract(textLines, fileName, titleModel, BOM_PROMPT);
    const bom2 = b2.ok && Array.isArray(b2.data.bom) ? b2.data.bom : [];
    return { ok: true, data: { ...title.data, bom: bom2 }, models: { title: titleModel, bom: b2.ok ? titleModel : null }, warn: !b2.ok ? bom.error : undefined };
  }
  return { ok: false, error: `標題欄(${title.error})；BOM(${bom.error})` };
}

// 單模型全量模式 prompt（--model 覆寫或 agnes 兜底用）：標題欄 + BOM 一次輸出
const COMBO_PROMPT = `${TITLE_PROMPT.slice(0, TITLE_PROMPT.indexOf('\n領域規則'))}\n5. bom：零件清單（KEY UNIT / PART LIST / 零件表）表格列（用 y 座標分組辨識每一列）；每列取 PART NO./品號、DESCRIPTION 品名、QTY 數量、MATERIAL 原料；圖面無零件清單則 []。表格行錯位時依 y 座標與品號格式判斷列邊界；含 KEY UNIT 表頭但列錯位時仍須盡力逐列提取。\n6. 加工複本（檔名含 -MC / mdx）：bom 為 []。\n7. 對照表/規格書類（檔名含 對照表、規格書、SPEC）：bom 為 []。\n8. 品號不可含「適用/材料/組裝目標」等註記文字；「mdx」「MC」為加工標記非品號。\n${TITLE_PROMPT.slice(TITLE_PROMPT.indexOf('領域規則'))}\n最終輸出格式（單一 JSON 物件）：\n{"partNo": "品號", "description": "品名規格", "dwgNo": "圖號", "material": "原料", "bom": [{"partNo": "", "description": "", "qty": "", "material": ""}]}`;

async function agnesExtract(textLines, fileName) {
  const key = loadProviderKey('agnes');
  if (!key) return { ok: false, error: '找不到 agnes API key（auth.json）' };
  const content = textLines.join('\n');
  const body = {
    model: AGNES_MODEL,
    messages: [{ role: 'user', content: `${COMBO_PROMPT}\n\n圖檔名：${fileName}\n===== 圖面文字層開始 =====\n${content}\n===== 圖面文字層結束 =====` }],
    max_tokens: 8192,
    response_format: { type: 'json_object' },
  };
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await Promise.race([
        fetch(AGNES_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify(body),
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error('agnes 請求超時（>120s）')), 120000)),
      ]);
      const d = await resp.json();
      if (!resp.ok) return { ok: false, error: `agnes ${resp.status}: ${d.error?.message || JSON.stringify(d).slice(0, 200)}` };
      const content = d.choices?.[0]?.message?.content?.trim();
      if (!content) return { ok: false, error: 'agnes 回應空白' };
      const json = extractJson(content);
      if (!json) return { ok: false, error: 'agnes 回應非 JSON' };
      return { ok: true, data: json };
    } catch (e) {
      if (attempt === 3) return { ok: false, error: e.message };
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
}

function loadExtractIndex() {
  const idx = {};
  const ex = JSON.parse(readFileSync(resolve(DATA_DIR, 'drawings-extract.json'), 'utf-8'));
  for (const it of ex.items) idx[it.file] = { rel: it.rel, filePartNo: it.filePartNo || null };
  return idx;
}

// KEY UNIT 表頭偵測：同行「KEY UNIT」，或 y 座標相近的拆行 KEY + UNIT（SB0001 類版式）
function findKeyUnit(lines) {
  const ys = lines.map((l) => {
    const m = l.match(/^\[y=(\d+)\]\s*(.*)$/);
    return m ? { y: +m[1], text: m[2] } : null;
  }).filter(Boolean);
  if (ys.some((r) => /KEY\s*UNIT/i.test(r.text))) return true;
  const keys = ys.filter((r) => /^KEY$/i.test(r.text.trim()));
  const units = ys.filter((r) => /^UNIT$/i.test(r.text.trim()));
  return keys.some((k) => units.some((u) => Math.abs(u.y - k.y) <= 60));
}

function needsOcr(lines) {
  if (lines.length < 3) return true;
  if (findKeyUnit(lines)) {
    // 同行表頭齊整（KEY UNIT 帶 DESCRIPTION/PART NO）→ 文字層可用
    const wellFormed = lines.some((l) => /KEY\s*UNIT/i.test(l) && /DESCRIPTION|PART\s*NO/i.test(l));
    // 拆行/錯位表頭：文字層仍可用（BOM 由規則兜底補齊），不需 OCR
    if (!wellFormed && !lines.some((l) => /KEY\s*UNIT/i.test(l))) return false;
    const hasKu = lines.some((l) => /KEY\s*UNIT/i.test(l));
    if (hasKu && !wellFormed) return true;
  }
  return false;
}

function hasKeyUnit(lines) {
  return findKeyUnit(lines);
}

// v7.9.1 規則 BOM 兜底：LLM BOM 為空但圖面有 KEY UNIT 表時，
// 以品號行正則直接掃文字層（無表頭 BOM 版式：品號行 y 分散、表頭在上方，
// 模型提取不穩 — SB0001 類）。行格式：[y=148] B06-410-111-1 / [y=172] B-077 8
function ruleBomFallback(lines) {
  const bom = [];
  for (const l of lines) {
    const m = l.match(/^\[y=\d+\]\s*([A-Z0-9]+-[A-Z0-9]+(?:-[A-Z0-9]+)*)(?:\s+(\d+))?$/);
    if (m) {
      bom.push({ partNo: m[1], description: '', qty: m[2] || '', material: '' });
      continue;
    }
    // 收縮膜特例：*14mm 規格行 → 0.08*14mm（SB0001 等無表頭版式，規格與品號分列）
    const s = l.match(/^\[y=\d+\]\s*\*\s*14(?:\.5)?\s*mm/i);
    if (s) {
      const spec = /14\.5/.test(l) ? '0.08*14.5mm' : '0.08*14mm';
      if (!bom.some((b) => b.partNo === spec)) bom.push({ partNo: spec, description: '收縮膜 Shrink Band', qty: '', material: '' });
    }
  }
  return bom;
}

async function main() {
  const args = process.argv.slice(2);
  const ocrOnly = args.includes('--ocr-only');
  const providerArg = args.find((a) => a.startsWith('--provider='))?.split('=')[1] || 'zen';
  const modelArg = args.find((a) => a.startsWith('--model='))?.split('=')[1] || ZEN_MODEL_DEFAULT;
  const fileArg = args.find((a) => a.startsWith('--file='))?.split('=')[1];
  const matchArg = args.find((a) => a.startsWith('--match='))?.split('=')[1];
  const sample = args.includes('--sample');
  const all = args.includes('--all');
  const retryFailed = args.includes('--retry-failed');
  const force = args.includes('--force');
  const batchSize = Number(args.find((a) => a.startsWith('--batch='))?.split('=')[1] || 6);
  const batchRestMs = Number(args.find((a) => a.startsWith('--rest='))?.split('=')[1] || (retryFailed ? 90000 : 12000));
  if (providerArg === 'gemini' && !process.env.GOOGLE_API_KEY && !ocrOnly) {
    console.error('缺少 GOOGLE_API_KEY（.env）');
    process.exit(1);
  }
  const extractFn = providerArg === 'gemini' ? geminiExtract
    : (providerArg === 'agnes' ? agnesExtract
      : ((l, f) => (modelArg ? zenExtract(l, f, modelArg, COMBO_PROMPT) : zenDualExtract(l, f, ZEN_MODEL_DEFAULT, 'hy3-free'))));
  const idx = loadExtractIndex();
  let targets = [];
  if (fileArg) targets = [{ name: fileArg.split('/').pop(), rel: fileArg }];
  else if (matchArg) {
    const m = Object.entries(idx).filter(([name]) => name.includes(matchArg));
    targets = m.map(([name, v]) => ({ name, rel: v.rel, filePartNo: v.filePartNo }));
    if (!targets.length) console.error(`--match 無符合：${matchArg}`);
  }
  else if (sample) targets = SAMPLE_NAMES.map((n) => (idx[n] ? { name: n, rel: idx[n].rel, filePartNo: idx[n].filePartNo } : null)).filter(Boolean);
  else if (all) targets = Object.entries(idx).map(([name, v]) => ({ name, rel: v.rel, filePartNo: v.filePartNo }));
  else if (retryFailed) {
    const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
    targets = prev.items.filter((r) => !r.ok && idx[r.file]).map((r) => ({ name: r.file, rel: idx[r.file].rel, filePartNo: idx[r.file].filePartNo || null }));
    console.log(`retry-failed：${targets.length} 筆待重試（批間 90s）`);
  }
  else {
    console.error('需指定 --sample 或 --file=<rel路徑> 或 --match=<檔名子串>');
    process.exit(1);
  }
  // v7.9.1 全量續跑：既有輸出中已成功且 partNo 非空者跳過（--force 強制重跑）
  if (all && !force && existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
      const done = new Set(prev.items.filter((r) => r.ok && r.data?.partNo).map((r) => r.file));
      const before = targets.length;
      targets = targets.filter((t) => !done.has(t.name));
      console.log(`續跑模式：${before} → ${targets.length} 待處理（跳過 ${before - targets.length} 已完成）`);
    } catch { /* 續跑資訊讀取失敗 → 全量重跑 */ }
  }
  if (all) console.log(`全量批次開始：${targets.length} 張，每批 ${batchSize} 張，批間休息 12s（避限流）`);
  const results = [];
  for (const t of targets) {
    const fullPath = resolve(ROOT, t.rel);
    if (!existsSync(fullPath)) {
      console.log(`[SKIP] ${t.name}（檔案不存在）`);
      continue;
    }
    console.log(`\n=== ${t.name} ===`);
    let lines = [];
    let method = 'text-layer';
    try {
      lines = await extractPdfLines(fullPath);
    } catch (e) {
      console.log(`  文字層失敗：${e.message} → 改用 OCR`);
      method = 'ocr';
    }
    if (needsOcr(lines)) {
      console.log(`  文字層品質不足（${lines.length} 行${lines.length ? '，表頭錯位' : ''}）→ 改用 OCR`);
      method = 'ocr';
      lines = [];
    }
    if (method === 'ocr') {
      try {
        lines = await Promise.race([
          ocrPdf(fullPath),
          new Promise((_, rej) => setTimeout(() => rej(new Error('OCR 整張超時（>600s）')), 600000)),
        ]);
      } catch (e) {
        console.log(`  [FAIL] OCR 失敗：${e.message}`);
        results.push({ file: t.name, method, ok: false, error: e.message });
        continue;
      }
    }
    if (ocrOnly) {
      const dumpPath = resolve(DATA_DIR, 'ocr-dump.txt');
      writeFileSync(dumpPath, `===== ${t.name} (${method}, ${lines.length} 行) =====\n\n` + lines.join('\n'), 'utf-8');
      console.log(`  [OCR dump 寫入 ${dumpPath}] ${lines.length} 行`);
      console.log(lines.join('\n').slice(0, 1200));
      continue;
    }
    const out = await extractFn(lines, t.name);
    if (!out.ok) {
      console.log(`  [FAIL] 提取失敗：${out.error}`);
      results.push({ file: t.name, method, ok: false, error: out.error });
      continue;
    }
    if (method === 'text-layer' && hasKeyUnit(lines) && !(out.data.bom || []).length) {
      console.log(`  KEY UNIT 表格偵測但 BOM 為空 → OCR 二次提取`);
      try {
        const ocrLines = await Promise.race([
          ocrPdf(fullPath),
          new Promise((_, rej) => setTimeout(() => rej(new Error('OCR 二次提取超時（>600s）')), 600000)),
        ]);
        const out2 = await extractFn(ocrLines, t.name);
        if (out2.ok && (out2.data.bom || []).length) {
          lines = ocrLines;
          method = 'ocr';
          out.data = out2.data;
          out.models = out2.models || out.models;
          out.warn = out2.warn || out.warn;
        }
      } catch (e) {
        console.log(`  OCR 二次提取失敗：${e.message}`);
      }
    }
    const d = out.data;
    // v7.9.1 規則 BOM 兜底：圖面有 KEY UNIT 表但模型 BOM 為空（無表頭/列錯位版式）→ 品號行規則掃描
    if (method === 'text-layer' && hasKeyUnit(lines) && !(d.bom || []).length) {
      const ruleBom = ruleBomFallback(lines);
      if (ruleBom.length) {
        console.log(`  規則 BOM 兜底：${ruleBom.map((b) => b.partNo + (b.qty ? `×${b.qty}` : '')).join(', ')}`);
        d.bom = ruleBom;
        out.models = out.models || {};
        out.models.bomRule = 'rule-fallback';
      }
    }
    // 檔名品號為第一事實來源：模型 partNo 不一致時以檔名品號修正（filePartNo 已剝離版本尾綴/前綴）
    const fp = t.filePartNo;
    if (fp && d.partNo && fp !== d.partNo) {
      console.log(`  品號修正：模型=${d.partNo} → 檔名=${fp}`);
      d.partNo = fp;
    }
    if (out.warn) console.log(`  警告：${out.warn}`);
    console.log(`  partNo: ${d.partNo} | models: ${out.models ? Object.values(out.models).filter(Boolean).join('+') : modelArg}`);
    console.log(`  description: ${d.description}`);
    console.log(`  dwgNo: ${d.dwgNo}`);
    console.log(`  material: ${d.material}`);
    console.log(`  bom: ${Array.isArray(d.bom) ? d.bom.length : 0} 列`);
    results.push({ file: t.name, method, ok: true, data: d, models: out.models, warn: out.warn, lines: lines.length });
    // v7.9.1 批間休息：避限流（--batch=N，--rest=毫秒 可調；retry-failed 預設 90s）
    if ((all || retryFailed) && batchSize > 0 && results.length % batchSize === 0 && results.length < targets.length) {
      console.log(`  ── 批次休息 ${Math.round(batchRestMs / 1000)}s（已完成 ${results.length}/${targets.length}）──`);
      await new Promise((r) => setTimeout(r, batchRestMs));
    }
    // v7.9.1 checkpoint：每 20 張寫入一次（中斷續跑不丟失）
    if ((all || retryFailed) && !ocrOnly && results.length % 20 === 0 && results.length < targets.length) {
      const total = await writeOutput(results, false, modelArg || ZEN_MODEL_DEFAULT + '+hy3-free');
      console.log(`  ── checkpoint 已寫入（累計 ${total} 筆）──`);
    }
  }
  if (!ocrOnly) {
    await writeOutput(results, sample, modelArg || ZEN_MODEL_DEFAULT + '+hy3-free');
  }
}

// v7.9.1 checkpoint：合併既有輸出後寫入 JSON+Excel（all 模式每 20 張調用，避免中途遺失）
async function writeOutput(results, sample, modelLabel) {
  let merged = results;
  if (!sample && existsSync(OUT_PATH)) {
    try {
      const prev = JSON.parse(readFileSync(OUT_PATH, 'utf-8'));
      const seen = new Set(results.map((r) => r.file));
      merged = [...prev.items.filter((r) => !seen.has(r.file)), ...results];
    } catch { /* 覆寫 */ }
  }
  writeFileSync(OUT_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), model: modelLabel || 'laguna-s-2.1-free+hy3-free', items: merged }, null, 2));
  await writeExcel(merged);
  return merged.length;
}

async function writeExcel(results) {
  const XLSX = await import('xlsx');
  const rows = results.map((r) => ({
    '圖檔': r.file,
    '解析方式': r.method,
    '狀態': r.ok ? '成功' : '失敗',
    '品號': r.ok ? (r.data.partNo ?? '') : '',
    '品名規格': r.ok ? (r.data.description ?? '') : '',
    '圖號': r.ok ? (r.data.dwgNo ?? '') : '',
    '原料': r.ok ? (r.data.material ?? '') : '',
    'BOM列數': r.ok ? (Array.isArray(r.data.bom) ? r.data.bom.length : 0) : 0,
    '模型': r.models ? Object.values(r.models).filter(Boolean).join('+') : '',
    '警告': r.warn || '',
    '錯誤': r.ok ? '' : r.error,
  }));
  const bomRows = [];
  for (const r of results) {
    if (!r.ok || !Array.isArray(r.data.bom)) continue;
    const parent = r.data.partNo || r.file;
    for (const b of r.data.bom) {
      bomRows.push({
        '組件品號': parent,
        '圖檔': r.file,
        '子件品號': b.partNo ?? '',
        '品名規格': b.description ?? '',
        '數量': b.qty ?? '',
        '原料': b.material ?? '',
      });
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), '圖檔解析總表');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(bomRows), 'BOM明細');
  XLSX.writeFile(wb, OUT_XLSX_PATH);
}

main().catch((e) => { console.error(e); process.exit(1); });