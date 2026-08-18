# PN-Lookup 品號 ↔ 圖檔 ↔ BOM 完整映射邏輯

> 版本：v7.8.7 ｜ 最後整理：2026-08-17
> 本文從資料源頭開始，完整說明「品號資料庫（master）」、「圖檔」、「BOM 階層」三者之間的所有映射規則與資料流，作為日後維護與除錯的單一參考文件。

---

## 0. 總覽（資料流一覽）

```
rawdata/圖檔（1514 張，品號第一事實來源）
        │  scanAssemblyImages.js --extract（角色化提取：組件/零件/物料）
        ▼
data/drawings-extract.json（filePartNo + titleBlock 欄位 + bomLinks）
        │                rawdata/master_table_unified.json（種子：4 張來源表 + BOM 階層 + scannedAssemblies + pnAliases）
        │                │  buildMaster.js（mergeDrawingsIntoMaster：圖檔優先、seed 補欄位）
        │                ▼
        └───────────► data/pn-lookup-master.json（唯一真源：parts + bom.children/parents）
                        │  server.js API 或 瀏覽器匯入
                        ▼
                前端：localStorage(parts) + bomEngine(children/parents 地圖) + imageLibrary(圖檔)
                        │  resolveAllImages（四級解析）
                        ▼
                PartDetailModal：圖檔顯示 + 「本零件可組成的組件」
```

> v7.8.7 管線反轉：圖檔品號提取為第一事實來源（孤兒圖歸零），種子檔（產品一覽表.xlsm 轉譯）負責補欄位（品名/客戶/材料）與 BOM 階層基底，兩者經 `mergeDrawingsIntoMaster` 合併為唯一真源。目前 master：**1004 品號 / 308 組 BOM / 674 連結**。

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
- **產出**：`bom.children`（組件 → 子零件陣列）+ `bom.parents`（子零件 → 組件陣列，對稱推導）。

### 2.2 唯一真源原則

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
| SPC 圖號註冊文件（非品號） | `SPC0005450_04_RAW0000336`（SPC 規格編號 + RAW 原料圖號）→ 排除，R1-8112 不記該父鍵 | ✅ 未解析父鍵 24（全部） |
| 組件圖識別補登（scannedAssemblies） | 24 個組件品號（MDXE-* 8、R1-* 15、SC0044）補登進種子 `scannedAssemblies` 區塊 → buildMaster 合併 | ✅ **未解析父鍵 24 → 0、僅未登錄 28 → 0** |
| 92 品號無圖檔可對應 | SA組立 44、單品零件 33、SB組立 14、SC組立 1（如 SA0001、8003875） | ⚠️ 資料事實：僅存在於 Excel 種子，無實體圖檔 |
| 310 品號無 BOM 參與（無父無子） | 其中 25 筆亦無圖檔 | ⚠️ 資料事實：單品零件或未使用品項，非邏輯缺陷 |

> 結論：**映射邏輯本體經水平驗證正確**；2026-08-17 依人工領域知識補強規則（BD- 前綴、括號品號、SPC 文件編號排除）並補登 24 組件後，**未解析父鍵與未登錄組件皆歸零**。⚠️ 項為資料品質事實，不屬腳本缺陷。

---

## 9. 現況品質數據（2026-08-18 重建，v7.8.8：Excel BOM 交叉驗證 + 客戶欄位補齊）

| 指標 | 數值 |
|---|---|
| master 品號總數 | **962**（種子 667 + 圖檔提取 292；種子 667 = 693 + scannedAssemblies 24 − 8 筆 MDXE 尾綴版次合併 − 2 筆收縮膜尺寸雜訊 − **40 筆互為別名雙實體合併**） |
| BOM 組件數（bom.children 鍵數） | **192**（seed 181 全數保留 + 圖檔組件圖 11；v7.8.11 移除規格書/零件圖誤判的偽組件 65 個） |
| BOM 父子連結總數 | **452**（v7.8.11 移除規格書（Supplier Acceptance Letter）與零件圖行尾品號誤建的雜訊連結） |
| 有組件（parents）的品號 | 全部可解析為已登錄組件 |
| 無法解析為 master 品號的父鍵 | **0**（v7.8.5 修復前為 51.3%） |
| 孤兒圖（檔名品號未登錄） | **0**（圖檔 907 唯一品號零遺漏；僅 7 張無品號圖：ICU原料料號對照表 + 6 張 XXXX 占位符，正確排除） |
| **去重管理（v7.8.10）** | ① parts 層：`norm(partNo)` 為 key 去重，後到寫法存 alternates；② **互為別名雙實體合併**：新品號命中既有 part 的別稱（或反向）→ 併入單一實體（E13-999-421 ⇄ R1-8112 等 40 組，合併後圖檔 907 品號零遺漏）；③ **BOM 鍵規範化**：children/parents 鍵統一解析為規範品號（59 個別名寫法引用 + 2 個別名組件鍵全數歸位），消除「同一品號兩種寫法分裂」 |
| **角色判定（v7.8.11）** | 圖檔角色依**內文證據**而非目錄：物料資料夾 → 物料；`KEY UNIT` 表頭（多空格容錯）→ 組件；`PART NO` + `QTY/ITEM` → 組件；`ASSY/組立` + 子件候選 ≥ 3 → 組件；其餘 → 零件（修正 v7.8.10 目錄規則把客戶/綜合圖面零件圖全歸組件的瑕疵，147 個「組件圖候補」→ 6 個且全有 BOM；R1-15197/R1-15198 等 ICU 規格書誤建之 E13-999-421 連結全數清除，E13-999-421 可組裝目標 26 → **13（全為 KEY UNIT 組件圖）**） |
| 內文欄位 vs 檔名品號不一致 | 26 張已於 2026-08-17 逐張人工核對：**全部以檔名品號為準**（SPC/RAW/CIV 系列欄位取到規格編號、R1-10356 取到原料 Commodity 編號、R1-8391 為版本連寫、D09-350-211-1 之 FILE NO. 欄為檔案編號筆誤）；欄位提取自動化後僅剩 0 未解案例 |
| Excel BOM vs 圖檔 BOM 交叉驗證（v7.8.8） | 一致 47 / 不一致 70；**整合策略（使用者確認）：圖檔為主** — 組件有圖檔 BOM 時以圖檔展開粒度取代 Excel children（SB0001 = B06-410-111-1 + B-077，取代 Excel SA0001 + 0.08*14mm）；SB0055/SB0083 等 7 組逐張核對為粒度差異無衝突（SA0158 = [G13-001-122, E13-999-421] 展開吻合）；版次差異以圖面為準（SA0002 → H00-111-111-4）；Excel 雜訊（0.08*14mm 收縮膜尺寸）不進 BOM |
| 客戶資訊（v7.8.8 補齊） | 品號掛客戶 **564 / 1002**（Excel 三表有客戶者零漏掛）；**模具號碼 419** / **穴數 414**；剩餘 438 無客戶為圖檔優先收錄品號，Excel 無此資料 |
| 無 BOM 參與的品號 | 515（含取代後失去引用的 Excel 概念組件 SA0001 等，資料事實） |
| 圖檔提取數 | 1514（組件 1085 / 零件 290 / 物料 139；唯一檔名品號 903） |

> 範例：R1-15853（BREATHER CAP，ICU）可組成 9 個組件 — R1-10134 / R1-10149 / R1-10260 / R1-10278 / R1-10356 / R1-15933 / R1-15935 / R1-15936 / R1-15951，**全部已登錄**。

---

## 10. 常用指令速查

```bash
# 重建 master（種子 → master，重置掃描 BOM）
node scripts/buildMaster.js

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