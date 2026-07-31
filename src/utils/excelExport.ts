import * as XLSX from 'xlsx';
import { PartItem } from '../types';
import { enrichParts, getBOMChildren } from './bomEngine';

function lookupName(partNo: string, partsLookup: Map<string, PartItem>): string {
  const found = partsLookup.get(partNo) || partsLookup.get(partNo.toUpperCase());
  return found?.name || partNo;
}

function buildAssemblySheet(
  prefix: string,
  labelForNameCol: '零件名稱' | '組立名稱',
  partsLookup: Map<string, PartItem>,
): XLSX.WorkSheet | null {
  const bd = getBOMChildren();
  const keys = Object.keys(bd).filter(k => k.startsWith(prefix)).sort();
  if (keys.length === 0) return null;

  const maxComponents = keys.reduce((max, k) => Math.max(max, bd[k]?.length || 0), 0);

  const colKeys: string[] = ['序號', '組立名稱', '組立名稱(英)', '組立編號'];
  for (let i = 1; i <= maxComponents; i++) {
    colKeys.push(`零件編號${i}`);
    colKeys.push(`${labelForNameCol}${i}`);
  }

  const rows: Record<string, string | number>[] = keys.map((key, idx) => {
    const part = partsLookup.get(key);
    const children = getBOMChildren()[key] || [];
    const row: Record<string, string | number> = {
      '序號': idx + 1,
      '組立名稱': part?.name || key,
      '組立名稱(英)': '',
      '組立編號': key,
    };
    for (let i = 0; i < maxComponents; i++) {
      const childNo = children[i] || '';
      row[`零件編號${i + 1}`] = childNo;
      row[`${labelForNameCol}${i + 1}`] = childNo ? lookupName(childNo, partsLookup) : '';
    }
    return row;
  });

  const ws = XLSX.utils.json_to_sheet(rows, { header: colKeys });
  ws['!cols'] = colKeys.map((k) => {
    const dataLen = Math.max(...rows.map(r => String(r[k] || '').length));
    return { wch: Math.max(k.length, dataLen) + 3 };
  });
  return ws;
}

const FULL_DATA_HEADERS = ['id', 'customer', 'partNo', 'name', 'notes', 'alternates', 'itemType', 'components', 'usedInAssemblies', 'createdAt'];

export function generateExcelWorkbook(parts: PartItem[]): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();
  const partsLookup = new Map<string, PartItem>();
  for (const p of parts) {
    partsLookup.set(p.partNo, p);
    const upper = p.partNo.toUpperCase();
    if (upper !== p.partNo) partsLookup.set(upper, p);
  }

  // Sheet 1: 客戶產品對照表
  const MAIN_HEADERS = ['客戶', '品號', '品名', '物料類別', '替代品號', '備註'];
  const sheet1Data = [MAIN_HEADERS, ...parts.map(p => [
    p.customer,
    p.partNo,
    p.name,
    p.itemType === 'assembly' ? '組件' : p.itemType === 'part' ? '零件' : '',
    (p.alternates ?? []).join('、'),
    p.notes ?? '',
  ])];
  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);
  ws1['!cols'] = [
    { wch: Math.max(4, ...parts.map(p => p.customer.length)) + 3 },
    { wch: Math.max(4, ...parts.map(p => p.partNo.length)) + 3 },
    { wch: Math.max(4, ...parts.map(p => p.name.length)) + 3 },
    { wch: 12 },
    { wch: 22 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, '客戶產品對照表');

  // Sheets 2-5: SA/SB/SC/SD 組立
  const sheets = [
    { prefix: 'SA', name: 'SA組立', label: '零件名稱' as const },
    { prefix: 'SB', name: 'SB組立', label: '零件名稱' as const },
    { prefix: 'SC', name: 'SC組立', label: '零件名稱' as const },
    { prefix: 'SD', name: 'SD組立', label: '組立名稱' as const },
  ];
  for (const s of sheets) {
    const ws = buildAssemblySheet(s.prefix, s.label, partsLookup);
    if (ws) XLSX.utils.book_append_sheet(wb, ws, s.name);
  }

  // Last sheet: 完整資料 — full PartItem fields for round-trip import fidelity
  const fullData: Record<string, string>[] = parts.map(p => ({
    'id': p.id,
    'customer': p.customer,
    'partNo': p.partNo,
    'name': p.name,
    'notes': p.notes ?? '',
    'alternates': (p.alternates ?? []).join('、'),
    'itemType': p.itemType ?? '',
    'components': p.components && p.components.length > 0 ? JSON.stringify(p.components) : '',
    'usedInAssemblies': p.usedInAssemblies && p.usedInAssemblies.length > 0 ? JSON.stringify(p.usedInAssemblies) : '',
    'createdAt': p.createdAt ?? '',
  }));
  const wsFull = XLSX.utils.json_to_sheet(fullData, { header: FULL_DATA_HEADERS });
  wsFull['!cols'] = FULL_DATA_HEADERS.map(h => ({ wch: 18 }));
  XLSX.utils.book_append_sheet(wb, wsFull, '完整資料');

  return wb;
}

export function parseExcelToParts(data: ArrayBuffer): PartItem[] {
  const wb = XLSX.read(new Uint8Array(data), { type: 'array' });

  // 1. Try "完整資料" sheet first for full round-trip (derived columns ignored — BOM 為唯一真源)
  const fullSheet = wb.SheetNames.find(n => n.includes('完整'));
  if (fullSheet) {
    const ws = wb.Sheets[fullSheet];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
    if (rows.length > 0 && rows[0]['id'] != null) {
      const parsed: PartItem[] = [];
      for (const r of rows) {
        if (!r['customer'] || !r['partNo']) continue;
        const item: PartItem = {
          id: r['id'] || `xls-${Date.now()}-${parsed.length}`,
          customer: String(r['customer']).trim(),
          partNo: String(r['partNo']).trim(),
          name: String(r['name'] || r['partNo']).trim(),
        };
        if (r['notes']) item.notes = r['notes'];
        if (r['alternates']) {
          item.alternates = String(r['alternates']).split(/[,、;；]+/).map(s => s.trim()).filter(Boolean);
        }
        if (r['itemType'] === 'part' || r['itemType'] === 'assembly') item.itemType = r['itemType'];
        if (r['components']) try { item.components = JSON.parse(String(r['components'])); } catch { /* ignore */ }
        if (r['usedInAssemblies']) try { item.usedInAssemblies = JSON.parse(String(r['usedInAssemblies'])); } catch { /* ignore */ }
        if (r['createdAt']) item.createdAt = r['createdAt'];
        parsed.push(item);
      }
      if (parsed.length > 0) return enrichParts(parsed);
    }
  }

  // 2. Fall back to "客戶產品對照表" sheet
  const mainSheet = wb.SheetNames.find(n => n.includes('客戶'));
  if (!mainSheet) return [];

  const ws = wb.Sheets[mainSheet];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: '' });
  const parsed: PartItem[] = [];
  for (const r of rows) {
    const customer = (r['客戶'] || '').toString().trim();
    const partNo = (r['品號'] || '').toString().trim();
    if (!customer || !partNo) continue;
    const name = (r['品名'] || partNo).toString().trim();
    const item: PartItem = {
      id: `xls-${Date.now()}-${parsed.length}`,
      customer,
      partNo,
      name,
    };
    const notes = (r['備註'] || '').toString().trim();
    if (notes) item.notes = notes;
    const alts = (r['替代品號'] || '').toString().trim();
    if (alts) {
      item.alternates = alts.split(/[,、;；]+/).map(s => s.trim()).filter(Boolean);
    }
    parsed.push(item);
  }
  return enrichParts(parsed);
}
