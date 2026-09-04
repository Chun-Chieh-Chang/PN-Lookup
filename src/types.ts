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
  legacy?: boolean;                  // 舊版組件：出現在 master 但未列入客戶組件版本清單 (2026-08-05)
  // 製造資訊 (從 seed 傳遞)
  moldNo?: string;           // 模具號碼
  cavity?: string;           // 穴數
  // ERP 第二階 SSOT 計算欄位 (由 buildMaster 計算，非手動填寫)
  erpItemClass?: string;     // ERP 物料分類: 成品 / 半成品 / 零件 / 原料
  uom?: string;              // 計量單位 (Unit of Measure), 預設 PCS
  procurementType?: string;  // 採購方式: 自製 / 外購
  isActive?: boolean;        // 是否啟用 (!legacy)
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


