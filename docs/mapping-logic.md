# PN-Lookup 品號 ↔ 圖檔 ↔ BOM 完整映射邏輯

> 版本：v7.10.9 ｜ 最後整理：2026-08-31
> 本文從資料源頭開始，完整說明「品號資料庫（master）」、「圖檔」、「BOM 階層」三者之間的所有映射規則與資料流，作為日後維護與除錯的單一參考文件。

---

## 0. 總覽（資料流一覽）

```
rawdata/圖檔（1503 張，品號第一事實來源）
        │  scanAssemblyImages.js --extract（角色化提取：組件/零件/物料）
        ▼
data/drawings-extract.json（filePartNo + titleBlock 欄位 + bomLinks）
        │                rawdata/master_table_unified.json（種子：4 張來源表 + BOM 階層 + scannedAssemblies + pnAliases）
        │                │  buildMaster.js（mergeDrawingsIntoMaster：圖檔優先、seed 補欄位）
        │                ▼
        └───────────► data/pn-lookup-master.json（唯一真源：parts + bom.children/parents）
                        │  server.js API (/api/images/list & /api/images/raw) 或 瀏覽器匯入
                        ▼
                前端：localStorage(parts) + bomEngine(children/parents 地圖) + imageLibrary(圖檔)
                        │  resolveAllImages（四級解析：檔名/別稱/綁定/語意）
                        ▼
                PartDetailModal：圖檔顯示 + 懸停縮圖預覽 + 「本零件可組成的組件」
```

> v7.8.7 管線反轉：圖檔品號提取為第一事實來源（孤兒圖歸零），種子檔（產品一覽表.xlsm 轉譯）負責補欄位（品名/客戶/材料）與 BOM 階層基底，兩者經 `mergeDrawingsIntoMaster` 合併為唯一真源。v7.10.1 依本體論完成 43 組互為替代品號去重，主資料庫精煉為 **984 筆規範品號**，固化 **181 組 BOM 關聯**。v7.10.9 建立後端 Express 零點擊自動掛載本機圖庫、120ms 平滑懸停縮圖預覽、品名規格點擊開明細與全寬 128rem 自適應佈局。目前 master：**984 規範品號 / 181 組 BOM / 1,503 份工程圖檔**（詳細品質數據見第 9 節）。

---

## 1. 資料源頭（rawdata）

### 1.1 種子檔的來源（上游）

`master_table_unified.json` **並非手寫**，而是從原始 Excel `rawdata/產品一覽表.xlsm`（96KB，7 張工作表）經 7 階段清洗統合而來（歷史紀錄：DEV_LOG v2.9.0「Master Table 構建 階段一~七」）：

| 階段 | 工作表 | 原始筆數 → 去重後 | 中間產物（rawdata/clean_*.json） |
|---|---|---|---|
| 一 | 客戶與品號對照表 | 450 → 428 | `clean_customer_parts.json` |
| 二 | 廠內紙本零件編號 | 248 → 248（100% 唯一） | `clean_internal_parts.json` |
| 三 | 客戶料號 | 172 → 172 | `clean_customer_part_numbers.json` |
| 四 | SA 組件 | 95 → 95 | `clean_sa_components.json` + `clean_sa_bom_tree.json` |
| 五 | SB 組件 | 52 → 52 | `clean_sb_components.json` + `clean_sb_bom_tree.json` |
| 六 | SC 組件 | 25 → 25 | `clean_sc_components.json` + `clean_sc_bom_tree.json` |
| 七 | SD 組件 | 9 → 9 | `clean_sd_components.json` + `clean_sd_bom_tree.json` |

清洗作業重點（MECE 原則）：
- 剔除 100% 完全重複列；`產品編號`/`組件編號` 達 100% 唯一性。
- 清除不可見特殊字元（`\xa0` 不換行空格）、頭尾空格、字串內換行。
- 補齊缺失欄名（如第 9 欄補 `備註`、第 11 欄補 `備註`）。
- 跨表比對（對照表 vs 廠內品號）與異常列紀錄（如 3 筆品名微調、5 筆殘缺列）。

**最終統合**：階段七將 7 張工作表全數合併為 `master_table_unified.json`（`meta.totalSheets: 7`，計 428+248+172 品號資料與 SA/SB/SC/SD 共 181 組 BOM）。
> 注意：種子檔與 `產品一覽表.xlsm`、clean_*.json 皆屬私密原始數據，被 `.gitignore` 排除，不會上雲。

### 1.2 種子檔結構 `rawdata/master_table_unified.json`

由 Excel 各工作表統合而成，含 4 張表 + BOM 階層：

| 鍵 | 筆數 | 關鍵欄位 | 用途 |
|---|---|---|---|
| `customerParts` | 428 | 客戶、產品編號、零件名稱(中) | 客戶品號（基本品項） |
| `internalParts` | 248 | 產品編號、產品編號(舊)、零件編號(客)、零件名稱、顏色、原料、**模具號碼、穴數** | 廠內品號（舊編號/客戶編號成為**別稱**） |
| `customerPartNumbers` | 172 | 產品編號(廠內)、零件編號(客)、圖面編號、零件名稱、顏色、原料、**模具號碼、穴數** | **對照表**：廠內品號 ⇄ 客戶料號 ⇄ 圖面編號（圖面編號常出現在圖檔檔名） |
| `bomHierarchy` | SA 95 / SB 52 / SC 25 / SD 9 | seq、assemblyId、name、nameEn、children | 廠內 BOM 階層（組件 → 子零件） |

### 1.3 圖檔資料夾 `rawdata/圖檔`（1514 檔，不進 git）

主要子資料夾：`客戶圖面/Sub-Assembly`、`產品資料/廠內組件圖面`、`產品資料/綜合圖面`、其他產品/客戶圖面。

**檔名命名規則（實測統計，2026-08）**：`品號 + 版本 + 其他後綴`，版本與後綴的連結方式不一：

| 樣式 | 數量 | 範例 |
|---|---|---|
| `(Rev.X)` 括號版本 + `-C` | 933 | `A01-200-111(Rev.A)-C.pdf` |
| 尾綴 `_mdx` | 204 | `27-0246-MC_08_mdx.pdf` |
| 尾綴 `_NN`（版本數字） | 169 | `R1-10002_01.pdf`、`R1-1000_8.pdf` |
| 尾綴 `_XX`（字母/其它） | 101 | `27-0338_3_mdx.pdf`（含 `_3` 單碼） |
| 尾綴 `-MC_xx` | 67 | `75-0485-MC_29.pdf` |
| 含 `Rev` | 23 | `BD-8003875_Rev.04.pdf` |
| 無後綴 | 16 | `R1-15853.pdf` |
| 特殊（SPC 文件） | 1 | `SPC0014799_10_R1-2361.pdf` |

> 命名要點：**版本/後綴可以是 `_`、`()`、`-` 各種連結**；括號內容若為 `Rev` 開頭則為版本資訊會被剝除，若為其它內容（非 1~3 位純數字）則視為**品號優先取用**（如 `PFM-DWG-30125-01(126-006)` → `126-006`）。

---

## 2. 建構鏈：種子 → master（`scripts/buildMaster.js`）

### 2.1 合併規則（`convertUnifiedSeedToMaster`）

- **去重**：以 `partNo` 為 key 存入 `Map`（後筆補齊前筆缺漏欄位：customer / name / color / material / **moldNo（模具號碼）/ cavity（穴數）** / alternates，v7.8.8 起）。
- **別稱淨化**（`sanitizeAlternates`）：只收 `/^[A-Z0-9][A-Z0-9-]*$/i` 格式（排除備註/說明文字誤錄），並 `Set` 去重。
- **來源 1 `internalParts`**：`產品編號` → 品號；別稱 = `零件編號(客)` + `產品編號(舊)`。
- **來源 2 `customerParts`**：`產品編號`（或 `品號`）→ 品號。
- **來源 3 `customerPartNumbers`**（雙向建檔）：
  - `產品編號`（廠內）→ 品號，別稱 = `零件編號(客)` + `圖面編號`。
  - `零件編號(客)` ≠ 廠內品號時，客戶料號本身也建為品項，別稱 = 廠內品號或圖面編號。
  - **圖面編號進入別稱，是圖檔檔名能命中品號的關鍵**。
- **來源 4 `bomHierarchy`**：每個 `assemblyId` 建為組件品項（category = `{level}組立`）；`children` 逐一建立 `addBomLink(assemblyId, childNo)` 並為子品號建檔。
- **來源 5 `scannedAssemblies`（2026-08-17 新增）**：組件圖識別補登品號（category = `組件圖候補`），收錄存在於組件圖檔名、但未收錄於 Excel 種子工作表的組件品號（MDXE-* 8、R1-* 15、SC0044，共 24 筆）。此區塊為「圖檔識別回饋」的事實來源，與 Excel 種子分開管理，buildMaster 合併後仍以 `data/pn-lookup-master.json` 為唯一真源。

### 2.2 ICU 原料料號對照表導入（`scripts/importICU.js` + `mergeICUPartsIntoMaster`）

`rawdata/客戶(ICU)原料料號對照表.xlsx` 解析 167 筆零件×原料對照資料，欄位對應：

| 欄位 | index | 內容 |
|---|---|---|
| customer | 0 | **客戶名稱**（ICU / MDX / GVS / CardioMed / SIMS / Bard / RMS / PFM 等 8 種） |
| moldNo | 1 | 模具號碼 |
| cavity | 2 | 穴數 |
| dwgNo | 3 | 圖面編號 |
| productNo | 4 | 產品編號 |
| partNo | 5 | 品號（零組件編號，167 筆全部唯一） |
| nameCN | 6 | 中文品名 |
| nameEN | 7 | 英文品名 |
| color | 8 | 顏色 |
| material | 9 | 材料規格（含原料料號引用，如 `COMMODITY NO. R1-1034`） |

> **重要**：customer 欄位來自 Excel，不全為 "ICU"。實際分佈：ICU(120)、MDX(40)、GVS(2)、CardioMed(1)、SIMS(1)、Bard(1)、RMS(1)、PFM(1)。

跨列原料合併：同一品號的原料描述可能跨列（Excel 合併儲存格），`importICU.js` 以 `partNo` 為鍵合併，`materialRefs` 收集解析出的原料料號。

**合併規則（`mergeICUPartsIntoMaster`）**：
- 合併鍵為 `norm(partNo)`（不含 customer）。
- **已有品號**：覆蓋 material / color / moldNo / cavity / dwgNo / description，**不覆蓋 customer**（保留 seed 的值）。
- **新品號**：`customer: icu.customer || 'ICU'`，category = `零件`，`notes: '由ICU原料料號對照表導入'`。

> 有 9 筆跨資料集重疊（ICU Excel 與 seed 品號相同但客戶不同，如 27-0336：ICU vs BLLS），因不覆蓋 customer，seed 的客戶值會保留。

### 2.3 語意 BOM 品號白名單過濾（v7.9.1）

語意 BOM（`data/semantic-extract.json`）提取的子件品號須通過白名單過濾，排除材質/品名/模具號/尺寸雜訊：

| 規則 | 正則/清單 | 用途 |
|---|---|---|
| `PN_RE` | `/^(?:[A-Z]{1,4}\d{1,4}(?:-\d{1,4}){1,3}[A-Z0-9]?\|[A-Z]{2,4}\d{4,7}\|\d{1,2}[A-Z]\d{3,6}\|\d{4,}(?:-\d+)*\|\d{2,3}(?:-\d+){1,3})$/i` | 品號格式驗證（連字號/純數字/CP型/1H型/2位數字開頭多段） |
| `PN_JUNK_RE` | `/^(SHRINK\|STOPPER\|BAG\|CAP\|...)/i` | 排除材質/品名/模具號/尺寸/色號（9494 等 30+ 個雜訊） |
| `PN_MOULDEX_RE` | `/^M\d{3,4}-R\d+$/i` | 排除模具號（M05003-R01 等） |
| `PN_MANUAL_BLACKLIST` | 7 個確認誤讀品號 | BO6-410-311-1、HO0/HOO/HOO0 系列、A01-210-131、E13-999-421-5 |

> 白名單過濾使語意 BOM 補缺從 64→31（含 22-69xxxx ×6、CP96020、R1 系列、H 系列），排除材質/模具號/尺寸雜訊。

### 2.4 五分類體系（v7.9.2）

`buildMaster.js` 在合併後對所有品號進行五分類：

| 類別 | 判定邏輯 | 數量 |
|---|---|---|
| **原料** | `ICU_MATERIAL_PNS`（25 個料號：28-0397、75-0485、75-1396 等）且原為「零件」 | 25 |
| **物料** | 物料圖（`物料資料/*` 目錄）提取的品號 | 137 |
| **零件** | 單品零件 + 零件圖提取的品號（預設類別） | 552 |
| **組件** | SA/SB/SC/SD 組立 + 其他組件（`組件圖候補`） | 181（SA-95 SB-52 SC-25 SD-9 其他-18） |
| **SET** | ① `MDXE-` / `MDXI-` 前綴（全系列）；② `SET_MANUAL`（8003875、X3299AAM、EB/EC/ED/EG/DB 系列共 12 個） | 114（MDXE-91 MDXI-11 +12 手動） |

> **分類優先序**：SET > 原料 > 組件 > 物料 > 零件（SET/原料判斷在前，避免被 `isAssembly` 抢先命中深色樣式）。
>
> **原料 ≠ 物料**：原料為化學材料（POLYCARBONATE、ABS 等 25 種），物料為包裝/標籤/收縮膜等（137 種）。兩者在前端以不同顏色區分（原料琥珀色、物料灰色）。
- **產出**：`bom.children`（組件 → 子零件陣列）+ `bom.parents`（子零件 → 組件陣列，對稱推導）。

### 2.5 唯一真源原則

- `data/pn-lookup-master.json` 為唯一真源（`version: 3.1.0`），`data/` 與 `rawdata/` 皆被 `.gitignore` 排除（零私密數據上雲）。
- 前端**衍生欄位一律即時推導**（見 §7），不信任任何儲存值。

---

## 3. 圖檔優先管線（`scripts/scanAssemblyImages.js`）

v7.8.7 起圖檔為品號第一事實來源：全部 1514 張圖檔（組件圖 + 零件圖 + 物料圖）角色化提取 → `data/drawings-extract.json`，由 `buildMaster.js` 的 `mergeDrawingsIntoMaster` 合併進 master（圖檔優先、seed 補欄位）。內文標題欄（PART NO./REV 等）為品號與版本的最終確認依據。

### 3.0 角色化提取（`--extract`，v7.8.7 新增）

- 目錄 → 角色：`物料資料/*` → 物料、`廠內零件圖面/*` 或 `ICU原料圖面/*` → 零件、其餘（客戶圖面、MDX/MPS、廠內組件、綜合）→ 組件。
- **僅組件圖**的內文已知品號建立 `bomLinks`（零件/物料圖內文不建立父子關係）。
- 輸出欄位：`filePartNo`（檔名品號）、`titleBlock`（內文欄位）、`review`（檔名與內文欄位品號不一致標記，26 張保留人工確認）、`pendingCandidate`（疑義留待人工確認，不猜測）、`known/unknown`、`bomLinks`。

### 3.0.1 內文標題欄提取（`parseTitleBlock`，v7.8.7）

以圖檔內文欄位確認品號/品名/版本（使用者領域規則）：

| 標籤 | 對應 |
|---|---|
| `PART NO.` / `P/N` / `PART` / `Drawing #` / `FILE NO.` / `零件編號` | 品號 |
| `REV` / `REVISION` | 版本（限單字母 / 字母+數字 / 純數字，排除日期等雜訊） |
| `TITLE` / `Description`（SPC 圖） | 品名 |

防誤取：排除日期、尺寸（`mm` 尾）、ISO 標準尾號、材料碼、圖框名（MOULDEX M05003-R01）；**跨行取值須與檔名品號關聯**（圖檔名稱與品號基本一致為命名慣例）；無標籤的客戶圖（如 `Extension Set / MDXE-029-01`）以前 6 行內關聯 token 為品號。

### 3.1 檔名 → 組件品號（`assemblyIdFromFileName`）

剝除順序：
1. 副檔名
2. **括號內品號優先**：`(...)` 內**非 `Rev` 開頭、非 1~3 位純數字**的內容即品號（如 `PFM-DWG-30125-01(126-006)_Rev.AB.pdf` → `126-006`；`(1)` 為 Windows 重複檔編號 → 忽略）
3. 否則：移除括號內容（`(Rev.A)` 等版本資訊）
4. 尾綴 `Rev.XX` / `RevXX`、`mdx`（領域規則：mdx 不屬品號）
5. **`-C` 僅在含括號檔名剝除**（如 `(Rev.A)-C.pdf`；防誤傷 `-MC` 品號）
6. `BD-` 客戶代稱前綴剝除（`BD_404028` → `404028`）
7. 中文描述後綴剝除；第一 token 為有效品號格式（排除 `PFM-DWG-*`、`SPC\d+_\d+_*` 圖號）→ 本體優先

### 3.2 組件 ID 標準化（`resolveAssemblyId`，v7.8.5 新增、v7.8.7 補強）

檔名衍生 ID → master 標準品號的層級解析：

```
1. 精確命中        norm(id) 在 master 索引中 → 直接回傳標準品號
2. 家族前綴合併    X3299 → X3299AAM（core 為 master 品號前綴且後續首字元非數字，
                   防誤併 R1-1585 → R1-15853；pnAliases 亦寫入 alternates）
3. BD- 前綴剝除    BD-X3299AAM → X3299AAM（BD- 為圖型前綴非品號；剝除後未命中
                   master 則保留原樣，由非品號過濾排除，如 BD-X3299）
4. 逐層剝除後綴    每剝一層即查 master（支援多層組合，如 R1-15853_03_mdx）：
                   ① _mdx   ② -MC_xx  ③ -MC（Mouldex Component 來源標記，
                   75-0485-MC → 75-0485）  ④ _NN   ⑤ Rev
5. 圖號註冊自身圖   ID = <圖號>_<版次>_<品號>（如 SPC0014799_10_R1-2361、
                   C74-49554-MC_05_C74-49554）：內文已知候選 = 尾段 token、
                   前一 token 為純數字版次、前方尚有圖號 token → 自身圖
6. 最乾淨形式      全部剝除後仍未命中 → 回傳最剝除的形式（合併同家族版本，
                   例：R1-10278-MC_04_mdx 與 R1-10278-MC_04 合併為 R1-10278）
7. 內文自身品號    圖面內文已知候選為組件 ID 正規化前綴、且後續首字元非數字
                   （邊界防誤判，如 R1-15853 是 R1-15853_03_mdx 的前綴 → 解析為自身）
```

**自身版本圖跳過**：解析後 `p.partNo === assemblyId`（如 `R1-15853_03` → `R1-15853`）即為該品號自己的版本圖面，**不寫入 BOM**（避免偽自連）。

**噪音過濾**：組件 ID 含中文/空白等非 `/^[A-Z0-9][A-Z0-9_.\-]*$/i` 字元者（如 `PN-0002_D10-210-251-1 包裝說明書`）不作為 BOM 父鍵。

**非品號排除**（人工領域知識）：文件編號格式不作為 BOM 父鍵 —
- `SPC\d+_\d+_(RAW|CIV)\d+`（SPC 規格編號 + RAW 原料圖號，如 `SPC0005450_04_RAW0000336`）
- `PFM-DWG-*`（文件編號；括號內品號已優先解析，此規則為保險）
- 未剝除的 `BD-*` 殘留（剝除後非 master 品號者）

### 3.3 PDF 內文 → 零件候選（`extractPartNoCandidates`）

- Token 正規式：`/^[A-Z]{0,4}\d{1,4}(?:-[A-Z0-9]+)+$/i`（1~4 字母 + 數字 + 破折號）。
- 排除：日期 `YYYY-MM-DD`、ISO/IEC/EN 標準尾號、純 `\d{3,5}-\d{1,2}`。
- 每張圖取前 6 頁文字。

### 3.4 比對與報告

- `norm(s)`：去除全部非 `A-Z0-9` 字元 + 轉大寫（與前端 `imageLibrary.normalize` 一致）。
- **master 索引**：`Map<norm(品號或別稱) → 標準品號>`。
- 每張圖輸出 `known[]`（命中 master，含 candidate + 標準品號）、`unknown[]`（未收錄候補）→ `data/assembly-scan-report.json`。

### 3.5 寫入 BOM（`--apply` / `--auto` / `--parent-of`）

| 旗標 | 行為 |
|---|---|
| `--apply` | 已知零件寫入 `bom.children[組件ID]`（去重），並重建 `bom.parents` |
| `--auto` | `--apply` + 將未登錄組件 ID 自動收錄為新零件（category `組件圖候補`） |
| `--parent-of <PN>` | 反向識別：列出內文包含該品號的所有組件圖（可搭 `--apply` 寫入） |

---

## 4. 前端圖檔檔名比對規則（`src/utils/imageLibrary.ts`）

### 4.1 正規化與邊界

- `normalize(s)`：去除所有非 `A-Z0-9` 字元 + 轉大寫（符號一律忽略）。
- `isMatchedSegment(sNorm, pnNorm)`：
  - 相等 → 命中；
  - `sNorm` 以 `pnNorm` 開頭且**後續首字元不是數字** → 命中（`V1`、`RevA` 允許；`B0030`、`B0031` 拒絕 — 防止 B-003 誤吞 B-0030~B-0039）。

### 4.2 檔名 → 品號 前向比對（`findForCandidate` / `findAllForCandidate`）

1. 先比對**整個檔名**（去副檔名、去符號）。
2. 再以分隔符 `_`、空白、`()`、`[]`、`,`、`/` 拆成**片段**逐一比對（任一片段等於品號或符合邊界規則即命中）。

> 例：`R1-15853_03_mdx.pdf` → 片段 `R1-15853`、`03`、`mdx` → 命中 `R1-15853`。

### 4.3 多別稱比對（`matchFile` / `matchAllFiles`）

依 `[品號, ...別稱]` 逐一比對；`matchAll` 收集所有命中檔名並以檔名去重。

---

## 5. 圖檔解析優先序（`src/utils/imageResolver.ts` `resolveAllImages`）

```
① 檔名比對（via: file）      matchAll(品號 + 別稱)
② 手動綁定（via: binding）    localStorage pn_lookup_image_bindings（品號 → 檔名）
③ OCR 內文（via: ocr）       圖檔 OCR 文字（normalize 後）包含品號/別稱正規化
④ 本體推理（via: inference） 僅當①②③皆無結果：取「父組件圖面」作為推理來源
                             （relatedParts = usedInAssemblies）
```

- OCR 快取（IndexedDB）鍵 = **檔案名稱**（`ocrKeyForFile`）；舊複合鍵 `名稱|size|lastModified` 由 `normalizeCacheKey` 向後相容。

### 5.1 反向識別（`findParentProducts`，v7.8.4 新增）

「此品號可組成哪些產品」＝上層組件候選：

1. 掃描所有已辨識圖檔內文，找出**包含**目標品號（品號 + 別稱）的圖檔。
2. 依檔名**反查**圖檔所屬品號（與 §4 前向規則互逆：片段等於品號，或片段以品號開頭且後續首字元非數字；先查手動綁定反向索引）。
3. 彙整候選產品並**排除自身**（`owner === partNo`），僅供人工「加入 BOM 關聯」確認，不自動寫入。

---

## 6. BOM 引擎（`src/utils/bomEngine.ts`）

- **資料結構**：`childrenMap`（組件 → 子零件[]）與 `parentsMap`（子零件 → 組件[]）互為對稱推導（`computeParentsMap`）。
- **組件判定**（`isAssemblyPartNo`）：在 BOM 階層註冊過，或字首 `MDXE`。
- **唯一真源推導**（`enrichParts`）：`itemType` / `components` / `usedInAssemblies` 一律由 BOM 地圖即時產生（鍵比對支援大小寫）；落檔前 `stripDerivedFields` 移除。
- **關係展開**：
  - `getComponentsForAssembly`：自訂物料單（components 欄位）→ BOM 子零件遞迴（深度 ≤ 5，visited 防環）。
  - `getAssembliesForPart`：`usedInAssemblies` 顯式目標 → 父組件遞迴。
- **未登錄組件顯示**（v7.8.5）：父組件 ID 無法對應 master 品號時，仍以 `unregistered: true` 的佔位列回傳（「未登錄」灰階、不可點擊），欄位不無聲空白。

---

## 7. 資料流與儲存（`server.js` / localStorage / 靜態模式）

### 7.1 伺服器 API（Express，`npm run serve` → :3001）

| 端點 | 行為 |
|---|---|
| `GET /api/master` | 回傳 master.json（parts + bom） |
| `PUT /api/master` | 寫回 master.json（品號去重後原子寫入，另存時間戳備份） |
| `GET /api/bom` | 回傳 bom（children/parents） |
| `PUT /api/bom` | 更新 BOM（先移除舊關聯，再寫入新關聯） |
| `GET /api/parts` | 回傳 parts 清單 |
| `PUT /api/parts` | 全量覆寫 parts |

### 7.2 瀏覽器端儲存

| 鍵 | 內容 |
|---|---|
| `medical_parts_system_data_v2`（localStorage） | 品號主檔（衍生欄位已剝除） |
| `pn_lookup_image_bindings` | 手動圖檔綁定（品號 → 檔名） |
| `pn_lookup_dismissed_orphans` | 已排除孤兒圖檔 |
| `pn_lookup_image_folder_set` / `_dismissed` | 圖檔資料夾選擇 / 略過旗標 |
| IndexedDB `handles.image-folder` | 圖檔資料夾 FileSystemHandle 持久化 |
| IndexedDB OCR 快取 | 鍵 = 檔名 → OCR 內文 |

### 7.3 靜態模式（GitHub Pages）

- `IS_STATIC_MODE`：不呼叫 `/api/*`；載入時**清除** localStorage 殘留私密資料（零隱私數據上雲）。
- 雲端圖譜資料來自瀏覽器端 localStorage，無法由後端抓取 — 雲端為舊版 bundle 時僅為展示用途。

### 7.4 品號去重（v7.8.5，`partsService.dedupeParts`）

- 依 `partNo` 保留首筆；合併別稱（`dedupeAlternates`）並補齊缺漏欄位。
- 套用於三條路徑：localStorage 初始載入、伺服器載入、合併模式匯入（`[...匯入, ...既有]` 串接後去重）。

---

## 8. 驗證門禁與水平審計（verifyCoreLogic.js / 全品項稽核）

### 8.1 建置門禁（build 前自動執行）

11 項檢查：主庫總數 = 去重總數、種子轉譯去重、種子實體數、BOM 層組件數、前綴邊界防禦（B-003 / A01-200-111 等）、children/parents 100% 對稱、無循環、無自代料。
> 本機有私有資料檔時 100% 執行；CI 沙盒（資料檔被 gitignore 排除）自動跳過檔案依賴測試，保留純單元邏輯驗證。

### 8.2 水平審計方法（v7.8.6 全 693 品項；v7.8.7 擴及全 1004 品項）

對每一品號執行三層稽核：① BOM 完整性（parents 是否存在、能否解析為已登錄品號）；② 圖檔覆蓋率（依 §5 前向規則比對 rawdata/圖檔 全部 1514 檔）；③ 掃描一致性（組件圖內文已識別 vs BOM 連結）。

### 8.3 水平審計結論（2026-08-17）

| 稽核項 | 結果 | 判定 |
|---|---|---|
| 噪音過濾（標籤/說明書檔） | 9 行被丟棄，內文**全部僅含自身品號**（如 `PN-0005_Q09-380-331 包裝說明書`、`CL-0041_愷得外箱標籤貼紙`）→ 8 個潛在連結全為偽自連 | ✅ 丟棄正確，0 真實連結損失 |
| 無父連結的 5 品號（Q09-380-331、D10-318-271、D10-210-251-1、D10-240-251-1、E09-000-412-3） | 僅出現於自身圖面 + 標籤/說明書 | ✅ 成品（Top-Level）層級，屬正確資料 |
| 圖號註冊格式自身圖（SPC/C74，v7.8.5 新增內文候選回饋） | `SPC0014799_10_R1-2361`、`SPC0000349_01_R1-16529`、`SPC0000556_02_R1-16574`、`C74-49554-MC_05_C74-49554` 原被誤判為未登錄父鍵；其 `known` 內文候選（R1-2361 等）即檔案自身品號，檔名 = `<圖號>_<版次>_<品號>`，且無其他獨立圖檔 → 判定自身圖、連結自動消除 | ✅ 未解析父鍵 33 → 29 |
| 28 品號僅有未登錄組件 | 父組件皆未收錄於 Excel（如 R1-10260 ← R1-10356），UI 以灰階「未登錄」列顯示 | ✅ 符合設計，待人工收錄 |
| BD- 圖型前綴（非品號） | `BD-X3299AAM`/`BD-8003875` 剝除前綴後命中 master 品號 → 轉正為已登錄組件（X3299AAM、8003875）；`BD-X3299` 剝除後無此品號 → 排除（其圖面與 BD-X3299AAM 同 Rev.7 同內容，無損失） | ✅ 未解析父鍵 29 → 25 |
| 括號內品號優先（文件編號包裝） | `PFM-DWG-30125-01(126-006)_Rev.AB.pdf` → 括號內 `126-006` 即品號（文件編號 PFM-DWG-* 非品號）→ 126-006 轉正；`SC0022(Rev.F) (1).pdf` 的 `(1)` 為 Windows 重複檔編號 → 過濾 | ✅ 未解析父鍵 25 → 24 |
| SPC 圖號註冊文件（非品號，v7.8.5 舊規則） | `SPC0005450_04_RAW0000336`（SPC 規格編號 + RAW 原料圖號）→ 舊規則排除，R1-8112 不記該父鍵；**v7.8.14 修正**：圖號註冊格式整串檢測 `^SPC\d+_\d{1,3}_([A-Z0-9][A-Z0-9_.\-]*)$` → 尾段才是品號（SPC0005450 → RAW0000336） | ✅ 未解析父鍵 24（全部）→ RAW0000336 轉正 |
| 組件圖識別補登（scannedAssemblies） | 24 個組件品號（MDXE-* 8、R1-* 15、SC0044）補登進種子 `scannedAssemblies` 區塊 → buildMaster 合併 | ✅ **未解析父鍵 24 → 0、僅未登錄 28 → 0** |
| 198 品號無圖檔可對應 | 零件 136、物料 2（收縮膜）、SA組立 44、SB組立 14、SC組立 1、其他組件 1（如 SA0001、8003875、A01-210-111 等；2026-08-18 重算：master 963 對比圖檔 872 唯一品號） | ⚠️ 資料事實：僅存在於 Excel 種子，無實體圖檔 |
| 310 品號無 BOM 參與（無父無子） | 其中 25 筆亦無圖檔 | ⚠️ 資料事實：單品零件或未使用品項，非邏輯缺陷 |

> 結論：**映射邏輯本體經水平驗證正確**；2026-08-17 依人工領域知識補強規則（BD- 前綴、括號品號、SPC 文件編號排除）並補登 24 組件後，**未解析父鍵與未登錄組件皆歸零**。⚠️ 項為資料品質事實，不屬腳本缺陷。

---

## 9. 現況品質數據（2026-08-21 重建，v7.9.2：五分類 + ICU 導入 + 語意 BOM 白名單）

| 指標 | 數值 |
|---|---|
| master 品號總數 | **1027**（種子 669 + 圖檔提取 292 + ICU 導入 38 新增 + 2 收縮膜物料；v7.9.2 五分類重構） |
| BOM 組件數（bom.children 鍵數） | **209**（seed 181 全數保留 + 圖檔組件圖 28；v7.8.20 無表頭 BOM 版式判別 +17） |
| BOM 父子連結總數 | **603** |
| **五分類** | **原料 25** / **物料 137** / **零件 552** / **組件 181**（SA-95 SB-52 SC-25 SD-9 其他-18）/ **SET 114**（MDXE-91 MDXI-11 +12 手動） |
| ICU 原料料號對照表 | 167 筆（ICU-120、MDX-40、GVS-2、CardioMed-1、SIMS-1、Bard-1、RMS-1、PFM-1），129 覆蓋 + 38 新增 |
| 語意 BOM 白名單過濾 | 補缺 64→31（排除材質/模具號/尺寸雜訊 33 筆） |
| 品號格式排除 | PN_JUNK_RE（30+ 個材質/品名/尺寸雜訊）、PN_MOULDEX_RE（模具號）、PN_MANUAL_BLACKLIST（7 個誤讀品號） |
| 有組件（parents）的品號 | 全部可解析為已登錄組件 |
| 無法解析為 master 品號的父鍵 | **0** |
| 孤兒圖（檔名品號未登錄） | **0**（圖檔唯一檔名品號 872 零遺漏） |
| 去重管理（v7.8.10） | ① parts 層：`norm(partNo)` 為 key 去重；② 互為別名雙實體合併 40 組；③ BOM 鍵規範化 59 個別名 + 2 個別名組件鍵 |
| 圖檔提取數 | 1514（組件 268 / 零件 1107 / 物料 139；唯一檔名品號 872，master 命中 100%） |

> 範例：R1-15853（BREATHER CAP，ICU）可組成 9 個組件 — R1-10134 / R1-10149 / R1-10260 / R1-10278 / R1-10356 / R1-15933 / R1-15935 / R1-15936 / R1-15951，**全部已登錄**。

---

## 10. 常用指令速查

```bash
# 重建 master（種子 → master，重置掃描 BOM）
node scripts/buildMaster.js

# 解析 ICU 原料料號對照表 → data/icu-parts.json
node scripts/importICU.js

# 全量掃描組件圖 + 寫入 BOM
node scripts/scanAssemblyImages.js --all --apply

# 反向識別某品號可組成哪些產品
node scripts/scanAssemblyImages.js --parent-of "R1-15853"

# 自動收錄未登錄組件為新零件並建 BOM
node scripts/scanAssemblyImages.js --all --auto

# 品質驗證 + 建置
npm run lint        # tsc --noEmit
npm run build       # verifyCoreLogic 11 項 + vite build
npm run serve       # Express :3001（提供 /api/*，BOM 資料來源）
npm run dev         # Vite :3000（開發模式，無 /api/*）
```