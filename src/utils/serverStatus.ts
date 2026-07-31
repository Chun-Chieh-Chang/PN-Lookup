type ServerStatus = 'checking' | 'online' | 'offline';

// GitHub Pages 靜態建置時注入 VITE_STATIC_ONLY，完全跳過 API 呼叫
export const IS_STATIC_MODE = import.meta.env.VITE_STATIC_ONLY === 'true';

let status: ServerStatus = 'checking';
let promise: Promise<ServerStatus> | null = null;

export function getServerStatus(): Promise<ServerStatus> {
  if (IS_STATIC_MODE) {
    status = 'offline';
    return Promise.resolve(status);
  }
  if (promise) return promise;
  promise = fetch('/api/bom').then(res => {
    const ct = res.headers.get('content-type') || '';
    const ok = res.ok && ct.includes('application/json');
    status = ok ? 'online' : 'offline';
    return status;
  }).catch(() => {
    status = 'offline';
    return status;
  });
  return promise;
}
