# PN-Lookup — 凱益醫療器材品號檢索與 BOM 階層管理系統 (v5.0.0)

PN-Lookup 是一款專為醫療耗材、射出件與規格配件打造的**高階品號檢索、圖檔自動超連結、BOM 階層展算與全瀏覽頁面雙軸心 2D/3D 產品知識圖譜平台**。

![Version](https://img.shields.io/badge/version-v5.0.0-indigo.svg)
![React](https://img.shields.io/badge/React-19.0.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-teal.svg)
![Security](https://img.shields.io/badge/Security-Zero%20Private%20Data-emerald.svg)

---

## 🌟 核心功能亮點

- 🔍 **極速全域與欄位比對**：支援品號 (Part No)、客戶名稱、中文品名規格、替代料號 (Alternates) 即時模糊與前綴檢索，提供鍵盤快捷鍵與全域排序。
- 🖼️ **圖檔全自動超連結與 0 孤兒圖檔管理**：
  - 全自動遞迴掃描 `rawdata/圖檔` 及其子資料夾下全數 **1,527 個工程圖面 (PDF/PNG/JPG)**。
  - 支援檔名高級正規化匹配（拆分括號 `()` 與修飾符號）、PDF 原生文字層提取與視覺 OCR 雙軌辨識。
  - 圖檔對應率達 **100.0%**（孤兒圖檔數 `0` 檔）。
- ⚡ **效能防禦按需 OCR 引擎 (On-Demand OCR)**：
  - 載入資料夾時僅讀取本地快取，零背景資源消耗。
  - 支援「孤兒圖檔手動批次辨識」與「單圖瞬時點擊辨識」，省時省 CPU 資源。
- 🌳 **雙向 BOM 階層展算引擎**：
  - 即時反查 SA / SB / SC / SD 階層組件與單品零件關聯。
  - 支援從組件向下展開零件清單，或從單品零件向上追蹤影響的組件。
- 🔒 **ISO 13485 / GMP 權限與數據維護分工**：
  - 前端檢索預設「全頁面唯讀管制」，保障現場數據安全。
  - 管理者連續 5 擊連點認證解鎖後，方可進行前端品號更正修訂與切換至「後台管理 (增刪)」頁面。
- 📊 **多格式數據匯出與匯入 (Round-Trip)**：
  - 支援一鍵產生完整 Excel (.xlsx)、CSV 與 JSON 報表。
  - 包含 SA/SB/SC/SD 頁籤與 **132 筆組件英文品名 (`組立名稱(英)`)** 對照。
- 🎨 **Taste-Skill 次世代美學 UI 介面**：
  - 導入 Google Fonts (`Inter` + `JetBrains Mono` 等購/等寬字體)。
  - 具備 Morandi 莫蘭迪分級標籤與高階 `glass-header` 毛玻璃視覺體驗。
- 🛡️ **資安與數據實體隔離 (Zero Private Data Security Patch)**：
  - 靜態編譯包 (`dist/assets/*.js`) 100% 零私有數據。
  - 本地 Server 模式由 `node server.js` 動態讀寫 `data/pn-lookup-master.json`（已列入 `.gitignore`）。

---

## 📁 專案目錄結構 (MECE 原則)

```text
PN-Lookup/
├── data/                    # [隱私隔離] 本地單一真實資料庫 (pn-lookup-master.json)
├── rawdata/                 # [隱私隔離] 原始 Excel 與 1,527 份工程圖檔
├── src/                     # 前端應用程式原始碼
├── components/          # 視覺 UI 元件 (MECE 分類)
│   ├── Header.tsx           # 頂部導覽與全域功能按鈕
│   ├── SearchControls.tsx   # 搜尋列與進階排序控制
│   ├── PartsTable.tsx       # 品號清單表格與 Morandi 標籤
│   ├── PartDetailModal.tsx  # 品號詳情與 BOM 階層雙向展開
│   ├── AdminPanel.tsx       # 後台管理與 BOM 維護面板
│   ├── OrphanImagesModal.tsx# 未對應孤兒圖檔管理中心
│   ├── ExportImportModal.tsx# 資料備份與多格式匯出匯入
│   ├── ImageBindModal.tsx   # 手動圖檔對應綁定彈窗
│   ├── ImageFolderModal.tsx # 本地圖檔資料夾選擇彈窗
│   ├── AddEditModal.tsx     # 品號資料新增/修改彈窗
│   ├── BatchSearchModal.tsx # 批次品號搜尋與比對對照
│   └── StatsBar.tsx         # 統計指標列 (Morandi 微卡片)
├── utils/               # 邏輯與引擎工具庫
│   ├── imageLibrary.ts      # 圖檔掃描與優化匹配演算法
│   ├── imageResolver.ts    # 檔名/綁定/OCR 三階解析器
│   ├── bomEngine.ts        # BOM 階層雙向推導引擎
│   ├── excelExport.ts      # Excel/CSV 多工作表匯出引擎
│   ├── ocr.ts              # Tesseract.js / pdf.js 本地 OCR 辨識引擎
│   ├── assemblyEnglishMap.json # 132 筆組件英文品名對照
│   └── ...
├── App.tsx              # 主應用程式入口與狀態控制
└── index.css            # Taste-Skill 設計系統樣式與字型
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
npm run start         # 自動建構 dist/ 並啟動 Express 伺服器 (http://localhost:3000)
```

---

## 📜 授權說明

專用內部工具，未經授權不得外傳。