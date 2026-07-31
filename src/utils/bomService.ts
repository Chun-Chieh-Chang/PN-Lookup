import { IS_STATIC_MODE } from './serverStatus';

interface BOMData {
  children: Record<string, string[]>;
  parents: Record<string, string[]>;
}

let cache: BOMData | null = null;
let loading: Promise<BOMData> | null = null;

async function fetchBOM(): Promise<BOMData> {
  if (IS_STATIC_MODE) throw new Error('static mode');
  const res = await fetch('/api/bom');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function loadBOM(): Promise<BOMData> {
  if (cache) return cache;
  if (loading) return loading;
  loading = fetchBOM().then((data) => {
    cache = data;
    loading = null;
    return data;
  }).catch(() => {
    loading = null;
    throw new Error('BOM API unavailable');
  });
  return loading;
}

export function clearBOMCache() {
  cache = null;
}

export async function saveBOM(children: Record<string, string[]>, parents: Record<string, string[]>) {
  if (IS_STATIC_MODE) throw new Error('static mode');
  const res = await fetch('/api/bom', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ children, parents }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  cache = { children, parents };
}
