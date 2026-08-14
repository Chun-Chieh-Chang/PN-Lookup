import React from 'react';
import { FolderOpen, X, Loader2, Image as ImageIcon } from 'lucide-react';

interface ImageFolderModalProps {
  isOpen: boolean;
  isPicking: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const ImageFolderModal: React.FC<ImageFolderModalProps> = ({
  isOpen,
  isPicking,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50/50">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-sky-700" />
            指定圖檔資料夾
          </h2>
          <button
            onClick={onClose}
            className="btn-tactile p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer border border-transparent hover:border-slate-200"
            title="關閉"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-5 space-y-4">
          <div className="space-y-2 text-[13px] text-slate-600 leading-relaxed">
            <p>
              選擇存放品號圖檔的資料夾後，檢索結果中的品號將可直接點選開啟圖檔（新分頁顯示）。
            </p>
            <ul className="list-disc list-inside space-y-1 text-slate-500">
              <li>檔名任一節需包含品號，例如 <code className="text-slate-900 bg-slate-100 border border-slate-200 px-1 rounded font-mono">3M41459_02_3M41459.jpg</code> 或 <code className="text-slate-900 bg-slate-100 border border-slate-200 px-1 rounded font-mono">3M-41459_01_V2.png</code></li>
              <li>支援 <code className="text-slate-800 font-mono">JPG / PNG / GIF / WEBP / BMP / SVG / PDF</code></li>
              <li>系統會自動遍歷所有子資料夾</li>
              <li>未對應的孤兒圖檔，可在「孤兒圖檔管理」中手動觸發 OCR 辨識</li>
              <li>選擇位置會保存在本機，100% 在本機瀏覽器內執行，圖檔絕不上傳</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
            <button
              onClick={onClose}
              className="btn-tactile px-3.5 py-1.5 rounded-lg text-[13px] font-medium text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
            >
              略過
            </button>
            <button
              onClick={onConfirm}
              disabled={isPicking}
              className="btn-tactile inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[13px] font-semibold text-white bg-slate-900 hover:bg-slate-800 border border-slate-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-60"
            >
              {isPicking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-sky-400" />
              )}
              {isPicking ? '讀取圖檔中…' : '選擇圖檔資料夾'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
