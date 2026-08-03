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
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 pt-4 pb-2 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px]">
        
        {/* Metric 1: Total & Filtered Parts */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 flex items-center space-x-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider">品號總數</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-base font-extrabold font-mono text-slate-900">{totalCount}</span>
              {filteredCount !== totalCount && (
                <span className="text-[13px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200/60 font-mono">
                  篩選: {filteredCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Customers Count */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 flex items-center space-x-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider">涵蓋客戶</div>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-base font-extrabold font-mono text-slate-900">{customerCount}</span>
              <span className="text-[13px] text-slate-400 font-medium">家廠商</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Prefix Categories */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 flex items-center space-x-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Tag className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider">字頭分類</div>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-base font-extrabold font-mono text-slate-900">{prefixCount}</span>
              <span className="text-[13px] text-slate-400 font-medium">種料號類別</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Real-time Status */}
        <div className="bg-white/80 backdrop-blur-md rounded-2xl border border-slate-200/80 p-3 flex items-center space-x-3 shadow-2xs hover:shadow-xs transition-all">
          <div className="w-8 h-8 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-slate-500 font-semibold uppercase tracking-wider">系統狀態</div>
            <div className="flex items-center space-x-1.5 mt-0.5 text-[13px] text-emerald-700 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>即時檢索已就緒</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
