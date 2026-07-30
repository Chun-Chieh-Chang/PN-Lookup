import React, { useRef, useState } from 'react';
import { X, Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import { PartItem } from '../types';

interface FileSelectModalProps {
  onDataLoaded: (items: PartItem[]) => void;
  onClose?: () => void;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseCSV(text: string): PartItem[] {
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
        id: parts[0] || `file-${Date.now()}-${i}`,
        customer: parts[1]?.trim() || '',
        partNo: parts[2]?.trim() || '',
        name: parts[3]?.trim() || parts[2]?.trim() || '',
      };
      if (parts[4]?.trim()) item.notes = parts[4].trim();
      if (parts[5]?.trim() === 'part' || parts[5]?.trim() === 'assembly') item.itemType = parts[5].trim() as 'part' | 'assembly';
      if (parts[6]?.trim()) try { item.components = JSON.parse(parts[6].trim()); } catch { /* ignore */ }
      if (parts[7]?.trim()) try { item.usedInAssemblies = JSON.parse(parts[7].trim()); } catch { /* ignore */ }
      if (parts[8]?.trim()) item.createdAt = parts[8].trim();
      if (item.customer && item.partNo) parsed.push(item);
    } else {
      const cust = parts[0]?.replace(/^"|"$/g, '').trim() || '';
      const pNo = parts[1]?.replace(/^"|"$/g, '').trim() || '';
      const pName = (parts[2] || '').replace(/^"|"$/g, '').trim();
      if (cust && pNo) {
        parsed.push({ id: `file-${Date.now()}-${i}`, customer: cust, partNo: pNo, name: pName || pNo });
      }
    }
  }
  return parsed;
}

function parseJSON(text: string): PartItem[] {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : [data];
  return arr.filter((x: any) => x && x.customer && x.partNo).map((x: any, idx: number) => ({
    id: x.id || `file-${Date.now()}-${idx}`,
    customer: String(x.customer),
    partNo: String(x.partNo),
    name: String(x.name || x.partNo || ''),
    notes: x.notes,
    itemType: x.itemType,
    components: x.components,
    usedInAssemblies: x.usedInAssemblies,
    createdAt: x.createdAt,
  }));
}

export const FileSelectModal: React.FC<FileSelectModalProps> = ({ onDataLoaded, onClose }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFile = (file: File) => {
    setError('');
    setLoading(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const trimmed = text.trim();
        let items: PartItem[] = [];
        if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
          try { items = parseJSON(trimmed); } catch { items = parseCSV(trimmed); }
        } else {
          items = parseCSV(trimmed);
        }
        if (items.length === 0) {
          setError('無法解析檔案内容，請確認檔案格式正確。');
          setLoading(false);
          return;
        }
        onDataLoaded(items);
      } catch {
        setError('讀取檔案失敗，請確認檔案格式正確。');
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError('無法讀取檔案，請確認檔案可存取。');
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full shadow-xl text-gray-900">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 border border-blue-200">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">載入品號資料</h2>
              <p className="text-sm text-gray-500">請選擇 CSV 或 JSON 檔案以載入資料庫</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <Upload className="w-10 h-10 mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">點擊或拖曳檔案到此區域</p>
            <p className="text-sm text-gray-400 mt-1">支援 CSV / JSON / TXT 格式（第一行為標題行）</p>
            {fileName && (
              <p className="text-sm text-blue-600 mt-2">{fileName}</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
              className="hidden"
            />
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>正在解析檔案...</span>
            </div>
          )}

          <div className="mt-5 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">
              支援格式：<br />
              <code className="text-blue-700">CSV: id,customer,partNo,name,notes,itemType,components,usedInAssemblies,createdAt</code><br />
              <code className="text-blue-700">JSON: PartItem[] 陣列</code><br />
              <code className="text-gray-400">舊版 CSV（客戶,品號,品名）亦相容</code>
            </p>
            <p className="text-sm text-gray-400 mt-2">
              資料載入後會自動儲存在瀏覽器，下次開啟不需重新選擇。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
