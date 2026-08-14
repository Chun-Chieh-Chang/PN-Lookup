import React from 'react';
import {
  Search,
  X,
} from 'lucide-react';

interface SearchControlsProps {
  keyword: string;
  onKeywordChange: (kw: string) => void;
  searchField: 'all' | 'partNo' | 'name' | 'customer';
  onSearchFieldChange: (field: 'all' | 'partNo' | 'name' | 'customer') => void;
  filterCustomer: string | null;
  onClearCustomerFilter: () => void;
}

export const SearchControls: React.FC<SearchControlsProps> = ({
  keyword,
  onKeywordChange,
  searchField,
  onSearchFieldChange,
  filterCustomer,
  onClearCustomerFilter,
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
  };

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

          {/* Customer Lock Tag */}
          {filterCustomer && (
            <div className="flex items-center space-x-1.5 bg-slate-100 border border-slate-300 text-slate-800 px-3 py-1.5 rounded-lg text-sm font-semibold shadow-2xs">
              <span>鎖定客戶: {filterCustomer}</span>
              <button
                onClick={onClearCustomerFilter}
                className="p-0.5 hover:bg-slate-200 rounded text-slate-600 transition-colors cursor-pointer"
                title="清除客戶鎖定"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
