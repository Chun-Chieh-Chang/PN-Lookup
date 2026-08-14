import React from 'react';
import { Package, Users, Tag, Activity } from 'lucide-react';

interface StatsBarProps {
  totalCount: number;
  filteredCount: number;
  customerCount: number;
  prefixCount: number;
}

export const StatsBar: React.FC<StatsBarProps> = ({
  totalCount,
  filteredCount,
  customerCount,
  prefixCount,
}) => {
  return (
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 pt-3 pb-1 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[13px]">
        
        {/* Metric 1: Total & Filtered Parts — 清淡柔和天藍色 */}
        <div className="bg-sky-50/50 rounded-xl border border-sky-200/80 p-2.5 sm:p-3 flex items-center space-x-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-sky-100/80 border border-sky-200 flex items-center justify-center shrink-0 text-sky-800">
            <Package className="w-4 h-4 text-sky-700" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-sky-900/70 font-medium tracking-wide">品號總數</div>
            <div className="flex items-baseline space-x-1.5 mt-0.5">
              <span className="text-base font-bold font-mono text-slate-900">{totalCount}</span>
              {filteredCount !== totalCount && (
                <span className="text-[13px] text-sky-800 font-semibold bg-white/90 px-1.5 py-0.5 rounded border border-sky-300 font-mono shadow-2xs">
                  篩選: {filteredCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Customers Count — 清淡柔和靛藍/紫藍色 */}
        <div className="bg-indigo-50/40 rounded-xl border border-indigo-200/80 p-2.5 sm:p-3 flex items-center space-x-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-indigo-100/80 border border-indigo-200 flex items-center justify-center shrink-0 text-indigo-800">
            <Users className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-indigo-900/70 font-medium tracking-wide">涵蓋客戶</div>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-base font-bold font-mono text-slate-900">{customerCount}</span>
              <span className="text-[13px] text-slate-500 font-normal">家廠商</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Prefix Categories — 清淡柔和琥珀/暖黃色 */}
        <div className="bg-amber-50/40 rounded-xl border border-amber-200/80 p-2.5 sm:p-3 flex items-center space-x-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-amber-100/80 border border-amber-200 flex items-center justify-center shrink-0 text-amber-800">
            <Tag className="w-4 h-4 text-amber-700" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-amber-900/70 font-medium tracking-wide">字頭分類</div>
            <div className="flex items-baseline space-x-1 mt-0.5">
              <span className="text-base font-bold font-mono text-slate-900">{prefixCount}</span>
              <span className="text-[13px] text-slate-500 font-normal">種類別</span>
            </div>
          </div>
        </div>

        {/* Metric 4: Real-time Status — 清淡柔和翡翠/薄荷綠色 */}
        <div className="bg-emerald-50/40 rounded-xl border border-emerald-200/80 p-2.5 sm:p-3 flex items-center space-x-3 shadow-2xs">
          <div className="w-8 h-8 rounded-lg bg-emerald-100/80 border border-emerald-200 flex items-center justify-center shrink-0 text-emerald-800">
            <Activity className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] text-emerald-900/70 font-medium tracking-wide">系統狀態</div>
            <div className="flex items-center space-x-1.5 mt-0.5 text-[13px] text-emerald-800 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
              <span>即時檢索已就緒</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
