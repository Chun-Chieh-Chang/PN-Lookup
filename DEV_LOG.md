# PN-Lookup 開發日誌

## v2.8.0 — 程式碼清理與專案優化

### 清理項目
- **移除死碼匯出**：刪除從未被呼叫的 `clearBOMCache()`（bomService.ts）、`clearPartsCache()`（partsService.ts）、`getServerStatusSync()`（serverStatus.ts）
- **建立 `src/data/partsData.ts`**：補齊 App.tsx 靜態 import 所需的空殼檔案（`INITIAL_PARTS_DATA = []`），確保 build 不因缺少模組而失敗
- **建立 `src/data/bomData.ts`**：補齊 bomEngine.ts 靜態 import 所需的空殼檔案（`BOM_CHILDREN / BOM_PARENTS / ASSEMBLY_PART_NOS` 均為空），真實資料由 `initBOM()` 在 runtime 從 API 載入
- **server.js 清理**：移除 v2.2/v2.3 遺留的 legacy migration 邏輯（`parts.json` / `bom.json` 合併遷移，已完成歷史使命）；新增 `mkdirSync(DATA_DIR, { recursive: true })` 確保 data/ 目錄不存在時自動建立
- **git 歷史清除**：以 `git-filter-repo` 完整移除所有歷史 commit 中的原始資料（`/data/`、`/ref/` PDF 圖檔、xlsm、CSV），保護公司資料安全

### gitignore 修正
- 將 `data/`、`ref/` 範圍收斂為 `/data/`、`/ref/`（加前綴斜線），避免誤排除 `src/data/` 目錄

### 架構說明（當前）
- **靜態模式**（GitHub Pages）：`VITE_STATIC_ONLY=true` 注入，完全跳過 API；品號走 localStorage，BOM 走空殼 fallback
- **本機伺服器模式**：`npm run start`（build + serve），品號與 BOM 從 `data/master.json` 讀寫
- **bomData.ts / partsData.ts**：兩者均為空殼，存在只為讓 Vite/Rollup build-time 模組解析不報錯；實際資料透過 runtime API 載入

---

## v2.7.0 — 替代品號 + 掃描檔內容識別（OCR + 手動綁定）

### 替代品號（可互相替代的品號）
- **PartItem 新增 `alternates` 欄位**：前台編輯品號與後台新增品號皆可填（逗號/空格分隔），詳細資料視窗顯示替代品號標籤
- **圖檔比對一併查詢替代品號**：例 `3M55567` 的圖以 `D09-410-111-1` 命名也能找到
- **搜尋一併查詢**：輸入替代品號可找到對應品號（品號欄位搜尋）
- 品號改名連動更新其他品號的替代清單；Excel/CSV 匯出匯入 round-trip 支援

### 掃描檔內容識別（OCR，瀏覽器內執行、檔案不上傳）
- **tesseract.js（eng）+ pdf.js 動態載入**：選取資料夾後，檔名比對不到的檔案自動背景 OCR（PDF 先轉頁面影像），結果存 IndexedDB 只辨識一次；工具列顯示「OCR 內容辨識中 n/m」
- **比對順序**：檔名 → 手動綁定 → OCR 內容（內容含品號/替代品號即命中）
- 首次需下載 eng 語言包與 wasm（約 10 MB）；圖面 OCR 準確率有極限，誤判時可用手動綁定補救
- **手動綁定**：找不到圖檔的品號可點「綁定」從檔案清單手動指定（本機限定，存 localStorage）

### 技術
- 新增 `src/utils/ocr.ts`（OCR 引擎 + IndexedDB 快取）、`src/utils/idb.ts`（共用 IndexedDB）、`src/utils/imageResolver.ts`（解析順序 + 綁定持久化）、`src/components/ImageBindModal.tsx`
- pdfjs-dist v5 API（`render({canvas})`、`loadingTask.destroy()`）
- 依賴：tesseract.js、pdfjs-dist（動態 import 拆包，不影響主 bundle 載入）

---

## v2.6.0 — 品號圖檔超連結（圖檔資料夾）

### 新增功能
- **品號可直接點選開啟圖檔**：檢索表格中，圖檔資料夾內找得到對應圖檔的品號會變成可點按（新分頁開啟），並顯示圖示按鈕
- **圖檔資料夾由用戶指定**：首次開啟頁面時出現系統提示（可略過）；右上角「圖檔」按鈕可隨時指定/更換資料夾（顯示資料夾名稱與圖檔數量）
- **自動遍歷子資料夾**：選擇資料夾後遞迴掃描所有子資料夾內的圖檔（JPG/PNG/GIF/WEBP/BMP/SVG/TIFF）
- **檔名比對規則**：支援「品號_版本_別稱」/「別稱_版本_品號」組合命名 — 檔名先整體比對，再拆成片段（`_`/`-`/空格/點分隔）逐一比對，任一片段等於品號即命中；符號一律忽略（`3M-41459` 可對上 `3M41459`）；品號至少 4 字元才允許開頭模糊比對
- **比對可視化**：工具列顯示「圖檔 N 張 · 品號對應 M 筆」；「開啟圖檔」按鈕懸停顯示實際命中的檔名，找不到時顯示找不到的品號
- **獨立「圖檔」欄位**：品名規格右側新增「圖檔」欄，每列顯示「開啟圖檔」連結按鈕（找不到圖檔時顯示灰字 `—`，滑鼠移上會提示原因）；品號本身亦可直接點選開圖
- **位置持久化**：資料夾 handle 存於 IndexedDB，下次開啟自動恢復權限並載入；完全在本機瀏覽器執行，圖檔絕不上傳
- **瀏覽器相容**：Chromium（Chrome/Edge）用 File System Access API；Firefox/Safari 自動降級為「資料夾上傳」選取模式

### 技術
- 新增 `src/utils/imageLibrary.ts`（IndexedDB handle 持久化、遞迴掃描、品號→圖檔配對、object URL 快取）
- 新增 `src/components/ImageFolderModal.tsx`（首次開啟的圖檔資料夾提示）
- 新增 `src/types/file-system-access.d.ts`（File System Access API 環境型別宣告）
- 未指定資料夾時表格工具列顯示小型提示文字

---

## v2.5.0 — 唯一真源完全鎖定（衍生欄位不落檔）

### 資料架構
- **衍生欄位（itemType/components/usedInAssemblies）不再落檔**：`stripDerivedFields()` 於 localStorage、伺服器（master.json）、完整備份匯出時移除；顯示與 Excel 匯出時由 `enrichParts()` 即時從 BOM 推導
- **itemType 純推導**：一律由 assemblySet 決定（儲存值不再被信任，杜絕過期）
- **刪除客戶連動清理 BOM**：該客戶所有品號的組立定義與零件連結一併移除（確認框告知）
- **品號改名連動 BOM**：前台編輯品號時同步更新 BOM join key（children/parents/assemblySet），避免孤兒連結
- **BOM 更新後即時 re-enrich**：後台任何 BOM 變更（編輯/備份還原）觸發 `onBOMUpdated`，品號衍生欄位立即與 BOM 一致
- **Excel 匯入忽略衍生欄位**：完整資料 sheet 僅取主檔欄位（id/customer/partNo/name/notes/createdAt），BOM 連結一律以後台階層為準
- **孤兒可視化**：後台彙總列顯示「BOM 中有 N 個零件編號不在品號表中」（原料/通用件屬正常，僅提示）

### 捨棄
- 自訂物料單（Direct BOM Link）功能：Excel 手動編輯帶入的 components/usedInAssemblies 不再生效

---

## v2.4.0 — 後台介面全面檢討

- **標題修正**：「後台管理 — BOM 階層維護」→「後台管理」
- **版面重排為四張主卡片**：品號管理（搜尋刪除 + 新增品號）、客戶管理（篩選改名刪除 + 新增客戶）、BOM 階層維護（新增組立 + 分組列表）、完整資料備份
- **新增「其他」組立分組**：非 SA/SB/SC/SD 開頭的組立（如 3M41459）原本在後台看不見、改不到，現已納入
- **刪除品號連動清理 BOM**：確認視窗會提示，刪除時同步移除該品號在 BOM 階層中的所有連結（含組立定義本身）
- **新增品號重複檢查**：品號已存在時阻止新增並提示原客戶
- **BOM 編輯邏輯重構**：remove/add/delete assembly 統一以不可變 next 物件重算 parents，避免舊式雙 setState 不一致

---

## v2.3.1 — 後台同步自動化與備份收斂

- **移除「儲存至伺服器」按鈕**：BOM 階層編輯改為防抖 800ms 自動同步至伺服器（與品號自動同步一致），標頭改以狀態文字顯示「同步中 / 已自動同步 / 同步失敗 / 離線模式」
- **移除「BOM 資料備份（JSON 檔）」卡片**：完整資料備份已涵蓋 BOM，僅保留單一備份格式
- **完整備份匯入相容舊版 BOM-only 檔**：無 `type`/`parts` 標記的舊檔仍可還原 BOM（品號不受影響）
- **移除離線提示橫幅**：GitHub Pages 即為檢索/維護媒介屬預期情境，不再顯示長提示（標頭仍保留小型「離線模式」狀態字樣）
- **靜態模式旗標 `VITE_STATIC_ONLY`**：GitHub Actions 建置時注入，靜態託管完全跳過 `/api/*` 呼叫（零 404/405 請求），品號走 localStorage、BOM 走靜態備份；本機 `npm run serve` 建置不注入、行為不變

---

## v2.3.0 — 單一 Master 檔架構（唯一真源）

### 架構變更
- **`data/master.json` 成為唯一真源**：品號（parts）與 BOM 階層（bom）全部收斂於單一檔案，取代原本分開的 `parts.json` / `bom.json`
- **Master 檔格式 = 完整備份檔格式**（`{ type: 'pn-lookup-backup', version: 2, parts, bom }`）：後台「匯出完整備份」產出的檔案可直接作為 master.json 使用，維護人員只需維護這一份檔案
- **API 相容**：`/api/bom`、`/api/parts` 維持原路徑，改由 master.json 讀寫；新增 `GET/PUT /api/master` 供整包讀寫
- **寫入序列化**：伺服器以 write queue 串行化所有寫入，避免 parts/bom 並行更新時的讀改寫競態
- **舊檔遷移**：伺服器啟動時若無 master.json，自動從舊版 parts.json/bom.json 合併產生（若存在）
- 已移除 `data/bom.json`（資料已遷入 master.json）

---

## v2.2.0 — 品號資料上雲與 BOM 備份

### 新增功能
- **品號資料伺服器化**：新增 `GET /api/parts` / `PUT /api/parts` API，品號資料持久化於 `data/parts.json`
- **雙層儲存策略**：前端開機時以伺服器資料為準（authoritative）覆寫載入；伺服器不可用時自動降級使用 localStorage
- **自動同步**：品號/客戶任何異動（新增、編輯、刪除、改名）於 800ms 防抖後自動 PUT 至伺服器，後台無需手動儲存品號資料
- **BOM 備份**：後台新增「BOM 資料備份」區塊，可匯出 JSON 備份檔（含 children/parents/exportedAt），亦可匯入備份檔，匯入後先載入於頁面供確認，點「儲存至伺服器」才正式寫入
- 新增 `src/utils/partsService.ts`（Parts API 客戶端 + cache）

### 檔案結構（新增）
```
├── data/
│   └── parts.json              ← 品號資料持久化儲存（JSON，伺服器啟動後產生）
└── src/utils/
    └── partsService.ts         ← Parts API 客戶端（fetch + cache）
```

---

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

### 檔案結構（v2.8.0 當前）
```
pn-lookup/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── server.js                         ← Express 後端 (API + 靜態服務)
├── .env.example
├── .gitignore
├── DEV_LOG.md
├── README.md
├── metadata.json
├── .github/workflows/deploy.yml      ← GitHub Pages 自動部署
└── src/
    ├── main.tsx
    ├── App.tsx                        ← 根元件（路由/狀態/BOM初始化）
    ├── index.css
    ├── types.ts
    ├── data/
    │   ├── partsData.ts               ← 空殼（INITIAL_PARTS_DATA = []）
    │   └── bomData.ts                 ← 空殼（BOM fallback，runtime 覆蓋）
    ├── types/
    │   └── file-system-access.d.ts   ← File System Access API 型別宣告
    ├── utils/
    │   ├── bomEngine.ts               ← BOM 唯一真源（enrichParts / stripDerived）
    │   ├── bomService.ts              ← BOM API 客戶端
    │   ├── partsService.ts            ← Parts API 客戶端
    │   ├── serverStatus.ts            ← 伺服器狀態 + 靜態模式旗標
    │   ├── excelExport.ts             ← Excel 匯出匯入
    │   ├── customerPartImport.ts      ← 客戶料號三碼互換匯入
    │   ├── imageLibrary.ts            ← 圖檔資料夾管理 + 檔名比對
    │   ├── imageResolver.ts           ← 圖檔解析順序（檔名→綁定→OCR）
    │   ├── ocr.ts                     ← OCR 引擎（tesseract.js + pdf.js）
    │   ├── idb.ts                     ← IndexedDB 封裝
    │   └── alternates.ts              ← 替代品號解析與去重
    └── components/
        ├── Header.tsx
        ├── StatsBar.tsx
        ├── SearchControls.tsx
        ├── PartsTable.tsx
        ├── PartDetailModal.tsx
        ├── AddEditModal.tsx
        ├── BatchSearchModal.tsx
        ├── CustomerStatsModal.tsx
        ├── ExportImportModal.tsx
        ├── ImageFolderModal.tsx
        ├── ImageBindModal.tsx
        └── AdminPanel.tsx
```

---

## v2.0.0 — 全面清理、Excel 匯出匯入、Light Theme 遷移

原始開發基於 Google AI Studio 範本，逐步建立品號檢索、BOM 階層瀏覽、客戶統計等功能。

### 核心技術棧
- React 19 + TypeScript 5.8
- Vite 6 + Tailwind CSS 4
- Lucide React (icons)
- SheetJS (xlsx) for Excel 處理
