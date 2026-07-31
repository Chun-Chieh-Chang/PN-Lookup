import { PartItem } from '../types';

let cache: PartItem[] | null = null;
let loading: Promise<PartItem[]> | null = null;

async function fetchParts(): Promise<PartItem[]> {
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
  }).catch((err) => {
    loading = null;
    throw err;
  });
  return loading;
}

export function clearPartsCache() {
  cache = null;
}

export async function saveParts(parts: PartItem[]) {
  const res = await fetch('/api/parts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(parts),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  cache = parts;
}
