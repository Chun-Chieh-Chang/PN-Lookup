import { PartItem } from '../types';
import { ImageLibrary, normalize } from './imageLibrary';

export interface ImageResolution {
  url: string;
  name: string;
  via: 'file' | 'binding' | 'ocr' | 'inference';
  inferenceSource?: string;
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

// ---------- 解析：多圖檔與單圖檔檔名 → 手動綁定 → OCR 內容 → 本體語意推理 ----------
export function resolveAllImages(
  partNo: string,
  alternates: string[] | undefined,
  lib: ImageLibrary | null,
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
  relatedParts?: string[],
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

  // 4. 本體語意推理匹配 (Semantic Inference via Ontological Relations e.g. usedInAssemblies)
  if (results.length === 0 && relatedParts && relatedParts.length > 0) {
    for (const relPn of relatedParts) {
      if (!relPn) continue;
      const relMatched = lib.matchAll ? lib.matchAll(relPn, []) : [lib.match(relPn, [])].filter(Boolean) as string[];
      for (const fname of relMatched) {
        if (fname && !seenFiles.has(fname)) {
          seenFiles.add(fname);
          results.push({
            url: lib.urlForFile(fname) as string,
            name: fname,
            via: 'inference',
            inferenceSource: relPn,
          });
        }
      }
      if (results.length > 0) break; // 取得第一組父組件推理圖面即可
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
  relatedParts?: string[],
): ImageResolution | null {
  const all = resolveAllImages(partNo, alternates, lib, bindings, ocrIndex, relatedParts);
  return all.length > 0 ? all[0] : null;
}

// ---------- 反向識別：由圖檔內文找出「該品號可組成的產品」 ----------
export interface ReverseBomCandidate {
  partNo: string;
  name: string;
  customer: string;
  sourceFiles: string[];
}

/**
 * 自所有已辨識圖檔（OCR 快取內文）中，找出內文包含指定品號的圖檔，
 * 再依檔名反查該圖檔所屬品號 → 即為該品號可組成的產品（上層組件候選）。
 */
export function findParentProducts(
  partNo: string,
  alternates: string[] | undefined,
  lib: ImageLibrary,
  parts: PartItem[],
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
): ReverseBomCandidate[] {
  const targets = [partNo, ...(alternates ?? [])]
    .map((t) => normalize(t))
    .filter((t) => t.length >= 3);
  if (targets.length === 0 || ocrIndex.size === 0) return [];

  // 1. 找出內文包含目標品號的圖檔
  const containingFiles: string[] = [];
  for (const fname of lib.fileNames) {
    const text = ocrIndex.get(fname);
    if (!text) continue;
    const norm = normalize(text);
    if (targets.some((t) => norm.includes(t))) containingFiles.push(fname);
  }
  if (containingFiles.length === 0) return [];

  // 2. 建立「正規化品號/別稱 → 品號」索引與手動綁定反向索引
  const normIndex = new Map<string, string>();
  const partsById: Record<string, PartItem> = {};
  for (const p of parts) {
    partsById[p.partNo] = p;
    for (const k of new Set([p.partNo, ...(p.alternates ?? [])])) {
      const nk = normalize(k);
      if (nk.length >= 3 && !normIndex.has(nk)) normIndex.set(nk, p.partNo);
    }
  }
  const boundByFile = new Map<string, string>();
  for (const [pn, fname] of Object.entries(bindings)) boundByFile.set(fname, pn);

  // 3. 依檔名反查圖檔所屬品號（與 imageLibrary 前向比對規則互逆：
  //    片段等於品號，或片段以品號開頭且後續首字元非數字）
  const fileOwner = (fname: string): string | null => {
    const bound = boundByFile.get(fname);
    if (bound && partsById[bound]) return bound;
    const base = fname.replace(/\.[^.]+$/, '').toUpperCase();
    const segs = [base, ...base.split(/[_\s()\[\],/]+/i)];
    for (const seg of segs) {
      const sNorm = normalize(seg);
      // BD 客戶代稱前綴剝除：BD-8003875 → 8003875（BD 不屬品號）
      const variants = sNorm.startsWith('BD') && sNorm.length > 2 && sNorm.slice(2).length >= 4
        ? [sNorm, sNorm.slice(2)]
        : [sNorm];
      for (const v of variants) {
        for (let i = 3; i <= v.length; i++) {
          const owner = normIndex.get(v.slice(0, i));
          if (!owner) continue;
          const nextChar = v[i];
          if (i === v.length || !nextChar || nextChar < '0' || nextChar > '9') return owner;
        }
      }
    }
    return null;
  };

  // 4. 彙整候選產品（排除自身）
  const result = new Map<string, ReverseBomCandidate>();
  for (const fname of containingFiles) {
    const owner = fileOwner(fname);
    if (!owner || owner === partNo) continue;
    const prev = result.get(owner);
    if (prev) {
      if (!prev.sourceFiles.includes(fname)) prev.sourceFiles.push(fname);
    } else {
      const p = partsById[owner];
      result.set(owner, {
        partNo: owner,
        name: p?.name ?? '',
        customer: p?.customer ?? '',
        sourceFiles: [fname],
      });
    }
  }
  return Array.from(result.values());
}

// ---------- 統計所有受控圖檔、待處理孤兒圖檔與已排除孤兒圖檔 ----------
interface OrphanFilesResult {
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
