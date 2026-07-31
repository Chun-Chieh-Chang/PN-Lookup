import React, { useState, useRef } from 'react';
import { X, Save, Plus, Trash2, Search, ArrowLeft, PackagePlus, Users, PenLine, Download, Upload, Building2, DatabaseBackup } from 'lucide-react';
import { PartItem } from '../types';
import { getBOMChildren, getBOMParents, updateBOMData } from '../utils/bomEngine';
import { saveBOM } from '../utils/bomService';

interface AdminPanelProps {
  parts: PartItem[];
  serverOnline: boolean;
  onClose: () => void;
  onAddPart: (itemData: Omit<PartItem, 'id'>) => void;
  onDeletePart: (id: string) => void;
  onRenameCustomer: (oldName: string, newName: string) => void;
  onDeleteCustomer: (customerName: string) => void;
  onImportParts: (items: PartItem[], replace: boolean) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ parts, serverOnline, onClose, onAddPart, onDeletePart, onRenameCustomer, onDeleteCustomer, onImportParts }) => {
  const [children, setChildren] = useState<Record<string, string[]>>(() => ({ ...getBOMChildren() }));
  const [parents, setParents] = useState<Record<string, string[]>>(() => ({ ...getBOMParents() }));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addKey, setAddKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [newPart, setNewPart] = useState({ customer: '', partNo: '', name: '', notes: '' });
  const [addPartMsg, setAddPartMsg] = useState('');
  const [newCustomer, setNewCustomer] = useState({ customer: '', partNo: '', name: '', notes: '' });
  const [addCustMsg, setAddCustMsg] = useState('');
  const [customerPartQuery, setCustomerPartQuery] = useState('');
  const [showCustomerPartSuggestions, setShowCustomerPartSuggestions] = useState(false);

  const customerPartSuggestions = customerPartQuery.length >= 1
    ? parts.filter(p =>
        p.partNo.toLowerCase().includes(customerPartQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(customerPartQuery.toLowerCase())
      ).slice(0, 10)
    : [];
  const [partSearch, setPartSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [renamingCustomer, setRenamingCustomer] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const bomFileRef = useRef<HTMLInputElement>(null);
  const fullBackupFileRef = useRef<HTMLInputElement>(null);

  const existingCustomers: string[] = Array.from(new Set<string>(parts.map(p => p.customer))).sort();

  const partSearchResults = partSearch.length >= 1
    ? parts.filter(p => p.partNo.toLowerCase().includes(partSearch.toLowerCase()) || p.name.toLowerCase().includes(partSearch.toLowerCase())).slice(0, 20)
    : [];

  const customerGroups = existingCustomers
    .filter(c => c.toLowerCase().includes(customerFilter.toLowerCase()))
    .map(c => ({
      name: c,
      count: parts.filter(p => p.customer === c).length,
      samples: parts.filter(p => p.customer === c).slice(0, 3).map(p => p.partNo),
    }));

  const handleAddPartSubmit = () => {
    if (!newPart.customer.trim() || !newPart.partNo.trim() || !newPart.name.trim()) {
      setAddPartMsg('客戶、品號、品名皆為必填欄位');
      return;
    }
    onAddPart({
      customer: newPart.customer.trim(),
      partNo: newPart.partNo.trim(),
      name: newPart.name.trim(),
      notes: newPart.notes.trim() || undefined,
    });
    setAddPartMsg('品號已新增成功');
    setNewPart({ customer: '', partNo: '', name: '', notes: '' });
  };

  const handleAddCustomerSubmit = () => {
    const customer = newCustomer.customer.trim();
    const partNo = newCustomer.partNo.trim();
    if (!customer || !partNo) {
      setAddCustMsg('客戶名稱與品號皆為必填欄位');
      return;
    }
    if (existingCustomers.includes(customer)) {
      setAddCustMsg(`客戶「${customer}」已存在，請直接使用「新增品號」`);
      return;
    }
    const existingPart = parts.find(p => p.partNo === partNo);
    const name = newCustomer.name.trim() || existingPart?.name || '';
    if (!name) {
      setAddCustMsg('品名為必填欄位（或請從既有品號清單選取，品名會自動帶入）');
      return;
    }
    onAddPart({
      customer,
      partNo,
      name,
      notes: newCustomer.notes.trim() || undefined,
    });
    setAddCustMsg(`客戶「${customer}」已新增，品號 ${partNo}（${name}）歸屬於該客戶`);
    setNewCustomer({ customer: '', partNo: '', name: '', notes: '' });
  };

  const searchResults = searchQuery.length >= 2
    ? parts.filter(p => p.partNo.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : [];

  const assemblyKeys = Object.keys(children).sort();

  const handleRemoveComponent = (assemblyKey: string, componentIdx: number) => {
    setChildren(prev => {
      const next = { ...prev };
      const comps = [...(next[assemblyKey] || [])];
      comps.splice(componentIdx, 1);
      if (comps.length === 0) {
        delete next[assemblyKey];
      } else {
        next[assemblyKey] = comps;
      }
      return next;
    });
    setParents(computeParents({ ...children, [assemblyKey]: (children[assemblyKey] || []).filter((_, i) => i !== componentIdx) }));
  };

  const handleAddComponent = (assemblyKey: string, partNo: string) => {
    if (!partNo.trim()) return;
    setChildren(prev => {
      const next = { ...prev };
      const comps = [...(next[assemblyKey] || [])];
      if (!comps.includes(partNo.trim())) {
        comps.push(partNo.trim());
      }
      next[assemblyKey] = comps;
      return next;
    });
    setEditingKey(null);
    setSearchQuery('');
    setParents(computeParents({ ...children, [assemblyKey]: [...(children[assemblyKey] || []), partNo.trim()] }));
  };

  const handleAddAssembly = () => {
    if (!addKey.trim() || children[addKey.trim()]) return;
    const key = addKey.trim();
    setChildren(prev => ({ ...prev, [key]: [] }));
    setAddKey('');
  };

  const handleRemoveAssembly = (key: string) => {
    setChildren(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage('');
    try {
      if (!serverOnline) {
        handleExportBOM();
        setMessage('無法連線伺服器，已改為下載 BOM 備份檔（回到本機伺服器後可「匯入」還原）');
        setSaving(false);
        return;
      }
      const newParents = computeParents(children);
      await saveBOM(children, newParents);
      updateBOMData(children, newParents);
      setParents(newParents);
      setMessage('BOM 資料已儲存至伺服器');
    } catch {
      setMessage('儲存失敗，請確認伺服器執行中');
    }
    setSaving(false);
  };

  const handleExportBOM = () => {
    const payload = {
      children,
      parents: computeParents(children),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BOM_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBOMFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const raw = data?.children ?? data;
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid');
        const newChildren: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(raw)) {
          if (!Array.isArray(val)) throw new Error('invalid');
          newChildren[key] = val.map(String);
        }
        const newParents = computeParents(newChildren);
        setChildren(newChildren);
        setParents(newParents);
        setMessage(`匯入成功：${Object.keys(newChildren).length} 個組立，請確認後再儲存至伺服器`);
      } catch {
        setMessage('匯入失敗：檔案格式不正確（需為 BOM 備份 JSON）');
      }
    };
    reader.readAsText(file);
  };

  const handleExportFullBackup = () => {
    const payload = {
      type: 'pn-lookup-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      parts,
      bom: { children, parents: computeParents(children) },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `完整備份_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.type !== 'pn-lookup-backup' || !Array.isArray(data.parts)) {
          throw new Error('invalid');
        }
        const rawChildren = data.bom?.children ?? {};
        if (!rawChildren || typeof rawChildren !== 'object' || Array.isArray(rawChildren)) {
          throw new Error('invalid');
        }
        const newChildren: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(rawChildren)) {
          if (!Array.isArray(val)) throw new Error('invalid');
          newChildren[key] = val.map(String);
        }
        onImportParts(data.parts, true);
        const newParents = computeParents(newChildren);
        setChildren(newChildren);
        setParents(newParents);
        if (serverOnline) {
          saveBOM(newChildren, newParents).then(() => {
            updateBOMData(newChildren, newParents);
            setMessage(`完整備份已還原並同步至伺服器：${data.parts.length} 筆品號、${Object.keys(newChildren).length} 個組立`);
          }).catch(() => {
            updateBOMData(newChildren, newParents);
            setMessage('完整備份已還原至本機（伺服器同步失敗，請稍後手動儲存 BOM）');
          });
        } else {
          updateBOMData(newChildren, newParents);
          setMessage(`完整備份已還原至本機：${data.parts.length} 筆品號、${Object.keys(newChildren).length} 個組立（離線模式，未同步伺服器）`);
        }
      } catch {
        setMessage('匯入失敗：檔案格式不正確（需為完整備份 JSON）');
      }
    };
    reader.readAsText(file);
  };

  const prefixGroups = ['SA', 'SB', 'SC', 'SD'];
  const groupedKeys = prefixGroups.map(p => ({
    prefix: p,
    keys: assemblyKeys.filter(k => k.startsWith(p)),
  }));

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer" title="返回主畫面">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">後台管理 — BOM 階層維護</h1>
        </div>
        <div className="flex items-center space-x-2">
          {message && (
            <span className={`text-sm ${message.includes('失敗') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? '儲存中...' : '儲存至伺服器'}</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
        {!serverOnline && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm leading-relaxed">
            目前無法連接後端伺服器（靜態託管如 GitHub Pages，或伺服器未啟動）：BOM 與品號變更不會寫入伺服器，
            品號資料僅保存在此瀏覽器（localStorage）。請使用「匯出 BOM 備份檔」保存資料；
            完整功能請於本機執行 <code className="font-mono bg-amber-100 px-1 rounded">npm run serve</code>。
          </div>
        )}

        {/* Add New Assembly */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">新增組立編號</h2>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={addKey}
              onChange={e => setAddKey(e.target.value.toUpperCase())}
              placeholder="輸入組立編號 (如 SA9999)"
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              onKeyDown={e => { if (e.key === 'Enter') handleAddAssembly(); }}
            />
            <button
              onClick={handleAddAssembly}
              disabled={!addKey.trim()}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 font-medium rounded-lg flex items-center space-x-1 border border-gray-200 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增</span>
            </button>
          </div>
        </div>

        {/* BOM Backup — Export / Import */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3">BOM 資料備份（JSON 檔）</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportBOM}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg flex items-center space-x-1.5 border border-gray-200 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>匯出 BOM 備份檔</span>
            </button>
            <input
              ref={bomFileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImportBOMFile(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => bomFileRef.current?.click()}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg flex items-center space-x-1.5 border border-gray-200 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>匯入 BOM 備份檔</span>
            </button>
            <span className="text-xs text-gray-400">
              匯入後先載入於頁面供確認，點「儲存至伺服器」才會正式寫入
            </span>
          </div>
        </div>

        {/* Full Backup — Parts + BOM */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
            <DatabaseBackup className="w-4 h-4 text-emerald-500" />
            <span>完整資料備份（品號 + BOM 一次打包）</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportFullBackup}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg flex items-center space-x-1.5 border border-emerald-200 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>匯出完整備份</span>
            </button>
            <input
              ref={fullBackupFileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handleImportFullBackup(f);
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fullBackupFileRef.current?.click()}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg flex items-center space-x-1.5 border border-emerald-200 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>匯入完整備份</span>
            </button>
            <span className="text-xs text-gray-400">
              匯入會以備份內容覆蓋目前的品號與 BOM 資料（品號僅還原於此瀏覽器，伺服器連線正常時同步）
            </span>
          </div>
        </div>

        {/* Add New Customer (existing or new part) */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
            <Building2 className="w-4 h-4 text-indigo-500" />
            <span>新增客戶（既有產品賣給新客戶）</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">客戶名稱 *</label>
              <input
                type="text"
                value={newCustomer.customer}
                onChange={e => setNewCustomer(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="客戶名稱"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="relative">
              <label className="block text-sm text-gray-500 mb-1">品號 *（可搜尋既有品號）</label>
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-[34px]" />
              <input
                type="text"
                value={newCustomer.partNo}
                onChange={e => {
                  setNewCustomer(prev => ({ ...prev, partNo: e.target.value.toUpperCase() }));
                  setCustomerPartQuery(e.target.value);
                  setShowCustomerPartSuggestions(true);
                }}
                onFocus={() => setShowCustomerPartSuggestions(true)}
                onBlur={() => setTimeout(() => setShowCustomerPartSuggestions(false), 150)}
                placeholder="輸入或搜尋既有品號"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              {showCustomerPartSuggestions && customerPartSuggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                  {customerPartSuggestions.map(p => (
                    <button
                      key={p.id}
                      onMouseDown={() => {
                        setNewCustomer(prev => ({ ...prev, partNo: p.partNo, name: p.name }));
                        setCustomerPartQuery('');
                        setShowCustomerPartSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center justify-between space-x-2 cursor-pointer"
                    >
                      <span className="font-mono text-blue-700 shrink-0">{p.partNo}</span>
                      <span className="text-gray-500 truncate">{p.name}</span>
                      <span className="text-gray-400 text-xs shrink-0">{p.customer}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">品名 *</label>
              <input
                type="text"
                value={newCustomer.name}
                onChange={e => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                onBlur={() => {
                  const match = parts.find(p => p.partNo === newCustomer.partNo.trim());
                  if (match && !newCustomer.name.trim()) {
                    setNewCustomer(prev => ({ ...prev, name: match.name }));
                  }
                }}
                placeholder="品名規格（選取既有品號自動帶入）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">備註</label>
              <input
                type="text"
                value={newCustomer.notes}
                onChange={e => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="備註（選填）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-3">
            <button
              onClick={handleAddCustomerSubmit}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增客戶</span>
            </button>
            {addCustMsg && (
              <span className={`text-sm ${addCustMsg.includes('成功') || addCustMsg.includes('已新增') ? 'text-emerald-600' : 'text-red-600'}`}>{addCustMsg}</span>
            )}
          </div>
        </div>

        {/* Add New Part */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
            <PackagePlus className="w-4 h-4 text-blue-500" />
            <span>新增品號</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-500 mb-1">客戶 *</label>
              <input
                type="text"
                list="admin-customers"
                value={newPart.customer}
                onChange={e => setNewPart(prev => ({ ...prev, customer: e.target.value }))}
                placeholder="客戶名稱"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
              <datalist id="admin-customers">
                {existingCustomers.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">品號 *</label>
              <input
                type="text"
                value={newPart.partNo}
                onChange={e => setNewPart(prev => ({ ...prev, partNo: e.target.value }))}
                placeholder="品號 (如 A02-410-111)"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">品名 *</label>
              <input
                type="text"
                value={newPart.name}
                onChange={e => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                placeholder="品名規格"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">備註</label>
              <input
                type="text"
                value={newPart.notes}
                onChange={e => setNewPart(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="備註（選填）"
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-3">
            <button
              onClick={handleAddPartSubmit}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>新增品號</span>
            </button>
            {addPartMsg && (
              <span className={`text-sm ${addPartMsg.includes('成功') ? 'text-emerald-600' : 'text-red-600'}`}>{addPartMsg}</span>
            )}
          </div>
        </div>

        {/* BOM Groups */}
        {groupedKeys.map(({ prefix, keys: groupKeys }) => (
          <div key={prefix} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2.5 bg-gray-100 border-b border-gray-200 font-bold text-gray-700 text-sm">
              {prefix} 組立 ({groupKeys.length} 筆)
            </div>
            {groupKeys.length === 0 ? (
              <div className="p-4 text-sm text-gray-400">無 {prefix} 資料</div>
            ) : (
              <div className="divide-y divide-gray-100 text-sm">
                {groupKeys.map(key => {
                  const partName = parts.find(p => p.partNo === key)?.name || key;
                  const comps = children[key] || [];
                  return (
                    <div key={key} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center space-x-2">
                          <button onClick={() => handleRemoveAssembly(key)} className="p-0.5 text-gray-300 hover:text-red-500 cursor-pointer" title="刪除組立">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-blue-700">{key}</span>
                          <span className="text-gray-500 truncate max-w-xs">{partName}</span>
                          <span className="text-gray-400 text-xs">({comps.length} 個零件)</span>
                        </div>
                        <button
                          onClick={() => setEditingKey(editingKey === key ? null : key)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded hover:bg-blue-100 cursor-pointer"
                        >
                          {editingKey === key ? '取消' : '編輯零件'}
                        </button>
                      </div>

                      {/* Component List */}
                      {comps.length > 0 && (
                        <div className="ml-6 space-y-1">
                          {comps.map((comp, ci) => {
                            const compName = parts.find(p => p.partNo === comp)?.name || comp;
                            return (
                              <div key={ci} className="flex items-center justify-between py-0.5 px-2 rounded hover:bg-gray-100 group">
                                <div className="flex items-center space-x-2">
                                  <span className="text-gray-400 text-xs">{ci + 1}.</span>
                                  <span className="font-mono text-gray-700">{comp}</span>
                                  <span className="text-gray-400 truncate max-w-[200px]">{compName !== comp ? compName : ''}</span>
                                </div>
                                <button
                                  onClick={() => handleRemoveComponent(key, ci)}
                                  className="p-0.5 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                  title="移除零件"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Add Component Input */}
                      {editingKey === key && (
                        <div className="ml-6 mt-2 relative">
                          <div className="flex items-center space-x-2">
                            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="搜尋品號加入..."
                              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
                              autoFocus
                            />
                          </div>
                          {searchResults.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                              {searchResults.map(p => (
                                <button
                                  key={p.partNo}
                                  onClick={() => handleAddComponent(key, p.partNo)}
                                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 flex items-center space-x-2 cursor-pointer"
                                >
                                  <Plus className="w-3 h-3 text-emerald-500 shrink-0" />
                                  <span className="font-mono text-blue-700">{p.partNo}</span>
                                  <span className="text-gray-500 truncate">{p.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Part Management — Search & Delete */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
            <Trash2 className="w-4 h-4 text-rose-500" />
            <span>品號管理（搜尋刪除）</span>
          </h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={partSearch}
              onChange={e => setPartSearch(e.target.value)}
              placeholder="搜尋品號或品名..."
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          {partSearch && (
            <div className="mt-3 space-y-1">
              {partSearchResults.length === 0 && (
                <p className="text-sm text-gray-400 py-2">查無符合條件的品號</p>
              )}
              {partSearchResults.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-gray-100 group">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="font-mono text-blue-700">{p.partNo}</span>
                    <span className="text-gray-500 truncate">{p.name}</span>
                    <span className="text-gray-400 text-xs truncate">{p.customer}</span>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`確定要刪除品號 ${p.partNo} (${p.name}) 嗎？`)) {
                        onDeletePart(p.id);
                      }
                    }}
                    className="p-1 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="刪除品號"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Customer Management */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>客戶管理（{existingCustomers.length} 家客戶）</span>
          </h2>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              placeholder="篩選客戶名稱..."
              className="w-full pl-8 pr-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-1.5">
            {customerGroups.map(c => (
              <div key={c.name} className="py-2 px-2 rounded hover:bg-gray-100">
                {renamingCustomer === c.name ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      placeholder="新客戶名稱"
                      className="flex-1 px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (renameValue.trim() && renameValue.trim() !== c.name) {
                          onRenameCustomer(c.name, renameValue.trim());
                        }
                        setRenamingCustomer(null);
                      }}
                      className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-md cursor-pointer"
                    >
                      確認
                    </button>
                    <button
                      onClick={() => setRenamingCustomer(null)}
                      className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-md border border-gray-200 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-medium text-gray-800">{c.name}</span>
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200">{c.count} 筆</span>
                      <span className="text-gray-400 text-xs font-mono truncate hidden sm:inline">{c.samples.join(', ')}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => { setRenamingCustomer(c.name); setRenameValue(c.name); }}
                        className="p-1 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors cursor-pointer"
                        title="改名（套用至該客戶所有品號）"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`確定要刪除客戶「${c.name}」及其 ${c.count} 筆品號嗎？此操作無法還原。`)) {
                            onDeleteCustomer(c.name);
                          }
                        }}
                        className="p-1 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                        title="刪除客戶（含所有品號）"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {customerGroups.length === 0 && (
              <p className="text-sm text-gray-400 py-2">查無符合條件的客戶</p>
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-gray-400 text-center py-2 space-y-1">
          <p>共 {assemblyKeys.length} 個組立編號，{Object.values(children).flat().length} 個零件對應</p>
          <p>品號與客戶異動會自動同步至伺服器（data/parts.json），無需手動儲存</p>
        </div>
      </div>
    </div>
  );
};

function computeParents(children: Record<string, string[]>): Record<string, string[]> {
  const parents: Record<string, string[]> = {};
  for (const [parent, comps] of Object.entries(children)) {
    for (const child of comps) {
      if (!parents[child]) parents[child] = [];
      if (!parents[child].includes(parent)) parents[child].push(parent);
    }
  }
  return parents;
}
