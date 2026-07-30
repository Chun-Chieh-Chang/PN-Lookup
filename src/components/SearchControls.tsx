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
    <div className="bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 space-y-3">
      {/* Search Row */}
      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <div className="relative flex-1 max-w-lg">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => onKeywordChange(e.target.value)}
            placeholder="搜尋品號、品名或客戶..."
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          {keyword && (
            <button
              type="button"
              onClick={() => onKeywordChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Field Toggle Group */}
        <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
          {([
            { key: 'all' as const, label: '全部', tip: '同時搜尋品號、品名、客戶三個欄位' },
            { key: 'partNo' as const, label: '品號', tip: '只比對關鍵字 vs 品號欄位' },
            { key: 'name' as const, label: '品名', tip: '只比對關鍵字 vs 品名欄位' },
            { key: 'customer' as const, label: '客戶', tip: '只比對關鍵字 vs 客戶欄位' },
          ]).map(({ key, label, tip }) => (
            <button
              key={key}
              type="button"
              title={tip}
              onClick={() => onSearchFieldChange(key)}
              className={`px-3 py-2 text-sm font-medium rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                searchField === key
                  ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-700'
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
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                showAdvanced
                  ? 'bg-blue-50 border-blue-300 text-blue-600'
                  : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
              title="進階篩選與排序"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>
      </form>

      {/* Advanced Filters Panel */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm pt-1 border-t border-gray-200/60">

          {/* Sort */}
          <div className="flex items-center space-x-3">
            <span className="text-gray-500 font-medium text-sm">排序:</span>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
              {(['partNo', 'name', 'customer'] as const).map((field) => (
                <button
                  key={field}
                  onClick={() => onSortFieldChange(field)}
                  className={`px-2.5 py-1 text-sm font-medium rounded transition-all cursor-pointer ${
                    sortField === field
                      ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {field === 'partNo' ? '品號' : field === 'name' ? '品名' : '客戶'}
                </button>
              ))}
            </div>
            <button
              onClick={() => onSortOrderChange(sortOrder === 'asc' ? 'desc' : 'asc')}
              className={`px-2.5 py-1 rounded text-sm font-medium transition-colors cursor-pointer ${
                sortOrder === 'asc'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-orange-50 text-orange-700 border border-orange-200'
              }`}
            >
              {sortOrder === 'asc' ? 'A→Z ↑' : 'Z→A ↓'}
            </button>
          </div>

          {/* Customer filter badge */}
          {filterCustomer && (
            <div className="flex items-center space-x-2">
              <span className="text-gray-500 font-medium text-sm">當前篩選:</span>
              <button
                onClick={onClearCustomerFilter}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all cursor-pointer bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100`}
              >
                <span>客戶: {filterCustomer}</span>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}



        </div>
      )}

      {/* Mobile field selector (visible on small screens) */}
      <div className="flex sm:hidden items-center space-x-2">
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200">
          {([
            { key: 'all' as const, label: '全部', tip: '同時搜尋品號、品名、客戶三個欄位' },
            { key: 'partNo' as const, label: '品號', tip: '只比對關鍵字 vs 品號欄位' },
            { key: 'name' as const, label: '品名', tip: '只比對關鍵字 vs 品名欄位' },
            { key: 'customer' as const, label: '客戶', tip: '只比對關鍵字 vs 客戶欄位' },
          ]).map(({ key, label, tip }) => (
            <button
              key={key}
              title={tip}
              onClick={() => onSearchFieldChange(key)}
              className={`px-2.5 py-1 rounded text-sm transition-colors cursor-pointer ${
                searchField === key
                  ? 'bg-white text-gray-800 shadow-sm border border-gray-200'
                  : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Customer filter on mobile */}
        {filterCustomer && (
          <button
            onClick={onClearCustomerFilter}
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-sm cursor-pointer"
          >
            <span className="truncate max-w-[80px]">{filterCustomer}</span>
            <X className="w-3 h-3 shrink-0" />
          </button>
        )}
      </div>

      {/* Active filter indicators */}
      <div className="flex flex-wrap items-center gap-2 min-h-[1px]">
        {filterCustomer && (
          <span className="text-sm text-gray-500 font-medium shrink-0 flex items-center space-x-1">
            <span>已套用篩選:</span>
            <button
              onClick={onClearCustomerFilter}
              className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-sm font-mono border transition-all cursor-pointer whitespace-nowrap bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100"
            >
              <span>{filterCustomer}</span>
              <X className="w-3 h-3" />
            </button>
          </span>
        )}
      </div>

    </div>
  );
};
