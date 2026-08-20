# v7.9.1 圖檔語意識別全量批次 — 執行狀態報告

> **最終狀態：✅ 已完成並交付（2026-08-20）**
> 全量批次完成 → 語意 1492 筆成功 → master 994 → verify 100% → build SUCCESS → 已 commit+push（`b125d6c`、`88bef87`）。

## 最終成果
| 項目 | 數值 |
|---|---|
| 語意解析 | 1492 筆成功（OCR 360 / 文字層 1132）|
| 語意補缺 | material 212 / name 247 / dwgNo 741 / description 797 |
| 語意 BOM 新品號 | 31（含 22-69xxxx ×6、CP96020、R1 系列、H 系列）|
| master | 971 → **994**（零件 681 / SA 95 / SB 52 / SC 25 / SD 9 / 其他組件 28 / 物料 137）|
| 組件鍵 | 209（不變）|
| 驗證 | verify 100% PASS / npm run build SUCCESS |
| 輸出檔 | data/semantic-extract.json（1492 筆）+ data/semantic-extract.xlsx |

## 關鍵工程決策紀錄
1. **供應商切換**：zen 免費（laguna+hy3）配額當日耗盡（全 429）→ agnes-2.0-flash 主跑（無限流）。agnes 品質缺陷由「檔名品號修正 + 規則 BOM 兜底」補。
2. **品號白名單**：agnes BOM 提取雜訊多 → 補缺僅收有效格式（64 → 31），排除材質/模具號/尺寸/色號。
3. **批次工程**：checkpoint 每 20 張、--retry-failed 循環、OCR 超時保護、agnes fetch 超時、batchWatcher 異常即退出。
4. **SB0001 規則兜底**：拆行 KEY/UNIT + 品號行掃描。
5. **dwgNo 人工真值 3 筆**：MDXE-153-02、404028、R1-10134。

## 待確認清單（使用者逐筆確認）
1. 語意 BOM 新品號疑似誤讀：BO6-410-311-1（B06?）、HO0/HOO/HOO0-111-…（H00 誤讀）、A01-210-131、E13-999-421-5。
2. SB0001 規則正式化。
3. zen 配額恢復後是否 laguna+hy3 全量重跑強化（agnes 品質較差）。
4. 中文圖人工品名。

## 接手指引（若需重跑/續跑）
- 重跑全部：`node scripts/semanticExtract.js --all --provider=agnes --batch=6`（續跑自動跳過已完成）。
- 補跑失敗：`node scripts/semanticExtract.js --retry-failed --provider=agnes`。
- zen 強化：`node scripts/semanticExtract.js --all --force`（laguna+hy3 分工，需配額恢復）。
- 重建 master：`node scripts/buildMaster.js` → `node scripts/verifyCoreLogic.js` → `npm run build`。
