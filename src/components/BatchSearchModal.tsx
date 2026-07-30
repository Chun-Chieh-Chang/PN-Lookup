import React, { useState } from 'react';
import { X, CheckCircle2, AlertTriangle, Copy, FileText, ListChecks, Download } from 'lucide-react';
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
        .split(/[\n,;]+/)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-xl text-gray-900 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-teal-100 text-teal-600 border border-teal-200">
              <ListChecks className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">批次品號對照檢索</h2>
              <p className="text-sm text-gray-500">貼上多筆品號，迅速一次對照客戶與品名規格</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          
          {/* Input Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-gray-700">
                請輸入或貼上品號清單 (每行一筆或以逗號/空格隔開):
              </label>
              <button
                onClick={handleSampleInput}
                className="text-teal-600 hover:underline text-sm cursor-pointer"
              >
                載入範例資料
              </button>
            </div>
            <textarea
              rows={4}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="例：&#10;C09-240-211&#10;D10-240-211&#10;3M41459"
              className="w-full p-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {/* Results Summary & Action */}
          {queries.length > 0 && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between bg-gray-50 p-3.5 rounded-xl border border-gray-200 gap-3">
                <div className="flex items-center space-x-4">
                  <span className="text-gray-600">
                    輸入 <strong className="text-gray-900">{queries.length}</strong> 項品號
                  </span>
                  <span className="text-emerald-600 font-medium flex items-center space-x-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>成功比對 {matchedList.length} 項 ({totalMatchedCount} 筆記錄)</span>
                  </span>
                  {missingQueries.length > 0 && (
                    <span className="text-rose-600 font-medium flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>未找到 {missingQueries.length} 項</span>
                    </span>
                  )}
                </div>

                <button
                  onClick={handleCopyReport}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? '對照報告已複製！' : '複製對照報告'}</span>
                </button>
              </div>

              {/* Matched List */}
              {matchedList.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-700 flex items-center space-x-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    <span>成功對照項目 ({matchedList.length})</span>
                  </h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-200">
                    {matchedList.map(({ query, items }) => (
                      <div key={query} className="bg-gray-50/50 p-3 space-y-2">
                        <div className="flex items-center justify-between font-mono font-bold text-teal-700">
                          <span>查詢字串: {query}</span>
                          <span className="text-sm text-gray-400 font-sans font-normal">
                            對應 {items.length} 筆
                          </span>
                        </div>
                        <div className="grid gap-1.5 pl-2">
                          {items.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between p-2 rounded bg-white border border-gray-200 text-sm"
                            >
                              <div className="flex items-center space-x-3">
                                <span className="px-2 py-0.5 rounded bg-gray-100 text-indigo-700 border border-gray-200 text-sm">
                                  {item.customer}
                                </span>
                                <span className="font-mono font-bold text-gray-900">{item.partNo}</span>
                                <span className="text-gray-600">{item.name}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing List */}
              {missingQueries.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-bold text-gray-700 flex items-center space-x-2 text-sm">
                    <AlertTriangle className="w-4 h-4 text-rose-500" />
                    <span>查無比對結果項目 ({missingQueries.length})</span>
                  </h3>
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 font-mono space-y-1">
                    {missingQueries.map((q) => (
                      <div key={q} className="flex items-center justify-between">
                        <span>• {q}</span>
                        <span className="text-sm text-rose-500/80 font-sans">資料庫中無此品號</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            關閉視窗
          </button>
        </div>

      </div>
    </div>
  );
};
