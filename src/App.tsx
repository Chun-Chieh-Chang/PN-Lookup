import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Header } from './components/Header';
import { StatsBar } from './components/StatsBar';
import { SearchControls } from './components/SearchControls';
import { PartsTable } from './components/PartsTable';
import { BatchSearchModal } from './components/BatchSearchModal';
import { CustomerStatsModal } from './components/CustomerStatsModal';
import { AddEditModal } from './components/AddEditModal';
import { PartDetailModal } from './components/PartDetailModal';
import { ExportImportModal } from './components/ExportImportModal';
import { AdminPanel } from './components/AdminPanel';
import { PartItem, FilterState } from './types';
import { INITIAL_PARTS_DATA } from './data/partsData';
import { getItemType, enrichParts, initBOM } from './utils/bomEngine';

const STORAGE_KEY_PARTS = 'medical_parts_system_data_v2';

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash === '#admin' ? 'admin' : 'main');
  const onHashChange = useCallback(() => {
    setRoute(window.location.hash === '#admin' ? 'admin' : 'main');
  }, []);

  useEffect(() => {
    initBOM().then(() => {
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
  // Load parts from LocalStorage or default
  const [parts, setParts] = useState<PartItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PARTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return enrichParts(parsed);
      }
    } catch {
      // ignore
    }
    return enrichParts(INITIAL_PARTS_DATA);
  });

  // Auto-open export/import when no data exists
  const [isExportImportOpen, setIsExportImportOpen] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PARTS);
      if (saved) {
        const parsed = JSON.parse(saved);
        return !(Array.isArray(parsed) && parsed.length > 0);
      }
    } catch {}
    return true;
  });

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
  const [isCustomerStatsOpen, setIsCustomerStatsOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState<PartItem | null>(null);

  // Save to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_PARTS, JSON.stringify(parts));
    } catch (e) {
      console.error('Failed to save parts data:', e);
    }
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

  // Add or Edit Part Item
  const handleSaveItem = (itemData: Omit<PartItem, 'id'> & { id?: string }) => {
    if (itemData.id) {
      // Edit existing
      setParts((prev) =>
        prev.map((p) =>
          p.id === itemData.id ? ({ ...p, ...itemData } as PartItem) : p
        )
      );
    } else {
      // Add new
      const newItem: PartItem = {
        ...itemData,
        id: `custom-${Date.now()}`,
      };
      setParts((prev) => [newItem, ...prev]);
    }
  };

  // Delete Item
  const handleDeleteItem = (id: string) => {
    if (confirm('確定要刪除該筆品號資料嗎？')) {
      setParts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  // Reset Data — clear and open export/import to reload
  const handleResetData = () => {
    setParts([]);
    localStorage.removeItem(STORAGE_KEY_PARTS);
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

        const matchCustomer = isExact
          ? item.customer.toLowerCase().startsWith(q)
          : item.customer.toLowerCase().includes(q);

        const matchName = isExact
          ? item.name.toLowerCase().startsWith(q)
          : item.name.toLowerCase().includes(q);

        if (filterState.searchField === 'partNo') return matchPartNo;
        if (filterState.searchField === 'customer') return matchCustomer;
        if (filterState.searchField === 'name') return matchName;

        return matchPartNo || matchCustomer || matchName;
      }

      return true;
    });
    }, [parts, filterState]);


  if (route === 'admin') {
    return <AdminPanel parts={parts} onClose={() => { window.location.hash = ''; }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Header */}
      <Header
        totalCount={parts.length}
        customerCount={allCustomers.length}
        onOpenAdd={() => {
          setEditingItem(null);
          setIsAddEditOpen(true);
        }}
        onOpenBatchSearch={() => setIsBatchSearchOpen(true)}
        onOpenCustomerStats={() => setIsCustomerStatsOpen(true)}
        onOpenExportImport={() => setIsExportImportOpen(true)}
        onResetData={handleResetData}
        onEnterAdmin={() => { window.location.hash = 'admin'; }}
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
        sortField={filterState.sortField ?? 'partNo'}
        onSortFieldChange={(field) => setFilterState({...filterState, sortField: field})}
        sortOrder={filterState.sortOrder ?? 'asc'}
        onSortOrderChange={(order) => setFilterState({...filterState, sortOrder: order})}
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
          onDelete={handleDeleteItem}
          searchKeyword={filterState.keyword}
          onCustomerClick={(customerName) => {
            setFilterState({
              ...filterState,
              selectedCustomers: [customerName],
            });
          }}
        />
      </main>

      {/* Modals */}
      <BatchSearchModal
        isOpen={isBatchSearchOpen}
        onClose={() => setIsBatchSearchOpen(false)}
        allParts={parts}
      />

      <CustomerStatsModal
        isOpen={isCustomerStatsOpen}
        onClose={() => setIsCustomerStatsOpen(false)}
        allParts={parts}
        onSelectCustomer={(customerName) => {
          setFilterState({
            ...filterState,
            selectedCustomers: [customerName],
          });
        }}
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
        onResetData={handleResetData}
      />

    </div>
  );
}
