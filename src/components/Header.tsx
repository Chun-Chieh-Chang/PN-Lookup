import React, { useRef } from 'react';
import { Search, FileSpreadsheet, ListChecks, Image as ImageIcon, ShieldAlert, ExternalLink, Network } from 'lucide-react';

interface HeaderProps {
  totalCount: number;
  customerCount: number;
  onOpenBatchSearch: () => void;

  onOpenExportImport: () => void;
  onResetData: () => void;
  onEnterAdmin?: () => void;
  onOpenGraph?: () => void;
  imageFolderName?: string | null;
  imageCount?: number;
  orphanCount?: number;
  onPickImageFolder?: () => void;
  onOpenOrphansModal?: () => void;
  isAdminMode?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  totalCount,
  customerCount,
  onOpenBatchSearch,

  onOpenExportImport,
  onResetData,
  onEnterAdmin,
  onOpenGraph,
  imageFolderName,
  imageCount,
  orphanCount = 0,
  onPickImageFolder,
  onOpenOrphansModal,
  isAdminMode = false,
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-blue-500 flex items-center justify-center shadow-md shadow-indigo-500/25 text-white font-bold text-xl ring-1 ring-white/20">
              <Search className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 font-sans">凱益品號檢索系統</h1>
                <span
                  onClick={handleVersionClick}
                  title="五擊解鎖前端「修訂」與後台「增刪」管理權限"
                  className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs px-2.5 py-0.5 rounded-full border border-indigo-200/80 font-mono font-semibold select-none cursor-pointer transition-colors shadow-xs"
                >
                  v3.6.0
                </span>

                {/* Show Unlocked Status Pill when unlocked */}
                {isAdminMode && (
                  <span
                    onClick={onEnterAdmin}
                    className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-xs font-bold cursor-pointer hover:bg-amber-100 transition-colors shadow-xs"
                    title="點擊直接跳轉後台進行資料「增刪」"
                  >
                    <span>修訂已解鎖</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>醫療器材與 BOM 階層規格料號即時對照平台</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="font-mono text-indigo-700/80 font-semibold text-[11px]">Developed by Wesley Chang, July-2026 @Mouldex.</span>
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">

            {onOpenGraph && (
              <button
                onClick={onOpenGraph}
                className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/35 cursor-pointer active:scale-95 border border-indigo-400/30"
                title="開啟 2D / 3D 全景醫療產品知識與 BOM 網絡圖譜"
              >
                <Network className="w-4 h-4 text-indigo-200" />
                <span>產品圖譜</span>
              </button>
            )}

            {/* Jump to Back-end Admin Button (Appears when unlocked) */}
            {isAdminMode && onEnterAdmin && (
              <button
                onClick={onEnterAdmin}
                className="inline-flex items-center px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 transition-all shadow-xs hover:shadow-sm gap-1.5 cursor-pointer active:scale-95 border border-amber-300 shadow-amber-500/20"
                title="前往後台管理頁面執行『增刪』（新增與刪除數據）"
              >
                <ShieldAlert className="w-4 h-4 text-slate-950" />
                <span>後台管理 (增刪)</span>
                <ExternalLink className="w-3 h-3 text-slate-800" />
              </button>
            )}
            
            <button
              onClick={onOpenBatchSearch}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-500 text-white transition-all shadow-xs hover:shadow-sm gap-1.5 cursor-pointer active:scale-95"
              title="貼上多筆品號一次比對檢索"
            >
              <ListChecks className="w-4 h-4" />
              <span>批次檢索</span>
            </button>



            {onPickImageFolder && (
              <div className="flex items-center space-x-1.5">
                <button
                  onClick={onPickImageFolder}
                  className={`inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all gap-1.5 cursor-pointer border active:scale-95 ${
                    imageFolderName
                      ? 'bg-teal-50/80 hover:bg-teal-100 text-teal-700 border-teal-200'
                      : 'bg-slate-100/80 hover:bg-slate-200/80 text-slate-700 border-slate-200'
                  }`}
                  title={
                    imageFolderName
                      ? `圖檔資料夾：${imageFolderName}（${imageCount} 個檔案）— 點擊可更換`
                      : '指定圖檔資料夾（品號可直接點選開啟圖檔）'
                  }
                >
                  <ImageIcon className={`w-4 h-4 ${imageFolderName ? 'text-teal-600' : 'text-slate-500'}`} />
                  <span>{imageFolderName ? imageFolderName : '圖檔資料夾'}</span>
                </button>

                {imageFolderName && onOpenOrphansModal && (
                  <button
                    onClick={onOpenOrphansModal}
                    className={`inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all gap-1 cursor-pointer border active:scale-95 ${
                      orphanCount > 0
                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                    title={
                      orphanCount > 0
                        ? `發現 ${orphanCount} 張未連結品號的孤兒圖檔！點擊開啟管理中心`
                        : '所有圖檔均已精準對應品號（圖檔對應率 100%）'
                    }
                  >
                    <span>{orphanCount > 0 ? `未對應孤兒 (${orphanCount})` : '圖檔對應率 100%'}</span>
                  </button>
                )}
              </div>
            )}

            <button
              onClick={onOpenExportImport}
              className="inline-flex items-center px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-xs hover:shadow-sm gap-1.5 cursor-pointer active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>匯出與匯入</span>
            </button>

          </div>
        </div>
      </div>
    </header>
  );
};
