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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-blue-600" />
            指定圖檔資料夾
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title="關閉"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              選擇存放品號圖檔的資料夾後，檢索結果中的品號將可直接點選開啟圖檔（新分頁顯示）。
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>檔名任一節需包含品號，例如 <code className="text-blue-700 bg-blue-50 px-1 rounded font-mono">3M41459_02_3M41459.jpg</code> 或 <code className="text-blue-700 bg-blue-50 px-1 rounded font-mono">3M-41459_01_V2.png</code>（`品號_版本_別稱` / `別稱_版本_品號` 皆可）</li>
              <li>支援 <code className="text-gray-700 font-mono">JPG / PNG / GIF / WEBP / BMP / SVG / PDF</code></li>
              <li>系統會自動遍歷所有子資料夾</li>
              <li>未對應的孤兒圖檔，可在「孤兒圖檔管理」中隨時點擊進行個別或批次內容 OCR 辨識（100% 手動控制，不佔用背景 CPU）</li>
              <li>選擇位置會保存在本機，下次開啟自動載入；此功能完全在本機瀏覽器內執行，圖檔不會上傳</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            >
              略過
            </button>
            <button
              onClick={onConfirm}
              disabled={isPicking}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-sm cursor-pointer disabled:opacity-60"
            >
              {isPicking ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FolderOpen className="w-4 h-4" />
              )}
              {isPicking ? '讀取圖檔中…' : '選擇圖檔資料夾'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
