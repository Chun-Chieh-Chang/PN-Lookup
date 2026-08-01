import React, { useState, useEffect } from 'react';
import { X, PlusCircle, Edit3, Check } from 'lucide-react';
import { PartItem } from '../types';
import { parseAlternates } from '../utils/alternates';

interface AddEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: Omit<PartItem, 'id'> & { id?: string }) => void;
  initialItem?: PartItem | null;
  existingCustomers: string[];
}

export const AddEditModal: React.FC<AddEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialItem,
  existingCustomers,
}) => {
  const [customer, setCustomer] = useState('');
  const [partNo, setPartNo] = useState('');
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [alternatesText, setAlternatesText] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (initialItem) {
      setCustomer(initialItem.customer || '');
      setPartNo(initialItem.partNo || '');
      setName(initialItem.name || '');
      setNotes(initialItem.notes || '');
      setAlternatesText((initialItem.alternates ?? []).join('、'));
    } else {
      setCustomer('');
      setPartNo('');
      setName('');
      setNotes('');
      setAlternatesText('');
    }
    setErrors({});
  }, [initialItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};
    if (!customer.trim()) newErrors.customer = '請填寫客戶名稱';
    if (!partNo.trim()) newErrors.partNo = '請填寫品號';
    if (!name.trim()) newErrors.name = '請填寫品名規格';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave({
      id: initialItem?.id,
      customer: customer.trim(),
      partNo: partNo.trim(),
      name: name.trim(),
      notes: notes.trim(),
      alternates: parseAlternates(alternatesText, partNo.trim()),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white border border-gray-200 rounded-2xl max-w-lg w-full flex flex-col shadow-xl text-gray-900 my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-blue-100 text-blue-600 border border-blue-200">
              {initialItem ? <Edit3 className="w-5 h-5" /> : <PlusCircle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 font-sans">
                {initialItem ? '修訂品號資料' : '新增品號資料'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">修訂既有醫療配件品號屬性、備註與對照別名</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          
          {/* Customer */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-700">
              客戶名稱 (Customer) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              list="customer-suggestions"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              placeholder="請輸入客戶名稱或由選單選擇"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
            />
            <datalist id="customer-suggestions">
              {existingCustomers.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            {errors.customer && <p className="text-rose-500 text-sm">{errors.customer}</p>}
          </div>

          {/* Part Number */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-700">
              品號 (Part Number) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={partNo}
              onChange={(e) => setPartNo(e.target.value)}
              placeholder="例如: C09-240-211"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 font-mono focus:outline-none focus:border-blue-500"
            />
            {errors.partNo && <p className="text-rose-500 text-sm">{errors.partNo}</p>}
          </div>

          {/* Part Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-700">
              品名規格 (Part Name / Description) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如: 公轉式針基"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
            />
            {errors.name && <p className="text-rose-500 text-sm">{errors.name}</p>}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-700">備註說明 (簡短說明或規範)</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="選擇性填寫特別材質或組裝要求..."
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Alternates */}
          <div className="space-y-1.5">
            <label className="font-semibold text-gray-700">替代品號 (可互相替代的品號)</label>
            <input
              type="text"
              value={alternatesText}
              onChange={(e) => setAlternatesText(e.target.value)}
              placeholder="以逗號或空格分隔，例如: D09-410-111-1、3M55567"
              className="w-full px-3 py-2.5 bg-white border border-gray-300 rounded-xl text-gray-900 font-mono focus:outline-none focus:border-blue-500"
            />
            <p className="text-xs text-gray-400">
              輸入後圖檔比對與搜尋都會一併查詢這些品號（例如 3M55567 的圖檔以 D09-410-111-1 命名也能找到）
            </p>
          </div>

          {/* Buttons */}
          <div className="pt-4 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors cursor-pointer"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-blue-600/30"
            >
              <Check className="w-4 h-4" />
              <span>儲存變更</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
