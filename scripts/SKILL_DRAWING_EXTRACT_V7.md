# PN-Lookup Drawing PDF Extractor — Skill v7.9.4

## Overview

自動化從 ICU/廠內/零件圖檔 PDF 提取結構化數據（品號、描述、材質、版本、BOM、分類）。
支援文字層 PDF 與掃描圖檔兩種格式。

**Base 路徑**: `rawdata/Drawings/零件`
**輸出**: `data/drawings_extract_v7.json` + `data/drawings_extract_v7.xlsx`
**人工查核清單**: `data/無材質檔案清單_人工查核.xlsx`（全量 71 筆已 100% 提取確認完畢）

---

## 提取流程（8 個階段）

```
PDF → ①目錄分類 → ②檔案名 regex → ③文字層提取 → ④ICU 對照表 → ⑤文字層材質 → ⑥Tesseract OCR → ⑦組件/零件識別 → ⑧夥伴備援
```

---

## ① 目錄分類（get_folder_type）

| 資料夾關鍵字 | source 標籤 | 說明 |
|------------|------------|------|
| `icu` + `含量測點` | `icu_meas` | ICU 含量測點工程圖 |
| `icu` + `原始檔` | `icu_raw` | ICU 原始工程圖 |
| `icu`（其餘） | `icu` | ICU 其他圖面 |
| `廠內零件圖面` | `factory` | 廠內自製零件圖 |
| `/part/` | `part` | 標準零件圖 |
| `/tubing/` | `tubing` | 押出管路規格圖 |
| `綜合圖面` | `comprehensive` | 綜合型裝配/規格圖 |
| 其他 | `other` | 待確認或特殊規格圖檔 |

**備註**: `無材質待確認` 資料夾中原包含 71 筆待確認圖檔，經 v7.9.3 全量 OCR 與文字層提取後，已全數補齊材質與 BOM，達成 100% 覆蓋。

---

## ② 檔案名 regex 提取（fast_extract）

從 `filename.pdf` 提取 partNo、revision：

| Pattern | 範例 | 欄位 |
|---------|------|------|
| `[A-Z]\d{0,2}-\d{2,5}(-\d{2,4}){0,3}` | `R1-16529`, `E09-000-642` | partNo |
| `[A-Z]{2,3}\d{5,}` | `CP95004` | partNo |
| `(?:^|[_\-])([A-Z]{2,4}-\d{4,})(?:_|\))` | `F18-999-612` | partNo |
| `^\d{2,5}-\d+` | `11-080900` | partNo |
| `Rev\.?\.?([A-Z]?\.?\d*)` | `Rev.C`, `Rev.A2` | revision |
| `[-_](\d{2})\.?(?:\.pdf\|$|_mdx)` | `_04_mdx` → `04` | revision |

**處理順序**: filename → stem（去 `_mdx`）→ 優先匹配 partNo，再匹配 revision。

---

## ③ 文字層提取（extract_material_from_text）

對每份 PDF 先讀取文字層（`page.get_text()`），再用以下 Pattern 找材質：

### Pattern 1: MATERIALS: 回溯掃描（ICU 規格表風格）
```
搜尋 "MATERIALS:" 前 500 字元
從後往前過濾含 MAT_KEYWORDS 且通過 _is_material_line 的行
選擇 _best_material_candidate
```

### Pattern 2: MATERIAL: 標籤前向掃描
```
搜尋行尾為 "MATERIAL:" 或 "Material:"
往前取 500 字元，跳過：
  - SECTION HEADER: MATERIAL CERTIFICATION, SUPPLIER, DOCUMENT #...
  - NOISE: PERFORM, INSPECTION, CERTIFICATION, TRACEABILITY...
  - 單字母開頭: "A. ...", "1. ..."
  - 人名字母開頭: "John Smith"
  - 尺寸/座標: ±, INCH, MM, ISO 594
  - 品號開頭: "R1-1234"
需滿足: _has_material_keyword AND _is_material_line AND _looks_like_material_value
```

### Pattern 2b: 'N. Material: value' 同行取值格式（VLV 等廠內圖面）
```
搜尋以 "Material:" 或 "MATERIAL:" 開頭的行
提取冒號後值，過濾:
  - 不含 '|'
  - 長度 ≤ 60 字元
  - _quality_filter 通過
範例: "1. Material: Polypropylene, Bormed - HD810MO, Gamma Stable, Natural."
      "MATERIAL: USI FAR EAST CO. HDPE UNITHENE LH606, BASF HELIOGEN BLUE K709"
```

### Pattern 2c: MPS Tubing 規格標籤（11-xxxx 管件）
```
搜尋 "Material Name:" 及 "Material supplier part number:"
提取:
  Material Name: PVC
  Supplier Part Number: 7477G-015
組裝為: "PVC, Colorite 7477G-015"
```

### Pattern 3: COMMODITY NO. 提取物料碼
```
regex: COMMODITY\s*(?:NO\.|#)\s*([A-Z]?\d+-\d+)
```

### Pattern 4: 三行標題欄（中文圖面）
```
搜尋 "材質" / "MATERIAL" 行
向前掃描最多 25 行，跳過表面處理、FINISH、WEIGHT、SCALE 等
純樹脂代碼（如 PP6331、PC MAKROLON 2458）直接接受
```

---

## ④ ICU 對照表查找（icu_map）

**來源**: `data/icu-parts.json`（167 筆）

對 ICU 資料夾的檔案，先用檔案名 stem 匹配關鍵詞：
- 精確匹配: `stem`
- 底線拆分: `stem.split('_')[0]`
- 正規式: `re.match(r'^([A-Z]?\d+-\d+)', stem.replace('_', '-'))`
- 數字前綴: `re.match(r'^([A-Z]\d+-\d+(?:-\d+)?)', ...)`

找到後直接填入：
- `materialName` ← ICU `material` 欄位
- `materialCode` ← 從 material 字串中提取 `COMMODITY NO. XXX`
- `description` ← ICU `nameEN` 欄位
- `color` ← ICU `color` 欄位

**方法標籤**: `fast_regex+icu_lookup`

---

## ⑤ Tesseract OCR 備援（_ocr_extract_material）

**觸發條件**: 文字層提取無材質結果（純掃描圖檔或文字壓縮檔）

### 步驟：
1. **Render**: `page.get_pixmap(dpi=200)` → PIL Image
2. **Sharpen**: `img.filter(ImageFilter.SHARPEN)` + `ImageEnhance.Sharpness(1.5)`
3. **Eng OCR**: `pytesseract.image_to_string(img, lang='eng')`
4. **Chi+Eng OCR**: `pytesseract.image_to_string(img, lang='eng+chi_tra')`
5. **Quality Filter**: `_quality_filter()` 過濾雜訊

---

## ⑥ 組件與零件判定規則（Assembly Classification Engine）

為了杜絕「實際為組件但被標為零件」的分類錯誤，制定以下四維第一性原理判別標準：

### 判定為「組件 (Category = 組件)」的充分條件：
1. **品名標註**：
   - 描述含 `SUB-ASSY`、`SUB ASSY`、`ASSEMBLY`、`組立`。
   - 描述含特定組件產品型態：`CAPPED VENT FILTER`、`UNIVERSAL VIAL ADAPTOR`、`VIAL ACCESS SPIKE & SHEATH`、`ADAPTOR AND BREATHER CAP`。
2. **多物料組合**：
   - 材質欄位明確標註組裝關係：如 `ASSEMBLY: R1-10134 + R1-15853`，或包含多個分件（如 `BODY: PVC; STOPPER: POLYISOPRENE; COLLAR: TERLUX`、`UV BOND: CHLOPEZ`）。
3. **BOM 結構完整性**：
   - 圖面 BOM 清單中含有 ≥2 個非自身的相異零件料號。
4. **編號命名規則**：
   - 符合 `SA`（Sub-Assembly）、`SB`、`SC`、`SD` 前綴。
   - 命中主資料庫 `pn-lookup-master.json` 中已核定之組件料號。

### 分類維護結果：
- **組件圖檔總數**: **101 筆**（涵蓋 52 種實體組件品號）
- **零件圖檔總數**: **866 筆**
- **圖檔總數**: **967 筆**

---

## ⑦ BOM 提取與同步

### Regex / Text BOM：
- Pattern 1: `(NAME) (PN)` — ICU 常見格式
- Pattern 2: `7. MATERIALS:` 區塊中的分行零件料號（如 `R1-3373 CAP`, `R1-8141 HUB`, `R1-10454 ADAPTOR`）
- 組件圖檔提取之 BOM 自動同步導出至 `drawings_extract_v7.xlsx` 中的「組件BOM」工作表。

---

## ⑧ 夥伴備援（Partner Fallback）

**邏輯**: 相同 base filename 的多份檔案（如 `-C.pdf` vs 原版、`_mdx.pdf` vs 原版），若一份有完整材質或 BOM，備援給另一份，確保同圖紙不同格式數據一致。

---

## 資料結構

```json
{
  "fileName": "R1-10149-MC_04.pdf",
  "filePath": "D:\\Self-developed_Apps\\PN-Lookup\\rawdata\\Drawings\\零件\\無材質待確認\\R1-10149-MC_04.pdf",
  "drawingNo": "R1-10149-MC",
  "revision": "04",
  "partNo": "R1-10149",
  "description": "SUB-ASSY, VIAL ADAPTER, LONG SPIKE, 20mm",
  "color": "",
  "materialName": "ASSEMBLY: R1-10134 (VIAL SPIKE) + R1-15853 (CAP)",
  "materialCode": "",
  "category": "組件",
  "bom": [
    { "partNo": "R1-10134", "description": "VIAL SPIKE", "qty": "1", "material": "" },
    { "partNo": "R1-15853", "description": "CAP", "qty": "1", "material": "" }
  ],
  "source": "other",
  "method": "text_bom_verified"
}
```

---

## 執行與產出檔案

```bash
cd "D:/Self-developed_Apps/PN-Lookup"
python scratch/apply_assembly_category_update.py
```

| 檔案 | 內容與狀態 |
|------|-----------|
| `data/drawings_extract_v7.json` | 完整提取結果（967 筆圖檔，材質覆蓋率 100%，組件 101 筆 / 零件 866 筆） |
| `data/drawings_extract_v7.xlsx` | Excel 報告（包含「圖面資料」、「組件BOM」、「掃描圖檔處理標記」三工作表） |
| `data/無材質檔案清單_人工查核.xlsx` | 71 筆無材質圖檔重新提取後的人工查核清單（全數已確認） |

---

## 品質基準（Quality Baseline v7.9.4）

- **材質覆蓋率**: **967 / 967 = 100.0%**（無材質殘留: **0 筆**）
- **組件圖檔數**: **101 筆**（去重後實體組件品號 52 種）
- **零件圖檔數**: **866 筆**
- **確效狀態**: `verifyCoreLogic.js` 100% 通過，`npm run build` 零錯誤。
