/**
 * Terminal WebSocket Manager - Enhanced for PTY integration
 * Extends the base WebSocket infrastructure with terminal-specific features
 */

import type { 
  TerminalSession, 
  SessionOptions, 
  FileEntry,
  TerminalEventData 
} from '../types';

export interface WebSocketConfig {
  wsUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface WebSocketState {
  connected: boolean;
  connecting: boolean;
  authenticated: boolean;
}

export interface WebSocketMetrics {
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  latency: number[];
  averageLatency?: number;
  activeSessions?: number;
}

export interface PtyMessage {
  type: string;
  sessionId?: string;
  data?: number[] | Uint8Array;
  timestamp?: number;
  id?: string;
  [key: string]: any;
}

export interface PtyOutputEvent {
  sessionId: string;
  data: Uint8Array;
}

export interface SessionClosedEvent {
  sessionId: string;
  exitCode?: number;
  signal?: string;
}

export interface ReconnectingEvent {
  attempt: number;
  delay: number;
}

export interface FileSystemAccessOptions {
  path?: string;
  mode?: 'read' | 'write' | 'readwrite';
  recursive?: boolean;
}

export interface FileReadOptions {
  encoding?: string;
  offset?: number;
  length?: number;
}

export interface FileWriteOptions {
  encoding?: string;
  mode?: 'overwrite' | 'append';
  createDirectories?: boolean;
}

export interface DirectoryListOptions {
  recursive?: boolean;
  includeHidden?: boolean;
  filter?: string | null;
}

export interface WatchOptions {
  recursive?: boolean;
  events?: Array<'create' | 'modify' | 'delete' | 'rename'>;
}

export interface WatchHandle {
  watchId: string;
  unwatch: () => Promise<void>;
}

type EventCallback<T = any> = (data: T) => void;

interface PendingResponse {
  resolve: (response: any) => void;
  reject: (error: Error) => void;
}

class TerminalWebSocketManager {
  private config: Required<WebSocketConfig>;
  private ws: WebSocket | null;
  private reconnectAttempts: number;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private sessions: Map<string, TerminalSession>;
  private activeSession: string | null;
  private messageQueue: PtyMessage[];
  private pendingResponses: Map<string, PendingResponse>;
  private listeners: Map<string, Set<EventCallback>>;
  private state: WebSocketState;
  private metrics: WebSocketMetrics;

  constructor(config: WebSocketConfig = {}) {
    this.config = {
      wsUrl: config.wsUrl || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/terminal/ws`,
      reconnectInterval: config.reconnectInterval || 3000,
      maxReconnectAttempts: config.maxReconnectAttempts || 10,
      heartbeatInterval: config.heartbeatInterval || 30000,
    };

    this.ws = null;
    this.reconnectAttempts = 0;
    this.reconnectTimer = undefined;
    this.heartbeatTimer = undefined;

    // PTY session management
    this.sessions = new Map();
    this.activeSession = null;

    // Message queues
    this.messageQueue = [];
    this.pendingResponses = new Map();

    // Event emitter pattern
    this.listeners = new Map();

    // Connection state
    this.state = {
      connected: false,
      connecting: false,
      authenticated: false,
    };

    // Performance tracking
    this.metrics = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      latency: [],
    };
  }

  // Connection Management
  async connect(): Promise<void> {
    if (this.state.connecting || this.state.connected) {
      return;
    }

    this.state.connecting = true;
    this.emit('connecting');

    try {
      // Get authentication token
      const token = await this.getAuthToken();

      // Establish WebSocket connection
      const url = new URL(this.config.wsUrl);
      url.searchParams.set('token', token);

      this.ws = new WebSocket(url.toString());
      this.ws.binaryType = 'arraybuffer';

      this.setupEventHandlers();

      // Wait for connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);

        if (!this.ws) {
          clearTimeout(timeout);
          reject(new Error('WebSocket not initialized'));
          return;
        }

        this.ws.onopen = () => {
          clearTimeout(timeout);
          resolve();
        };

        this.ws.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('WebSocket connection error'));
        };
      });

    } catch (error) {
      this.state.connecting = false;
      this.handleConnectionError(error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      this.state.connected = true;
      this.state.connecting = false;
      this.reconnectAttempts = 0;

      this.emit('connected');
      this.startHeartbeat();
      this.flushMessageQueue();
    };

    this.ws.onmessage = (event) => {
      this.handleMessage(event);
    };

    this.ws.onerror = (error) => {
      this.emit('error', error);
    };

    this.ws.onclose = (event) => {
      this.state.connected = false;
      this.state.authenticated = false;
      this.stopHeartbeat();

      this.emit<TerminalEventData['disconnected']>('disconnected', {
        code: event.code,
        reason: event.reason,
      });

      // Auto-reconnect if not a clean close
      if (!event.wasClean && this.reconnectAttempts < this.config.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };
  }

  private handleMessage(event: MessageEvent): void {
    this.metrics.messagesReceived++;

    let message: PtyMessage;

    // Handle binary data (PTY output)
    if (event.data instanceof ArrayBuffer) {
      const data = new Uint8Array(event.data);
      this.metrics.bytesTransferred += data.length;

      message = {
        type: 'pty_output',
        sessionId: this.activeSession || undefined,
        data: data,
      };
    } else {
      // Handle text messages (control protocol)
      try {
        message = JSON.parse(event.data as string);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
        return;
      }
    }

    // Update latency metrics
    if (message.timestamp) {
      const latency = Date.now() - message.timestamp;
      this.metrics.latency.push(latency);
      if (this.metrics.latency.length > 100) {
        this.metrics.latency.shift();
      }
    }

    // Route message
    switch (message.type) {
      case 'pty_output':
        this.handlePtyOutput(message);
        break;

      case 'session_created':
        this.handleSessionCreated(message);
        break;

      case 'session_closed':
        this.handleSessionClosed(message);
        break;

      case 'error':
        this.handleError(message);
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        // Check for pending response handlers
        if (message.id && this.pendingResponses.has(message.id)) {
          const handler = this.pendingResponses.get(message.id);
          this.pendingResponses.delete(message.id);
          handler?.resolve(message);
        } else {
          // Emit as generic event
          this.emit('message', message);
        }
    }
  }

  // PTY Session Management
  async createPtySession(options: SessionOptions = {}): Promise<string> {
    const sessionId = this.generateSessionId();

    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'create_pty',
      sessionId,
      config: {
        shell: options.shell || (navigator.platform.includes('Win') ? 'powershell.exe' : '/bin/bash'),
        cols: options.cols || 80,
        rows: options.rows || 24,
        cwd: options.cwd || null,
        env: options.env || {},
        encoding: options.encoding || 'utf8',
      },
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      const session: TerminalSession = {
        id: sessionId,
        options: request.config,
        created: Date.now(),
        active: true,
        buffer: [],
        history: [],
        cwd: options.cwd || process.cwd?.() || '/',
      };

      this.sessions.set(sessionId, session);
      this.activeSession = sessionId;
      this.emit<TerminalEventData['session_created']>('session_created', { sessionId, options });

      return sessionId;
    } else {
      throw new Error(response.error || 'Failed to create PTY session');
    }
  }

  async resizePty(sessionId: string, cols: number, rows: number): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    const request: PtyMessage = {
      type: 'resize_pty',
      sessionId,
      cols,
      rows,
    };

    this.send(request);

    // Update local session info
    const session = this.sessions.get(sessionId);
    if (session) {
      session.options.cols = cols;
      session.options.rows = rows;
    }
  }

  sendPtyInput(sessionId: string, data: string): void {
    if (!this.sessions.has(sessionId)) {
      throw new Error('Invalid session ID');
    }

    // Convert string to ArrayBuffer for binary safety
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);

    const message: PtyMessage = {
      type: 'pty_input',
      sessionId,
      data: Array.from(buffer), // Convert to array for JSON serialization
    };

    this.send(message);
  }

  async closePtySession(sessionId: string): Promise<void> {
    if (!this.sessions.has(sessionId)) {
      return;
    }

    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'close_pty',
      sessionId,
    };

    await this.sendAndWait(request);

    this.sessions.delete(sessionId);

    if (this.activeSession === sessionId) {
      this.activeSession = null;
    }

    this.emit<TerminalEventData['session_closed']>('session_closed', { sessionId });
  }

  // File System Operations
  async requestFileSystemAccess(options: FileSystemAccessOptions = {}): Promise<string> {
    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_request_access',
      path: options.path || '/',
      mode: options.mode || 'read',
      recursive: options.recursive || false,
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      return response.handle;
    } else {
      throw new Error(response.error || 'File system access denied');
    }
  }

  async readFile(path: string, options: FileReadOptions = {}): Promise<string> {
    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_read',
      path,
      encoding: options.encoding || 'utf8',
      offset: options.offset || 0,
      length: options.length || -1,
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      return response.content;
    } else {
      throw new Error(response.error || 'Failed to read file');
    }
  }

  async writeFile(path: string, content: string, options: FileWriteOptions = {}): Promise<number> {
    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_write',
      path,
      content,
      encoding: options.encoding || 'utf8',
      mode: options.mode || 'overwrite',
      createDirectories: options.createDirectories || false,
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      return response.bytesWritten;
    } else {
      throw new Error(response.error || 'Failed to write file');
    }
  }

  async listDirectory(path: string, options: DirectoryListOptions = {}): Promise<FileEntry[]> {
    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_list',
      path,
      recursive: options.recursive || false,
      includeHidden: options.includeHidden || false,
      filter: options.filter || null,
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      return response.entries;
    } else {
      throw new Error(response.error || 'Failed to list directory');
    }
  }

  // Watch for file system changes
  async watchPath(path: string, callback: EventCallback, options: WatchOptions = {}): Promise<WatchHandle> {
    const watchId = this.generateSessionId();

    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_watch',
      watchId,
      path,
      recursive: options.recursive || false,
      events: options.events || ['create', 'modify', 'delete', 'rename'],
    };

    const response = await this.sendAndWait(request);

    if (response.success) {
      // Register callback for watch events
      this.on(`fs_change:${watchId}`, callback);

      return {
        watchId,
        unwatch: () => this.unwatchPath(watchId),
      };
    } else {
      throw new Error(response.error || 'Failed to watch path');
    }
  }

  private async unwatchPath(watchId: string): Promise<void> {
    const request: PtyMessage = {
      id: this.generateMessageId(),
      type: 'fs_unwatch',
      watchId,
    };

    await this.sendAndWait(request);

    // Remove event listeners
    this.removeAllListeners(`fs_change:${watchId}`);
  }

  // Message Handling
  private send(message: PtyMessage): void {
    if (!this.state.connected) {
      this.messageQueue.push(message);
      return;
    }

    if (!this.ws) {
      throw new Error('WebSocket not initialized');
    }

    // Add timestamp for latency tracking
    message.timestamp = Date.now();

    const data = JSON.stringify(message);
    this.ws.send(data);

    this.metrics.messagesSent++;
    this.metrics.bytesTransferred += data.length;
  }

  private async sendAndWait(message: PtyMessage, timeout: number = 30000): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = message.id || this.generateMessageId();
      message.id = id;

      const timer = setTimeout(() => {
        this.pendingResponses.delete(id);
        reject(new Error('Request timeout'));
      }, timeout);

      this.pendingResponses.set(id, {
        resolve: (response) => {
          clearTimeout(timer);
          resolve(response);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });

      this.send(message);
    });
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.state.connected) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  // Event Handlers
  private handlePtyOutput(message: PtyMessage): void {
    if (!message.sessionId) return;

    const session = this.sessions.get(message.sessionId);
    if (!session) {
      return;
    }

    // Convert array back to Uint8Array
    const data = message.data instanceof Uint8Array 
      ? message.data 
      : new Uint8Array(message.data as number[]);

    this.emit<PtyOutputEvent>('pty_output', {
      sessionId: message.sessionId,
      data: data,
    });
  }

  private handleSessionCreated(message: PtyMessage): void {
    if (!message.sessionId) return;

    const session = this.sessions.get(message.sessionId);
    if (session) {
      session.pid = message.pid;
      session.active = true;
    }
  }

  private handleSessionClosed(message: PtyMessage): void {
    if (!message.sessionId) return;

    this.sessions.delete(message.sessionId);

    if (this.activeSession === message.sessionId) {
      this.activeSession = null;
    }

    this.emit<SessionClosedEvent>('session_closed', {
      sessionId: message.sessionId,
      exitCode: message.exitCode,
      signal: message.signal,
    });
  }

  private handleError(message: PtyMessage): void {
    console.error('Terminal WebSocket error:', message.error);

    // Check if error is related to a pending request
    if (message.id && this.pendingResponses.has(message.id)) {
      const handler = this.pendingResponses.get(message.id);
      this.pendingResponses.delete(message.id);
      handler?.reject(new Error(message.error));
    } else {
      this.emit('error', new Error(message.error));
    }
  }

  private handleConnectionError(error: unknown): void {
    console.error('WebSocket connection error:', error);
    this.emit('error', error instanceof Error ? error : new Error(String(error)));
  }

  // Heartbeat
  private startHeartbeat(): void {
    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.state.connected) {
        this.send({ type: 'ping' });
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }
  }

  // Reconnection
  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.reconnectAttempts++;

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      30000
    );

    this.emit<ReconnectingEvent>('reconnecting', {
      attempt: this.reconnectAttempts,
      delay,
    });

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
      });
    }, delay);
  }

  // Authentication
  private async getAuthToken(): Promise<string> {
    // Get token from session storage or request new one
    let token = sessionStorage.getItem('terminal_auth_token');

    if (!token || this.isTokenExpired(token)) {
      token = await this.requestNewToken();
      sessionStorage.setItem('terminal_auth_token', token);
    }

    return token;
  }

  private async requestNewToken(): Promise<string> {
    const response = await fetch('/api/terminal/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to authenticate');
    }

    const data = await response.json();
    return data.token;
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }

  // Event Emitter
  on<T = any>(event: string, callback: EventCallback<T>): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
  }

  off<T = any>(event: string, callback: EventCallback<T>): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  emit<T = any>(event: string, data?: T): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  // Utilities
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods
  getActiveSession(): string | null {
    return this.activeSession;
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): Map<string, TerminalSession> {
    return new Map(this.sessions);
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  // Cleanup
  disconnect(): void {
    this.stopHeartbeat();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state.connected = false;
    this.state.connecting = false;
    this.messageQueue = [];
    this.pendingResponses.clear();
  }

  destroy(): void {
    this.disconnect();
    this.removeAllListeners();
    this.sessions.clear();
    this.activeSession = null;
  }

  // Metrics
  getMetrics(): WebSocketMetrics {
    const avgLatency = this.metrics.latency.length > 0
      ? this.metrics.latency.reduce((a, b) => a + b, 0) / this.metrics.latency.length
      : 0;

    return {
      ...this.metrics,
      averageLatency: Math.round(avgLatency),
      activeSessions: this.sessions.size,
    };
  }
}

export default TerminalWebSocketManager;