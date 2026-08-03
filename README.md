# PN-Lookup — 凱益醫療器材品號檢索與 BOM 階層管理系統 (v7.1.0)

PN-Lookup 是一款專為醫療耗材、射出件與規格配件打造的**高階品號檢索、圖檔自動超連結、BOM 階層展算與產品思維導圖 (MindMap) 平台**。

![Version](https://img.shields.io/badge/version-v7.1.0-indigo.svg)
![React](https://img.shields.io/badge/React-19.0.1-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-blue.svg)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-v4.0-teal.svg)
![Security](https://img.shields.io/badge/Security-Zero%20Private%20Data-emerald.svg)

---

## 🌟 核心功能亮點

- 🔍 **極速全域與欄位比對**：支援品號 (Part No)、客戶名稱、中文品名規格、替代料號 (Alternates) 即時模糊與前綴檢索，提供鍵盤快捷鍵與全域排序。
- 🌳 **產品分類思維導圖 (MindMap Tree v5.4.0)**：
  - 基於 D3 座標轉置軸與動態適應性間距，提供直覺的產品結構展開與滾動檢視。
  - 完整支援雙擊卡片展開/收合、未分類品號包覆與點擊預覽工程圖面微縮彈窗。
- 🛡️ **數據固化與防迴歸確效門禁 (`verifyCoreLogic.js`)**：
  - 於 `npm run build` 時自動運行測試，鎖定 565 筆去重品號、181 組 BOM 關聯階層與圖檔邊界匹配防禦。
  - 包含 CI 沙盒防禦模式（遵循 Zero Private Data 規範，跳過敏感離線檔測試）。
- 🖼️ **圖檔全自動超連結與 0 孤兒圖檔管理**：
  - 全自動遞迴掃描工程圖面檔，支援檔名高級正規化匹配、PDF 文字層提取與視覺 OCR 雙軌辨識。
- ⚡ **效能防禦按需 OCR 引擎 (On-Demand OCR)**：
  - 載入資料夾時僅讀取本地快取，零背景資源消耗。
- 🔒 **ISO 13485 / GMP 權限與數據維護分工**：
  - 前端預設唯讀，管理者連續 5 擊認證後可解鎖後台編輯與維護。

---

## 📁 專案目錄結構 (MECE 原則)

```text
PN-Lookup/
├── .agents/                 # AI Agent 專案全域行為規則 (AGENTS.md)
├── data/                    # [隱私隔離] 本地單一真實資料庫 (pn-lookup-master.json)
├── rawdata/                 # [隱私隔離] 原始 Excel 與工程圖檔
├── scripts/                 # 資料處理與確效驗證腳本
│   ├── buildMaster.js       # Master Table 建置腳本
│   └── verifyCoreLogic.js   # 核心數據不變量與防迴歸確效門禁 (npm run build 前置檢查)
├── src/                     # 前端應用程式原始碼
│   ├── components/          # 視覺 UI 元件 (MECE 分類)
│   │   ├── Header.tsx           # 頂部導覽與全域功能按鈕
│   │   ├── SearchControls.tsx   # 搜尋列與欄位篩選控制
│   │   ├── PartsTable.tsx       # 品號清單表格與 Morandi 標籤
│   │   ├── PartDetailModal.tsx  # 品號詳情與 BOM 階層雙向展開
│   │   ├── AdminPanel.tsx       # 後台管理與 BOM 維護面板
│   │   ├── ProductMindMapModal.tsx # 產品分類思維導圖與樹狀展開 (react-d3-tree)
│   │   ├── OrphanImagesModal.tsx# 未對應孤兒圖檔管理中心
│   │   ├── ExportImportModal.tsx# 資料備份與多格式匯出匯入
│   │   ├── ImageBindModal.tsx   # 手動圖檔對應綁定彈窗
│   │   ├── ImageFolderModal.tsx # 本地圖檔資料夾選擇彈窗
│   │   ├── AddEditModal.tsx     # 品號資料新增/修改彈窗
│   │   ├── BatchSearchModal.tsx # 批次品號搜尋與比對對照
│   │   └── StatsBar.tsx         # 統計指標列 (Morandi 微卡片)
│   ├── utils/               # 邏輯與引擎工具庫
│   │   ├── imageLibrary.ts      # 圖檔掃描與優化匹配演算法
│   │   ├── imageResolver.ts    # 檔名/綁定/OCR 三階解析器
│   │   ├── bomEngine.ts        # BOM 階層雙向推導引擎
│   │   ├── excelExport.ts      # Excel/CSV 多工作表匯出引擎
│   │   ├── mindmapClassifier.ts# 思維導圖產品分類引擎
│   │   ├── ocr.ts              # Tesseract.js / pdf.js 本地 OCR 辨識引擎
│   │   ├── assemblyEnglishMap.json # 132 筆組件英文品名對照
│   │   └── ...
│   ├── App.tsx              # 主應用程式入口與狀態控制
│   └── index.css            # Taste-Skill 設計系統樣式與字型
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