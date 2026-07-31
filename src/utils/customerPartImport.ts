import * as XLSX from 'xlsx';
import { PartItem } from '../types';
import { dedupeAlternates } from './alternates';
import { renamePartNo } from './bomEngine';

interface CustomerRow {
  drawing: string;
  product: string;
  customerPart: string;
}

export interface CustomerImportReport {
  created: number;
  merged: number;
  renamed: string[];
  skipped: { row: number; reason: string }[];
}

const normalizeCode = (v: unknown): string => String(v ?? '').trim();

function findCustomerSheet(wb: XLSX.WorkBook): XLSX.WorkSheet | null {
  const names = wb.SheetNames;
  const exact = names.find((n) => n.includes('客戶料號') || n.includes('客户料号'));
  if (exact) return wb.Sheets[exact];
  const fuzzy = names.find((n) => n.includes('料號') || n.includes('料号'));
  return fuzzy ? wb.Sheets[fuzzy] : null;
}

// 解析「客戶料號」工作表：圖面編號 / 產品編號 / 零件編號(客) 三欄互換
export function parseCustomerSheet(buf: ArrayBuffer): CustomerRow[] {
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = findCustomerSheet(wb);
  if (!ws) return [];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) as unknown[][];
  if (rows.length === 0) return [];

  let drawingCol = -1;
  let productCol = -1;
  let customerPartCol = -1;
  let startIdx = -1;

  for (let r = 0; r < Math.min(rows.length, 30); r++) {
    const row = rows[r];
    if (!row) continue;
    const headerText = row.map((c) => String(c ?? '')).join('\u0000');
    if (!headerText.trim()) continue;
    drawingCol = row.findIndex((c) => String(c ?? '').includes('圖面'));
    productCol = row.findIndex((c) => String(c ?? '').includes('產品'));
    customerPartCol = row.findIndex((c) => String(c ?? '').includes('零件'));
    if (drawingCol >= 0 || productCol >= 0 || customerPartCol >= 0) {
      startIdx = r + 1;
      break;
    }
  }
  if (startIdx < 0) return [];

  const result: CustomerRow[] = [];
  for (let r = startIdx; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const drawing = drawingCol >= 0 ? normalizeCode(row[drawingCol]) : '';
    const product = productCol >= 0 ? normalizeCode(row[productCol]) : '';
    const customerPart = customerPartCol >= 0 ? normalizeCode(row[customerPartCol]) : '';
    if (!drawing && !product && !customerPart) continue;
    result.push({ drawing, product, customerPart });
  }
  return result;
}

// 三碼互換併入資料庫：主品號以「圖面編號」為優先，其餘碼進替代品號
export function applyCustomerRows(
  existingParts: PartItem[],
  rows: CustomerRow[]
): { parts: PartItem[]; report: CustomerImportReport } {
  const parts = existingParts.map((p) => ({ ...p }));
  const report: CustomerImportReport = { created: 0, merged: 0, renamed: [], skipped: [] };

  const codesOf = (p: PartItem): string[] => [p.partNo, ...(p.alternates ?? [])];
  const claims = new Map<string, string>();
  for (const p of parts) {
    for (const c of codesOf(p)) {
      if (c && !claims.has(c)) claims.set(c, p.id);
    }
  }

  const releaseClaims = (p: PartItem) => {
    for (const c of codesOf(p)) {
      if (claims.get(c) === p.id) claims.delete(c);
    }
  };
  const claimFor = (p: PartItem) => {
    for (const c of codesOf(p)) {
      if (c && !claims.has(c)) claims.set(c, p.id);
    }
  };

  rows.forEach((row, idx) => {
    const rowNo = idx + 1;
    const codes = Array.from(new Set([row.drawing, row.product, row.customerPart].filter(Boolean)));
    if (codes.length === 0) return;
    const main = row.drawing || row.product || row.customerPart;
    const alts = codes.filter((c) => c !== main);

    // 1. 與現有資料比對（任一碼命中即為同一實體）
    const matched = parts.filter((p) => codes.some((c) => codesOf(p).includes(c)));
    if (matched.length > 1) {
      report.skipped.push({ row: rowNo, reason: `三碼同時命中 ${matched.length} 筆資料，無法決定歸屬` });
      return;
    }

    if (matched.length === 0) {
      // 2a. 新增
      if (codes.some((c) => claims.has(c))) {
        report.skipped.push({ row: rowNo, reason: `代碼 ${codes.filter((c) => claims.has(c)).join('、')} 已被其他資料佔用` });
        return;
      }
      const newPart: PartItem = {
        id: `imp-cust-${Date.now()}-${idx}`,
        customer: '',
        partNo: main,
        name: main,
        alternates: dedupeAlternates(alts, main),
      };
      parts.push(newPart);
      claimFor(newPart);
      report.created++;
      return;
    }

    // 2b. 合併
    const target = matched[0];
    const targetId = target.id;
    if (codes.some((c) => claims.has(c) && claims.get(c) !== targetId)) {
      report.skipped.push({ row: rowNo, reason: `代碼 ${codes.filter((c) => claims.has(c) && claims.get(c) !== targetId).join('、')} 已被其他資料佔用` });
      return;
    }
    releaseClaims(target);
    const oldNo = target.partNo;
    let merged = { ...target };
    if (main !== oldNo) {
      merged = { ...merged, partNo: main, alternates: dedupeAlternates([...alts, oldNo, ...(merged.alternates ?? [])], main) };
      renamePartNo(oldNo, main);
      report.renamed.push(`${oldNo} → ${main}`);
    } else {
      merged = { ...merged, alternates: dedupeAlternates([...alts, ...(merged.alternates ?? [])], main) };
    }
    const idx2 = parts.findIndex((p) => p.id === targetId);
    if (idx2 >= 0) parts[idx2] = merged;
    claimFor(merged);
    report.merged++;
  });

  return { parts, report };
}
