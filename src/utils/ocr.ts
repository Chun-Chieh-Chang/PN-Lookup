// OCR 引擎：tesseract.js + pdf.js 動態載入（僅在需要時才下載），全部本機執行
import { idbGetAll, idbSet } from './idb';

type WorkerLike = {
  recognize(image: File | string): Promise<{ data: { text: string } }>;
};

let workerPromise: Promise<WorkerLike> | null = null;

function getWorker(): Promise<WorkerLike> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng');
      return worker;
    })();
  }
  return workerPromise;
}

async function ocrImage(input: File | string): Promise<string> {
  const worker = await getWorker();
  const { data } = await worker.recognize(input);
  return data.text || '';
}

async function ocrPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const doc = await loadingTask.promise;
  const pages = Math.min(doc.numPages, 3);
  let text = '';
  try {
    for (let i = 1; i <= pages; i++) {
      const page = await doc.getPage(i);
      
      // 1. 優先提取 PDF 原生文字層（極速，數毫秒內完成）
      try {
        const textContent = await page.getTextContent();
        const extractedText = textContent.items
          .map((item: any) => item.str || '')
          .join(' ')
          .trim();
        if (extractedText.length > 5) {
          text += extractedText + '\n';
          page.cleanup();
          continue;
        }
      } catch {
        /* 文字層提取失敗，降級執行 Canvas OCR 影像辨識 */
      }

      // 2. 掃描版 PDF 降級執行 Canvas + Tesseract.js 視覺 OCR 辨識
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvas, viewport }).promise;
      text += (await ocrImage(canvas.toDataURL('image/jpeg', 0.92))) + '\n';
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return text;
}

export function ocrKeyForFile(file: File): string {
  return `${file.name}|${file.size}|${file.lastModified}`;
}

export async function recognizeFile(file: File): Promise<string> {
  if (/\.pdf$/i.test(file.name)) return ocrPdf(file);
  return ocrImage(file);
}

export interface OcrEntry {
  key: string;
  text: string;
}

export async function loadOcrCache(): Promise<Map<string, string>> {
  const entries = await idbGetAll('ocr');
  const map = new Map<string, string>();
  for (const e of entries) map.set(e.key, String(e.value));
  return map;
}

export async function saveOcrText(key: string, text: string): Promise<void> {
  await idbSet('ocr', key, text);
}
