# PN-Lookup — 凱益醫療器材品號檢索與 BOM 階層管理系統 (v7.7.1)

PN-Lookup 是一款專為醫療耗材、射出件與規格配件打造的**高階品號檢索、圖檔自動超連結、BOM 階層展算、3D 空間花瓣產品思維導圖與知識本體論 (Ontology) 平台**。

![Version](https://img.shields.io/badge/version-v7.7.1-indigo.svg)
![React](https://img.shields.io/badge/React-19.0.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-teal.svg)
![Security](https://img.shields.io/badge/Security-Zero%20Private%20Data-emerald.svg)

---

## 🌟 核心功能亮點

- 🔍 **極速全域與欄位比對**：支援品號 (Part No)、客戶名稱、中文品名規格、替代料號 (Alternates) 即時模糊與前綴檢索，提供鍵盤快捷鍵與全域排序。
- 🪐 **3D 空間花瓣產品思維導圖 (ProductMindMap3DModal v7.7.1)**：
  - 基於 Three.js 空間球殼向度演算法，消除 2D 導圖「看得到全局卻看不清局部」的視角拉伸問題。
  - 支援點擊節點自動在 3D 空間中動態展開子分類與品號，智能平滑相機對焦與路徑粒子提亮。
  - 即時父子從屬側邊欄：祖先麵包屑路徑穿梭導航、BOM 雙向組成清單、工程圖檔預覽與一鍵查 BOM。
- 🧬 **知識本體論 (Knowledge Ontology) 3 大輕量級優化**：
  - **本體約束門禁**：自動化校驗 BOM 雙向 100% 對稱、無自環循環依賴與替代品號反對稱性。
  - **語意推理圖檔匹配**：當單品無直接圖檔時，自動沿 `usedInAssemblies` 父組件關係鏈推導圖面，並顯性標註「語意推導」徽章。
  - **Schema.org / JSON-LD 標準匯出**：產出符合國際 W3C / Schema.org (`@type: "MedicalDevice"`) 標準之知識本體檔案，支援 OS 原生另存新檔。
- 🛡️ **數據固化與防迴歸確效門禁 (`verifyCoreLogic.js`)**：
  - 於 `npm run build` 時自動運行 11 項測試，鎖定 693 筆種子去重品號、181 組 BOM 關聯階層、邊界防禦與本體約束。
  - 包含 CI 沙盒防禦模式（遵循 Zero Private Data 規範，跳過敏感離線檔測試）。
- 🖼️ **圖檔全自動超連結與 0 孤兒圖檔管理**：
  - 全自動遞迴掃描工程圖面檔，支援檔名高級正規化匹配、PDF 文字層提取、視覺 OCR 與本體語意推導多軌解析。
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
├── docs/                    # 技術規格文件 (data-mapping.html — 欄位映射規格)
├── scripts/                 # 資料處理與確效驗證腳本
│   ├── buildMaster.js       # Master Table 建置腳本（種子檔 → pn-lookup-master.json）
│   ├── scanAssemblyImages.js# 組件圖 PDF 文字層掃描增補 (--apply / --auto)
│   └── verifyCoreLogic.js   # 核心數據不變量與本體約束確效門禁 (npm run build 前置檢查)
├── src/                     # 前端應用程式原始碼
│   ├── components/          # 視覺 UI 元件 (MECE 分類)
│   │   ├── Header.tsx               # 頂部導覽與 3D 思維導圖入口按鈕
│   │   ├── SearchControls.tsx       # 搜尋列與欄位篩選控制
│   │   ├── PartsTable.tsx           # 品號清單表格與 Morandi 標籤
│   │   ├── PartDetailModal.tsx      # 品號詳情與 BOM 階層雙向展開
│   │   ├── AdminPanel.tsx           # 後台管理與 BOM 維護面板
│   │   ├── ProductMindMap3DModal.tsx# 3D 空間花瓣產品思維導圖與從屬抽屜
│   │   ├── OrphanImagesModal.tsx    # 未對應孤兒圖檔管理中心
│   │   ├── ExportImportModal.tsx    # 資料備份、Excel / CSV / JSON-LD 本體匯出匯入
│   │   ├── ImageBindModal.tsx       # 手動圖檔對應綁定彈窗
│   │   ├── ImageFolderModal.tsx     # 本地圖檔資料夾選擇彈窗
│   │   ├── BatchSearchModal.tsx     # 批次品號搜尋與比對對照
│   │   └── StatsBar.tsx             # 統計指標列 (Morandi 微卡片)
│   ├── utils/               # 邏輯與引擎工具庫
│   │   ├── alternates.ts        # 別稱去重規則 (dedupeAlternates)
│   │   ├── assemblyEnglishMap.json # 132 筆組件英文品名對照
│   │   ├── bomEngine.ts         # BOM 階層雙向推導引擎
│   │   ├── bomService.ts        # BOM 持久化 (localStorage / API)
│   │   ├── customerPartImport.ts# 客戶品號 CSV 匯入解析
│   │   ├── excelExport.ts       # Excel/CSV 多工作表匯出引擎
│   │   ├── idb.ts               # IndexedDB 封裝 (OCR 快取)
│   │   ├── imageLibrary.ts      # 圖檔掃描與優化匹配演算法
│   │   ├── imageResolver.ts     # 檔名/綁定/OCR/本體語意推導 四階解析器
│   │   ├── jsonLdExport.ts      # Schema.org / JSON-LD 本體生成引擎
│   │   ├── mindmapClassifier.ts # 產品思維導圖分類引擎與標籤常數
│   │   ├── ocr.ts               # Tesseract.js / pdf.js 本地 OCR 辨識引擎
│   │   ├── partNo.ts            # 品號前綴工具 (getPartPrefix)
│   │   ├── partsService.ts      # 品號資料服務 (localStorage / API)
│   │   └── serverStatus.ts      # 靜態模式旗標 (IS_STATIC_MODE)
│   ├── App.tsx              # 主應用程式入口與狀態控制 (動態代碼分割)
│   ├── main.tsx             # React 掛載入口
│   ├── types.ts             # PartItem / FilterState 型別定義
│   ├── types/               # 全域環境型別宣告 (file-system-access.d.ts)
│   ├── version.ts           # APP_VERSION 單一版本真源
│   └── index.css            # Taste-Skill 設計系統樣式與字型
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