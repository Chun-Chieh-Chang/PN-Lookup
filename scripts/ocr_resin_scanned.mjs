import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const RESIN_DIR = resolve(ROOT, 'rawdata/Drawings/原料');
const OCR_OUT = resolve(ROOT, 'data/ocr_results_resin_2.json');

const files = ['75-2117_1.pdf', 'R1-1176_2.pdf'];

async function runResinOcr() {
  console.log("=== 啟動 2 筆原料掃描圖檔 OCR 辨識 ===");
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { createWorker } = await import('tesseract.js');
  const { createCanvas } = await import('@napi-rs/canvas');
  const wasmDir = resolve(ROOT, 'node_modules/pdfjs-dist/wasm').replace(/\\/g, '/') + '/';

  const worker = await createWorker(['eng'], 1, {
    logger: () => {}
  });

  const results = [];

  for (const fname of files) {
    const fpath = resolve(RESIN_DIR, fname);
    if (!existsSync(fpath)) {
      console.log(`檔案不存在: ${fname}`);
      continue;
    }
    console.log(`正在 OCR 辨識: ${fname}...`);
    try {
      const data = new Uint8Array(readFileSync(fpath).buffer);
      const doc = await pdfjs.getDocument({ data, wasmUrl: wasmDir, useSystemFonts: true }).promise;
      const page = await doc.getPage(1);
      const viewport = page.getViewport({ scale: 2 });
      const cv = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      const ctx = cv.getContext('2d');
      await page.render({ canvasContext: ctx, viewport }).promise;

      const { data: ocrRes } = await worker.recognize(cv.toBuffer('image/png'));
      const lines = ocrRes.text.split('\n').map(l => l.trim()).filter(Boolean);
      console.log(`  - ${fname}: 辨識完成，行數 = ${lines.length}`);

      results.push({
        fileName: fname,
        linesCount: lines.length,
        textLines: lines.slice(0, 20)
      });
    } catch (err) {
      console.error(`  - 辨識失敗 [${fname}]: ${err.message}`);
    }
  }

  await worker.terminate();
  writeFileSync(OCR_OUT, JSON.stringify({ total: results.length, results }, null, 2), 'utf-8');
  console.log(`OCR 辨識完成，產出: ${OCR_OUT}`);
}

runResinOcr().catch(console.error);
