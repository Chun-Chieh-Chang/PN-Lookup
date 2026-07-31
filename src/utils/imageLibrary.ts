const IS_IMAGE = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?)$/i;
const FLAG_SET = 'pn_lookup_image_folder_set';
const FLAG_DISMISSED = 'pn_lookup_image_folder_dismissed';

export interface ImageLibrary {
  folderName: string;
  count: number;
  urlFor(partNo: string): string | null;
}

// ---------- IndexedDB（保存資料夾 handle，下次開啟自動恢復） ----------
const DB_NAME = 'pn-lookup';
const DB_STORE = 'handles';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function idbGet(key: string): Promise<unknown> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- 遍歷子資料夾收集圖檔 ----------
async function collectFromDir(dir: FileSystemDirectoryHandle, out: File[]): Promise<void> {
  const iterable = dir.entries() as unknown as AsyncIterableIterator<[string, FileSystemHandle]>;
  for await (const [, handle] of iterable) {
    if (handle.kind === 'directory') {
      await collectFromDir(handle as FileSystemDirectoryHandle, out);
    } else if (IS_IMAGE.test(handle.name)) {
      try {
        out.push(await (handle as FileSystemFileHandle).getFile());
      } catch { /* 檔案無法讀取時略過 */ }
    }
  }
}

// ---------- 品號 → 圖檔配對（優先序：完全一致 → 忽略符號比對 → 品號開頭） ----------
const NORM_RE = /[-_\s.]+/g;

function normalize(s: string): string {
  return s.replace(NORM_RE, '').toUpperCase();
}

function matchFile(files: File[], partNo: string): File | null {
  const pn = partNo.toUpperCase();
  const pnNorm = normalize(pn);

  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '').toUpperCase();
    if (base === pn) return f;
  }
  for (const f of files) {
    const base = f.name.replace(/\.[^.]+$/, '').toUpperCase();
    if (normalize(base) === pnNorm) return f;
  }
  if (pnNorm.length >= 4) {
    for (const f of files) {
      const base = f.name.replace(/\.[^.]+$/, '').toUpperCase();
      if (normalize(base).startsWith(pnNorm)) return f;
    }
  }
  return null;
}

function buildLibrary(files: File[], folderName: string): ImageLibrary {
  const urlCache = new Map<string, string | null>();
  return {
    folderName,
    count: files.length,
    urlFor(partNo: string): string | null {
      if (urlCache.has(partNo)) return urlCache.get(partNo) ?? null;
      const hit = matchFile(files, partNo);
      if (!hit) {
        urlCache.set(partNo, null);
        return null;
      }
      const url = URL.createObjectURL(hit);
      urlCache.set(partNo, url);
      return url;
    },
  };
}

// ---------- 資料夾選擇 ----------
async function pickWithDirectoryPicker(): Promise<ImageLibrary> {
  const handle = await window.showDirectoryPicker({ mode: 'read' });
  const files: File[] = [];
  await collectFromDir(handle, files);
  if (files.length === 0) throw new Error('empty');
  try { await idbSet('image-folder', handle); } catch { /* 無法持久化時不影響本次使用 */ }
  localStorage.setItem(FLAG_SET, '1');
  return buildLibrary(files, handle.name);
}

function pickWithInput(): Promise<ImageLibrary> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;
    (input as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
    input.onchange = () => {
      const files = Array.from(input.files || []).filter(f => IS_IMAGE.test(f.name));
      if (files.length === 0) {
        reject(new Error('cancelled'));
        return;
      }
      const folderName = files[0].webkitRelativePath?.split('/')[0] || '圖檔資料夾';
      localStorage.setItem(FLAG_SET, '1');
      resolve(buildLibrary(files, folderName));
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
    const handle = await idbGet('image-folder') as FileSystemDirectoryHandle | null;
    if (!handle || typeof handle.queryPermission !== 'function') return null;
    const perm = await handle.queryPermission({ mode: 'read' });
    if (perm !== 'granted') {
      const req = await handle.requestPermission({ mode: 'read' });
      if (req !== 'granted') return null;
    }
    const files: File[] = [];
    await collectFromDir(handle, files);
    if (files.length === 0) return null;
    return buildLibrary(files, handle.name);
  } catch {
    return null;
  }
}

export function isImageFolderDismissed(): boolean {
  return localStorage.getItem(FLAG_DISMISSED) === '1';
}

export function setImageFolderDismissed() {
  localStorage.setItem(FLAG_DISMISSED, '1');
}

export function clearImageFolderDismissed() {
  localStorage.removeItem(FLAG_DISMISSED);
}
