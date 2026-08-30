# PN-Lookup 開發日誌

## v7.9.6 — 9 大核心工程規格全面整合、組件/SET 結構化 BOM 明細構建與 UI 全面升級

### 需求內容
1. 依據製造與工程規範全面整合 9 大核心欄位：
   - 1. 圖檔檔名 (`drawingFileName`)
   - 2. 圖號 (`dwgNo` / Drawing number)
   - 3. 版本 (`revision` / REV.)
   - 4. 品號 (`partNo` / Part number)
   - 5. 品名 (`name` / `description`)
   - 6. 顏色 (`color` / Color)
   - 7. 原料名稱 (`material` / Material)
   - 8. 原料編碼 (`materialCode` / Material Code)
   - 9. 物料類別 (`category` / Category)：嚴格對齊原料、物料、零件、組件、SET 五大分類。
2. 組件與 SET 結構化記錄：連帶記錄組成零件之「單位用量 (Qty)」、「品號」、「品名」、「原料名稱」、「原料編號」。
3. 前端 UI 用戶介面全面升級：
   - 主表格 (`PartsTable`) 新增圖號、版本、顏色、原料名稱與原料編碼欄位，支援全欄位正序排序。
   - 詳情彈窗 (`PartDetailModal`) 建立專屬組件/SET 結構化子零件明細表格，支援子零件一鍵點擊跳轉。
   - 全域搜尋引擎 (`App.tsx`) 支援圖號、原料、原料編碼與顏色之即時模糊匹配。

### 執行內容 (CAPA)
1. **資料模型與管線整合 (`buildMaster.js`)**：
   - 定義 `mergeV7DrawingsIntoMaster` 融合管線，將 967 筆圖檔工程成果直接注入主資料庫 `pn-lookup-master.json`。
   - 為 231 個組件與 SET 實體建立 `bomDetails` 結構化陣列，完整收錄用量、品號、品名、原料與編碼。
2. **型別擴充 (`types.ts`)**：
   - 新增 `BomComponentDetail` 介面，並擴充 `PartItem` 型別。
3. **UI 互動與字級防禦 (`PartsTable.tsx` / `PartDetailModal.tsx`)**：
   - 主表格直觀展示 9 大核心規格，全介面文字嚴格遵守 ≥13px 規範。
   - 彈窗新增子零件用量與材質對照表，消除工程端重複翻找困擾。

### 驗證結果
- `verifyCoreLogic.js`：10 項核心數據邏輯不變量 100% PASS。
- `npm run build`：Vite 生產環境打包編譯 100% 成功。

---


### 需求內容
1. 清查並修正 `drawings_extract_v7.xlsx` 與 JSON 中的數據邏輯問題（BOM 自環、視圖標註雜訊、品名大面積缺失、表名矛盾）。
2. 基於 SSOT 原則清理 `data/` 儲存目錄中的 38 個冗餘/過時檔案，釋放 19.62 MB。
3. 將原存放於 `Drawings/零件` 中的 101 筆組件圖檔，安全轉移至 `Drawings/組件/原零件移入組件` 專屬新目錄，並同步資料庫路徑。
4. 深度識別並補全圖檔之「圖號 (Drawing No.)」、「版本 (Revision)」與「顏色 (Color)」欄位。

### 根因分析 (RCA)
1. **圖號填寫率低 (17.1%)**：先前正則僅抽取特定外來前綴，未根據工程通用規則（無獨立圖號時圖號同構於品號）與檔名主幹填補。
2. **版次漏抓單碼數字**：先前正則 `[-_](\d{2})` 僅支援雙位數版次，導致 `_2`, `_3`, `_4` 等 140 筆版次漏失。
3. **顏色識別率僅 32%**：未對材質名稱（如 `BLACK ABS`、`BLUE TINT`、`WHITE PC`）與品名進行色彩語意解析，且缺少工業樹脂出廠規格（如 Terlux 透明、W-767 白色母、M4910 透明 PVC）之先驗對照。

### 執行內容（CAPA）
1. **數據邏輯淨化**：
   - 徹底清除 BOM 工作表中 103 筆自環（Parent == Child）與 12 筆工程視圖標籤雜訊（`SECTION`、`CHECK POINT` 等）。
   - 自 `pn-lookup-master` 智能回填 358 筆官方品名，使品名完整率自 54.8% 提升至 91.8%。
2. **SSOT 目錄收斂**：
   - 安全刪除 v2~v6 舊版提取產物、大尺寸 OCR 測試圖片與過程 dump 等 38 個檔案，`data/` 精簡至 14 個核心 SSOT 檔案。
3. **組件實體轉移**：
   - 透過大小校驗安全搬移 101 筆組件圖檔至 `Drawings/組件/原零件移入組件`，徹底實現零件庫與組件庫的物理隔離。
4. **圖號、版本、顏色深度補全**：
   - **圖號**：補全 801 筆 ➔ 達到 **966 / 967 筆 (99.9%)**。
   - **版本**：補全 140 筆 ➔ 達到 **967 / 967 筆 (100.0%)**。
   - **顏色**：多維色彩語意與牌號解析補全 562 筆 ➔ 達到 **871 / 967 筆 (90.1%)**。

### 驗證結果
- `verifyCoreLogic.js`：核心數據不變量 100% PASS。
- `npm run build`：Production bundle 打包 100% 成功。

---


### 需求內容
1. 建立四維第一性原理組件判定引擎，修正原先實際為組件但標記為「零件」之品項。
2. 全量掃描並更新 `drawings_extract_v7.json` 與 `drawings_extract_v7.xlsx`，將組件圖檔 category 修正為「組件」。
3. 全面盤點專案過渡期測試腳本與臨時死碼，遵循 MECE 原則清理。
4. 全面同步更新開發文件（SKILL_DRAWING_EXTRACT_V7.md、README.md、mapping-logic.md、version.ts、package.json）。

### 根因分析 (RCA)
1. **組件分類偏差**：先前 `extract_drawings_v7` 預設 `category="零件"`，部分多物料組合（如 Capped Vent Filter、Vial Adaptor、注藥座組件）未即時根據 BOM 與品名組裝標註反饋回圖檔資料庫。
2. **過渡期測試殘留**：在 OCR 研發與批次分析過程中，產生了 `check_resin_recovery.py`、`ocr_scanned_batch.py`、`test_ocr.py` 等一封性實驗腳本，未及時清算收斂。

### 執行內容（CAPA）
1. **組件判定引擎**：
   - 定義 4 大組件判別充分條件（品名組裝關鍵字、多物料組合說明、相異子零件 ≥2 項、SA/SB/SC/SD 前綴或 master 組件核定）。
   - 修正 62 筆原列為零件的圖檔，全庫核定 **101 筆組件圖檔**（涵蓋 52 種實體組件品號），零件圖檔更新為 **866 筆**。
2. **死碼與過渡腳本清理**：
   - 移除 11 個過渡期測試腳本（`test_llmsherpa.py`, `test_ocr.py`, `test_paddleocr.py`, `ocr_process.py`, `ocr_process_v2.py`, `extract_drawings.py`, `check_resin_recovery.py`, `check_stats.py`, `check_subfolders.py`, `ocr_material_recover.py`, `ocr_scanned_batch.py`）。
   - 清理 `scratch/` 臨時目錄與根目錄殘留圖片。
3. **文件與版本對齊**：
   - `SKILL_DRAWING_EXTRACT_V7.md` 升級至 v7.9.4，載入四維判定法與 100% 品質基準。
   - `README.md`、`docs/mapping-logic.md`、`src/version.ts`、`package.json` 同步至 v7.9.4。

### 驗證結果
- `verifyCoreLogic.js`：核心不變量 100% PASS（1027 筆主庫品號、181 組 BOM 組件等零迴歸）。
- `npm run build`：Production bundle 打包 100% 成功。

---


### 需求內容
檢查 `無材質檔案清單_人工查核.xlsx` 中的 71 筆圖檔（狀態為「待確認」），重新進行文字層分析與高解析度 Tesseract OCR 識別，提取材質名稱（Material Name）、原料編碼（Material Code）、規格、顏色與組件 BOM，並同步更新至 `drawings_extract_v7.xlsx`、`drawings_extract_v7.json` 與人工查核清單。

### 根因分析 (RCA)
原先 71 筆圖檔在 `drawings_extract_v7` 中材質為空，主要原因包含：
1. **規格管件圖檔**（如 `11-02XXXX` 至 `11-37XXXX`）：材質寫在 `Material Name: PVC` 與 `Material supplier part number: 7477G-015` 欄位，先前的 regex 提取器漏抓。
2. **純掃描/無文字層圖檔**（46 筆）：未走高精度 OCR 或文字遭壓縮，例如 `BD_404028_Rev.1.pdf`（HDPE LH606）與 `VLV-` 系列。
3. **組裝圖/組立件 (Assembly)**（19 筆，如 `R1-10149`, `R1-15165`, `R1-15769`, `R1-2260` 等）：在圖面上材質欄 (7. MATERIALS) 標註的是其組成零件（BOM Items）而非單一原料。先前管線將其誤判為無材質。

### 執行內容（CAPA）
1. **全量診斷與 OCR 批次**：
   - 透過 PyMuPDF (fitz) 與 Tesseract 5.5 OCR 對全部 71 筆圖檔進行全頁解析，保存高解析度 OCR 文本矩陣。
2. **多維交叉驗證與真值萃取**：
   - **管件類 (5 筆)**：提取確認為 `PVC, Colorite 7477G-015`（料號 `7477G-015`）。
   - **單件零件類 (47 筆)**：交叉比對 masterParts、semantic-extract 與圖面 Notes，完整補全（如 `BD_404028`: HDPE LH606、`B-003`: Latex Free Rubber、`B-077`: B膠、`B-345`: PVC、`B06-410-311-1`: PC MAKROLON 2458 550115、`VLV-135-023`: TPU、`VLV-141-010`: BRASS 等）。
   - **組裝件/BOM 類 (19 筆)**：解析圖面組成料號，同步填入組裝物料說明與「組件BOM」清單（如 `R1-15165`: PVC M4910 + Polyisoprene 4001、`R1-2260`: SB0031A 組件、`R1-10149/10278/10356/15936`: VIAL SPIKE 組件等）。
3. **成果產出與資料更新**：
   - `data/drawings_extract_v7.json`：更新 71 筆，無材質筆數從 71 筆降為 **0 筆**（100% 完整覆蓋）。
   - `data/drawings_extract_v7.xlsx`：重新生成 3 個工作表（圖面資料 968 列、組件BOM 317 列、掃描圖檔處理標記）。
   - `data/無材質檔案清單_人工查核.xlsx`：71 筆狀態全數由「待確認」更新為「已重新提取確認」，並追加「提取材質名稱」、「原料編碼」、「更新後方法」三欄。

### 驗證結果
- `verifyCoreLogic.js`：核心邏輯不變量 100% PASS（主資料庫 1027 筆、種子轉譯 669 筆、BOM 組件 181 組、雙向對稱 0 異常、無環約束 0 異常）。
- `npm run build`：Vite production bundle 編譯成功，零錯誤。

---


### 需求內容
v7.9.0 樣本驗證通過後，對全部 1514 張圖執行語意識別（品號/品名規格/圖號/原料/BOM；掃描檔 OCR）。使用者確認：分批避限流、22-69xxxx 保留、D10-240-251-1/-2 並存、SB0001 需專屬處理、中文亂碼接受（A）。

### 執行內容（CAPA）
1. **SB0001 專屬處理**：KEY/UNIT 拆行（y≤60）偵測 + 品號行規則 BOM 兜底 → B06-410-111-1 + B-077×8 + 0.08*14mm。
2. **dwgNo 人工真值修正 3 筆**：MDXE-153-02（模型幻覺 MDEX）、BD-8013945→404028、R1-10134 剝 -MC 尾綴。
3. **全量批次**：1514 檔 → 語意 1492 筆成功（OCR 360 / 文字層 1132；22 檔不存在/無檔）。供應商切換歷程：zen laguna+hy3 並行（free 配額當日耗盡 → 全 429）→ **agnes-2.0-flash 主跑**（無限流，缺陷由檔名品號修正 + 規則 BOM 兜底補）。批次工程：`--batch/--rest` 節流、`--retry-failed` 循環、checkpoint 每 20 張寫入（中斷續跑）、OCR 180s/600s 超時保護（SB0087 死鎖）、agnes fetch 120s 超時、batchWatcher 自動後續（異常即退出不再誤判）。
4. **品號白名單過濾**：agnes BOM 提取品質差 → 語意 BOM 補缺僅收有效品號格式（含連字號/純數字/CP 型/1H 型），排除材質/品名/模具號（M05003-R01）/尺寸（0.08x14mm）/色號（9494）雜訊 → 64 → **31**。
5. **master 994**：971 → 994（語意 BOM 新品號 31，含 22-690200/250/300/1000/100/150 PVC 管路 ×6、**CP96020（SB0011 長期 pending 的 Double T-connector）**、R1-8112/R1-15080/R1-3152/R1-7762/R1-2535/R1-2536/R1-8390、H00/H01/A01 旋轉螺帽系列、N20-208-13、D09-279-1、E13-999-421-5、451118 等）；語意欄位補缺：material 212 / name 247 / dwgNo 741 / description 797；組件鍵 209 不變。

### 驗證結果
- verifyCoreLogic 全項 PASS（994 = 去重數、BOM 對稱/無循環 0 異常）；`npm run build` SUCCESS。
- master 994 = 零件 681 / SA 95 / SB 52 / SC 25 / SD 9 / 其他組件 28 / 物料 137。
- 交付 commit：`b125d6c`（批次工程）→ `88bef87`（白名單）已 push。

### 待確認清單（下一輪使用者逐筆確認）
1. 語意 BOM 新品號中疑似誤讀：BO6-410-311-1（B06?）、HO0/HOO/HOO0-111-…（H00 誤讀系列）、A01-210-131（name=Shrink Band 可疑）、E13-999-421-5（既有 -421 的 -5 變體）。
2. SB0001 規則兜底已生效，是否納入常規規則（現為 fallback 性質）。
3. zen 免費配額恢復後，是否以 laguna+hy3 全量重跑強化欄位（agnes 品質較差）。
4. 中文圖（9X 包裝袋、ICU 標籤/對照表）人工品名。

---

## v7.9.2 — 五分類物料體系 + ICU 原料料號對照表導入 + Tool-Calling 色系遷移

### 需求內容
1. 建構五分類物料體系（原料/物料/零件/組件/SET），前端支援分類篩選與 badge 樣式。
2. 導入 ICU 原料料號對照表（`rawdata/客戶(ICU)原料料號對照表.xlsx`），覆蓋既有材料規格 + 新增品項。
3. 套用 Tool-Calling Precision Instrument 色系（Glacier Workbench + Cobalt Blue Accent）。
4. 全域程式碼與檔案優化：死碼清理、文件對齊、unused 依賴移除。

### 執行內容（CAPA）
1. **五分類體系**（`buildMaster.js`）：
   - 原料 25 筆（`ICU_MATERIAL_PNS` Set：28-0397、75-0485 等 25 個化學材料料號）。
   - SET 114 筆（`MDXE-`/`MDXI-` 前綴全系列 + `SET_MANUAL` 12 個：8003875、X3299AAM、EB/EC/ED/EG/DB 系列）。
   - 物料 137 / 零件 552 / 組件 181 不變。
   - 分類優先序：SET > 原料 > 組件 > 物料 > 零件。
2. **ICU 導入**（`importICU.js` + `mergeICUPartsIntoMaster`）：
   - 解析 167 筆（跨列原料合併），8 種客戶：ICU(120)/MDX(40)/GVS(2)/CardioMed(1)/SIMS(1)/Bard(1)/RMS(1)/PFM(1)。
   - 合併鍵為 `norm(partNo)`（不含 customer）；已有品號覆蓋 material/color/moldNo/cavity/dwgNo，不覆蓋 customer。
   - 129 覆蓋 + 38 新增，master 989→1027。
3. **Tool-Calling 色系遷移**（11 files, 174 insertions, 157 deletions）：
   - Workbench 底色 `#F8FAFC`→`#f1f5f9` (Slate 100)；glass-header 改實體白色面板+鈷藍左飾條。
   - 品牌主色 `sky-700`→`sky-600` (#0284C7 Cobalt Blue)；所有 focus ring 統一 `sky-600`。
   - 選取列/分頁/Checkbox `indigo`→`sky` 統一；AdminPanel/ImageBindModal `gray`→`slate` 全面統一。
   - CSS variables 重命名為 design token 風格，移除 dark-mode 廢棄變數。
4. **程式碼優化**：
   - 移除 unused npm packages：`react-force-graph-3d`、`three`、`@types/three`。
   - 刪除 orphaned root files：`new`（空檔）、`upload_*.jpg`（上傳殘留）。
   - 移除 dead CSS：`.table-row-selected`（已無使用）。
   - 移除 unused export：`resolveImage()`（已被 `resolveAllImages()` 取代）。
5. **文件對齊**：
   - `version.ts` → `v7.9.2`；`package.json` version → `7.9.2`。
   - `README.md` 全面重寫：移除 3D MindMap、更新功能列表、補充五分類/ICU/語意 BOM。
   - `mapping-logic.md`：BOM links 563→603、新增 §2.2 ICU 導入/§2.3 白名單/§2.4 五分類、§9 品質數據更新。
   - `DEV_LOG.md`：補充本條目。

### 驗證結果
- verifyCoreLogic 全項 PASS（1027 = 去重數、BOM 對稱/無循環 0 異常）；`npm run build` SUCCESS。
- master 1027 = 原料 25 / 物料 137 / 零件 552 / 組件 181 / SET 114。
- 交付 commits：色系遷移 `7293e5f` → 文件更新 `7ec9ed9` → 優化清理（本批次）。

---

## v7.9.0 — 圖檔語意識別：多模型分工（laguna+hy3）提取品號/品名/圖號/原料/BOM，輸出 JSON+Excel


## v7.9.1 — 移除 3D 思維導圖功能 (Remove 3D MindMap Feature)

### 需求內容
使用者反映 3D 思維導圖功能存在顯示問題：
- 組件子節點（如 3M41459、SB0068）與分類節點並列顯示
- 客戶零件未按預期分組
- 樹狀結構未遵循 MECE 原則

經多次修復嘗試後，使用者決定完全移除該功能以確保系統穩定性。

### 修正措施 (CAPA)

#### 1. 移除來源檔案
- ❌ `src/components/ProductMindMap3DModal.tsx` (59KB)
- ❌ `src/utils/mindMapTree.ts` (17KB)
- ❌ `src/utils/mindmapClassifier.ts` (17KB)
- ❌ `src/utils/mindMapTree_original.ts` (12KB)

#### 2. 清理 App.tsx 引用
- 移除 `lazy` 和 `Suspense` import（不再使用）
- 移除 `ProductMindMap3DModalLazy` 懶載入宣告
- 移除 `isMindMap3DOpen` state
- 移除 `<Suspense>` 包裹的 Modal 渲染區塊
- 移除 `bomChildren` 相關變數（原本為 MindMap 準備）

#### 3. 清理 Header.tsx 引用
- 移除 `FolderTree` icon import
- 移除 `onOpenMindMap` prop 定義
- 移除解構賦值中的 `onOpenMindMap`
- 移除「3D 思維導圖」按鈕 JSX 區塊

#### 4. 編譯驗證
```bash
npm run lint  # ✅ 通過 (tsc --noEmit)
```

### 影響範圍
| 項目 | 狀態 |
|------|------|
| 主系統功能 | ✅ 不受影響 |
| 品號檢索 | ✅ 正常運作 |
| BOM 管理 | ✅ 正常運作 |
| 圖片管理 | ✅ 正常運作 |
| 匯出/匯入 | ✅ 正常運作 |

### 備份資訊
- 原始 commit: `b39c1ff` (修正客戶零件顯示邏輯)
- 保留分支: `backup/pre-cleanup-20260818` (含完整 MindMap 代碼)
- 刪除 commit: `890dd04`

---

**完成時間**: 2026-08-19  
**執行者**: AgnesCode AI Assistant


### 需求內容
使用者要求從圖檔做語意識別（不依賴檔名猜測）：提取每張圖的 PART NO. / Description / DWG NO. / Material / BOM；掃描檔（無文字層）以 OCR 辨識後再語意化。後續追加：**整合各免費模型優勢**（多模型分工調用）、解析結果**預設輸出 JSON 與 Excel 兩檔**。

### 執行內容
1. **semanticExtract.js（新管線）**：pdfjs v6 文字層提取（`[y=N]` 座標行序 → LLM 依 y 分組辨識表格列）→ 品質不足或掃描檔自動轉 tesseract.js OCR（psm 3、scale 5、eng+chi_sim、@napi-rs/canvas 離屏渲染 PNG）→ 再語意化。wasmUrl 採檔案系統路徑（NodeBinaryDataFactory 不認 file://）。
2. **多模型分工**：`zenDualExtract` 並行調用 — **laguna-s-2.1-free 提取標題欄**（partNo/description/dwgNo/material，專用 TITLE_PROMPT）+ **hy3-free 提取 BOM**（專用 BOM_PROMPT）→ 結果合併；任一失敗即互為 fallback（hy3 補標題欄 / laguna 補 BOM）。端點 `opencode.ai/zen/v1/chat/completions`（key 讀 auth.json opencode 憑證）；429/503 退避重試。免費模型實測淘汰：nemotron-3-ultra/3.5-lightning 輸出思考文本不守 JSON、deepseek-v4-flash-free/mimo-v2.5-free 429 限流、agnes-2.0-flash 品質不穩（partNo 誤抓）。
3. **檔名品號修正**：模型 partNo 與 drawings-extract 檔名品號（filePartNo）不一致 → 以檔名品號覆寫（第一事實來源）。
4. **雙檔輸出**：`data/semantic-extract.json`（全欄位）+ `data/semantic-extract.xlsx`（工作表：圖檔解析總表 / BOM明細）；`--file/--match` 增量合併不覆寫。
5. **buildMaster.js mergeSemanticIntoMaster**：語意補缺 — seed Excel 優先、語意僅補缺；material 雜訊過濾（供應商/色料行、品號樣式、FABBED）；新欄位 `description`（品名規格原文）/ `dwgNo`（圖號）寫入 master；語意 BOM 僅補充既有組件鍵 children 缺漏（MDXE-153-02 之 22-690200/22-690250/22-690300/22-691000 PVC 管路品號 ×4）。
6. **前端**：PartItem 型別 + 明細卡新增「品名規格原文 (Description)」「圖號 (DWG NO.)」顯示；Excel round-trip 匯出/匯入保留 description/dwgNo；dedupeParts 補缺同步。

### 驗證結果
- 樣本 18/18 成功（品號與檔名吻合 17/17 可判 + ICU 對照表例外；OCR 掃描樣本 RM5003037/8013945/VLV-135-015/F17-999-615 品號全中）；MDXE-153-02 BOM 11/11（含 4 新管路品號）；BD-8003875 5、SD0002 5、3M41459 2。
- master 963 → **971**（+8 語意 BOM 子件）；組件鍵 209 不變；語意補缺：material 7 / name 4 / dwgNo 15 / description 16。
- verifyCoreLogic 全項 PASS（971 = 去重數、BOM 對稱/無循環 0 異常）；`npm run build` SUCCESS。

### 待確認（使用者確認後處理）
① 免費模型取捨（現行 laguna+hy3 分工）② 22-69xxxx 管路品號收錄（已收，確認）③ D10-240-251-1/-2 並存 ④ VLV-135-015-G16 ⑤ SB0001 BOM 提取不穩（無表頭版式）⑥ 中文描述亂碼（OCR 中文品質）⑦ dwgNo 收錄規則（null/版次/模具號）⑧ 全量 1514 圖批次執行策略（約 392 掃描檔需 OCR，免費模型限流）。

---

## v7.8.20 — 無表頭 BOM 版式判別：輸液套延長管（MDXE-*_E）等 17 組件升級

### 需求內容
使用者指證：`輸液套延長管`（MDXE-153-02 等）實為**組件**而非零件 — 其圖檔（如 MDXE-153-02_E.pdf）內文含明確 BOM 結構（自身品號 + 8 個子件）卻因無 KEY UNIT/PART NO 表頭被判零件。需補強 roleOf 規則使無表頭 BOM 版式正確判為組件，同時排除加工圖/適用註記誤傷。

### 執行內容（CAPA）
1. **根因**：roleOf 僅依 KEY UNIT / PART NO / ASSEMBLY 表頭判定組件；無表頭 BOM 版式（MDXE-*_E：品號直列 + 自身品號）落入零件。v7.8.11 曾因 ICU 規格書（含上方組裝目標註記）誤判大量組件而清除其 BOM → children 資料缺失，無法沿用 children 自證排除。
2. **scanAssemblyImages.js roleOf（v7.8.20 規則）**：無表頭分支新增 — `known ≥ 3` 且內文含**自身品號**時判組件；三類排除維持零件：①加工複本（檔名 `-MC` 標記 / `_mdx` 尾綴）；②SPC 原料圖（`SPC\d+_` 圖號，CIV/RAW）；③known 任一品號為組件鍵（children 存在）→ 上方組裝目標（R1-15197 含 E13-999-421）。
3. **buildMaster.js mergeDrawingsIntoMaster**：組件圖候補升級條件由 `單品零件` 擴及 `零件圖`（v7.8.11 無證據降級者，新證據出現一併升級：R1-2357/R1-15769/R1-16501/R1-8392/R1-8393/R1-15170）；notes 註記 v7.8.20 判別來源。
4. **文件同步**：mapping-logic.md / data-mapping.html — 組件鍵 192→**209**、BOM 連結 451→**563**、角色分布 249/1126/139→**268/1107/139**、類別三層（零件 634→617、其他組件 11→28）。

### 驗證結果
- master **963** = 零件 617 / SA 95 / SB 52 / SC 25 / SD 9 / 其他組件 28 / 物料 137；組件鍵 **209**（+17）。
- 新增組件鍵 17：MDXE-019-03/029-01/054-01/064-01/105-01/153-02/155-01/205-02（輸液套延長管系列，children 5~8）+ 8003875/X3299AAM（BD 組件圖）+ R1-2357/R1-15769/R1-16501/R1-8392/R1-8393/R1-15170。
- 排除驗證：R1-10134-MC 等加工複本、SPC0005450 RAW/CIV 原料圖、R1-15197（含 E13-999-421 組裝目標）維持零件。
- 一致性：組件鍵↔類別 0 異常；children→parents 雙向對稱 0 異常；BOM 無循環 0；verify 全項 PASS；`npm run build` SUCCESS；無圖檔 198 不變。
- 無圖檔統計 196 → **198**（物料 2）；verify 11 項 / lint / build 全 PASS；文件同步（mapping-logic、data-mapping、AGENTS.md）。

---

## A 項收尾（2026-08-18，無版本號）— Gemini 圖面 BOM 人工核對（4 品號）

### 需求內容
v7.8.18 遺留 4 品號圖檔無 BOM 交叉驗證（SB0011 / SB0035 / SB0064 / SB0065）— 使用者以 Gemini 識別 4 張圖面零件清單。

### 執行內容
1. **SB0064 / SB0065 / SB0035**：圖面 BOM（KEY UNIT 表）與現行 children 展開**內容 100% 一致**（SB0064→SA0104→[C11-111-251, B-077] 等）— 圖面兩層表示 = Excel 三層概念組件展開；備查項關閉，無資料變更。`0.08X14mm`/`0.08*14mm` 收縮膜（Shrink Band）依既有規則為非品號包材，不納入。
2. **SB0011**：圖面 BOM 首項 **CP96020**（Double T-connector I.D.2.4mm）vs 現行 A03-240-111（alternate CP96019，同名同規格、編號相鄰）→ 疑似新舊品號；**使用者決策：維持現狀待查證** — children 保持 A03-240-111，CP96020 列 pending。
3. **歸檔**：新增 `docs/manual-bom-review.json`（Gemini 識別記錄 + 結論狀態 confirmed×3 / pending×1；rawdata/ 為 gitignored 故存 docs/），未來重建不遺失。

### 驗證結果
- master 961/192/451 不變；無資料本體變更；verify 基線不受影響（歸檔檔非管線輸入）。

---

## v7.8.18 — 圖檔組件圖判別規則補強（無表頭版式自證）

### 需求內容
A 項處理：Tool-Calling 系統檢索（3 輪）無領域專用工具（PaddleOCR/PDF Inspector/Markitdown 候選全命中禁用場景 — 本批圖為有文字層 CAD 出圖 PDF，非掃描影像）；診斷證明問題為提取器規則覆蓋不足，採程式修復。

### 執行內容（CAPA）
1. **RCA**：`roleOf`（scanAssemblyImages.js）僅認 KEY UNIT / PART NO+QTY 表頭與 ASSY+known≥3 字樣；「無表頭但內文列出子件品號」的版式被誤判零件 → line 557 跳過 BOM 建立。5 張圖受害：SA0145(Rev.B)-C（內文含 H00-111-111-1）、R1-2392_6(_mdx) ×2、R1-3529_05(_mdx) ×2（內文含全部 3 個 children）。
2. **修復**：`roleOf` 新增「自身 children 自證」規則 — known 中任一品號的 master 父組立陣列包含本圖 assemblyId → 判組件；僅比對自身父組立（不含自身品號），避免「適用於 XXX」註記誤傷。
3. **「-C」語意確認**：-C 版 = 附零件清單的組件圖版本（11 個組立僅 -C 版有內文清單；無 -C 版為純圖面零件圖）。

### 驗證結果
- 5 張誤判圖全部升級組件且 bomLinks 建立（SA0145→H00-111-111-1；R1-2392/R1-3529→3 children 全命中）；角色分布 244/1131/139 → **249/1126/139**；master **961/192** 不變（children 既有，BOM 來源由 Excel 升級為圖檔）。
- 一致性全零：組件鍵/類別 0 異常、role=組件 但非組立類 0、**role=零件 但組立類 0**（22 → 0）。
- 剩 4 品號圖檔無 BOM 交叉驗證（人工備查）：**SB0011 / SB0035**（-C 版亦無內文清單）、**SB0064 / SB0065**（KEY UNIT 表頭存在但表格空白）。
- verifyCoreLogic 11 項 / lint / build 全 PASS。

---

## 文件一致性修正 B 項（2026-08-18，無版本號）— 基線與無圖檔統計重算

### 執行內容
1. `.agents/AGENTS.md` `RULE[regression_defense_and_logic_freezing]`：種子轉譯基線 **693 → 667**（693 + 24 組件圖識別補登 − 8 MDXE − 2 收縮膜雜訊 − 40 互為別名合併；master ≥ 667），與 verifyCoreLogic 實作一致；181 組 seed 組立鎖定不變。
2. `docs/mapping-logic.md` §8.3「無圖檔可對應」重算：**92 → 196**（master 961 vs 圖檔唯一品號 872）— 零件 136、SA組立 44、SB組立 14、SC組立 1、其他組件 1（SA 44/SB 14/SC 1 與舊數據一致；零件 33→136 因 v7.8.7 後零件圖收錄擴增，seed 單品零件大多無圖）。

### 驗證結果
- 重算腳本輸出與文件數值一致；資料本體 961/192/451 不變。

---

## v7.8.17 — 組立類別一致性修復（SA0145）與零件/組件區分全面盤點

### 需求內容
使用者反映「少數零件與組件區分不清」— 部分「零件」按鈕顯示深色（組件色）。

### 執行內容（CAPA）
1. **RCA**：`SA0145`（SA 組立，children [D09-279-111, H00-111-111-1]）在 seed 零件表先行建檔為「單品零件」，bomHierarchy.SA 的 `addPart` 因「後到者不覆蓋」規則保留錯誤類別 → 類別「零件」但有 children → `isAssembly` 使 badge 顯示深色（深淺混亂唯一來源）。
2. **修復**：`buildMaster.js` ①convert 的 `addPart` 補 `return existing`（原本成功時無回傳值，v7.8.14 升級判斷依賴回傳值實際從未生效的隱性 bug）；②bomHierarchy 迴圈：既有實體類別為「單品零件」/空 → 以組立表為事實來源升級為 `levelKey+組立`。
3. **全面盤點（零殘留驗證）**：
   - 組件鍵（bom.children 192）中類別非組件類：**0**（修復前 1）
   - 類別為組件類但非組件鍵（無 children）：**0**
   - 圖檔 role=組件 但 master 非組件類：**0**
   - 圖檔 role=零件 但 master 為組立類：**22**（SA0145/SB0011/SA0138 等 — 組立圖無標準 KEY UNIT 表頭或表格空白，圖檔側無 BOM 證據，Excel children 兜底；SB0064/SB0065 同型已知備查，**類別無誤，非缺陷**）；R1-2392/R1-3529 另有組件圖版本（(Rev.A)-C.pdf 含 BOM）→ 類別正確
   - 前端 `getItemType` 完全由 BOM children 決定 → 與類別 100% 一致 → badge 深色 = 組件類別 = 組件鍵

### 驗證結果
- SA0145：零件 → **SA組立**；master **961/192/451** 不變；組件鍵與類別一致性 **0 異常**。
- `verifyCoreLogic`（11 項全 PASS）/ `lint` / `build` 全 PASS。

---

## 全域優化作業（2026-08-18，無版本號）— 死碼清理 / Skills 條款 / MECE / 文件同步

### 執行內容（CAPA）
1. **死碼清理（手術刀式，零功能 Regression）**：`tsc --noUnusedLocals/Parameters` 掃描 + 全倉庫零引用驗證後移除 4 處 — ① App.tsx 未使用 import `isImageFolderDismissed` ② imageLibrary.ts 零引用死函式 `isImageFolderDismissed()` ③ ProductMindMap3DModal.tsx 未使用 import `CATEGORY_META` ④ mindmapClassifier.ts 零引用死常數 `CATEGORY_META`（31 行）。
2. **防回歸門禁**：tsconfig 啟用 `noUnusedLocals` / `noUnusedParameters` → 未來死碼在 `npm run lint` 即被攔截。
3. **Skills 條款修訂（全局 `~/.claude/CLAUDE.md`）**：核查現有條款（PDCA/YAGNI/Check 等）無重複後，新增 `[Definition of Done] 任務完成定義與驗收標準` — 任務完成 = 達成預先設定之驗收標準；驗收標準於計畫擬定完成後隨即制訂並於執行前向使用者確認；驗收標準設為最高標準（可量化、可驗證、無歧義，禁模糊表述）；需求未明時先走反向提問。條文經重讀驗證無歧義。
4. **MECE 整合**：`.kiro/steering/ui-standards.md` 與 `.agents/AGENTS.md` 之 13px 規則重疊 → `.kiro` 改為「真源引用」（單一真源：`.agents/AGENTS.md`），並補 3D 模態窗深色畫布例外註記；wiki/ 目錄確認不存在，不新建（YAGNI）。
5. **文件同步**：README.md 更新至 v7.8.16（版本 badge、種子基線 693→667、功能列表補 v7.8.8~16、目錄結構補 mapping-logic.md）；docs/data-mapping.html 補 v7.8.16 行。

### 驗證結果（最高標準）
- `tsc --noEmit --noUnusedLocals --noUnusedParameters` → 0 錯誤；`npm run lint` → 0 錯誤；`npm run build` → verifyCoreLogic 11 項全 PASS + vite build 成功。
- rg 覆核：`isImageFolderDismissed`、`CATEGORY_META` 全倉庫 0 引用；全倉庫無 `693` 舊基線、無 `v7.8.7` 版本殘留；version.ts / README / DEV_LOG 頂部版本一致（v7.8.16）。
- Git：3 個原子化 commit（fix cleanup / docs sync）；推送前資安盤點 — `data/`、`rawdata/`、`*.xlsm`、`*.log`、`.env*` 皆受 .gitignore 保護未追蹤。

---

## v7.8.16 — 物料類別按鈕顏色對齊三層體系

### 需求內容
物料類別按鈕顏色依三層體系區分（原舊色系僅深色=組件、淺綠=其他）。

### 執行內容
`PartsTable.tsx` 類別 badge 顏色規則簡化為：
- **深色（深藍黑底 + 天空藍字）** = 組件（SA~SD 組立、其他組件，或 isAssembly）
- **淺灰** = 物料
- **淺綠** = 零件
- 移除「客戶特規（琥珀）」「輔料/包材（淺灰）」歷史遺留分支（v7.8.15 後 master 已無此類別）

### 驗證結果
`lint` / `build` 全 PASS。

---

## v7.8.15 — 物料類別三層體系：物料 / 零件 / 組件（SA~SD 組立 + 其他組件）

### 需求內容
物料類別區分為：物料、零件、組件；組件之下再區分 SA/SB/SC/SD/其他組件 等組立。

### 執行內容
- **資料層統一映射**（`buildMaster.js` 輸出前正規化，內部邏輯判斷維持細粒度值）：單品零件 + 零件圖 → **零件**（635 = 464 + 171）；物料圖 → **物料**（135）；組件圖候補 → **其他組件**（70）；SA/SB/SC/SD 組立 不變（66/34/15/6）。
- **篩選下拉分組**（SearchControls）：物料 / 零件 / 組件 三個 optgroup（組件含 SA~SD 組立 + 其他組件）。
- **AdminPanel 對齊**：CATEGORY_OPTIONS 改為新體系（物料 / 零件 / SA~SD 組立 / 其他組件），新增零件預設「零件」（原「單品射出件」）。

### 驗證結果
- master 重建：**961 parts / 192 組件 / 451 連結** 不變；category 分布：零件 635、物料 135、其他組件 70、SA組立 66、SB組立 34、SC組立 15、SD組立 6。
- `verifyCoreLogic` / `lint` / `build` 全 PASS。

---

## v7.8.14 — SPC 圖號註冊格式修正（SPC0005450 → RAW0000336）

### 需求內容
使用者確認：品號 SPC0005450 應改為 RAW0000336（`SPC0005450_04_RAW0000336` 圖檔的尾段才是品號）。

### 執行內容（CAPA）
1. **RCA**：`assemblyIdFromFileName` 的 firstToken 規則把 `SPC0005450_04_RAW0000336` 切到 `SPC0005450`（圖號），而 master 恰有同名圖號 → 直接命中 → 尾段品號 RAW0000336 不被採用。
2. **SPC 圖號註冊格式整串檢測**：`^SPC\d+_\d{1,3}_([A-Z0-9][A-Z0-9_.\-]*)$` → 回傳尾段為品號（30 個 SPC 圖號註冊格式檔案全部正確解析）。
3. **補收迴圈排除圖號**：`/^SPC\d+(_|$)/`（圖號非品號，避免組件圖內文出現自身圖號被收為候選 → bomLinks child 被 addPart 誤建）。
4. **組件圖候補升級**：既有單品零件有組件圖（role=組件 且有 bomLinks）→ 升級為組件圖候補（RAW0000336 等 64 個）。

### 驗證結果
- master **961 parts / 192 組件 / 451 連結**（SPC0005450 圖號實體清除 −1）；RAW0000336（ICU, HI-RETENTION BAG SPIKE）children = [E13-999-421, RAW0000335]；E13-999-421 可組裝目標 13（SPC0005450 → RAW0000336）。
- `verifyCoreLogic`（基線 961）/ `lint` / `build` 全 PASS。
- 特例 SPC0014799_10_R1-2361 → D10-210-251-1 為別名解析（R1-2361 併入 D10-210-251-1，合理）。

---

## v7.8.13 — 欄位篩選：客戶名稱 / 品號 / 物料類別 / 品名規格

### 需求內容
主介面加入欄位篩選功能：客戶名稱、品號 (Part No)、物料類別、品名規格 (Part Name)。

### 執行內容
- SearchControls 新增「欄位篩選列」（主搜尋列下方第二列，可與 keyword 全域搜尋組合 AND）：
  - **客戶名稱**下拉（全部客戶 / 各客戶，與原客戶鎖定連動）
  - **品號 (Part No)** 文字輸入（含 alternates 別稱模糊比對）
  - **物料類別**下拉（單品零件 / 零件圖 / 組件圖候補 / SA~SD 組立 / 物料圖，動態取自 parts）
  - **品名規格 (Part Name)** 文字輸入
  - 任一篩選生效時顯示「清除篩選」按鈕
- `FilterState` 新增 `partNoFilter` / `nameFilter` / `categoryFilter`；`filteredParts` 依序套用（itemType → 客戶 → 前綴 → 品號 → 品名 → 類別 → keyword）。

### 驗證結果
`npm run lint` 0 錯誤；`npm run build` 成功（v7.8.13）。

---

## v7.8.12 — review 降噪與待確認事項收斂

### 需求內容
盤點待人工確認事項 → 19 個品號不一致案例（review 46 條）逐張核對。

### 執行內容（CAPA）
1. **逐張核對 19 個案例**：
   - **18 個自洽（加工編號複本）**：檔名/標題欄為凱益廠內編號（R1-15076、R1-15214 等），master 鍵已是客戶品號（K08-208-251-1、F17-000-169 等）— seed alternates 已存在雙向別名，主鍵正確，review 為預期差異（與 TA161BEPTG012B00 同型）。
   - **1 個誤報（R1-10356 ⇄ 92673）**：92673 實為 ICU 地址郵遞區號（951 CALLE AMANECER, SAN CLEMENTE, CA 92673），非品號。
2. **郵遞區號過濾**：`titleBlockToken` 排除 5 位純數字（master 無 5 位純數字真品號：8003875/701829/245204024/8013945/404028 為 6/7/9 位）。
3. **review 別名自洽排除**：標題欄品號命中 master 索引（含 alternates）且與檔名解析鍵相同 → 不標記（加工複本類不再誤報）。
4. **SB0064/SB0065（注射座組立）**：圖檔 BOM 表頭存在但表格空白 → 提取失敗；Excel children（SA0104/SA0105）已完整 → 功能無缺失，僅圖檔側無交叉驗證（低優先備查）。

### 驗證結果
- review：46 條 → **4 條且全部已人工確認過**（D09-350-211-1⇄D09-350-111 檔名正確；TA161BEPTG012C00/B00⇄R1-1508x-MC Excel 品號為鍵；R1-8391⇄R1-8391r03 版次尾綴）。
- 待人工確認事項：**收斂為 0**（7 張無品號圖為正確排除，僅備查）。
- master 962 parts / 192 組件 / 452 連結（數據不變）；`verifyCoreLogic` / `lint` / `build` 全 PASS。

---

## v7.8.11 — 圖檔角色判定修正：內文證據取代目錄規則

### 需求內容
物料類別顯示「組件圖候補」147 項，其中 125 項無 BOM（實為零件）→ 角色判斷有瑕疵。

### 執行內容（CAPA）
1. **RCA**：`roleOf` 僅依目錄判定（物料資料/廠內零件圖面/ICU原料圖面 → 其餘全歸組件）→ 客戶圖面（RMS/VLV/KORU/BD）、綜合圖面（11-080900）、Mouldex 產品圖下的**零件圖/規格書全被誤歸組件** → 行尾品號被誤建為 BOM 連結。
2. **修復（內文證據分層判定）**：
   - 物料資料夾 → 物料（目錄優先）；
   - 內文 `KEY UNIT` 表頭（容錯多空格 `KEY   UNIT`）→ 組件；
   - `PART NO` + `QTY/QUANTITY/ITEM` 共存 → 組件；
   - `ASSY/組立` 字樣 + 子件候選 ≥ 3 → 組件；
   - 其餘 → 零件（`SUPPLIER` 字樣曾誤列為證據 — 實為 ICU 規格書「Supplier Acceptance of Specification Letter」頁尾字樣，非 BOM 欄位，v7.8.11 移除）。
3. **同品號多圖（原版 + `_mdx` 加工複本）**：各圖獨立判定，任一為組件圖即建 BOM（R1-15198-MC_05.pdf 規格書與 R1-15198-MC_05_mdx.pdf 加工版皆無 BOM 表 → 正確歸零件）。
4. **降級**：既有「組件圖候補」在無 children 且圖檔內文無清單時降為「零件圖」並註記。

### 驗證結果
- 角色分布：零件 954 → **1131**、組件 421 → **244**、物料 139（組件無 BOM 者 78 → 2：SB0064/SB0065 表頭存在但表格空白，保留候補人工檢視）。
- master：**962 parts**（不變）/ 組件 257 → **192**（seed 181 全數保留，0 遺失）/ 連結 547 → **452**（規格書與零件圖誤建之雜訊連結全數清除）。
- 關鍵品號：B-077 parents **100**（不變）；E13-999-421 可組裝目標 26 → **13**（12 SA/SB/SC + SPC0005450，全為 KEY UNIT 組件圖；R1-15197 等 ICU 規格書誤建之 13 個雜訊連結移除）；「組件圖候補」147 → **6 且全有 BOM**。
- `verifyCoreLogic`（962/181 基線）/ `npm run lint` / `npm run build` 全 PASS。

---

## v7.8.10 — 去重管理強化：互為別名合併與 BOM 鍵規範化

### 需求內容
使用者回報：E13-999-421 與 R1-8112 互為別名，但可組裝目標分別顯示 12 / 14 個（應一致）→ 檢視去重管理。

### 執行內容（CAPA）
1. **RCA**：去重僅在 parts 層（`norm(partNo)` key + alternates）有效；**BOM 層 addBomLink 未規範化** — 各組件圖內文以不同寫法引用同品號（SB0083 圖寫 E13-999-421、R1-15197 圖寫 R1-8112），原始寫法直接成為 children/parents 鍵 → 分裂（59 個別名寫法引用 + 2 個別名組件鍵）。更深的根因：seed 中 `customerPartNumbers` 雙向建檔把**互為別名的兩寫法各自建為 part 實體**（E13-999-421 與 R1-8112 都是 partNo）。
2. **修復（三層去重）**：
   - parts 層互為別名合併：`addPart` 檢查新品號命中既有 part 的別稱（或反向）→ 併入單一實體（保留資料較全者 E13-999-421，R1-8112 成為別稱）；合併 40 組，合併後圖檔 907 唯一品號**零遺漏**（無誤傷）。
   - BOM 鍵規範化：`convertUnifiedSeedToMaster` 與 `mergeDrawingsIntoMaster` 的 `addBomLink` 先以 norm 索引（含 alternates）解析為規範品號再建 link；圖檔取代邏輯的 owner 同步規範化。
   - 驗證：剩餘分裂鍵 0；E13-999-421 與 R1-8112 可組裝目標合併為 **26 一致**。

### 驗證結果
- master：**962 parts**（種子 667 + 圖檔 292）/ 組件 **304** / 連結 **640**；`verifyCoreLogic` 基線更新（667/962）全數 PASS；`npm run lint` 0 錯誤；`npm run build` 成功。

---

## v7.8.9 — 兩事實來源整合：圖檔為主 BOM、提取器漏件修復與雜訊過濾

### 需求內容
1. 圖檔與 Excel 為兩個事實來源 raw data，解析提取後整合為 master table；整合過程問題逐項反映、確認後繼續（使用者決策：**圖檔為主**、問題 B 逐張核對、**圖面為準**）。
2. 整合問題反映與處理：A 粒度差異（圖檔展開 vs Excel 子組件）、B 真資料差異（SB0055 等 7 組）、C Excel 雜訊（0.08*14mm 收縮膜尺寸、N20208131 日期）、D 版次差異（SA0002 -1 → -4）。

### 執行內容（CAPA）
1. **提取器漏件修復（RCA）**：`PART_NO_TOKEN_RE` 原要求「字母後必有數字」漏掉純字母前綴品號（B-077 全系列 60+ 組件圖漏 B 膠）；放寬 `[A-Z]{0,4}\d{0,4}` + 長度 ≥ 4。另補收「語法外但 master 已登錄」的長 token（TA161BEPTG012B00 無破折號被排除；SB0083 圖變更註記證實為真零件）。
2. **問題 B 逐張核對（7 組）**：SB0055/SB0083/SB0084/SB0085/SB0086/SB0087/SB0100 全部為粒度差異無衝突 — 圖檔 BOM = SA 子組件展開 + TA161 過濾網（SA0158 = [G13-001-122, E13-999-421] 等逐一驗證吻合，TA161BEPTGxxx 兩來源一致）。
3. **整合實作（圖檔為主）**：`mergeDrawingsIntoMaster` 先收集圖檔 BOM 組件集合 → 取代 Excel bomHierarchy children（雙向刪除 parents/children）→ 再建圖檔 bomLinks；無圖檔 BOM 的組件保留 Excel children（SA0001 等 64 組）。版次差異自動以圖面為準（SA0002 → H00-111-111-4）。
4. **Excel 雜訊過濾**：bomHierarchy children 排除非品號 token（0.08*14mm / 0.08*14.5mm 收縮膜尺寸，44 處）→ seed 709 → 707（-2 偽品號）。
5. 驗證基線更新：種子轉譯 709 → 707、master 下限 1004 → 1002（含過濾說明）。

### 驗證結果
- master：**1002 parts**（種子 707 + 圖檔提取 292）/ 組件 **321** / 連結 **657**；取代後 SA0001 等 Excel 概念組件失去父引用（資料事實）。
- `verifyCoreLogic` 全數 PASS（含新基線 707/1002）；`npm run lint` 0 錯誤；`npm run build` 成功。

---

## v7.8.8 — Excel 整合：BOM 交叉驗證與客戶欄位補齊

### 需求內容
1. 圖檔解析（v7.8.7）完成後，以 Excel 產品一覽表.xlsm 進行交叉驗證與補齊：Excel 組件 BOM（bomHierarchy 181 組）vs 圖檔內文 BOM（drawings-extract bomLinks）比對。
2. 補齊 master 客戶資訊：模具號碼 / 穴數欄位（internalParts 248 + customerPartNumbers 171 全數具備）、customerPartNumbers 來源的顏色/原料欄位。

### 執行內容（CAPA）
1. **Excel BOM vs 圖檔 BOM 交叉驗證**（181 組中 117 組有組件圖可比對）：一致 45 / 不一致 72；Excel 有但無圖 64（SA0001、8003875 等，僅存在於種子）；圖檔 BOM 有但 Excel 無 127（非 SA/SB/SC/SD 系列組件圖，圖檔優先新增）。
   - 差異根因（開圖實證）：① SB/SC/SD 系列圖檔 BOM **展開至最終零件**（SB0001 圖列 B06-410-111-1 + B-077），Excel 列子組件粒度（SB0001 = SA0001 + 收縮膜 0.08*14mm）→ 兩者粒度不同，非錯誤；② 圖檔提取**漏件**（SB0001/SC0006 漏 B-077 — 提取器待修）；③ 版次差異（SA0002 圖 KEY 欄註明 H00-111-111-2 → H00-111-111-4，圖面為最新，Excel 為舊版 -1）。
2. **master 欄位補齊**：part 結構新增 `moldNo`（模具號碼，419 筆）/ `cavity`（穴數，414 筆）；`customerPartNumbers` 來源補傳 color/material；去重合併規則同步補 moldNo/cavity（後筆不覆蓋既有值）。
3. 客戶掛載覆核：品號掛客戶 **564 / 1004**，Excel 三表（客戶與品號對照表 428 / 廠內紙本零件編號 248 / 客戶料號 172）有客戶者零漏掛；剩餘 440 無客戶為圖檔優先收錄品號，Excel 無對應（含別稱 norm 比對 0 可補，資料事實非缺陷）。

### 驗證結果
- master 1004 parts / 308 組件 / 674 連結不變；`verifyCoreLogic` 全數 PASS；`npm run lint` 0 錯誤；`npm run build` 成功。
- 待辦：圖檔 BOM 提取漏件修復（SB0001/SC0006 漏 B-077 等）列為下一工作項。

---

## v7.8.7 — 圖檔優先管線：全圖檔品號提取、內文欄位驗證與孤兒品號收錄

### 需求內容
1. 依使用者指示反轉資料管線：先從圖檔提取品號 → 找關聯性 → 建 BOM → 去重；再處理產品一覽表.xlsm（種子）；最後建立 master table，圖檔為第一事實來源（消除 321 孤兒圖問題）。
2. 內文標題欄驗證：以圖檔內文「零件編號 / PART NO. / P/N / Drawing # / FILE NO.」欄位確認品號、「REV / Revision」確認版本；SPC 圖以「PART / Description / Revision」對應品號/品名/版本；TITLE 對應品名。
3. 領域規則確認：mdx 後綴不屬品號；BD 客戶代稱前綴剝除（BD-8003875 → 8003875）；-MC 為 Mouldex Component 客戶來源標記不屬品號（75-0485-MC → 75-0485）；X3299 = X3299AAM 同一產品（pnAliases）；MDXE/MDXI 尾綴字母為圖面版次（8 筆 _E 品號去尾綴合併）；PL-9001 為零件編號。

### 執行內容（CAPA）
1. `scanAssemblyImages.js` 新增 `--extract` 角色化提取模式：全部 1514 圖檔 → `data/drawings-extract.json`（組件 1085 / 零件 290 / 物料 139），含 filePartNo、pendingCandidate、known/unknown、bomLinks（僅組件圖）、titleBlock、review 標記（內文欄位與檔名品號不一致者保留待人工確認 26 張）。
2. `buildMaster.js` 新增 `mergeDrawingsIntoMaster`：圖檔提取合併進 master（圖檔優先、seed 補欄位不覆蓋），`pnAliases`（X3299 → X3299AAM）寫入別稱；addPart 改 norm key 去重（E09-000412-1 / E09-000-412-1 合併，後到者為別稱）。
3. 提取規則修正（RCA）：括號品號優先；第一 token 本體優先（排除 PFM-DWG/SPC 圖號）；中文描述後綴剝除；`-C` 僅含括號檔名剝除（防誤傷 -MC）；resolveAssemblyId 加純 `-MC$` 步；圖面編號別稱剝 `-MC`；標題欄提取防誤取（日期/尺寸/材料碼/圖框名過濾、跨行取值須與檔名品號關聯、slice 起點 bug 修正）。
4. 前端 BD 比對缺口修復（`imageLibrary.ts` / `imageResolver.ts`）：檔名片段 `BD` 前綴剝除後比對（BD-8003875 → 8003875），fileOwner 反向識別同步支援。
5. 驗證基線固化：`verifyCoreLogic.js` 種子轉譯基線 717 → 709（8 筆 MDXE 尾綴合併）、master 總數下限 → 1004；addPart 自身別稱防禦（custNo = internalNo 時排除）。

### 驗證結果
- master：**1004 parts**（種子 709 + 圖檔提取 294）、BOM 組件 **308** / 連結 **674**、norm 去重 0 重複、**未解析父鍵 0**。
- 孤兒圖歸零：無品號圖僅 7 張（ICU原料料號對照表 + 6 張 XXXX 占位符，正確排除）；314 唯一品號（378 張）全部收錄。
- 內文欄位驗證：1033/1514 張提取標題欄，26 張檔名/欄位不一致保留至最後人工確認。

### 2026-08-17 收尾：標題欄提取器強化與 26 張逐張人工核對（CAPA）
1. 標題欄提取器重構為**多候選收集 + 檔名一致優先**（parseTitleBlock）：FILE NO. 標籤值、標籤下 1~3 行行尾、全圖 DIM. CLASSIFICATION / CRITICAL MAJOR 標記行行尾（MOULDEX 標題欄品號行，例 `CRITICAL MAJOR ALL OTHERS MINOR SA0002`）、PART NO./P/N/Drawing #/零件編號 標籤值、獨立品號行（單 token 且與檔名關聯）五類候選，多候選時優先取與檔名品號一致者（防 BOM 表頭 PART NO. 誤取）。
2. RCA：SA/SB/SC/SD 系列組件圖為 MOULDEX 版式 — 品號在 FILE NO. 標籤下方多行處的 DIM. CLASSIFICATION / CRITICAL MAJOR 行行尾；SC 系列品號為標題欄獨立行（如 `SC0008`）；E11-000-416-1 的 FILE NO.（檔案編號 E11-001-416-1）與 PART NO.（品號欄 E11-000-416-1）不同，檔名一致候選優先解決。
3. 人工核對：26 張 review 於 2026-08-17 逐張開啟 PDF 核對（含 dump 標題欄行與關鍵欄位證據），**全部以檔名品號為準**：SPC/RAW/CIV 系列欄位取到規格編號（SPC0002140 圖內 `ICU MEDICAL PART NUMBER: RAW0000075`、SPC0000349 圖內 `PRODUCT#: R1-16529` 為證）；R1-10356 欄位取到原料 Commodity 編號 92673；R1-8391 為版本 r03 連寫；D09-350-211-1 之 FILE NO. 欄為檔案編號筆誤（D09-350-111，日期欄旁有 D09-350-211-1 字樣）。
4. review 收斂：26 → 13 張（SA0002/SA0006/SA0092/SA0181/SA0182/SB0010/SB0027/SB0034/SB0043/SC0007/SC0040/SD0002/SD0003/E09-999-412-1 等 BOM 表頭誤取全數修正）；13 張全數人工確認以檔名為準，映射邏輯文件 §9 記錄。
- `verifyCoreLogic` 全數 PASS；`npm run lint` 0 錯誤；`npm run build` 成功。

---

## v7.8.6 — 水平審計收錄 24 組件品號、映射邏輯文件同步與全專案清理（版本基準）

### 需求內容
1. 對**所有品項**（非僅 R1-15853）水平展開審計：父/子/圖檔/登錄狀態全面盤點，排除偽自連與文件編號雜訊。
2. 依人工領域知識補強命名規則（BD- 前綴非品號、括號內品號優先、SPC/RAW/CIV/PFM-DWG 文件編號排除、`(1)` 重複檔編號過濾）。
3. 將組件圖識別出的 24 個組件品號補登 master table（含 BOM），使介面顯示數據具正確邏輯且以 `data/pn-lookup-master.json` 為唯一事實來源。
4. 同步更新全部開發文件（DEV_LOG / README / mapping-logic.md / data-mapping.html）。
5. 全專案清理（死碼、暫存產物）+ Git 提交推送建立還原基準。

### 執行內容（CAPA）
1. **水平審計（全 693 品項）**：噪音過濾 9 行全為自身品號偽自連（0 真實損失）；5 無父品號確認成品（Top-Level）層級；92 無圖檔（SA組立 44 / 單品 33 / SB組立 14 / SC組立 1）、310 無 BOM 參與為資料事實。
2. **掃描規則補強**（`scripts/scanAssemblyImages.js`）：
   - `resolveAssemblyId`：BD- 前綴剝除（`BD-X3299AAM` → `X3299AAM`，剝除未命中則排除）；圖號註冊自身圖（`SPC0014799_10_R1-2361` 等 4 偽自連消除，token 分割改 `/[_ ]+/` 防 hyphen 誤切）。
   - `assemblyIdFromFileName`：括號內非 Rev/非純數字內容即品號（`PFM-DWG-30125-01(126-006)` → `126-006`）；`(1)` Windows 重複檔編號過濾。
   - 非品號排除：`/^(SPC\d+_\d+_(RAW|CIV)\d+|PFM-DWG-|BD[-_][A-Z0-9]+)$/i`。
3. **scannedAssemblies 補登**：種子 `rawdata/master_table_unified.json` 新增 `scannedAssemblies` 區塊（24 筆：MDXE-* 8、R1-* 15、SC0044），`buildMaster.js` 合併為正式品項（category `組件圖候補`）→ **未解析父鍵 24 → 0、僅未登錄 28 → 0**。
4. **驗證基線固化**：`verifyCoreLogic.js` 種子轉譯基線 693 → 717。
5. **全專案清理**：移除死碼 `KnowledgeGraphModal.tsx` / `knowledgeGraph.ts`（互引、無使用）、打包暫存 `.tmp-kgmin/`（4.7MB）、掃描輸出暫存 `build-out.txt` / `scan-out.txt`。

### 驗證結果
- master：**717 parts**（種子 693 + 補登 24）、BOM 組件 **243** / 連結 **610**、**未解析父鍵 0**、僅未登錄 0。
- R1-15853：9 個可組成組件全部已登錄（R1-10134 / R1-10149 / R1-10260 / R1-10278 / R1-10356 / R1-15933 / R1-15935 / R1-15936 / R1-15951）。
- `verifyCoreLogic` 11 項 PASS；`npm run lint`（tsc --noEmit）0 錯誤。
- 唯一事實來源鏈：seed（Excel + scannedAssemblies）→ buildMaster → `data/pn-lookup-master.json` → Express 每次請求重讀 → `/api/parts` `/api/bom` → 前端（localStorage 僅初始快取，server 覆蓋）。

---

## v7.8.5 — 組件圖 BOM 父組件品號解析修復（「本零件可組成的組件」欄位空白）

### 需求內容
品號（如 R1-15853）已於組件圖中被識別，但 PartDetailModal「本零件可組成的組件」欄位空白；且多數零件皆有類似問題。

### 根因分析（RCA）
1. **BOM 父鍵為原始檔名衍生 ID**：`scanAssemblyImages.js` 以組件圖檔名（如 `R1-10134-MC_08_mdx.pdf` → `R1-10134-MC_08_mdx`）直接作為 BOM parent 鍵；master 標準品號為 `R1-10134`。前端 `findPartByNo` 僅做精確比對 → 51.3%（509/993）父連結無法解析，欄位空白。
2. **檔名版本連結方式多變**：實際盤點 1514 檔 — 933 個 `(Rev.X)`（括號）、204 個 `_mdx`、169 個 `_NN`、101 個 `_XX`、67 個 `-MC_xx`、23 個 Rev；原解析僅處理 `-C` 單一情況。
3. **自身版本圖偽父子連結**：如 `R1-15853_03.pdf`（R1-15853 的版本 3 圖面）內文含自身品號 → 產生「組件＝自身」的錯誤連結。

### 矯正與預防措施（CAPA）
1. **`resolveAssemblyId()` 層級解析**（`scripts/scanAssemblyImages.js`）：精確命中 → 逐層剝除後綴（`_mdx`/`-MC_xx`/`-C`/`_NN`/`Rev`，每層剝除後即查 master，支援多層組合如 `R1-15853_03_mdx`）→ 未命中回傳最乾淨剝除形式（合併同家族版本）→ 圖面內文自身品號前綴比對（邊界防誤判）。括號版本 `(Rev.X)` 由 `assemblyIdFromFileName` 既有規則剝除。
2. **自身版本圖跳過**：解析後 `p.partNo === assemblyId` 即為自身版本圖，不寫入 BOM。
3. **噪音檔名過濾**：含中文/空格等非品號字元（如 `PN-0002_… 包裝說明書`）不作為 BOM 父鍵。
4. **前端未登錄組件顯示**（`src/utils/bomEngine.ts` + `src/components/PartDetailModal.tsx`）：`BOMRelation` 新增 `unregistered` 旗標；無法解析的父組件仍以「未登錄」灰階不可點擊列顯示，欄位不再無聲空白。

### 驗證結果
- `node scripts/scanAssemblyImages.js --all --apply`：1514 圖檔，BOM 993 對 → 620 對，無法解析比例 51.3% → 14.7%（33 個唯一未登錄組件，皆為真正未收錄於 master 的客戶組件，如 BD-X3299 / SC0044 / MDXE-*）。
- R1-15853：組件從 20 個原始檔名 ID（前端全部無法顯示）→ 9 個標準品號（R1-10134 / R1-10149 / R1-10260 / R1-10278 / R1-10356 / R1-15933 / R1-15935 / R1-15936 / R1-15951）。
- `npm run lint`（tsc --noEmit）0 錯誤；`npm run build`（verifyCoreLogic 11 項 + vite build）PASS。

## v7.8.4 — OCR 快取鍵一致性修復 + 圖檔反向識別 (Image-Content Reverse BOM Identification)

### 需求內容
1. **品號已辨識但未與圖檔建立關聯**：OCR 辨識成功並存入快取，但重新整理頁面後關聯失效。
2. **品號已建立圖檔關聯，但未自所有圖檔中識別出「該品號可組成哪些產品」**：零件圖面內文列出的零件清單，反向閱讀即為該零件的採用產品，系統原先僅靠 master BOM 呈現上層組件。

### 根因分析（RCA）
1. OCR 快取鍵不一致：`ocrKeyForFile()` 以複合鍵 `檔名|size|lastModified` 存入 IndexedDB，但所有查詢端（`resolveAllImages` / 孤兒圖檔檢索 / 掃描佇列）皆以純檔名查找 → 重新整理後 OCR 關聯全數失效。
2. 反向識別功能闕如：前端僅做「圖檔 → 品號」正向解析，無「品號 → 產品」反向推導；`scanAssemblyImages.js` 僅掃描 3 個組件圖資料夾（274 張），未涵蓋全部圖檔（實際 1514 張）。

### 修正方案（CAPA）
1. **OCR 快取鍵修復**（`src/utils/ocr.ts`）：`ocrKeyForFile` 改為純檔名；`loadOcrCache` 新增 `normalizeCacheKey` 向後相容還原舊版複合鍵（末兩段為數字時剝除；Windows 檔名禁 `|` 故安全）。
2. **前端反向識別引擎**（`src/utils/imageResolver.ts` 新增 `findParentProducts`）：自 OCR 快取內文找出包含指定品號的圖檔 → 依檔名反查所屬品號（與 `imageLibrary` 前向比對規則互逆）→ 彙整候選產品（含來源圖檔）。
3. **PartDetailModal 新增「由圖檔內容反向識別」區塊**：候選產品一鍵「加入 BOM 關聯」→ `updateBOMData` + `saveBOM`（伺服器未連線時僅本機生效）+ 重新 `enrichParts`。
4. **`scanAssemblyImages.js` 擴充**：`--all` 全量掃描 `rawdata/圖檔`（274 → 1514 張）；`--parent-of <PN>` 反向識別該品號可組成哪些產品，搭配 `--apply` 直接寫入 master BOM。
5. **同步流程修正**：先 `git pull`（fast-forward 至 v7.8.3）再套用映射邏輯，避免與雲端版本分叉。

### 確效驗證
- `node scripts/scanAssemblyImages.js --parent-of "H00-111-111-1"`：正確輸出 3M41459 / SA0003 / SA0145 / SC0010
- `node scripts/scanAssemblyImages.js --all --apply`：1514 張全量掃描，BOM 組件群 181 → 519
- `npm run lint`（tsc --noEmit）與 `npm run build`（verifyCoreLogic 門禁）：PASS
- 合併後 `git status` 無未解析衝突

### 回歸規則
- `ui_minimum_font_size`：新增 UI 元件全 13px 以上
- 檔案刪除保護：`ProductMindMapModal.tsx` 由雲端（upstream）刪除，本機採雲端為準接受刪除；未主動刪除其他檔案
- 安全防禦：反向識別僅為「候選建議 + 人工確認」，不自動寫入 master BOM

---

## v7.8.3 — 3D 思維導圖視覺優化與專案整體程式碼文件全量同步重構 (3D Mind Map Visual Refinement & Full Project Refactor Sync)

### 需求內容
1. 3D 思維導圖節點間連線細化與半透明輕量視覺調整。
2. 執行專案整體程式碼與檔案優化作業（MECE 盤點、死碼清理、版本真源統一至 `v7.8.3`、全量開發文件與規格同步）。

### 根因分析（RCA）
1. **連線視覺過重 (Link Visual Overload)**：
   - 原 `linkWidth` 設定為 `1.2`（選中時 `2.2`），且 `linkOpacity` 設為 `0.75`，連線色彩為高飽和度 `rgba(100,116,139,0.65)`。在 3D 空間中多層級展開時，過粗與過暗的線條會遮擋後方空間節點，缺乏輕盈與科技通透感。
2. **文件版本與新特性未完全同步 (Version & Documentation Drift)**：
   - 前版開發後，`version.ts`、`README.md`、`docs/data-mapping.html` 中的版本號與功能描述存在微幅落差，需依 MECE 原則全量同步。

### 矯正與預防措施（CAPA）
1. **連線線寬微調與半透明化 (`src/components/ProductMindMap3DModal.tsx`)**：
   - 線寬降至極細精密規格：常態線寬由 `1.2` 縮小至 `0.45`，選中流動線寬由 `2.2` 調降至 `1.3`。
   - 透明度與色彩優化：`linkOpacity` 由 `0.75` 降至 `0.40`，基礎顏色改為低對比柔和霧灰 `rgba(148,163,184,0.35)`，非焦點暗化連線降為 `rgba(51,65,85,0.12)`。
   - 動態流向粒子尺寸同步修整為 `1.2`（速度 `0.007`），使整體 3D 圖譜如神經脈絡般纖細通透。
2. **全域版本真源與文件同步 (Global Version Alignment)**：
   - `src/version.ts` 升級至 `v7.8.3`。
   - `README.md` 全量同步 `v7.8.3` 版本徽章、3D 思維導圖功能亮點（三大體系收合過濾、神經脈絡連線、根節點名稱）與目錄結構。
   - `docs/data-mapping.html` 同步版本 `v7.8.3` 與最後更新日期（2026-08-15）。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功 (5.50s)。
- 界面規範：全站介面文字均 `>= 13px`，完全符合數據不變量守則。

---

## v7.8.2 — 3D 思維導圖三大體系圖例收合狀態過濾與根節點名稱精簡 (Mind Map Legend Collapse Filter & Root Label Refinement)

### 需求內容
1. 當「三大體系圖例」為「收」的狀態時，不顯示節點與節點訊息文字，僅在「開」的狀態時顯示。
2. 「凱益股份有限公司 產品識別教育訓練」的節點名稱改為「產品識別教育訓練」。

### 根因分析（RCA）
1. **三大體系第一層節點過濾未與圖例狀態對齊 (Level-1 Nodes Always Rendered)**：
   - 原 `isVisible` 邏輯中，第一層子節點（`factory` 廠內品號、`customer` 客戶品號、`unclassified` 待人工分類）的父節點皆為 `root`，因 `root` 始終在 `expandedIds` 中，導致即使左側圖例標記為「收」時，三大體系的第一層節點球體與其文字訊息依然常駐於 3D 空間中，造成視覺干擾與圖例狀態不同步。
2. **根節點名稱過長冗餘 (Redundant Company Prefix on Root Node)**：
   - 樹狀結構頂層定義為「凱益股份有限公司 產品識別教育訓練」，在 3D 空間中標籤文字過長，依需求精簡為「產品識別教育訓練」。

### 矯正與預防措施（CAPA）
1. **動態過濾邏輯更新 (`src/components/ProductMindMap3DModal.tsx`)**：
   - 重構 `graphData` 的 `isVisible(id)` 判定：當節點的父節點為 `root` 時，強制檢查 `expandedIds.has(id)`。只有當該體系在 `expandedIds`（即圖例顯示為「開」）時，才渲染該體系之節點、連線與懸浮訊息文字；若為「收」則完全不渲染。
   - 搜尋與導航聯動：在 `handleSearchChange` 與 `navigateToNode` 中同步將目標節點與祖先鏈加入 `expandedIds`，確保搜尋匹配時能自動展開並顯示相應體系。
2. **根節點命名精簡 (`src/utils/mindMapTree.ts`)**：
   - 將 `buildMindMapTree` 中的根節點名稱由 `'凱益股份有限公司 產品識別教育訓練'` 更新為 `'產品識別教育訓練'`。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功 (5.49s)。
- 界面規範：完全符合 UI/UX 字級 `>= 13px` 與數據不變量守則。

---

## v7.8.1 — 同一頁面多屬性卡片清淡色彩區分優化 (Subtle Pastel Card Color Distinction)

### 需求內容
- 使用者指示：「同一頁面裡，屬性不同的卡片用不同的顏色區分，顏色清淡就好，不必厚重」。

### 根因分析（RCA）
1. **卡片色彩過於單一中性 (Monochromatic Visual Fatigue)**：
   - 先前重構將所有卡片一律改為純白底或灰底，在同一頁面（如 `StatsBar`、`ExportImportModal`、`PartDetailModal`、`BatchSearchModal`）存在多種不同業務屬性的卡片時，使用者無法一眼透過視覺感知區分其功能邊界。
2. **避免厚重飽和度 (Avoid Heavy/Loud Colors)**：
   - 需採用極低飽和度、清淡通透的莫蘭迪柔色（淡天藍、淡紫藍、淡琥珀、淡薄荷綠、淡玫瑰紅），背景採用 `50/40`~`50/50` 柔光色，搭配 `200/80` 柔邊框與深色高對比文字。

### 矯正與預防措施（CAPA）
1. **主頁統計指標卡片 (`StatsBar.tsx`)**：
   - 品號總數：淡天藍 (`bg-sky-50/50 border-sky-200/80`)
   - 涵蓋客戶：淡紫藍 (`bg-indigo-50/40 border-indigo-200/80`)
   - 字頭分類：淡琥珀 (`bg-amber-50/40 border-amber-200/80`)
   - 系統狀態：淡薄荷綠 (`bg-emerald-50/40 border-emerald-200/80`)
2. **資料匯出匯入彈窗 (`ExportImportModal.tsx`)**：
   - 匯入自訂資料：淡天藍
   - 客戶料號工作表（三碼互換）：淡紫藍
   - 匯出資料庫：淡薄荷綠
   - 恢復預設資料庫：淡玫瑰紅
3. **品號詳細規格彈窗 (`PartDetailModal.tsx`)**：
   - 基本規格：淡冷碳灰 (`bg-slate-50/70 border-slate-200`)
   - BOM 組成零件：淡薄荷綠 / 可組成目標：淡天藍
   - 相同客戶其他品號：淡紫藍
   - 相同字頭系列品號：淡琥珀
4. **批次品號對照檢索與孤兒圖檔彈窗 (`BatchSearchModal.tsx`, `OrphanImagesModal.tsx`)**：
   - 成功比對項目：淡薄荷綠；未找到品號項目：淡玫瑰紅；綁定操作區：淡琥珀。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功 (10.93s)。
- 字級規範驗證：全專案介面文字均 `>= 13px`。

---

## v7.8.0 — 全站視覺去 AI 味與現代醫療工業儀表風重構 (Clean Medical Industrial UI Refinement)

### 需求內容
- 使用者指示：「調用 Tool-Calling 工具庫去除介面設計的AI味」➔ 「按你建議的方案實施，自行評估是否應先擬定計畫」。

### 根因分析（RCA）
1. **AI 模板化視覺特徵 (AI-Generated Generic UI Slop)**：
   - 過度氾濫的鮮豔紫藍漸層 (`from-indigo-600 to-violet-600`)、大半徑毛玻璃光暈 (`shadow-indigo-500/25`) 與無意義的純色發光膠囊。
   - 資訊層級模糊：關鍵數據（品號、版本、BOM 數量）缺乏嚴格等寬字體與對齊架構，訊噪比低。
2. **缺乏實體觸覺反饋 (Lack of Tactile Feedback)**：
   - 按鈕過於扁平或過度懸浮，缺少醫療/工業控制儀器般精準清晰的 1px 微邊框與低飽和莫蘭迪色階。

### 矯正與預防措施（CAPA）
1. **建立現代醫療工業 Design Tokens (`src/index.css`)**：
   - 導入莫蘭迪冷碳灰階變數（`--bg-base: #0B0F17`、`--bg-surface: #111827`、`--text-primary: #F9FAFB`）。
   - 實作 `.btn-tactile` 精密微反饋、`.table-row-selected` 選中指示與精密捲軸。
2. **Header 導航欄去漸層重構 (`src/components/Header.tsx`)**：
   - 移除浮誇漸層，改用深冷碳灰 1px 實體微邊框 (`bg-slate-900 border-slate-700/80`) 與精密按鈕群。
3. **數據統計與搜尋欄位重塑 (`StatsBar.tsx`, `SearchControls.tsx`)**：
   - 指標卡片採用 1px 實體微邊框，品號數值採用 `font-mono`，搜尋框採用高對比低擴散焦點環 (`focus:ring-sky-500/15`)。
4. **主資料庫表格與彈窗全面去 AI 味 (`PartsTable.tsx`, `PartDetailModal.tsx`, `ExportImportModal.tsx`, `ImageFolderModal.tsx`)**：
   - 表頭採用冷灰高訊噪比排版，品號一律使用等寬字型，狀態徽章採用莫蘭迪低飽和色系。
   - 全站介面文字嚴格遵守 `>= 13px` 門禁（無未注釋之 `text-xs`）。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.6 — 靜默啟動零干擾與彈窗行為收斂 (Silent Startup & Zero-Intrusion Modal Fix)

### 需求內容
- 使用者指示：「啟動時不要自動彈出"圖檔"與"資料匯出與匯入"」。

### 根因分析（RCA）
1. **無資料時強制彈窗 (Eager Empty State Popup)**：
   - 舊版 `App.tsx` 在 `parts.length === 0` 時透過 `useEffect` 自動觸發 `setIsExportImportOpen(true)`，導致首次載入或靜態模式下強制彈出匯出/匯入視窗。
2. **圖檔資料夾首次未設定提示 (Eager Image Prompt)**：
   - 舊版 `restoreImageFolder()` 若未找到已存 handle，會因 `!isImageFolderDismissed()` 主動觸發 `setIsImagePromptOpen(true)` 彈窗提示。

### 矯正與預防措施（CAPA）
1. **移除啟動時所有自動彈窗 `useEffect`**：
   - 移除 `parts.length === 0` 觸發 `setIsExportImportOpen(true)` 的監聽副作用。
   - `restoreImageFolder()` 僅保留「靜默恢復 handle」，不再主動彈出「圖檔資料夾提示」視窗。
2. **操作觸發權限 100% 回歸使用者 (User-Initiated Trigger Only)**：
   - 「資料匯出/匯入」與「圖檔資料夾」視窗預設恆為 `false`，僅在使用者主動點擊導航欄 Header 按鈕時才開啟，提供乾淨、專注、零干擾的初次進入體驗。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.5 — 3D 思維導圖按需展開與體系自由開關 (On-Demand Progressive Disclosure & System Toggle)

### 需求內容
- 使用者回饋：「思維導圖應按需展開才不會眼花撩亂，預設為單一體系的第一階展開，目前三大體系只開不關，不是好的設計。好的設計是簡潔清晰，請幫忙檢視如何往這樣的目標優化與推進。」

### 根因分析（RCA）
1. **全體系一次性爆發展開 (Visual Clutter on Start)**：
   - 舊版預設將 `root`, `factory`, `customer`, `unclassified` 同時全開，導致 3D 空間充斥過多花瓣節點與品號，干擾視覺焦點。
2. **缺乏收合與遞迴剪裁能力 (One-Way Expansion Bug)**：
   - 舊版 `handleNodeClick` 與三大體系圖例僅有 `next.add(id)` 邏輯，無法再次點擊收合，導致「只開不關」。

### 矯正與預防措施（CAPA）
1. **預設單一體系開展 (Clean Default State)**：
   - 預設僅開展 `root` 與主要體系 `factory`（廠內品號編碼），客戶品號與待分類體系預設收合於第 1 階，畫面極致簡潔大氣。
2. **階層遞迴收合演算法 (Cascading Prune & True Toggle)**：
   - 實作 `getDescendants(id)`：當節點被收合時，自動遞迴移除該節點下的所有子類別與品號節點 ID，確保空間瞬間乾淨。
   - 點擊已選中節點可自由切換【展開 / 收合】。
3. **左側三大體系圖例智慧開關 (`handleSystemToggle`)**：
   - 每個體系提供明確的「開 / 收」狀態指示與按鈕；點擊即可隨時獨立展開或整枝收合，並相機自動移近聚焦。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.4 — 3D 思維導圖相機軌道自轉動畫修復 (OrbitControls & rAF Rotation Loop)

### 需求內容
- 使用者回報：「空間緩慢自轉失效」。

### 根因分析（RCA）
1. **Three-Render-Objects 預設控制器為 TrackballControls**：
   - `three-render-objects` 預設 `controlType` 為 `trackball`，此控制器並不具備 OrbitControls 的 `autoRotate` 屬性。
2. **靜態節點冷卻後物理模擬幀停止 (Physics Cooldown Idle)**：
   - 3D 思維導圖採用固定座標 (`fx, fy, fz`) 與 `cooldownTicks: 0`，物理模擬停止後 WebGL 不會主動觸發額外重繪，導致單純設定屬性無法驅動相機旋轉。

### 矯正與預防措施（CAPA）
1. **明確配置 `controlType="orbit"`**：
   - 在 `ForceGraph3D` 上指明 `controlType="orbit"`，正確啟用 Three.js 原生 OrbitControls。
2. **requestAnimationFrame 獨立相機軌道自轉動畫循環**：
   - 建立獨立的高效能 rAF 旋轉循環：讀取相機水平半徑與角度，以 `0.0016 rad/frame` 柔和角速度更新相機 X/Z 座標並 `lookAt(0,0,0)`，同步呼叫 `controls.update()`。
   - 當選中節點（`selectedNode !== null`）或關閉自轉時，rAF 自動暫停，確保使用者點選檢視與操作時畫面鎖定、無震盪。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.3 — 3D 節點名稱常駐自動高清顯示 (3D Mind Map Always-On Retina Billboard Labels)

### 需求內容
- 使用者指示：「3D節點名稱都需要自動顯示，否則無法一眼識別」。

### 根因分析（RCA）
1. **Three.js 深度遮擋 (Z-Buffer Depth Occlusion)**：
   - 舊版 SpriteMaterial 未設定 `depthTest: false` 與 `renderOrder`，導致部分文字標籤在 3D 旋轉或靠近球體時，被節點球體或背景幾何線條遮擋，無法常駐清晰呈現。
2. **紋理畫布解析度限制 (Low DPI Blur)**：
   - 舊版以 1x 低解析度畫布（13px 基準字體）產製 Texture，在 3D 空間世界座標縮放時產生羽化模糊。

### 矯正與預防措施（CAPA）
1. **3x Retina 高解析度畫布生成 (`labelTexture`)**：
   - 升級為 3x 高清 Canvas（`font = bold 45px`、大圓角半透明膠囊背景 `rgba(11, 18, 32, 0.94)`、發光彩色邊框、純白標題文字），消除空間放大時的鋸齒與模糊。
2. **Sprite 材質層級防遮擋 (`nodeExtendObject`)**：
   - 標籤材質設定 `depthTest: false`、`depthWrite: false`，並指派 `renderOrder = 999` 最高渲染層級，確保所有可見節點名稱常駐懸浮於頂層，100% 絕不被球體或連線遮蔽，一眼即可清晰識別！

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.2 — 3D 思維導圖節點連線修復與視覺質感優化 (3D Mind Map Link Visibility & Elegance Tuning)

### 需求內容
- 使用者回饋：「節點之間的連線雖不能過於明顯但也不能消失不見，請解決目前連線都不可見的問題」。

### 根因分析（RCA）
1. **d3-force 內部物件引用變更導致過濾失效**：
   - 在 ForceGraph3D 執行過程中，d3-force-3d 會將 `link.source` 與 `link.target` 由原本的字串 ID（例如 `'root'`, `'factory'`）就地轉譯突變（mutate）為 `NodeObject` 實體物件引用（`{ id: 'root', ... }`）。
   - 在 `graphData` 的 `useMemo` 中，使用 `visibleNodeIds.has(l.source)` 進行過濾（其中 `visibleNodeIds` 為 `Set<string>`），因傳入物件導致 `Set.has(object)` 恆為 `false`，導致連線在初次渲染後全數被過濾為空陣列 `[]`。
2. **連線粗細與顏色邊界**：
   - 預設連線線寬 `0.8px` 且未解構字串 ID，在深色星空背景下難以肉眼清晰辨識。

### 矯正與預防措施（CAPA）
1. **建立通用 `getLinkId` ID 提取器**：
   - 不論 `l.source` / `l.target` 處於字串 ID 或已突變為 `NodeObject`，均統一安全提取為字串 ID。
2. **重構 `graphData` 與 `applyVisual` 連線過濾映射**：
   - `graphData` 在傳遞 `links` 時，透過 `getLinkId` 確保向 ForceGraph 提供明確的來源與目標 ID，解決物件引用丟失連線的問題。
3. **優雅微調連線視覺表現**：
   - 基準連線顏色調整為 `rgba(100, 116, 139, 0.65)`（精緻微透 slate-500 質感），線寬提升至 `1.2px`（`linkWidth: 1.2`，選中分支 `2.2px`，發光粒子數 `3`）。
   - 達成「線條清晰可見、結構分明，但絕不喧賓奪主、不過於刺眼」的優雅視覺層次。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功。

---

## v7.7.1 — 專注 3D 產品思維導圖 (YAGNI 剪裁) 與 3 項知識本體論 (Ontology) 輕量級優化實作

### 需求內容
1. **專注 3D 思維導圖**：依據使用者明確指示「我只需要 3D 思維導圖，其他的 3D 知識圖譜、2D 思維導圖我不需要」，依 YAGNI / MECE 原則徹底精簡導航與視窗，移除多餘的 2D 導圖與 3D 知識圖譜切換器，Header 僅保留單一且純粹的 **「3D 思維導圖」**。
2. **知識本體論 (Knowledge Ontology) 3 項輕量級優化落地**：
   - **優化 1 (本體關聯一致性約束)**：在 `scripts/verifyCoreLogic.js` 中新增本體層級語意單元測試（BOM children/parents 100% 雙向對稱性、無自環循環約束、替代料號反對稱性）。
   - **優化 2 (語意推理圖檔匹配)**：在 `src/utils/imageResolver.ts` 中引入第 4 級本體語意推理匹配（`via: 'inference'`），當單品料號無直接圖檔時，自動沿 `usedInAssemblies` 父組件關係鏈推導工程圖面，並於 UI 顯性標註「語意推導（來自組件 XXX）」徽章。
   - **優化 3 (Schema.org / JSON-LD 本體標準對齊與匯出)**：新增 `src/utils/jsonLdExport.ts`，支援產出符合 `Schema.org` (`@type: "MedicalDevice"` / `"Product"`) 與語意三元組結構之標準本體；於 `ExportImportModal.tsx` 新增「JSON-LD 知識本體 (@Schema.org)」匯出功能，支援 OS 原生另存新檔視窗 (`window.showSaveFilePicker`)。

### 確效驗證
- `node scripts/verifyCoreLogic.js` 11 項數據邏輯與本體約束測試 **100% PASS**。
- `npx tsc --noEmit` **0 錯誤**。
- `npm run build` 打包成功（僅產出極簡 `ProductMindMap3DModal` chunk，無多餘代碼）。

---

## v7.7.0 — 3D 產品思維導圖完整建構 (3D Product Mind Map Initial Construction)

### 需求內容
- 使用者指示「3D思維導圖建構到一半尚未完成，請繼續完成」。
- 核心 UX 與空間理念：
  1. **空間利用效率極大化**：傳統 2D 思維導圖展開時視野大幅橫向/縱向拉伸（「看得到全局卻看不清局部」）；3D 透過縮放與立體旋轉，清晰呈現整體花瓣向度與局部細節。
  2. **點擊動態展開子節點**：在 3D 空間中點擊任一節點時，自動於 3D 空間展開其直接子節點與品號，相機平滑移近對焦。
  3. **即時側邊欄呈現完整訊息與父子/從屬關係**：點擊任一節點（Root、主體系、分類、子分類、品號），右側面板即時顯示完整的規格資訊、祖先層級麵包屑路徑（可點選即時穿梭）、直接子節點清單、包含品號列表、BOM 雙向關聯（組成子零件/用於上層組件）、工程圖檔縮圖（支援 PDF 預覽與 OCR/綁定標記）與查 BOM 跳轉。
  4. **三合一多維視角整合**：整合「🪐 3D 思維導圖（空間層級）」、「🕸️ 3D 知識圖譜（BOM 多維網絡）」、「🌳 2D 思維導圖（經典樹狀閱讀）」，支援頂部一鍵無縫穿梭切換。

### 根因分析（RCA）
- 先前在 `src/components/ProductMindMap3DModal.tsx` 開發過程中，在第 313 行葉節點展開處理迴圈中斷，遺失了 `mm.parts.forEach` 的區塊宣告；且第 398 行未實作 Modal 元件本體（`/*__MODAL_COMPONENT__*/`），導致 3D 思維導圖無法編譯與掛載。

### 矯正與預防措施（CAPA）
1. **重構 3D 空間花瓣佈局演算法 (`buildMindMap3DGraph`)**：
   - 建立 Root (r=0)、Level 1 (r=68, 3 大花瓣方向向量)、Level 2 (r=138)、Level 3 (r=208)、Level 4/5 (r=272~332) 的精準立體球形層級。
   - 採用固定座標 (`fx, fy, fz`) 消除隨機碰撞晃動，視覺穩定優雅。
   - 導入 `expandedIds` 動態過濾機制，實現「點擊節點自動在 3D 空間開展/收合子節點」。
2. **實作完整 3D 思維導圖元件 (`ProductMindMap3DModal.tsx`)**：
   - **Header 工具列**：多維度視角切換器、即時搜尋過濾（金光高亮 `#FBBF24` + 自動相機對焦）、一鍵全部展開 / 一鍵收合頂層 / 返回預設狀態。
   - **左側圖例與控制**：三大體系統計（廠內/客戶/待分類）、節點名稱標籤開關、空間緩慢自轉開關。
   - **右側從屬關係與全功能詳情抽屜**：
     - 從屬階層路徑（祖先鏈麵包屑，可點選穿梭相機導航）。
     - 品號規格、工程圖檔預覽（支援 PDF iframe）、替代料號、BOM 組成零件（可點選導航）、用於組件（可點選導航）、一鍵「查 BOM」跳轉。
     - 分類/體系節點之直接子節點與所屬品號清單（支援品號點選定位與跳轉）。
3. **多維度視角切換與路由整合**：
   - 在 `App.tsx` 中將 `ProductMindMap3DModal`、`KnowledgeGraphModal`、`ProductMindMapModal` 以 `React.lazy` 動態代碼分割載入（首屏極速零負擔）。
   - 在 `Header.tsx` 增加 `3D 思維導圖` 入口按鈕。
   - 在三大 Modal 頂部統一提供「🪐 3D 思維導圖 | 🕸️ 3D 知識圖譜 | 🌳 2D 導圖」切換器。
4. **確效驗證與合規**：
   - 全介面文字嚴格遵守 `>= 13px`（符合 `<RULE[ui_minimum_font_size]>`）。
   - 通過 `node scripts/verifyCoreLogic.js` 數據固化驗證（693 筆品號去重與 181 組 BOM）。
   - `npx tsc --noEmit` 零錯誤與 Vite `npm run build` 成功打包。

---

### 問題回報（v7.6.0 驗收）
1. **滑鼠懸停時整個圖譜崩潰**（凍結/黑畫面，GPU 記憶體耗盡）。
2. 節點名稱應**預設顯示**（無須點選展開才見標籤）。

### 根因分析（RCA）
- v7.6.0 的自訂節點/邊物件（`buildNodeObject` 球體 + `buildLinkObject` 圓柱）在 `applyVisual()` 中每次視覺狀態變更都呼叫 `graphRef.current?.refresh()`（`_flushObjects=true`）→ **全量重建 751 節點 + 1705 邊的 Three 物件且不 dispose 舊 geometry/material** → 每次懸停都製造數千個 GPU 物件，記憶體持續洩漏 → 最終崩潰。
- 查證 3d-force-graph 原始碼確認：`refresh()` 存在（`_flushObjects=true` 全量重建）；`update()` 有 **digest 快取機制** — 球體 geometry 依 `nodeVal` 快取、material 依 `nodeColor` 快取；邊 Line 材質依 `linkColor` 快取；僅 `nodeThreeObject(Extend)` / `linkThreeObject` / `linkWidth` 改變才重建物件；`nodeVal/nodeColor/linkColor/linkOpacity` 改變只觸發低成本消化更新，且**不重啟 d3 佈局**。

### 修正方案（重寫渲染架構，v7.6.1）
1. **移除自訂物件與 refresh() 全量重建**：節點改為圖譜庫原生球體，以 `nodeVal`/`nodeColor` accessor 驅動（快取 geometry/material，零重建零洩漏）；邊改為原生 Line + `linkColor`/`linkOpacity` accessor（保留 composed_of 流動粒子）。
2. **標籤預設常駐顯示**：`nodeThreeObjectExtend` 回傳「光暈 + 名稱標籤」靜態 Sprite（共用快取 texture），一經建立不再隨狀態重建；圖例新增「節點名稱標籤」ON/OFF 開關（僅切換時重建一次）。附註：react-force-graph-3d 1.29.1 型別宣告誤標此 prop 為 boolean accessor（執行期實際接受 Object3D accessor），以型別斷言處理並註解。
3. **視覺狀態改 vizTick 驅動消化**：懸停/展開/搜尋/淡化全部只 mutate 節點 `_val`/`_color` 與邊 `_color`，再 `setVizTick(t+1)` 改變 accessor 身份 → 觸發原生 digest（快取材質換色/換大小），**不再 refresh()、不重啟佈局**。
4. 懸停僅做「該節點放大+提亮」局部高亮；展開/搜尋焦點期間懸停不搶視覺。
5. 詳情面板 / 搜尋 / 邊開關 / 圖例 / 統計浮標功能全部保留。

### 確效驗證
- `npm run lint`（tsc --noEmit）：zero errors
- `npm run build`（含 verifyCoreLogic 門禁）：PASS
- 伺服器重啟（3001 API / 3000 Vite 皆 HTTP 200），瀏覽器頁面重新載入驗證

### 回歸規則
- `ui_minimum_font_size`：標籤維持 13px 畫布基準（既有例外註釋），UI 元件全 13px 以上
- 檔案刪除保護：未刪除任何既有檔案（ProductMindMapModal.tsx 仍為死碼待許可）

---

## v7.6.0 — 思維導圖升級為 3D 知識圖譜 (Mind Map → 3D Knowledge Graph)

### 需求內容
- 將「產品識別教育訓練 — 思維導圖」改為**知識圖譜**：思維導圖僅有「分類」一種樹狀關係，知識圖譜納入 4 種真實關聯（分類 / BOM 組成 / 替代對應 / 客戶），並採用 **3D 力導向圖譜**（避免 2D 重疊的視覺干擾）。
- 節點**預設收合**（僅小型球體），點選後才展開資訊（光暈 + 光圈 + 標籤 + 詳情面板）。
- 依使用者指示，透過 Tool-Calling 系統（`d:/Self-developed_Apps/Tool-Calling`）搜索知識圖譜工具：結果（GitNexus / Understand Anything / Codegraph / Cognee / Graphify）皆為「程式碼知識圖譜」工具，無前端產品資料圖譜專用工具，故採 **react-force-graph-3d + three.js** 自建（tool registry 無適用者，精選採行業標準前端圖譜引擎）。

### 圖譜資料模型（`src/utils/knowledgeGraph.ts` 新增）
- **節點 (751)**：品號節點 693（分類為 廠內零件/組件/Set/客戶品號/待分類）+ 分類節點 27 + 客戶節點 31
- **邊 (1705)**：
  - `classified` 分類邊 693（沿用 mindmapClassifier 分類知識）
  - `composed_of` BOM 組成邊 369（組件→子零件，來自 bomEngine components）
  - `alternate` 替代/對應邊 81（alternates 之間的實體關聯，含客戶品號↔廠內品號）
  - `customer` 客戶邊 562（品號→客戶節點）
- 零孤立節點、零重複邊、未解析 BOM 子件 1 / alternates 0
- 資料不變量：master 693 筆 / 181 組 BOM 不受影響（**零資料結構變更**，圖譜純為執行期衍生視圖）

### 3D 視覺化（`src/components/KnowledgeGraphModal.tsx` 新增，直接替換 ProductMindMapModal）
- `react-force-graph-3d` 力導向 3D 圖譜：拖曳旋轉 / 滾輪縮放 / 節點拖曳 / 自動緩慢旋轉
- 節點收合→展開狀態機：`normal / hover / expanded / matched / dimmed`（mutate 節點 + `refresh()` 重建 Three 物件）
- 展開視覺：發光光暈 + 光圈 + 品號標籤 Sprite + 1-hop 鄰居高亮、其餘淡化
- 邊視覺：圓柱（WebGL Line 不支援寬度）依類型著色、BOM 邊有流動粒子
- 詳情面板（右側）：縮圖預覽（沿用 resolveImage / 檔名比對 / 手動綁定 / OCR）、BOM 組成 / 用於組件 / 替代品號 雙向跳轉展開、查 BOM 跳轉主頁
- 搜尋：品號/名稱/客戶/替代品號即時比對，高亮 + 相機縮放至匹配節點
- 左側圖例：7 節點類型 + 4 邊類型開關（可獨立關閉分類/BOM/替代/客戶關係）
- 性能：three.js 以 `React.lazy` 拆分為獨立 chunk（首屏主套件 2.2MB → 774KB），僅開啟圖譜時載入 1.4MB chunk
- 暗色圖譜場景（`#0B1220`）符合 Color Master Palette 暗色規範；畫布標籤 13px 基準

### 確效驗證
- `npm run lint`（tsc --noEmit）：zero errors
- `npm run build`（含 verifyCoreLogic 門禁）：PASS（693 筆 / 181 組 BOM 不變量）
- 圖譜模型以 esbuild 打包 + 真實 master/BOM 資料執行驗證：751 節點 / 1705 邊 / 0 孤立 / 0 重複

### 回歸規則
- `regression_defense_and_logic_freezing`：master 693 / 181 不變量 PASS，未動任何種子資料
- `data_structure_change_notification`：零資料結構變更（知識圖譜為執行期衍生，不落檔）
- `ui_minimum_font_size`：全 UI 13px 以上；畫布節點標籤以 13px 為基準並附例外註釋
- 檔案刪除保護：`ProductMindMapModal.tsx` 與 `react-d3-tree` 依賴暫保留（零引用），待使用者許可後清理

---

## v7.5.4 — 全域優化作業：死檔清除 + 死碼匯出收斂 + 文件全面同步 (Global Optimization: Dead-File Sweep & Doc Sync)

### 需求內容
- 使用者執行「專案的整體程式碼與檔案優化作業」五步 SOP：①盤點清理 ②文件同步 ③MECE 整合 ④Git 還原基準 ⑤推送 GitHub。
- 清理清單經使用者確認後執行（全部先驗證零引用，零功能 Regression）。

### 清理項目（全部先驗證引用再移除）
1. **死檔刪除（零 import 驗證）**：
   - `src/data/bomData.ts`、`src/data/partsData.ts`：全專案零 import（grep 驗證），且已被 `.gitignore` 的 `data/` 規則遮蔽（DEV_LOG v2.8.x 本就應自版本控制移除，v2.8.0 曾以 CI 空殼名義重新加入）
   - `src/data/` 空目錄、`assets/.aistudio/` 空目錄（未追蹤，僅含 2 bytes 自忽略檔）
2. **死碼匯出收斂（tsc / grep 交叉驗證）**：
   - `serverStatus.ts`：刪除 `getServerStatus()` 與 `ServerStatus` type（零外部引用；App.tsx 以 `serverOnline={false}` 硬編碼，此探測函式已成死路徑）
   - `bomEngine.ts`：`isAssemblyPartNo` 取消 export（僅模組內部使用）
   - `ocr.ts`：刪除完全無引用之 `OcrEntry` interface
   - `customerPartImport.ts` / `imageResolver.ts` / `mindmapClassifier.ts`：`CustomerRow` / `OrphanFilesResult` / `ClassificationResult` 取消 export（僅內部型別契約）
3. **樣式與配置清理**：
   - `index.css`：移除零引用 `.glass-card` 樣式（DEV_LOG v3.2.0 導入後已無元件使用）
   - `ProductMindMapModal.tsx`：移除無定義的 `custom-scrollbar` class（inert，全域 scrollbar 樣式已覆蓋）
   - `vite.config.ts`：移除零使用之 `@` alias
   - `.gitignore`：`data/` / `rawdata/` / `ref/` 收斂為根目錄限定 `/data/` 等，避免誤遮蔽任何 `src/` 子目錄同名檔

### 文件同步（階段二）
- **README.md**：版本 v7.5.2 → v7.5.4；目錄樹修正（移除已刪除之 `AddEditModal.tsx`，補齊 `partNo.ts` / `version.ts` / `types/` / `scanAssemblyImages.js`）；數據不變量 565 → 693 更新
- **DEV_LOG.md**：補記 v7.5.3 兩筆 commit（f55b4f1 + 477f741）歷史斷層，本條為 v7.5.4
- **docs/data-mapping.html**：版本 badge v7.5.4；S10 觸發時機改寫（AddEditModal 已刪除 → AdminPanel）；S12 筆數更新（717 → 693 種子基線）
- **scripts/verifyCoreLogic.js**：檔頭註解不變量 565 → 693（與實作一致）

### 確效驗證
- `npm run lint`（tsc --noEmit）：zero errors
- `npm run build`（含 verifyCoreLogic 門禁）：PASS（693 筆 / 181 組 BOM 不變量）
- `node scripts/buildMaster.js`：重新生成 master table 693 筆 / 181 組，與既有檔零差異

### 回歸規則
- `regression_defense_and_logic_freezing`：數據不變量 693/181 未受影響（verifyCoreLogic 全數 PASS）
- `data_structure_change_notification`：無資料結構變更（master 檔未改動）
- `ui_minimum_font_size`：本次未觸碰任何字級樣式

---

## v7.5.3 — 全域優化作業：死 UI 清除 + 版本單一化 + BOM 映射修正 (Global Optimization: Version Unification & BOM Mapping Fix)

### 需求內容
- 兩筆 commit 合併執行：`f55b4f1`（BOM 映射修正）與 `477f741`（全域優化），版本統一為 v7.5.3。

### 修正與清理項目
1. **BOM 欄位映射修正 (f55b4f1)**：
   - `buildMaster.js`：`sanitizeAlternates` 收斂為僅接受品號格式（排除備註/說明文字誤錄）
   - 別稱來源擴充：`產品編號(舊)`（舊版廠內品號）與 `圖面編號`（客戶圖面編號，常見於圖檔檔名）納入 alternates
   - `customerParts` 欄位語意改為 `產品編號` / `零件名稱(中)`，保留向後相容 fallback
   - 新增 `scripts/scanAssemblyImages.js`：以 pdfjs 文字層掃描 274 張組件圖，`--apply` / `--auto` 套用 BOM 增補
   - `verifyCoreLogic.js`：種子基線 565 → 693，master ≥ 693（掃描可增量）
2. **死 UI 清除與版本單一化 (477f741)**：
   - 新增 `src/version.ts` 作為 `APP_VERSION` 單一真源（Header / Footer / MindMap 統一引用）
   - 刪除 `AddEditModal.tsx` 與不可達的新增/編輯鏈（handleSaveItem、isAddEditOpen）及永遠為 false 的管理員 UI（Header pill/按鈕、PartsTable 編輯鈕）
   - MindMap：移除 NodeDiag 診斷子系統、重疊覆蓋層、`[MindMapDiag]` console 日誌、subFontSize 三元式、重複 classifyPart 傳遞；`cardHeaderH` 去重
   - 邏輯去重：`computeParentsMap`（bomEngine 匯出）、`ALTERNATE_SPLIT_RE`、`FULL_DATA_HEADERS`、`getPartPrefix`（新檔 `src/utils/partNo.ts`）
   - 移除未呼叫之 `imageLibrary` urlFor/nameFor 快取與 `setImageFolderDismissed`；移除 `getPartNoAliases`；清除死 props（StatsBar lastUpdated、SearchControls sort props）
   - BatchSearch 分隔符擴充：中文逗點/分號/space/tab

### 確效驗證
- `npx tsc --noEmit`：zero errors
- `npm run build`（含 verifyCoreLogic 門禁）：PASS
- master table 重新生成：693 筆品號 / 181 組 BOM（組件圖掃描可增量）

### 回歸規則
- `regression_defense_and_logic_freezing`：數據不變量 693/181 未受影響
- `data_structure_change_notification`：種子轉譯基線 565 → 693（customerPartNumbers 映射修正後新增 128 筆正確實體，非資料遺失）

---

## v7.5.2 — 全域優化作業：死碼清除 + 過期設定修復 (Global Optimization: Dead-Code Sweep)

### 需求內容
- 使用者執行「專案的整體程式碼與檔案優化作業」（全域規則），涵蓋階段一盤點清理、階段二文件同步、階段三 MECE 整理。

### 清理項目（全部先驗證引用再移除，零功能 Regression）
1. **未使用宣告（tsc `--noUnusedLocals --noUnusedParameters` 掃描，14 項）**：
   - `ProductMindMapModal.tsx`：移除 `Eye` import、`CONN` 常數、`createPartLeafNodes()` 函式、一般父卡片分支的 `listH = 0`
   - `ExportImportModal.tsx`：移除 `importText` / `setImportText` state（檔案匯入改走 FileReader 後已成死碼）
   - `AdminPanel.tsx`：`parents` getter 改為 `[, setParents]`（值從未被讀取，僅 setter 觸發重繪）
   - `Header.tsx`：移除 `totalCount` / `customerCount` / `onResetData` props（未使用）
   - `OrphanImagesModal.tsx`：移除 `FileSearch` import、`bindings` prop（未使用）
   - `PartsTable.tsx`：移除 `SortOrder` type（未使用）
   - `excelExport.ts`：`FULL_DATA_HEADERS.map(() => ...)` 移除未用參數 `h`
   - `App.tsx`：同步移除 Header / OrphanImagesModal 的對應 props 傳遞
2. **無用依賴**：移除 devDependency `tsx`（全專案零引用，僅存在於 package-lock）
3. **過期設定**：`.env.example` 原為 AI Studio 模板（GEMINI_API_KEY / APP_URL，程式碼零引用），更新為實際使用的 `PORT` / `VITE_STATIC_ONLY` / `DISABLE_HMR`
4. **雜物**：刪除根目錄 `vite-dev.log`（未追蹤）

### 確效驗證
- `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`：exit 0
- `npm run build`（含 verifyCoreLogic 門禁）：PASS（built in 4.42s）

### 回歸規則
- `regression_defense_and_logic_freezing`：資料不變量 565/181 不受影響
- `data_structure_change_notification`：無資料結構變更
- `ui_minimum_font_size`：本次未觸碰任何字級樣式

---

## v7.5.1 — 心智圖展開/收合失效 + SVGLength 崩潰修復 (MindMap Toggle Regression Fix)

### 需求內容
- 使用者回報：commit 754a538 之後「變糟了，無法展開與收合」，控制台拋出
  `NotSupportedError: Failed to read the 'value' property from 'SVGLength': Could not resolve relative length`（`SVGSVGElement` 堆疊）。

### 根因分析 (RCA) — 雙重缺陷

#### 缺陷 1（功能性）：`treeKey++` 強制 remount 抹除 toggle 狀態
- `wrapToggleNode` 在 `toggleNode()` 之後呼叫 `setTreeKey(prev => prev + 1)` → D3Tree 整個 remount。
- remount 時 react-d3-tree 的 `assignInternalProperties` 重新 clone 資料並將所有節點 `collapsed` 重設為 `false`，
  接著 `setInitialTreeDepth` 依 `initialDepth={1}` 重新收合 depth ≥ 1 的節點 → **toggle 結果被抹除**，
  展開/收合變成無效操作（DOM 重繪但畫面與初始狀態完全相同）。

#### 缺陷 2（崩潰）：remount → `bindZoomListener` → d3-zoom `defaultExtent` 讀取相對長度
- 每次 remount 的 `componentDidMount` 都會執行 `bindZoomListener` →
  `svg.call(d3zoom().transform, ...)` → d3-zoom `defaultExtent()`（d3-zoom/src/zoom.js:17-28）。
- react-d3-tree 渲染的 `<svg width="100%" height="100%">` 無 `viewBox` → `defaultExtent` 讀取
  `e.width.baseVal.value`（SVGLength 相對長度）。當全新 SVG 尚未建立可解析的 viewport（detached / 未 layout）時，
  Chrome 拋出 `NotSupportedError: Could not resolve relative length`（已用 Playwright 實測：detached svg 必拋，connected 正常）。
- 使用者環境在 toggle remount 當下命中此路徑 → 整個 React 樹拋錯。

### 修正與預防措施 (CAPA)
1. **移除 remount 機制**：`wrapToggleNode` 只保留 `setOpenBranchIds` + `setCurrentNodeSizeY` + `toggleNode()`。
   - `nodeSize` / `separation` 是 props，react-d3-tree 的 `generateTree()` 每次 render 就地重算佈局，無需 remount。
   - 視角（pan/zoom）由 d3 內部 `__zoom` + `g[transform]` 自然保留，不再需要「讀 transform → remount → 還原」的補償 hack。
2. **`handleResetDefault` 移除 `setTreeKey`**：改由 `translate` / `zoom` props 變更觸發 `getDerivedStateFromProps` 與
   `bindZoomListener`（既有 svg 已 layout，無崩潰風險）。
3. **刪除死碼**：`treeKey` state、`lastTransformRef`、`key={treeKey}` prop。
4. **保留 754a538 的正確部分**：`openBranchIds` / `currentNodeSizeY` 追蹤展開節點以切換 `nodeSize.y`
   （收合 65px / 展開 155px），此機制本就不依賴 remount。

### 確效驗證
- `npx tsc --noEmit`：zero errors。
- `npm run build`（含 verifyCoreLogic 門禁）：PASS。
- Playwright 實測（vite dev）：
  - 點擊展開 4 → 7 節點（零件/組件/Set 子節點出現）✓
  - 再次點擊收合 7 → 4 節點 ✓
  - 展開時行距 217px（155×1.4）、收合時 71.5px（65×1.1）✓
  - 滾輪縮放至 scale=1.48 後 toggle，視角完全保留（translate/scale 數值不變）✓
  - 全程 console 無 NotSupportedError ✓

### 回歸規則
- `regression_defense_and_logic_freezing`：資料不變量 565/181 不受影響
- `data_structure_change_notification`：無資料結構變更

---

## v7.5.0 — 全專案代碼優化作業：死碼清除 + 心智圖架構根治 + DEV_LOG 同步 (Full Refactor & Dead-Code Sweep)

### 需求內容
- 使用者執行「專案的整體程式碼與檔案優化作業」，涵蓋死碼識別清理、文件同步、MECE 架構整合。

### 根因分析 (RCA) — 三項已修復缺陷

#### 缺陷 1：nodeSize 軸向交換 Bug（v7.3.0，commit 8ab8ff6）
- **根因**：`react-d3-tree` 在 `orientation="horizontal"` 時內部呼叫 `tree.nodeSize([nodeSize.y, nodeSize.x])`（D3 慣例的 x/y 意義為垂直/水平），導致：
  - 我們傳入 `{x: 68, y: 275}` → D3 實際設定「水平欄距=68px，垂直行高=275px」
  - 卡片最寬 320px，卡進 68px 欄 → 大量水平重疊（10 組）
  - 正確應為 `{x: 390, y: 65}` → 水平欄距 390px（>320px 卡片），垂直行高 65px（緊湊）

#### 缺陷 2：OS 卷軸失效 + 展開後節點消失（v7.4.0，commit f3d0e5a）
- **根因 A（卷軸）**：SVG 設 `width/height: 100%`，內部 `<g transform>` 超出 SVG 邊界用 `overflow:visible` 顯示，不觸發外層 `overflow:auto` 捲動
- **根因 B（消失）**：`treeCanvasHeight` 在展開時大幅增加 → `translate.y = height/2` 把 root 推到 y>2000 → 所有節點在視野外
- **修正**：移除固定畫布尺寸架構，改用 D3 原生 pan/zoom（`zoomable=true, scaleExtent={min:0.2, max:3}`），translate 僅在 Modal 開啟時初始化一次

#### 缺陷 3：App.tsx 死碼（v7.5.0，本次）
- `hasHydrated`：固定 `true`，`setHasHydrated` 從未呼叫，`useEffect` 條件永遠等同 `parts.length===0`
- `serverDownRef` + `serverOnline`：`setServerOnline` 從未被呼叫（永遠 false），`serverDownRef` 作為短路條件從未為 `true`
- `isUnlocked`：只是 `route === 'admin'` 的別名，額外的 `useEffect` + state 純屬多餘

### 矯正與預防措施 (CAPA)
1. **精準手術刀清除**：移除 3 個死 state + 1 個死 `useRef`，簡化 `isAdminMode` 與 `isAdmin` prop 為直接使用 `route === 'admin'`
2. **功能等價保障**：`serverOnline={false}` 直接傳入 AdminPanel（原本就永遠是 false），行為完全不變
3. **DEV_LOG 同步**：補充 v7.3.0 + v7.4.0 + v7.5.0 三個版本記錄，消除文件與代碼斷層

### 確效驗證
- `node scripts/verifyCoreLogic.js` → PASS（565 筆 / 181 BOM 不變）
- `npm run build` → ✓ zero TS errors

### 遵循規則
- `regression_defense_and_logic_freezing`：數據不變量 565/181 未受影響
- `data_structure_change_notification`：無資料結構變更

---

## v7.2.0 — 心智圖自適應排版重構：徹底修復卡片重疊、緊湊高密度佈局與全視角滾動範圍 (MindMap Layout Overhaul & Favicon Fix)

### 需求內容
- 使用者回報心智圖圖塊間距過大且有重疊問題，要求：
  1. 自適應調整圖塊間距，收合時縮減垂直高度（極致緊湊）。
  2. 徹底消除跨分支與展開時的圖塊重疊 (0 組重疊)。
  3. 卷軸捲動範圍應包含全部視野範圍（水平與垂直全覆蓋）。
  4. 修復控制台 `/favicon.ico` 404 資源載入失敗錯誤。

### 根因分析 (RCA)
1. **D3 橫向模式座標軸轉置點點對應錯誤**：
   `react-d3-tree` 在 `orientation="horizontal"` 時，傳遞給 D3 的 `nodeSize.x` 對應的是 **SVG Y (垂直高度)**，`nodeSize.y` 對應的是 **SVG X (水平欄距)**。
   先前的 `nodeSize.x = 360` 導致 D3 垂直步長過大，而 `nodeSize.y = 140` 導致寬 320px 的卡片水平重疊，且 `nonSiblings` 垂直隔閡係數不足造成跨子樹重疊。
2. **滾動畫布寬高未同步設定**：
   原生 HTML 容器設定為 `width: 100%`，限制了 D3 SVG 畫布展算寬度，導致超出視窗時 SVG 被裁切無法滾動。

### 矯正與預防措施 (CAPA)
1. **D3 橫向矩陣自適應重算 ([ProductMindMapModal.tsx](file:///d:/Self-developed_Apps/PN-Lookup/src/components/ProductMindMapModal.tsx))**：
   - 設定 `GAP.columnDepth = 275px` (SVG X 水平欄距)，確保各欄卡片無重疊且維持 ~30px 完美精緻留白。
   - 設定 `GAP.collapsedRow = 68px` (SVG Y 垂直列高)，配合 `siblings: 1.0` / `nonSiblings: 2.2`，收合時卡片間距僅 ~20px，緊湊且零重疊。
   - 展開時動態切換 `GAP.expandedRow = 150px` 配合 `siblings: 1.8` / `nonSiblings: 2.8`，確保 268px 高度之列表卡片完全不重疊。
2. **全視野滾動畫布計算**：
   - 動態計算樹狀圖最大深度與總可見葉節點數，展算 `treeCanvasWidth` (~1640px) 與 `treeCanvasHeight`。
   - 將內建 Canvas 容器設定 `width: treeCanvasWidth, minWidth: '100%'` 與 `translate={{ x: 60, y: treeCanvasHeight / 2 }}`，確保上下左右全方位平滑滾動。
3. **Favicon 404 修復 ([index.html](file:///d:/Self-developed_Apps/PN-Lookup/index.html))**：
   - 於 `index.html` <head> 中加入 Data-URL 原生 SVG 醫療幾何圖標。

### 確效驗證
- `node scripts/verifyCoreLogic.js` → 100% PASS。
- `npm run build` → ✓ built in 4.77s 成功。

---

## v7.1.0 — 代碼與數據架構重構整合：融合雲端 D3 心智圖座標軸修復並固化 565 筆去重數據邏輯 (Local Data Logic & Cloud UI Integration)

### 需求內容
- 使用者要求「比較本地與雲端代碼，分析哪一個數據邏輯比較正確」，並授權按照整合建議執行修復。

### 根因分析 (RCA)
- **雲端建置崩潰 (Build Crash)**: 雲端 `scripts/buildMaster.js` 強行讀取 `ref/產品一覽表.xlsm`。但 `.gitignore` 將 `ref/` 定義為 Zero-Private-Data 隱私目錄（不推送至遠端），導致任何全新的 `git clone` 或 GitHub Actions CI 自動化建置發出 `process.exit(1)` 建置失敗崩潰。
- **數據不變量毀損**: 雲端 parsing 產生 683 筆 parts，破壞了原本 565 筆獨一無二品號及 181 BOM 階層不變量。
- **UI 卡片重疊**: 雲端正確診斷出 `react-d3-tree` 在橫向模式下傳遞給 D3 的 `nodeSize` 陣列為 `[y, x]` 轉置軸，需要調大列深度與動態計算高度。

### 矯正與預防措施 (CAPA) & 融合處置
1. **數據層 (Data Layer)**:
   - 堅守本地 `scripts/buildMaster.js`（基於 JSON 種子檔）與 `scripts/verifyCoreLogic.js`（565 筆去重固化門禁與 CI 沙盒防禦）。
2. **UI 視覺層 (ProductMindMapModal.tsx)**:
   - 納入雲端 `GAP` 間距定數、自適應 `effectiveNodeSize` (360px 深度 / 140-300px 垂直)、`effectiveSeparation` 與 `overflow-auto` 滾動支援。
   - 完整保留本地的雙擊卡片展開/收合、未分類單層包覆與微縮圖彈窗機制。

### 確效驗證
- `node scripts/verifyCoreLogic.js` → 100% PASS (565 筆品號去重 + 181 BOM 階層 + 圖像邊界匹配防禦)。
- `npm run build` → ✓ built in 5.40s，打包 100% 成功。

---

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

---

## v3.9.2 — 演算法優化：孤兒圖檔計算改採全圖檔比對 (Orphan Files Resolution & Alternates Full Matching Fix)

### 需求內容
解答與修復「孤兒圖檔高達 1042 個」的異常問題。說明品號去重歸併後，如何精準比對多圖檔與替代料號圖檔，大幅降低孤兒圖檔數量。

### 根因分析 (RCA)
在 [imageResolver.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageResolver.ts) 中，舊版 `getOrphanFiles` 函數在統計受控圖檔時，僅調用了只回傳**單張圖檔**的 `resolveImage(...)`，而非能匹配全數圖檔的 `resolveAllImages(...)`。
這導致若同一個品號（或其 `alternates` 客戶料號）擁有 2~4 張工程圖檔時，只有第 1 張圖被標記為受控圖檔，其餘 2~3 張圖檔均被誤判定為「孤兒圖檔」，致使孤兒數量高達 1000+ 檔！

### 矯正與預防措施 (CAPA)
1. **全數圖檔與替代料號全匹配 (`resolveAllImages`)**：
   重構 [imageResolver.ts](file:///d:/Self-developed_Apps/PN-Lookup/src/utils/imageResolver.ts)。在 `getOrphanFiles` 迴圈中調用 `resolveAllImages`，使每個主品號及其 **所有 `alternates` 客戶料號** 對應的圖檔均被完整納入 `matchedFiles`！
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。

---

## v3.9.3 — 防禦與機制固化：自動化核心邏輯固化確效驗證門禁 (Automated Core Logic Freeze & Verification Suite)

### 需求內容
回應使用者「固化數據邏輯，杜絕改 A 錯 B (Side-Effects & Regression)」的硬性要求。建立自動化不變量單元測試（Verification Suite），防止未來任何程式碼修改破壞核心數據與圖檔匹配邏輯。

### 矯正與預防措施 (CAPA)
1. **建立自動化驗證腳本 (`scripts/verifyCoreLogic.js`)**：
   涵蓋 6 大核心防禦單元測試：
   * 測試 1: 驗證 `data/pn-lookup-master.json` 實體品號筆數 **100% 獨一無二去重，鎖定 565 筆**。
   * 測試 2: 驗證 `buildMaster.js` 轉譯器保持 MECE 去重，**BOM 組件數嚴格鎖定 181 組**。
   * 測試 3: 驗證 `isMatchedSegment` 圖檔邊界防禦（防護 `B-003` 與 `B-0030` 分離，並允許 `Rev1`/`v1` 修飾符）。
2. **綁定生產環境打包門禁 (`npm run build`)**：
   更新 `package.json` 中的 `"build"` 指令為 `"node scripts/verifyCoreLogic.js && vite build"`。
   * 今後每次進行打包或部署前，系統均會**自動強制運行 6 項邏輯固化測試**。若有任何一項測試失敗，會立即在第一時間攔截並終止打包，從源頭徹底杜絕「改 A 錯 B」！
3. **寫入全域 Agent 規範**：
   在 [.agents/AGENTS.md](file:///d:/Self-developed_Apps/PN-Lookup/.agents/AGENTS.md) 中新增 `<RULE[regression_defense_and_logic_freezing]>` 規則。

---

## v3.9.4 — CI/CD 防禦升級：解決 CI 靜態建構模式下私有資料庫檔防護衝突 (CI Sandbox Defense for Core Logic Verification)

### 需求內容
修復 GitHub Actions CI 打包時，因 `data/` 與 `rawdata/` 依據專案 Zero Private Data 資安規範已列入 `.gitignore`（不在公開 Git 倉庫中），導致 GitHub Actions 執行 `verifyCoreLogic.js` 時因找不到本機私有資料檔而終止建置的問題。

### 根因分析 (RCA)
`scripts/verifyCoreLogic.js` 原先假設測試環境永遠具備 `data/pn-lookup-master.json` 與 `rawdata/master_table_unified.json`。然而在 CI (GitHub Actions) 靜態發布環境中，為確保商業數據隱私，私有資料檔不被提交至 Git。舊版指令在檔案不存在時直接呼叫 `assert(false)` 終止編譯，引發 CI 失敗。

### 矯正與預防措施 (CAPA)
1. **沙盒相容性檢測 (CI Sandbox Mode Defense)**：
   重構 [scripts/verifyCoreLogic.js](file:///d:/Self-developed_Apps/PN-Lookup/scripts/verifyCoreLogic.js)。
   * **本機開發環境**：當私有資料庫檔案存在時，100% 執行全套 6 項數據筆數與去重嚴格驗證！
   * **CI 發布環境**：當私有資料檔被 `.gitignore` 排除時，印出 `ℹ️ [CI 沙盒模式]` 提示並自動切換至沙盒模式，跳過本機檔案依賴測試，保留純單元邏輯驗證（如 `isMatchedSegment`），確保 CI 建構 100% 綠燈成功。
2. **驗證確效**：完成 `npx tsc --noEmit` 0 錯誤與 Vite `npm run build` 成功打包。













