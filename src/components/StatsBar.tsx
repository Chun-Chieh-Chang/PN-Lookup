import React from 'react';
import { Package, Users, Tag, Activity } from 'lucide-react';

interface StatsBarProps {
  totalCount: number;
  filteredCount: number;
  customerCount: number;
  prefixCount: number;
}

const cardCls =
  'bg-white rounded-xl border border-slate-200 p-3 sm:p-3.5 flex items-center gap-3 shadow-sm';
const iconWrapCls =
  'w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0';
const labelCls =
  'text-[0.8125rem] text-slate-400 font-medium tracking-wide';
const valueCls =
  'text-2xl font-bold font-mono text-slate-900 leading-none';
const suffixCls = 'text-[0.8125rem] text-slate-400 font-normal';

export const StatsBar: React.FC<StatsBarProps> = ({
  totalCount,
  filteredCount,
  customerCount,
  prefixCount,
}) => {
  return (
    <div className="max-w-[128rem] mx-auto px-3 sm:px-4 lg:px-6 pt-3 pb-1 w-full">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-[0.8125rem]">

        {/* Metric 1: Total Parts — primary cobalt accent card */}
        <div className="bg-sky-50 rounded-xl border border-sky-200 p-3 sm:p-3.5 flex items-center gap-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-sky-600 flex items-center justify-center shrink-0 shadow-sm">
            <Package className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <div className="text-[0.8125rem] text-sky-700/80 font-medium tracking-wide">品號總數</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-sky-900 leading-none">{totalCount}</span>
              {filteredCount !== totalCount && (
                <span className="text-[0.8125rem] text-sky-700 font-semibold bg-white px-1.5 py-0.5 rounded border border-sky-200 font-mono">
                  篩選 {filteredCount}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Metric 2: Customers */}
        <div className={cardCls}>
          <div className={iconWrapCls}>
            <Users className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className={labelCls}>涵蓋客戶</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={valueCls}>{customerCount}</span>
              <span className={suffixCls}>家廠商</span>
            </div>
          </div>
        </div>

        {/* Metric 3: Prefix Categories */}
        <div className={cardCls}>
          <div className={iconWrapCls}>
            <Tag className="w-4.5 h-4.5 text-slate-500" />
          </div>
          <div className="min-w-0">
            <div className={labelCls}>字頭分類</div>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className={valueCls}>{prefixCount}</span>
              <span className={suffixCls}>種類別</span>
            </div>
          </div>
        </div>

        {/* Metric 4: System Status */}
        <div className={cardCls}>
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
            <Activity className="w-4.5 h-4.5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className={labelCls}>系統狀態</div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-[0.8125rem] text-emerald-700 font-semibold">即時檢索已就緒</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
