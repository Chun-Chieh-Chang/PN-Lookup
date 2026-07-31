// File System Access API 環境型別（部分瀏覽器/TS lib 未內建）

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemHandle {
  readonly kind: 'file' | 'directory';
  readonly name: string;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  getFile(): Promise<File>;
}

interface Window {
  showDirectoryPicker?(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
}
