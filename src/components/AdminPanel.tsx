import React, { useState, useEffect } from 'react';
import { X, Save, Plus, Trash2, Search, RefreshCw, ArrowLeft } from 'lucide-react';
import { PartItem } from '../types';
import { getBOMChildren, getBOMParents, updateBOMData } from '../utils/bomEngine';
import { saveBOM } from '../utils/bomService';

interface AdminPanelProps {
  parts: PartItem[];
  onClose: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({ parts, onClose }) => {
  const [children, setChildren] = useState<Record<string, string[]>>(() => ({ ...getBOMChildren() }));
  const [parents, setParents] = useState<Record<string, string[]>>(() => ({ ...getBOMParents() }));
  const [searchQuery, setSearchQuery] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [addKey, setAddKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const partNoSet = new Set(parts.map(p => p.partNo));

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

        {/* Summary */}
        <div className="text-sm text-gray-400 text-center py-2">
          共 {assemblyKeys.length} 個組立編號，{Object.values(children).flat().length} 個零件對應
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
