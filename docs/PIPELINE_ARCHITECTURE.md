# PN-Lookup 核心管線架構文件
# Drawing-to-Master Pipeline Architecture Reference

> **版本**：v7.11.0
> **更新日期**：2026-08-31
> **文件性質**：🔒 核心資產存檔（關鍵開發知識，長期保存）
> **說明**：本文件完整記錄從原始圖面 PDF 到 `pn-lookup-master.json` 的全量資料處理管線設計、演進歷史、核心決策邏輯與防禦機制，是本專案最重要的智識資產文件。

---

## 目錄

1. [管線全貌（總覽圖）](#1-管線全貌)
2. [資料來源（Input Layer）](#2-資料來源)
3. [萃取層（Extraction Layer）](#3-萃取層)
4. [建置層（Build Layer）](#4-建置層buildmasterjs)
5. [核心合併函式一覽](#5-核心合併函式一覽)
6. [品號正規化約定](#6-品號正規化約定)
7. [五大庫別分類體系](#7-五大庫別分類體系)
8. [資料不變量與確效門禁](#8-資料不變量與確效門禁)
9. [BOM 資料結構](#9-bom-資料結構)
10. [關鍵設計決策紀錄（ADR）](#10-關鍵設計決策紀錄adr)
11. [已知限制與未修復空缺](#11-已知限制與未修復空缺)
12. [管線演進歷史](#12-管線演進歷史)
13. [圖檔串流與前端自動掛載架構 (v7.10.9)](#13-圖檔串流與前端自動掛載架構-v7109)

---

## 1. 管線全貌

```
rawdata/
├── master_table_unified.json          ← 種子資料（Excel 手工整理 → JSON）
├── Drawings/
│   ├── 零件/   (855 份 PDF)
│   ├── 組件/   (357 份 PDF)
│   ├── SET/    (113 份 PDF)
│   ├── 物料/   (199 份 PDF, 含 60 份掃描)
│   └── 原料/   (28 份 PDF, 含 2 份掃描)
└── icu-parts-raw.xlsx                 ← ICU 料號對照表（客戶端原始格式）

                    ↓ 萃取層 (Python Scripts)

data/
├── drawings_extract_v7.json           ← 零件圖: LLM + regex 雙軌萃取
├── assembly_drawings_extract.json     ← 組件圖: BOM 展開 + 結構識別
├── set_drawings_extract.json          ← SET 圖: 輸液管組件識別
├── material_drawings_extract.json     ← 物料圖: 規格萃取
├── resin_drawings_extract.json        ← 原料圖: 原料規格書萃取
├── ocr_results_141.json               ← 零件/組件: 掃描圖 OCR 結果
├── ocr_results_material_60.json       ← 物料: 掃描圖 OCR 結果
├── ocr_results_resin_2.json           ← 原料: 掃描圖 OCR 結果
├── semantic-extract.json              ← LLM 語意補強（品名/圖號/原料/BOM）
└── icu-parts.json                     ← ICU 料號對照表 (importICU.js 轉換)

                    ↓ 建置層 (buildMaster.js)

data/pn-lookup-master.json             ← SSOT 主資料庫（984 筆規範實體）
data/pn-lookup-master.xlsx             ← Excel 版主資料庫（人工查閱用）
```

**執行順序**（重新從零建置時）：

```bash
# Step 1: 轉換 ICU 料號對照表
node scripts/importICU.js

# Step 2: 萃取各庫別圖面（依序或並行）
python scripts/extract_drawings_v7.py         # 零件圖
python scripts/extract_assembly_drawings.py   # 組件圖
python scripts/extract_set_drawings.py        # SET 圖
python scripts/extract_material_drawings.py   # 物料圖
python scripts/extract_resin_drawings.py      # 原料圖

# Step 3: LLM 語意補強（選用，增強品名/原料精度）
node scripts/semanticExtract.js

# Step 4: 純掃描圖 OCR（依分類）
node scripts/batchOcr141Drawings.mjs         # 零件/組件掃描圖
node scripts/batchOcr60Materials.mjs         # 物料掃描圖
node scripts/ocr_resin_scanned.mjs           # 原料掃描圖

# Step 5: 建置 Master Table（整合所有來源）
node scripts/buildMaster.js

# Step 6: 確效驗證
node scripts/verifyCoreLogic.js
```

---

## 2. 資料來源

### 2.1 種子資料（`rawdata/master_table_unified.json`）

- **來源**：`rawdata/master_table_unified.xlsx`（工廠人工整理的品號主表）透過 `convertUnifiedSeedToMaster()` 轉換
- **規模**：693 筆原始種子 → 669 筆正規化實體（合併 MDXE 尾綴版次 8 組、互為別名 40 組；補登組件圖 24 筆；新增收縮膜 2 筆）
- **欄位**：`partNo`, `name`, `customer`, `category`, `color`, `material`, `moldNo`, `cavity`, `dwgNo`, `notes`, `alternates`
- **地位**：基礎骨架，後續所有管線只「補缺」不「覆蓋」種子有效欄位

### 2.2 工程圖面 PDF

| 庫別 | 資料夾 | PDF 總數 | 掃描圖數 | 主要特徵 |
|------|--------|---------|---------|---------|
| 零件 | `Drawings/零件/` | 855 | 141 | 多層子資料夾，ICU/廠內混合 |
| 組件 | `Drawings/組件/` | 357 | 0 | 含 BOM 表格，結構最複雜 |
| SET  | `Drawings/SET/`  | 113 | 0 | 含輸液管，MDXE/MDXI 型號 |
| 物料 | `Drawings/物料/` | 199 | 60 | 含標籤/包裝袋/說明書等 |
| 原料 | `Drawings/原料/` | 28  | 2  | 塑膠粒/色母規格書 |

### 2.3 ICU 料號對照表（`data/icu-parts.json`）

- **來源**：ICU Medical（客戶）提供的工程零件清單
- **轉換腳本**：`scripts/importICU.js`
- **用途**：補齊 ICU 料號的 `material`、`color`、`moldNo`、`cavity`、`dwgNo` 欄位；對尚未在種子中出現的 ICU 品號新增收錄

---

## 3. 萃取層

### 3.1 零件圖萃取：`extract_drawings_v7.py`（v7.0）

**策略**：雙軌萃取（快速路徑 + LLM 補強）

```
快速路徑（毫秒級）
  1. PDF 文本提取 (fitz/PyMuPDF)
  2. 檔名 regex 提取品號: A01-210-251-1(Rev.B).pdf → partNo + revision
  3. ICU Lookup: 品號命中 icu-parts.json → 補齊 material/color

LLM 路徑（快速路徑失敗時）
  4. 送 Gemini-2.0-flash 語意識別:
     提取 partNo / revision / description / materialName / color / materialCode
  5. BOM 提取: 若含 BOM 表格，另送 LLM 提取 partNo/description/material/qty
```

**輸出**：`data/drawings_extract_v7.json`（978 筆，欄位：`fileName`, `filePath`, `drawingNo`, `revision`, `partNo`, `description`, `color`, `materialName`, `materialCode`, `category`, `bom`, `source`, `method`）

**已知限制**：部分 A01/B06/C09/D09/D10 系列圖面的 `partNo` 萃取失敗（空值），由 `repairMissingDrawingLinks()` 補救。

### 3.2 組件圖萃取：`extract_assembly_drawings.py`

**策略**：BOM 表格結構識別

```
核心邏輯
  1. PDF 文本提取 (fitz) + 表格識別
  2. 識別 BOM 表頭關鍵字（PART NO., MATERIAL, QTY, DESCRIPTION）
  3. 逐行解析 BOM 條目，提取 {partNo, description, material, qty, materialCode}
  4. 交叉比對 v7_drawings_map 補強既有成果
  5. 顏色識別: COLOR_KEYWORDS 多層次 regex
```

**BOM 識別困難點**：
- 無表頭版式（Markdown 式表格，以 `|` 分隔）→ 靠 v7.8.20 升級邏輯處理
- 掃描圖面：文字識別失敗 → 依賴 `batchOcr141Drawings.mjs` 先行 OCR

**輸出**：`data/assembly_drawings_extract.json`（357 筆組件，1,133 行子零件 BOM 展開）

### 3.3 SET 圖萃取：`extract_set_drawings.py`

與組件圖萃取邏輯相似，額外識別：
- MDXE-xxx / MDXI-xxx 型號
- 輸液管（tubing）相關材質（PVC, Silicone, TPU 等）
- 管路子組件品號（22-69xxxx 系列）

**輸出**：`data/set_drawings_extract.json`（113 筆 SET）

### 3.4 物料圖萃取：`extract_material_drawings.py`

物料庫別分類（依圖面內容）：標籤（Label）、包裝袋（Bag）、說明書（IFU）、收縮膜（Shrink Band）、紙箱（Carton Box）、塑膠袋（Plastic Bag）

**輸出**：`data/material_drawings_extract.json`（139 筆物料，含 BOM 關聯 53 組）

### 3.5 原料圖萃取：`extract_resin_drawings.py`

原料規格書特有欄位：`materialCode`（商品編號，如 `COMMODITY #AB002`）

**輸出**：`data/resin_drawings_extract.json`（26 筆原料）

### 3.6 OCR 批次處理

| 腳本 | 對象 | 技術 | 輸出 |
|------|------|------|------|
| `batchOcr141Drawings.mjs` | 零件/組件掃描圖 141 份 | Tesseract v5 + Gemini-2.0-flash | `ocr_results_141.json` |
| `batchOcr60Materials.mjs` | 物料掃描圖 60 份 | Tesseract v5 + Gemini-2.0-flash | `ocr_results_material_60.json` |
| `ocr_resin_scanned.mjs` | 原料掃描圖 2 份 | Tesseract v5 + Gemini-2.0-flash | `ocr_results_resin_2.json` |

**OCR 流程**：
```
PDF → PDF.js 轉換 → PNG 圖片 → Tesseract OCR 中英文雙語 → 文本 → Gemini 語意結構化
                                         ↑
                              (tesseract 語言包: eng + chi_tra)
```

### 3.7 LLM 語意補強：`semanticExtract.js`

- **用途**：對第一輪萃取結果的缺漏欄位（品名、圖號、原料）進行二次 LLM 補強
- **輸出**：`data/semantic-extract.json`
- **優先序**：種子欄位有值時，語意提取結果不覆蓋（只補缺）

---

## 4. 建置層（`buildMaster.js`）

### 4.1 合併優先序（Priority Cascade）

```
優先序（高 → 低）：
┌─────────────────────────────────────────────────────┐
│ 1. 種子資料（rawdata/master_table_unified.json）     │ ← 人工驗證資料，最高可信度
│ 2. 組件圖/SET 圖 PDF 萃取                           │ ← 圖面為工程事實來源
│ 3. 零件圖 PDF 萃取（v7 萃取成功的品號）             │
│ 4. LLM 語意補強（semantic-extract.json）             │
│ 5. ICU 料號對照表                                    │
│ 6. 磁碟掃描補遺（repairMissingDrawingLinks）         │ ← 對應 v7 萃取失敗的品號
│ 7. OCR 結果（掃描圖面）                              │
│ 8. 物料/原料圖面萃取                                 │
└─────────────────────────────────────────────────────┘

補缺規則：僅當欄位為空、'N/A'、'待補'、'-' 時才更新；
          已有有效值的欄位「絕對不覆蓋」。
```

### 4.2 建置管線執行順序（`buildMaster()` 主函式）

```javascript
// 1. 載入種子資料並轉換為 master 骨架
master = convertUnifiedSeedToMaster(rawSeed)

// 2. 合併組件圖檔名品號（v7.8.7）
mergeDrawingsIntoMaster(master, extractData)

// 3. LLM 語意補強（v7.9.0）
mergeSemanticIntoMaster(master, semanticData)

// 4. ICU 料號對照表（v7.9.1）
mergeICUPartsIntoMaster(master, icuParts)

// 5. 零件圖 v7 萃取（v7.9.5）
mergeV7DrawingsIntoMaster(master, v7Data)

// 6. 組件圖全量融合（v7.9.7）
mergeAssemblyDrawingsIntoMaster(master, assyData)

// 7. SET 圖全量融合（v7.9.8）
mergeSetDrawingsIntoMaster(master, setData)

// 8. OCR 掃描圖結果融合（v7.9.9）
mergeOcrResultsIntoMaster(master, ocrData)

// 9. 物料庫圖面全量融合（v7.10.4）
mergeMaterialDrawingsIntoMaster(master, matData, matOcrData)

// 10. 原料庫圖面全量融合（v7.10.6）
mergeResinDrawingsIntoMaster(master, resinData, resinOcrData)

// 11. 互為替代品號去重合併（v7.10.0）
deduplicateMutualAlternates(master)

// 12. 磁碟掃描補遺（v7.10.8）
repairMissingDrawingLinks(master, drawingDirs)

// 13. 分類映射（細粒度內部值 → 五大分類）
// 14. ICU 原料料號強制標記
// 15. SET 型號強制標記（MDXE / MDXI）
// 16. 輸出 pn-lookup-master.json
```

---

## 5. 核心合併函式一覽

| 函式名 | 對應版本 | 輸入來源 | 說明 |
|--------|---------|---------|------|
| `convertUnifiedSeedToMaster` | v7.7 | `master_table_unified.json` | 種子資料格式轉換，建立 master 骨架 |
| `mergeDrawingsIntoMaster` | v7.8.7 | `drawings-extract.json` | 圖檔優先管線：組件/零件圖檔名品號收錄 |
| `mergeSemanticIntoMaster` | v7.9.0 | `semantic-extract.json` | LLM 語意識別補缺（品名/圖號/原料/BOM） |
| `mergeICUPartsIntoMaster` | v7.9.1 | `icu-parts.json` | ICU 客戶料號對照表融合 |
| `mergeV7DrawingsIntoMaster` | v7.9.5 | `drawings_extract_v7.json` | 零件圖 v7 版本（9大欄位）融合 |
| `mergeAssemblyDrawingsIntoMaster` | v7.9.7 | `assembly_drawings_extract.json` | 組件圖 BOM 展開全量融合 |
| `mergeSetDrawingsIntoMaster` | v7.9.8 | `set_drawings_extract.json` | SET 圖全量融合 |
| `mergeOcrResultsIntoMaster` | v7.9.9 | `ocr_results_141.json` | 零件/組件掃描圖 OCR 結果融合 |
| `mergeMaterialDrawingsIntoMaster` | v7.10.4 | `material_drawings_extract.json` + `ocr_results_material_60.json` | 物料圖全量融合 |
| `mergeResinDrawingsIntoMaster` | v7.10.6 | `resin_drawings_extract.json` + `ocr_results_resin_2.json` | 原料圖全量融合 |
| `deduplicateMutualAlternates` | v7.10.0 | master 內部 | 互為替代品號去重（移除 43 個重複實體） |
| `repairMissingDrawingLinks` | v7.10.8 | 磁碟 `rawdata/Drawings/` | 磁碟掃描補遺，補齊 v7 萃取品號失敗的圖檔連結 |

---

## 6. 品號正規化約定

> **核心不變量**：前端、後端（buildMaster.js）、萃取腳本三端的 `norm()` 函式必須保持 100% 一致。

```javascript
// buildMaster.js & verifyCoreLogic.js
function norm(s) {
  return String(s || '').replace(/[^A-Z0-9]+/gi, '').toUpperCase();
}

// 效果示例
// norm('A01-210-251-1')  → 'A012102511'
// norm('MDXE-012-11')   → 'MDXE01211'
// norm('9X.20860.003')  → '9X20860003'
// norm('B-077')         → 'B077'
```

**前端（`imageLibrary.js`）**：使用相同的 normalize 邏輯，且同時比對 `partNo` 與所有 `alternates`（別稱）。

**BOM 鍵規範化**：`bomKey(x)` 先嘗試在 existing map（含 alternates 索引）查找規範品號，再寫入 BOM 關聯。

---

## 7. 五大庫別分類體系

```
原料（Raw Material）：塑膠粒、色母、色粉
物料（Material）    ：標籤、包裝袋、說明書、收縮膜、紙箱、塑膠袋
零件（Part）        ：模具射出成型的單一成品
組件（Assembly）    ：由兩個以上零件組成的成品（含 BOM）
SET               ：含輸液管（tubing）的組件
```

### 分類識別邏輯

```javascript
// 1. 種子資料預設分類（人工標記）
// 2. 圖面 BOM 升級：無 BOM 零件 → 有 BOM → 升為「組件圖候補」
// 3. 候補降級：組件圖候補，但圖內無 BOM → 降回「零件圖」
// 4. 細粒度 → 五分類映射（輸出時）
const CATEGORY_ALIAS = {
  '單品零件': '零件',
  '零件圖':   '零件',
  '物料圖':   '物料',
  '組件圖候補': '其他組件',
};
// 5. ICU 原料料號強制標記為「原料」
// 6. MDXE-/MDXI-/SET_MANUAL 強制標記為「SET」
```

---

## 8. 資料不變量與確效門禁

`scripts/verifyCoreLogic.js` 執行以下 10 項防禦測試，**任何一項失敗即攔截 build/deploy**：

| # | 不變量 | 基線值 |
|---|--------|--------|
| 1 | 主資料庫品號唯一性 | `parts.length === uniquePNs.size` |
| 2 | 主資料庫品號總數下限 | `parts.length >= 961` |
| 3 | 種子轉譯去重性 | `converted.length === uniqueConverted.size` |
| 4 | 種子轉譯品號總數 | `converted.length === 669` |
| 5 | BOM 組件數固化 | `bom.children.size === 181` |
| 6 | 邊界防禦：B-003 ≠ B-0030 | `isMatchedSegment('B0030','B003') === false` |
| 7 | 邊界防禦：B-003 = B-003-REV1 | `isMatchedSegment('B003REV1','B003') === true` |
| 8 | 邊界防禦：A01-200-111 = A01-200-111_V1 | `isMatchedSegment(...) === true` |
| 9 | BOM 雙向映射一致性 | `children 與 parents 100% 對稱` |
| 10 | BOM 無自環 + 替代品號無自我宣告 | `selfLoop === 0, selfAlternate === 0` |

```json
// package.json — 自動執行時機
{
  "scripts": {
    "prebuild": "node scripts/verifyCoreLogic.js",
    "build": "vite build"
  }
}
```

---

## 9. BOM 資料結構

```json
{
  "bom": {
    "children": {
      "SA0001": ["A01-210-251-1", "B06-410-111-1", "0.08*14mm"],
      "MDXE-012-01": ["D09-210-251-2", "SA0001", "B-077"]
    },
    "parents": {
      "A01-210-251-1": ["SA0001"],
      "B06-410-111-1": ["SA0001"],
      "SA0001": ["MDXE-012-01"]
    }
  }
}
```

**三大約束**：
1. `children[A]` 中每個 `C` → `parents[C]` 必須包含 `A`（雙向對稱）
2. 不允許自環：`children[A]` 不能包含 `A`
3. 品號鍵使用**規範品號**（非別稱），由 `bomKey()` 保證

### `bomDetails` 富化欄位（組件/SET 專屬）

```json
{
  "partNo": "SA0001",
  "bomDetails": [
    {
      "partNo": "A01-210-251-1",
      "description": "VALVE BODY",
      "qty": 1,
      "unit": "ea",
      "material": "POLYPROPYLENE",
      "materialCode": "COMMODITY #AB002"
    }
  ]
}
```

---

## 10. 關鍵設計決策紀錄（ADR）

### ADR-001：圖檔為第一事實來源原則（v7.8.7）

- **決策**：工程圖面 BOM 與種子 Excel 衝突時，以圖面為準
- **理由**：圖面是最新版次的工程事實，Excel 整理可能滯後
- **實作**：`mergeDrawingsIntoMaster` 以圖面 BOM 取代 Excel 組件表，但保留收縮膜等物料子件（圖面未載明但實際存在）

### ADR-002：收縮膜特殊處理（v7.8.19）

- **決策**：`0.08*14mm` / `0.08*14.5mm` 以「尺寸規格」為品號，作為物料收錄
- **理由**：圖面 KEY UNIT 表中有此規格但無正式品號，確認實際使用後收錄
- **實作**：在 `mergeDrawingsIntoMaster` 中保留 `materialKids`（物料子件不隨 BOM 覆蓋一起刪除）

### ADR-003：互為替代品號去重（v7.10.0）

- **決策**：`alternates` 互為別名的品號合併為一個規範實體
- **理由**：種子資料中存在 43 組雙向別名重複，導致品號計數虛增
- **實作**：`deduplicateMutualAlternates()` 選擇「圖檔更多者」或「品號較短者」為規範實體

### ADR-004：磁碟掃描補遺（v7.10.8）

- **決策**：所有合併步驟之後，對仍無 `drawingFileName` 的品號，直接掃描 Drawings 各子資料夾
- **理由**：`extract_drawings_v7.py` 對 A01/B06/C09/D09/D10 系列的 `partNo` 萃取失敗，75 份圖檔連結丟失
- **實作**：`repairMissingDrawingLinks()` 精確比對 + 前綴容忍比對（≥8 字元），從 PDF 檔名提取 `revision`

### ADR-005：品號邊界防禦（isMatchedSegment）

- **決策**：品號匹配必須防止「B-003」貪婪匹配「B-0030」
- **理由**：圖面文本中品號後方常接數字，不能用 `startsWith` 純前綴比對
- **實作**：匹配時檢查「被比對字串在品號長度位置之後的字元是否為非數字」

### ADR-006：CI/CD 零私有資料原則（Zero Private Data）

- **決策**：`data/`、`rawdata/` 全部列入 `.gitignore`，GitHub 倉庫不存放任何私有工程圖資料
- **理由**：工程圖面屬於機密資產，不可上傳公開倉庫；GitHub Pages 只部署前端查詢介面
- **實作**：`verifyCoreLogic.js` 在 CI 環境中，若找不到私有資料庫檔，自動跳過檔案依賴測試

---

## 11. 已知限制與未修復空缺

### `drawingFileName` 仍為空的品號（合理空缺）

| 分類 | 缺失數 | 原因 |
|------|--------|------|
| 零件 | 58 筆 | ICU 客供圖面（CIV/BC/B-/AF/DB/DC/EF 開頭），本司不持有 PDF |
| SET  | 1 筆  | `MDXE-012-11`，種子資料不完整，圖號也為空 |
| 物料 | 3 筆  | `0.08*14mm`/`0.08*14.5mm` 無正式圖面；`6X.20860.402` 圖號存在但 PDF 不在資料夾 |

### `partNo` 萃取失敗問題（已有補救）

- **根本原因**：LLM prompt 對 A01/B06/C09/D09/D10 系列圖面品號識別不穩定
- **補救**：`repairMissingDrawingLinks()` 透過磁碟掃描完成 75 份的補齊
- **長期建議**：改善 `extract_drawings_v7.py` 的 LLM prompt 或 regex

### OCR 結果品質

- 清晰圖面（≥300 DPI）：約 95% 準確率
- 模糊/壓縮圖面：約 60-70% 準確率

---

## 12. 管線演進歷史

| 版本 | 主要里程碑 |
|------|-----------|
| v7.7 | `convertUnifiedSeedToMaster`：建立統一種子轉換函式 |
| v7.8.7 | 圖檔優先管線：圖面為第一事實來源 |
| v7.8.8 | 組件圖 BOM 取代 Excel 組件表 |
| v7.8.9 | 別名索引建立，BOM 鍵規範化 |
| v7.8.11 | 組件候補升降級機制 |
| v7.8.14 | SPC 圖號修正後組件升級邏輯 |
| v7.8.15 | 物料類別三層體系建立 |
| v7.8.19 | 收縮膜特殊物料收錄 |
| v7.8.20 | 無表頭 BOM 版式識別 |
| v7.9.0 | LLM 語意補強融合 |
| v7.9.1 | ICU 料號對照表融合 |
| v7.9.2 | 五分類體系正式確立（原料/物料/零件/組件/SET） |
| v7.9.5 | 零件圖 v7 萃取融合（9 大欄位） |
| v7.9.7 | 組件圖全量融合（357 份 PDF，1,133 行 BOM） |
| v7.9.8 | SET 圖全量融合（113 份 PDF） |
| v7.9.9 | 掃描圖 OCR 141 份融合 |
| v7.10.0 | 互為替代品號去重（移除 43 重複實體，984 筆規範品號） |
| v7.10.3 | 物料庫萃取（199 份 PDF）啟動 |
| v7.10.4 | 物料庫全量融合（139 份可解析 + 60 份 OCR） |
| v7.10.5 | 原料庫萃取（28 份規格書）啟動 |
| v7.10.6 | 原料庫全量融合（26 份可解析 + 2 份 OCR） |
| v7.10.7 | 全量重構清理、文件對齊、Git 基準點 |
| v7.10.8 | 磁碟掃描補遺：修復 `drawingFileName`/`revision` 空缺（+81/+67 筆） |

---

## 附錄 A：輸出 Master JSON 欄位說明

```typescript
interface MasterTable {
  version: string;           // 版本號（如 "7.10.8"）
  buildDate: string;         // 建置日期
  totalParts: number;        // 總品號數（984）
  parts: Part[];
  bom: {
    children: Record<string, string[]>;  // 父 → 子清單
    parents: Record<string, string[]>;   // 子 → 父清單
  };
}

interface Part {
  id: string;                // = partNo（主鍵）
  partNo: string;            // 品號（唯一）
  name: string;              // 品名（中文）
  customer: string;          // 客戶（如 ICU, MDX）
  category: string;          // 五大分類之一
  color: string;             // 顏色
  material: string;          // 原料名稱
  materialCode?: string;     // 原料商品編碼
  moldNo?: string;           // 模具號
  cavity?: string;           // 模穴數
  dwgNo?: string;            // 圖號
  drawingFileName?: string;  // PDF 檔名（如 A01-210-251-1(Rev.B).pdf）
  revision?: string;         // 版本（如 Rev.B）
  description?: string;      // 品名英文
  notes?: string;            // 備註
  alternates?: string[];     // 替代/別稱品號清單
  bomDetails?: BomDetail[];  // 組件/SET 的子零件明細
}

interface BomDetail {
  partNo: string;
  description: string;
  qty: number;
  unit: string;
  material: string;
  materialCode: string;
}
```

---

## 附錄 B：快速指令參考

```bash
# 快速更新（只重建 master，假設各 extract JSON 均已存在）
node scripts/buildMaster.js && node scripts/verifyCoreLogic.js

# 僅更新特定庫別後重建
python scripts/extract_assembly_drawings.py
node scripts/buildMaster.js

# 確效驗證
node scripts/verifyCoreLogic.js

# 生產打包（含確效門禁）
npm run build
```

---

## 13. 圖檔串流與前端自動掛載架構 (v7.10.9)

```
本地檔案系統: rawdata/Drawings/ (1,503 份 PDF / 圖片)
                    │
                    ▼
Express 後端: server.js
  ├── GET /api/images/list ──► 掃描 Drawings 目錄 (60s 快取) ──► 回傳檔名與相對路徑清單
  └── GET /api/images/raw  ──► 安全路徑校驗 ──► inline 串流輸出 (application/pdf 等)
                    │
                    ▼
前端: App.tsx autoDetectAndRestore()
  ├── 呼叫 /api/images/list 取得清單
  ├── 調用 buildRemoteLibrary() 封裝為 ImageLibrary 物件
  └── 注入 PartsTable & PartDetailModal
        ├── 表格品號/圖號自動匹配（覆蓋率 89.1%）
        ├── 圖檔為唯一真實數據來源 (Drawing as SSOT v7.11.0: 修正 51 筆圖號筆誤 / 裁決 6 項材料矛盾)
        ├── 版本號 100% 全覆蓋（877/877 筆有圖檔品號均收錄精確版次）
        ├── 零件原料名稱 100% 全覆蓋（455/455 筆單品零件均具備精確原料材質）
        ├── 零件顏色資訊 100% 全覆蓋（455/455 筆單品零件均具備精確外觀顏色）
        ├── 120ms 平滑懸停縮圖預覽 (hoverThumb: PDF FitH iframe / Image)
        ├── 一鍵新分頁直開原圖
        └── 容器自適應佈局 (max-w-[128rem] 消除 1920px 橫向卷軸)
```

---

*本文件由 Antigravity AI 自動維護，反映截至 v7.11.0 的最新架構狀態。*
*如有重大管線變更，應同步更新本文件並記入 DEV_LOG.md。*
