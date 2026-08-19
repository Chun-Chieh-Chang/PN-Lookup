# v7.9.1 圖檔語意識別全量批次 — 執行狀態報告

> 產生時間：2026-08-19（批次啟動後）
> 用途：額度中斷/交接時，接手者可依此續行。

## 任務目標
對全部 1514 張工程圖執行語意識別（品號/品名規格/圖號/原料/BOM；掃描檔自動 OCR），
語意結果合併進 master（補缺 description/dwgNo/material + 語意 BOM 子件），前端明細卡已支援顯示。

## 目前運作中的程序（背景）
| PID | 工作 | 說明 |
|---|---|---|
| 13980 | `node scripts/semanticExtract.js --all --batch=6` | 全量批次（續跑模式，跳過已完成的 22 張樣本） |
| 11584 | `node scripts/batchWatcher.mjs` | 監看批次完成 → 自動 buildMaster → verify → build → 升版 → commit+push |

- 批次輸出：`data/batch-run.log`（每張圖一行，尾部監看 `Get-Content data\batch-run.log -Tail 10`）
- watcher 輸出：`data/batch-watcher.log`、`data/batch-watcher.out.log`、狀態 `data/batch-watcher.state.json`
- 完成標記：`data/batch-done.flag`（存在即代表後續流程已執行）
- 語意結果：`data/semantic-extract.json`（全部結果）＋ `data/semantic-extract.xlsx`（圖檔解析總表/BOM明細）

## 已完成
1. **v7.9.0 已交付**（commit `84e553d`，已 push）：多模型分工（laguna-s-2.1-free 標題欄 + hy3-free BOM，互為 fallback）、OCR fallback（tesseract psm3 scale5）、檔名品號修正、JSON+Excel 雙檔、master 補缺（material 7/name 4/dwgNo 15/description 16/BOM 子件 8）、前端 Description/DWG NO. 顯示。
2. **SB0001 專屬處理**：KEY/UNIT 拆行偵測（y≤60）+ 品號行規則 BOM 兜底 → B06-410-111-1 + B-077×8 + 0.08*14mm（收縮膜）✓。
3. **dwgNo 人工真值修正**（使用者逐張確認，已寫入 semantic-extract.json 並標 manualFix）：
   - MDXE-153-02_E.pdf：MDEX-153-02（模型幻覺）→ **MDXE-153-02**
   - BD-8013945_Rev.1.pdf：4704.24.00 → **404028**（圖號欄人工辨識）
   - R1-10134-MC_08_mdx.pdf：R1-10134-MC → **R1-10134**（Drawing No. 欄不帶 -MC）
4. 其他 dwgNo 維持圖面原樣（使用者確認為真值）：403801（BD-8003875 Document Number）、135-015（VLV-135-015）、9X.20860.002、SPC0005450、4704.24.00 已覆寫。
5. D10-240-251-1/-2 並存（使用者確認，兩圖檔都在，不需註記）。

## 待辦（批次完成後由 watcher 自動執行）
1. `node scripts/buildMaster.js`（語意合併 → master 預估 ~980+ 筆）
2. `node scripts/verifyCoreLogic.js`（全 PASS 才算完成）
3. `npm run build`（前端含新欄位）
4. `src/version.ts` 升版 v7.9.1
5. `git commit + push`
6. 完成標記寫入 `data/batch-done.flag`

若 watcher 未啟動或失敗，接手者手動執行上述 1-5。

## 接手續跑指引
- 批次中途死掉：重跑 `cmd /c "start /b node scripts/semanticExtract.js --all --batch=6 > data\batch-run.log 2>&1"`（續跑模式自動跳過已完成）。
- 批次完成但 watcher 沒動：執行 `node scripts/batchWatcher.mjs`（會偵測完成標記直接跑後續）。
- 修正/重跑特定圖：`node scripts/semanticExtract.js --match=<檔名子串> --force`（合併模式，不覆寫其他結果）。
- 檢查進度：`Get-Content data\batch-run.log -Tail 10`、`node -e "const d=require('./data/semantic-extract.json'); console.log(d.items.filter(i=>i.ok).length+'/'+d.items.length)"`。

## 驗收標準（使用者定義）
- 全量 1514 張解析完成；品號與檔名吻合率 ≥90%；BOM 吻合率 ≥90%（對照既有 bomLinks）。
- master 重建後 verify 全 PASS、build 無錯誤；JSON+Excel 雙檔輸出。

## 待確認問題清單（使用者說最後逐筆確認 — 尚未問）
1. ~~中文描述亂碼~~ — **已定案：使用者選 A 接受（英文資訊完整）**，亂碼圖不另處理。
2. 全量批次後的新品號發現（如 22-69xxxx 系列）是否逐筆確認收錄 — 22-69xxxx 已確認收錄；批次後若有新的再列。
3. SB0001 BOM 規則兜底是否正式納入常規（現為 fallback 性質）。
4. 中文圖（9X 包裝袋、ICU 外箱標籤、ICU 對照表）是否補人工品名。
5. 語意 BOM 與圖檔提取器 bomLinks 的雙源合併規則（現語意僅補缺，不衝突）。
