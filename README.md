# PN-Lookup — 凱益醫療器材品號檢索與 BOM 階層管理系統 (v7.9.4)

PN-Lookup 是一款專為醫療耗材、射出件與規格配件打造的**高階品號檢索、圖檔自動超連結、BOM 階層展算與物料類別五分類管理平台**。

![Version](https://img.shields.io/badge/version-v7.9.4-slate.svg)
![React](https://img.shields.io/badge/React-19.0.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-teal.svg)
![Security](https://img.shields.io/badge/Security-Zero%20Private%20Data-emerald.svg)

---

## 🌟 核心功能亮點

- 🔍 **極速全域與欄位比對**：支援品號 (Part No)、客戶名稱、中文品名規格、替代料號 (Alternates) 即時模糊與前綴檢索，提供鍵盤快捷鍵與全域排序。
- 🧬 **知識本體論 (Knowledge Ontology)**：
  - **本體約束門禁**：自動化校驗 BOM 雙向 100% 對稱、無自環循環依賴與替代品號反對稱性。
  - **語意推理圖檔匹配**：當單品無直接圖檔時，自動沿 `usedInAssemblies` 父組件關係鏈推導圖面，並顯性標註「語意推導」徽章。
- 🛡️ **數據固化與防迴歸確效門禁 (`verifyCoreLogic.js`)**：
  - 於 `npm run build` 時自動運行 12 項測試，鎖定 1027 筆品號、181 組 BOM 關聯階層、邊界防禦與本體約束。
  - 包含 CI 沙盒防禦模式（遵循 Zero Private Data 規範，跳過敏感離線檔測試）。
- 📑 **圖檔材質 100% 提取覆蓋與組件判定引擎（v7.9.3~v7.9.4）**：
  - `extract_drawings_v7.py`：圖面資料全面覆蓋 967 筆圖檔，**材質覆蓋率達 100.0%（0 筆遺漏）**。
  - **組件判定引擎**：建立多維特徵識別，全庫識別出 101 筆組件圖檔（涵蓋 52 種實體組件品號），消除「組件誤標為零件」之分類偏差。
- 🧠 **圖檔語意識別全量批次（v7.9.0~v7.9.1）**：
  - `semanticExtract.js`：1492 張工程圖全量多模型分工解析（agnes Gemini + laguna Claude + hy3 OpenAI），語意 BOM 提取 + JSON/Excel 雙檔輸出。
  - 語意 BOM 品號白名單過濾（`PN_RE` / `PN_JUNK_RE` / `PN_MOULDEX_RE` / `PN_MANUAL_BLACKLIST`），排除材質/模具號/尺寸雜訊。
- 🏷️ **五分類物料體系（v7.9.2）**：
  - **原料**（25）：ICU 原料料號對照表中的化學材料料號。
  - **物料**（137）：包裝/標籤/收縮膜等。
  - **零件**（552）：單品零件。
  - **組件**（181）：SA/SB/SC/SD 組立 + 其他組件。
  - **SET**（114）：含輸液管的組件（MDXE/MDXI 全系列 + 手動清單）。
- 📊 **ICU 原料料號對照表導入（v7.9.2）**：
  - `importICU.js`：解析 167 筆零件×原料對照資料（8 種客戶：ICU/MDX/GVS/CardioMed/SIMS/Bard/RMS/PFM），覆蓋既有材料規格 + 新增品項。
- 🏷️ **欄位篩選與物料類別**：
  - 主搜尋列下方欄位篩選列：客戶 / 品號 / 物料類別 / 品名（可與 keyword AND 組合）；物料類別五分類下拉篩選。
- 🖼️ **圖檔全自動超連結與 0 孤兒圖檔管理**：
  - 全自動遞迴掃描工程圖面檔，支援檔名高級正規化匹配、PDF 文字層提取、視覺 OCR 與本體語意推導多軌解析。
- 🔄 **圖檔反向識別**：
  - 自所有已辨識圖檔內文中，自動找出「該品號可組成哪些產品」（上層組件候選），一鍵加入 BOM 關聯。
- ⚡ **效能防禦按需 OCR 引擎 (On-Demand OCR)**：
  - 載入資料夾時僅讀取本地快取，零背景資源消耗。
- 🔒 **ISO 13485 / GMP 權限與數據維護分工**：
  - 前端預設唯讀，管理者連續 5 擊認證後可解鎖後台編輯與維護。

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
├── server.js                # 本地 Express REST API 伺服器
└── vite.config.ts           # Vite 建構設定檔
```

---

## 🚀 快速開始 (Quick Start)

### 1. 安裝依賴
```bash
npm install
```

### 2. 本地開發模式 (伺服器 + REST API)
```bash
npm run dev
```

### 3. 一鍵建構與生產部署
```bash
npm run start         # 自動建構 dist/ 並啟動 Express 伺服器 (http://localhost:3001)
```

---

## 📜 授權說明

專用內部工具，未經授權不得外傳。
