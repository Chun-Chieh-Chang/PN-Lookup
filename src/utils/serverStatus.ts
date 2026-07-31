export type ServerStatus = 'checking' | 'online' | 'offline';

let status: ServerStatus = 'checking';
let promise: Promise<ServerStatus> | null = null;

export function getServerStatus(): Promise<ServerStatus> {
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

export function getServerStatusSync(): ServerStatus {
  return status;
}
