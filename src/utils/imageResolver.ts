import { PartItem } from '../types';
import { ImageLibrary, normalize } from './imageLibrary';

export interface ImageResolution {
  url: string;
  name: string;
  via: 'file' | 'binding' | 'ocr';
}

const BINDINGS_KEY = 'pn_lookup_image_bindings';

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

// ---------- 解析：檔名 → 手動綁定 → OCR 內容 ----------
export function resolveImage(
  partNo: string,
  alternates: string[] | undefined,
  lib: ImageLibrary | null,
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
): ImageResolution | null {
  if (!lib) return null;
  const aliases = alternates ?? [];

  // 1. 檔名比對
  const fname = lib.match(partNo, aliases);
  if (fname) return { url: lib.urlForFile(fname) as string, name: fname, via: 'file' };

  // 2. 手動綁定
  for (const pn of [partNo, ...aliases]) {
    const bound = bindings[pn];
    if (bound && lib.fileNames.includes(bound)) {
      return { url: lib.urlForFile(bound) as string, name: bound, via: 'binding' };
    }
  }

  // 3. OCR 內容（需已辨識完畢；部分檔案未辨識時會漏，背景掃描完成後自動補上）
  if (ocrIndex.size > 0) {
    const targets = [partNo, ...aliases].map((p) => normalize(p)).filter(Boolean);
    if (targets.length > 0) {
      for (const fname of lib.fileNames) {
        const text = ocrIndex.get(fname);
        if (!text) continue;
        const norm = normalize(text);
        if (targets.some((t) => norm.includes(t))) {
          return { url: lib.urlForFile(fname) as string, name: fname, via: 'ocr' };
        }
      }
    }
  }

  return null;
}

export function getPartNoAliases(item: Pick<PartItem, 'partNo' | 'alternates'>): string[] {
  return [item.partNo, ...(item.alternates ?? [])];
}

// ---------- 統計所有受控圖檔與未對應孤兒圖檔 ----------
export function getOrphanFiles(
  lib: ImageLibrary | null,
  parts: PartItem[],
  bindings: Record<string, string>,
  ocrIndex: Map<string, string>,
): { matchedFiles: Set<string>; orphanFiles: string[]; matchedCount: number } {
  if (!lib) return { matchedFiles: new Set(), orphanFiles: [], matchedCount: 0 };

  const matchedFiles = new Set<string>();

  for (const part of parts) {
    const res = resolveImage(part.partNo, part.alternates, lib, bindings, ocrIndex);
    if (res) {
      matchedFiles.add(res.name);
    }
  }

  const orphanFiles = lib.fileNames.filter((fname) => !matchedFiles.has(fname));
  return {
    matchedFiles,
    orphanFiles,
    matchedCount: matchedFiles.size,
  };
}
