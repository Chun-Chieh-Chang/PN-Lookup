import React from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import type { SearchField } from '../types';

interface SearchControlsProps {
  keyword: string;
  onKeywordChange: (kw: string) => void;
  searchField: SearchField;
  onSearchFieldChange: (field: SearchField) => void;
  filterCustomer: string | null;
  onClearCustomerFilter: () => void;
  customers: string[];
  categories: string[];
  partNoFilter: string;
  onPartNoFilterChange: (v: string) => void;
  nameFilter: string;
  onNameFilterChange: (v: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (v: string) => void;
  onSelectCustomer: (c: string) => void;
  onClearFilters: () => void;
}

const labelCls = 'text-[13px] font-semibold text-slate-500 shrink-0';
const inputCls =
  'bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 transition-all shadow-2xs font-sans font-medium';

export const SearchControls: React.FC<SearchControlsProps> = ({
  keyword,
  onKeywordChange,
  searchField,
  onSearchFieldChange,
  filterCustomer,
  onClearCustomerFilter,
  customers,
  categories,
  partNoFilter,
  onPartNoFilterChange,
  nameFilter,
  onNameFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  onSelectCustomer,
  onClearFilters,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const hasFieldFilters =
    filterCustomer !== null ||
    partNoFilter.trim() !== '' ||
    nameFilter.trim() !== '' ||
    categoryFilter !== '';

  return (
    <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 py-2 w-full">
      <div className="bg-white rounded-xl border border-slate-200/90 p-2.5 sm:p-3 shadow-2xs">
        {/* Main Search Row */}
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => onKeywordChange(e.target.value)}
              placeholder="搜尋品號 (如 A02-410-111)、品名或客戶名稱..."
              className="w-full pl-10 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:bg-white focus:ring-2 focus:ring-sky-500/15 transition-all shadow-2xs font-sans font-medium"
              autoFocus
            />
            {keyword && (
              <button
                type="button"
                onClick={() => onKeywordChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Search Field Filter Group */}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200/90">
            {([
              { key: 'all' as const, label: '全域' },
              { key: 'partNo' as const, label: '品號' },
              { key: 'name' as const, label: '品名' },
              { key: 'customer' as const, label: '客戶' },
            ]).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSearchFieldChange(key)}
                className={`px-3 py-1.5 text-sm rounded-md transition-all flex items-center cursor-pointer ${
                  searchField === key
                    ? 'bg-white text-slate-900 shadow-2xs border border-slate-200 font-bold'
                    : 'text-slate-600 hover:text-slate-900 font-medium'
                }`}
              >
                <span>{label}</span>
              </button>
            ))}
          </div>
        </form>

        {/* Field Filter Row (v7.8.13)：客戶名稱 / 品號 / 物料類別 / 品名規格 */}
        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
            <span className={`${labelCls} text-slate-400`}>欄位篩選</span>
          </div>

          {/* 客戶名稱 */}
          <label className="flex items-center gap-1.5">
            <span className={labelCls}>客戶名稱</span>
            <select
              value={filterCustomer ?? ''}
              onChange={(e) => {
                const v = e.target.value;
                if (v) onSelectCustomer(v);
                else onClearCustomerFilter();
              }}
              className={`${inputCls} py-2 px-3 min-w-[130px] cursor-pointer`}
            >
              <option value="">全部客戶</option>
              {customers.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          {/* 品號 (Part No) */}
          <label className="flex items-center gap-1.5">
            <span className={labelCls}>品號 (Part No)</span>
            <input
              type="text"
              value={partNoFilter}
              onChange={(e) => onPartNoFilterChange(e.target.value)}
              placeholder="篩選品號..."
              className={`${inputCls} py-2 px-3 w-44`}
            />
          </label>

          {/* 物料類別 */}
          <label className="flex items-center gap-1.5">
            <span className={labelCls}>物料類別</span>
            <select
              value={categoryFilter}
              onChange={(e) => onCategoryFilterChange(e.target.value)}
              className={`${inputCls} py-2 px-3 min-w-[130px] cursor-pointer`}
            >
              <option value="">全部類別</option>
              {[
                { label: '物料', match: (c: string) => c === '物料' },
                { label: '零件', match: (c: string) => c === '零件' },
                { label: '原料', match: (c: string) => c === '原料' },
                { label: 'SET', match: (c: string) => c === 'SET' },
                { label: '組件', match: (c: string) => c.endsWith('組立') || c === '其他組件' },
              ].map((g) => {
                const groupCats = categories.filter(g.match);
                return groupCats.length > 0 && (
                  <optgroup key={g.label} label={g.label}>
                    {groupCats.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </optgroup>
                );
              })}
              {categories.filter((c) => !['物料', '零件', '原料', 'SET'].includes(c) && !c.endsWith('組立') && c !== '其他組件')
                .map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
            </select>
          </label>

          {/* 品名規格 (Part Name) */}
          <label className="flex items-center gap-1.5">
            <span className={labelCls}>品名規格 (Part Name)</span>
            <input
              type="text"
              value={nameFilter}
              onChange={(e) => onNameFilterChange(e.target.value)}
              placeholder="篩選品名..."
              className={`${inputCls} py-2 px-3 w-48`}
            />
          </label>

          {hasFieldFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 text-[13px] text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors font-medium cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              清除篩選
            </button>
          )}
        </div>
      </div>
    </div>
  );
};