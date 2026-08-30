import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const CACHE_PATH = resolve(ROOT, 'data/ocr_cache_141.json');
const ASSY_PATH = resolve(ROOT, 'data/assembly_drawings_extract.json');
const SET_PATH = resolve(ROOT, 'data/set_drawings_extract.json');
const OCR_JSON_OUT = resolve(ROOT, 'data/ocr_results_141.json');

// 正則表達式模式
const PN_TOKEN_RE = /\b(?:[A-Z]{1,4}\d{1,4}(?:-\d{1,4}){1,3}[A-Z0-9]?|[A-Z]{2,4}\d{4,7}|\d{1,2}[A-Z]\d{3,6}|\d{4,}(?:-\d+)*|\d{2,3}(?:-\d+){1,3}|B-\d{3}|0\.08[xX*]\d+(?:\.\d+)?mm?|0\.09[xX*]\d+(?:\.\d+)?mm?)\b/i;

const COLOR_KEYWORDS = [
  [/\bBLUE\s+TINT\b|透明藍/i, 'Blue Tint (透明藍)'],
  [/\bOPAQUE\s+BLUE\b|不透明藍/i, 'Opaque Blue (不透明藍)'],
  [/\bLIGHT\s+BLUE\b|淺藍/i, 'Light Blue (淺藍)'],
  [/\bDARK\s+BLUE\b|深藍/i, 'Dark Blue (深藍)'],
  [/\bOPAQUE\s+WHITE\b|不透明白/i, 'Opaque White (不透明白)'],
  [/\bOFF-WHITE\b|米白/i, 'Off-White (米白)'],
  [/\bWHITE\b|\bWHITE\s+PC\b|白/i, 'White (白)'],
  [/\bBLACK\b|黑/i, 'Black (黑)'],
  [/\bBLUE\b|\bBLUE\s+PC\b|藍/i, 'Blue (藍)'],
  [/\bRED\b|紅/i, 'Red (紅)'],
  [/\bGREEN\b|綠/i, 'Green (綠)'],
  [/\bCLEAR\b|透明|\bTRANS\b|\bTRANS[-_]?\d+/i, 'Clear / Transparent (透明)'],
  [/\bNATURAL\b|本色|原色/i, 'Natural (本色/原色)'],
  [/\bTRANSPARENT\b/i, 'Transparent (透明)'],
  [/\bYELLOW\b|黃/i, 'Yellow (黃)'],
];

async function runBatchOcr() {
  console.log("=== 啟動 141 筆掃描圖檔批次 OCR 與結構化萃取管線 ===");

  // 1. 載入掃描清單
  const assyData = JSON.parse(readFileSync(ASSY_PATH, 'utf-8'));
  const setData = JSON.parse(readFileSync(SET_PATH, 'utf-8'));

  const assyScanned = assyData.scannedList.map(x => ({ ...x, group: '組件' }));
  const setScanned = setData.scannedList.map(x => ({ ...x, group: 'SET' }));
  const allScanned = [...assyScanned, ...setScanned];
  console.log(`總計需要處理圖檔: ${allScanned.length} 筆 (組件 ${assyScanned.length} + SET ${setScanned.length})`);

  // 2. 載入快取
  let ocrCache = {};
  if (existsSync(CACHE_PATH)) {
    try {
      ocrCache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
      console.log(`已載入既有 OCR 快取: ${Object.keys(ocrCache).length} 筆`);
    } catch (e) {
      console.warn("快取讀取失敗，將建立新快取");
    }
  }

  // 3. 初始化 OCR 引擎
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createWorker } = await import('tesseract.js');
  const { createCanvas } = await import('@napi-rs/canvas');
  const wasmDir = resolve(ROOT, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/';

  const worker = await createWorker(['eng'], 1, {
    logger: () => {}
  });

  const ocrResults = [];
  const allOcrBomRows = [];

  for (let idx = 0; idx < allScanned.length; idx++) {
    const item = allScanned[idx];
    const fname = item.fileName;
    const fpath = item.filePath;
    const progressStr = `[${idx + 1}/${allScanned.length}]`;

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
        
        // 增量儲存快取
        if ((idx + 1) % 5 === 0 || idx + 1 === allScanned.length) {
          writeFileSync(CACHE_PATH, JSON.stringify(ocrCache, null, 2), 'utf-8');
        }
      } catch (err) {
        console.error(`\n  辨識出錯 [${fname}]: ${err.message}`);
        lines = [];
        ocrCache[fname] = lines;
      }
    }

    // 4. 解析 OCR 文本中的 BOM 與材質屬性
    const fullText = lines.join(' ');
    
    // (A) 提取材質
    let extractedMat = "";
    const mMat = fullText.match(/(?:MATERIAL|MATERIAL\s*:\s*|材質)[\.:\s]+([A-Z0-9\s\-_,\.]{3,40})/i);
    if (mMat) {
      extractedMat = mMat[1].trim();
      if (/TOLERANCES|FINISHED|SCALE|UNIT|REVISION/i.test(extractedMat)) extractedMat = "";
    }
    if (!extractedMat) {
      const matFind = fullText.match(/\b(PVC|DEHP\s*FREE|HDPE|PP|ABS|PC|SILICONE|RUBBER|7088G)\b/i);
      if (matFind) extractedMat = matFind[0];
    }

    // (B) 提取顏色
    let extractedColor = "";
    for (const [pat, cname] of COLOR_KEYWORDS) {
      if (pat.test(fullText)) {
        extractedColor = cname;
        break;
      }
    }

    // (C) 提取 BOM 子零件清單
    const bomItems = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 尋找包含品號的行
      const mPn = line.match(PN_TOKEN_RE);
      if (mPn) {
        const cpn = mPn[0];
        // 排除自身與圖紙關鍵字
        if (cpn.toUpperCase() !== item.partNo.toUpperCase() && cpn.length >= 4 && !/ISO|PAGE|SCALE|REVISION|DATE/i.test(cpn)) {
          let desc = line.replace(cpn, '').replace(/^[\|\s\-\[\],]+|[\|\s\-\[\],]+$/g, '').trim();
          let mat = "";
          if (!desc && i + 1 < lines.length) {
            desc = lines[i + 1].replace(/^[\|\s\-\[\],]+|[\|\s\-\[\],]+$/g, '').trim();
          }
          if (i + 2 < lines.length && /PVC|ABS|HDPE|PP|PC/i.test(lines[i + 2])) {
            mat = lines[i + 2];
          }

          bomItems.push({
            qty: '1',
            partNo: cpn,
            name: desc || cpn,
            material: mat,
            materialCode: ''
          });
        }
      }
    }

    // 去重
    const seenCpn = new Set();
    const cleanBoms = [];
    for (const b of bomItems) {
      const upn = b.partNo.toUpperCase();
      if (!seenCpn.has(upn) && upn !== item.partNo.toUpperCase()) {
        seenCpn.add(upn);
        cleanBoms.push(b);
        allOcrBomRows.push({
          fileName: fname,
          parentPartNo: item.partNo,
          group: item.group,
          qty: b.qty,
          childPartNo: b.partNo,
          childName: b.name,
          childMaterial: b.material
        });
      }
    }

    ocrResults.push({
      fileName: fname,
      partNo: item.partNo,
      group: item.group,
      folder: item.folder,
      linesCount: lines.length,
      extractedMaterial: extractedMat,
      extractedColor: extractedColor,
      bomDetails: cleanBoms,
      ocrLines: lines.slice(0, 15) // 前 15 行摘要
    });
  }

  process.stdout.write('\n');
  await worker.terminate();

  // 儲存總快取與結果 JSON
  writeFileSync(CACHE_PATH, JSON.stringify(ocrCache, null, 2), 'utf-8');
  writeFileSync(OCR_JSON_OUT, JSON.stringify({
    totalProcessed: ocrResults.length,
    totalBomRows: allOcrBomRows.length,
    results: ocrResults,
    bomRows: allOcrBomRows
  }, null, 2), 'utf-8');

  console.log(`\n=== OCR 批次處理完畢 ===`);
  console.log(`  - 成功辨識圖檔數: ${ocrResults.length} 筆`);
  console.log(`  - 萃取出文字行數 > 0: ${ocrResults.filter(r => r.linesCount > 0).length} 筆`);
  console.log(`  - 辨識出子零件清單行數: 共 ${allOcrBomRows.length} 行 BOM 明細`);
  console.log(`  - 產出 JSON 成果: ${OCR_JSON_OUT}`);
}

runBatchOcr().catch(console.error);
