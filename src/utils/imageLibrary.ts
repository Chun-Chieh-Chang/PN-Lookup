const IS_MEDIA = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|pdf)$/i;
const FLAG_SET = 'pn_lookup_image_folder_set';
const FLAG_DISMISSED = 'pn_lookup_image_folder_dismissed';

export interface ImageLibrary {
  folderName: string;
  count: number;
  fileNames: string[];
  fileFor(fileName: string): File | null;
  /** 檔名比對：回傳首個命中的檔名 */
  match(partNo: string, aliases?: string[]): string | null;
  /** 檔名比對：回傳所有命中的檔名列表 */
  matchAll(partNo: string, aliases?: string[]): string[];
  /** 依檔名取得 object URL（快取） */
  urlForFile(fileName: string): string | null;
  debug: {
    totalFiles: number;
    sampleNames: string[];
  };
}

// ---------- 資料夾 handle 持久化（IndexedDB） ----------
import { idbGet, idbSet } from './idb';

async function idbSaveHandle(handle: unknown): Promise<void> {
  await idbSet('handles', 'image-folder', handle);
}

async function idbLoadHandle(): Promise<unknown> {
  return idbGet('handles', 'image-folder');
}

// ---------- 遍歷子資料夾收集圖檔 ----------
async function collectFromDir(dir: FileSystemDirectoryHandle, out: File[], stats: { totalFiles: number }): Promise<void> {
  const iterable = dir.entries() as unknown as AsyncIterableIterator<[string, FileSystemHandle]>;
  for await (const [, handle] of iterable) {
    if (handle.kind === 'directory') {
      await collectFromDir(handle as FileSystemDirectoryHandle, out, stats);
    } else {
      stats.totalFiles += 1;
      if (IS_MEDIA.test(handle.name)) {
        try {
          out.push(await (handle as FileSystemFileHandle).getFile());
        } catch { /* 檔案無法讀取時略過 */ }
      }
    }
  }
}

// ---------- 品號 → 圖檔配對 ----------
// 檔名常見命名：「品號_版本_品號別稱」或「品號別稱_版本_品號」（底線分隔）
// 策略：整個檔名先比對，再拆成片段比對（任一片段等於品號即命中），符號一律忽略
const NORM_RE = /[^A-Z0-9]+/gi;

export function normalize(s: string): string {
  return s.replace(NORM_RE, '').toUpperCase();
}

function isMatchedSegment(sNorm: string, pnNorm: string): boolean {
  if (!sNorm || !pnNorm) return false;
  if (sNorm === pnNorm) return true;
  // 長度大於 pnNorm 且開頭為 pnNorm 時，必須確保後續第一個字元不是數字 (例如 V1, RevA 允許，但 B0030, B0031 拒絕)
  if (sNorm.length > pnNorm.length && sNorm.startsWith(pnNorm)) {
    const nextChar = sNorm[pnNorm.length];
    if (nextChar < '0' || nextChar > '9') {
      return true;
    }
  }
  return false;
}

function findForCandidate(files: File[], candidate: string): File | null {
  const pn = candidate.trim().toUpperCase();
  if (!pn) return null;
  const pnNorm = normalize(pn);
  if (pnNorm.length < 3) return null;

  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '').toUpperCase();
    const baseNorm = normalize(base);

    if (base === pn || baseNorm === pnNorm || isMatchedSegment(baseNorm, pnNorm)) return f;

    const segs = base.split(/[_\s()\[\],/]+/i);
    for (const s of segs) {
      const sNorm = normalize(s);
      if (isMatchedSegment(sNorm, pnNorm)) return f;
    }
  }
  return null;
}

function findAllForCandidate(files: File[], candidate: string): File[] {
  const pn = candidate.trim().toUpperCase();
  if (!pn) return [];
  const pnNorm = normalize(pn);
  if (pnNorm.length < 3) return [];
  const result: File[] = [];

  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '').toUpperCase();
    const baseNorm = normalize(base);

    if (base === pn || baseNorm === pnNorm || isMatchedSegment(baseNorm, pnNorm)) {
      result.push(f);
      continue;
    }

    const segs = base.split(/[_\s()\[\],/]+/i);
    for (const s of segs) {
      const sNorm = normalize(s);
      if (isMatchedSegment(sNorm, pnNorm)) {
        result.push(f);
        break;
      }
    }
  }
  return result;
}

// 依品號及其替代品號逐一比對
function matchFile(files: File[], partNo: string, aliases?: string[]): File | null {
  for (const c of [partNo, ...(aliases ?? [])]) {
    const hit = findForCandidate(files, c);
    if (hit) return hit;
  }
  return null;
}

function matchAllFiles(files: File[], partNo: string, aliases?: string[]): File[] {
  const fileMap = new Map<string, File>();
  for (const c of [partNo, ...(aliases ?? [])]) {
    const hits = findAllForCandidate(files, c);
    for (const h of hits) {
      fileMap.set(h.name, h);
    }
  }
  return Array.from(fileMap.values());
}

function buildLibrary(files: File[], folderName: string, totalFiles: number): ImageLibrary {
  const urlCache = new Map<string, string | null>();
  const fileByName = new Map<string, File>();
  for (const f of files) fileByName.set(f.name, f);
  const fileNames = files.map((f) => f.name);
  return {
    folderName,
    count: files.length,
    fileNames,
    fileFor(fileName: string): File | null {
      return fileByName.get(fileName) ?? null;
    },
    match(partNo: string, aliases?: string[]): string | null {
      const hit = matchFile(files, partNo, aliases);
      return hit ? hit.name : null;
    },
    matchAll(partNo: string, aliases?: string[]): string[] {
      const hits = matchAllFiles(files, partNo, aliases);
      return hits.map((f) => f.name);
    },
    urlForFile(fileName: string): string | null {
      if (urlCache.has(fileName)) return urlCache.get(fileName) ?? null;
      const hit = fileByName.get(fileName) ?? null;
      if (!hit) {
        urlCache.set(fileName, null);
        return null;
      }
      const url = URL.createObjectURL(hit);
      urlCache.set(fileName, url);
      return url;
    },
    debug: {
      totalFiles,
      sampleNames: files.slice(0, 10).map((f) => f.name),
    },
  };
}

// ---------- 資料夾選擇 ----------
async function pickWithDirectoryPicker(): Promise<ImageLibrary> {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  const files: File[] = [];
  const stats = { totalFiles: 0 };
  await collectFromDir(handle, files, stats);
  if (files.length === 0) throw new Error('empty');
  try { await idbSaveHandle(handle); } catch { /* 無法持久化時不影響本次使用 */ }
  localStorage.setItem(FLAG_SET, '1');
  return buildLibrary(files, handle.name, stats.totalFiles);
}

function pickWithInput(): Promise<ImageLibrary> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,.pdf';
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.onchange = () => {
      const files = Array.from(input.files || []).filter(f => IS_MEDIA.test(f.name));
      if (files.length === 0) {
        reject(new Error('cancelled'));
        return;
      }
      const totalFiles = Array.from(input.files || []).length;
      const folderName = files[0].webkitRelativePath?.split('/')[0] || '圖檔資料夾';
      localStorage.setItem(FLAG_SET, '1');
      resolve(buildLibrary(files, folderName, totalFiles));
    };
    input.oncancel = () => reject(new Error('cancelled'));
    input.click();
  });
}

export async function pickImageFolder(): Promise<ImageLibrary> {
  if (typeof window.showDirectoryPicker === 'function') {
    return pickWithDirectoryPicker();
  }
  return pickWithInput();
}

// ---------- 恢復上次選擇的資料夾 ----------
export async function restoreImageFolder(): Promise<ImageLibrary | null> {
  try {
    const handle = await idbLoadHandle() as FileSystemDirectoryHandle | null;
    if (!handle || typeof handle.queryPermission !== 'function') return null;
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      const req = await handle.requestPermission({ mode: 'read' });
      if (req !== 'granted') return null;
    }
    const files: File[] = [];
    const stats = { totalFiles: 0 };
    await collectFromDir(handle, files, stats);
    if (files.length === 0) return null;
    return buildLibrary(files, handle.name, stats.totalFiles);
  } catch {
    return null;
  }
}

export function isImageFolderDismissed(): boolean {
  return localStorage.getItem(FLAG_DISMISSED) === '1';
}

export function clearImageFolderDismissed() {
  localStorage.removeItem(FLAG_DISMISSED);
}
