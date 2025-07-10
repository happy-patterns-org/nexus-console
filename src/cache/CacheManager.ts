/**
 * Cache Manager - Multi-tier caching for terminal performance
 * Implements memory cache, IndexedDB persistence, and compression
 */

import type { CacheStats, FileEntry, CommandHistory, TerminalSession } from '../types';

export interface CacheManagerConfig {
  memoryLimit?: number;
  dbName?: string;
  dbVersion?: number;
  defaultTTL?: number;
  compressionThreshold?: number;
  enableCompression?: boolean;
}

export interface CacheEntry<T = any> {
  data: T;
  size: number;
  expires?: number;
  metadata?: any;
}

export interface FileCacheEntry {
  path: string;
  content: ArrayBuffer | string;
  compressed: boolean;
  expires: number;
  accessed: number;
  size: number;
  compressedSize?: number;
  metadata?: any;
}

export interface DirectoryCacheEntry {
  path: string;
  entries: FileEntry[];
  expires: number;
  accessed: number;
  count: number;
}

export interface SessionSnapshot extends Partial<TerminalSession> {
  id: string;
  lastAccessed: number;
}

interface CacheMetrics {
  timestamp: number;
  hits: number;
  misses: number;
  evictions: number;
  compressions: number;
  decompressions: number;
  memoryCacheSize: number;
  memoryCacheEntries: number;
}

class CacheManager {
  private config: Required<CacheManagerConfig>;
  private memoryCache: Map<string, CacheEntry>;
  private memoryCacheSize: number;
  private memoryCacheOrder: string[];
  private db: IDBDatabase | null;
  private stats: Omit<CacheStats, 'hitRate' | 'memoryCacheSize' | 'memoryCacheEntries' | 'memoryLimit'>;
  private compressionAvailable: boolean;
  private initialized: boolean;
  private cleanupInterval?: ReturnType<typeof setInterval>;

  constructor(config: CacheManagerConfig = {}) {
    this.config = {
      memoryLimit: config.memoryLimit || 50 * 1024 * 1024, // 50MB
      dbName: config.dbName || 'NexusTerminalCache',
      dbVersion: config.dbVersion || 1,
      defaultTTL: config.defaultTTL || 300000, // 5 minutes
      compressionThreshold: config.compressionThreshold || 1024, // 1KB
      enableCompression: config.enableCompression !== false,
    };

    // Memory cache (LRU)
    this.memoryCache = new Map();
    this.memoryCacheSize = 0;
    this.memoryCacheOrder = [];

    // IndexedDB instance
    this.db = null;

    // Cache statistics
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
    };

    // Compression streams availability
    this.compressionAvailable = typeof CompressionStream !== 'undefined';

    // Initialize flag
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Initialize IndexedDB
      await this.initializeDB();

      // Clean up expired entries
      await this.cleanupExpired();

      // Set up periodic cleanup
      this.startPeriodicCleanup();

      this.initialized = true;

    } catch (error) {
      console.error('Failed to initialize cache:', error);
      // Cache can still work with just memory cache
      this.initialized = true;
    }
  }

  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // File content store
        if (!db.objectStoreNames.contains('files')) {
          const fileStore = db.createObjectStore('files', { keyPath: 'path' });
          fileStore.createIndex('expires', 'expires', { unique: false });
          fileStore.createIndex('accessed', 'accessed', { unique: false });
        }

        // Directory listing store
        if (!db.objectStoreNames.contains('directories')) {
          const dirStore = db.createObjectStore('directories', { keyPath: 'path' });
          dirStore.createIndex('expires', 'expires', { unique: false });
        }

        // Command history store
        if (!db.objectStoreNames.contains('history')) {
          const historyStore = db.createObjectStore('history', { autoIncrement: true });
          historyStore.createIndex('sessionId', 'sessionId', { unique: false });
          historyStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Session snapshots store
        if (!db.objectStoreNames.contains('sessions')) {
          const sessionStore = db.createObjectStore('sessions', { keyPath: 'id' });
          sessionStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
        }

        // Metrics store
        if (!db.objectStoreNames.contains('metrics')) {
          db.createObjectStore('metrics', { keyPath: 'timestamp' });
        }
      };
    });
  }

  // File caching
  async getFile(path: string): Promise<string | null> {
    const cacheKey = `file:${path}`;

    // Check memory cache first
    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult !== null) {
      this.stats.hits++;
      return memoryResult as string;
    }

    // Check IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(path);

        const result = await this.promisifyRequest<FileCacheEntry>(request);
        if (result && result.expires > Date.now()) {
          this.stats.hits++;

          // Update access time
          this.updateFileAccess(path);

          // Decompress if needed
          let content = result.content;
          if (result.compressed && typeof content !== 'string') {
            content = await this.decompress(content);
          }

          // Add to memory cache
          this.addToMemory(cacheKey, content, result.metadata);

          return content as string;
        }
      } catch (error) {
        console.error('Failed to get file from cache:', error);
      }
    }

    this.stats.misses++;
    return null;
  }

  async cacheFile(path: string, content: string, options: { ttl?: number; metadata?: any } = {}): Promise<void> {
    const cacheKey = `file:${path}`;
    const ttl = options.ttl || this.config.defaultTTL;
    const expires = Date.now() + ttl;

    // Add to memory cache
    this.addToMemory(cacheKey, content, {
      path,
      expires,
      size: content.length,
      ...options.metadata,
    });

    // Add to IndexedDB
    if (this.db) {
      try {
        let storedContent: string | ArrayBuffer = content;
        let compressed = false;

        // Compress if needed
        if (this.shouldCompress(content)) {
          storedContent = await this.compress(content);
          compressed = true;
        }

        const entry: FileCacheEntry = {
          path,
          content: storedContent,
          compressed,
          expires,
          accessed: Date.now(),
          size: content.length,
          compressedSize: compressed ? (storedContent as ArrayBuffer).byteLength : content.length,
          metadata: options.metadata || {},
        };

        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await this.promisifyRequest(store.put(entry));

      } catch (error) {
        console.error('Failed to cache file:', error);
      }
    }
  }

  async invalidateFile(path: string): Promise<void> {
    const cacheKey = `file:${path}`;

    // Remove from memory cache
    this.removeFromMemory(cacheKey);

    // Remove from IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await this.promisifyRequest(store.delete(path));
      } catch (error) {
        console.error('Failed to invalidate file:', error);
      }
    }
  }

  // Directory caching
  async getDirectory(path: string): Promise<FileEntry[] | null> {
    const cacheKey = `dir:${path}`;

    // Check memory cache first
    const memoryResult = this.getFromMemory(cacheKey);
    if (memoryResult !== null) {
      this.stats.hits++;
      return memoryResult as FileEntry[];
    }

    // Check IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction(['directories'], 'readonly');
        const store = transaction.objectStore('directories');
        const request = store.get(path);

        const result = await this.promisifyRequest<DirectoryCacheEntry>(request);
        if (result && result.expires > Date.now()) {
          this.stats.hits++;

          // Add to memory cache
          this.addToMemory(cacheKey, result.entries, {
            path,
            expires: result.expires,
          });

          return result.entries;
        }
      } catch (error) {
        console.error('Failed to get directory from cache:', error);
      }
    }

    this.stats.misses++;
    return null;
  }

  async cacheDirectory(path: string, entries: FileEntry[], options: { ttl?: number } = {}): Promise<void> {
    const cacheKey = `dir:${path}`;
    const ttl = options.ttl || this.config.defaultTTL;
    const expires = Date.now() + ttl;

    // Add to memory cache
    this.addToMemory(cacheKey, entries, {
      path,
      expires,
      count: entries.length,
    });

    // Add to IndexedDB
    if (this.db) {
      try {
        const entry: DirectoryCacheEntry = {
          path,
          entries,
          expires,
          accessed: Date.now(),
          count: entries.length,
        };

        const transaction = this.db.transaction(['directories'], 'readwrite');
        const store = transaction.objectStore('directories');
        await this.promisifyRequest(store.put(entry));

      } catch (error) {
        console.error('Failed to cache directory:', error);
      }
    }
  }

  async invalidateDirectory(path: string): Promise<void> {
    const cacheKey = `dir:${path}`;

    // Remove from memory cache
    this.removeFromMemory(cacheKey);

    // Also invalidate all subdirectories
    for (const [key] of this.memoryCache) {
      if (key.startsWith(`dir:${path}/`)) {
        this.removeFromMemory(key);
      }
    }

    // Remove from IndexedDB
    if (this.db) {
      try {
        const transaction = this.db.transaction(['directories'], 'readwrite');
        const store = transaction.objectStore('directories');

        // Delete exact match
        await this.promisifyRequest(store.delete(path));

        // Delete subdirectories - would need cursor iteration
        // Simplified for now - in production would iterate with cursor

      } catch (error) {
        console.error('Failed to invalidate directory:', error);
      }
    }
  }

  // Command history
  async addCommandToHistory(sessionId: string, command: string): Promise<void> {
    if (!this.db) return;

    try {
      const entry: CommandHistory = {
        sessionId,
        command,
        timestamp: Date.now(),
      };

      const transaction = this.db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      await this.promisifyRequest(store.add(entry));

      // Limit history size per session
      await this.pruneHistory(sessionId, 1000);

    } catch (error) {
      console.error('Failed to add command to history:', error);
    }
  }

  async getCommandHistory(sessionId: string, limit: number = 100): Promise<string[]> {
    if (!this.db) return [];

    try {
      const transaction = this.db.transaction(['history'], 'readonly');
      const store = transaction.objectStore('history');
      const index = store.index('sessionId');

      const commands: string[] = [];
      const request = index.openCursor(IDBKeyRange.only(sessionId), 'prev');

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result;
          if (cursor && commands.length < limit) {
            commands.push((cursor.value as CommandHistory).command);
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });

      return commands;

    } catch (error) {
      console.error('Failed to get command history:', error);
      return [];
    }
  }

  // Session management
  async saveSessionSnapshot(session: SessionSnapshot): Promise<void> {
    if (!this.db) return;

    try {
      const snapshot: SessionSnapshot = {
        ...session,
        lastAccessed: Date.now(),
      };

      const transaction = this.db.transaction(['sessions'], 'readwrite');
      const store = transaction.objectStore('sessions');
      await this.promisifyRequest(store.put(snapshot));

    } catch (error) {
      console.error('Failed to save session snapshot:', error);
    }
  }

  async getSessionSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
    if (!this.db) return null;

    try {
      const transaction = this.db.transaction(['sessions'], 'readonly');
      const store = transaction.objectStore('sessions');
      const request = store.get(sessionId);

      return await this.promisifyRequest<SessionSnapshot>(request);

    } catch (error) {
      console.error('Failed to get session snapshot:', error);
      return null;
    }
  }

  // Memory cache management
  private getFromMemory(key: string): any {
    const entry = this.memoryCache.get(key);
    if (!entry) {
      return null;
    }

    // Check expiration
    if (entry.expires && entry.expires < Date.now()) {
      this.removeFromMemory(key);
      return null;
    }

    // Update LRU order
    const index = this.memoryCacheOrder.indexOf(key);
    if (index > -1) {
      this.memoryCacheOrder.splice(index, 1);
    }
    this.memoryCacheOrder.push(key);

    return entry.data;
  }

  private addToMemory(key: string, data: any, metadata: any = {}): void {
    const size = this.estimateSize(data);

    // Evict old entries if needed
    while (this.memoryCacheSize + size > this.config.memoryLimit && this.memoryCacheOrder.length > 0) {
      const oldestKey = this.memoryCacheOrder.shift()!;
      this.removeFromMemory(oldestKey);
      this.stats.evictions++;
    }

    // Add new entry
    this.memoryCache.set(key, {
      data,
      size,
      expires: metadata.expires,
      metadata,
    });

    this.memoryCacheSize += size;
    this.memoryCacheOrder.push(key);
  }

  private removeFromMemory(key: string): void {
    const entry = this.memoryCache.get(key);
    if (entry) {
      this.memoryCacheSize -= entry.size;
      this.memoryCache.delete(key);

      const index = this.memoryCacheOrder.indexOf(key);
      if (index > -1) {
        this.memoryCacheOrder.splice(index, 1);
      }
    }
  }

  // Compression
  private shouldCompress(content: string | ArrayBuffer): boolean {
    if (!this.config.enableCompression || !this.compressionAvailable) {
      return false;
    }

    const size = typeof content === 'string' ? content.length : content.byteLength;
    return size > this.config.compressionThreshold;
  }

  private async compress(content: string): Promise<ArrayBuffer> {
    if (!this.compressionAvailable) {
      return new TextEncoder().encode(content).buffer;
    }

    try {
      const stream = new CompressionStream('gzip');
      const writer = stream.writable.getWriter();

      const encoder = new TextEncoder();
      writer.write(encoder.encode(content));
      writer.close();

      const compressed = await new Response(stream.readable).arrayBuffer();
      this.stats.compressions++;

      return compressed;

    } catch (error) {
      console.error('Compression failed:', error);
      return new TextEncoder().encode(content).buffer;
    }
  }

  private async decompress(compressed: ArrayBuffer): Promise<string> {
    if (!this.compressionAvailable) {
      return new TextDecoder().decode(compressed);
    }

    try {
      const stream = new DecompressionStream('gzip');
      const writer = stream.writable.getWriter();
      writer.write(compressed);
      writer.close();

      const decompressed = await new Response(stream.readable).arrayBuffer();
      const decoder = new TextDecoder();
      const text = decoder.decode(decompressed);

      this.stats.decompressions++;

      return text;

    } catch (error) {
      console.error('Decompression failed:', error);
      return new TextDecoder().decode(compressed);
    }
  }

  // Cleanup
  private async cleanupExpired(): Promise<void> {
    if (!this.db) return;

    try {
      const now = Date.now();

      // Clean files
      const fileTransaction = this.db.transaction(['files'], 'readwrite');
      const fileStore = fileTransaction.objectStore('files');
      const fileIndex = fileStore.index('expires');
      const fileRange = IDBKeyRange.upperBound(now);

      await this.deleteByIndex(fileIndex, fileRange);

      // Clean directories
      const dirTransaction = this.db.transaction(['directories'], 'readwrite');
      const dirStore = dirTransaction.objectStore('directories');
      const dirIndex = dirStore.index('expires');
      const dirRange = IDBKeyRange.upperBound(now);

      await this.deleteByIndex(dirIndex, dirRange);

    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }

  private async deleteByIndex(index: IDBIndex, range: IDBKeyRange): Promise<void> {
    const request = index.openCursor(range);

    await new Promise<void>((resolve, reject) => {
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  private startPeriodicCleanup(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  private async pruneHistory(sessionId: string, maxEntries: number): Promise<void> {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['history'], 'readwrite');
      const store = transaction.objectStore('history');
      const index = store.index('sessionId');

      const countRequest = index.count(sessionId);
      const count = await this.promisifyRequest<number>(countRequest);

      if (count > maxEntries) {
        const toDelete = count - maxEntries;
        const cursor = index.openCursor(IDBKeyRange.only(sessionId));

        let deleted = 0;
        await new Promise<void>((resolve, reject) => {
          cursor.onsuccess = (event) => {
            const result = (event.target as IDBRequest).result;
            if (result && deleted < toDelete) {
              result.delete();
              result.continue();
              deleted++;
            } else {
              resolve();
            }
          };
          cursor.onerror = () => reject(cursor.error);
        });
      }

    } catch (error) {
      console.error('Failed to prune history:', error);
    }
  }

  // Utilities
  private estimateSize(data: any): number {
    if (typeof data === 'string') {
      return data.length * 2; // Rough estimate for UTF-16
    } else if (data instanceof ArrayBuffer) {
      return data.byteLength;
    } else if (data instanceof Uint8Array) {
      return data.byteLength;
    } else if (typeof data === 'object') {
      return JSON.stringify(data).length * 2;
    }
    return 0;
  }

  private promisifyRequest<T = any>(request: IDBRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private updateFileAccess(path: string): void {
    if (!this.db) return;

    // Update access time asynchronously
    setTimeout(async () => {
      try {
        const transaction = this.db!.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.get(path);

        const file = await this.promisifyRequest<FileCacheEntry>(request);
        if (file) {
          file.accessed = Date.now();
          await this.promisifyRequest(store.put(file));
        }
      } catch (error) {
        // Silent fail - not critical
      }
    }, 0);
  }

  // Metrics
  async saveMetrics(): Promise<void> {
    if (!this.db) return;

    try {
      const metrics: CacheMetrics = {
        timestamp: Date.now(),
        ...this.stats,
        memoryCacheSize: this.memoryCacheSize,
        memoryCacheEntries: this.memoryCache.size,
      };

      const transaction = this.db.transaction(['metrics'], 'readwrite');
      const store = transaction.objectStore('metrics');
      await this.promisifyRequest(store.put(metrics));

    } catch (error) {
      console.error('Failed to save metrics:', error);
    }
  }

  getStats(): CacheStats {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
      : 0;

    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      memoryCacheSize: this.formatBytes(this.memoryCacheSize),
      memoryCacheEntries: this.memoryCache.size,
      memoryLimit: this.formatBytes(this.config.memoryLimit),
    };
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Clear all caches
  async clear(): Promise<void> {
    // Clear memory cache
    this.memoryCache.clear();
    this.memoryCacheOrder = [];
    this.memoryCacheSize = 0;

    // Clear IndexedDB
    if (this.db) {
      try {
        const stores = ['files', 'directories', 'history', 'sessions', 'metrics'];

        for (const storeName of stores) {
          const transaction = this.db.transaction([storeName], 'readwrite');
          const store = transaction.objectStore(storeName);
          await this.promisifyRequest(store.clear());
        }
      } catch (error) {
        console.error('Failed to clear cache:', error);
      }
    }

    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      compressions: 0,
      decompressions: 0,
    };
  }

  // Cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.memoryCache.clear();
    this.memoryCacheOrder = [];
    this.memoryCacheSize = 0;
  }
}

export default CacheManager;