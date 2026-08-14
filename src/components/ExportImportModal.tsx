import React, { useState } from 'react';
import { X, Download, Upload, FileSpreadsheet, Check, RefreshCw, FileJson, Table2, Tags } from 'lucide-react';
import * as XLSX from 'xlsx';
import { PartItem } from '../types';
import { generateExcelWorkbook, parseExcelToParts, FULL_DATA_HEADERS } from '../utils/excelExport';
import { generateJsonLdOntology } from '../utils/jsonLdExport';
import { ALTERNATE_SPLIT_RE } from '../utils/alternates';
import { parseCustomerSheet, applyCustomerRows, CustomerImportReport } from '../utils/customerPartImport';
import { updateBOMData } from '../utils/bomEngine';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  parts: PartItem[];
  onImportData: (newParts: PartItem[], replace: boolean) => void;
  onApplyParts: (parts: PartItem[]) => void;
  onResetData: () => void;
}

const CSV_HEADERS = FULL_DATA_HEADERS.join(',');

function csvEscape(val: unknown): string {
  const s = val == null ? '' : String(val);
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function generateCSVString(parts: PartItem[]): string {
  let csv = CSV_HEADERS + '\n';
  for (const p of parts) {
    const row = [
      csvEscape(p.id),
      csvEscape(p.customer),
      csvEscape(p.partNo),
      csvEscape(p.name),
      csvEscape(p.category ?? ''),
      csvEscape(p.color ?? ''),
      csvEscape(p.material ?? ''),
      csvEscape(p.notes ?? ''),
      csvEscape(p.alternates ? p.alternates.join('、') : ''),
      csvEscape(p.itemType ?? ''),
      csvEscape(p.components ? JSON.stringify(p.components) : ''),
      csvEscape(p.usedInAssemblies ? JSON.stringify(p.usedInAssemblies) : ''),
      csvEscape(p.createdAt ?? ''),
    ];
    csv += row.join(',') + '\n';
  }
  return csv;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseImportedCSV(text: string): PartItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headerLine = lines[0].toLowerCase().replace(/^\uFEFF/, '');
  const isNewFormat = headerLine.includes('partno') || headerLine.includes('id,customer');
  const isChineseFormat = headerLine.includes('客戶') || headerLine.includes('品號');
  const startIdx = (isNewFormat || isChineseFormat) ? 1 : 0;
  const parsed: PartItem[] = [];
  for (let i = startIdx; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    if (parts.length < 2) continue;
    if (isNewFormat) {
      const item: PartItem = {
        id: parts[0] || `imp-${Date.now()}-${i}`,
        customer: parts[1]?.trim() || '',
        partNo: parts[2]?.trim() || '',
        name: parts[3]?.trim() || parts[2]?.trim() || '',
      };
      if (parts[4]?.trim()) item.category = parts[4].trim();
      if (parts[5]?.trim()) item.color = parts[5].trim();
      if (parts[6]?.trim()) item.material = parts[6].trim();
      if (parts[7]?.trim()) item.notes = parts[7].trim();
      if (parts[8]?.trim()) {
        item.alternates = parts[8].trim().split(ALTERNATE_SPLIT_RE).map(s => s.trim()).filter(Boolean);
      }
      if (parts[9]?.trim() === 'part' || parts[9]?.trim() === 'assembly') item.itemType = parts[9].trim() as 'part' | 'assembly';
      if (parts[10]?.trim()) try { item.components = JSON.parse(parts[10].trim()); } catch { /* ignore */ }
      if (parts[11]?.trim()) try { item.usedInAssemblies = JSON.parse(parts[11].trim()); } catch { /* ignore */ }
      if (parts[12]?.trim()) item.createdAt = parts[12].trim();
      if (item.customer && item.partNo) parsed.push(item);
    } else {
      const cust = parts[0]?.replace(/^"|"$/g, '').trim() || '';
      const pNo = parts[1]?.replace(/^"|"$/g, '').trim() || '';
      const pName = (parts[2] || '').replace(/^"|"$/g, '').trim();
      if (cust && pNo) {
        parsed.push({ id: `imp-${Date.now()}-${i}`, customer: cust, partNo: pNo, name: pName || pNo });
      }
    }
  }
  return parsed;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  parts,
  onImportData,
  onApplyParts,
  onResetData,
}) => {
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [copiedData, setCopiedData] = useState(false);
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xlsx' | 'jsonld'>('csv');

  if (!isOpen) return null;

  const generateExportData = (): string => {
    if (exportFormat === 'csv') return generateCSVString(parts);
    if (exportFormat === 'jsonld') return generateJsonLdOntology(parts);
    return JSON.stringify(parts, null, 2);
  };

  const getMimeType = () => {
    if (exportFormat === 'csv') return 'text/csv;charset=utf-8;';
    if (exportFormat === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (exportFormat === 'jsonld') return 'application/ld+json;charset=utf-8;';
    return 'application/json;charset=utf-8;';
  };
  const getExtension = () => {
    if (exportFormat === 'csv') return '.csv';
    if (exportFormat === 'xlsx') return '.xlsx';
    if (exportFormat === 'jsonld') return '.jsonld';
    return '.json';
  };
  const getFileName = () => `品號知識本體_${new Date().toISOString().slice(0, 10)}${getExtension()}`;
  const getIcon = () => {
    if (exportFormat === 'csv') return <FileSpreadsheet className="w-5 h-5" />;
    if (exportFormat === 'xlsx') return <Table2 className="w-5 h-5" />;
    return <FileJson className="w-5 h-5" />;
  };

  const handleDownload = async () => {
    const fileName = getFileName();

    // 優先使用 File System Access API 彈出 OS 原生「另存新檔 (Ask Save Path)」路徑選擇視窗
    const win = window as unknown as {
      showSaveFilePicker?: (options?: {
        suggestedName?: string;
        types?: Array<{ description?: string; accept: Record<string, string[]> }>;
      }) => Promise<{ createWritable: () => Promise<{ write: (data: unknown) => Promise<void>; close: () => Promise<void> }> }>;
    };

    if (typeof win.showSaveFilePicker === 'function') {
      try {
        const acceptTypes = exportFormat === 'xlsx'
          ? [{ description: 'Excel Workbook', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }]
          : exportFormat === 'csv'
          ? [{ description: 'CSV Document', accept: { 'text/csv': ['.csv'] } }]
          : exportFormat === 'jsonld'
          ? [{ description: 'JSON-LD Knowledge Ontology', accept: { 'application/ld+json': ['.jsonld', '.json'] } }]
          : [{ description: 'JSON Document', accept: { 'application/json': ['.json'] } }];

        const handle = await win.showSaveFilePicker({
          suggestedName: fileName,
          types: acceptTypes,
        });
        const writable = await handle.createWritable();

        if (exportFormat === 'xlsx') {
          const wb = generateExcelWorkbook(parts);
          const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
          await writable.write(buf);
        } else {
          const content = generateExportData();
          const data = exportFormat === 'csv' ? '\uFEFF' + content : content;
          await writable.write(data);
        }
        await writable.close();
        return;
      } catch (err: unknown) {
        if ((err as Error)?.name === 'AbortError') return;
        /* fallback to standard download */
      }
    }

    // 瀏覽器降級下載處理
    if (exportFormat === 'xlsx') {
      const wb = generateExcelWorkbook(parts);
      XLSX.writeFile(wb, fileName);
      return;
    }
    const content = generateExportData();
    const blob = new Blob([exportFormat === 'csv' ? '\uFEFF' + content : content], { type: getMimeType() });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyData = () => {
    if (exportFormat === 'xlsx') return;
    navigator.clipboard.writeText(generateExportData());
    setCopiedData(true);
    setTimeout(() => setCopiedData(false), 1800);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isXlsx = file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm');
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (isXlsx) {
        const buf = evt.target?.result as ArrayBuffer;
        if (buf) parseAndImportExcel(buf);
      } else {
        const text = evt.target?.result as string;
        if (text) parseAndImport(text);
      }
    };
    if (isXlsx) reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
    e.target.value = '';
  };

  const parseAndImportExcel = (buf: ArrayBuffer) => {
    const parsed = parseExcelToParts(buf);
    if (parsed.length > 0) {
      onImportData(parsed, importMode === 'replace');
      alert(`已成功從 Excel 匯入 ${parsed.length} 筆資料！`);
      onClose();
    } else {
      alert('Excel 匯入失敗：找不到有效的品號資料。請確認工作表包含「客戶產品對照表」或「完整資料」。');
    }
  };

  const parseAndImport = (text: string) => {
    const trimmed = text.trim();
    let parsed: PartItem[] = [];

    // Try JSON first (starts with [ or {)
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        const json = JSON.parse(trimmed);
        if (json && json.bom && json.bom.children && json.bom.parents) {
          updateBOMData(json.bom.children, json.bom.parents);
        }
        const rawParts = Array.isArray(json)
          ? json
          : (json && Array.isArray(json.parts))
          ? json.parts
          : [json];

        parsed = rawParts.filter((x: any) => x && (x.partNo || x.customer)).map((x: any, idx: number) => ({
          id: x.id || x.partNo || `imp-${Date.now()}-${idx}`,
          customer: String(x.customer || ''),
          partNo: String(x.partNo || ''),
          name: String(x.name || x.partNo || ''),
          category: x.category ? String(x.category) : undefined,
          color: x.color ? String(x.color) : undefined,
          material: x.material ? String(x.material) : undefined,
          notes: x.notes ? String(x.notes) : undefined,
          alternates: Array.isArray(x.alternates) ? x.alternates.map(String) : undefined,
          itemType: x.itemType,
          components: x.components,
          usedInAssemblies: x.usedInAssemblies,
          createdAt: x.createdAt,
        }));
      } catch { /* not JSON, fall through to CSV */ }
    }

    if (parsed.length === 0) {
      parsed = parseImportedCSV(trimmed);
    }

    if (parsed.length > 0) {
      onImportData(parsed, importMode === 'replace');
      alert(`已成功匯入 ${parsed.length} 筆資料！`);
      onClose();
    } else {
      alert('匯入失敗：請確認檔案格式正確。支援 CSV (id,customer,partNo,name,...) 或 JSON 格式。');
    }
  };

  const formatReport = (rep: CustomerImportReport): string => {
    let msg = `客戶料號工作表匯入完成：\n\n新增 ${rep.created} 筆、合併 ${rep.merged} 筆`;
    if (rep.renamed.length > 0) {
      msg += `\n主品號調整為圖面編號（${rep.renamed.length} 筆）：\n  ` + rep.renamed.join('\n  ');
    }
    if (rep.skipped.length > 0) {
      msg += `\n\n略過 ${rep.skipped.length} 列：\n  ` + rep.skipped.map((s) => `第 ${s.row} 列：${s.reason}`).join('\n  ');
    }
    return msg;
  };

  const handleCustomerSheetUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const buf = evt.target?.result as ArrayBuffer;
      if (!buf) return;
      const rows = parseCustomerSheet(buf);
      if (rows.length === 0) {
        alert('匯入失敗：找不到「客戶料號」工作表（需含 圖面編號 / 產品編號 / 零件編號 欄位）。');
        return;
      }
      const { parts: nextParts, report } = applyCustomerRows(parts, rows);
      onApplyParts(nextParts);
      alert(formatReport(report));
      onClose();
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full flex flex-col shadow-2xl text-slate-900 my-8">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-slate-100 text-sky-700 border border-slate-300 flex items-center justify-center">
              <FileSpreadsheet className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">資料匯出與匯入</h2>
              <p className="text-[13px] text-slate-500">管理品號資料庫的備份、匯出與批量上傳</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-tactile p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 text-sm">

          {/* Import Section — 清淡柔和天藍色 */}
          <div className="p-3.5 sm:p-4 bg-sky-50/40 rounded-xl border border-sky-200/80 shadow-2xs space-y-2.5">
            <h3 className="font-bold text-sky-900 flex items-center space-x-2 text-[13px]">
              <Download className="w-4 h-4 text-sky-700" />
              <span>匯入自訂資料</span>
            </h3>

            <div className="flex items-center space-x-4 text-[13px]">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-sky-700 focus:ring-sky-500"
                />
                <span className="text-slate-700 font-medium">累加附加至現有資料庫</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-sky-700 focus:ring-sky-500"
                />
                <span className="text-slate-700 font-medium">完全覆蓋現有資料庫</span>
              </label>
            </div>

            <p className="text-slate-500 text-[13px] leading-relaxed">
              支援 CSV、JSON 或 Excel (.xlsx) 格式。Excel 匯入會優先讀取「完整資料」工作表以保留所有欄位，否則從「客戶產品對照表」讀取後自動補齊 BOM 關係。
            </p>

            <div className="pt-1">
              <input
                type="file"
                accept=".csv,.txt,.json,.xlsx,.xlsm"
                onChange={handleFileUpload}
                className="block w-full text-[13px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-sky-300 file:text-[13px] file:font-semibold file:bg-white file:text-sky-900 hover:file:bg-sky-100 cursor-pointer"
              />
            </div>
          </div>

          {/* 客戶料號工作表匯入 — 清淡柔和靛藍色 */}
          <div className="p-3.5 sm:p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/80 shadow-2xs space-y-2.5">
            <h3 className="font-bold text-indigo-900 flex items-center space-x-2 text-[13px]">
              <Tags className="w-4 h-4 text-indigo-700" />
              <span>客戶料號工作表匯入（三碼互換）</span>
            </h3>
            <p className="text-slate-500 text-[13px] leading-relaxed">
              從「產品一覽表.xlsm」的「客戶料號」工作表匯入：圖面編號、產品編號、零件編號(客) 三欄互為可替代品號。
              主品號以 <strong className="text-indigo-950">圖面編號</strong> 為優先，其餘兩碼自動歸入替代品號；
              既有資料任一碼命中即自動合併（不重複建檔），全資料庫代碼唯一性檢查。
            </p>
            <div className="pt-1">
              <input
                type="file"
                accept=".xlsx,.xlsm"
                onChange={handleCustomerSheetUpload}
                className="block w-full text-[13px] text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border file:border-indigo-300 file:text-[13px] file:font-semibold file:bg-white file:text-indigo-900 hover:file:bg-indigo-100 cursor-pointer"
              />
            </div>
          </div>

          {/* Export Section — 清淡柔和薄荷/翠綠色 */}
          <div className="p-3.5 sm:p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2.5">
            <h3 className="font-bold text-emerald-900 flex items-center space-x-2 text-[13px]">
              <Upload className="w-4 h-4 text-emerald-700" />
              <span>匯出目前資料庫 ({parts.length} 筆)</span>
            </h3>
            <div className="flex flex-wrap items-center gap-3 text-[13px]">
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportFormat"
                  checked={exportFormat === 'xlsx'}
                  onChange={() => setExportFormat('xlsx')}
                  className="text-emerald-700 focus:ring-emerald-500"
                />
                <Table2 className="w-3.5 h-3.5 text-emerald-700" />
                <span className="text-slate-700 font-medium">Excel (.xlsx)</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportFormat"
                  checked={exportFormat === 'csv'}
                  onChange={() => setExportFormat('csv')}
                  className="text-emerald-700 focus:ring-emerald-500"
                />
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-slate-700 font-medium">CSV</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportFormat"
                  checked={exportFormat === 'json'}
                  onChange={() => setExportFormat('json')}
                  className="text-emerald-700 focus:ring-emerald-500"
                />
                <FileJson className="w-3.5 h-3.5 text-slate-600" />
                <span className="text-slate-700 font-medium">JSON</span>
              </label>
              <label className="flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="exportFormat"
                  checked={exportFormat === 'jsonld'}
                  onChange={() => setExportFormat('jsonld')}
                  className="text-emerald-700 focus:ring-emerald-500"
                />
                <FileJson className="w-3.5 h-3.5 text-sky-700" />
                <span className="text-slate-800 font-semibold">JSON-LD 知識本體 (@Schema.org)</span>
              </label>
            </div>
            <p className="text-slate-500 text-[13px] leading-relaxed">
              {exportFormat === 'xlsx'
                ? '匯出為 Excel (.xlsx) 格式，包含 6 個工作表：客戶產品對照表（客戶/品號/品名/物料類別/備註）、SA/SB/SC/SD 組立、完整資料（匯入回寫用）。'
                : exportFormat === 'csv'
                ? '匯出包含所有欄位（id, customer, partNo, name, category, color, material, notes, alternates, itemType 等）。'
                : exportFormat === 'jsonld'
                ? '匯出為 Schema.org JSON-LD 語義化格式，適合搜尋引擎與知識圖譜整合。'
                : '匯出完整 JSON 陣列，保留所有 PartItem 欄位與資料型別（陣列、選填欄位等）。'}
            </p>
            <div className="flex items-center space-x-2.5 pt-1">
              <button
                onClick={handleDownload}
                className="btn-tactile px-3.5 py-1.5 bg-emerald-800 hover:bg-emerald-900 text-white text-[13px] font-semibold rounded-lg flex items-center space-x-1.5 border border-emerald-700 cursor-pointer shadow-2xs"
              >
                <Upload className="w-3.5 h-3.5 text-emerald-200" />
                <span>下載 {exportFormat.toUpperCase()} 檔</span>
              </button>
              <button
                onClick={handleCopyData}
                className="btn-tactile px-3 py-1.5 bg-white hover:bg-emerald-50 text-slate-700 text-[13px] font-medium rounded-lg flex items-center space-x-1.5 border border-emerald-300 cursor-pointer shadow-2xs"
              >
                {copiedData ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : getIcon()}
                <span>{copiedData ? '已複製內容！' : `複製 ${exportFormat.toUpperCase()} 內文`}</span>
              </button>
            </div>
          </div>

          {/* Reset section — 清淡柔和暖紅/玫瑰色 */}
          <div className="p-3.5 sm:p-4 bg-rose-50/40 rounded-xl border border-rose-200/80 flex items-center justify-between shadow-2xs">
            <div>
              <h4 className="font-semibold text-rose-900 text-[13px]">恢復系統初始資料</h4>
              <p className="text-[13px] text-slate-500">重置為種子資料庫設定</p>
            </div>
            <button
              onClick={() => {
                if (confirm('確定要恢復為預設資料庫嗎？所有自訂修改將被還原。')) {
                  onResetData();
                  onClose();
                }
              }}
              className="btn-tactile px-3 py-1.5 bg-white text-rose-700 hover:text-rose-800 hover:bg-rose-50 border border-rose-300 rounded-lg text-[13px] font-semibold transition-colors cursor-pointer flex items-center space-x-1 shadow-2xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>重置為預設值</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="btn-tactile px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[13px] font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
