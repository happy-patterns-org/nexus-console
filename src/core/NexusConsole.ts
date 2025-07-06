/**
 * Nexus Console Core - Main terminal orchestration module
 * Coordinates all terminal subsystems and provides the public API
 */

import TerminalWebSocketManager from '../transport/TerminalWebSocket';
import TerminalRenderer from './TerminalRenderer';
import TerminalState from './TerminalState';
import FileSystemProvider from '../filesystem/FileSystemProvider';
import CommandSanitizer from '../security/CommandSanitizer';
import CacheManager from '../cache/CacheManager';
import TerminalUI from '../ui/TerminalUI';
import type { 
  NexusConsoleConfig, 
  TerminalSession, 
  SessionOptions,
  FileEntry,
  CommandHistory,
  TerminalMetrics
} from '../types';

export interface NexusSession extends TerminalSession {
  buffer: Uint8Array[];
  exitCode?: number;
  signal?: string;
}

export interface ExecuteCommandOptions {
  raw?: boolean;
}

export interface ExecuteCommandResult {
  commandId: string;
  sessionId: string;
}

export interface NexusMetrics extends TerminalMetrics {
  initTime: number;
  commandCount: number;
  totalLatency: number;
  averageCommandLatency?: number;
  sessions: number;
}

type EventCallback<T = any> = (data: T) => void;

class NexusConsole {
  private config: Required<NexusConsoleConfig>;
  private state: TerminalState;
  private ws: TerminalWebSocketManager | null;
  private renderer: TerminalRenderer | null;
  private fileSystem: FileSystemProvider | null;
  private sanitizer: CommandSanitizer | null;
  private cache: CacheManager | null;
  private ui: TerminalUI | null;
  private currentSession: string | null;
  private sessions: Map<string, NexusSession>;
  private listeners: Map<string, Set<EventCallback>>;
  private metrics: {
    initialized: boolean;
    initTime: number;
    commandCount: number;
    totalLatency: number;
  };

  constructor(config: NexusConsoleConfig = {}) {
    this.config = {
      container: config.container || document.body,
      theme: config.theme || 'nexus-dark',
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || '"SF Mono", Monaco, "Cascadia Code", monospace',
      cursorStyle: config.cursorStyle || 'block',
      cursorBlink: config.cursorBlink !== false,
      scrollback: config.scrollback || 10000,
      tabStopWidth: config.tabStopWidth || 8,
      bellStyle: config.bellStyle || 'sound',
      wsUrl: config.wsUrl,
      enableFileSystem: config.enableFileSystem !== false,
      enableCache: config.enableCache !== false,
      securityLevel: config.securityLevel || 'standard',
      position: config.position || 'bottom',
      macOptionIsMeta: config.macOptionIsMeta || false,
      rightClickSelectsWord: config.rightClickSelectsWord || true,
      allowTransparency: config.allowTransparency || false,
      showToolbar: config.showToolbar !== false,
      showTabs: config.showTabs !== false,
      showStatusBar: config.showStatusBar !== false,
      resizable: config.resizable !== false,
      animations: config.animations !== false,
    };

    // Core components
    this.state = new TerminalState();
    this.ws = null;
    this.renderer = null;
    this.fileSystem = null;
    this.sanitizer = null;
    this.cache = null;
    this.ui = null;

    // Session management
    this.currentSession = null;
    this.sessions = new Map();

    // Event listeners
    this.listeners = new Map();

    // Performance tracking
    this.metrics = {
      initialized: false,
      initTime: 0,
      commandCount: 0,
      totalLatency: 0,
    };

    // Initialize if container provided
    if (this.config.container) {
      this.initialize().catch(error => {
        console.error('Failed to initialize terminal:', error);
        this.emit('error', error);
      });
    }
  }

  // Lifecycle Methods
  async initialize(): Promise<void> {
    const startTime = performance.now();

    try {
      this.emit('initializing');

      // Initialize security layer first
      this.sanitizer = new CommandSanitizer({
        level: this.config.securityLevel,
      });

      // Initialize cache if enabled
      if (this.config.enableCache) {
        this.cache = new CacheManager();
        await this.cache.initialize();
      }

      // Initialize UI
      this.ui = new TerminalUI({
        container: this.config.container,
        theme: this.config.theme,
        position: this.config.position,
        showToolbar: this.config.showToolbar,
        showTabs: this.config.showTabs,
        showStatusBar: this.config.showStatusBar,
        resizable: this.config.resizable,
        animations: this.config.animations,
      });
      await this.ui.initialize();

      // Set up UI events
      this.setupUIEvents();

      // Initialize renderer
      const terminalContainer = this.ui.getTerminalContainer();
      if (!terminalContainer) {
        throw new Error('Terminal container not available');
      }

      this.renderer = new TerminalRenderer({
        container: terminalContainer,
        fontSize: this.config.fontSize,
        fontFamily: this.config.fontFamily,
        theme: this.config.theme,
        cursorStyle: this.config.cursorStyle,
        cursorBlink: this.config.cursorBlink,
        scrollback: this.config.scrollback,
        tabStopWidth: this.config.tabStopWidth,
        bellStyle: this.config.bellStyle,
        macOptionIsMeta: this.config.macOptionIsMeta,
        rightClickSelectsWord: this.config.rightClickSelectsWord,
        allowTransparency: this.config.allowTransparency,
      });
      await this.renderer.initialize();

      // Set up renderer event handlers
      this.setupRendererEvents();

      // Initialize WebSocket transport
      this.ws = new TerminalWebSocketManager({
        wsUrl: this.config.wsUrl,
      });
      this.setupWebSocketEvents();

      // Connect to server
      await this.ws.connect();

      // Initialize file system if enabled
      if (this.config.enableFileSystem) {
        this.fileSystem = new FileSystemProvider({
          ws: this.ws,
          cache: this.cache,
        });
        await this.fileSystem.initialize();
      }

      // Update state
      this.state.setInitialized(true);
      this.metrics.initialized = true;
      this.metrics.initTime = performance.now() - startTime;

      this.emit('initialized', {
        initTime: this.metrics.initTime,
      });

      // Show welcome message
      this.showWelcome();

    } catch (error) {
      this.state.setError(error as Error);
      this.emit('error', error);
      throw error;
    }
  }

  async destroy(): Promise<void> {
    this.emit('destroying');

    // Close all sessions
    for (const sessionId of this.sessions.keys()) {
      await this.closeSession(sessionId);
    }

    // Disconnect WebSocket
    if (this.ws) {
      this.ws.disconnect();
      this.ws = null;
    }

    // Destroy renderer
    if (this.renderer) {
      this.renderer.destroy();
      this.renderer = null;
    }

    // Destroy UI
    if (this.ui) {
      this.ui.destroy();
      this.ui = null;
    }

    // Clear cache
    if (this.cache) {
      await this.cache.clear();
      this.cache.destroy();
      this.cache = null;
    }

    // Clear file system
    if (this.fileSystem) {
      this.fileSystem.destroy();
      this.fileSystem = null;
    }

    // Clear state
    this.state.destroy();
    this.sessions.clear();
    this.listeners.clear();

    this.emit('destroyed');
  }

  // Terminal Session Management
  async createSession(options: SessionOptions = {}): Promise<string> {
    if (!this.state.isInitialized() || !this.ws || !this.renderer) {
      throw new Error('Terminal not initialized');
    }

    const sessionOptions: SessionOptions = {
      shell: options.shell,
      cols: options.cols || this.renderer.getCols(),
      rows: options.rows || this.renderer.getRows(),
      cwd: options.cwd || await this.getDefaultCwd(),
      env: {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        ...options.env,
      },
      encoding: options.encoding || 'utf8',
    };

    try {
      const sessionId = await this.ws.createPtySession(sessionOptions);

      const session: NexusSession = {
        id: sessionId,
        options: sessionOptions,
        created: Date.now(),
        active: true,
        buffer: [],
        history: [],
        cwd: sessionOptions.cwd || '/',
      };

      this.sessions.set(sessionId, session);
      this.state.addSession(sessionId, session);

      // Add tab in UI
      if (this.ui) {
        this.ui.addTab(sessionId, `Session ${this.sessions.size}`);
      }

      // Auto-attach if no current session
      if (!this.currentSession) {
        await this.attachToSession(sessionId);
      }

      this.emit('session_created', {
        sessionId,
        options: sessionOptions,
      });

      return sessionId;

    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  async attachToSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.renderer || !this.ui) {
      throw new Error('Session not found');
    }

    // Detach from current session if any
    if (this.currentSession && this.currentSession !== sessionId) {
      await this.detachFromSession();
    }

    this.currentSession = sessionId;
    this.state.setActiveSession(sessionId);

    // Clear terminal and replay buffer
    this.renderer.clear();

    if (session.buffer.length > 0) {
      // Replay buffered output
      for (const data of session.buffer) {
        this.renderer.write(data);
      }
    }

    // Update UI
    this.ui.setActiveSession(sessionId);
    this.ui.activateTab(sessionId);

    // Focus terminal
    this.renderer.focus();

    this.emit('session_attached', { sessionId });
  }

  async detachFromSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const sessionId = this.currentSession;
    this.currentSession = null;
    this.state.setActiveSession(null);

    if (this.ui) {
      this.ui.setActiveSession(null);
    }

    this.emit('session_detached', { sessionId });
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session || !this.ws) {
      return;
    }

    // Detach if it's the current session
    if (this.currentSession === sessionId) {
      await this.detachFromSession();
    }

    // Close PTY session
    await this.ws.closePtySession(sessionId);

    // Remove from sessions
    this.sessions.delete(sessionId);
    this.state.removeSession(sessionId);

    // Remove tab from UI
    if (this.ui) {
      this.ui.closeTab(sessionId);
    }

    this.emit('session_closed', { sessionId });
  }

  // Command Execution
  async executeCommand(command: string, options: ExecuteCommandOptions = {}): Promise<ExecuteCommandResult> {
    if (!this.currentSession || !this.ws || !this.cache) {
      throw new Error('No active session');
    }

    const startTime = performance.now();

    // Sanitize command if security is enabled
    if (!options.raw && this.sanitizer) {
      command = this.sanitizer.sanitize(command);
    }

    // Add to history
    const session = this.sessions.get(this.currentSession);
    if (session) {
      const historyEntry: CommandHistory = {
        command,
        timestamp: Date.now(),
        sessionId: this.currentSession,
      };
      session.history.push(historyEntry);
      
      // Also add to cache for persistence
      await this.cache.addCommandToHistory(this.currentSession, command);
    }

    // Send to PTY
    this.ws.sendPtyInput(this.currentSession, command + '\n');

    // Track metrics
    this.metrics.commandCount++;
    this.state.incrementCommandCount();

    // Emit event
    this.emit('command_executed', {
      sessionId: this.currentSession,
      command,
      timestamp: Date.now(),
    });

    // Return command ID for tracking
    return {
      commandId: `cmd-${Date.now()}`,
      sessionId: this.currentSession,
    };
  }

  abortExecution(): void {
    if (!this.currentSession || !this.ws) {
      return;
    }

    // Send Ctrl+C
    this.ws.sendPtyInput(this.currentSession, '\x03');

    this.emit('execution_aborted', {
      sessionId: this.currentSession,
    });
  }

  // File System Operations
  async requestFileAccess(options = {}): Promise<any> {
    if (!this.fileSystem) {
      throw new Error('File system not enabled');
    }

    return await this.fileSystem.requestAccess(options);
  }

  async readFile(path: string, options = {}): Promise<string | ArrayBuffer> {
    if (!this.fileSystem) {
      throw new Error('File system not enabled');
    }

    return await this.fileSystem.readFile(path, options);
  }

  async writeFile(path: string, content: string | ArrayBuffer | Uint8Array, options = {}): Promise<any> {
    if (!this.fileSystem) {
      throw new Error('File system not enabled');
    }

    return await this.fileSystem.writeFile(path, content, options);
  }

  async listDirectory(path: string, options = {}): Promise<FileEntry[]> {
    if (!this.fileSystem) {
      throw new Error('File system not enabled');
    }

    return await this.fileSystem.listDirectory(path, options);
  }

  // UI Methods
  show(): void {
    if (this.ui && this.renderer) {
      this.ui.show();
      this.renderer.focus();
    }
  }

  hide(): void {
    if (this.ui) {
      this.ui.hide();
    }
  }

  toggle(): void {
    if (this.ui) {
      if (this.ui.isVisible()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }

  focus(): void {
    if (this.renderer) {
      this.renderer.focus();
    }
  }

  blur(): void {
    if (this.renderer) {
      this.renderer.blur();
    }
  }

  // Terminal Operations
  clear(): void {
    if (this.renderer) {
      this.renderer.clear();
    }
  }

  reset(): void {
    if (this.renderer) {
      this.renderer.reset();
    }
  }

  scrollToTop(): void {
    if (this.renderer) {
      this.renderer.scrollToTop();
    }
  }

  scrollToBottom(): void {
    if (this.renderer) {
      this.renderer.scrollToBottom();
    }
  }

  // Event Setup
  private setupRendererEvents(): void {
    if (!this.renderer) return;

    // Handle terminal input
    this.renderer.on('data', (data: string) => {
      if (this.currentSession && this.ws) {
        this.ws.sendPtyInput(this.currentSession, data);
      }
    });

    // Handle resize
    this.renderer.on('resize', ({ cols, rows }: { cols: number; rows: number }) => {
      if (this.currentSession && this.ws) {
        this.ws.resizePty(this.currentSession, cols, rows);
      }
      if (this.ui) {
        this.ui.updateTerminalSize(cols, rows);
      }
    });

    // Handle title change
    this.renderer.on('title', (title: string) => {
      if (this.ui) {
        this.ui.setTitle(title);
      }
      this.emit('title_changed', { title });
    });

    // Handle selection
    this.renderer.on('selection', () => {
      this.emit('selection_changed');
    });

    // Handle performance updates
    this.renderer.on('performance_update', (metrics) => {
      if (this.ui && this.ws) {
        const wsMetrics = this.ws.getMetrics();
        this.ui.updatePerformance(metrics.fps, wsMetrics.averageLatency || 0);
      }
    });

    // Handle clipboard operations
    this.renderer.on('copy-requested', () => {
      this.renderer?.copySelection();
    });

    this.renderer.on('paste-requested', () => {
      this.renderer?.paste();
    });
  }

  private setupWebSocketEvents(): void {
    if (!this.ws) return;

    // Handle PTY output
    this.ws.on('pty_output', ({ sessionId, data }: { sessionId: string; data: Uint8Array }) => {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return;
      }

      // Buffer output for inactive sessions
      if (sessionId !== this.currentSession) {
        session.buffer.push(data);

        // Limit buffer size
        if (session.buffer.length > 1000) {
          session.buffer.shift();
        }
      } else if (this.renderer) {
        // Write directly to renderer
        this.renderer.write(data);
      }

      // Update latency metrics
      const latency = performance.now() - ((data as any).timestamp || performance.now());
      this.metrics.totalLatency += latency;
    });

    // Handle session events
    this.ws.on('session_closed', ({ sessionId, exitCode, signal }) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.active = false;
        session.exitCode = exitCode;
        session.signal = signal;
      }

      // Show notification
      if (this.ui) {
        this.ui.showNotification(
          `Session ${sessionId} closed (${exitCode ? `exit code: ${exitCode}` : `signal: ${signal}`})`,
          'info'
        );
      }
    });

    // Handle errors
    this.ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);

      if (this.ui) {
        this.ui.showNotification(
          `Connection error: ${error.message}`,
          'error'
        );
      }

      this.emit('error', error);
    });

    // Handle connection state
    this.ws.on('connected', () => {
      this.state.setConnected(true);

      if (this.ui) {
        this.ui.setConnectionStatus('connected');
      }

      this.emit('connected');
    });

    this.ws.on('disconnected', ({ code, reason }: { code: number; reason: string }) => {
      this.state.setConnected(false);

      if (this.ui) {
        this.ui.setConnectionStatus('disconnected');
        this.ui.showNotification(
          `Disconnected: ${reason || 'Connection lost'}`,
          'warning'
        );
      }

      this.emit('disconnected', { code, reason });
    });

    this.ws.on('reconnecting', ({ attempt, delay }: { attempt: number; delay: number }) => {
      if (this.ui) {
        this.ui.setConnectionStatus('reconnecting');
        this.ui.showNotification(
          `Reconnecting... (attempt ${attempt}, retry in ${delay}ms)`,
          'info'
        );
      }

      this.emit('reconnecting', { attempt, delay });
    });
  }

  private setupUIEvents(): void {
    if (!this.ui) return;

    // Handle UI action requests
    this.ui.on('new-session-requested', () => {
      this.createSession().catch(error => {
        console.error('Failed to create session:', error);
        this.ui?.showNotification('Failed to create session', 'error');
      });
    });

    this.ui.on('new-tab-requested', () => {
      this.createSession().catch(error => {
        console.error('Failed to create session:', error);
      });
    });

    this.ui.on('tab-activated', ({ id }: { id: string }) => {
      this.attachToSession(id).catch(error => {
        console.error('Failed to attach to session:', error);
      });
    });

    this.ui.on('tab-closed', ({ id }: { id: string }) => {
      this.closeSession(id).catch(error => {
        console.error('Failed to close session:', error);
      });
    });

    this.ui.on('copy-requested', () => {
      this.renderer?.copySelection();
    });

    this.ui.on('paste-requested', () => {
      this.renderer?.paste();
    });

    this.ui.on('search-requested', () => {
      // TODO: Implement search UI
      this.emit('search_requested');
    });

    this.ui.on('settings-requested', () => {
      this.emit('settings_requested');
    });
  }

  // Utility Methods
  private async getDefaultCwd(): Promise<string> {
    // Try to get from environment or use home directory
    if (typeof process !== 'undefined' && process.env && process.env.HOME) {
      return process.env.HOME;
    }

    // Fallback to workspace root
    return '/workspace';
  }

  private showWelcome(): void {
    const welcome = `
╔══════════════════════════════════════════════════════════════╗
║             Nexus Console v1.0.0 - OPERATIONAL               ║
╠══════════════════════════════════════════════════════════════╣
║  • WebGL-accelerated rendering for 60fps performance         ║
║  • Native file system access with caching                    ║
║  • Secure command execution with sandboxing                  ║
║  • Multi-session support with hot-switching                  ║
╚══════════════════════════════════════════════════════════════╝

Type 'help' for available commands or start typing...
    `;

    if (this.renderer) {
      this.renderer.write(welcome);
    }
  }

  // Event Emitter
  on<T = any>(event: string, callback: EventCallback<T>): this {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    return this;
  }

  off<T = any>(event: string, callback: EventCallback<T>): this {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
    return this;
  }

  once<T = any>(event: string, callback: EventCallback<T>): this {
    const onceWrapper = (data: T) => {
      this.off(event, onceWrapper);
      callback(data);
    };
    return this.on(event, onceWrapper);
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

  // Public API
  getMetrics(): NexusMetrics {
    const wsMetrics = this.ws ? this.ws.getMetrics() : {};
    const avgCommandLatency = this.metrics.commandCount > 0
      ? this.metrics.totalLatency / this.metrics.commandCount
      : 0;

    const stateMetrics = this.state.getMetrics();

    return {
      initialized: this.metrics.initialized,
      initTime: this.metrics.initTime,
      commandCount: this.metrics.commandCount,
      averageCommandLatency: Math.round(avgCommandLatency),
      sessions: this.sessions.size,
      activeSession: this.currentSession,
      connected: this.state.isConnected(),
      messagesSent: wsMetrics.messagesSent || 0,
      messagesReceived: wsMetrics.messagesReceived || 0,
      bytesTransferred: wsMetrics.bytesTransferred || 0,
      averageLatency: wsMetrics.averageLatency || 0,
      ...stateMetrics,
    };
  }

  getState(): any {
    return this.state.getState();
  }

  getSessions(): Array<{
    id: string;
    active: boolean;
    created: number;
    cwd: string;
    historyLength: number;
  }> {
    return Array.from(this.sessions.values()).map(session => ({
      id: session.id,
      active: session.active,
      created: session.created,
      cwd: session.cwd,
      historyLength: session.history.length,
    }));
  }

  getActiveSession(): string | null {
    return this.currentSession;
  }

  // Configuration
  setTheme(theme: string): void {
    if (this.renderer) {
      this.renderer.setTheme(theme);
    }
    if (this.ui) {
      this.ui.applyTheme(theme);
    }
    this.config.theme = theme;
  }

  setFontSize(size: number): void {
    if (this.renderer) {
      this.renderer.setFontSize(size);
    }
    this.config.fontSize = size;
  }

  getConfig(): Required<NexusConsoleConfig> {
    return { ...this.config };
  }
}

export default NexusConsole;