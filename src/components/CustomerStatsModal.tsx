import React, { useState } from 'react';
import { X, Users, Search, ChevronRight, Layers } from 'lucide-react';
import { PartItem } from '../types';

interface CustomerStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allParts: PartItem[];
  onSelectCustomer: (customerName: string) => void;
}

export const CustomerStatsModal: React.FC<CustomerStatsModalProps> = ({
  isOpen,
  onClose,
  allParts,
  onSelectCustomer,
}) => {
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  // Group items by customer
  const customerMap: { [key: string]: PartItem[] } = {};
  allParts.forEach((item) => {
    if (!customerMap[item.customer]) {
      customerMap[item.customer] = [];
    }
    customerMap[item.customer].push(item);
  });

  const sortedCustomers = Object.keys(customerMap)
    .map((customer) => ({
      name: customer,
      count: customerMap[customer].length,
      sampleParts: customerMap[customer].slice(0, 3).map((i) => i.partNo),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const filtered = sortedCustomers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-xl text-gray-900 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-100 text-indigo-600 border border-indigo-200">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">客戶別品號分佈統計</h2>
              <p className="text-sm text-gray-500">
                共 {sortedCustomers.length} 家客戶，點擊客戶可立即篩選其所有品號
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter input */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋客戶名稱..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Customer List */}
        <div className="p-4 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 text-sm">
          {filtered.map((c) => (
            <button
              key={c.name}
              onClick={() => {
                onSelectCustomer(c.name);
                onClose();
              }}
              className="flex items-start justify-between p-3.5 bg-white hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-xl text-left transition-all group cursor-pointer"
            >
              <div className="space-y-1.5 pr-2">
                <div className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors flex items-center space-x-2">
                  <span>{c.name}</span>
                </div>
                <div className="text-sm text-gray-400 font-mono truncate max-w-[200px]">
                  主要品號: {c.sampleParts.join(', ')}...
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <span className="px-2.5 py-1 rounded-full bg-gray-100 text-indigo-700 font-mono font-bold text-sm border border-gray-200">
                  {c.count} 項
                </span>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-2 py-12 text-center text-gray-400">
              沒有找到相符的客戶名稱
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
