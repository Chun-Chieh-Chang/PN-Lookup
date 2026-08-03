import React, { useState, useMemo } from 'react';
import { X, AlertCircle, FileSearch, Link2, Check, Search, Image as ImageIcon, Sparkles } from 'lucide-react';
import { ImageLibrary } from '../utils/imageLibrary';
import { PartItem } from '../types';

interface OrphanImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  lib: ImageLibrary | null;
  parts: PartItem[];
  orphanFiles: string[];
  dismissedFiles?: string[];
  ocrIndex: Map<string, string>;
  bindings: Record<string, string>;
  onBind: (partNo: string, fileName: string) => void;
  onToggleDismiss?: (fileName: string) => void;
  isOcrScanning?: boolean;
  ocrProgress?: { done: number; total: number } | null;
  onStartOcrScan?: (targetFiles?: string[]) => void;
  onStopOcrScan?: () => void;
  onSingleOcr?: (fileName: string) => void;
}

export const OrphanImagesModal: React.FC<OrphanImagesModalProps> = ({
  isOpen,
  onClose,
  lib,
  parts,
  orphanFiles = [],
  dismissedFiles = [],
  ocrIndex,
  bindings,
  onBind,
  onToggleDismiss,
  isOcrScanning = false,
  ocrProgress,
  onStartOcrScan,
  onStopOcrScan,
  onSingleOcr,
}) => {
  const [query, setQuery] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [partQuery, setPartQuery] = useState('');
  const [scanningSingleFile, setScanningSingleFile] = useState<string | null>(null);

  const activeFiles = useMemo(() => {
    return showDismissed ? [...orphanFiles, ...dismissedFiles] : orphanFiles;
  }, [showDismissed, orphanFiles, dismissedFiles]);

  const filteredOrphans = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeFiles;
    return activeFiles.filter((name) => {
      const text = ocrIndex.get(name) || '';
      return name.toLowerCase().includes(q) || text.toLowerCase().includes(q);
    });
  }, [activeFiles, query, ocrIndex]);

  const candidateParts = useMemo(() => {
    const q = partQuery.trim().toLowerCase();
    if (!q) return parts.slice(0, 20);
    return parts.filter(
      (p) =>
        p.partNo.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        (p.alternates && p.alternates.some((alt) => alt.toLowerCase().includes(q)))
    ).slice(0, 30);
  }, [parts, partQuery]);

  if (!isOpen || !lib) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] overflow-hidden border border-gray-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-amber-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">未對應孤兒圖檔管理中心</h2>
              <p className="text-[13px] text-gray-500">
                資料夾共 {lib.count} 張圖檔 · 待對應 <strong className="text-amber-700 font-bold">{orphanFiles.length}</strong> 張
                {dismissedFiles.length > 0 && (
                  <span> · 已標記排除 <strong className="text-slate-600 font-bold">{dismissedFiles.length}</strong> 張 (重複/別稱)</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="px-6 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜尋孤兒圖檔檔名或 OCR 辨識內文..."
              className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {dismissedFiles.length > 0 && (
              <button
                onClick={() => setShowDismissed(!showDismissed)}
                className={`px-2.5 py-1.5 rounded-lg text-[13px] font-semibold border transition-all cursor-pointer ${
                  showDismissed
                    ? 'bg-slate-200 text-slate-800 border-slate-300 font-bold'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {showDismissed ? '隱藏已排除圖檔' : `檢視已排除圖檔 (${dismissedFiles.length})`}
              </button>
            )}

            {isOcrScanning ? (
              <div className="flex items-center space-x-2 bg-violet-50 border border-violet-200 rounded-lg px-2.5 py-1 text-[13px] font-semibold text-violet-700">
                <span>OCR 辨識中 {ocrProgress?.done ?? 0}/{ocrProgress?.total ?? 0}…</span>
                {onStopOcrScan && (
                  <button
                    onClick={onStopOcrScan}
                    className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[13px] font-bold cursor-pointer transition-colors"
                  >
                    停止
                  </button>
                )}
              </div>
            ) : (
              onStartOcrScan && orphanFiles.length > 0 && (
                <button
                  onClick={() => onStartOcrScan(orphanFiles)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg text-[13px] font-bold transition-all shadow-2xs cursor-pointer"
                  title="僅對未對應的孤兒圖檔執行內容 OCR 辨識"
                >
                  <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                  <span>批次辨識孤兒圖檔</span>
                </button>
              )
            )}

            <span className="text-[13px] text-gray-500 font-mono">
              {filteredOrphans.length} / {activeFiles.length} 筆
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {activeFiles.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Check className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-gray-800">全部圖檔皆已精準對應與核可！</h3>
              <p className="text-sm text-gray-500">資料夾中沒有任何待處理孤兒圖檔，所有圖檔皆已對應品號或標記排除。</p>
            </div>
          ) : filteredOrphans.length === 0 ? (
            <p className="text-center py-8 text-sm text-gray-400">查無符合搜尋條件的圖檔</p>
          ) : (
            filteredOrphans.map((name) => {
              const ocrText = ocrIndex.get(name);
              const isBindingThis = selectedFileName === name;
              const isDismissed = dismissedFiles.includes(name);

              return (
                <div
                  key={name}
                  className={`p-4 rounded-xl border transition-all ${
                    isDismissed
                      ? 'bg-slate-50 border-slate-200 opacity-75'
                      : isBindingThis
                      ? 'bg-amber-50/60 border-amber-300 shadow-sm'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start space-x-3 min-w-0">
                      <div className="p-2 rounded-lg bg-gray-100 text-gray-500 shrink-0 mt-0.5">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center space-x-2">
                          <p className="font-mono text-sm font-bold text-gray-900 truncate" title={name}>
                            {name}
                          </p>
                          {isDismissed && (
                            <span className="px-2 py-0.5 bg-slate-200 text-slate-700 text-[13px] font-bold rounded-md border border-slate-300 shrink-0">
                              已標記排除 (重複/別稱)
                            </span>
                          )}
                        </div>
                        {ocrText ? (
                          <div className="flex items-center space-x-1.5 mt-1">
                            <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
                            <span className="text-[13px] text-violet-700 bg-violet-50 px-2 py-0.5 rounded border border-violet-200 truncate max-w-md" title={`OCR 內容: ${ocrText}`}>
                              OCR內容: {ocrText}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[13px] text-gray-400 mt-0.5 block">（尚未執行 OCR 內文辨識）</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      {!ocrText && onSingleOcr && !isDismissed && (
                        <button
                          onClick={async () => {
                            setScanningSingleFile(name);
                            await onSingleOcr(name);
                            setScanningSingleFile(null);
                          }}
                          disabled={scanningSingleFile === name}
                          className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 transition-colors cursor-pointer disabled:opacity-50"
                          title="專門對此圖檔執行內容 OCR 辨識"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                          <span>{scanningSingleFile === name ? '辨識中…' : '辨識此圖'}</span>
                        </button>
                      )}

                      {!isDismissed ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedFileName(isBindingThis ? null : name);
                              setPartQuery('');
                            }}
                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white transition-colors cursor-pointer"
                          >
                            <Link2 className="w-3.5 h-3.5" />
                            <span>{isBindingThis ? '收起選單' : '連結至品號'}</span>
                          </button>

                          {onToggleDismiss && (
                            <button
                              onClick={() => onToggleDismiss(name)}
                              className="px-2.5 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
                              title="標記為重複別稱或無須對應的舊版圖檔（將從待處理孤兒中排除）"
                            >
                              標記排除
                            </button>
                          )}
                        </>
                      ) : (
                        onToggleDismiss && (
                          <button
                            onClick={() => onToggleDismiss(name)}
                            className="px-3 py-1.5 rounded-lg text-[13px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors cursor-pointer"
                          >
                            ↺ 復原對應
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Part Selector Panel */}
                  {isBindingThis && (
                    <div className="mt-4 pt-3 border-t border-amber-200/80 space-y-3">
                      <p className="text-[13px] font-semibold text-gray-700">選擇要與「{name}」綁定的品號：</p>
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={partQuery}
                          onChange={(e) => setPartQuery(e.target.value)}
                          placeholder="搜尋品號、品名或客戶名稱..."
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-amber-500"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 bg-white">
                        {candidateParts.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              onBind(item.partNo, name);
                              setSelectedFileName(null);
                            }}
                            className="w-full text-left p-2.5 hover:bg-amber-50 flex items-center justify-between text-sm transition-colors cursor-pointer group"
                          >
                            <div>
                              <span className="font-mono font-bold text-indigo-700 group-hover:text-amber-700">
                                {item.partNo}
                              </span>
                              <span className="text-gray-500 text-[13px] ml-2">({item.customer || '通用'})</span>
                              <p className="text-[13px] text-gray-600 truncate max-w-sm">{item.name}</p>
                            </div>
                            <span className="text-[13px] text-amber-600 opacity-0 group-hover:opacity-100 font-medium">
                              綁定此品號 ➔
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            完成並關閉
          </button>
        </div>

      </div>
    </div>
  );
};
