# PN-Lookup 開發日誌

## v2.1.0 — 後端伺服器與 BOM 維護管理

### 新增功能
- **Express 後端伺服器** (`server.js`)：提供靜態檔案服務 + RESTful BOM API
- **BOM API**：`GET /api/bom` 回傳完整 BOM 階層，`PUT /api/bom` 更新 BOM 資料，儲存於 `data/bom.json`
- **後台管理頁面** (`#admin`)：僅透過 URL hash 存取（`/PN-Lookup/#admin`），主畫面無任何導覽連結
- **AdminPanel 功能**：
  - 以 SA/SB/SC/SD 分組顯示 BOM 階層樹
  - 新增/刪除組立編號
  - 對每個組立新增/移除零件（含品號搜尋 autocomplete）
  - 一鍵儲存至伺服器
- **Runtime BOM 資料**：`bomEngine.ts` 開機時從 API 載入 BOM 資料，API 不可用時自動降級使用靜態備份 (`bomData.ts`)
- **啟動指令**：`npm run serve`（先 build 後啟動伺服器）或 `node server.js`

### 移除
無

### 檔案結構（新增）
```
├── server.js                 ← Express 後端伺服器
├── data/
│   └── bom.json              ← BOM 資料持久化儲存（JSON）
├── src/
│   ├── utils/
│   │   ├── bomEngine.ts      ← 改為 runtime BOM cache（可從 API 更新）
│   │   └── bomService.ts     ← BOM API 客戶端（fetch + cache）
│   └── components/
│       └── AdminPanel.tsx    ← 後台管理頁面（#admin）
```

---

## v2.0.0 — 全面清理、Excel 匯出匯入、Light Theme 遷移

### 新增功能
- **Excel (.xlsx) 匯出匯入**：使用 SheetJS 產生 5 個工作表（客戶產品對照表、SA/SB/SC/SD 組立、完整資料），支援完整 round-trip 保留所有 PartItem 欄位
- **Light Theme 遷移**：全 UI 從 slate 暗色主題遷移至 gray/white 亮色主題（bg #F9FAFB / surface #FFFFFF）
- **CSV/JSON/Excel 三格式匯出**：ExportImportModal 新增格式選擇按鈕
- **BOM 自動補齊**：`enrichParts()` 於載入/匯入時自動填入 itemType、components、usedInAssemblies
- **畫面首次載入自動開啟匯入**：無 localStorage 資料時自動彈出 ExportImportModal

### 移除項目
- `FileSelectModal.tsx` — 完全未使用之 dead code
- `POPULAR_PREFIXES` — 未使用的匯出常數
- `BatchSearchResultItem` type — 未使用的介面
- 無作用之 prefix filter UI（SearchControls 中沒有連接到 filter state 的輸入框）
- 未使用的 lucide-react icon imports：Database、RefreshCw（Header）、ExternalLink、Sparkles（PartsTable）、FileText、Download（BatchSearchModal）
- `motion`、`autoprefixer`、`esbuild`、`express`、`@google/genai`、`dotenv` 等未使用依賴
- tsconfig.json 中 legacy flags（experimentalDecorators、useDefineForClassFields、allowJs、paths）
- 原始資料 CSV 移至 ref/ 目錄

### 檔案結構
```
pn-lookup/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .env.example
├── .gitignore
├── DEV_LOG.md
├── README.md
├── metadata.json
├── ref/
│   ├── 產品一覽表.xlsm
│   ├── 原始資料_產品一覽表.csv
│   └── 圖檔/...
├── assets/
├── dist/
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── types.ts
    ├── data/
    │   ├── partsData.ts
    │   └── bomData.ts
    ├── utils/
    │   ├── bomEngine.ts
    │   └── excelExport.ts
    └── components/
        ├── Header.tsx
        ├── StatsBar.tsx
        ├── SearchControls.tsx
        ├── PartsTable.tsx
        ├── PartDetailModal.tsx
        ├── AddEditModal.tsx
        ├── BatchSearchModal.tsx
        ├── CustomerStatsModal.tsx
        └── ExportImportModal.tsx
```

---

## v1.x — 初始版本（歷史記錄遺失）

原始開發基於 Google AI Studio 範本，逐步建立品號檢索、BOM 階層瀏覽、客戶統計等功能。

### 核心技術棧
- React 19 + TypeScript 5.8
- Vite 6 + Tailwind CSS 4
- Lucide React (icons)
- SheetJS (xlsx) for Excel 處理
