import React, { useRef } from 'react';
import { Search, FileSpreadsheet, ListChecks, Layers, Image as ImageIcon } from 'lucide-react';

interface HeaderProps {
  totalCount: number;
  customerCount: number;
  onOpenBatchSearch: () => void;
  onOpenCustomerStats: () => void;
  onOpenExportImport: () => void;
  onResetData: () => void;
  onEnterAdmin?: () => void;
  imageFolderName?: string | null;
  imageCount?: number;
  onPickImageFolder?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  customerCount,
  onOpenBatchSearch,
  onOpenCustomerStats,
  onOpenExportImport,
  onResetData,
  onEnterAdmin,
  imageFolderName,
  imageCount,
  onPickImageFolder,
}) => {
  const versionClickCount = useRef(0);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleVersionClick = () => {
    versionClickCount.current += 1;
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => {
      versionClickCount.current = 0;
    }, 1500);
    if (versionClickCount.current >= 5) {
      versionClickCount.current = 0;
      if (onEnterAdmin) onEnterAdmin();
    }
  };
  return (
    <header className="bg-white text-gray-900 border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold text-xl">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold tracking-tight text-gray-900">品號檢索系統</h1>
                <span
                  onClick={handleVersionClick}
                  title="版本資訊"
                  className="bg-blue-100 text-blue-700 text-sm px-2 py-0.5 rounded-full border border-blue-200 font-mono select-none cursor-pointer"
                >
                  v2.0
                </span>
              </div>
              <p className="text-sm text-gray-500">醫療耗材與規格品號即時對照查詢平台</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            
            <button
              onClick={onOpenBatchSearch}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-colors shadow-sm gap-1.5 cursor-pointer"
              title="貼上多筆品號一次比對檢索"
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span>批次檢索</span>
            </button>

            <button
              onClick={onOpenCustomerStats}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors gap-1.5 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>客戶統計</span>
            </button>

            {onPickImageFolder && (
              <button
                onClick={onPickImageFolder}
                className={`inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors gap-1.5 cursor-pointer ${
                  imageFolderName
                    ? 'bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200'
                }`}
                title={
                  imageFolderName
                    ? `圖檔資料夾：${imageFolderName}（${imageCount} 個檔案）— 點擊可更換`
                    : '指定圖檔資料夾（品號可直接點選開啟圖檔）'
                }
              >
                <ImageIcon className={`w-3.5 h-3.5 ${imageFolderName ? 'text-teal-600' : 'text-gray-500'}`} />
                <span>{imageFolderName ? imageFolderName : '圖檔'}</span>
              </button>
            )}

            <button
              onClick={onOpenExportImport}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>匯出匯入</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
