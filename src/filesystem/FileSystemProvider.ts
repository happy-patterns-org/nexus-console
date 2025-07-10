/**
 * File System Provider - Unified file system access with native API and fallbacks
 * Provides seamless file operations across different environments
 */

import type CacheManager from '../cache/CacheManager';
import type TerminalWebSocketManager from '../transport/TerminalWebSocket';
import type { FileEntry, FileSystemAccessOptions } from '../types';

export interface FileSystemProviderConfig {
  preferNative?: boolean;
  cacheDuration?: number;
  maxFileSize?: number;
  ws?: TerminalWebSocketManager | null;
  cache?: CacheManager | null;
}

export interface FileSystemCapabilities {
  nativeFileSystem: boolean;
  fileSystemAccess: boolean;
  webkitFileSystem: boolean;
  fileReaderSync: boolean;
}

export interface FileHandle {
  type: 'native' | 'server';
  handle: FileSystemHandle | string;
  name?: string;
  path: string;
}

export interface FilePermissions {
  read: boolean;
  write: boolean;
}

export interface ReadFileOptions {
  encoding?: 'utf8' | 'binary' | null;
  position?: number;
  length?: number;
  noCache?: boolean;
}

export interface WriteFileOptions {
  encoding?: 'utf8' | 'binary';
  mode?: 'overwrite' | 'append';
  createDirectories?: boolean;
}

export interface ListDirectoryOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: string | RegExp | ((entry: FileEntry) => boolean) | null;
  noCache?: boolean;
}

export interface WatchOptions {
  recursive?: boolean;
  events?: Array<'create' | 'modify' | 'delete' | 'rename'>;
}

export interface WatchEvent {
  type: 'create' | 'modify' | 'delete' | 'rename';
  path: string;
  oldPath?: string;
}

export interface WatchHandle {
  watchId: string;
  unwatch: () => Promise<void>;
}

export interface NativeFileEntry extends FileEntry {
  handle?: FileSystemHandle;
}

class FileSystemProvider {
  private config: Required<FileSystemProviderConfig>;
  private ws: TerminalWebSocketManager | null;
  private cache: CacheManager | null;
  private capabilities: FileSystemCapabilities;
  private handles: Map<string, FileSystemHandle>;
  private permissions: Map<string, FilePermissions>;
  private watchers: Map<string, WatchHandle>;
  private initialized: boolean;

  constructor(config: FileSystemProviderConfig = {}) {
    this.config = {
      preferNative: config.preferNative !== false,
      cacheDuration: config.cacheDuration || 300000, // 5 minutes
      maxFileSize: config.maxFileSize || 10 * 1024 * 1024, // 10MB
      ws: config.ws || null,
      cache: config.cache || null,
    };

    // WebSocket connection for server-based operations
    this.ws = this.config.ws;

    // Cache manager
    this.cache = this.config.cache;

    // Feature detection
    this.capabilities = {
      nativeFileSystem: 'showOpenFilePicker' in window,
      fileSystemAccess: 'showDirectoryPicker' in window,
      webkitFileSystem: 'webkitRequestFileSystem' in window,
      fileReaderSync: typeof FileReaderSync !== 'undefined',
    };

    // File handles and permissions
    this.handles = new Map();
    this.permissions = new Map();

    // File watchers
    this.watchers = new Map();

    // Initialized flag
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Request persistent storage if available
    if (navigator.storage && navigator.storage.persist) {
      try {
        const persistent = await navigator.storage.persist();
        console.log('Persistent storage:', persistent);
      } catch (error) {
        console.warn('Failed to request persistent storage:', error);
      }
    }

    // Check storage quota
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        console.log('Storage quota:', {
          usage: this.formatBytes(estimate.usage || 0),
          quota: this.formatBytes(estimate.quota || 0),
          percentage: estimate.quota ? ((estimate.usage || 0 / estimate.quota) * 100).toFixed(2) + '%' : '0%',
        });
      } catch (error) {
        console.warn('Failed to estimate storage:', error);
      }
    }

    this.initialized = true;
  }

  // Directory Access
  async requestAccess(options: FileSystemAccessOptions = {}): Promise<FileHandle> {
    const accessOptions = {
      path: options.path || '/',
      mode: options.mode || 'read',
      recursive: options.recursive || false,
      startIn: options.startIn || 'desktop',
    };

    // Try native file system access first
    if (this.capabilities.fileSystemAccess && this.config.preferNative) {
      try {
        return await this.requestNativeAccess(accessOptions);
      } catch (error) {
        console.warn('Native file system access failed:', error);
        // Fall through to server-based access
      }
    }

    // Fall back to server-based access
    return await this.requestServerAccess(accessOptions);
  }

  private async requestNativeAccess(options: FileSystemAccessOptions & { mode: string }): Promise<FileHandle> {
    let handle: FileSystemHandle;
    
    const isDirectoryMode = options.path?.endsWith('/') || options.mode === 'readwrite';

    if (isDirectoryMode) {
      // Request directory access
      handle = await window.showDirectoryPicker({
        mode: options.mode === 'write' || options.mode === 'readwrite' ? 'readwrite' : 'read',
        startIn: options.startIn,
      });

      // Store handle
      this.handles.set(handle.name, handle);

      // Index directory if requested
      if (options.recursive && handle.kind === 'directory') {
        await this.indexDirectory(handle as FileSystemDirectoryHandle);
      }
    } else {
      // Request file access
      const handles = await window.showOpenFilePicker({
        multiple: false,
        startIn: options.startIn,
      });

      handle = handles[0];
      this.handles.set(handle.name, handle);
    }

    // Store permissions
    this.permissions.set(handle.name, {
      read: true,
      write: options.mode === 'write',
    });

    return {
      type: 'native',
      handle: handle,
      name: handle.name,
      path: handle.name,
    };
  }

  private async requestServerAccess(options: FileSystemAccessOptions): Promise<FileHandle> {
    if (!this.ws) {
      throw new Error('WebSocket connection required for server access');
    }

    const result = await this.ws.requestFileSystemAccess(options);

    // Store permissions
    this.permissions.set(options.path || '/', {
      read: true,
      write: options.mode === 'write' || options.mode === 'readwrite',
    });

    return {
      type: 'server',
      handle: result,
      path: options.path || '/',
    };
  }

  // File Operations
  async readFile(path: string, options: ReadFileOptions = {}): Promise<string | ArrayBuffer> {
    const readOptions = {
      encoding: options.encoding || 'utf8',
      position: options.position || 0,
      length: options.length || -1,
      ...options,
    };

    // Check cache first
    if (this.cache && !options.noCache) {
      const cached = await this.cache.getFile(path);
      if (cached) {
        return cached;
      }
    }

    let content: string | ArrayBuffer;

    // Try native handle first
    const handle = this.findHandleForPath(path);
    if (handle && handle.kind === 'file') {
      content = await this.readNativeFile(handle as FileSystemFileHandle, readOptions);
    } else if (this.ws) {
      // Fall back to server
      content = await this.ws.readFile(path, {
        encoding: readOptions.encoding === null ? undefined : readOptions.encoding,
        offset: readOptions.position,
        length: readOptions.length,
      });
    } else {
      throw new Error('No file system access available');
    }

    // Cache the result
    if (this.cache && !options.noCache && typeof content === 'string') {
      await this.cache.cacheFile(path, content, {
        ttl: this.config.cacheDuration,
      });
    }

    return content;
  }

  private async readNativeFile(handle: FileSystemFileHandle, options: ReadFileOptions): Promise<string | ArrayBuffer> {
    const file = await handle.getFile();

    // Check file size
    if (file.size > this.config.maxFileSize) {
      throw new Error(`File too large: ${this.formatBytes(file.size)} (max: ${this.formatBytes(this.config.maxFileSize)})`);
    }

    if (options.encoding === 'binary' || options.encoding === null) {
      // Return as ArrayBuffer
      const buffer = await file.arrayBuffer();

      if (options.position && options.position > 0 || (options.length && options.length > 0)) {
        const start = options.position || 0;
        const end = options.length && options.length > 0 ? start + options.length : undefined;
        return buffer.slice(start, end);
      }

      return buffer;
    } else {
      // Return as text
      const text = await file.text();

      if (options.position && options.position > 0 || (options.length && options.length > 0)) {
        const start = options.position || 0;
        const end = options.length && options.length > 0 ? start + options.length : undefined;
        return text.substring(start, end);
      }

      return text;
    }
  }

  async writeFile(path: string, content: string | ArrayBuffer | Uint8Array, options: WriteFileOptions = {}): Promise<{ bytesWritten: number; path: string }> {
    const writeOptions = {
      encoding: options.encoding || 'utf8',
      mode: options.mode || 'overwrite',
      createDirectories: options.createDirectories || false,
      ...options,
    };

    // Check permissions
    if (!this.hasWritePermission(path)) {
      throw new Error('Write permission denied');
    }

    // Invalidate cache
    if (this.cache) {
      await this.cache.invalidateFile(path);
    }

    // Try native handle first
    const handle = this.findHandleForPath(path);
    if (handle) {
      if (handle.kind === 'file') {
        return await this.writeNativeFile(handle as FileSystemFileHandle, content, writeOptions);
      } else if (handle.kind === 'directory') {
        // Create file in directory
        const fileName = path.split('/').pop();
        if (!fileName) {
          throw new Error('Invalid file path');
        }
        const fileHandle = await (handle as FileSystemDirectoryHandle).getFileHandle(fileName, { create: true });
        return await this.writeNativeFile(fileHandle, content, writeOptions);
      }
    }

    // Fall back to server
    if (this.ws) {
      const bytesWritten = await this.ws.writeFile(path, content as string, writeOptions);
      return { bytesWritten, path };
    }

    throw new Error('No file system access available');
  }

  private async writeNativeFile(handle: FileSystemFileHandle, content: string | ArrayBuffer | Uint8Array, options: WriteFileOptions): Promise<{ bytesWritten: number; path: string }> {
    const writable = await handle.createWritable({
      keepExistingData: options.mode === 'append',
    });

    try {
      // Convert content based on encoding
      let data: ArrayBuffer | Uint8Array;
      if (options.encoding === 'binary' || content instanceof ArrayBuffer) {
        data = content as ArrayBuffer;
      } else if (content instanceof Uint8Array) {
        data = content;
      } else {
        // Text content
        data = new TextEncoder().encode(content);
      }

      // Write data
      if (options.mode === 'append') {
        // Seek to end for append
        const file = await handle.getFile();
        await writable.seek(file.size);
      }

      await writable.write(data);

      const bytesWritten = data instanceof ArrayBuffer ? data.byteLength : data.length;
      return {
        bytesWritten,
        path: handle.name,
      };

    } finally {
      await writable.close();
    }
  }

  // Directory Operations
  async listDirectory(path: string, options: ListDirectoryOptions = {}): Promise<FileEntry[]> {
    const listOptions = {
      recursive: options.recursive || false,
      includeHidden: options.includeHidden || false,
      filter: options.filter || null,
      ...options,
    };

    // Check cache first
    if (this.cache && !options.noCache) {
      const cached = await this.cache.getDirectory(path);
      if (cached) {
        return this.applyFilters(cached, {
          ...listOptions,
          filter: listOptions.filter as string | null | undefined,
        });
      }
    }

    let entries: FileEntry[];

    // Try native handle first
    const handle = this.findHandleForPath(path);
    if (handle && handle.kind === 'directory') {
      entries = await this.listNativeDirectory(handle as FileSystemDirectoryHandle, listOptions);
    } else if (this.ws) {
      // Fall back to server
      entries = await this.ws.listDirectory(path, {
        recursive: listOptions.recursive,
        includeHidden: listOptions.includeHidden,
        filter: typeof listOptions.filter === 'string' ? listOptions.filter : null,
      });
    } else {
      throw new Error('No file system access available');
    }

    // Apply filters
    entries = this.applyFilters(entries, listOptions);

    // Cache the result
    if (this.cache && !options.noCache) {
      await this.cache.cacheDirectory(path, entries, {
        ttl: this.config.cacheDuration,
      });
    }

    return entries;
  }

  private async listNativeDirectory(handle: FileSystemDirectoryHandle, options: ListDirectoryOptions): Promise<NativeFileEntry[]> {
    const entries: NativeFileEntry[] = [];

    const processEntry = async (entryHandle: FileSystemHandle, parentPath: string = ''): Promise<void> => {
      const path = parentPath ? `${parentPath}/${entryHandle.name}` : entryHandle.name;

      // Skip hidden files if not requested
      if (!options.includeHidden && entryHandle.name.startsWith('.')) {
        return;
      }

      const entry: NativeFileEntry = {
        name: entryHandle.name,
        path: path,
        type: entryHandle.kind as 'file' | 'directory',
        handle: entryHandle,
      };

      if (entryHandle.kind === 'file') {
        try {
          const file = await (entryHandle as FileSystemFileHandle).getFile();
          entry.size = file.size;
          entry.lastModified = file.lastModified;
          entry.mimeType = file.type;
        } catch (error) {
          // File might be locked or deleted
          entry.error = error instanceof Error ? error.message : String(error);
        }
      }

      entries.push(entry);

      // Recursive directory traversal
      if (options.recursive && entryHandle.kind === 'directory') {
        try {
          const childEntries = (entryHandle as FileSystemDirectoryHandle).values();
          for await (const childHandle of childEntries) {
            await processEntry(childHandle, path);
          }
        } catch (error) {
          // Directory might be inaccessible
          entry.error = error instanceof Error ? error.message : String(error);
        }
      }
    };

    // Process all entries
    const handleEntries = handle.values();
    for await (const entryHandle of handleEntries) {
      await processEntry(entryHandle);
    }

    return entries;
  }

  private applyFilters(entries: FileEntry[], options: ListDirectoryOptions): FileEntry[] {
    if (!options.filter) {
      return entries;
    }

    return entries.filter(entry => {
      // Apply glob pattern or regex filter
      if (typeof options.filter === 'string') {
        // Simple glob pattern
        const pattern = options.filter
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        const regex = new RegExp(`^${pattern}$`);
        return regex.test(entry.name);
      } else if (options.filter instanceof RegExp) {
        return options.filter.test(entry.name);
      } else if (typeof options.filter === 'function') {
        return options.filter(entry);
      }

      return true;
    });
  }

  // File Watching
  async watchPath(path: string, callback: (event: WatchEvent) => void, options: WatchOptions = {}): Promise<WatchHandle> {
    const watchOptions = {
      recursive: options.recursive || false,
      events: options.events || ['create', 'modify', 'delete', 'rename'],
      ...options,
    };

    // Native file system watching not widely supported yet
    // Use server-based watching
    if (this.ws) {
      const watcher = await this.ws.watchPath(path, (event: any) => {
        // Filter events
        if (watchOptions.events.includes(event.type)) {
          callback(event as WatchEvent);
        }
      }, watchOptions);

      this.watchers.set(watcher.watchId, watcher);

      return watcher;
    }

    throw new Error('File watching requires server connection');
  }

  async unwatchPath(watcherId: string): Promise<void> {
    const watcher = this.watchers.get(watcherId);
    if (watcher) {
      await watcher.unwatch();
      this.watchers.delete(watcherId);
    }
  }

  // Permission Management
  hasReadPermission(path: string): boolean {
    // Check if we have a handle with read permission
    const handle = this.findHandleForPath(path);
    if (handle) {
      return true;
    }

    // Check stored permissions
    const permission = this.permissions.get(path);
    return permission ? permission.read : false;
  }

  hasWritePermission(path: string): boolean {
    // Check stored permissions
    const permission = this.permissions.get(path);
    return permission ? permission.write : false;
  }

  async requestPermission(path: string, mode: 'read' | 'write' = 'read'): Promise<boolean> {
    const handle = this.findHandleForPath(path);
    if (!handle) {
      throw new Error('No handle found for path');
    }

    // Request permission for native handles
    if ('requestPermission' in handle) {
      const permission = await handle.requestPermission({
        mode: mode === 'write' ? 'readwrite' : 'read',
      });

      if (permission === 'granted') {
        const perms = this.permissions.get(path) || { read: false, write: false };
        perms[mode] = true;
        this.permissions.set(path, perms);
        return true;
      }
    }

    return false;
  }

  // Utility Methods
  private findHandleForPath(path: string): FileSystemHandle | null {
    // Try exact match first
    if (this.handles.has(path)) {
      return this.handles.get(path) || null;
    }

    // Try to find parent directory
    const parts = path.split('/');
    while (parts.length > 0) {
      const parentPath = parts.join('/');
      if (this.handles.has(parentPath)) {
        return this.handles.get(parentPath) || null;
      }
      parts.pop();
    }

    return null;
  }

  private async indexDirectory(directoryHandle: FileSystemDirectoryHandle, parentPath: string = ''): Promise<void> {
    const entries = directoryHandle.values();
    for await (const entry of entries) {
      const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;
      this.handles.set(path, entry);

      if (entry.kind === 'directory') {
        await this.indexDirectory(entry as FileSystemDirectoryHandle, path);
      }
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Path utilities
  normalizePath(path: string): string {
    // Remove redundant slashes and resolve . and ..
    const parts = path.split('/').filter(p => p && p !== '.');
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return '/' + resolved.join('/');
  }

  joinPath(...parts: string[]): string {
    return this.normalizePath(parts.join('/'));
  }

  dirname(path: string): string {
    const parts = path.split('/');
    parts.pop();
    return parts.join('/') || '/';
  }

  basename(path: string): string {
    return path.split('/').pop() || '';
  }

  extname(path: string): string {
    const base = this.basename(path);
    const dot = base.lastIndexOf('.');
    return dot > 0 ? base.substring(dot) : '';
  }

  // Cleanup
  clear(): void {
    this.handles.clear();
    this.permissions.clear();

    // Unwatch all paths
    for (const watcherId of this.watchers.keys()) {
      this.unwatchPath(watcherId);
    }
  }

  destroy(): void {
    this.clear();
    this.ws = null;
    this.cache = null;
  }
}

export default FileSystemProvider;