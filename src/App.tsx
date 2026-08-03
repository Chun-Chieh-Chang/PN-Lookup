import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { SearchControls } from './components/SearchControls';
import { PartsTable } from './components/PartsTable';
import { BatchSearchModal } from './components/BatchSearchModal';

import { AddEditModal } from './components/AddEditModal';
import { PartDetailModal } from './components/PartDetailModal';
import { ExportImportModal } from './components/ExportImportModal';
import { ImageFolderModal } from './components/ImageFolderModal';
import { AdminPanel } from './components/AdminPanel';
import { PartItem, FilterState } from './types';
import { getItemType, enrichParts, initBOM, renamePartNo, stripDerivedFields } from './utils/bomEngine';
import { loadParts, saveParts } from './utils/partsService';
import { IS_STATIC_MODE } from './utils/serverStatus';
import { dedupeAlternates } from './utils/alternates';
import {
  ImageLibrary,
  pickImageFolder,
  restoreImageFolder,
  isImageFolderDismissed,
  clearImageFolderDismissed,
} from './utils/imageLibrary';
import { loadOcrCache, ocrKeyForFile, recognizeFile, saveOcrText } from './utils/ocr';
import { loadBindings, saveBindings, getOrphanFiles, loadDismissedOrphans, saveDismissedOrphans } from './utils/imageResolver';
import { ImageBindModal } from './components/ImageBindModal';
import { OrphanImagesModal } from './components/OrphanImagesModal';
import { ProductMindMapModal } from './components/ProductMindMapModal';

const STORAGE_KEY_PARTS = 'medical_parts_system_data_v2';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash === '#admin' ? 'admin' : 'main');
  const onHashChange = useCallback(() => {
    setRoute(window.location.hash === '#admin' ? 'admin' : 'main');
  }, []);

  const [parts, setParts] = useState<PartItem[]>(() => {
    if (IS_STATIC_MODE) {
      // GitHub Pages: purge any residual private data from previous deployments
      try { localStorage.removeItem(STORAGE_KEY_PARTS); } catch { /* ignore */ }
      return [];
    }
    const saved = localStorage.getItem(STORAGE_KEY_PARTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return enrichParts(parsed);
      } catch { /* ignore */ }
    }
    return [];
  });
  const partsRef = useRef(parts);
  partsRef.current = parts;

  useEffect(() => {
    initBOM().then(() => {
      loadParts().then((loadedParts) => {
        if (loadedParts && loadedParts.length > 0) {
          setParts(enrichParts(loadedParts));
        }
      }).catch(() => {});
      setRoute(prev => prev);
    });
    window.addEventListener('hashchange', onHashChange);
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        window.location.hash = 'admin';
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('keydown', onKey);
    };
  }, [onHashChange]);

  // Auto-open export/import when no data exists
  const [isExportImportOpen, setIsExportImportOpen] = useState(false);

  useEffect(() => {
    if (parts.length === 0) {
      setIsExportImportOpen(true);
    }
  }, [parts.length]);

  // 圖檔資料夾：自動恢復上次選擇；未曾指定時首次開啟提示
  const [imageLib, setImageLib] = useState<ImageLibrary | null>(null);
  const [isImagePromptOpen, setIsImagePromptOpen] = useState(false);
  const [isPickingImages, setIsPickingImages] = useState(false);

  useEffect(() => {
    let cancelled = false;
    restoreImageFolder().then((lib) => {
      if (cancelled) return;
      if (lib) {
        setImageLib(lib);
      } else if (!isImageFolderDismissed()) {
        setIsImagePromptOpen(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handlePickImageFolder = useCallback(async () => {
    setIsPickingImages(true);
    try {
      const lib = await pickImageFolder();
      setImageLib(lib);
      clearImageFolderDismissed();
      setIsImagePromptOpen(false);
    } catch {
      // 用戶取消或資料夾無圖檔時保持原狀
    } finally {
      setIsPickingImages(false);
    }
  }, []);

  // OCR 快取與手動掃描引擎（預設停止全量自動背景掃描，節省 CPU 與記憶體資源）
  const [ocrIndex, setOcrIndex] = useState<Map<string, string>>(new Map());
  const [ocrProgress, setOcrProgress] = useState<{ done: number; total: number } | null>(null);
  const [isOcrScanning, setIsOcrScanning] = useState(false);
  const ocrCancelledRef = useRef(false);

  // 載入資料夾時僅載入快取，不自動啟動迴圈掃描
  useEffect(() => {
    if (!imageLib) return;
    loadOcrCache().then((cache) => {
      setOcrIndex(new Map(cache));
    });
  }, [imageLib]);

  // 手動啟動孤兒圖檔或指定的 OCR 掃描
  const handleStartOcrScan = useCallback(async (targetFiles?: string[]) => {
    if (!imageLib || isOcrScanning) return;
    ocrCancelledRef.current = false;
    setIsOcrScanning(true);
    try {
      const filesToScan = targetFiles || imageLib.fileNames;
      const queued = filesToScan.filter((f) => {
        const file = imageLib.fileFor(f);
        return file && !ocrIndex.has(f);
      });
      if (queued.length === 0) {
        setIsOcrScanning(false);
        return;
      }
      setOcrProgress({ done: 0, total: queued.length });
      for (let i = 0; i < queued.length; i++) {
        if (ocrCancelledRef.current) break;
        const fname = queued[i];
        const file = imageLib.fileFor(fname);
        if (file) {
          try {
            const text = await recognizeFile(file);
            if (ocrCancelledRef.current) break;
            await saveOcrText(ocrKeyForFile(file), text);
            setOcrIndex((prev) => new Map(prev).set(fname, text));
          } catch { /* 單檔失敗略過 */ }
        }
        setOcrProgress({ done: i + 1, total: queued.length });
        await new Promise((r) => setTimeout(r, 0));
      }
    } finally {
      setOcrProgress(null);
      setIsOcrScanning(false);
    }
  }, [imageLib, isOcrScanning, ocrIndex]);

  const handleStopOcrScan = useCallback(() => {
    ocrCancelledRef.current = true;
    setIsOcrScanning(false);
    setOcrProgress(null);
  }, []);

  const handleSingleOcr = useCallback(async (fileName: string) => {
    if (!imageLib) return;
    const file = imageLib.fileFor(fileName);
    if (!file) return;
    try {
      const text = await recognizeFile(file);
      await saveOcrText(ocrKeyForFile(file), text);
      setOcrIndex((prev) => new Map(prev).set(fileName, text));
    } catch { /* 單檔失敗略過 */ }
  }, [imageLib]);

  // 手動綁定（本機限定）
  const [bindings, setBindings] = useState<Record<string, string>>(() => loadBindings());
  const [bindPartNo, setBindPartNo] = useState<{ partNo: string; alternates?: string[] } | null>(null);

  const handleBind = useCallback((partNo: string, fileName: string) => {
    setBindings((prev) => {
      const next = { ...prev, [partNo]: fileName };
      saveBindings(next);
      return next;
    });
  }, []);

  const handleUnbind = useCallback((partNo: string) => {
    setBindings((prev) => {
      const next = { ...prev };
      delete next[partNo];
      saveBindings(next);
      return next;
    });
  }, []);

  // Filter state
  const [filterState, setFilterState] = useState<FilterState>({
    keyword: '',
    searchField: 'all',
    selectedCustomers: [],
    prefixFilter: '',
    matchMode: 'fuzzy',
    itemTypeFilter: 'all',
  });

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PartItem | null>(null);
  const [isBatchSearchOpen, setIsBatchSearchOpen] = useState(false);

  const [selectedDetailItem, setSelectedDetailItem] = useState<PartItem | null>(null);
  const [isOrphansModalOpen, setIsOrphansModalOpen] = useState(false);
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);

  // 標記排除/重複別稱孤兒圖檔（本機限定）
  const [dismissedOrphans, setDismissedOrphans] = useState<Set<string>>(() => loadDismissedOrphans());

  const handleToggleDismiss = useCallback((fileName: string) => {
    setDismissedOrphans((prev) => {
      const next = new Set<string>(prev);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      saveDismissedOrphans(next);
      return next;
    });
  }, []);

  // 孤兒圖檔 (未對應圖檔) 統計
  const orphanInfo = useMemo(() => {
    return getOrphanFiles(imageLib, parts, bindings, ocrIndex, dismissedOrphans);
  }, [imageLib, parts, bindings, ocrIndex, dismissedOrphans]);

  // Save to localStorage on change, debounce-save to server (derived fields stripped)
  const lastSavedRef = useRef('');
  useEffect(() => {
    if (IS_STATIC_MODE) return; // GitHub Pages: never persist private data
    const clean = stripDerivedFields(parts);
    try {
      localStorage.setItem(STORAGE_KEY_PARTS, JSON.stringify(clean));
    } catch (e) {
      console.error('Failed to save parts data:', e);
    }
    const serialized = JSON.stringify(clean);
    if (lastSavedRef.current === serialized) return;
    const timer = setTimeout(() => {
      saveParts(clean).then(() => {
        lastSavedRef.current = serialized;
      }).catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [parts]);

  // Unique customer list for options
  const allCustomers = useMemo(() => {
    const set = new Set<string>();
    parts.forEach((p) => {
      if (p.customer) set.add(p.customer);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [parts]);

  // Unique prefixes count
  const prefixCount = useMemo(() => {
    const prefixes = new Set<string>();
    parts.forEach((p) => {
      const prefix = p.partNo.split('-')[0] || p.partNo.substring(0, 3);
      if (prefix) prefixes.add(prefix.toUpperCase());
    });
    return prefixes.size;
  }, [parts]);

  // BOM 更新後，重新以 BOM 階層補齊品號衍生欄位
  const handleBOMUpdated = useCallback(() => {
    setParts((prev) => enrichParts(prev));
  }, []);

  // Add or Edit Part Item
  const handleSaveItem = (itemData: Omit<PartItem, 'id'> & { id?: string }) => {
    const cleanData = {
      ...itemData,
      alternates: dedupeAlternates(itemData.alternates ?? [], itemData.partNo),
    };
    if (itemData.id) {
      // Edit existing — 品號變更時同步更新 BOM join key
      const existing = parts.find((p) => p.id === itemData.id);
      if (existing && itemData.partNo && existing.partNo !== itemData.partNo) {
        renamePartNo(existing.partNo, itemData.partNo);
      }
      setParts((prev) =>
        enrichParts(prev.map((p) => {
          let item = p;
          // 其他品號的替代清單中若有舊品號，一併更新為新品號
          if (existing && itemData.partNo && p.alternates?.includes(existing.partNo)) {
            item = { ...p, alternates: p.alternates.map((a) => (a === existing.partNo ? itemData.partNo! : a)) };
          }
          return item.id === itemData.id ? ({ ...item, ...cleanData } as PartItem) : item;
        }))
      );
    } else {
      // Add new
      const newItem: PartItem = {
        ...cleanData,
        id: `custom-${Date.now()}`,
      };
      setParts((prev) => [newItem, ...prev]);
    }
  };

  // Reset Data — clear and open export/import to reload
  const handleResetData = () => {
    setParts([]);
    if (!IS_STATIC_MODE) localStorage.removeItem(STORAGE_KEY_PARTS);
    setIsExportImportOpen(true);
  };

  // Import Data
  const handleImportData = (importedItems: PartItem[], replace: boolean) => {
    const enriched = enrichParts(importedItems);
    if (replace) {
      setParts(enriched);
    } else {
      setParts((prev) => [...enriched, ...prev]);
    }
  };

  // Filtered Parts Calculation
  const filteredParts = useMemo(() => {
    return parts.filter((item) => {
      // Item Type Filter ('part' | 'assembly')
      if (filterState.itemTypeFilter && filterState.itemTypeFilter !== 'all') {
        const itemType = getItemType(item);
        if (itemType !== filterState.itemTypeFilter) {
          return false;
        }
      }

      // Customer filter
      if (
        filterState.selectedCustomers.length > 0 &&
        !filterState.selectedCustomers.includes(item.customer)
      ) {
        return false;
      }

      // Prefix filter
      if (filterState.prefixFilter) {
        const itemPrefix = (item.partNo.split('-')[0] || item.partNo.substring(0, 3)).toUpperCase();
        if (!itemPrefix.startsWith(filterState.prefixFilter.toUpperCase())) {
          return false;
        }
      }

      // Keyword filter
      if (filterState.keyword.trim()) {
        const q = filterState.keyword.trim().toLowerCase();
        const isExact = filterState.matchMode === 'exact';

        const matchPartNo = isExact
          ? item.partNo.toLowerCase().startsWith(q)
          : item.partNo.toLowerCase().includes(q);

        const matchAlternates = (item.alternates ?? []).some((a) =>
          isExact ? a.toLowerCase().startsWith(q) : a.toLowerCase().includes(q)
        );

        const matchCustomer = isExact
          ? item.customer.toLowerCase().startsWith(q)
          : item.customer.toLowerCase().includes(q);

        const matchName = isExact
          ? item.name.toLowerCase().startsWith(q)
          : item.name.toLowerCase().includes(q);

        if (filterState.searchField === 'partNo') return matchPartNo || matchAlternates;
        if (filterState.searchField === 'customer') return matchCustomer;
        if (filterState.searchField === 'name') return matchName;

        return matchPartNo || matchAlternates || matchCustomer || matchName;
      }

      return true;
    });
    }, [parts, filterState]);


  if (route === 'admin') {
    return (
      <AdminPanel
        parts={parts}
        serverOnline={false}
        onClose={() => { window.location.hash = ''; }}
        onAddPart={(itemData) => {
          const newItem: PartItem = {
            ...itemData,
            alternates: dedupeAlternates(itemData.alternates ?? [], itemData.partNo),
            id: `custom-${Date.now()}`,
          };
          setParts((prev) => [newItem, ...prev]);
        }}
        onDeletePart={(id) => {
          setParts((prev) => prev.filter((p) => p.id !== id));
        }}
        onRenameCustomer={(oldName, newName) => {
          setParts((prev) => prev.map((p) =>
            p.customer === oldName ? { ...p, customer: newName } : p
          ));
        }}
        onDeleteCustomer={(customerName) => {
          setParts((prev) => prev.filter((p) => p.customer !== customerName));
        }}
        onImportParts={handleImportData}
        onBOMUpdated={handleBOMUpdated}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header */}
      <Header
        onOpenBatchSearch={() => setIsBatchSearchOpen(true)}

        onOpenExportImport={() => setIsExportImportOpen(true)}
        onOpenGraph={() => setIsGraphModalOpen(true)}
        onEnterAdmin={() => {
          window.location.hash = 'admin';
        }}
        imageFolderName={imageLib?.folderName ?? null}
        imageCount={imageLib?.count ?? 0}
        orphanCount={orphanInfo.orphanFiles.length}
        onPickImageFolder={handlePickImageFolder}
        onOpenOrphansModal={() => setIsOrphansModalOpen(true)}
        isAdminMode={route === 'admin'}
      />

      {/* Stats Summary Bar */}
      <StatsBar
        totalCount={parts.length}
        filteredCount={filteredParts.length}
        customerCount={allCustomers.length}
        prefixCount={prefixCount}
      />

      {/* Main Search Controls */}
      <SearchControls
        keyword={filterState.keyword}
        onKeywordChange={(kw) => setFilterState({...filterState, keyword: kw})}
        searchField={filterState.searchField}
        onSearchFieldChange={(field) => setFilterState({...filterState, searchField: field})}
        filterCustomer={filterState.selectedCustomers[0] ?? null}
        onClearCustomerFilter={() => setFilterState({...filterState, selectedCustomers: []})}
      />

      {/* Main Data Content */}
      <main className="flex-1 flex flex-col">
        <PartsTable
          items={filteredParts}
          onViewDetail={(item) => setSelectedDetailItem(item)}
          onEdit={(item) => {
            setEditingItem(item);
            setIsAddEditOpen(true);
          }}
          searchKeyword={filterState.keyword}
          imageLib={imageLib}
          bindings={bindings}
          ocrIndex={ocrIndex}
          ocrProgress={ocrProgress}
          onBindClick={(item) => setBindPartNo({ partNo: item.partNo, alternates: item.alternates })}
          onCustomerClick={(customerName) => {
            setFilterState({
              ...filterState,
              selectedCustomers: [customerName],
            });
          }}
          isAdmin={route === 'admin'}
        />
      </main>

      {/* Modals */}
      <BatchSearchModal
        isOpen={isBatchSearchOpen}
        onClose={() => setIsBatchSearchOpen(false)}
        allParts={parts}
      />
      <AddEditModal
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        initialItem={editingItem}
        existingCustomers={allCustomers}
      />

      <PartDetailModal
        isOpen={!!selectedDetailItem}
        onClose={() => setSelectedDetailItem(null)}
        item={selectedDetailItem}
        allParts={parts}
        onSelectRelated={(item) => setSelectedDetailItem(item)}
      />

      <ExportImportModal
        isOpen={isExportImportOpen}
        onClose={() => setIsExportImportOpen(false)}
        parts={parts}
        onImportData={handleImportData}
        onApplyParts={(next) => setParts(enrichParts(next))}
        onResetData={handleResetData}
      />

      <ImageFolderModal
        isOpen={isImagePromptOpen}
        isPicking={isPickingImages}
        onClose={() => setIsImagePromptOpen(false)}
        onConfirm={handlePickImageFolder}
      />

      <ImageBindModal
        isOpen={!!bindPartNo}
        partNo={bindPartNo?.partNo ?? null}
        alternates={bindPartNo?.alternates}
        lib={imageLib}
        bindings={bindings}
        onBind={handleBind}
        onUnbind={handleUnbind}
        onClose={() => setBindPartNo(null)}
      />

      <OrphanImagesModal
        isOpen={isOrphansModalOpen}
        onClose={() => setIsOrphansModalOpen(false)}
        lib={imageLib}
        parts={parts}
        orphanFiles={orphanInfo.orphanFiles}
        dismissedFiles={orphanInfo.dismissedFiles}
        ocrIndex={ocrIndex}
        onBind={handleBind}
        onToggleDismiss={handleToggleDismiss}
        isOcrScanning={isOcrScanning}
        ocrProgress={ocrProgress}
        onStartOcrScan={handleStartOcrScan}
        onStopOcrScan={handleStopOcrScan}
        onSingleOcr={handleSingleOcr}
      />

      <ProductMindMapModal
        isOpen={isGraphModalOpen}
        onClose={() => setIsGraphModalOpen(false)}
        parts={parts}
        imageLib={imageLib}
        bindings={bindings}
        ocrIndex={ocrIndex}
        onSelectPart={(pn) => {
          setFilterState((prev) => ({ ...prev, keyword: pn, searchField: 'partNo' }));
        }}
      />

      {/* Footer */}
      <footer className="mt-auto py-3 text-xs text-slate-500 border-t border-slate-200/80 bg-white/70 backdrop-blur-md">
        <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 lg:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="font-semibold text-slate-700">凱益品號檢索系統 v3.4.0</span>
          <span className="font-mono text-slate-500 font-medium">Developed by Wesley Chang, July-2026 @Mouldex.</span>
        </div>
      </footer>

    </div>
  );
}
