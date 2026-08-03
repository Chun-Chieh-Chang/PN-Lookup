import React, { useState, useMemo } from 'react';
import { X, Link2, Check, Search, Image as ImageIcon } from 'lucide-react';
import { ImageLibrary } from '../utils/imageLibrary';

interface ImageBindModalProps {
  isOpen: boolean;
  partNo: string | null;
  alternates?: string[];
  lib: ImageLibrary | null;
  bindings: Record<string, string>;
  onBind: (partNo: string, fileName: string) => void;
  onUnbind: (partNo: string) => void;
  onClose: () => void;
}

export const ImageBindModal: React.FC<ImageBindModalProps> = ({
  isOpen,
  partNo,
  alternates,
  lib,
  bindings,
  onBind,
  onUnbind,
  onClose,
}) => {
  const [query, setQuery] = useState('');

  const filteredNames = useMemo(() => {
    if (!lib) return [];
    const q = query.trim().toLowerCase();
    if (!q) return lib.fileNames;
    return lib.fileNames.filter((n) => n.toLowerCase().includes(q));
  }, [lib, query]);

  if (!isOpen || !partNo || !lib) return null;

  const candidates = [partNo, ...(alternates ?? [])];
  const boundName = candidates.map((pn) => bindings[pn]).find(Boolean) ?? null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-600" />
            手動綁定圖檔
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
            title="關閉"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-6 py-4">
          <p className="text-sm text-gray-600 mb-1">
            為品號 <span className="font-mono font-bold text-blue-700">{partNo}</span> 指定圖檔
          </p>
          {alternates && alternates.length > 0 && (
            <p className="text-[13px] text-gray-400 mb-3">
              替代品號：{alternates.join('、')}（綁定任一者皆有效）
            </p>
          )}
          {boundName && (
            <p className="text-[13px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1 mb-3">
              目前已綁定：<span className="font-mono">{boundName}</span>
              <button
                onClick={() => { onUnbind(partNo); onClose(); }}
                className="ml-2 text-rose-500 hover:underline cursor-pointer"
              >
                解除綁定
              </button>
            </p>
          )}

          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`搜尋 ${lib.count} 個檔案...`}
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg">
            {filteredNames.length === 0 && (
              <p className="p-4 text-sm text-gray-400 text-center">查無符合條件的檔案</p>
            )}
            {filteredNames.map((name) => {
              const isBound = boundName === name;
              return (
                <div key={name} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <span className="flex items-center space-x-2 min-w-0 text-sm text-gray-700">
                    <ImageIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                    <span className="truncate font-mono">{name}</span>
                  </span>
                  {isBound ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 text-[13px] font-medium shrink-0">
                      <Check className="w-3.5 h-3.5" /> 已綁定
                    </span>
                  ) : (
                    <button
                      onClick={() => { onBind(partNo, name); onClose(); }}
                      className="px-2.5 py-1 text-[13px] bg-blue-600 hover:bg-blue-500 text-white rounded-md shrink-0 cursor-pointer"
                    >
                      綁定
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
