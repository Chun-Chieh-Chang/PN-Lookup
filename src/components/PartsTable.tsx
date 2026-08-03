import React, { useState, useRef, useCallback } from 'react';
import {
  Copy,
  Check,
  Eye,
  Edit2,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Layers,
  ClipboardCheck,
  Boxes,
  Component,
  Image as ImageIcon,
  ExternalLink,
  ChevronDown,
} from 'lucide-react';
import { PartItem } from '../types';
import { getItemType } from '../utils/bomEngine';
import { ImageLibrary } from '../utils/imageLibrary';
import { resolveAllImages, ImageResolution } from '../utils/imageResolver';

interface PartsTableProps {
  items: PartItem[];
  onViewDetail: (item: PartItem) => void;
  onEdit: (item: PartItem) => void;
  searchKeyword: string;
  imageLib?: ImageLibrary | null;
  bindings?: Record<string, string>;
  ocrIndex?: Map<string, string>;
  ocrProgress?: { done: number; total: number } | null;
  onBindClick?: (item: PartItem) => void;
  onCustomerClick: (customerName: string) => void;
  isAdmin?: boolean;
}

type SortField = 'customer' | 'partNo' | 'category' | 'name';
type SortOrder = 'asc' | 'desc';

export const PartsTable: React.FC<PartsTableProps> = ({
  items,
  onViewDetail,
  onEdit,
  searchKeyword,
  imageLib,
  bindings = {},
  ocrIndex = new Map(),
  ocrProgress,
  onBindClick,
  onCustomerClick,
  isAdmin = false,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedFullId, setCopiedFullId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('partNo');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [openMultiId, setOpenMultiId] = useState<string | null>(null);

  // ── 懸停縮圖 popup ──────────────────────────────────────────────────────────
  interface HoverThumb { url: string; name: string; x: number; y: number }
  const [hoverThumb, setHoverThumb] = useState<HoverThumb | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleImageMouseEnter = useCallback((url: string, name: string, e: React.MouseEvent) => {
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setHoverThumb({ url, name, x: e.clientX, y: e.clientY });
    }, 120);
  }, []);

  const handleImageMouseMove = useCallback((e: React.MouseEvent) => {
    setHoverThumb((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
  }, []);

  const handleImageMouseLeave = useCallback(() => {
    hoverTimerRef.current && clearTimeout(hoverTimerRef.current);
    setHoverThumb(null);
  }, []);

  // 每列圖檔解析快取（imageLib/bindings/ocrIndex 變動時清除）
  const resolveCache = useRef(new Map<string, ImageResolution[]>());
  const resolveCacheKey = useRef('');
  const currentCacheKey = `${imageLib?.folderName ?? ''}|${JSON.stringify(bindings)}|${ocrIndex?.size ?? 0}`;
  if (resolveCacheKey.current !== currentCacheKey) {
    resolveCache.current.clear();
    resolveCacheKey.current = currentCacheKey;
  }

  const resolveRowAll = (item: PartItem): ImageResolution[] => {
    const key = `${item.partNo}\u0000${(item.alternates ?? []).join('\u0000')}`;
    if (resolveCache.current.has(key)) return resolveCache.current.get(key) ?? [];
    const res = resolveAllImages(item.partNo, item.alternates, imageLib ?? null, bindings, ocrIndex || new Map());
    resolveCache.current.set(key, res);
    return res;
  };

  // Sorting — 一律採用「正序 (A➔Z / 數字正序)」
  const handleSort = (field: SortField) => {
    setSortField(field);
  };

  const sortedItems = [...items].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortField === 'category') {
      const typeA = getItemType(a);
      const typeB = getItemType(b);
      valA = a.category || (typeA === 'assembly' ? '組件 Assembly' : '零件 Part');
      valB = b.category || (typeB === 'assembly' ? '組件 Assembly' : '零件 Part');
    } else {
      valA = a[sortField] || '';
      valB = b[sortField] || '';
    }

    return valA.localeCompare(valB, 'zh-Hant', { numeric: true, sensitivity: 'base' });
  });

  // Pagination
  const totalPages = Math.ceil(sortedItems.length / pageSize) || 1;
  const validPage = Math.min(currentPage, totalPages);
  const startIndex = (validPage - 1) * pageSize;
  const paginatedItems = sortedItems.slice(startIndex, startIndex + pageSize);
  const resolvedCount = paginatedItems.filter((i) => resolveRowAll(i).length > 0).length;

  // Copy helpers
  const openImage = (url: string) => {
    window.open(url, '_blank', 'noopener');
  };

  const handleCopyPartNo = (id: string, partNo: string) => {
    navigator.clipboard.writeText(partNo);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleCopyFullRow = (item: PartItem) => {
    const alts = item.alternates && item.alternates.length > 0 ? ` (${item.alternates.join(' / ')})` : '';
    const text = `客戶: ${item.customer} | 品號: ${item.partNo}${alts} | 品名: ${item.name}`;
    navigator.clipboard.writeText(text);
    setCopiedFullId(item.id);
    setTimeout(() => setCopiedFullId(null), 1800);
  };

  // Multi Select Helpers
  const handleSelectAll = () => {
    if (selectedIds.length === paginatedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(paginatedItems.map((i) => i.id));
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleCopySelected = () => {
    const selectedItems = items.filter((item) => selectedIds.includes(item.id));
    const lines = selectedItems.map(
      (item) => `${item.customer}\t${item.partNo}\t${item.name}`
    );
    navigator.clipboard.writeText(lines.join('\n'));
    alert(`已複製 ${selectedItems.length} 筆資料至剪貼簿！`);
  };

  // Highlight matched text
  const highlightText = (text: string, keyword: string) => {
    if (!keyword.trim()) return text;
    const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === keyword.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 text-amber-900 px-0.5 rounded font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-3 w-full flex-1 flex flex-col">

      {/* ── 懸停縮圖 popup ── */}
      {hoverThumb && (() => {
        const isPdf = hoverThumb.name.toLowerCase().endsWith('.pdf');
        const POPUP_W = 260;
        const POPUP_H = 210;
        const GAP = 14;
        // 避免超出視窗右側與下方
        const left = hoverThumb.x + GAP + POPUP_W > window.innerWidth
          ? hoverThumb.x - POPUP_W - GAP
          : hoverThumb.x + GAP;
        const top  = Math.min(hoverThumb.y - 20, window.innerHeight - POPUP_H - 8);
        return (
          <div
            style={{ position: 'fixed', left, top, width: POPUP_W, zIndex: 9999, pointerEvents: 'none' }}
            className="rounded-xl border border-slate-300 bg-white shadow-2xl overflow-hidden"
          >
            <div className="bg-slate-100 px-3 py-1.5 flex items-center justify-between gap-2 border-b border-slate-200">
              <span className="text-[13px] font-mono font-bold text-slate-800 truncate">{hoverThumb.name}</span>
            </div>
            <div className="w-full bg-slate-100 flex items-center justify-center" style={{ height: POPUP_H - 32 }}>
              {isPdf ? (
                <iframe
                  src={hoverThumb.url + '#toolbar=0&navpanes=0&scrollbar=0&view=FitH'}
                  title={hoverThumb.name}
                  className="w-full h-full border-0"
                  style={{ pointerEvents: 'none' }}
                />
              ) : (
                <img
                  src={hoverThumb.url}
                  alt={hoverThumb.name}
                  className="max-w-full max-h-full object-contain p-2"
                />
              )}
            </div>
          </div>
        );
      })()}
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col flex-1">
        
        {/* Table Toolbar / Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-slate-50/70 border-b border-slate-200/80 text-[13px] sm:text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-slate-600 font-medium">
              顯示 <strong className="text-slate-900 font-bold font-mono">{sortedItems.length}</strong> 筆結果
              {selectedIds.length > 0 && (
                <span className="ml-2 text-indigo-600 font-bold">
                  (已選取 {selectedIds.length} 筆)
                </span>
              )}
            </span>

            {selectedIds.length > 0 && (
              <button
                onClick={handleCopySelected}
                className="inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[13px] font-semibold transition-all shadow-xs cursor-pointer active:scale-95"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>複製所選品號清單</span>
              </button>
            )}

            {!imageLib && (
              <span className="text-amber-700 bg-amber-50 border border-amber-200/80 rounded-lg px-2.5 py-1 text-[13px] font-medium shadow-2xs">
                未指定圖檔資料夾 — 點右上角「圖檔資料夾」可讓品號直接開啟圖檔
              </span>
            )}

            {imageLib && (
              <span
                className="text-slate-500 text-[13px] cursor-help bg-slate-100/80 border border-slate-200/80 rounded-lg px-2.5 py-1 font-mono"
                title={
                  `圖檔資料夾：${imageLib.folderName}\n` +
                  `掃描檔案：${imageLib.debug.totalFiles} 個（副檔名不支援的會被略過）\n` +
                  `收錄圖檔：${imageLib.count} 個（含 PDF）\n` +
                  `檔名範例：\n${imageLib.debug.sampleNames.map((n) => '  · ' + n).join('\n')}\n` +
                  `本頁品號對應：${resolvedCount} 筆`
                }
              >
                圖檔 <strong className="text-slate-800 font-bold">{imageLib.count}</strong> 檔 · 本頁對應{' '}
                <strong className="text-teal-700 font-bold">{resolvedCount}</strong> 筆
              </span>
            )}

            {ocrProgress && ocrProgress.total > 0 && (
              <span className="text-violet-700 bg-violet-50 border border-violet-200/80 rounded-lg px-2.5 py-1 text-[13px] font-semibold">
                OCR 辨識中 {ocrProgress.done}/{ocrProgress.total}…
              </span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            {/* Page size dropdown */}
            <div className="flex items-center space-x-1.5 text-slate-600 text-[13px]">
              <span className="font-medium hidden sm:inline">每頁:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-slate-800 font-mono font-semibold focus:outline-none focus:border-indigo-500 shadow-2xs"
              >
                <option value={10}>10 筆</option>
                <option value={25}>25 筆</option>
                <option value={50}>50 筆</option>
                <option value={100}>100 筆</option>
                <option value={500}>全部</option>
              </select>
            </div>
          </div>
        </div>

      {/* Main Table Container */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 text-sm font-semibold uppercase tracking-wider sticky top-0 z-10">
              <th className="p-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={
                    paginatedItems.length > 0 &&
                    selectedIds.length === paginatedItems.length
                  }
                  onChange={handleSelectAll}
                  className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>

              <th
                onClick={() => handleSort('customer')}
                className="p-3 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>客戶名稱</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              <th
                onClick={() => handleSort('partNo')}
                className="p-3 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>品號 (Part No)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              <th
                onClick={() => handleSort('category')}
                className="p-3 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>物料類別</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              <th
                onClick={() => handleSort('name')}
                className="p-3 cursor-pointer hover:text-slate-800 transition-colors"
              >
                <div className="flex items-center space-x-1">
                  <span>品名規格 (Part Name)</span>
                  <ArrowUpDown className="w-3.5 h-3.5 opacity-60" />
                </div>
              </th>

              <th className="p-3">圖檔</th>

              <th className="p-3 text-right pr-6">操作</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100 text-sm">
            {paginatedItems.map((item) => {
              const isSelected = selectedIds.includes(item.id);
              const isCopied = copiedId === item.id;
              const isCopiedFull = copiedFullId === item.id;
              const type = getItemType(item);
              const isAssembly = type === 'assembly';
              const allImages = resolveRowAll(item);
              const hasImages = allImages.length > 0;
              const firstImage = hasImages ? allImages[0] : null;

              return (
                <tr
                  key={item.id}
                  className={`group transition-colors ${
                    isSelected
                      ? 'bg-indigo-50 hover:bg-indigo-100'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Checkbox */}
                  <td className="p-3 text-center">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleSelectRow(item.id)}
                      className="rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                    />
                  </td>

                  {/* Customer Badge */}
                  <td className="p-3 font-medium py-3.5">
                    <button
                      onClick={() => onCustomerClick(item.customer)}
                      className="inline-flex items-center px-2.5 py-1 rounded-lg bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 transition-all font-mono text-[13px] font-bold cursor-pointer hover:shadow-xs"
                      title="點擊篩選該客戶"
                    >
                      <span>{highlightText(item.customer, searchKeyword)}</span>
                    </button>
                  </td>

                  {/* Part Number */}
                  <td className="p-3 font-mono font-bold text-slate-900 py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center space-x-2">
                        <span
                          onClick={
                            firstImage
                              ? () => openImage(firstImage.url)
                              : undefined
                          }
                          className={`text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200/80 font-bold ${
                            firstImage ? 'cursor-pointer hover:bg-teal-100 hover:shadow-xs' : ''
                          }`}
                          title={
                            allImages.length > 1
                              ? `此品號包含 ${allImages.length} 張圖檔（點擊開啟首張）`
                              : firstImage
                              ? '點擊開啟圖檔'
                              : undefined
                          }
                        >
                          {highlightText(item.partNo, searchKeyword)}
                        </span>
                        <button
                          onClick={() => handleCopyPartNo(item.id, item.partNo)}
                          className={`p-1 rounded-md transition-colors cursor-pointer ${
                            isCopied
                              ? 'text-emerald-600 bg-emerald-100'
                              : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                          }`}
                          title="複製品號"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        {firstImage && (
                          <button
                            onClick={() => openImage(firstImage.url)}
                            className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            title={allImages.length > 1 ? `對應 ${allImages.length} 張圖檔（點擊開啟首張）` : '開啟圖檔'}
                          >
                            <ImageIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {item.alternates && item.alternates.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[13px] text-slate-400 uppercase tracking-wide font-sans">別名</span>
                          {item.alternates.map((alt) => (
                            <button
                              key={alt}
                              onClick={() => handleCopyPartNo(item.id, alt)}
                              className="text-[13px] font-medium text-slate-600 bg-slate-100 border border-slate-200/80 rounded px-1.5 py-px hover:bg-slate-200 hover:text-slate-800 font-mono cursor-pointer transition-colors"
                              title={`別名：${alt}（點擊複製）`}
                            >
                              {highlightText(alt, searchKeyword)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Item Type Badge */}
                  <td className="p-3 py-3.5">
                    <button
                      onClick={() => onViewDetail(item)}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold border transition-all cursor-pointer shadow-2xs hover:shadow-xs ${
                        (item.category && item.category.includes('組件')) || isAssembly
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200/80 hover:bg-indigo-100'
                          : (item.category && item.category.includes('客戶特規'))
                          ? 'bg-rose-50 text-rose-700 border-rose-200/80 hover:bg-rose-100'
                          : (item.category && (item.category.includes('輔料') || item.category.includes('包材')))
                          ? 'bg-cyan-50 text-cyan-800 border-cyan-200/80 hover:bg-cyan-100'
                          : 'bg-emerald-50 text-emerald-800 border-emerald-200/80 hover:bg-emerald-100'
                      }`}
                      title={isAssembly ? '查看組成此組件的所有零件' : '查看可組成該零件的相應組件'}
                    >
                      {isAssembly ? <Boxes className="w-3.5 h-3.5" /> : <Component className="w-3.5 h-3.5" />}
                      <span>{item.category || (isAssembly ? '組件 Assembly' : '零件 Part')}</span>
                    </button>
                  </td>

                  {/* Part Name */}
                  <td className="p-3 text-slate-600 max-w-md py-3.5">
                    <div className="flex flex-col gap-1">
                      <div className="truncate font-medium text-slate-800" title={item.name}>
                        {highlightText(item.name, searchKeyword)}
                      </div>
                      {(item.color || item.material) && (
                        <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
                          {item.color && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded border border-amber-200 text-[13px]">
                              顏色: {item.color}
                            </span>
                          )}
                          {item.material && (
                            <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 font-mono rounded border border-emerald-200 text-[13px]">
                              原料: {item.material}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* 圖檔連結 */}
                  <td className="p-3 py-3.5">
                    {allImages.length === 1 ? (
                      <button
                        onClick={() => openImage(allImages[0].url)}
                        onMouseEnter={(e) => handleImageMouseEnter(allImages[0].url, allImages[0].name, e)}
                        onMouseMove={handleImageMouseMove}
                        onMouseLeave={handleImageMouseLeave}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 hover:bg-sky-100 transition-colors cursor-pointer shadow-2xs hover:shadow-xs"
                        title={
                          `開啟圖檔：${item.partNo} → ${allImages[0].name}\n` +
                          (allImages[0].via === 'file'
                            ? '（檔名比對命中）'
                            : allImages[0].via === 'binding'
                            ? '（手動綁定）'
                            : '（OCR 內容辨識命中）')
                        }
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>開啟圖檔</span>
                      </button>
                    ) : allImages.length > 1 ? (
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMultiId(openMultiId === item.id ? null : item.id);
                          }}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[13px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
                          title={`此品號對應 ${allImages.length} 張圖檔，點擊展開選擇`}
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-600" />
                          <span>開啟圖檔 ({allImages.length}張)</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${openMultiId === item.id ? 'rotate-180' : ''}`} />
                        </button>

                        {openMultiId === item.id && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 mt-1 w-64 bg-white rounded-xl shadow-2xl border border-slate-200 z-40 py-2 text-[13px]"
                          >
                            <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                              <span className="font-bold text-slate-700">對應圖檔 ({allImages.length} 張)</span>
                              <button
                                onClick={() => {
                                  allImages.forEach((img) => openImage(img.url));
                                  setOpenMultiId(null);
                                }}
                                className="text-indigo-600 hover:text-indigo-800 hover:underline font-bold text-[13px] cursor-pointer"
                                title="在瀏覽器新分頁一次打開所有關聯圖檔"
                              >
                                ⚡ 一鍵開啟全部
                              </button>
                            </div>
                            <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                              {allImages.map((img, idx) => (
                                <button
                                  key={`${img.name}-${idx}`}
                                  onClick={() => {
                                    openImage(img.url);
                                    setOpenMultiId(null);
                                  }}
                                  onMouseEnter={(e) => handleImageMouseEnter(img.url, img.name, e)}
                                  onMouseMove={handleImageMouseMove}
                                  onMouseLeave={handleImageMouseLeave}
                                  className="w-full text-left px-3 py-2 hover:bg-indigo-50/70 flex items-center justify-between group transition-colors cursor-pointer"
                                >
                                  <div className="min-w-0 pr-2">
                                    <p className="font-mono font-bold text-slate-800 group-hover:text-indigo-700 truncate" title={img.name}>
                                      {img.name}
                                    </p>
                                     {/* min-font-size exception: 圖檔匹配方式輔助說明，密集清單場景 */}
                                    <span className="text-[13px] text-slate-400">
                                      {img.via === 'file' ? '檔名比對命中' : img.via === 'binding' ? '手動綁定' : 'OCR 內容辨識'}
                                    </span>
                                  </div>
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1.5">
                        <span
                          className="text-sm text-slate-300"
                          title={imageLib ? `找不到「${item.partNo}」的圖檔，可點「綁定」手動指定` : '未指定圖檔資料夾'}
                        >
                          —
                        </span>
                        {imageLib && onBindClick && (
                          <button
                            onClick={() => onBindClick(item)}
                            className="text-[13px] text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg px-1.5 py-0.5 border border-slate-200 hover:border-indigo-300 transition-colors cursor-pointer"
                            title="手動指定此品號對應的圖檔"
                          >
                            綁定
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="p-3 text-right pr-6 py-3.5">
                    <div className="flex items-center justify-end space-x-1">
                      
                      <button
                        onClick={() => handleCopyFullRow(item)}
                        className={`p-1.5 rounded-lg text-sm transition-colors cursor-pointer ${
                          isCopiedFull
                            ? 'text-emerald-600 bg-emerald-100'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                        }`}
                        title="複製完整列資訊"
                      >
                        {isCopiedFull ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => onViewDetail(item)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer flex items-center space-x-1"
                        title="檢視 BOM 與詳細資料"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {isAdmin && (
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="修訂此料號（既有數據修改）"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}

                    </div>
                  </td>
                </tr>
              );
            })}

            {paginatedItems.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="max-w-xs mx-auto space-y-2">
                    <Layers className="w-10 h-10 mx-auto text-slate-300" />
                    <p className="text-sm font-medium text-slate-500">查無符合條件的品號</p>
                    <p className="text-sm text-slate-400">請嘗試調整搜尋關鍵字、切換搜尋欄位或清除過濾條件。</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-slate-200 text-sm">
          <span className="text-slate-500">
            第 {validPage} / {totalPages} 頁 (共 {sortedItems.length} 筆)
          </span>

          <div className="flex items-center space-x-2">
            <button
              disabled={validPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center space-x-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pNum = i + 1;
                if (totalPages > 5 && validPage > 3) {
                  pNum = validPage - 3 + i;
                  if (pNum > totalPages) pNum = totalPages - (4 - i);
                }
                if (pNum <= 0) return null;
                return (
                  <button
                    key={pNum}
                    onClick={() => setCurrentPage(pNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-mono font-medium transition-colors cursor-pointer ${
                      validPage === pNum
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white text-slate-600 hover:text-slate-800 border border-slate-200'
                    }`}
                  >
                    {pNum}
                  </button>
                );
              })}
            </div>

            <button
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
