export type ItemType = 'part' | 'assembly';

export interface BomComponentDetail {
  partNo: string;
  name: string;
  qty: string;
  material?: string;
  materialCode?: string;
}

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
  // 9 大統一工程規格欄位
  drawingFileName?: string; // 1. 圖檔檔名
  dwgNo?: string;           // 2. 圖號 (Drawing number)
  revision?: string;        // 3. 版本 (REV.)
  // 4. 品號: partNo
  // 5. 品名: name 或 description
  description?: string;     // 5. 品名規格原文
  // 6. 顏色: color
  // 7. 原料名稱: material
  materialCode?: string;    // 8. 原料編碼 (Material Code)
  // 9. 物料類別: category
  bomDetails?: BomComponentDetail[]; // 組件/SET 組成零件結構化明細 (用量/品號/品名/原料名稱/原料編號)
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


