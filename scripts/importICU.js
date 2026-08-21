#!/usr/bin/env node
// importICU.js — 解析「客戶(ICU)原料料號對照表.xlsx」→ 結構化 JSON
// 輸出：data/icu-parts.json
// 用法：node scripts/importICU.js [--verbose]
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DATA_DIR = resolve(ROOT, 'data');
const EXCEL_PATH = resolve(ROOT, 'rawdata', '客戶(ICU)原料料號對照表.xlsx');
const OUT_PATH = resolve(DATA_DIR, 'icu-parts.json');

const verbose = process.argv.includes('--verbose');

// 讀取 Excel
const wb = XLSX.readFile(EXCEL_PATH);
const ws = wb.Sheets[wb.SheetNames[0]];
const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

// 欄位對應（row 0 = header）
// 0:客戶 1:模具號碼 2:穴數 3:圖面編號 4:產品編號 5:零件編號(客) 6:零件名稱(中) 7:零件名稱(英) 8:顏色 9:原料
const COL = { customer: 0, moldNo: 1, cavity: 2, dwgNo: 3, productNo: 4, partNo: 5, nameCN: 6, nameEN: 7, color: 8, material: 9 };

// Step 1：解析 rows，處理跨列原料合併
const parts = [];
let current = null;

for (let i = 1; i < raw.length; i++) {
  const row = raw[i];
  const pn = String(row[COL.partNo] || '').trim();
  const customer = String(row[COL.customer] || '').trim();
  const material = String(row[COL.material] || '').trim();

  // 新的零件行（有 customer + partNo）
  if (customer && pn) {
    if (current) parts.push(current);
    current = {
      partNo: pn,
      customer,
      moldNo: String(row[COL.moldNo] || '').trim(),
      cavity: row[COL.cavity] != null ? String(row[COL.cavity]).trim() : '',
      dwgNo: String(row[COL.dwgNo] || '').trim(),
      productNo: String(row[COL.productNo] || '').trim(),
      nameCN: String(row[COL.nameCN] || '').trim(),
      nameEN: String(row[COL.nameEN] || '').trim(),
      color: String(row[COL.color] || '').trim(),
      material: material,
    };
    continue;
  }

  // 空行或延續行：若當前零件有 material 且本行 material 非空 → 合併
  if (current && material) {
    current.material = current.material ? current.material + ' ' + material : material;
    if (verbose) console.log(`  [跨列合併] ${current.partNo} ← ${material}`);
  }
}
if (current) parts.push(current);

// Step 2：收集所有「產品編號」+「零件編號」的值作為基準集（用於判斷原料中的料號引用）
const refSet = new Set();
for (const p of parts) {
  if (p.partNo) refSet.add(p.partNo);
  if (p.productNo) refSet.add(p.productNo);
}

// Step 3：從原料描述中提取疑似料號（數字格式如28-0397、451118、90-9634）
// 若該料號在 refSet 中 → 標記為原料引用（非新品號）
const PN_IN_MATERIAL_RE = /(?:^|,\s*|NO\.\s*|COMMODITY\s+(?:NO\.\s*)?)(\d{2,3}-\d{4,6}(?:-\w+)?|\d{5,7})/gi;

for (const p of parts) {
  p.materialRefs = [];
  if (!p.material) continue;
  let m;
  while ((m = PN_IN_MATERIAL_RE.exec(p.material)) !== null) {
    const ref = m[1].trim();
    if (refSet.has(ref)) {
      p.materialRefs.push(ref);
    }
  }
}

// Step 4：統計
console.log(`ICU 零件總數: ${parts.length}`);
console.log(`基準集料號數: ${refSet.size}`);

// Step 5：寫入 JSON
writeFileSync(OUT_PATH, JSON.stringify(parts, null, 2), 'utf8');
console.log(`輸出: ${OUT_PATH}`);

// 輸出摘要
if (verbose) {
  for (const p of parts) {
    const refs = p.materialRefs.length ? ` [原料引用: ${p.materialRefs.join(', ')}]` : '';
    console.log(`  ${p.partNo.padEnd(14)} | ${p.nameEN.slice(0, 35).padEnd(35)} | ${p.material.slice(0, 35)}${refs}`);
  }
}
