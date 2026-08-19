import { PartItem } from '../types';
import { IS_STATIC_MODE } from './serverStatus';
import { dedupeAlternates } from './alternates';

const defaultParts: PartItem[] = [];

// 品號去重：依 partNo 保留首筆，補齊後續同品號的別稱與缺漏欄位
export function dedupeParts(parts: PartItem[]): PartItem[] {
  const seen = new Map<string, PartItem>();
  for (const p of parts) {
    if (!p || !p.partNo) continue;
    const existing = seen.get(p.partNo);
    if (!existing) {
      seen.set(p.partNo, p);
      continue;
    }
    existing.alternates = dedupeAlternates(
      [...(existing.alternates ?? []), ...(p.alternates ?? [])],
      existing.partNo,
    );
    if (!existing.name && p.name) existing.name = p.name;
    if (!existing.customer && p.customer) existing.customer = p.customer;
    if (!existing.color && p.color) existing.color = p.color;
    if (!existing.material && p.material) existing.material = p.material;
    if (!existing.notes && p.notes) existing.notes = p.notes;
    if (!existing.description && p.description) existing.description = p.description;
    if (!existing.dwgNo && p.dwgNo) existing.dwgNo = p.dwgNo;
  }
  return Array.from(seen.values());
}

let cache: PartItem[] | null = null;
let loading: Promise<PartItem[]> | null = null;

async function fetchParts(): Promise<PartItem[]> {
  if (IS_STATIC_MODE) return defaultParts;
  const res = await fetch('/api/parts');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('Invalid parts data');
  return data;
}

export async function loadParts(): Promise<PartItem[]> {
  if (cache) return cache;
  if (loading) return loading;
  loading = fetchParts().then((data) => {
    cache = data;
    loading = null;
    return data;
  }).catch(() => {
    loading = null;
    cache = defaultParts;
    return defaultParts;
  });
  return loading;
}

export async function saveParts(parts: PartItem[]) {
  if (IS_STATIC_MODE) throw new Error('static mode');
  const res = await fetch('/api/parts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  cache = parts;
}
