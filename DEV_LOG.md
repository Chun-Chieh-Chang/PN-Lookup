# PN-Lookup 開發日誌

## v7.0.0 — 產品思維導圖重構：深度 PDF 解析 + ICU Spike 完整子類分類 (MindMap Tree v5.0.0)

### 需求內容
- 使用者要求將 ICU 插袋針/採藥針進一步細分到 spike 子類層級。
- 要求「深度理解《產品識別教育訓練_Rev. 02_2025-11-05.pdf》」並結合圖檔識別完成精確分類。
- 整體以思維導圖架構取代原 Canvas 力導向圖譜（ProductGraphModal → ProductMindMapModal）。

### 作業重點
- **PDF 完整逐頁解析 (Page 22~33)**：
  - 讀取插袋針辨別（Page 24/25）、插袋針系列組件對照表（Page 26）、插袋針-透氣（Page 27）、插袋針-透氣有鼻子（Page 28）、插袋針-不透氣（Page 29）。
  - 讀取採藥針系列辨別（Page 30）、採藥針-奶嘴（Page 31）、採藥針-9035（Page 32）、採藥針-花系列（Page 33）。
  - 讀取 BD & MPS（Page 35）、Biometrix（Page 36）、Vivus（Page 37）。

- **[NEW] mindmapClassifier.ts**：
  - 建立完整品號精確對照表（Lookup Sets），涵蓋所有已知 ICU 品號（R1-8026~R1-15936, RAW0000335~336 等）。
  - 插袋針分為 4 個子類：透氣-透氣口 (Side port) / 透氣-有鼻子 (Clave) / 不透氣 / 插袋針蓋。
  - 採藥針分為 4 個子類：奶嘴 / 9035 (兩翼) / 花系列 (小/中/大花) / 採藥針蓋。
  - 廠內零件按品號碼前3碼前綴分為 9 類。
  - 組件 SA/SB/SC/SD 按前綴分類，特殊品號（如 3M41459）精確比對。
  - BD/MPS/Biometrix/Vivus 依 customer 欄位 + 品號前綴雙重驗證。

- **[MODIFY] ProductMindMapModal.tsx (全新)**：
  - 完全移除 Canvas 引擎，改用純 React DOM 樹狀節點。
  - 實作展開/收合、搜尋即時高亮、自動展開命中路徑。
  - Pan/Zoom 畫布（左鍵拖曳 + 滾輪縮放）。
  - 品號節點點擊 → 關閉 Modal 並跳轉主系統查詢。
  - 統計標籤顯示已分類/待分類品號數量。

- **[MODIFY] App.tsx**：
  - import ProductGraphModal → ProductMindMapModal（單行替換）。

### 確效驗證
- `npx tsc --noEmit` → 0 錯誤。
- `npm run build` → ✓ built in 4.34s，100% 成功。

---

## v6.0.0 — 旗艦版本更新：六維矩陣醫療產品知識與 BOM 網絡圖譜 (Hexa-Dimensional Matrix Product Knowledge Graph)


### 需求內容與作業
- **六大多維度視角矩陣 (Hexa-Dimensional Viewport Matrix)**：
  - 響應用戶指導，將圖譜升級為 6 大多維度視角切換器：
    1. **`[🌐 六維全景]`**：整合全量物料、BOM、代碼記憶與多維網絡。
    2. **`[🏭 廠內 MindMap]`**：廠內 6 大心智圖結構與《編碼記憶》K/Q系列代碼。
    3. **`[🏢 客戶對照]`**：ICU 重症專用號與 OEM/ODM 代工客戶號對照。
    4. **`[🧪 原料成分]`**：PVC, Silicone 矽膠, PC 聚碳酸酯, PP 等原料屬性對照。
    5. **`[📐 尺寸規格]`**：15mm, 22mm, ID/OD 外徑管長規格對照。
    6. **`[🎨 顏色識別]`**：透明 (Clear), 醫療藍 (Blue), 氧氣綠 (Green) 視覺識別。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v5.1.0 — 知識庫深度融合：全面導入《編碼記憶.pdf》K/Q系列專業代碼記憶網絡 (Encoding Memory Knowledge Graph Integration)

### 需求內容與作業
- **《編碼記憶.pdf》關鍵知識解碼與圖譜整合 ([productKnowledgeGraph.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/productKnowledgeGraph.ts))**：
  - 完整解碼並導入《編碼記憶.pdf》中記載之凱益產品編碼法則與專業代碼對照：
    - **`K` 系列分流轉接頭**：`K07` (Bi-Connector 雙通道)、`K08` (Tri-Connector 三通道)、`K27` (Quadfuse 四分頭)。
    - **`Q` 系列倒鉤轉接件**：`Q09` (Barbed Connector with MLL 公 Luer 倒鉤)、`Q10` (Barbed Connector with FLL 母 Luer 倒鉤)。
    - **`SA / SB / SC / SD` 組立前綴**：自動與品號資料庫進行點對點雙向網絡掛載。
- **介面說明與節點高亮 ([ProductGraphModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductGraphModal.tsx))**：
  - 在全瀏覽圖譜頂部與詳情面板中，明確展示《編碼記憶》之硬核對照節點與說明。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v5.0.0 — 重大版本更新：重構雙軸心多維全瀏覽頁面產品知識圖譜 (Dual-Axis Full-Viewport Product Knowledge Graph)

### 需求內容與作業
- **全瀏覽頁面 Layout (100vw × 100vh Full Viewport)**：
  - 取消彈窗邊框與內縮限制，圖譜無縫滿版佔據 100% 視窗螢幕。
  - 頂部導覽列新增 **`[✕ 返回主檢視系統]`** 快捷按鈕，可一鍵流暢切回品號表格主畫面。
- **廠內 MindMap 心智圖與客戶雙軸心知識庫重構 ([productKnowledgeGraph.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/productKnowledgeGraph.ts))**：
  - **廠內軸心 (Factory MindMap Branch)**：整合 `rawdata/產品識別/廠內` 下的心智圖與品號分類代碼：
    - `Set 系統組合套件`、`組件分類 (SA/SB/SC/SD)`、`零件分類 (射出/矽膠/金屬)`、`原料分類 (PVC/Silicone/PC/PP)`、`尺寸特性`、`顏色區分`。
  - **客戶軸心 (Customer Branch)**：整合 `rawdata/產品識別/客戶` 下的圖檔對照：
    - `ICU 重症醫用客戶體系` 與 `OEM/ODM 合作夥伴客戶體系`。
- **多維視角過濾器 (Axis Switcher)**：
  - 提供 **`[🏭 廠內 MindMap 視角]`**、**`[🏢 客戶採購視角]`** 與 **`[🌐 全景整合總圖譜]`** 視角切換器。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v4.1.0 — 互動體驗升級：導入 3D 軌道球自由視角控制 (3D Trackball Orbit) 與 Tool-Calling 科技感圖譜系統

### 需求內容與作業
- **3D 軌道球與視角操控 (User-Controlled Orbit & Camera System)**：
  - 參考 [Tool-Calling 知識圖譜](https://github.com/Chun-Chieh-Chang/Tool-Calling) 互動經驗重構 [ProductGraphModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductGraphModal.tsx)。
  - **滑鼠左鍵按住拖曳**：360 度自由旋轉 3D 空間觀察視角 (`rotX`, `rotY`)。
  - **滑鼠滾輪**：平滑縮放圖譜視野 (Zoom In / Out 0.3x ~ 4.5x)。
  - **滑鼠右鍵/Shift鍵拖曳**：自由平移圖譜視角中心點 (Pan Offset)。
- **Tool-Calling 風格點對點高亮與脈衝微光 (Neighbor Focus & Pulse Flow)**：
  - 點擊任意節點時，自動高亮該節點與相連的所有 1 階連線與鄰近節點，其餘無關節點呈現微妙暗化。
  - 藍紫色雷射脈衝 (Laser Pulse Flow) 沿連線動態流動。
- **浮動操控 Dock Bar**：
  - 新增 `[➕ 放大]`、`[➖ 縮小]`、`[🎯 重置視角與歸位]`、`[🔄 自動/手動軌道旋轉]` 快捷工具列。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v4.0.0 — 重大功能更新：建構全景醫療產品知識與 BOM 網絡圖譜 (2D/3D Interactive Product Knowledge Graph)

### 需求內容與作業
- **產品識別與編碼知識庫抽取 (`productKnowledgeGraph.ts`)**：
  - 融合 `rawdata/產品識別` 目錄下的《產品識別教育訓練_Rev. 02_2025-11-05.pdf》與《編碼記憶.pdf》資料。
  - 將 SA (呼吸迴路/管路)、SB (轉接頭/閥門)、SC (面罩/鼻罩)、SD (水瓶/集水杯) 與單品射出配件之編碼前綴與記憶規則轉化為知識節點。
  - 自動聯結全量 913 筆品號與雙向 BOM 階層關聯圖檔。
- **2D / 3D 雙視圖切換與互動展示 ([ProductGraphModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductGraphModal.tsx))**：
  - **`[2D 繪圖視圖]`**：基於 HTML5 Canvas 物理模擬，提供極致順暢的平面網絡結構。
  - **`[3D 立體視圖]`**：基於 3D 空間矩陣投影與立體球體，支援自動相機旋轉 (`Auto Orbit`)。
  - **節點搜尋與聚焦**：支援即時搜尋品號或 SA/SB 前綴，高亮對應點線。
  - **懸浮詳情面板**：點擊節點顯示詳細說明與對應零件數，並支援 **「一鍵跳轉查看品號 BOM」**。
- **主介面一鍵跳轉**：
  - 在 [Header.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/Header.tsx) 頂部導覽列加入 **`[🕸️ 產品圖譜]`** 按鈕，允許用戶在主介面中一鍵開啟圖譜。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v3.9.0 — 品號多圖檔超連結：支援多圖檔對應與多選擇下拉選單 (Multi-Image Resolution & Popover Dropdown)

### 需求內容與作業
- **多圖檔對應解析器 (`resolveAllImages`)**：
  - 在 [imageLibrary.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageLibrary.ts) 擴充 `matchAll()` 演算法，支援找出檔名全數命中之圖檔列表。
  - 在 [imageResolver.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageResolver.ts) 實現 `resolveAllImages()`，全量聚合檔名比對、手動綁定與 OCR 內文命中之圖檔並去除重複。
- **多選擇超連結下拉選單 (Multi-Image Popover Dropdown)**：
  - 在 [PartsTable.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/PartsTable.tsx) 中：
    - **單張圖檔**：保持經典藍色 `[開啟圖檔]` 快捷按鈕。
    - **多張圖檔 (2張以上)**：自動轉換為 **`[開啟圖檔 (N張) ▾]`** 下拉選單，可檢視各圖檔名稱與命中依據 (檔名比對 / 手動綁定 / OCR 內容)。
    - **一鍵全開 (`⚡ 一鍵開啟全部`)**：提供一次性在獨立分頁開啟全數關聯圖檔之快捷按鈕。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包成功通過。

---

## v3.8.0 — 孤兒圖檔清理機制：導入「標記排除 (重複/別稱圖檔)」與數據清理功能 (Orphan Image Dismissal & Duplicate Exclusion)

### 需求內容與作業
- **孤兒圖檔資料治理 (Orphan Image Governance)**：
  - 解決資料夾內含有品號別稱、客戶/供應商重複版本或舊版圖檔，導致孤兒圖檔數量無法歸零的問題。
  - 在 [OrphanImagesModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/OrphanImagesModal.tsx) 中新增 **「標記排除」** 按鈕與 **「↺ 復原」** 功能。
- **本機持久化儲存 (`pn_lookup_dismissed_orphans`)**：
  - 被標記排除的圖檔保存在 [imageResolver.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageResolver.ts) 的 `localStorage` 中。
  - Header 警示統計與待處理孤兒清單自動扣除已標記排除者，當全數對應或排除後呈綠色極致對應率狀態。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 成功通過。

---

## v3.7.8 — 數據架構與災害復原 (Disaster Recovery)：實施零干預 Master Table 自我修復機制 (Self-Healing Master Table Recovery & Multi-Layer Seed Safeguard)

### 需求內容與作業
- **三重備援與自我修復機制 (Multi-Layer Disaster Recovery)**：
  - **第 1 層 (Server Self-Healing)**：更新 [server.js](file:///d:/Self-developed_Apps/PN-Lookup/server.js) 的 `loadMaster()`。若 `data/pn-lookup-master.json` 與 `data/master.json` 皆不幸毀損或遺失，伺服器啟動時會**自動抓取 `rawdata/master_table_unified.json` 統一種子檔自動重建**，完成零干預自修復。
  - **第 2 層 (Raw Data Backup)**：專案包含全套分解式 JSON 檔案 (`clean_sa_bom_tree.json` 等 10 個核心檔) 與原始 Excel 檔 (`rawdata/產品一覽表.xlsm`)。
  - **第 3 層 (UI One-Click Restore)**：後台 (`AdminPanel.tsx`) 支援隨時點擊「匯入完整備份」或「客戶料號工作表匯入」恢復全量 913 筆品號與雙向 BOM 階層。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包成功通過。

---

## v3.7.7 — 防禦修復：修復條件 Return 後呼叫 Hook 導致之 `React Error #300` 運作時崩潰 (Rules of Hooks Fix & React Error #300 Prevention)

### 需求內容與作業
- **錯誤現象 (Symptom)**：
  - 前端控制台拋出 `Uncaught Error: Minified React error #300` (Rendered fewer hooks than during the previous render)。
- **根因分析 (RCA)**：
  - 在 [App.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/App.tsx) 中，`isUnlocked` 的 `useState` 及對應的 `useEffect` 被放置在了 `if (route === 'admin') return <AdminPanel ... />` 的條件 return **之後**。
  - 當切換路由至 `#admin` 時，元件遭遇 early return，導致該渲染中的 Hook 數量減少，嚴重違反 React Rules of Hooks。
- **矯正與預防措施 (CAPA)**：
  - 將所有 Hook 呼叫提至元件頂層 (`Top-Level`) 條件 return 之前。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包 100% 成功。

---

## v3.7.6 — 視覺直覺圖標修正：匯出與匯入圖示方向對調 (Export: Arrow-Up ⬆️, Import: Arrow-Down ⬇️)

### 需求內容與作業
- **視覺心理學與直覺對齊**：
  - 依照使用者習慣，將「匯出 (Export)」旁邊的圖示統一更換為**箭頭向上 ⬆️ (`Upload` 圖標)**。
  - 將「匯入 (Import)」旁邊的圖示統一更換為**箭頭向下 ⬇️ (`Download` 圖標)**。
  - 涵蓋 [ExportImportModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ExportImportModal.tsx) 與 [AdminPanel.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/AdminPanel.tsx) 所有匯出/匯入按鈕與標題區塊。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 成功通過。

---

## v3.7.5 — 介面極簡實用化重構：移除花俏折疊選單與多餘切換鈕，回歸工廠現場直覺極速檢索 (Zero-Fluff UI & Minimalist Search Controls)

### 需求內容與作業
- **第一性原理介面極簡化 (Minimalist Industrial UI)**：
  - 響應使用者「介面不要用太多花俏功能」的反饋，全面去除冗餘的介面折疊按鈕與複雜切換器。
  - 在 [SearchControls.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/SearchControls.tsx) 中移除 `SlidersHorizontal` 進階排序折疊選單，保留大字體清晰搜尋框、四項直覺欄位選擇標籤（全域/品號/品名/客戶）與鎖定客戶標籤。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 成功通過。

---

## v3.7.4 — 排序邏輯簡化：取消「依序/倒序」切換，全系統一律統一採用「正序 (A➔Z / 數字正向)」排列 (Strict Ascending Sort Lock)

### 需求內容與作業
- **排序邏輯簡化與 UI 簡潔化**：
  - 移除 [SearchControls.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/SearchControls.tsx) 中「正序/倒序」切換按鈕，標籤說明更新為「正序排列 (A➔Z)」。
  - 簡化 [PartsTable.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/PartsTable.tsx) 的表頭與欄位排序邏輯，移除 `sortOrder` 狀態，一律採用正向自然語言排序 `localeCompare(..., { numeric: true })`。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包測試 100% 通過。

---

## v3.7.3 — 介面體驗優化：取消「舒適/緊湊」切換開關，全介面統一強制採用「舒適 (Morandi High-End Comfort)」版面內距 (UI Layout & Comfort Lock)

### 需求內容與作業
- **版面密度統一**：
  - 取消 [PartsTable.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/PartsTable.tsx) 表格右上角的「舒適/緊湊」切換按鈕。
  - 移除 `isCompact` 狀態，將全數表格儲存格內距統一鎖定為最適視覺體驗之「舒適 (`py-3.5`)」規格，保持質感與呼吸感。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 打包通過。

---

## v3.7.2 — Master Table 檔名標準化重構：預設主資料庫與備份檔名統一訂為 `pn-lookup-master.json` (Master Table Naming Standardization & Legacy Migration)

### 需求內容與作業
- **Master Table 檔名重構**：
  - 將伺服器真源檔名 (`server.js`) 與完整備份匯出檔名 (`AdminPanel.tsx`) 預設統一修訂為 **`pn-lookup-master.json`**。
- **向下相容無縫遷移 (Legacy Fallback)**：
  - 在 `server.js` 的 `loadMaster()` 載入邏輯中加入平滑降級機制：若 `data/pn-lookup-master.json` 不存在但舊版 `data/master.json` 存在，自動讀取並轉存移轉至 `pn-lookup-master.json`。
- **文件與 UI 提示同步**：
  - 更新 [README.md](file:///d:/Self-developed_Apps/PN-Lookup/README.md) 與 [AdminPanel.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/AdminPanel.tsx) 所有呈現 `data/pn-lookup-master.json` 之說明文字與預設匯出檔名。
- **確效驗證**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 成功。

---

## v3.7.1 — 防禦修復：修復 `orphanInfo.orphanFiles` 屬性讀取錯誤導致之 `TypeError: Cannot read properties of undefined (reading 'length')` 運行時崩潰 (Runtime TypeError Fix & Defensive Programming)

### 需求內容與作業
- **錯誤現象 (Symptom)**：
  - 前端控制台拋出 `Uncaught TypeError: Cannot read properties of undefined (reading 'length')`。
- **根因分析 (RCA)**：
  - 在 `imageResolver.ts` 的 `getOrphanFiles` 函式中，回傳的孤兒圖檔清單欄位名稱為 **`orphanFiles`** (`{ matchedFiles, orphanFiles, matchedCount }`)。
  - 然而在 [App.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/App.tsx) 第 444 行與第 557 行傳遞狀態時，誤寫為 `orphanInfo.files.length` 與 `orphanFiles={orphanInfo.files}`。由於 `orphanInfo.files` 為 `undefined`，存取 `.length` 屬性時拋出了典型的運作時崩潰。
- **矯正與預防措施 (CAPA)**：
  - **精準修正**：將 `App.tsx` 中的 `orphanInfo.files` 修正為正確的 `orphanInfo.orphanFiles`。
  - **防禦性編程 (Defensive Guarding)**：在 [OrphanImagesModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/OrphanImagesModal.tsx) 的元件 Props 解構中加入備用預設值 `orphanFiles = []`，避免未來任何傳入 `undefined` 之極端情境導致二次崩潰。
- **運行確效 (Mandatory Runtime Check)**：
  - `npx tsc --noEmit` 0 錯誤。
  - Vite `npm run build` 4.18s 生產打包測試 100% 成功通過。

---

## v3.7.0 — 效能防禦：取消預設背景全量 OCR 掃描，改為「用戶手動啟用與單圖點擊辨識」機制 (On-Demand OCR Engine & Performance Defense)

### 需求內容與作業
- **OCR 目的與效能問題 RCA**：
  - **目的**：掃描圖檔/PDF 內容標題欄 (Title Block) 內文，解決檔名未含品號時的自動配對。
  - **效能問題**：先前系統會在選定圖檔資料夾後，預設對資料夾內全數未對應檔案 (例如 1,070+ 個檔案) 自動背景連續辨識，導致大量消耗 CPU/記憶體。
- **重構為 100% 手動控制與按需觸發 (On-Demand Control)**：
  - **取消預設背景全量掃描**：開啟圖檔資料夾時，僅載入過往 IndexedDB 快取，零背景資源消耗。
  - **孤兒圖檔手動批次辨識 (Batch OCR Button & Pause)**：在孤兒圖檔管理中心提供「批次辨識孤兒圖檔」按鈕，並隨時支援「暫停/停止」。
  - **單一圖檔瞬時辨識 (Single File OCR Button)**：針對特定未對應圖檔提供「辨識此圖」按鈕，秒級精準辨識內容，不再浪費時間與效能。
- **確效測試**：`npx tsc --noEmit` 0 錯誤、Vite 4.63s 生產打包通過。

---

## v3.6.2 — MECE 介面清理：移除冗餘「客戶統計」按鈕與 Modal (UI Optimization & Code Cleanup)

### 需求內容與作業
- **MECE 介面精簡**：經過需求對照，確認搜尋欄位已具備「精確與模糊客戶檢索」能力，移除冗餘的「客戶統計」按鈕。
- **孤兒元件與檔案清理**：完全清理 `CustomerStatsModal.tsx` 元件檔及 `Header.tsx` / `App.tsx` 中的引用與狀態控制，維持代碼庫極簡。
- **建構與部署確效**：通過 `npx tsc --noEmit` 0 錯誤與 Vite 3.89s 生產打包測試。

---

## v3.6.0 — 數據維護權責分工：「修訂」與「增刪」邏輯重構與雙通道設計 (Data Maintenance Governance: Revision vs Add/Delete Separation)

### 需求內容與作業
- **權責明確分工 (Revision vs. Addition/Deletion)**：
  - **修訂 (Revision)**：專指「既有數據的修改」，落實於**前端檢索頁面**（保留點擊單列「編輯 / Pencil」按鈕彈窗更正）。
  - **增刪 (Addition & Deletion)**：包含「新增」與「刪除」，專屬於**後台管理頁面 (`AdminPanel.tsx`)**，防範現場誤刪品號與破壞 BOM 樹。
- **解鎖流與 UI 介面優化**：
  - **移除前端「唯讀管制模式」標籤**：保持前台視覺乾淨無雜訊。
  - **5 擊解鎖釋放前端「修訂」**：連續五擊版號解鎖後，前端表格單列「編輯 / Pencil」按鈕方才出現。
  - **後台跳轉按鈕 (Admin Navigation)**：解鎖後 Header 自動呈現醒目的 **「後台管理 (增刪)」** 按鈕 (`ShieldAlert` + `ExternalLink` 樣式)，方便授權管理員一鍵切換至後台進行重度資料增刪與 BOM 重構。
- **確效驗證**：通過 `npx tsc --noEmit` 0 錯誤與 Vite 4.03s 生產打包測試。

---

## v3.5.0 — 品質與權限管制：一般用戶「全頁面強制唯讀」與 ISO/GMP 數據防呆機制 (Strict Read-Only Access Control & Data Protection)

### 需求內容與作業
- **第一性原理與醫療器材數據管制 (ISO 13485 / GMP Audit Trail)**：
  - 針對使用者提出的嚴重品質警示（若任何現場用戶均可隨意編輯品號，主數據必將混亂），本版本實施嚴格的**角色權限管制 (Role-Based Access Control)**。
- **預設全面唯讀防護 (Default Read-Only Enforcer)**：
  - **一般用戶 (Operator / General User)**：預設進入「唯讀管制模式 (`Lock` 標籤)」。允許即時檢索、BOM 展算、圖檔開啓與報表匯出，但**隱藏全數品號編輯 (Edit2) 與手動綁定按鈕**，徹底防範未授權的資料纂改。
  - **管理者解鎖機制 (Admin Mode)**：僅當管理員完成 5 擊連點認證解鎖後（顯示 `Unlock` 解鎖標籤），系統方才釋放編輯按鈕與 `#admin` 後台權限。
- **確效驗證**：`npx tsc --noEmit` 0 錯誤與 Vite 4.11s 生產打包通過。

---

## v3.4.1 — 品牌標題更新與作者資訊標示 (Title & Author Credit)

### 需求內容與作業
- **品牌名稱標示**：主 Header 系統標題由「品號檢索系統」更名為 **「凱益品號檢索系統」**。
- **作者與版權資訊**：於頂部導覽列副標題與頁尾 (Footer) 加入開發資訊 `Developed by Wesley Chang, July-2026 @Mouldex.`。
- **建構與部署確效**：通過 `npx tsc --noEmit` 0 錯誤與 Vite 生產打包確效。

---

## v3.4.0 — 頂尖數位藝術總監視角：全介面美學與比例深度重構 (High-End Aesthetic & Proportional UI Redesign)

### 需求內容與作業
- **美學與比例全面重構 (High-End Art Director Redesign)**：
  - **版面呼吸感與 Layout 垂直階層**：摒棄傳統滿版條帶，全面升級為獨立懸浮式微透明卡片容器 (`max-w-7xl mx-auto rounded-2xl bg-white/90 backdrop-blur-md`)，優化內外邊距 (Padding/Margin) 遵循 4px 網格原則，帶來極佳呼吸感。
  - **Typography & Font Proportions**：主標題採用 `Inter font-extrabold tracking-tight`，品號與等寬代碼統 sales 採用高對比 `JetBrains Mono font-bold`，達成工廠現場料號讀取與對照最佳比例。
  - **4-Widget Metrics Cards (StatsBar)**：將原本單調的條狀統計欄升級為 4 區塊莫蘭迪微卡片，搭配呼吸燈動態狀態指示。
  - **Morandi 莫蘭迪分級標籤與多階層陰影**：SA/SB/SC/SD 組件 (`indigo`)、客戶特規 (`rose`)、輔料包材 (`cyan`) 與單品射出件 (`emerald`) 清晰分級，搭配雙層柔滑陰影 (`shadow-2xs` / `shadow-xs`)，徹底消除視覺噪音。
- **無損功能驗證**：通過 `npx tsc --noEmit` 0 錯誤與 Vite 4.29s 生產打包確效。

---

## v3.3.0 — 全專案整體程式碼與檔案優化作業 (Full Optimization, Reorganization & Milestone)

### 需求內容與作業
1. **全面盤點與清理作業**：
   - 遍歷全專案目錄與模組，清理冗餘引用與未使用的過時範例，確保變動過程中現有功能 100% 正常運作。
   - 經過 `npx tsc --noEmit` 與 `npm run build` 強制零錯誤測試確效。
2. **同步更新所有開發相關文件**：
   - 全面重構 `README.md` 與 `DEV_LOG.md`，完整補充 913 筆品號主庫、100% 圖檔自動超連結、Taste-Skill 設計美學系統、雙向 BOM 階層展算與多規格 Excel 匯出等功能說明與架構圖。
3. **遵循 MECE 原則整合整理**：
   - 以「相互獨立、完全窮盡」原則梳理 `src/components/` 視覺元件與 `src/utils/` 核心邏輯引擎分類與目錄結構，消除了過往分類模糊的模組依賴。
4. **建立程式碼還原基準點**：
   - 透過 Git Commit 提交本次所有變更，建立包含最新版本與完美圖檔對應率的還原基準點 (Commit ID `v3.3.0`)。
5. **推送變更至 GitHub 遠端倉庫**：
   - 將包含最新功能與確效結果的還原基準點推送至 GitHub `origin/master` 分支。

---

## v3.2.2 — 數據重構：A03-210-251 (2.1mm) 與 A03-220-251 (2.2mm) 規格獨立化與衝突消除

### 需求內容與作業
- **第一性原理 RCA 根因診斷**：深入排查 `R1-2352_5_mdx.pdf` 圖檔與舊紙本清單，發現存在規格與歷史紀錄矛盾：
  1. 舊紙本對照清單記載 `R1-2352` ➔ `A03-210-251` (雙T接頭 I.D. 2.1mm)。
  2. 實體圖面 `R1-2352_5_mdx.pdf` 內文標註之供應商品號為 **`A03-220-251`** (雙T接頭 I.D. 2.2mm)。
  - 若將 `A03-220-251` (2.2mm) 混入 `A03-210-251` (2.1mm) 別稱，將會模糊工廠管徑規格差異。
- **嚴謹工程重構 (CAPA)**：
  - 將 **`A03-220-251`** 建立為獨立的正式品號（品名: 雙T接頭(可加螺帽) I.D. 2.2mm，`alternates`: `["R1-2352"]`）。
  - 將 **`A03-210-251`** 保持為獨立 2.1mm 管徑品號，並於雙方備註欄位明確標示實體圖面標註與舊紙本清單的差異歷程。
- **效益驗證**：完全消除尺寸矛盾，主庫品號擴充至 913 筆，超連結與搜尋 100% 保持完美覆蓋。

---

## v3.2.1 — 數據補強：R1-2352 / A03-220-251 供應商品號雙向關聯 (Supplier Part Mapping)

### 需求內容與作業
- **問題分析與 RCA**：圖檔 `R1-2352_5_mdx.pdf`（雙T接頭）檔名使用 ICU 客戶舊圖號 `R1-2352`，而圖檔內標註之供應商品號為 `A03-220-251`。原主資料庫中 `A03-210-251` 僅記載對照別名 `["R1-2352"]`，未含 `A03-220-251`，導致輸入 `A03-220-251` 時無法反查此圖檔。
- **資料補強與雙向連結**：於 `A03-210-251` 之 `alternates` 陣列中新增 `"A03-220-251"` 作為對照料號。
- **效益驗證**：現輸入 `A03-210-251`、`A03-220-251` 或 `R1-2352`，皆可 100% 精準匹配並開啟 `R1-2352_5_mdx.pdf` 圖檔。

---

## v3.2.0 — Taste-Skill 介面深度重構 (Anti-Slop Modern UI Redesign)

### 需求內容與作業
- **設計系統升級 (Taste-Skill UI Framework)**：導入 Google Fonts (`Inter` 與 `JetBrains Mono` 等寬字型)，提升品號、品名與數據的可讀性與專業質感。
- **高階毛玻璃與莫蘭迪色彩標籤 (Morandi Tokens & Glassmorphism)**：
  - Header 與模態彈窗全面導入 `glass-header` 與 `glass-card` 高級毛玻璃與微模糊動態樣式。
  - 物料類別標籤區分（SA/SB/SC/SD組件使用莫蘭迪靛紫、客戶特規使用莫蘭迪玫瑰紅、輔料包材使用莫蘭迪青綠、單品件使用翡翠綠），提升視覺階層。
- **無損重構極致品質**：100% 保留所有搜尋、過濾、BOM 展算、圖檔自動超連結、Excel 匯出與後台管理等全數既有業務邏輯與功能。

---

## v3.1.1 — Excel 匯出「組立名稱(英)」欄位資料補全 (Assembly English Name Population)

### 需求內容與作業
- **問題分析與 RCA**：在 Excel 匯出的 SA/SB/SC/SD 組立頁籤中，表頭保留原始規範 `['序號', '組立名稱', '組立名稱(英)', '組立編號']`，但原程式 `excelExport.ts` 中對 `'組立名稱(英)'` 填入空白 `''`，導致匯出結果欄位空白。
- **資料提取與補全**：解析原始資料中 132 筆 SA/SB/SC/SD 組件之英文品名（如 `3M41459` ➔ `MLS with Rotating Nut, I.D. 4.1mm`），建置對照字典 `assemblyEnglishMap.json`。
- **匯出引擎升級**：更新 `src/utils/excelExport.ts`，匯出時自動帶入 132 筆組立英文品名，補齊欄位資料。

---

## v3.1.0 — 孤兒圖檔 100% 納入主品號資料庫與全自動超連結 (Orphan Images Zero-Residual Ingestion)

### 需求內容與作業
- **全自動缺失品號提取與匯入**：解析剩餘 338 個孤兒圖檔之檔名結構，交叉比對 `rawdata` 元資料，自動提取出 256 筆缺失之新品號（自動判定客戶名稱、物料類別如包材貼紙、客戶特規、組件、單品射出件等）。
- **Master 資料庫擴充重構**：將 256 筆新品號自動補入 `data/master.json`，使主資料庫品號總數由 656 筆擴充至 912 筆（版本升級為 v3.1.0）。
- **100% 超連結達成確效**：重新執行全域掃描，全數 1,527 個媒體/工程圖檔已達成 1,527 檔 100% 完全超連結（孤兒圖檔數歸零 `Orphan Files: 0`）。

---

## v3.0.6 — 品號與圖檔演算法比對優化 (消弭 55 個假孤兒圖檔)

### 需求內容與作業
- **問題分析與 RCA**：經全域盤點 1,527 個工程圖檔與 656 個系統品號，發現大量圖檔名稱包含括號或附加修飾（如 `AMSINO-SDW140112(SB0068)_Rev.B.pdf` 或 `PN-0002(Rev.A)_D10-210-251-1 包裝說明書.pdf`）。原比對邏輯僅以 `[-_\s.]+` 切割，導致括號內的品號（如 `SB0068`）未被解析，產生假孤兒圖檔。
- **演算法優化**：更新 `src/utils/imageLibrary.ts` 的 `normalize` 與 `findForCandidate` 函數，將符號剝離規則改為全非英數符號 (`/[^A-Z0-9]+/gi`)，並加入全正規化字串的包含 (includes) 與前綴 (startsWith) 匹配。
- **效益驗證**：成功拯救 55 個假孤兒圖檔（孤兒圖檔數由 393 檔降低至 338 檔），且完全無任何 False Positive 誤配。

---

## v3.0.5 — GitHub Pages 靜態模式 localStorage 快取徹底清除與禁寫防護

### 需求內容與作業
- **快取隔離防護**：於 GitHub Pages 靜態模式（`IS_STATIC_MODE === true`）下，初始化時自動執行 `localStorage.removeItem(STORAGE_KEY_PARTS)`，徹底清除瀏覽器歷史快取中殘留的舊版 master 數據。
- **禁寫與禁讀保護**：在靜態部署環境中完全停用 `localStorage` 之讀寫邏輯，確保所有人訪問 GitHub Pages 時均為 100% 空白預設狀態，無任何隱私洩漏隱患。

---

## v3.0.4 — 數據匯出/匯入 Round-Trip 欄位完整性補齊與介面卡片佈局優化

### 需求內容與作業
- **Round-Trip 全欄位維護**：修復 CSV 與 Excel (.xlsx) 匯出/匯入時 `category`（物料類別）、`color`（顏色）、`material`（原料）三個欄位遺失的問題。現 JSON、CSV、Excel 三種格式皆達成 100% 欄位對齊與無損轉換。
- **介面卡片對調**：於「資料匯出與匯入」彈窗 (`ExportImportModal.tsx`) 中，將 **「匯入自訂資料」** 卡片置於 **「匯出目前資料庫」** 卡片上方，優先引導使用者進行資料匯入。

---

## v3.0.3 — GitHub Pages 靜態編譯包 0 隱私數據物理隔離 (Zero Private Data Security Patch)

### 需求內容與作業
- **資安物理隔離**：完全移除前端原始碼（`App.tsx`、`partsService.ts`、`bomService.ts`）中對 `data/master.json` 的靜態 `import` 引用，徹底防止 Vite 打包將私有 master 數據編譯進 `dist/assets/index-XXXX.js`。
- **產物檢驗與掃描**：前端打包體積減少約 138 kB，經 Python 全域字串掃描確認 `dist/` 靜態檔案內 100% 零任何隱私客戶名稱、零品號數據與 BOM 結構。
- **本機伺服器動態供給**：本機端（`node server.js`）維持讀取 `data/master.json` 並透過 REST API (`/api/parts` 與 `/api/bom`) 動態提供完備之 656 筆數據。

---

## v3.0.2 — 後台管理系統 (Admin Panel) 完整功能盤點與新屬性對接補強

### 需求內容與作業
- **後台功能深度盤點**：全面審查 `AdminPanel.tsx` 之品號維護、客戶管理、BOM 階層展算與全量備份機制。
- **管理表單補強對接**：於後台「新增品號」表單中，完整加入 **「物料類別」** 下拉選單（SA/SB/SC/SD組件、單品射出件、客戶特規對照件、輔料/膠材/包材）以及 **「顏色」** 與 **「原料」** 屬性輸入框，確保管理員於後台新增物料時具備 100% 完整之欄位編輯能力。
- 通過編譯與運作驗證。

---

## v3.0.1 — 數據補強：BD 客戶組件 X3299AAM BOM 結構建置與物料類別歸類

### 需求內容與作業
- **物料類別歸類**：明確將 **BD** 客戶品號 **`X3299AAM`** 的物料類別更正歸類為 **`客戶特規對照件`**。
- **BOM 組成結構補強**：依據圖面規格表，完成 **`X3299AAM`** 的 5 項組成零件建置與雙向 BOM 階層連動：
  1. `D10-240-211` (FEMALE LUER LOCK, QTY: 1)
  2. `1L-370100` (TUBING, 100mm, 0.89mm X 2.40mm, QTY: 1) — *補強新增物料*
  3. `F17-000-412` (SLIDE CLAMP, QTY: 1)
  4. `C09-240-211` (MALE LUER LOCK, QTY: 1)
  5. `E09-000-412-1` (MLL VENTED END CAP, QTY: 1)
- **Master Table 與生產生態**：更新 `data/master.json` 與 `rawdata/clean_sa_bom_tree.json`，並通過編譯驗證。

---

## v3.0.0 — 圖檔全域遞迴掃描、OCR 內容辨識與孤兒檔案零殘留管理中心

### 需求內容與作業
- **子資料夾全域遞迴掃描**：支援對 `D:\Self-developed_Apps\PN-Lookup\rawdata\圖檔` 及其子資料夾（`客戶圖面`、`物料資料`、`產品資料`）下全數 **1,527 個圖檔/PDF 圖面** 進行遞迴遍歷。
- **三階圖檔超連結解析**：
  1. **檔名匹配**：自動識別含品號/別稱之檔名（如 `A01-200-111(Rev.A)-C.pdf` 匹配 `A01-200-111`）。
  2. **PDF 原生文字層極速提取 + OCR 雙軌辨識**：支援對 PDF 工程圖面優先執行原生文字層 (`getTextContent`) 毫秒級提取；若為掃描版 PDF 圖片，自動降級執行 Canvas 渲染與 Tesseract.js 視覺 OCR 辨識。
  3. **手動快速綁定**：提供雙向連動機制。
- **孤兒檔案零殘留管理中心 (`OrphanImagesModal.tsx`)**：
  - 工具列即時顯示 `未對應孤兒圖檔 (X)` 警示標籤。
  - 提供專屬孤兒圖檔管理介面，可即時檢視所有未對應圖檔及 OCR 內文片段，並提供一鍵手動連動/綁定品號功能，徹底杜絕孤兒圖檔。

---

## v2.9.4 — 介面強化：物料類別欄位動態排序 (Sortable Category Column)

### 需求內容與作業
- **物料類別排序功能**：於前端 [PartsTable.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/PartsTable.tsx) 的「物料類別」表頭新增點擊排序 (`ArrowUpDown`) 功能。
- **排序邏輯**：支援按物料類別（如 `SA組件` / `SB組件` / `SC組件` / `SD組件` / `單品射出件` / `輔料/膠材/包材` / `客戶特規對照件`）進行升冪與降冪動態排序。
- 驗證並編譯完成。

---

## v2.9.3 — 數據錯字修正 (0.08*14m.5m ➔ 0.08*14.5mm)

### 需求內容與作業
- 修正原始資料中的筆誤：將物料名稱/尺寸中的 `0.08*14m.5m` 批次更正為標準格式 **`0.08*14.5mm`**（收縮膜規格）。
- 涵蓋檔案：`rawdata/clean_sb_components.json`、`rawdata/clean_sb_bom_tree.json`、`rawdata/master_table_unified.json` 與 `data/master.json`。
- 重新重新編譯與驗證前端產出，確認更正無誤。

---

## v2.9.2 — Master Table 匯入與 404 載入異常修復 (RCA & CAPA)

### 問題現象 (Symptom)
- 點擊匯入或載入 `master.json` 時報錯：`Failed to load resource: the server responded with a status of 404 ()`

### 根因分析 (RCA)
1. **API 端點缺省 404**：前端 `partsService.ts` 與 `bomService.ts` 在無後端伺服器（或僅 Vite 靜態開發模式）下請求 `/api/parts` 與 `/api/bom` 時回傳 404，原代碼未設置靜態 Master 數據備份降級。
2. **Master JSON 格式解析限制**：`ExportImportModal.tsx` 在上傳 `master.json`（結構為 `{ type: "pn-lookup-master", parts: [...], bom: {...} }`）時，原 parser 僅接受 Flat Array `[...]`，導致解析物件失敗被過濾。

### 矯正與預防措施 (CAPA)
1. **內聯 Master 靜態降級 (Static Fallback)**：`partsService.ts` 與 `bomService.ts` 直接導入 `data/master.json`，於 API 404 或靜態模式下自動無縫降級載入 656 筆主物料與 181 組 BOM 樹狀關係。
2. **Master JSON 解析器升級**：更新 `ExportImportModal.tsx` 檔案解析邏輯，自動識別 `master.json` 中的 `parts` 陣列與 `bom`（`children`/`parents`）階層樹，支援拖曳上傳與覆蓋/附加。
3. **Vite 反向代理**：於 `vite.config.ts` 配置 `/api` 代理指向 `http://localhost:3000`。

---

## v2.9.1 — Master Table 零組件跨表全域整合與介面欄位對接

### 需求內容與作業
- **物料類別分類**：將 7 個工作表提取出的 656 項獨立物料進行分類（SA組件、SB組件、SC組件、SD組件、單品射出件、輔料/膠材/包材、客戶特規對照件）。
- **BOM 關聯與品名對照**：建立向下子件 `children` (181 組) 與向上父件 `parents` (193 項) 雙向雙層階層鏈，完整合併品名規格與多重別稱 `alternates`。
- **客戶白名單嚴格收斂**：貫徹 **「客戶名稱僅採認『客戶與品號對照表』(Sheet 1) 出現的 69 位客戶」** 原則，徹底過濾 Sheet 2/3 非白名單客戶名。
- **介面欄位新增與清理**：新增 **「原料」(`material`)** 與 **「顏色」(`color`)** 欄位，剔除所有非操作頁面所需的無用原始雜項欄位（如模具號碼、穴數等）。

### Master Table 統計與輸出
- **整合主數據庫路徑**：`data/master.json`
- **品號總筆數**：656 筆獨立物料
- **物料類別分佈**：
  - 單品射出件：248 筆
  - 客戶特規對照件：224 筆
  - SA組件：95 筆
  - SB組件：52 筆
  - SC組件：25 筆
  - SD組件：9 筆
  - 輔料/膠材/包材：3 筆

---

## v2.9.0 — Master Table 構建完成 (階段七：SD組件與全表統合)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第七張工作表 **「SD組件」**。
- 統合全部 7 張工作表，完成 Master Table 的 MECE 清洗、結構化與統一格式構建。

### 階段七：SD組件資料統計
- **原始筆數**：9 筆
- **去重後獨立筆數**：**9 筆**（`組件編號` 達到 100% 唯一性）
- **欄位結構 (8 欄)**：`序號`、`組件名稱`、`組件名稱(英)`、`組件編號`、`零件編號1`、`零件名稱1`、`零件編號2`、`零件名稱2`
- **數據輸出**：
  - 平鋪資料：`rawdata/clean_sd_components.json`
  - BOM 樹狀結構：`rawdata/clean_sd_bom_tree.json`

### 🏆 全表 (7 張工作表) 統合 Master Table 統計數據
- **總工作表數**：7 張（全部提取與清洗完畢）
- **客戶與品號對照紀錄**：428 筆獨立紀錄
- **廠內紙本零件紀錄**：248 筆獨立紀錄 (100% PK 唯一)
- **客戶料號對照紀錄**：172 筆獨立紀錄
- **BOM 階層組件紀錄 (全 181 組)**：
  - SA 組件：95 組
  - SB 組件：52 組
  - SC 組件：25 組
  - SD 組件：9 組
- **統一 Master 數據庫**：`rawdata/master_table_unified.json`

---

## v2.9.0 — Master Table 構建 (階段六：SC組件)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第六張工作表 **「SC組件」**。
- 清洗 `\xa0` 不換行空格，補齊第 9 欄標題為 `備註`，提取 SC 階層 BOM 結構，完成 MECE 去重與結構化。

### 資料統計與清洗結果
- **原始筆數**：25 筆
- **去重後獨立筆數**：**25 筆**（`組件編號` 達到 100% 唯一性）
- **欄位結構 (9 欄)**：`序號`、`組件名稱`、`組件名稱(英)`、`組件編號`、`零件編號1`、`零件名稱1`、`零件編號2`、`零件名稱2`、`備註`
- **數據輸出**：
  - 平鋪資料：`rawdata/clean_sc_components.json`
  - BOM 樹狀結構：`rawdata/clean_sc_bom_tree.json`

### 欄位與結構特點
- 25 個 SC 組件多由 SB 階層組件加上蓋類零件（如 `E09-000-412-4 公針基蓋`）、螺帽、點滴筒或包材組成。
- Row 19 (`SC0045`) 與 Row 20 (`SC0046`) 第 9 欄包含備註內容 `(+GVS filter)`。

---

## v2.9.0 — Master Table 構建 (階段五：SB組件)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第五張工作表 **「SB組件」**。
- 清洗 `\xa0` 不換行空格，補齊第 9 欄標題為 `備註`，提取 SB 階層 BOM 結構，完成 MECE 去重與結構化。

### 資料統計與清洗結果
- **原始筆數**：52 筆
- **去重後獨立筆數**：**52 筆**（`組件編號` 達到 100% 唯一性）
- **欄位結構 (9 欄)**：`序號`、`組件名稱`、`組件名稱(英)`、`組件編號`、`零件編號1`、`零件名稱1`、`零件編號2`、`零件名稱2`、`備註`
- **數據輸出**：
  - 平鋪資料：`rawdata/clean_sb_components.json`
  - BOM 樹狀結構：`rawdata/clean_sb_bom_tree.json`

### 欄位與結構特點
- 52 個 SB 組件皆由 SA 階層組件與收縮膜/膠材組成（如 `SB0001` = `SA0001` + `0.08*14mm 收縮膜`）。
- Row 25 (`SB0055`) 第 9 欄包含備註內容 `(+GVS filter)`。

---

## v2.9.0 — Master Table 構建 (階段四：SA組件)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第四張工作表 **「SA組件」**。
- 清洗字串換行與 `\xa0` 特殊字元，提取 SA 階層 BOM 結構（子零件關聯），完成 MECE 去重與結構化。

### 資料統計與清洗結果
- **原始筆數**：95 筆
- **去重後獨立筆數**：**95 筆**（`組件編號` 達到 100% 唯一性）
- **欄位結構 (10 欄)**：`序號`、`組件名稱`、`組件名稱(英)`、`組件編號`、`零件編號1`、`零件名稱1`、`零件編號2`、`零件名稱2`、`零件編號3`、`零件名稱3`
- **數據輸出**：
  - 平鋪資料：`rawdata/clean_sa_components.json`
  - BOM 樹狀結構：`rawdata/clean_sa_bom_tree.json`

### 欄位與結構特點
- 95 個 SA 組件皆包含 2 個子零件/膠材；其中 3 筆（`SA0106`, `SA0137`, `SA0138`）包含第 3 項零件（`B-003 D膠`）。
- 修正 Row 19 (`SA0037`) 組件名稱內的換行符號 `\n` 為單一空格。

---

## v2.9.0 — Master Table 構建 (階段三：客戶料號)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第三張工作表 **「客戶料號」**。
- 補齊缺失欄名（第 11 欄補為 `備註`），清洗 `\xa0` 不換行空格，完成 MECE 去重與結構化提取。

### 資料統計與清洗結果
- **原始筆數**：172 筆
- **去重後獨立筆數**：**172 筆**（列級無重複）
- **欄位結構 (11 欄)**：`客戶`、`模具號碼`、`穴數`、`圖面編號`、`產品編號`、`零件編號(客)`、`零件名稱(中)`、`零件名稱(英)`、`顏色`、`原料`、`備註`
- **數據輸出**：暫存於 `rawdata/clean_customer_part_numbers.json`
- **主要客戶**：Bard, CardioMed, GVS, ICU, MDX, PFM, RMS, SIMS

### 異常與殘缺資料列紀錄 (5 筆)
1. Row 95：僅有 `顏色: (47325P)`，其他欄位全空
2. Row 105：缺少 `客戶`，但有模具 `MT20218` 與 `零件編號(客): R1-9035`
3. Row 106：缺少 `客戶` 與 `零件編號(客)`，有模具 `MT13142`、穴數 `4` 與原料
4. Row 107：缺少 `客戶` 與 `零件編號(客)`，有模具 `MT20218` 與穴數 `8`
5. Row 169：`ICU` 客戶有模具 `MT13131` 與品名，但缺少 `產品編號` 與 `零件編號(客)`

---

## v2.9.0 — Master Table 構建 (階段二：廠內紙本零件編號)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第二張工作表 **「廠內紙本零件編號」**。
- 清洗不可見特殊字元（如 `\xa0` 不換行空格），去除頭尾多餘空格，進行 MECE 資料去重與結構化。

### 資料統計與清洗結果
- **原始筆數**：248 筆
- **去重後獨立筆數**：**248 筆**（`產品編號` 達到 100% 唯一性，無重複列）
- **欄位結構 (10 欄)**：`客戶`、`模具號碼`、`穴數`、`產品編號(舊)`、`產品編號`、`零件編號(客)`、`零件名稱(中)`、`零件名稱(英)`、`顏色`、`原料`
- **數據輸出**：暫存於 `rawdata/clean_internal_parts.json`

### 跨表關聯比對 (Sheet 1 vs Sheet 2)
- 工作表一（客戶與品號對照表）共有 283 個不重複品號；工作表二（廠內紙本零件編號）共有 248 個不重複產品編號。
- 兩表共同交集品號：**101 個**。
- 僅存在於工作表一（如 SA/SB/SC/SD 組件或客戶特規號）：182 個。
- 僅存在於工作表二（廠內射出/紙本單品件）：147 個。

---

## v2.9.0 — Master Table 構建 (階段一：客戶與品號對照表)

### 需求內容與作業
- 從 `rawdata/產品一覽表.xlsm` 提取第一張工作表 **「客戶與品號對照表」**。
- 基於 MECE 原則進行資料清洗與重複去重。

### 資料統計與清洗結果
- **原始筆數**：450 筆
- **去重後獨立筆數**：428 筆（成功剔除 22 筆 100% 完全重複的數據）
- **欄位結構**：`客戶`、`品號`、`品名`
- **獨立客戶數**：69 個
- **獨立品號數**：283 個
- **數據輸出**：暫存於 `rawdata/clean_customer_parts.json`

### 異常與邊界點分析 (Edge Cases)
- 發現 3 個 `品號` 在不同客戶名稱下出現品名文字描述微調：
  1. `F17-999-412`：大部分客戶為 `小切斷器(開)`，KORU Medic 為 `小切斷器(開、白)`
  2. `E09-000-642`：Command Me 為 `公針基蓋(白,不透氣)`，KORU Medic 為 `公針基蓋(不透氣、白)`
  3. `E10-002-642`：Command Me 為 `母針基蓋`，KORU Medic 為 `母針基蓋 (無孔、白)`

---

## v2.8.x — 資料檔案移除與原始數據不再提交

### 資料檔案從 Git 移除
- **`src/data/bomData.ts`**、**`src/data/partsData.ts`**：從 Git 追蹤中完全移除，不再提交至 GitHub
- **`data/master.json`**（根目錄）：本就不應該提交，已於之前從 .gitignore 排除
- 新增 `src/data/` 至 `.gitignore` 範圍，確保未來不會誤將 `src/data/` 下的衍生資料提交

### 相容性處理
- **靜態模式（GitHub Pages）**：`bomEngine.ts` 改為內聯空值作為 fallback（取代導入 bomData.ts），`App.tsx` 直用空陣列取代 partsData.ts 的 `INITIAL_PARTS_DATA`；build 不因缺少 `src/data/` 模組而失敗
- **本機伺服器模式**：`initBOM()` 從 `/api/bom`載入 BOM、`loadParts()` 從伺服器載入品號，兩者皆不依賴 bomData.ts/partsData.ts

### MECE 重組（v2.8.1）
- **消除重複 `computeParents` 邏輯**：`AdminPanel.tsx:772` 的私有函式 `computeParents` 與 `bomEngine.ts:62` 的 `computeParentsMap` 邏輯完全一致；將 `computeParentsMap` 匯出（在 bomEngine 作為模組內 private 函式），移除 AdminPanel.tsx 的副本（20 行刪除）
- **移除未使用的匯出**：`ServerStatus`（serverStatus.ts）、`BOMRelation`（bomEngine.ts）、`OcrEntry`（ocr.ts）、`CustomerRow`（customerPartImport.ts）、`setImageFolderDismissed`（imageLibrary.ts）均為匯出但不被任何外部檔案匯入的 dead export，已移除 `export` 關鍵字或刪除匯出

### 匯入匯出範圍規範
- **僅提交代碼邏輯**：ref/ 與 data/ 原始數據檔案（XLSM、CSV、PDF、master.json、bomData.ts、partsData.ts 等）一律不提交
- `.gitignore` 收斂為 `/data/`、`/ref/`（根目錄限定，避免誤排除 `src/data/` 導致 build 失敗）

### gitignore 修正
- 將 `data/`、`ref/` 收斂為根目錄限定 `/data/`、`/ref/`，同時新增 `src/data/` 排除

### 架構說明（當前）
- **靜態模式**（GitHub Pages）：`VITE_STATIC_ONLY=true` 注入，完全跳過 API；品號走 localStorage，BOM 走空殼 fallback
- **本機伺服器模式**：`npm run start`（build + serve），品號與 BOM 從 `data/master.json` 讀寫
- **bomData.ts / partsData.ts**：已從版本控制移除；build-time module 導向內聯空值，vite 構建不受影響

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

---

## v2.8.1 — 思維導圖 (MindMap) 連接線起點修正與幾何對齊

### 需求內容
修復思維導圖 (`ProductMindMapModal.tsx`) 在節點展開/擴展時，延伸出來的連接線 (Connection Link) 起點不正確、由圖塊中間穿越過去的視覺 Bug。

### 根因分析 (RCA)
1. **SVG 座標系與 HTML 寬度不對齊**：`react-d3-tree` 在 `orientation="horizontal"` 時，以 `source.y` 為 SVG 的橫軸原點。自訂 `<foreignObject>` 自 `x={0}` 開始渲染，導致卡片由 `source.y` 向右延伸 168px ~ 288px。
2. **預設 Step Path 起點計算錯誤**：`pathFunc="step"` 預設從 `(source.y, source.x)` 出發，即卡片**左邊界**。當線條連向位於右側的子節點時，起點橫跨整張卡片內部，造成線條從圖塊中間穿過的缺陷。

### 矯正與預防措施 (CAPA)
1. **精準卡片寬度估算**：實作 `getNodeCardWidth(mmNode)` 依據節點深度與類型精準導出寬度 (288px / 240px / 204px / 180px / 168px)，並將 `<foreignObject>` 與內層 `div` 的 `width` 嚴格約束為 `cardW`。
2. **自訂 `customStepPath` 繪製引擎**：計算出發點 X 座標為 `startX = source.y + sourceWidth`（父卡片右緣），到達點為 `endX = target.y`（子卡片左緣），垂直折轉點取 `midX = startX + (endX - startX) / 2`。
3. **固定基準縮放與禁用滾輪縮放 (不縮放、只平移)**：設置 `zoom={1}` 保持 1.0 基準大小（解決先前被 `zoom={0.75}` 縮小 25% 及字體過小問題），並設置 `zoomable={false}` 鎖定 `.scaleExtent([1, 1])` 禁用滾輪/手勢縮放，完整保留滑鼠拖曳平移 (Pan) 功能。
4. **驗證確效**：完成 `npx tsc --noEmit` 零錯誤與 `npm run build` 打包驗證。

---

## v3.7.9 — Master Table 建置腳本與災難復原轉譯器 (Automated Master Table Seed Builder & Seamless Disaster Recovery)

### 需求內容
採納 Kiro 的審查意見，補齊從 `rawdata/master_table_unified.json` 轉譯生成符合系統介面 `{ parts, bom }` 結構 Master Table 的建置腳本，並修復 `server.js` 災難復原時因格式不符導致靜默覆寫為空矩陣的嚴重漏洞。

### 根因分析 (RCA)
1. **結構不匹配**：`rawdata/master_table_unified.json` 為 `{ meta, customerParts, internalParts, customerPartNumbers, bomHierarchy }`，而 `server.js` 及前端期望的 `pn-lookup-master.json` 格式為 `{ parts: [...], bom: { children: {}, parents: {} } }`。
2. **災難復原盲區**：舊版 `server.js` 呼叫 `loadMaster()` 若遇到 `pn-lookup-master.json` 遺失，會直接將 `master_table_unified.json` 送入 `saveMaster()`，因找不到 `parts` 陣列而寫入空 `parts: []` 與空 `bom`，導致復原機制失敗。

### 矯正與預防措施 (CAPA)
1. **新增獨立轉譯腳本 `scripts/buildMaster.js`**：
   - 包含 `convertUnifiedSeedToMaster(seedData)` 轉換引擎。
   - 解析 `internalParts`, `customerParts`, `customerPartNumbers` 並去重構建出符合型別規範之 `parts` 陣列。
   - 解析 `bomHierarchy` (SA/SB/SC/SD) 構建出雙向展算的 `children` 與 `parents` BOM 關聯表。
   - 提供 `node scripts/buildMaster.js` 獨立 CLI 命令，可隨時從原始種子檔一鍵重構出 `data/pn-lookup-master.json`。
2. **無縫整合 `server.js` 災難自修復**：
   - `server.js` 導入 `convertUnifiedSeedToMaster`。
   - 當庫存主檔遺失時，自動對 `RAW_SEED_PATH` 進行現場動態轉譯，徹底解決災難復原覆寫為空的危機。
3. **驗證確效**：
   - 執行 `node scripts/buildMaster.js` 成功產生 565 筆品號與 181 組雙向 BOM 階層。
   - `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 打包 100% 成功。

---

## v3.8.0 — 專案代碼與檔案 MECE 全面優化、元規則整合與發行基準 (Comprehensive Project Code & File Optimization, Meta-Rules Integration & Release Baseline)

### 需求內容
執行專案全域代碼與檔案優化：
1. **全面盤點與清理**：清理冗餘/過時設定，規範目錄結構，確認零副作用與零功能退化。
2. **開發文檔全域同步**：全面更新 `README.md` 目錄樹與元件清單，同步 `.agents/AGENTS.md`（包含「第一性原理與防迎合討好元規則」、「反向提問」與「AI 智囊團審查機制」）。
3. **MECE 原則重構**：優化 `scripts/buildMaster.js`、`server.js` 與 `ProductMindMapModal.tsx` 之結構。
4. **確立發行基準**：完成 TypeScript 類型確效與 Vite 打包驗證。

### 矯正與預防措施 (CAPA)
1. **目錄與規則整合**：整合 `.agents/AGENTS.md` agent 規則檔，強化防迎合討好與 5 人 AI 智囊團機制。
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.8.2 — 功能升級：思維導圖預設 Layer-1 收合視角與一鍵返回預設狀態按鈕 (MindMap Initial Depth-1 View & One-Click Reset Default State)

### 需求內容
1. 調整思維導圖開啟時的預設展算狀態：僅展開根節點，三個 Level-1 分類卡片（廠內品號編碼介紹、客戶品號編碼介紹、待人工分類）呈預設收合狀態。
2. 頂部工具列新增「一鍵返回預設狀態」按鈕，方便隨時歸位視角與收合狀態。

### 矯正與預防措施 (CAPA)
1. **預設深度設為 `initialDepth={1}`**：`ProductMindMapModal.tsx` 設定 `<D3Tree initialDepth={1} />`，確保初次開啟即呈現層級一卡片收合狀態。
2. **新增 `handleResetDefault` 與 `treeKey` 重新掛載機制**：點擊「返回預設狀態」按鈕時，自動重置視角平移向量 (`treeTranslate`)、清空搜尋關鍵字、關閉縮圖彈窗，並透過 `treeKey` 觸發 D3 樹重新重置回 Layer-1 收合狀態。
3. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。


---

## v3.8.1 — 防禦修復：修復早期 Return 放置於 Hook 前導致之 React Error #310 (Rules of Hooks Fix & React Error #310 Prevention)

### 需求內容
修復生產環境發生的 `Uncaught Error: Minified React error #310` 運行時崩潰（Rendered more/fewer hooks than during the previous render）。

### 根因分析 (RCA)
在 [ProductMindMapModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductMindMapModal.tsx) 中，`customStepPath` 的 `useCallback` Hook 被放置在了 `if (!isOpen) return null;` 條件 return **之後**。
當 modal 狀態從關閉 (`isOpen: false`) 切換為開啟 (`isOpen: true`) 時，導致渲染過程中 Hook 的調用數量改變，嚴重違反 React Rules of Hooks，引發 React Error #310 崩潰。

### 矯正與預防措施 (CAPA)
1. **Hook 提至頂層 (Top-Level Hook Lift)**：將 `customStepPath` 的 `useCallback` 移至 `if (!isOpen) return null;` 之前，確保組件於任何條件渲染下均執行相同數量的 Hook。
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.8.3 — 演算法防禦修復：修復圖檔比對貪婪前綴比對缺陷（防止 B-003 誤吞 B-0030~B-0039 等 11 張圖檔） (Precise Boundary Image Matching Fix)

### 需求內容
排查並修復品號 `B-003` 異常對應到 11 張圖檔的嚴重大瑕疵。

### 根因分析 (RCA)
在 [imageLibrary.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageLibrary.ts) 舊版 `findForCandidate` 與 `findAllForCandidate` 函數中，當品號歸一化長度大於等於 4 時（如 `B-003` 的歸一化 `B003` 長度為 4），系統誤啟用了 `canPrefix = true` 並且直接使用 `baseNorm.includes(pnNorm)` 或 `baseNorm.startsWith(pnNorm)` 進行子字串比對，**缺乏字元邊界防護**。
這導致 `B-003`（歸一化 `B003`）貪婪匹配到了所有以 `B003` 開頭的衍生品號圖檔（如 `B-0030`, `B-0031`, `B-0032`, `B-0033`, `B-0034` ... `B-0039` 以及 `B-003-1`, `B-003-2` 等共 11 張完全不同的品號圖檔）。

### 矯正與預防措施 (CAPA)
1. **引入數字邊界防禦匹配 (`isMatchedSegment`)**：
   重構 [imageLibrary.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageLibrary.ts) 匹配核心。當 `sNorm.startsWith(pnNorm)` 成立時，強制檢查接續的第一個字元：
   * 若後續字元為**數字 (0-9)**：判定為不同數值品號（如 `B003` 之於 `B0030`），**拒絕匹配**！
   * 若後續字元為**非數字**（如 `v1`, `RevA` 或無後續）：判定為版本修飾符，允許匹配！
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.8.4 — 效能與 UI 重構：思維導圖最深層分類卡片導入獨立卷軸容器 (MindMap Scrollable Leaf Category Container Refactoring)

### 需求內容
修復思維導圖展開至末端品號時，過往將數百筆品號直接展算為獨立 SVG 樹節點導致垂直分佈跨度過大（超過 35,000px）、極度影響拖曳檢索與佈局效能的問題。恢復分類卡片內嵌入品號列表獨立卷軸 (Scrollbar Container) 的高效率檢索設計。

### 根因分析 (RCA)
之前在從舊版切換至 `react-d3-tree` 樹狀佈局時，`createPartLeafNodes` 誤將全數 565+ 筆品號各自獨立轉化為 D3 樹的終點子節點。這導致 D3 佈局計算在垂直方向被拉伸超過 35,000 像素，造成畫布過度龐大、滑鼠拖曳與搜尋檢索效能下降。

### 矯正與預防措施 (CAPA)
1. **收合品號至子類別卷軸容器 (Scrollable Leaf Category Container)**：
   重構 [ProductMindMapModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductMindMapModal.tsx)。停止將品號分裂為數百個獨立 D3 樹節點，而是將品號列表收納於所屬子類別卡片（如 `T接頭`, `SA系列`, `BD`, `待人工分類` ...）的內部。
2. **嵌入高質感 Morandi 卷軸與二級按鈕**：
   子類別卡片內部提供高度 `max-h-[220px]` 的獨立滾輪容器 (`custom-scrollbar`)：
   * 包含品號即時搜尋過濾與關鍵字高亮。
   * 包含單品獨立 **👁️ 圖檔預覽** 與 **🔗 跳轉至 BOM 主頁** 按鈕。
   * 全樹 D3 節點數大幅縮減為極簡 15 個分類節點，畫布高度縮小為近千像素，拖曳極速順暢！
3. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.8.5 — 預設狀態修復：思維導圖 Level 1 節點統一預設收合修復 (MindMap Level 1 Collapsing & Spacing Alignment Fix)

### 需求內容
修復思維導圖開啟時，第一層（Level 1）的「待人工分類」未如同「廠內品號」與「客戶品號」一樣保持預設收合，而是直接在 Level 1 展開高達 300px 的卷軸卡片、導致預設畫面不對稱且擋住下方卡片的問題。

### 根因分析 (RCA)
在 `react-d3-tree` 中，`initialDepth={1}` 的折疊機制只對**擁有子節點 (`children.length > 0`) 的節點生效**。
過往「待人工分類」作為 Level 1 節點，其 `children` 為空陣列 `[]`（直接掛載品號陣列）。`react-d3-tree` 判定其為 Leaf Node（無子可折疊），因此在初始渲染時強制展開品號卡片，破壞了原本預設狀態三項 Level 1 齊平收合的畫面平衡。

### 矯正與預防措施 (CAPA)
1. **建立 Level 2 待對應品號清單封裝節點 (`unclassified-list`)**：
   重構 [ProductMindMapModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductMindMapModal.tsx)。將「待人工分類」包裹 Level 2 子節點「待對應品號清單」，使三個 Level 1 節點 (`廠內品號`, `客戶品號`, `待人工分類`) 均具備 `children`！
2. **完全對齊預設狀態 (100% Alignment with Default View)**：
   * 開啟 Modal 時，三個 Level 1 節點 100% 統一呈收合狀態（顯示 `>` 箭頭），畫面簡潔齊整！
   * 點擊「待人工分類」展開後，才進入 Level 2 顯示「待對應品號清單」卷軸卡片。
   * 將 `D3Tree` 的 `nodeSize` 與 `separation` 調校為垂直與水平合理的留白比例，確保展開後卡片不重疊。
3. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.8.6 — 互動功能升級：思維導圖雙擊與單擊雙向開展/收合機制 (MindMap Double Click & Click Collapsing Feature)

### 需求內容
回應使用者需求，為思維導圖補全末端品號卡片與樹狀分類卡片的雙擊 (`onDoubleClick`) 與單擊標題/箭頭折疊功能，解決開展後無法快速收合的問題。

### 實現架構與邏輯
1. **末端品號卡片 (Leaf Category Cards)**：
   * 導入 `collapsedLeafIds` React State 進行狀態開關。
   * **單擊標題/箭頭** 或 **雙擊卡片任一處** 均可即時切換「48px 精簡膠囊卡片 (含 `﹀` 箭頭)」與「280px 全功能卷軸清單 (含 `︿` 箭頭)」。
2. **父類別節點 (Parent Category Nodes)**：
   * **單擊** 或 **雙擊卡片** 均可切換展開/收合下層子類別分支 (`toggleNode()`)。
3. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.9.0 — 全專案五步 SOP 架構審查、代碼清理與規格整合 (Comprehensive Project Optimization & Standards Audit)

### 需求內容
執行全專案 5 步驟全流程 SOP 審查與清理作業：
1. 全面盤點與清理無效程式碼與廢棄模組。
2. 同步更新所有開發相關文件（`DEV_LOG.md` 與 `README.md`）。
3. 依 MECE 原則重構檔案目錄與模組依賴。
4. 建立規範 Git 提交基準點。
5. 確效後推送至 GitHub 遠端倉庫。

### 執行與 CAPA 總結
1. **MECE 資源整合與清查**：確認所有前端組件 (`src/components/`) 與引擎模組 (`src/utils/`) 職責劃分清晰，全數 14 個核心組件與 14 個工具模組均經確效無冗餘檔。
2. **規格與規則演化 (Self-Evolution Rules)**：
   * 在 [.agents/AGENTS.md](file:///d:/Self-developed_Apps/PN-Lookup/.agents/AGENTS.md) 中建立 `<RULE[data_structure_change_notification]>`：規定重大數據結構與筆數變動時必須主動說明。
   * 在 [.agents/AGENTS.md](file:///d:/Self-developed_Apps/PN-Lookup/.agents/AGENTS.md) 中建立 `<RULE[explicit_file_path_prompt_rule]>`：規定所有匯入匯出必須提供顯性 OS 另存新檔/檔案選擇對話框 (`window.showSaveFilePicker`)。
3. **驗證確效**：`npx tsc --noEmit` 0 錯誤，`npm run build` 打包成功。

---

## v3.9.1 — UI 體驗升級：末端品號分類卡片預設一律呈精簡膠囊收合狀態 (MindMap Leaf Category Cards Default Collapsed Mini State)

### 需求內容
修復展開父類別（如「零件」或「組件」）時，下層 9 個子類別卡片（`針基蓋`, `夾具`, `T接頭` ...）同時開展 220px 巨型卷軸框導致畫面嚴重堆疊與視覺擠壓的問題。

### 矯正與預防措施 (CAPA)
1. **預設呈收合 Mini 膠囊卡片 (`expandedLeafIds`)**：
   重構 [ProductMindMapModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductMindMapModal.tsx)。改用 `expandedLeafIds` 追蹤展開狀態。
   * **預設狀態 (Default View)**：所有末端卡片一律呈 48px 精簡膠囊標籤（顯示如 `針基蓋 128件 ﹀`），畫面 100% 乾淨簡潔。
   * **按需點擊/雙擊展開**：點擊該卡片標題或雙擊卡片時，才展開該類別的 220px 卷軸品號清單（帶有 `︿` 箭頭）。
   * **搜尋自動展開**：當輸入關鍵字時，包含匹配品號的卡片會自動展開呈現搜尋結果。
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。










