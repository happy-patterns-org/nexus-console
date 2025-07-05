/**
 * Type definitions for Nexus Console
 */

export interface NexusConsoleConfig {
  container: HTMLElement | string;
  theme?: 'nexus-dark' | 'nexus-light' | string;
  position?: 'bottom' | 'right' | 'fullscreen' | 'floating';
  fontSize?: number;
  fontFamily?: string;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollback?: number;
  tabStopWidth?: number;
  bellStyle?: 'none' | 'sound' | 'visual' | 'both';
  wsUrl?: string;
  enableFileSystem?: boolean;
  enableCache?: boolean;
  securityLevel?: 'strict' | 'standard' | 'permissive';
  showToolbar?: boolean;
  showTabs?: boolean;
  showStatusBar?: boolean;
  resizable?: boolean;
  animations?: boolean;
}

export interface TerminalSession {
  id: string;
  options: SessionOptions;
  created: number;
  active: boolean;
  buffer: Uint8Array[];
  history: CommandHistory[];
  cwd: string;
  pid?: number;
  exitCode?: number;
  signal?: string;
}

export interface SessionOptions {
  shell?: string;
  cols?: number;
  rows?: number;
  cwd?: string;
  env?: Record<string, string>;
  encoding?: string;
}

export interface CommandHistory {
  command: string;
  timestamp: number;
}

export interface FileSystemAccessOptions {
  path?: string;
  mode?: 'read' | 'write' | 'readwrite';
  recursive?: boolean;
  startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
}

export interface FileEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  lastModified?: number;
  mimeType?: string;
  error?: string;
}

export interface SecurityRule {
  pattern: RegExp;
  action: 'block' | 'remove' | 'transform';
  replacement?: string;
  message?: string;
}

export interface CommandHistory {
  command: string;
  timestamp: number;
  sessionId?: string;
}

export interface TerminalMetrics {
  initialized: boolean;
  initTime: number;
  commandCount: number;
  sessions: number;
  activeSession: string | null;
  connected: boolean;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  averageLatency: number;
  fps?: number;
  cacheHitRate?: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  compressions: number;
  decompressions: number;
  hitRate: string;
  memoryCacheSize: string;
  memoryCacheEntries: number;
  memoryLimit: string;
}

export type TerminalEvent = 
  | 'initialized'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error'
  | 'session_created'
  | 'session_attached'
  | 'session_detached'
  | 'session_closed'
  | 'command_executed'
  | 'title_changed'
  | 'selection_changed'
  | 'performance_update'
  | 'resized'
  | 'shown'
  | 'hidden'
  | 'maximized'
  | 'restored'
  | 'destroyed';

export interface TerminalEventData {
  initialized: void;
  connected: void;
  disconnected: { code: number; reason: string };
  reconnecting: { attempt: number; delay: number };
  error: Error;
  session_created: { sessionId: string; options?: SessionOptions };
  session_attached: { sessionId: string };
  session_detached: { sessionId: string };
  session_closed: { sessionId: string; exitCode?: number; signal?: string };
  command_executed: { sessionId: string; command: string; timestamp: number };
  title_changed: { title: string };
  selection_changed: void;
  performance_update: { fps: number; totalFrames?: number };
  resized: { width: number; height: number };
  shown: void;
  hidden: void;
  maximized: void;
  restored: void;
  destroyed: void;
}