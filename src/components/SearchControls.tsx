import React, { useState } from 'react';
import {
  Search,
  X,
  SlidersHorizontal,
} from 'lucide-react';

interface SearchControlsProps {
  keyword: string;
  onKeywordChange: (kw: string) => void;
  searchField: 'all' | 'partNo' | 'name' | 'customer';
  onSearchFieldChange: (field: 'all' | 'partNo' | 'name' | 'customer') => void;
  sortField: string;
  onSortFieldChange: (field: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderChange: (order: 'asc' | 'desc') => void;
  filterCustomer: string | null;
  onClearCustomerFilter: () => void;
}

export const SearchControls: React.FC<SearchControlsProps> = ({
  keyword,
  onKeywordChange,
  searchField,
  onSearchFieldChange,
  sortField,
  onSortFieldChange,
  sortOrder,
  onSortOrderChange,
  filterCustomer,
  onClearCustomerFilter,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

  return (
    <div className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Search Row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜尋品號 (如 A02-410-111)、品名或客戶名稱..."
            className="w-full pl-10 pr-9 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-2xs font-sans"
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

        {/* Search Field Toggle Group */}
        <div className="hidden sm:flex items-center bg-slate-100/90 rounded-xl p-1 border border-slate-200/80">
          {([
            { key: 'all' as const, label: '全域', tip: '同時搜尋品號、品名、客戶三個欄位' },
            { key: 'partNo' as const, label: '品號', tip: '只比對關鍵字 vs 品號與替代品號' },
            { key: 'name' as const, label: '品名', tip: '只比對關鍵字 vs 品名欄位' },
            { key: 'customer' as const, label: '客戶', tip: '只比對關鍵字 vs 客戶欄位' },
          ]).map(({ key, label, tip }) => (
            <button
              key={key}
              type="button"
              title={tip}
              onClick={() => onSearchFieldChange(key)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center space-x-1 cursor-pointer ${
                searchField === key
                  ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/90 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Advanced Toggle */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className={`p-2 rounded-xl border transition-all cursor-pointer ${
              showAdvanced
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
            title="進階排序與篩選"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2.5 border-t border-slate-200/60 transition-all">

          {/* Sort */}
          <div className="flex items-center space-x-3">
            <span className="text-slate-500 font-semibold text-xs">依序排列:</span>
            <div className="flex items-center bg-slate-100/90 rounded-lg p-1 border border-slate-200/80">
              {(['partNo', 'name', 'customer'] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => onSortFieldChange(field)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-all cursor-pointer ${
                    sortField === field
                      ? 'bg-white text-indigo-700 shadow-xs border border-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {field === 'partNo' ? '品號' : field === 'name' ? '品名' : '客戶'}
                </button>
              ))}
            </div>
            <button
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                sortOrder === 'asc'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
              }`}
            >
              {sortOrder === 'asc' ? '正序 A➔Z ↑' : '倒序 Z➔A ↓'}
            </button>
          </div>

          {/* Customer filter badge */}
          {filterCustomer && (
            <div className="flex items-center space-x-2">
              <span className="text-slate-500 font-semibold text-xs">鎖定客戶:</span>
              <button
                onClick={onClearCustomerFilter}
                className="flex items-center space-x-1.5 px-3 py-1 rounded-lg border text-xs font-bold transition-all cursor-pointer bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 shadow-xs"
              >
                <span>{filterCustomer}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>
      )}

      {/* Mobile field selector */}
      <div className="flex sm:hidden items-center space-x-2">
        <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
          {([
            { key: 'all' as const, label: '全域' },
            { key: 'partNo' as const, label: '品號' },
            { key: 'name' as const, label: '品名' },
            { key: 'customer' as const, label: '客戶' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => onSearchFieldChange(key)}
              className={`px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
                searchField === key
                  ? 'bg-white text-indigo-700 font-bold shadow-xs'
                  : 'text-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {filterCustomer && (
          <button
            onClick={onClearCustomerFilter}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer"
          >
            <span className="truncate max-w-[80px]">{filterCustomer}</span>
            <X className="w-3 h-3 shrink-0" />
          </button>
        )}
      </div>

    </div>
  );
};
