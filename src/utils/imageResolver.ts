import { PartItem } from '../types';
import { ImageLibrary, normalize } from './imageLibrary';

export interface ImageResolution {
  url: string;
  name: string;
  via: 'file' | 'binding' | 'ocr';
}

const BINDINGS_KEY = 'pn_lookup_image_bindings';
const DISMISSED_ORPHANS_KEY = 'pn_lookup_dismissed_orphans';

// ---------- 手動綁定（本機限定：綁定的是本機檔案） ----------
export function loadBindings(): Record<string, string> {
  try {
    const raw = localStorage.getItem(BINDINGS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch {
    return {};
  }
}

export function saveBindings(bindings: Record<string, string>): void {
  try {
    localStorage.setItem(BINDINGS_KEY, JSON.stringify(bindings));
  } catch { /* ignore */ }
}

// ---------- 標記排除 / 重複別稱孤兒圖檔 ----------
export function loadDismissedOrphans(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_ORPHANS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : new Set();
  } catch {
    return new Set();
  }
}

export function saveDismissedOrphans(dismissed: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_ORPHANS_KEY, JSON.stringify(Array.from(dismissed)));
  } catch { /* ignore */ }
}

// ---------- 解析：多圖檔與單圖檔檔名 → 手動綁定 → OCR 內容 ----------
export function resolveAllImages(
  partNo: string,
  alternates: string[] | undefined,
  lib: ImageLibrary | null,
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
): ImageResolution[] {
  if (!lib) return [];
  const aliases = alternates ?? [];
  const allSearchKeys = [partNo, ...aliases];
  const results: ImageResolution[] = [];
  const seenFiles = new Set<string>();

  // 1. 檔名比對 (找出所有命中的圖檔檔名)
  const matchedNames = lib.matchAll ? lib.matchAll(partNo, aliases) : [lib.match(partNo, aliases)].filter(Boolean) as string[];
  for (const fname of matchedNames) {
    if (fname && !seenFiles.has(fname)) {
      seenFiles.add(fname);
      results.push({ url: lib.urlForFile(fname) as string, name: fname, via: 'file' });
    }
  }

  // 2. 手動綁定 (包含主品號與所有別稱的綁定)
  for (const pn of allSearchKeys) {
    const bound = bindings[pn];
    if (bound && lib.fileNames.includes(bound) && !seenFiles.has(bound)) {
      seenFiles.add(bound);
      results.push({ url: lib.urlForFile(bound) as string, name: bound, via: 'binding' });
    }
  }

  // 3. OCR 內容辨識命中
  if (ocrIndex.size > 0) {
    const targets = allSearchKeys.map((p) => normalize(p)).filter(Boolean);
    if (targets.length > 0) {
      for (const fname of lib.fileNames) {
        if (seenFiles.has(fname)) continue;
        const text = ocrIndex.get(fname);
        if (!text) continue;
        const norm = normalize(text);
        if (targets.some((t) => norm.includes(t))) {
          seenFiles.add(fname);
          results.push({ url: lib.urlForFile(fname) as string, name: fname, via: 'ocr' });
        }
      }
    }
  }

  return results;
}

export function resolveImage(
  partNo: string,
  alternates: string[] | undefined,
  lib: ImageLibrary | null,
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
): ImageResolution | null {
  const all = resolveAllImages(partNo, alternates, lib, bindings, ocrIndex);
  return all.length > 0 ? all[0] : null;
}

// ---------- 統計所有受控圖檔、待處理孤兒圖檔與已排除孤兒圖檔 ----------
export interface OrphanFilesResult {
  matchedFiles: Set<string>;
  orphanFiles: string[];
  dismissedFiles: string[];
  rawOrphanCount: number;
  matchedCount: number;
}

export function getOrphanFiles(
  lib: ImageLibrary | null,
  parts: PartItem[],
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
  dismissedSet: Set<string> = new Set(),
): OrphanFilesResult {
  if (!lib) {
    return {
      matchedFiles: new Set(),
      orphanFiles: [],
      dismissedFiles: [],
      rawOrphanCount: 0,
      matchedCount: 0,
    };
  }

  const matchedFiles = new Set<string>();

  for (const part of parts) {
    const allRes = resolveAllImages(part.partNo, part.alternates, lib, bindings, ocrIndex);
    for (const res of allRes) {
      matchedFiles.add(res.name);
    }
  }

  const rawOrphans = lib.fileNames.filter((fname) => !matchedFiles.has(fname));
  const orphanFiles = rawOrphans.filter((fname) => !dismissedSet.has(fname));
  const dismissedFiles = rawOrphans.filter((fname) => dismissedSet.has(fname));

  return {
    matchedFiles,
    orphanFiles,
    dismissedFiles,
    rawOrphanCount: rawOrphans.length,
    matchedCount: matchedFiles.size,
  };
}
