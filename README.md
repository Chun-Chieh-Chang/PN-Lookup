# PN-Lookup — 品號檢索系統

醫療配件品號檢索、圖檔超連結、BOM 階層瀏覽與客戶料號三碼互換匯入工具。

## 功能

- 品號即時檢索（支援搜尋品號、品名、客戶名、替代品號）
- 圖檔資料夾掃描 + 檔名自動比對 + OCR 內容辨識（瀏覽器內執行、檔案不上傳）
- 手動圖檔綁定（localStorage 持久化）
- BOM 階層瀏覽：組件 ↔ 零件關係即時推導
- 替代品號（alternates）：前後台均可設定，圖檔比對一併查詢
- 客戶料號工作表批次匯入（圖面編號 / 產品編號 / 零件編號 三碼互換）
- 完整備份匯出／匯入（xlsx / csv / json 自選格式）
- 後台管理（#admin）：品號／客戶／BOM 階層維護

## 快速開始

```bash
npm install
npm run dev           # 開發模式（本機伺服器 + API）
npm run build         # 產出 dist/
npm run serve         # 產出後以 Express 啟動伺服器（localhost:3001）
npm run start         # build + serve 一鍵啟動
```

## 部署

- **GitHub Pages（靜態）**：`VITE_STATIC_ONLY=true` 打包，品號走 localStorage，BOM 走空殼 fallback
- **本機伺服器模式**：`npm run start`，品號與 BOM 從 `data/master.json` 讀寫

## 授權

專用內部工具，未经授权不得外传。