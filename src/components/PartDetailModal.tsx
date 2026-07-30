import React, { useState } from 'react';
import { X, Copy, Check, Tag, Layers, FileText, User, Boxes, Component, ArrowRight } from 'lucide-react';
import { PartItem } from '../types';
import { getItemType, getComponentsForAssembly, getAssembliesForPart } from '../utils/bomEngine';

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
  const prefix = item.partNo.split('-')[0] || item.partNo.substring(0, 3);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-2xl w-full flex flex-col shadow-xl text-gray-900 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <span className="px-3 py-1 bg-teal-50 text-teal-700 font-mono font-bold rounded-lg border border-teal-200 text-sm">
              {item.partNo}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium flex items-center space-x-1 ${
              isAssembly
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : 'bg-sky-100 text-sky-700 border border-sky-200'
            }`}>
              {isAssembly ? <Boxes className="w-3 h-3" /> : <Component className="w-3 h-3" />}
              <span>{isAssembly ? '組合配件 / 組立 (Assembly)' : '單一零件 (Single Part)'}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6 text-sm overflow-y-auto max-h-[75vh]">
          
          {/* Main Info Card */}
          <div className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <span className="text-sm text-gray-500 flex items-center space-x-1 mb-1">
                  <User className="w-3.5 h-3.5 text-indigo-500" />
                  <span>客戶名稱</span>
                </span>
                <p className="text-base font-bold text-indigo-700">{item.customer}</p>
              </div>

              <div>
                <span className="text-sm text-gray-500 flex items-center space-x-1 mb-1">
                  <Tag className="w-3.5 h-3.5 text-teal-500" />
                  <span>品號 (Part Number)</span>
                </span>
                <div className="flex items-center space-x-2">
                  <span className="text-base font-mono font-bold text-teal-700">{item.partNo}</span>
                  <button
                    onClick={handleCopyPartNo}
                    className="p-1 text-gray-400 hover:text-gray-600 rounded bg-gray-100 transition-colors cursor-pointer"
                    title="複製品號"
                  >
                    {copiedPart ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

            </div>

            <div className="pt-2 border-t border-gray-200">
              <span className="text-sm text-gray-500 flex items-center space-x-1 mb-1">
                <FileText className="w-3.5 h-3.5 text-blue-500" />
                <span>品名規格 (Part Name)</span>
              </span>
              <p className="text-base font-medium text-gray-900">{item.name}</p>
            </div>

            {item.notes && (
              <div className="pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-500 mb-1 block">備註說明</span>
                <p className="text-sm text-gray-600 bg-white p-2.5 rounded-lg border border-gray-200">
                  {item.notes}
                </p>
              </div>
            )}
          </div>

          {/* BOM Section: If Assembly, show components; If Part, show assemblies it can form */}
          {isAssembly ? (
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-emerald-200 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="font-bold text-emerald-700 flex items-center space-x-2 text-sm">
                  <Boxes className="w-4 h-4 text-emerald-500" />
                  <span>組成該組件的所有零件 (Components)</span>
                </h3>
                <span className="text-sm text-gray-500">共 {componentsList.length} 項關聯零件</span>
              </div>

              {componentsList.length > 0 ? (
                <div className="grid gap-2">
                  {componentsList.map((rel, idx) => (
                    <button
                      key={`${rel.relatedItem.id}-${idx}`}
                      onClick={() => onSelectRelated(rel.relatedItem)}
                      className="group flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 hover:border-emerald-400 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="p-1.5 rounded-lg bg-sky-100 text-sky-600 border border-sky-200">
                          <Component className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-teal-700">{rel.relatedItem.partNo}</span>
                            <span className="text-sm text-gray-500 px-1.5 py-0.2 rounded bg-gray-100">
                              {rel.relatedItem.customer}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-sm text-emerald-600 mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-gray-400 group-hover:text-emerald-600 transition-colors flex items-center text-sm space-x-1 shrink-0 ml-2">
                        <span>查看零件</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic p-2">
                  暫無比對到明確的組成單零件，可於編輯中新增物料關聯。
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 bg-gray-50/80 rounded-2xl border border-sky-200 space-y-3">
              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                <h3 className="font-bold text-sky-700 flex items-center space-x-2 text-sm">
                  <Component className="w-4 h-4 text-sky-500" />
                  <span>本零件可組成的組件 (Assemblies using this Part)</span>
                </h3>
                <span className="text-sm text-gray-500">共 {assembliesList.length} 項可組裝目標</span>
              </div>

              {assembliesList.length > 0 ? (
                <div className="grid gap-2">
                  {assembliesList.map((rel, idx) => (
                    <button
                      key={`${rel.relatedItem.id}-${idx}`}
                      onClick={() => onSelectRelated(rel.relatedItem)}
                      className="group flex items-center justify-between p-3 bg-white hover:bg-gray-50 rounded-xl border border-gray-200 hover:border-sky-400 transition-all text-left cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        <span className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600 border border-emerald-200">
                          <Boxes className="w-3.5 h-3.5" />
                        </span>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-teal-700">{rel.relatedItem.partNo}</span>
                            <span className="text-sm text-gray-500 px-1.5 py-0.2 rounded bg-gray-100">
                              {rel.relatedItem.customer}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mt-0.5">{rel.relatedItem.name}</p>
                          <p className="text-sm text-sky-600 mt-0.5">{rel.note}</p>
                        </div>
                      </div>
                      <div className="text-gray-400 group-hover:text-sky-600 transition-colors flex items-center text-sm space-x-1 shrink-0 ml-2">
                        <span>查看組件</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic p-2">
                  目前系統中尚未比對到以此零件構成的組合配件。
                </p>
              )}
            </div>
          )}

          {/* Same Customer items */}
          {relatedSameCustomer.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-700 flex items-center space-x-1.5 text-sm">
                <User className="w-3.5 h-3.5 text-indigo-500" />
                <span>相同客戶 ({item.customer}) 的其他品號</span>
              </h3>
              <div className="grid gap-2">
                {relatedSameCustomer.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectRelated(rel)}
                    className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left cursor-pointer"
                  >
                    <span className="font-mono font-bold text-teal-700">{rel.partNo}</span>
                    <span className="text-gray-600 truncate max-w-[250px]">{rel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Same Prefix items */}
          {relatedSamePrefix.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-bold text-gray-700 flex items-center space-x-1.5 text-sm">
                <Layers className="w-3.5 h-3.5 text-emerald-500" />
                <span>相同字頭系列 ({prefix}) 的品號</span>
              </h3>
              <div className="grid gap-2">
                {relatedSamePrefix.map((rel) => (
                  <button
                    key={rel.id}
                    onClick={() => onSelectRelated(rel)}
                    className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-200 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-indigo-700 text-sm border border-gray-200">
                        {rel.customer}
                      </span>
                      <span className="font-mono font-bold text-teal-700">{rel.partNo}</span>
                    </div>
                    <span className="text-gray-600 truncate max-w-[220px]">{rel.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            關閉
          </button>
        </div>

      </div>
    </div>
  );
};
