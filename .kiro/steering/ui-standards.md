# UI/UX 介面設計規範

> **真源 (Source of Truth)**：本文件為 Kiro 編輯器導向之速查版。AI 行為規則以 `.agents/AGENTS.md` 為唯一真源（`RULE[ui_minimum_font_size]`、`RULE[regression_defense_and_logic_freezing]` 等）；本文件僅速查引用，不另立規則，避免重複與分歧。
>
> **深色背景例外**：下方「顏色系統」禁止深色容器僅適用於淺色主介面；`ProductMindMap3DModal`（3D 空間畫布）與 `PartDetailModal` 之組件 badge（bg-slate-900）為深色畫布/強調元件，屬既定例外。

## 文字最小尺寸規則

**所有 UI/UX 介面的文字不得小於 13px。**

- Tailwind 類別 `text-xs`（12px）只能用於非顯示性文字（如工具提示 `title` 屬性），介面上可見的任何文字皆不適用。
- 允許的最小類別：`text-[13px]` 或 `text-sm`（14px）以上。
- 禁止使用的類別（介面可見文字）：`text-[7px]`、`text-[8px]`、`text-[9px]`、`text-[9.5px]`、`text-[10px]`、`text-[10.5px]`、`text-[11px]`、`text-[11.5px]`、`text-[12px]`、`text-xs`（12px）。
- 亦禁止在 inline `style` 中使用 `fontSize` 小於 13 的數值（如 `fontSize: 9`、`fontSize: 11`）。

## 字體層次配比

設計語言使用以下四層字體，由小到大：

| 層次 | Class | 用途 |
|------|-------|------|
| 最小輔助文字 | `text-[13px]` | badge、副標籤、說明文字、toolbar 小字 |
| 標準正文 | `text-sm`（14px） | 表格內容、form 欄位、按鈕文字 |
| 強調標題 | `text-base`（16px） | 卡片主標題、數值顯示 |
| 頁面標題 | `text-xl` / `text-lg` | Header 主標題 |

## 顏色系統

- 主色調為淺色模式（Light mode），全專案統一。
- 文字色使用 `slate-xxx` 系列，不混用 `gray-xxx`。
- 禁止在淺色模式頁面使用深色背景（`bg-slate-800`、`bg-slate-900`、`bg-slate-950` 等）作為主要容器背景。

## 間距與圓角

- 按鈕圓角統一使用 `rounded-lg` 或 `rounded-xl`，禁止裸用 `rounded`（4px）。
- Action 按鈕組內所有按鈕圓角需一致。

## Badge / Tag

- 品號 tag 統一使用 `rounded-lg`。
- `font-weight` 在同一排按鈕組內統一為 `font-semibold`。

---

## PowerShell 文字處理規則（開發工具規範）

**禁止用 PowerShell 的 `-replace` 或 `Set-Content` 批次修改包含中文字符的 `.tsx` / `.ts` / `.md` 原始碼檔案。**

原因：PowerShell 預設使用系統編碼（BIG5/CP950），`Get-Content` + `-replace` + `Set-Content` 組合會將 UTF-8 中文字符轉成亂碼，造成 JSX/TypeScript 編譯失敗。

**正確做法：**

1. **優先使用 `str_replace` 工具**（Kiro 內建）精確替換，完全不涉及 shell 編碼問題。
2. 若必須用 PowerShell 處理文字，**必須**加上 `-Encoding UTF8` 參數：
   ```powershell
   # 正確
   $c = Get-Content $path -Raw -Encoding UTF8
   Set-Content $path $c -Encoding UTF8 -NoNewline
   
   # 錯誤（會破壞中文）
   $c = Get-Content $path -Raw
   Set-Content $path $c
   ```
3. PowerShell `-replace` 僅適用於**純 ASCII 字串**的替換（如 Tailwind class 名稱），替換目標和內容中**不得包含任何中文字符**。
4. 修改後必須立即執行 `npm run build` 或 `get_diagnostics` 確認無編譯錯誤，有錯誤立即用 `git checkout HEAD -- <file>` 還原。
