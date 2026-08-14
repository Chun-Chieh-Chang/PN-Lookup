import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Copy, ListChecks } from 'lucide-react';
import { PartItem } from '../types';

interface BatchSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  allParts: PartItem[];
}

export const BatchSearchModal: React.FC<BatchSearchModalProps> = ({
  isOpen,
  onClose,
  allParts,
}) => {
  const [inputText, setInputText] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Process input text line by line or split by comma / space
  const queries: string[] = Array.from(
    new Set(
      inputText
        .split(/[\n,;，； \t]+/)
        .map((q) => q.trim())
        .filter(Boolean)
    )
  );

  // Match queries
  const matchedList: { query: string; items: PartItem[] }[] = [];
  const missingQueries: string[] = [];

  queries.forEach((q) => {
    const qLower = q.toLowerCase();
    // Exact match or partial match on partNo
    const matches = allParts.filter(
      (item) => item.partNo.toLowerCase() === qLower || item.partNo.toLowerCase().includes(qLower)
    );

    if (matches.length > 0) {
      matchedList.push({ query: q, items: matches });
    } else {
      missingQueries.push(q);
    }
  });

  const totalMatchedCount = matchedList.reduce((acc, curr) => acc + curr.items.length, 0);

  const handleCopyReport = () => {
    let reportText = `=== 批次品號對照檢索報告 ===\n`;
    reportText += `查詢總數: ${queries.length} 筆 | 比對成功: ${matchedList.length} 筆 | 查無結果: ${missingQueries.length} 筆\n\n`;

    if (matchedList.length > 0) {
      reportText += `【成功對照結果】\n`;
      matchedList.forEach(({ query, items }) => {
        reportText += `[查詢品號: ${query}]\n`;
        items.forEach((item) => {
          reportText += `  -> 客戶: ${item.customer} | 品號: ${item.partNo} | 品名: ${item.name}\n`;
        });
      });
      reportText += `\n`;
    }

    if (missingQueries.length > 0) {
      reportText += `【未找到品號】\n`;
      missingQueries.forEach((q) => {
        reportText += `  - ${q}\n`;
      });
    }

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSampleInput = () => {
    setInputText(`C09-240-211\nD10-240-211\n3M41459\nUNKNOWN-PART-999\nSB0068\nF17-000-416`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl text-slate-900 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-2xl">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-sky-100/80 text-sky-800 border border-sky-200 flex items-center justify-center">
              <ListChecks className="w-4 h-4 text-sky-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">批次品號對照檢索</h2>
              <p className="text-[13px] text-slate-500">貼上多筆品號，迅速一次對照客戶與品名規格</p>
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
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-sm">
          
          {/* Input Area */}
          <div className="p-3.5 sm:p-4 bg-slate-50/70 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-800 text-[13px]">
                請輸入或貼上品號清單 (每行一筆或以逗號/空格隔開):
              </label>
              <button
                onClick={handleSampleInput}
                className="text-sky-700 hover:text-sky-900 hover:underline text-[13px] font-semibold cursor-pointer"
              >
                載入範例資料
              </button>
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="例：&#10;C09-240-211&#10;D10-240-211&#10;3M41459"
              className="w-full p-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 font-mono text-[13px] focus:outline-none focus:ring-2 focus:ring-sky-500/15 focus:border-sky-500 shadow-2xs"
            />
          </div>

          {/* Results Summary & Action */}
          {queries.length > 0 && (
            <div className="space-y-4 pt-1">
              <div className="flex flex-wrap items-center justify-between bg-white p-3.5 rounded-xl border border-slate-200 gap-3 shadow-2xs">
                <div className="flex flex-wrap items-center gap-3 text-[13px]">
                  <span className="text-slate-600 font-medium">
                    輸入 <strong className="text-slate-900 font-mono">{queries.length}</strong> 項品號
                  </span>
                  <span className="text-emerald-800 font-semibold flex items-center space-x-1 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>成功比對 {matchedList.length} 項 ({totalMatchedCount} 筆記錄)</span>
                  </span>
                  {missingQueries.length > 0 && (
                    <span className="text-rose-800 font-semibold flex items-center space-x-1 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 font-mono">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      <span>未找到 {missingQueries.length} 項</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleCopyReport}
                  className="btn-tactile inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[13px] font-semibold border border-slate-700 transition-colors cursor-pointer shadow-2xs"
                >
                  <Copy className="w-3.5 h-3.5 text-sky-400" />
                  <span>{copied ? '對照報告已複製！' : '複製對照報告'}</span>
                </button>
              </div>

              {/* Matched List — 清淡柔和翠綠色卡片 */}
              {matchedList.length > 0 && (
                <div className="p-3.5 sm:p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2.5">
                  <h3 className="font-bold text-emerald-900 flex items-center space-x-2 text-[13px] border-b border-emerald-200/60 pb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                    <span>成功對照項目 ({matchedList.length})</span>
                  </h3>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {matchedList.map(({ query, items }) => (
                      <div key={query} className="bg-white p-2.5 rounded-lg border border-emerald-200/80 space-y-1.5 shadow-2xs">
                        <div className="flex items-center justify-between font-mono font-bold text-emerald-900 text-[13px]">
                          <span>查詢字串: {query}</span>
                          <span className="text-[13px] text-slate-500 font-sans font-normal">
                            對應 {items.length} 筆
                          </span>
                        </div>
                        <div className="grid gap-1 pl-1">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded bg-slate-50 border border-slate-200/90 text-[13px]"
                            >
                              <div className="flex items-center space-x-2.5">
                                <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 border border-slate-300 font-mono text-[13px]">
                                  {item.customer}
                                </span>
                                <span className="font-mono font-bold text-slate-900">{item.partNo}</span>
                                <span className="text-slate-600 truncate max-w-sm">{item.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing List — 清淡柔和暖紅/玫瑰色卡片 */}
              {missingQueries.length > 0 && (
                <div className="p-3.5 sm:p-4 bg-rose-50/40 rounded-xl border border-rose-200/80 shadow-2xs space-y-2.5">
                  <h3 className="font-bold text-rose-900 flex items-center space-x-2 text-[13px] border-b border-rose-200/60 pb-1.5">
                    <AlertTriangle className="w-4 h-4 text-rose-700" />
                    <span>查無比對結果項目 ({missingQueries.length})</span>
                  </h3>
                  <div className="bg-white p-2.5 border border-rose-200 rounded-lg text-rose-900 font-mono space-y-1 text-[13px] shadow-2xs max-h-48 overflow-y-auto">
                    {missingQueries.map((q) => (
                      <div key={q} className="flex items-center justify-between py-0.5">
                        <span className="font-bold">• {q}</span>
                        <span className="text-[13px] text-slate-400 font-sans">資料庫中無此品號</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-200 bg-slate-50 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="btn-tactile px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[13px] font-semibold border border-slate-300 transition-colors cursor-pointer shadow-2xs"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
