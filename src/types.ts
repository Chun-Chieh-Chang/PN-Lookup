export type ItemType = 'part' | 'assembly';

export interface PartItem {
  id: string;
  customer: string;
  partNo: string;
  name: string;
  category?: string;
  color?: string;
  material?: string;
  notes?: string;
  alternates?: string[];
  itemType?: ItemType;
  components?: string[];
  usedInAssemblies?: string[];
  createdAt?: string;
  // v7.9.0 圖檔語意識別欄位：品名規格原文（標題欄 DESCRIPTION）/ 圖號
  description?: string;
  dwgNo?: string;
}

export type SearchField = 'all' | 'partNo' | 'customer' | 'name';

export interface FilterState {
  keyword: string;
  searchField: SearchField;
  selectedCustomers: string[];
  prefixFilter: string;
  itemTypeFilter: 'all' | 'part' | 'assembly';
  matchMode: 'fuzzy' | 'exact';
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  // v7.8.13 欄位篩選：品號 / 品名規格 / 物料類別（與 keyword 全域搜尋並存，可組合 AND 篩選）
  partNoFilter: string;
  nameFilter: string;
  categoryFilter: string;
}


