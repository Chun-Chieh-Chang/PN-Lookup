# PN-Lookup — 凱益醫療器材品號檢索與 BOM 階層管理系統 (v7.10.9)

PN-Lookup 是一款專為醫療耗材、射出件與規格配件打造的**高階品號檢索、圖檔自動超連結、BOM 階層展算與物料類別五分類管理平台**。

![Version](https://img.shields.io/badge/version-v7.10.9-slate.svg)
![React](https://img.shields.io/badge/React-19.0.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-teal.svg)
![Security](https://img.shields.io/badge/Security-Zero%20Private%20Data-emerald.svg)

---

## 🌟 核心功能亮點

- 🖼️ **本機圖庫零點擊自動掛載與懸停預覽 (v7.10.9)**：
  - **自動連線本機工程圖庫**：後端 Express 提供 `/api/images/list` 與 `/api/images/raw`，啟動即自動掛載 1,503 張工程圖檔（覆蓋率達 88.9%），無需手動重複授權。
  - **120ms 平滑懸停預覽**：滑鼠懸停於圖檔按鈕即可即時檢視高清晰 PDF / 圖片縮圖，點擊一鍵於新分頁開啟原圖。
  - **資訊架構瘦身**：移除表格冗餘「操作」欄位，升級「品名規格」為直覺開啟 BOM 彈窗入口，並於明細彈窗標頭新增「複製完整資訊」按鈕。
  - **全容器寬度擴展 (128rem)**：全站容器擴展至 2048px，徹底消除 1920px 螢幕下橫向卷軸，確保無任何元素受遮擋。
- 🔍 **極速全域與欄位比對**：支援品號 (Part No)、客戶名稱、中文品名規格、替代料號 (Alternates) 即時模糊與前綴檢索，提供鍵盤快捷鍵與全域排序。
- 🧬 **知識本體論與 43 組替代料號去重 (v7.10.1)**：
  - **43 組互為替代品號去重整合**：嚴格消除內部廠編與客戶/廠商料號之雙實體冗餘，實體精煉為 **984 筆規範品號**，100% 繼承所有 BOM 關聯與替代別名。
  - **本體約束門禁**：自動化校驗 BOM 雙向 100% 對稱、無自環循環依賴與替代品號反對稱性。
- 🏆 **五大庫別全量圖面結構化萃取與 OCR 融合大圓滿 (Grand Unification v7.10.6)**：
  - **1,503 份工程圖檔 100% 全量萃取與建檔**：
    1. **零件庫** (864 份)：射出成品圖檔 100% 材質與規格萃取。
    2. **組件庫** (304 份)：結構化展開 1,133 行 BOM 組成明細，39 筆掃描件光學 OCR 辨識。
    3. **SET 庫** (168 份)：輸液管延長套結構化展開 105 行 BOM 明細，102 筆掃描件 OCR 辨識，完成 55 筆跨目錄實體歸位。
    4. **物料庫** (139 份)：外箱標籤、包裝袋、說明書、收縮膜、紙箱全量規格萃取，60 筆掃描件 OCR 辨識。
    5. **原料庫** (28 份)：ICU 原料規格書 100% 材質、品牌、原廠編碼精準對齊，2 筆純掃描 OCR 辨識。
- 🛡️ **數據固化與防迴歸確效門禁 (`verifyCoreLogic.js`)**：
  - 於 `npm run build` 時自動運行 10 項核心測試，嚴格鎖定 984 筆去重品號、181 組 BOM 關聯階層、邊界防禦與本體約束。
  - 包含 CI 沙盒防禦模式（遵循 Zero Private Data 規範，跳過敏感離線檔測試）。
- 📊 **最新雙軌 SSOT 資料庫 (Master Table)**：
  - `data/pn-lookup-master.json`：包含 984 筆規範實體與完整規格之主資料庫。
  - `data/pn-lookup-master.xlsx`：包含「Master_Parts_物料主檔」（984 筆）、「Master_BOM_階層明細」（**1,788 行展開**）與「互為替代品號去重對照表」（43 組）。

---

## 📁 專案目錄結構 (MECE 原則)

```text
PN-Lookup/
├── .agents/                 # AI Agent 專案全域行為規則 (AGENTS.md)
├── .kiro/                   # Kiro 編輯器導向規則 (steering/ui-standards.md)
├── data/                    # [隱私隔離] 本地單一真實資料庫 (pn-lookup-master.json)
├── rawdata/                 # [隱私隔離] 原始 Excel 與工程圖檔
├── docs/                    # 技術規格文件（mapping-logic.md — 映射邏輯與品質數據）
├── scripts/                 # 資料處理與確效驗證腳本
│   ├── buildMaster.js       # Master Table 建置腳本（種子 → master）
│   ├── dev.js               # 一鍵並行啟動腳本 (Express API + Vite Dev Server)
│   ├── importICU.js         # ICU 原料料號對照表解析 → icu-parts.json
│   ├── scanAssemblyImages.js# 圖檔掃描增補 (--apply / --auto / --all / --parent-of)
│   ├── semanticExtract.js   # 圖檔語意識別全量批次 (多模型分工 + JSON/Excel 雙檔)
│   └── verifyCoreLogic.js   # 核心數據不變量與本體約束確效門禁
├── src/                     # 前端應用程式原始碼
│   ├── components/          # 視覺 UI 元件
│   │   ├── Header.tsx               # 頂部導覽與操作按鈕
│   │   ├── SearchControls.tsx       # 搜尋列與欄位篩選控制
│   │   ├── PartsTable.tsx           # 品號清單表格與五分類標籤
│   │   ├── PartDetailModal.tsx      # 品號詳情與 BOM 階層雙向展開
│   │   ├── AdminPanel.tsx           # 後台管理與 BOM 維護面板
│   │   ├── OrphanImagesModal.tsx    # 未對應孤兒圖檔管理中心
│   │   ├── ExportImportModal.tsx    # 資料備份、Excel / CSV 匯出匯入
│   │   ├── ImageBindModal.tsx       # 手動圖檔對應綁定彈窗
│   │   ├── ImageFolderModal.tsx     # 本地圖檔資料夾選擇彈窗
│   │   ├── BatchSearchModal.tsx     # 批次品號搜尋與比對對照
│   │   └── StatsBar.tsx             # 統計指標列
│   ├── utils/               # 邏輯與引擎工具庫
│   │   ├── alternates.ts        # 別稱去重規則
│   │   ├── bomEngine.ts         # BOM 階層雙向推導引擎
│   │   ├── bomService.ts        # BOM 持久化 (localStorage / API)
│   │   ├── customerPartImport.ts# 客戶品號 CSV 匯入解析
│   │   ├── excelExport.ts       # Excel/CSV 多工作表匯出引擎
│   │   ├── idb.ts               # IndexedDB 封裝 (OCR 快取)
│   │   ├── imageLibrary.ts      # 圖檔掃描與優化匹配演算法
│   │   ├── imageResolver.ts     # 檔名/綁定/OCR/本體語意推導 四階解析器
│   │   ├── jsonLdExport.ts      # Schema.org / JSON-LD 本體生成引擎
│   │   ├── ocr.ts               # Tesseract.js / pdf.js 本地 OCR 辨識引擎
│   │   ├── partNo.ts            # 品號前綴工具
│   │   ├── partsService.ts      # 品號資料服務 (localStorage / API)
│   │   └── serverStatus.ts      # 靜態模式旗標 (IS_STATIC_MODE)
│   ├── App.tsx              # 主應用程式入口與狀態控制
│   ├── main.tsx             # React 掛載入口
│   ├── types.ts             # PartItem / FilterState 型別定義
│   ├── version.ts           # APP_VERSION 單一版本真源
│   └── index.css            # 設計系統樣式與字型
├── .github/workflows/       # GitHub Actions (Pages 部署)
├── DEV_LOG.md               # 開發日誌與版本變更歷史 (RCA & CAPA)
├── index.html               # Web 頁面載入點 (Google Fonts)
├── server.js                # 本地 Express REST API 伺服器 (提供 /api/*，非 API 自動轉導 3000)
└── vite.config.ts           # Vite 建構設定檔
```

---

## 🚀 快速開始 (Quick Start)

### 1. 安裝依賴
```bash
npm install
```

### 2. 本地一鍵啟動 (後端 API + 前端唯一入口)
```bash
npm run dev
# 或 npm start
```
啟動後請直接訪問唯一的前端入口：**`http://localhost:3000/PN-Lookup/`**（後端 API 於 `http://localhost:3001` 運行，若意外訪問將自動轉址至 3000）。

### 3. 核心確效驗證與靜態建構
```bash
npm run build         # 自動運行 verifyCoreLogic.js 確效門禁並建置 dist/
```

---

## 📜 授權說明

專用內部工具，未經授權不得外傳。
