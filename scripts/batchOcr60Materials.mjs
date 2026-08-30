import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CACHE_PATH = resolve(ROOT, 'data/ocr_cache_material_60.json');
const MAT_PATH = resolve(ROOT, 'data/material_drawings_extract.json');
const OCR_JSON_OUT = resolve(ROOT, 'data/ocr_results_material_60.json');

const COLOR_KEYWORDS = [
    [/\b土黃色\b|\b牛皮色\b/i, 'Kraft (土黃色/牛皮色)'],
    [/\bBLUE\s*TINT\b|透明藍/i, 'Blue Tint (透明藍)'],
    [/\bOPAQUE\s*BLUE\b|不透明藍/i, 'Opaque Blue (不透明藍)'],
    [/\bWHITE\b|\b白色\b|白底/i, 'White (白)'],
    [/\bBLACK\b|\b黑色\b|黑字/i, 'Black (黑)'],
    [/\bRED\b|\b紅色\b/i, 'Red (紅)'],
    [/\bBLUE\b|\b藍色\b/i, 'Blue (藍)'],
    [/\bGREEN\b|\b綠色\b/i, 'Green (綠)'],
    [/\bYELLOW\b|\b黃色\b/i, 'Yellow (黃)'],
    [/\bCLEAR\b|\bTRANSPARENT\b|透明/i, 'Clear / Transparent (透明)'],
    [/\b印刷\b|\b彩色\b/i, 'Printed (印刷彩色)'],
];

async function runMaterialOcr() {
  console.log("=== 啟動 60 筆物料掃描圖檔批次 OCR 與結構化萃取管線 ===");

  const matData = JSON.parse(readFileSync(MAT_PATH, 'utf-8'));
  const scannedList = matData.scannedList || [];
  console.log(`待處理掃描圖檔: ${scannedList.length} 筆`);

  let ocrCache = {};
  if (existsSync(CACHE_PATH)) {
    try {
      ocrCache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
      console.log(`已載入既有 OCR 快取: ${Object.keys(ocrCache).length} 筆`);
    } catch (e) {
      console.warn("快取讀取失敗，建立新快取");
    }
  }

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createWorker } = await import('tesseract.js');
  const { createCanvas } = await import('@napi-rs/canvas');
  const wasmDir = resolve(ROOT, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/';

  const worker = await createWorker(['eng'], 1, {
    logger: () => {}
  });

  const ocrResults = [];
  const ocrBomRows = [];

  for (let idx = 0; idx < scannedList.length; idx++) {
    const item = scannedList[idx];
    const fname = item.fileName;
    const fpath = item.filePath;
    const progressStr = `[${idx + 1}/${scannedList.length}]`;

    let lines = [];
    if (ocrCache[fname]) {
      lines = ocrCache[fname];
      process.stdout.write(`\r${progressStr} 快取命中: ${fname.padEnd(35)} (共 ${lines.length} 行) `);
    } else {
      process.stdout.write(`\r${progressStr} OCR 辨識中: ${fname.padEnd(35)} `);
      try {
        const data = new Uint8Array(readFileSync(fpath).buffer);
        const doc = await pdfjs.getDocument({ data, wasmUrl: wasmDir, useSystemFonts: true }).promise;
        const page = await doc.getPage(1);
        const viewport = page.getViewport({ scale: 2 });
        const cv = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
        const ctx = cv.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;

        const { data: ocrRes } = await worker.recognize(cv.toBuffer('image/png'));
        lines = ocrRes.text.split('\n').map(l => l.trim()).filter(Boolean);
        ocrCache[fname] = lines;

        if ((idx + 1) % 5 === 0 || idx + 1 === scannedList.length) {
          writeFileSync(CACHE_PATH, JSON.stringify(ocrCache, null, 2), 'utf-8');
        }
      } catch (err) {
        console.error(`\n  辨識出錯 [${fname}]: ${err.message}`);
        lines = [];
        ocrCache[fname] = lines;
      }
    }

    const fullText = lines.join(' ');

    // 1. 提取材質
    let extractedMat = "";
    const mMat = fullText.match(/(?:MATERIAL|MATERIAL\s*:\s*|材質)[\.:\s]+([A-Z0-9\u4e00-\u9fa5\s\-_,\.]{2,40})/i);
    if (mMat) {
      extractedMat = mMat[1].trim();
      if (/TOLERANCES|FINISHED|SCALE|UNIT|REVISION/i.test(extractedMat)) extractedMat = "";
    }
    if (!extractedMat) {
      const matFind = fullText.match(/\b(PE|PET|PVC|TYVEK|KRAFT|COPPER\s*PLATE|CORRUGATED)\b/i);
      if (matFind) extractedMat = matFind[0];
    }

    // 2. 提取顏色
    let extractedColor = "";
    for (const [pat, cname] of COLOR_KEYWORDS) {
      if (pat.test(fullText)) {
        extractedColor = cname;
        break;
      }
    }

    // 3. 提取關聯組成子件
    const bomItems = [];
    const bMatches = fullText.match(/\b(CTN\d{3}|ICL-\d{4}|CL-\d{4}|PL-\d{4}|SF\d{3}|PE\d{3}|0\.08[xX*]\d+mm)\b/gi) || [];
    const seenB = new Set();
    for (const bm of bMatches) {
      const ubm = bm.toUpperCase();
      if (ubm !== item.partNo.toUpperCase() && !seenB.has(ubm)) {
        seenB.add(ubm);
        bomItems.push({
          qty: '1',
          partNo: ubm,
          name: ubm,
          material: '包裝物料',
          materialCode: ''
        });
        ocrBomRows.push({
          fileName: fname,
          parentPartNo: item.partNo,
          qty: '1',
          childPartNo: ubm,
          childName: ubm,
          childMaterial: '包裝物料'
        });
      }
    }

    ocrResults.push({
      fileName: fname,
      partNo: item.partNo,
      folder: item.folder,
      linesCount: lines.length,
      extractedMaterial: extractedMat,
      extractedColor: extractedColor,
      bomDetails: bomItems,
      ocrLines: lines.slice(0, 15)
    });
  }

  process.stdout.write('\n');
  await worker.terminate();

  writeFileSync(CACHE_PATH, JSON.stringify(ocrCache, null, 2), 'utf-8');
  writeFileSync(OCR_JSON_OUT, JSON.stringify({
    totalProcessed: ocrResults.length,
    bomRowsCount: ocrBomRows.length,
    results: ocrResults,
    bomRows: ocrBomRows
  }, null, 2), 'utf-8');

  console.log(`\n=== 60 筆物料圖檔 OCR 辨識完成 ===`);
  console.log(`  - 成功辨識圖檔數: ${ocrResults.length} 筆`);
  console.log(`  - 文字行數 > 0:   ${ocrResults.filter(r => r.linesCount > 0).length} 筆`);
  console.log(`  - 辨識出組成物料行數: 共 ${ocrBomRows.length} 行`);
  console.log(`  - 產出 JSON 檔案: ${OCR_JSON_OUT}`);
}

runMaterialOcr().catch(console.error);
