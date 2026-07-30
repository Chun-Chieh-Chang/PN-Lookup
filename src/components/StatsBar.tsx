import React from 'react';
import { Package, Users, Tag, Clock } from 'lucide-react';

interface StatsBarProps {
  totalCount: number;
  filteredCount: number;
  customerCount: number;
  prefixCount: number;
  lastUpdated?: string;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalCount,
  filteredCount,
  customerCount,
  prefixCount,
}) => {
  return (
    <div className="bg-white border-b border-gray-200 text-gray-600 py-2.5 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between text-sm gap-y-2 gap-x-6">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <Package className="w-4 h-4 text-blue-500" />
            <span>
              資料庫總數 <strong className="text-gray-900 font-medium">{totalCount}</strong> 筆
              {filteredCount !== totalCount && (
                <span className="ml-1 text-teal-600 font-medium">
                  (符合 {filteredCount} 筆)
                </span>
              )}
            </span>
          </div>

          <div className="hidden sm:flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>
              涵蓋客戶 <strong className="text-gray-900 font-medium">{customerCount}</strong> 家
            </span>
          </div>

          <div className="hidden md:flex items-center space-x-2">
            <Tag className="w-4 h-4 text-emerald-600" />
            <span>
              品號字頭類別 <strong className="text-gray-900 font-medium">{prefixCount}</strong> 種
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 text-gray-400">
          <Clock className="w-3.5 h-3.5 text-gray-400" />
          <span>即時更新檢索</span>
        </div>
      </div>
    </div>
  );
};
