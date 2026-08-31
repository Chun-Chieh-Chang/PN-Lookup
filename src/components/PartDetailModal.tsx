import React, { useState, useMemo, useCallback } from 'react';
import { X, Copy, Check, Tag, Layers, FileText, User, Boxes, Component, ArrowRight, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { PartItem } from '../types';
import { getItemType, getComponentsForAssembly, getAssembliesForPart, getBOMChildren, getBOMParents, updateBOMData } from '../utils/bomEngine';
import { saveBOM } from '../utils/bomService';
import { getPartPrefix } from '../utils/partNo';
import { ImageLibrary } from '../utils/imageLibrary';
import { findParentProducts } from '../utils/imageResolver';

interface PartDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PartItem | null;
  allParts: PartItem[];
  onSelectRelated: (item: PartItem) => void;
  imageLib?: ImageLibrary | null;
  bindings?: Record<string, string>;
  ocrIndex?: Map<string, string>;
  onBOMUpdated?: () => void;
}

export const PartDetailModal: React.FC<PartDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  allParts,
  onSelectRelated,
  imageLib = null,
  bindings = {},
  ocrIndex = new Map(),
  onBOMUpdated,
}) => {
  const [copiedPart, setCopiedPart] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);
  const [addingBom, setAddingBom] = useState<Set<string>>(new Set());

  // 由圖檔內容反向識別：此品號出現在哪些產品的圖面中
  const reverseCandidates = useMemo(() => {
    if (!item || !imageLib || ocrIndex.size === 0) return [];
    return findParentProducts(item.partNo, item.alternates, imageLib, allParts, bindings, ocrIndex);
  }, [item, imageLib, allParts, bindings, ocrIndex]);

  // 已存在於 BOM 上層關係的品號
  const existingParents = useMemo(() => {
    if (!item) return new Set<string>();
    const parents = getBOMParents();
    return new Set([
      ...(parents[item.partNo] ?? []),
      ...(parents[item.partNo.toUpperCase()] ?? []),
    ]);
  }, [item, addingBom]);

  const handleAddBomLink = useCallback(async (parentNo: string) => {
    if (!item) return;
    const children = getBOMChildren();
    const parents = getBOMParents();
    const nextChildren = {
      ...children,
      [parentNo]: Array.from(new Set([...(children[parentNo] ?? []), item.partNo])),
    };
    const nextParents = {
      ...parents,
      [item.partNo]: Array.from(new Set([...(parents[item.partNo] ?? []), parentNo])),
    };
    updateBOMData(nextChildren, nextParents);
    setAddingBom((prev) => new Set(prev).add(parentNo));
    try {
      await saveBOM(nextChildren, nextParents);
    } catch {
      // 伺服器未連線（靜態/純前端模式）時，僅本機生效
    }
    onBOMUpdated?.();
  }, [item, onBOMUpdated]);

  if (!isOpen || !item) return null;

  const itemType = getItemType(item);
  const isAssembly = itemType === 'assembly';

  // Calculate BOM Relations
  const componentsList = isAssembly ? getComponentsForAssembly(item, allParts) : [];
  const assembliesList = !isAssembly ? getAssembliesForPart(item, allParts) : [];

  // Find related items by same customer or same prefix
  const prefix = getPartPrefix(item.partNo);
  const relatedSameCustomer = allParts
    .filter((p) => p.customer === item.customer && p.id !== item.id)
    .slice(0, 5);

  const relatedSamePrefix = allParts
    .filter((p) => p.partNo.startsWith(prefix) && p.id !== item.id)
    .slice(0, 5);

  const handleCopyFullInfo = () => {
    if (!item) return;
    const alts = item.alternates && item.alternates.length > 0 ? ` (${item.alternates.join(' / ')})` : '';
    const text = `客戶: ${item.customer} | 品號: ${item.partNo}${alts} | 品名: ${item.name}`;
    navigator.clipboard.writeText(text);
    setCopiedFull(true);
    setTimeout(() => setCopiedFull(false), 1800);
  };

  const handleCopyPartNo = () => {
    navigator.clipboard.writeText(item.partNo);
    setCopiedPart(true);
    setTimeout(() => setCopiedPart(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full flex flex-col shadow-2xl text-slate-900 my-8 overflow-hidden transition-all">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-sky-50 text-sky-900 font-mono font-bold rounded-lg border border-sky-300 text-sm shadow-2xs">
              {item.partNo}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[0.8125rem] font-semibold flex items-center space-x-1.5 border shadow-2xs ${
              isAssembly
                ? 'bg-slate-900 text-sky-400 border-slate-700'
                : 'bg-slate-100 text-slate-800 border-slate-300'
            }`}>
              {isAssembly ? <Boxes className="w-3.5 h-3.5" /> : <Component className="w-3.5 h-3.5" />}
              <span>{isAssembly ? '組合配件 / 組立 (Assembly)' : '單一零件 (Single Part)'}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyFullInfo}
              className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1 text-[0.8125rem] font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 shadow-2xs transition-colors cursor-pointer"
              title="複製完整品項資訊 (客戶 | 品號 | 品名)"
            >
              {copiedFull ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedFull ? '已複製' : '複製完整資訊'}</span>
            </button>
            <button
              onClick={onClose}
              className="btn-tactile p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 text-sm overflow-y-auto max-h-[75vh]">
          
          {/* Main Info Card — 清淡柔和冷灰/基本規格 */}
          <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200 shadow-2xs space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              
              <div>
                <span className="text-[0.8125rem] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>客戶名稱</span>
                </span>
                <p className="text-base font-bold text-slate-900">{item.customer}</p>
              </div>

              <div>
                <span className="text-[0.8125rem] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                  <Tag className="w-3.5 h-3.5 text-slate-400" />
                  <span>品號 (Part Number)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-mono font-bold text-slate-900">{item.partNo}</span>
                  <button
                    onClick={handleCopyPartNo}
                    className="btn-tactile p-1 text-slate-400 hover:text-slate-700 rounded bg-white border border-slate-200 transition-colors cursor-pointer"
                    title="複製品號"
                  >
                    {copiedPart ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

            </div>

            <div className="pt-2.5 border-t border-slate-200/80">
              <span className="text-[0.8125rem] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>品名規格 (Part Name)</span>
              </span>
              <p className="text-base font-medium text-slate-900">{item.name}</p>
              {item.description && item.description !== item.name && (
                <p className="text-[0.8125rem] text-slate-600 bg-white p-2 mt-1.5 rounded-lg border border-slate-200 leading-relaxed font-sans">
                  <span className="text-slate-400 font-medium mr-1">原文描述:</span>
                  {item.description}
                </p>
              )}
            </div>

            {/* 9 大工程規格網格 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2.5 border-t border-slate-200/80">
              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">圖號 (DWG No.)</span>
                <span className="inline-block px-2 py-0.5 bg-sky-50 text-sky-900 font-mono font-semibold text-[0.8125rem] rounded border border-sky-300">
                  {item.dwgNo || '-'}
                </span>
              </div>

              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">版本 (REV.)</span>
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 font-mono font-bold text-[0.8125rem] rounded border border-slate-300">
                  {item.revision || '-'}
                </span>
              </div>

              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">物料類別</span>
                <span className="inline-block px-2 py-0.5 bg-white text-slate-800 font-semibold rounded text-[0.8125rem] border border-slate-300">
                  {item.category || (isAssembly ? '組件' : '零件')}
                </span>
              </div>

              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">顏色 (Color)</span>
                <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-900 font-semibold rounded text-[0.8125rem] border border-amber-300">
                  {item.color || '-'}
                </span>
              </div>
            </div>

            {/* 原料規格與編碼 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2.5 border-t border-slate-200/80">
              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">原料名稱 (Material)</span>
                <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-900 font-mono font-semibold text-[0.8125rem] rounded border border-emerald-300">
                  {item.material || '-'}
                </span>
              </div>

              <div>
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">原料編碼 (Material Code)</span>
                <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-800 font-mono font-semibold text-[0.8125rem] rounded border border-slate-300">
                  {item.materialCode || '-'}
                </span>
              </div>
            </div>

            {/* 圖檔檔名 */}
            {item.drawingFileName && (
              <div className="pt-2.5 border-t border-slate-200/80">
                <span className="text-[0.8125rem] text-slate-500 block mb-0.5 font-medium">圖檔檔名 (Drawing File)</span>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="inline-block px-2.5 py-1 bg-slate-50 text-slate-800 font-mono text-[0.8125rem] font-medium rounded border border-slate-200 break-all">
                    {item.drawingFileName}
                  </span>
                  <button
                    onClick={() => {
                      const url = (imageLib && imageLib.urlForFile(item.drawingFileName!))
                        || `/api/images/raw?name=${encodeURIComponent(item.drawingFileName!)}`;
                      window.open(url, '_blank', 'noopener');
                    }}
                    className="btn-tactile inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.8125rem] font-semibold bg-sky-50 text-sky-900 border border-sky-300 hover:bg-sky-100 transition-colors cursor-pointer shadow-2xs whitespace-nowrap"
                    title={`在瀏覽器新分頁開啟圖檔：${item.drawingFileName}`}
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-sky-700" />
                    <span>開啟圖面</span>
                  </button>
                </div>
              </div>
            )}

            {item.alternates && item.alternates.length > 0 && (
              <div className="pt-2.5 border-t border-slate-200/80">
                <span className="text-[0.8125rem] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>別稱 / 替代品號</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {item.alternates.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-white text-slate-800 font-mono rounded border border-slate-300 text-[0.8125rem] font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.notes && (
              <div className="pt-2.5 border-t border-slate-200/80">
                <span className="text-[0.8125rem] text-slate-500 mb-1 block font-medium">備註說明</span>
                <p className="text-[0.8125rem] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* BOM Section: If Assembly or SET, show structured components table */}
          {isAssembly ? (
            <div className="p-3.5 sm:p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs space-y-3">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <h3 className="font-bold text-emerald-900 flex items-center space-x-2 text-[0.8125rem]">
                  <Boxes className="w-4 h-4 text-emerald-700" />
                  <span>組成該組件/SET的所有零件清單 (BOM Details)</span>
                </h3>
                <span className="text-[0.8125rem] text-emerald-800/80 font-mono">
                  共 {(item.bomDetails?.length || componentsList.length)} 項子零件
                </span>
              </div>

              {/* 結構化 BOM 清單表格 */}
              {item.bomDetails && item.bomDetails.length > 0 ? (
                <div className="overflow-x-auto border border-emerald-200 rounded-lg bg-white shadow-2xs">
                  <table className="w-full text-left border-collapse text-[0.8125rem]">
                    <thead>
                      <tr className="bg-emerald-100/50 text-emerald-900 border-b border-emerald-200 font-semibold text-[0.8125rem]">
                        <th className="p-2.5 w-16 text-center">用量</th>
                        <th className="p-2.5">品號 (Part No.)</th>
                        <th className="p-2.5">品名規格 (Description)</th>
                        <th className="p-2.5">原料名稱 (Material)</th>
                        <th className="p-2.5">原料編碼</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100/60">
                      {item.bomDetails.map((b, idx) => {
                        const targetPart = allParts.find(p => p.partNo.toUpperCase() === b.partNo.toUpperCase());
                        return (
                          <tr key={`${b.partNo}-${idx}`} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                              {b.qty || '1'}
                            </td>
                            <td className="p-2.5 font-mono font-bold text-slate-900">
                              <div className="flex items-center space-x-1.5">
                                {targetPart ? (
                                  <button
                                    onClick={() => onSelectRelated(targetPart)}
                                    className="text-sky-700 hover:text-sky-900 hover:underline cursor-pointer font-bold"
                                    title="點擊查看此零件詳情"
                                  >
                                    {b.partNo}
                                  </button>
                                ) : (
                                  <span>{b.partNo}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-2.5 text-slate-700">
                              {b.name || '-'}
                            </td>
                            <td className="p-2.5 font-mono text-emerald-800 font-medium">
                              {b.material || '-'}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">
                              {b.materialCode || '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : componentsList.length > 0 ? (
                <div className="grid gap-2">
                  {componentsList.map((rel, idx) => (
                    <button
                      key={`${rel.relatedItem.id}-${idx}`}
                      onClick={() => onSelectRelated(rel.relatedItem)}
                      className="btn-tactile group flex items-center justify-between p-2.5 bg-white hover:bg-emerald-50/50 rounded-lg border border-emerald-200/80 hover:border-emerald-300 transition-all text-left cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="p-1.5 rounded bg-emerald-100/80 text-emerald-800 border border-emerald-200">
                          <Component className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 text-[0.8125rem]">{rel.relatedItem.partNo}</span>
                            <span className="text-[0.8125rem] text-slate-600 px-1.5 py-0.2 rounded bg-slate-100 font-mono border border-slate-200">
                              {rel.relatedItem.customer}
                            </span>
                          </div>
                          <p className="text-[0.8125rem] text-slate-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-[0.8125rem] text-emerald-800 font-medium mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-emerald-700/60 group-hover:text-emerald-800 transition-colors flex items-center text-[0.8125rem] space-x-1 shrink-0 ml-2 font-medium">
                        <span>查看零件</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[0.8125rem] text-slate-400 italic p-2">
                  暫無比對到明確的組成單零件。
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 sm:p-4 bg-sky-50/40 rounded-xl border border-sky-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-sky-200/60 pb-2">
                <h3 className="font-bold text-sky-900 flex items-center space-x-2 text-[0.8125rem]">
                  <Component className="w-4 h-4 text-sky-700" />
                  <span>本零件可組成的組件 (Assemblies using this Part)</span>
                </h3>
                <span className="text-[0.8125rem] text-sky-800/80 font-mono">共 {assembliesList.length} 項可組裝目標</span>
              </div>

              {assembliesList.length > 0 ? (
                <div className="grid gap-2">
                  {assembliesList.map((rel, idx) => (
                    <div
                      key={`${rel.relatedItem.id}-${idx}`}
                      className={`${rel.unregistered
                        ? 'pointer-events-none opacity-80'
                        : 'cursor-pointer hover:bg-sky-50/50 hover:border-sky-300'} btn-tactile group flex items-center justify-between p-2.5 bg-white rounded-lg border border-sky-200/80 transition-all text-left shadow-2xs`}
                      onClick={rel.unregistered ? undefined : () => onSelectRelated(rel.relatedItem)}
                    >
                      <div className="flex items-center space-x-3">
                        <span className="p-1.5 rounded bg-sky-100/80 text-sky-800 border border-sky-200">
                          <Boxes className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 text-[0.8125rem]">{rel.relatedItem.partNo}</span>
                            <span className="text-[0.8125rem] text-slate-600 px-1.5 py-0.2 rounded bg-slate-100 font-mono border border-slate-200">
                              {rel.relatedItem.customer || (rel.unregistered ? '未登錄' : '')}
                            </span>
                          </div>
                          <p className="text-[0.8125rem] text-slate-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-[0.8125rem] text-sky-800 font-medium mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-sky-700/60 group-hover:text-sky-800 transition-colors flex items-center text-[0.8125rem] space-x-1 shrink-0 ml-2 font-medium">
                        <span>{rel.unregistered ? '待登錄' : '查看組件'}</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.8125rem] text-slate-400 italic p-2">
                  目前系統中尚未比對到以此零件構成的組合配件。
                </p>
              )}
            </div>
          )}

          {/* 由圖檔內容反向識別：此品號可組成哪些產品 */}
          {imageLib && reverseCandidates.length === 0 && ocrIndex.size === 0 && (
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-violet-200 space-y-2">
              <h3 className="font-bold text-violet-700 flex items-center space-x-2 text-sm">
                <ImageIcon className="w-4 h-4 text-violet-500" />
                <span>由圖檔內容反向識別 — 此品號可組成哪些產品</span>
              </h3>
              <p className="text-[0.8125rem] text-slate-500">
                已指定圖檔資料夾，但尚未執行 OCR 內文辨識。可至「未對應孤兒圖檔管理中心」執行批次辨識後，
                系統即可自動比對出包含此品號的產品圖面。
              </p>
            </div>
          )}
          {reverseCandidates.length > 0 && (
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-violet-200 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="font-bold text-violet-700 flex items-center space-x-2 text-sm">
                  <ImageIcon className="w-4 h-4 text-violet-500" />
                  <span>由圖檔內容反向識別 — 此品號出現於下列產品圖面</span>
                </h3>
                <span className="text-sm text-slate-500">共 {reverseCandidates.length} 項候選產品</span>
              </div>
              <p className="text-[0.8125rem] text-slate-500">
                由所有已辨識圖檔的內文中，偵測到包含此品號的圖面；點「加入 BOM 關聯」即可將該產品設為此品號的上層組件。
              </p>
              <div className="grid gap-2">
                {reverseCandidates.map((c) => {
                  const alreadyLinked = existingParents.has(c.partNo);
                  const isAdding = addingBom.has(c.partNo);
                  return (
                    <div
                      key={c.partNo}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-white rounded-xl border border-slate-200 hover:border-violet-300 transition-all"
                    >
                      <div className="flex items-center space-x-3 min-w-0">
                        <span className="p-1.5 rounded-lg bg-violet-100 text-violet-600 border border-violet-200 shrink-0">
                          <Boxes className="w-3.5 h-3.5" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-teal-700">{c.partNo}</span>
                            <span className="text-sm text-slate-500 px-1.5 py-0.2 rounded bg-slate-100">
                              {c.customer}
                            </span>
                            {alreadyLinked && (
                              <span className="text-[0.8125rem] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 font-semibold">
                                已加入 BOM
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-700 mt-0.5 truncate max-w-xs">{c.name}</p>
                          <p className="text-[0.8125rem] text-violet-600 mt-0.5 font-mono truncate max-w-sm" title={c.sourceFiles.join('\n')}>
                            來源圖檔: {c.sourceFiles.join('、')}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddBomLink(c.partNo)}
                        disabled={alreadyLinked || isAdding}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-[0.8125rem] font-bold transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-default ${
                          alreadyLinked || isAdding
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-violet-600 hover:bg-violet-500 text-white'
                        }`}
                        title={alreadyLinked ? '此上層關係已存在於 BOM' : '將此產品加入為此品號的上層組件'}
                      >
                        {alreadyLinked || isAdding ? '已加入 ✓' : '加入 BOM 關聯'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Same Customer items — 清淡柔和靛藍色 */}
          {relatedSameCustomer.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/80 shadow-2xs space-y-2.5">
              <h3 className="font-bold text-indigo-900 flex items-center space-x-1.5 text-[0.8125rem] border-b border-indigo-200/60 pb-1.5">
                <User className="w-3.5 h-3.5 text-indigo-700" />
                <span>相同客戶 ({item.customer}) 的其他品號</span>
              </h3>
              <div className="grid gap-1.5">
                {relatedSameCustomer.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectRelated(rel)}
                    className="btn-tactile flex items-center justify-between p-2 bg-white hover:bg-indigo-50/50 rounded-lg border border-indigo-200/70 transition-colors text-left cursor-pointer shadow-2xs"
                  >
                    <span className="font-mono font-bold text-slate-900 text-[0.8125rem]">{rel.partNo}</span>
                    <span className="text-slate-600 truncate max-w-[250px] text-[0.8125rem]">{rel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Same Prefix items — 清淡柔和琥珀/暖黃色 */}
          {relatedSamePrefix.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-amber-50/40 rounded-xl border border-amber-200/80 shadow-2xs space-y-2.5">
              <h3 className="font-bold text-amber-900 flex items-center space-x-1.5 text-[0.8125rem] border-b border-amber-200/60 pb-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-700" />
                <span>相同字頭系列 ({prefix}) 的品號</span>
              </h3>
              <div className="grid gap-1.5">
                {relatedSamePrefix.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectRelated(rel)}
                    className="btn-tactile flex items-center justify-between p-2 bg-white hover:bg-amber-50/50 rounded-lg border border-amber-200/70 transition-colors text-left cursor-pointer shadow-2xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 text-[0.8125rem] font-mono border border-amber-200">
                        {rel.customer}
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-[0.8125rem]">{rel.partNo}</span>
                    </div>
                    <span className="text-slate-600 truncate max-w-[220px] text-[0.8125rem]">{rel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="btn-tactile px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[0.8125rem] font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
