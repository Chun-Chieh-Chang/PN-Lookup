import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Search, ArrowLeft, PackagePlus, Users, PenLine, Download, Upload, Building2, DatabaseBackup, Layers } from 'lucide-react';
import { PartItem } from '../types';
import { getBOMChildren, getBOMParents, updateBOMData, stripDerivedFields, computeParentsMap } from '../utils/bomEngine';
import { saveBOM } from '../utils/bomService';
import { parseAlternates } from '../utils/alternates';

interface AdminPanelProps {
  parts: PartItem[];
  serverOnline: boolean;
  onClose: () => void;
  onAddPart: (itemData: Omit<PartItem, 'id'>) => void;
  onDeletePart: (id: string) => void;
  onRenameCustomer: (oldName: string, newName: string) => void;
  onDeleteCustomer: (customerName: string) => void;
  onImportParts: (items: PartItem[], replace: boolean) => void;
  onBOMUpdated: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ parts, serverOnline, onClose, onAddPart, onDeletePart, onRenameCustomer, onDeleteCustomer, onImportParts, onBOMUpdated }) => {
  const [children, setChildren] = useState<Record<string, string[]>>(() => ({ ...getBOMChildren() }));
  const [, setParents] = useState<Record<string, string[]>>(() => ({ ...getBOMParents() }));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addKey, setAddKey] = useState('');
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [newPart, setNewPart] = useState({
    customer: '',
    partNo: '',
    name: '',
    category: '零件',
    color: '',
    material: '',
    notes: '',
    alternates: '',
  });

  const CATEGORY_OPTIONS = [
    '物料',
    '零件',
    '原料',
    'SET',
    'SA組立',
    'SB組立',
    'SC組立',
    'SD組立',
    '其他組件',
  ];

  const [addPartMsg, setAddPartMsg] = useState('');
  const [newCustomer, setNewCustomer] = useState({ customer: '', partNo: '', name: '', notes: '' });
  const [addCustMsg, setAddCustMsg] = useState('');
  const [customerPartQuery, setCustomerPartQuery] = useState('');
  const [showCustomerPartSuggestions, setShowCustomerPartSuggestions] = useState(false);
  const [partSearch, setPartSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState('');
  const [renamingCustomer, setRenamingCustomer] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const fullBackupFileRef = useRef<HTMLInputElement>(null);

  const existingCustomers: string[] = Array.from(new Set<string>(parts.map(p => p.customer))).sort();

  const handleDeleteCustomer = (c: { name: string; count: number }) => {
    const partNos = new Set(parts.filter(p => p.customer === c.name).map(p => p.partNo));
    const bomHit = partNos.size > 0 && (
      Object.keys(children).some(k => partNos.has(k)) ||
      Object.values(children).some((comps: string[]) => comps.some(no => partNos.has(no)))
    );
    const suffix = bomHit ? '若這些品號存在於 BOM 階層中，相關連結也會一併移除。' : '';
    if (!confirm(`確定要刪除客戶「${c.name}」及其 ${c.count} 筆品號嗎？${suffix}此操作無法還原。`)) return;
    if (bomHit) {
      const next: Record<string, string[]> = {};
      for (const [key, comps] of Object.entries(children)) {
        if (partNos.has(key)) continue;
        const filtered = (comps as string[]).filter(no => !partNos.has(no));
        if (filtered.length > 0) next[key] = filtered;
      }
      setChildren(next);
      setParents(computeParentsMap(next));
      onBOMUpdated();
    }
    onDeleteCustomer(c.name);
  };

  const bomPartNos = Array.from(new Set(Object.values(children).flat()));
  const orphanPartNos = bomPartNos.filter(no => !parts.some(p => p.partNo === no));

  const partSearchResults = partSearch.length >= 1
    ? parts.filter(p => p.partNo.toLowerCase().includes(partSearch.toLowerCase()) || p.name.toLowerCase().includes(partSearch.toLowerCase())).slice(0, 20)
    : [];

  const customerPartSuggestions = customerPartQuery.length >= 1
    ? parts.filter(p =>
        p.partNo.toLowerCase().includes(customerPartQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(customerPartQuery.toLowerCase())
      ).slice(0, 10)
    : [];

  const customerGroups = existingCustomers
    .filter(c => c.toLowerCase().includes(customerFilter.toLowerCase()))
    .map(c => ({
      name: c,
      count: parts.filter(p => p.customer === c).length,
      samples: parts.filter(p => p.customer === c).slice(0, 3).map(p => p.partNo),
    }));

  // ---------- 品號新增 ----------
  const handleAddPartSubmit = () => {
    const customer = newPart.customer.trim();
    const partNo = newPart.partNo.trim();
    const name = newPart.name.trim();
    if (!customer || !partNo || !name) {
      setAddPartMsg('客戶、品號、品名皆為必填欄位');
      return;
    }
    const dup = parts.find(p => p.partNo === partNo);
    if (dup) {
      setAddPartMsg(`品號 ${partNo} 已存在（客戶：${dup.customer}），請確認是否重複`);
      return;
    }
    onAddPart({
      customer,
      partNo,
      name,
      category: newPart.category || '零件',
      color: newPart.color.trim() || undefined,
      material: newPart.material.trim() || undefined,
      notes: newPart.notes.trim() || undefined,
      alternates: parseAlternates(newPart.alternates, partNo),
    });
    setAddPartMsg('品號已新增成功');
    setNewPart({
      customer: '',
      partNo: '',
      name: '',
      category: '零件',
      color: '',
      material: '',
      notes: '',
      alternates: '',
    });
  };

  // ---------- 客戶新增（含既有產品） ----------
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
    onAddPart({ customer, partNo, name, notes: newCustomer.notes.trim() || undefined });
    setAddCustMsg(`客戶「${customer}」已新增，品號 ${partNo}（${name}）歸屬於該客戶`);
    setNewCustomer({ customer: '', partNo: '', name: '', notes: '' });
  };

  // ---------- BOM 階層編輯 ----------
  const searchResults = searchQuery.length >= 2
    ? parts.filter(p => p.partNo.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 10)
    : [];

  const assemblyKeys = Object.keys(children).sort();
  const PREFIXES = ['SA', 'SB', 'SC', 'SD'];
  const otherKeys = assemblyKeys.filter(k => !PREFIXES.some(p => k.startsWith(p)));

  const handleRemoveComponent = (assemblyKey: string, componentIdx: number) => {
    const filtered = (children[assemblyKey] || []).filter((_, i) => i !== componentIdx);
    const next = { ...children };
    if (filtered.length === 0) {
      delete next[assemblyKey];
    } else {
      next[assemblyKey] = filtered;
    }
    setChildren(next);
    setParents(computeParentsMap(next));
  };

  const handleAddComponent = (assemblyKey: string, partNo: string) => {
    if (!partNo.trim()) return;
    const comps = children[assemblyKey] || [];
    if (comps.includes(partNo.trim())) return;
    const next = { ...children, [assemblyKey]: [...comps, partNo.trim()] };
    setChildren(next);
    setParents(computeParentsMap(next));
    setEditingKey(null);
    setSearchQuery('');
  };

  const handleAddAssembly = () => {
    if (!addKey.trim() || children[addKey.trim()]) return;
    const key = addKey.trim();
    setChildren(prev => ({ ...prev, [key]: [] }));
    setAddKey('');
  };

  const handleRemoveAssembly = (key: string) => {
    const next = { ...children };
    delete next[key];
    setChildren(next);
    setParents(computeParentsMap(next));
  };

  const handleDeletePart = (p: PartItem) => {
    const bomHit = assemblyKeys.includes(p.partNo) || Object.values(children).some((comps: string[]) => comps.includes(p.partNo));
    const suffix = bomHit ? '若其存在於 BOM 階層中，也會一併移除相關連結。' : '';
    if (!confirm(`確定要刪除品號 ${p.partNo} (${p.name}) 嗎？${suffix}`)) return;
    if (bomHit) {
      const next: Record<string, string[]> = {};
      for (const [key, comps] of Object.entries(children)) {
        if (key === p.partNo) continue;
        const filtered = (comps as string[]).filter(c => c !== p.partNo);
        if (filtered.length > 0) next[key] = filtered;
      }
      setChildren(next);
      setParents(computeParentsMap(next));
    }
    onDeletePart(p.id);
  };

  // ---------- BOM 自動同步（防抖） ----------
  const childrenRef = useRef(children);
  childrenRef.current = children;
  const skipFirstSyncRef = useRef(true);

  useEffect(() => {
    if (skipFirstSyncRef.current) {
      skipFirstSyncRef.current = false;
      return;
    }
    if (!serverOnline) return;
    setSyncState('saving');
    const timer = setTimeout(() => {
      const newParents = computeParentsMap(childrenRef.current);
      saveBOM(childrenRef.current, newParents).then(() => {
        updateBOMData(childrenRef.current, newParents);
        setParents(newParents);
        setSyncState('saved');
        onBOMUpdated();
      }).catch(() => setSyncState('error'));
    }, 800);
    return () => clearTimeout(timer);
  }, [children, serverOnline]);

  // ---------- 完整備份 ----------
  const handleExportFullBackup = () => {
    const payload = {
      type: 'pn-lookup-backup',
      version: 2,
      exportedAt: new Date().toISOString(),
      parts: stripDerivedFields(parts),
      bom: { children, parents: computeParentsMap(children) },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pn-lookup-master.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFullBackup = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const isFull = data?.type === 'pn-lookup-backup' && Array.isArray(data.parts);
        // 相容舊版 BOM-only 備份（無 type/parts 標記）
        const rawChildren = isFull ? (data.bom?.children ?? {}) : (data?.children ?? data);
        if (!rawChildren || typeof rawChildren !== 'object' || Array.isArray(rawChildren)) {
          throw new Error('invalid');
        }
        const newChildren: Record<string, string[]> = {};
        for (const [key, val] of Object.entries(rawChildren)) {
          if (!Array.isArray(val)) throw new Error('invalid');
          newChildren[key] = val.map(String);
        }
        if (isFull) {
          onImportParts(data.parts, true);
        }
        const newParents = computeParentsMap(newChildren);
        setChildren(newChildren);
        setParents(newParents);
        if (!isFull) {
          onBOMUpdated();
          setMessage(`已從舊版 BOM 備份還原：${Object.keys(newChildren).length} 個組立（品號未變動，已自動同步）`);
          return;
        }
        if (serverOnline) {
          saveBOM(newChildren, newParents).then(() => {
            updateBOMData(newChildren, newParents);
            onBOMUpdated();
            setMessage(`完整備份已還原並同步至伺服器：${data.parts.length} 筆品號、${Object.keys(newChildren).length} 個組立`);
          }).catch(() => {
            updateBOMData(newChildren, newParents);
            onBOMUpdated();
            setMessage('完整備份已還原至本機（伺服器同步失敗，請稍後手動儲存 BOM）');
          });
        } else {
          updateBOMData(newChildren, newParents);
          onBOMUpdated();
          setMessage(`完整備份已還原至本機：${data.parts.length} 筆品號、${Object.keys(newChildren).length} 個組立（離線模式，未同步伺服器）`);
        }
      } catch {
        setMessage('匯入失敗：檔案格式不正確（需為完整備份 JSON）');
      }
    };
    reader.readAsText(file);
  };

  const renderAssemblyGroup = (prefix: string, groupKeys: string[]) => (
    <div key={prefix} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200 font-bold text-slate-700 text-sm">
        {prefix} 組立 ({groupKeys.length} 筆)
      </div>
      {groupKeys.length === 0 ? (
        <div className="p-4 text-sm text-slate-400">無 {prefix} 資料</div>
      ) : (
        <div className="divide-y divide-gray-100 text-sm">
          {groupKeys.map(key => {
            const partName = parts.find(p => p.partNo === key)?.name || key;
            const comps = children[key] || [];
            return (
              <div key={key} className="p-3 hover:bg-slate-50">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center space-x-2">
                    <button onClick={() => handleRemoveAssembly(key)} className="p-0.5 text-slate-300 hover:text-red-500 cursor-pointer" title="刪除組立">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-bold text-sky-700">{key}</span>
                    <span className="text-slate-500 truncate max-w-xs">{partName}</span>
                    <span className="text-slate-400 text-[0.8125rem]">({comps.length} 個零件)</span>
                  </div>
                  <button
                    onClick={() => setEditingKey(editingKey === key ? null : key)}
                    className="px-2 py-1 text-[0.8125rem] bg-sky-50 text-sky-700 border border-sky-200 rounded hover:bg-sky-100 cursor-pointer"
                  >
                    {editingKey === key ? '取消' : '編輯零件'}
                  </button>
                </div>

                {comps.length > 0 && (
                  <div className="ml-6 space-y-1">
                    {comps.map((comp, ci) => {
                      const compName = parts.find(p => p.partNo === comp)?.name || comp;
                      return (
                        <div key={ci} className="flex items-center justify-between py-0.5 px-2 rounded hover:bg-slate-100 group">
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-400 text-[0.8125rem]">{ci + 1}.</span>
                            <span className="font-mono text-slate-700">{comp}</span>
                            <span className="text-slate-400 truncate max-w-[200px]">{compName !== comp ? compName : ''}</span>
                          </div>
                          <button
                            onClick={() => handleRemoveComponent(key, ci)}
                            className="p-0.5 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                            title="移除零件"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {editingKey === key && (
                  <div className="ml-6 mt-2 relative">
                    <div className="flex items-center space-x-2">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="搜尋品號加入..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                        autoFocus
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                        {searchResults.map(p => (
                          <button
                            key={p.partNo}
                            onClick={() => handleAddComponent(key, p.partNo)}
                            className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center space-x-2 cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-emerald-500 shrink-0" />
                            <span className="font-mono text-sky-700">{p.partNo}</span>
                            <span className="text-slate-500 truncate">{p.name}</span>
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
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="sticky top-0 z-50 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer" title="返回主畫面">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-slate-900">後台管理</h1>
        </div>
        <div className="flex items-center space-x-3">
          {message && (
            <span className={`text-sm ${message.includes('失敗') ? 'text-red-600' : 'text-emerald-600'}`}>{message}</span>
          )}
          {syncState === 'saving' && <span className="text-sm text-slate-500">同步中...</span>}
          {syncState === 'saved' && <span className="text-sm text-emerald-600">已自動同步至伺服器</span>}
          {syncState === 'error' && <span className="text-sm text-red-600">同步失敗，請確認伺服器執行中</span>}
          {!serverOnline && <span className="text-sm text-amber-600">離線模式（變更僅存本機）</span>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* 品號管理：搜尋刪除 + 新增 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center space-x-2">
            <PackagePlus className="w-4 h-4 text-sky-500" />
            <span>品號管理（共 {parts.length} 筆）</span>
          </h2>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={partSearch}
              onChange={e => setPartSearch(e.target.value)}
              placeholder="搜尋品號或品名以刪除..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
            />
          </div>
          {partSearch && (
            <div className="mt-3 space-y-1">
              {partSearchResults.length === 0 && (
                <p className="text-sm text-slate-400 py-2">查無符合條件的品號</p>
              )}
              {partSearchResults.map(p => (
                <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-100 group">
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="font-mono text-sky-700">{p.partNo}</span>
                    <span className="text-slate-500 truncate">{p.name}</span>
                    <span className="text-slate-400 text-[0.8125rem] truncate">{p.customer}</span>
                  </div>
                  <button
                    onClick={() => handleDeletePart(p)}
                    className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                    title="刪除品號"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-100 mt-4 pt-4">
            <h3 className="text-[0.8125rem] font-bold text-slate-500 mb-2">新增品號</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">客戶 *</label>
                <input
                  type="text"
                  list="admin-customers"
                  value={newPart.customer}
                  onChange={e => setNewPart(prev => ({ ...prev, customer: e.target.value }))}
                  placeholder="客戶名稱"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
                <datalist id="admin-customers">
                  {existingCustomers.map(c => <option key={c} value={c} />)}
                </datalist>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">品號 *</label>
                <input
                  type="text"
                  value={newPart.partNo}
                  onChange={e => setNewPart(prev => ({ ...prev, partNo: e.target.value }))}
                  placeholder="品號 (如 A02-410-111)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">品名 *</label>
                <input
                  type="text"
                  value={newPart.name}
                  onChange={e => setNewPart(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="品名規格"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">物料類別</label>
                <select
                  value={newPart.category}
                  onChange={e => setNewPart(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-sky-600"
                >
                  {CATEGORY_OPTIONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">顏色</label>
                <input
                  type="text"
                  value={newPart.color}
                  onChange={e => setNewPart(prev => ({ ...prev, color: e.target.value }))}
                  placeholder="如: 本 / 白 / 綠 (選填)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">原料</label>
                <input
                  type="text"
                  value={newPart.material}
                  onChange={e => setNewPart(prev => ({ ...prev, material: e.target.value }))}
                  placeholder="如: ABS TOYOLAC (選填)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">備註</label>
                <input
                  type="text"
                  value={newPart.notes}
                  onChange={e => setNewPart(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="備註（選填）"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm text-slate-500 mb-1">替代品號（可互相替代，逗號/空格分隔）</label>
                <input
                  type="text"
                  value={newPart.alternates}
                  onChange={e => setNewPart(prev => ({ ...prev, alternates: e.target.value }))}
                  placeholder="例如: D09-410-111-1、3M55567"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <button
                onClick={handleAddPartSubmit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新增品號</span>
              </button>
              {addPartMsg && (
                <span className={`text-sm ${addPartMsg.includes('成功') ? 'text-emerald-600' : 'text-red-600'}`}>{addPartMsg}</span>
              )}
            </div>
          </div>
        </div>

        {/* 客戶管理：篩選改名刪除 + 新增客戶 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center space-x-2">
            <Users className="w-4 h-4 text-indigo-500" />
            <span>客戶管理（{existingCustomers.length} 家客戶）</span>
          </h2>
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={customerFilter}
              onChange={e => setCustomerFilter(e.target.value)}
              placeholder="篩選客戶名稱..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
            />
          </div>
          <div className="space-y-1.5">
            {customerGroups.map(c => (
              <div key={c.name} className="py-2 px-2 rounded hover:bg-slate-100">
                {renamingCustomer === c.name ? (
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      placeholder="新客戶名稱"
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-none focus:border-sky-600"
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        if (renameValue.trim() && renameValue.trim() !== c.name) {
                          onRenameCustomer(c.name, renameValue.trim());
                        }
                        setRenamingCustomer(null);
                      }}
                      className="px-2.5 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-sm rounded-md cursor-pointer"
                    >
                      確認
                    </button>
                    <button
                      onClick={() => setRenamingCustomer(null)}
                      className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded-md border border-slate-200 cursor-pointer"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center space-x-2 min-w-0">
                      <span className="font-medium text-slate-800">{c.name}</span>
                      <span className="text-[0.8125rem] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full border border-slate-200">{c.count} 筆</span>
                      <span className="text-slate-400 text-[0.8125rem] font-mono truncate hidden sm:inline">{c.samples.join(', ')}</span>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0">
                      <button
                        onClick={() => { setRenamingCustomer(c.name); setRenameValue(c.name); }}
                        className="p-1 text-slate-300 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors cursor-pointer"
                        title="改名（套用至該客戶所有品號）"
                      >
                        <PenLine className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteCustomer(c)}
                        className="p-1 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
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
              <p className="text-sm text-slate-400 py-2">查無符合條件的客戶</p>
            )}
          </div>

          <div className="border-t border-slate-100 mt-4 pt-4">
            <h3 className="text-[0.8125rem] font-bold text-slate-500 mb-2 flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-500" />
              <span>新增客戶（既有產品賣給新客戶時，品號可搜尋既有品號，品名自動帶入）</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-slate-500 mb-1">客戶名稱 *</label>
                <input
                  type="text"
                  value={newCustomer.customer}
                  onChange={e => setNewCustomer(prev => ({ ...prev, customer: e.target.value }))}
                  placeholder="客戶名稱"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div className="relative">
                <label className="block text-sm text-slate-500 mb-1">品號 *（可搜尋既有品號）</label>
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-[34px]" />
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
                {showCustomerPartSuggestions && customerPartSuggestions.length > 0 && (
                  <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-44 overflow-y-auto">
                    {customerPartSuggestions.map(p => (
                      <button
                        key={p.id}
                        onMouseDown={() => {
                          setNewCustomer(prev => ({ ...prev, partNo: p.partNo, name: p.name }));
                          setCustomerPartQuery('');
                          setShowCustomerPartSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100 flex items-center justify-between space-x-2 cursor-pointer"
                      >
                        <span className="font-mono text-sky-700 shrink-0">{p.partNo}</span>
                        <span className="text-slate-500 truncate">{p.name}</span>
                        <span className="text-slate-400 text-[0.8125rem] shrink-0">{p.customer}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">品名 *</label>
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
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-500 mb-1">備註</label>
                <input
                  type="text"
                  value={newCustomer.notes}
                  onChange={e => setNewCustomer(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="備註（選填）"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                />
              </div>
            </div>
            <div className="flex items-center space-x-3 mt-3">
              <button
                onClick={handleAddCustomerSubmit}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新增客戶</span>
              </button>
              {addCustMsg && (
                <span className={`text-sm ${addCustMsg.includes('成功') || addCustMsg.includes('已新增') ? 'text-emerald-600' : 'text-red-600'}`}>{addCustMsg}</span>
              )}
            </div>
          </div>
        </div>

        {/* BOM 階層維護 */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-sky-500" />
            <h2 className="text-sm font-bold text-slate-700">BOM 階層維護（組立編號 → 零件）</h2>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h3 className="text-[0.8125rem] font-bold text-slate-500 mb-2">新增組立編號</h3>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={addKey}
                onChange={e => setAddKey(e.target.value.toUpperCase())}
                placeholder="輸入組立編號 (如 SA9999)"
                className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-sky-600"
                onKeyDown={e => { if (e.key === 'Enter') handleAddAssembly(); }}
              />
              <button
                onClick={handleAddAssembly}
                disabled={!addKey.trim()}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 font-medium rounded-lg flex items-center space-x-1 border border-slate-200 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>新增</span>
              </button>
            </div>
          </div>
          {PREFIXES.map(prefix => renderAssemblyGroup(prefix, assemblyKeys.filter(k => k.startsWith(prefix))))}
          {otherKeys.length > 0 && renderAssemblyGroup('其他', otherKeys)}
        </div>

        {/* 完整資料備份 */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-bold text-slate-700 mb-3 flex items-center space-x-2">
            <DatabaseBackup className="w-4 h-4 text-emerald-500" />
            <span>完整資料備份（品號 + BOM 一次打包）</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportFullBackup}
              className="px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-lg flex items-center space-x-1.5 border border-emerald-200 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
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
              <Download className="w-4 h-4" />
              <span>匯入完整備份</span>
            </button>
            <span className="text-[0.8125rem] text-slate-400">
              格式等同伺服器唯一真源 data/pn-lookup-master.json；匯入會覆蓋現有品號與 BOM 資料
            </span>
          </div>
        </div>

        {/* Summary */}
        <div className="text-sm text-slate-400 text-center py-2 space-y-1">
          <p>共 {parts.length} 筆品號、{existingCustomers.length} 家客戶、{assemblyKeys.length} 個組立編號、{Object.values(children).flat().length} 個零件對應</p>
          {orphanPartNos.length > 0 && (
            <p>BOM 中有 {orphanPartNos.length} 個零件編號不在品號表中（原料/通用件屬正常）</p>
          )}
          <p>所有異動會自動同步至伺服器（data/pn-lookup-master.json），無需手動儲存</p>
        </div>
      </div>
    </div>
  );
};
