/**
 * Type definitions for File System Access API
 * These are experimental APIs not yet in TypeScript's standard library
 */

interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
  isSameEntry(other: FileSystemHandle): Promise<boolean>;
  queryPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(descriptor?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
}

interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
}

interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
  getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
  removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  keys(): AsyncIterableIterator<string>;
  values(): AsyncIterableIterator<FileSystemHandle>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  [Symbol.asyncIterator](): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface FileSystemWritableFileStream extends WritableStream {
  write(data: FileSystemWriteChunkType): Promise<void>;
  seek(position: number): Promise<void>;
  truncate(size: number): Promise<void>;
}

interface FileSystemHandlePermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

interface FileSystemCreateWritableOptions {
  keepExistingData?: boolean;
}

interface FileSystemGetDirectoryOptions {
  create?: boolean;
}

interface FileSystemGetFileOptions {
  create?: boolean;
}

interface FileSystemRemoveOptions {
  recursive?: boolean;
}

type FileSystemWriteChunkType = 
  | BufferSource 
  | Blob 
  | string 
  | { type: 'write'; position?: number; data: BufferSource | Blob | string }
  | { type: 'seek'; position: number }
  | { type: 'truncate'; size: number };

interface OpenFilePickerOptions {
  multiple?: boolean;
  excludeAcceptAllOption?: boolean;
  types?: FilePickerAcceptType[];
  startIn?: WellKnownDirectory | FileSystemHandle;
}

interface SaveFilePickerOptions {
  excludeAcceptAllOption?: boolean;
  suggestedName?: string;
  types?: FilePickerAcceptType[];
  startIn?: WellKnownDirectory | FileSystemHandle;
}

interface DirectoryPickerOptions {
  startIn?: WellKnownDirectory | FileSystemHandle;
  mode?: 'read' | 'readwrite';
}

interface FilePickerAcceptType {
  description?: string;
  accept: Record<string, string | string[]>;
}

type WellKnownDirectory = 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';

// Extend Window interface
interface Window {
  showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
  showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}

// FileReaderSync for Web Workers
interface FileReaderSync {
  readAsArrayBuffer(blob: Blob): ArrayBuffer;
  readAsBinaryString(blob: Blob): string;
  readAsDataURL(blob: Blob): string;
  readAsText(blob: Blob, encoding?: string): string;
}

declare var FileReaderSync: {
  prototype: FileReaderSync;
  new(): FileReaderSync;
};