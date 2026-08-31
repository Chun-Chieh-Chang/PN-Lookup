import React, { useRef } from 'react';
import { Search, FileSpreadsheet, ListChecks, Image as ImageIcon } from 'lucide-react';
import { APP_VERSION } from '../version';

interface HeaderProps {
  onOpenBatchSearch: () => void;

  onOpenExportImport: () => void;
  onEnterAdmin?: () => void;
  imageFolderName?: string | null;
  imageCount?: number;
  orphanCount?: number;
  onPickImageFolder?: () => void;
  onOpenOrphansModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenBatchSearch,

  onOpenExportImport,
  onEnterAdmin,
  imageFolderName,
  imageCount,
  orphanCount = 0,
  onPickImageFolder,
  onOpenOrphansModal,
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
    <header className="glass-header sticky top-0 z-30 shadow-sm transition-all duration-200">
      <div className="max-w-[112.5rem] mx-auto px-3 sm:px-4 lg:px-6 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-sky-600 border border-sky-700/50 flex items-center justify-center text-white font-bold shadow-xs">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 font-sans">凱益品號檢索系統</h1>
                <span
                  onClick={handleVersionClick}
                  title="五擊解鎖前端「修訂」與後台「增刪」管理權限"
                  className="bg-slate-100 text-slate-700 hover:bg-slate-200 text-[0.8125rem] px-2.5 py-0.5 rounded-full border border-slate-300 font-mono font-semibold select-none cursor-pointer transition-colors shadow-2xs"
                >
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[0.8125rem] text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>醫療器材與 BOM 階層規格料號即時對照平台</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="font-mono text-slate-600 font-medium text-[0.8125rem]">Developed by Wesley Chang, July-2026 @Mouldex.</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">

            <button
              onClick={onOpenBatchSearch}
              className="btn-tactile inline-flex items-center whitespace-nowrap px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs gap-1.5 cursor-pointer"
              title="貼上多筆品號一次比對檢索"
            >
              <ListChecks className="w-4 h-4 text-slate-600 shrink-0" />
              <span>批次檢索</span>
            </button>

            {onPickImageFolder && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={onPickImageFolder}
                  className={`btn-tactile inline-flex items-center whitespace-nowrap px-3.5 py-1.5 text-sm font-semibold rounded-lg transition-all gap-1.5 cursor-pointer border shadow-2xs ${
                    imageFolderName
                      ? 'bg-slate-100/90 hover:bg-slate-200/80 text-slate-800 border-slate-300'
                      : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300'
                  }`}
                  title={
                    imageFolderName
                      ? `圖檔資料夾：${imageFolderName}（${imageCount} 個檔案）— 點擊可更換`
                      : '指定圖檔資料夾（品號可直接點選開啟圖檔）'
                  }
                >
                  <ImageIcon className={`w-4 h-4 shrink-0 ${imageFolderName ? 'text-sky-600' : 'text-slate-500'}`} />
                  <span className="max-w-[120px] truncate">
                    {imageFolderName ?? '圖檔資料夾'}
                  </span>
                  {imageFolderName && imageCount != null && imageCount > 0 && (
                    <span className="text-[0.6875rem] font-mono text-slate-500 bg-white/80 px-1 py-0.5 rounded border border-slate-200">
                      {imageCount}
                    </span>
                  )}
                </button>

                {imageFolderName && onOpenOrphansModal && (
                  <button
                    onClick={onOpenOrphansModal}
                    className={`btn-tactile inline-flex items-center whitespace-nowrap px-3 py-1.5 text-sm font-semibold rounded-lg transition-all gap-1.5 cursor-pointer border shadow-2xs ${
                      orphanCount > 0
                        ? 'bg-amber-50 hover:bg-amber-100/80 text-amber-900 border-amber-300'
                        : 'bg-slate-50 text-emerald-800 border-slate-200'
                    }`}
                    title={
                      orphanCount > 0
                        ? `發現 ${orphanCount} 張未連結品號的孤兒圖檔，點擊開啟管理中心`
                        : '所有圖檔均已精準對應品號（圖檔對應率 100%）'
                    }
                  >
                    {orphanCount > 0 ? (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span>孤兒 {orphanCount}</span>
                      </>
                    ) : (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span>對應 100%</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-5 bg-slate-200 hidden sm:block" />

            <button
              onClick={onOpenExportImport}
              className="btn-tactile inline-flex items-center whitespace-nowrap px-3.5 py-1.5 text-sm font-semibold rounded-lg bg-sky-600 hover:bg-sky-500 text-white border border-sky-700/50 shadow-2xs gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 text-sky-100 shrink-0" />
              <span>匯出與匯入</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
