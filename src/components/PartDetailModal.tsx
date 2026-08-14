import React, { useState } from 'react';
import { X, Copy, Check, Tag, Layers, FileText, User, Boxes, Component, ArrowRight, RefreshCw } from 'lucide-react';
import { PartItem } from '../types';
import { getItemType, getComponentsForAssembly, getAssembliesForPart } from '../utils/bomEngine';
import { getPartPrefix } from '../utils/partNo';

interface PartDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: PartItem | null;
  allParts: PartItem[];
  onSelectRelated: (item: PartItem) => void;
}

export const PartDetailModal: React.FC<PartDetailModalProps> = ({
  isOpen,
  onClose,
  item,
  allParts,
  onSelectRelated,
}) => {
  const [copiedPart, setCopiedPart] = useState(false);

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
            <span className={`px-2.5 py-0.5 rounded-full text-[13px] font-semibold flex items-center space-x-1.5 border shadow-2xs ${
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
                <span className="text-[13px] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>客戶名稱</span>
                </span>
                <p className="text-base font-bold text-slate-900">{item.customer}</p>
              </div>

              <div>
                <span className="text-[13px] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
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
              <span className="text-[13px] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                <FileText className="w-3.5 h-3.5 text-slate-400" />
                <span>品名規格 (Part Name)</span>
              </span>
              <p className="text-base font-medium text-slate-900">{item.name}</p>
            </div>

            {(item.category || item.color || item.material) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2.5 border-t border-slate-200/80">
                {item.category && (
                  <div>
                    <span className="text-[13px] text-slate-500 block mb-0.5 font-medium">物料類別</span>
                    <span className="inline-block px-2 py-0.5 bg-white text-slate-800 font-semibold rounded text-[13px] border border-slate-300">
                      {item.category}
                    </span>
                  </div>
                )}

                {item.color && (
                  <div>
                    <span className="text-[13px] text-slate-500 block mb-0.5 font-medium">顏色</span>
                    <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-900 font-semibold rounded text-[13px] border border-amber-300">
                      {item.color}
                    </span>
                  </div>
                )}

                {item.material && (
                  <div className="sm:col-span-1">
                    <span className="text-[13px] text-slate-500 block mb-0.5 font-medium">原料</span>
                    <span className="inline-block px-2 py-0.5 bg-emerald-50 text-emerald-900 font-mono font-semibold text-[13px] rounded border border-emerald-300">
                      {item.material}
                    </span>
                  </div>
                )}
              </div>
            )}

            {item.alternates && item.alternates.length > 0 && (
              <div className="pt-2.5 border-t border-slate-200/80">
                <span className="text-[13px] text-slate-500 flex items-center space-x-1 mb-1 font-medium">
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                  <span>別稱 / 替代品號</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {item.alternates.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-white text-slate-800 font-mono rounded border border-slate-300 text-[13px] font-semibold">
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {item.notes && (
              <div className="pt-2.5 border-t border-slate-200/80">
                <span className="text-[13px] text-slate-500 mb-1 block font-medium">備註說明</span>
                <p className="text-[13px] text-slate-700 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* BOM Section: If Assembly, show components; If Part, show assemblies it can form */}
          {isAssembly ? (
            <div className="p-3.5 sm:p-4 bg-emerald-50/40 rounded-xl border border-emerald-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-200/60 pb-2">
                <h3 className="font-bold text-emerald-900 flex items-center space-x-2 text-[13px]">
                  <Boxes className="w-4 h-4 text-emerald-700" />
                  <span>組成該組件的所有零件 (Components)</span>
                </h3>
                <span className="text-[13px] text-emerald-800/80 font-mono">共 {componentsList.length} 項關聯零件</span>
              </div>

              {componentsList.length > 0 ? (
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
                            <span className="font-mono font-bold text-slate-900 text-[13px]">{rel.relatedItem.partNo}</span>
                            <span className="text-[13px] text-slate-600 px-1.5 py-0.2 rounded bg-slate-100 font-mono border border-slate-200">
                              {rel.relatedItem.customer}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-[13px] text-emerald-800 font-medium mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-emerald-700/60 group-hover:text-emerald-800 transition-colors flex items-center text-[13px] space-x-1 shrink-0 ml-2 font-medium">
                        <span>查看零件</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 italic p-2">
                  暫無比對到明確的組成單零件。
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 sm:p-4 bg-sky-50/40 rounded-xl border border-sky-200/80 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between border-b border-sky-200/60 pb-2">
                <h3 className="font-bold text-sky-900 flex items-center space-x-2 text-[13px]">
                  <Component className="w-4 h-4 text-sky-700" />
                  <span>本零件可組成的組件 (Assemblies using this Part)</span>
                </h3>
                <span className="text-[13px] text-sky-800/80 font-mono">共 {assembliesList.length} 項可組裝目標</span>
              </div>

              {assembliesList.length > 0 ? (
                <div className="grid gap-2">
                  {assembliesList.map((rel, idx) => (
                    <button
                      key={`${rel.relatedItem.id}-${idx}`}
                      onClick={() => onSelectRelated(rel.relatedItem)}
                      className="btn-tactile group flex items-center justify-between p-2.5 bg-white hover:bg-sky-50/50 rounded-lg border border-sky-200/80 hover:border-sky-300 transition-all text-left cursor-pointer shadow-2xs"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="p-1.5 rounded bg-sky-100/80 text-sky-800 border border-sky-200">
                          <Boxes className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 text-[13px]">{rel.relatedItem.partNo}</span>
                            <span className="text-[13px] text-slate-600 px-1.5 py-0.2 rounded bg-slate-100 font-mono border border-slate-200">
                              {rel.relatedItem.customer}
                            </span>
                          </div>
                          <p className="text-[13px] text-slate-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-[13px] text-sky-800 font-medium mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-sky-700/60 group-hover:text-sky-800 transition-colors flex items-center text-[13px] space-x-1 shrink-0 ml-2 font-medium">
                        <span>查看組件</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-slate-400 italic p-2">
                  目前系統中尚未比對到以此零件構成的組合配件。
                </p>
              )}
            </div>
          )}

          {/* Same Customer items — 清淡柔和靛藍色 */}
          {relatedSameCustomer.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-indigo-50/40 rounded-xl border border-indigo-200/80 shadow-2xs space-y-2.5">
              <h3 className="font-bold text-indigo-900 flex items-center space-x-1.5 text-[13px] border-b border-indigo-200/60 pb-1.5">
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
                    <span className="font-mono font-bold text-slate-900 text-[13px]">{rel.partNo}</span>
                    <span className="text-slate-600 truncate max-w-[250px] text-[13px]">{rel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Same Prefix items — 清淡柔和琥珀/暖黃色 */}
          {relatedSamePrefix.length > 0 && (
            <div className="p-3.5 sm:p-4 bg-amber-50/40 rounded-xl border border-amber-200/80 shadow-2xs space-y-2.5">
              <h3 className="font-bold text-amber-900 flex items-center space-x-1.5 text-[13px] border-b border-amber-200/60 pb-1.5">
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
                      <span className="px-1.5 py-0.5 rounded bg-amber-100/70 text-amber-900 text-[13px] font-mono border border-amber-200">
                        {rel.customer}
                      </span>
                      <span className="font-mono font-bold text-slate-900 text-[13px]">{rel.partNo}</span>
                    </div>
                    <span className="text-slate-600 truncate max-w-[220px] text-[13px]">{rel.name}</span>
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
            className="btn-tactile px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 text-[13px] font-semibold rounded-lg border border-slate-300 transition-colors cursor-pointer shadow-2xs"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
