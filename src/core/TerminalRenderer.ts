/**
 * Terminal Renderer - xterm.js integration with WebGL acceleration
 * Handles all terminal rendering and interaction
 */

import type { Terminal, ITerminalOptions, ITheme } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';
import type { WebglAddon } from '@xterm/addon-webgl';
import type { SearchAddon, ISearchOptions } from '@xterm/addon-search';
import type { SerializeAddon } from '@xterm/addon-serialize';
import type { Unicode11Addon } from '@xterm/addon-unicode11';
import type { ClipboardAddon } from '@xterm/addon-clipboard';
import type { WebLinksAddon } from '@xterm/addon-web-links';

export interface TerminalRendererConfig {
  container: HTMLElement | string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: FontWeight;
  fontWeightBold?: FontWeight;
  lineHeight?: number;
  letterSpacing?: number;
  theme?: 'nexus-dark' | 'nexus-light' | string;
  cursorStyle?: 'block' | 'underline' | 'bar';
  cursorBlink?: boolean;
  scrollback?: number;
  tabStopWidth?: number;
  bellStyle?: 'none' | 'sound' | 'visual' | 'both';
  allowTransparency?: boolean;
  macOptionIsMeta?: boolean;
  rightClickSelectsWord?: boolean;
}

export interface TerminalTheme extends ITheme {
  // ITheme already includes all color properties
}

export interface PerformanceMetrics {
  fps: number;
  framesRendered: number;
  isWebGLEnabled: boolean;
  cols: number;
  rows: number;
}

export interface ContextMenuEvent {
  x: number;
  y: number;
}

export interface ResizeEvent {
  cols: number;
  rows: number;
}

type FontWeight = 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
type EventCallback<T = any> = (data: T) => void;

class TerminalRenderer {
  private config: Required<TerminalRendererConfig>;
  private terminal: Terminal | null;
  private fitAddon: FitAddon | null;
  private webglAddon: WebglAddon | null;
  private searchAddon: SearchAddon | null;
  private serializeAddon: SerializeAddon | null;
  private unicodeAddon: Unicode11Addon | null;
  private clipboardAddon: ClipboardAddon | null;
  private webLinksAddon: WebLinksAddon | null;
  private container: HTMLElement | null;
  private initialized: boolean;
  private listeners: Map<string, Set<EventCallback>>;
  private metrics: {
    framesRendered: number;
    lastFrameTime: number;
    fps: number;
  };
  private themes: Record<string, TerminalTheme>;
  private _resizeObserver?: ResizeObserver;

  constructor(config: TerminalRendererConfig) {
    this.config = {
      container: config.container,
      fontSize: config.fontSize || 14,
      fontFamily: config.fontFamily || '"SF Mono", Monaco, "Cascadia Code", monospace',
      fontWeight: config.fontWeight || 'normal',
      fontWeightBold: config.fontWeightBold || 'bold',
      lineHeight: config.lineHeight || 1.2,
      letterSpacing: config.letterSpacing || 0,
      theme: config.theme || 'nexus-dark',
      cursorStyle: config.cursorStyle || 'block',
      cursorBlink: config.cursorBlink !== false,
      scrollback: config.scrollback || 10000,
      tabStopWidth: config.tabStopWidth || 8,
      bellStyle: config.bellStyle || 'sound',
      allowTransparency: config.allowTransparency || false,
      macOptionIsMeta: config.macOptionIsMeta || false,
      rightClickSelectsWord: config.rightClickSelectsWord || true,
    };

    this.terminal = null;
    this.fitAddon = null;
    this.webglAddon = null;
    this.searchAddon = null;
    this.serializeAddon = null;
    this.unicodeAddon = null;
    this.clipboardAddon = null;
    this.webLinksAddon = null;

    this.container = null;
    this.initialized = false;

    // Event listeners
    this.listeners = new Map();

    // Performance metrics
    this.metrics = {
      framesRendered: 0,
      lastFrameTime: 0,
      fps: 0,
    };

    // Themes
    this.themes = {
      'nexus-dark': {
        background: '#0a0a0a',
        foreground: '#e4e4e4',
        cursor: '#00d4aa',
        cursorAccent: '#0a0a0a',
        selectionBackground: 'rgba(0, 212, 170, 0.3)',
        selectionForeground: undefined,
        selectionInactiveBackground: 'rgba(0, 212, 170, 0.2)',
        black: '#000000',
        red: '#ff5555',
        green: '#50fa7b',
        yellow: '#f1fa8c',
        blue: '#bd93f9',
        magenta: '#ff79c6',
        cyan: '#8be9fd',
        white: '#bbbbbb',
        brightBlack: '#555555',
        brightRed: '#ff5555',
        brightGreen: '#50fa7b',
        brightYellow: '#f1fa8c',
        brightBlue: '#bd93f9',
        brightMagenta: '#ff79c6',
        brightCyan: '#8be9fd',
        brightWhite: '#ffffff',
      },
      'nexus-light': {
        background: '#ffffff',
        foreground: '#1a1a1a',
        cursor: '#007acc',
        cursorAccent: '#ffffff',
        selectionBackground: 'rgba(0, 122, 204, 0.3)',
        selectionForeground: undefined,
        selectionInactiveBackground: 'rgba(0, 122, 204, 0.2)',
        black: '#1a1a1a',
        red: '#cd3131',
        green: '#00bc00',
        yellow: '#949800',
        blue: '#0451a5',
        magenta: '#bc05bc',
        cyan: '#0598bc',
        white: '#555555',
        brightBlack: '#666666',
        brightRed: '#cd3131',
        brightGreen: '#14ce14',
        brightYellow: '#b5ba00',
        brightBlue: '#0451a5',
        brightMagenta: '#bc05bc',
        brightCyan: '#0598bc',
        brightWhite: '#a5a5a5',
      },
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Create container if not provided
      if (!this.config.container) {
        throw new Error('Container element required');
      }

      this.container = typeof this.config.container === 'string'
        ? document.querySelector(this.config.container) as HTMLElement
        : this.config.container;

      if (!this.container) {
        throw new Error('Container element not found');
      }

      // Dynamic import of xterm modules
      const [
        { Terminal },
        { FitAddon },
        { WebglAddon },
        { SearchAddon },
        { SerializeAddon },
        { Unicode11Addon },
        { ClipboardAddon },
        { WebLinksAddon },
      ] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit'),
        import('@xterm/addon-webgl'),
        import('@xterm/addon-search'),
        import('@xterm/addon-serialize'),
        import('@xterm/addon-unicode11'),
        import('@xterm/addon-clipboard'),
        import('@xterm/addon-web-links'),
      ]);

      // Create terminal instance
      const terminalOptions: ITerminalOptions = {
        fontFamily: this.config.fontFamily,
        fontSize: this.config.fontSize,
        fontWeight: this.config.fontWeight,
        fontWeightBold: this.config.fontWeightBold,
        lineHeight: this.config.lineHeight,
        letterSpacing: this.config.letterSpacing,
        theme: this.themes[this.config.theme] || this.themes['nexus-dark'],
        cursorStyle: this.config.cursorStyle,
        cursorBlink: this.config.cursorBlink,
        scrollback: this.config.scrollback,
        tabStopWidth: this.config.tabStopWidth,
        // bellStyle is deprecated in newer versions
        allowTransparency: this.config.allowTransparency,
        macOptionIsMeta: this.config.macOptionIsMeta,
        rightClickSelectsWord: this.config.rightClickSelectsWord,
        allowProposedApi: true,
      };

      this.terminal = new Terminal(terminalOptions);

      // Initialize addons
      this.fitAddon = new FitAddon();
      this.terminal.loadAddon(this.fitAddon);

      // WebGL renderer for performance
      try {
        this.webglAddon = new WebglAddon();
        this.terminal.loadAddon(this.webglAddon);

        // Wait for terminal to be opened before checking WebGL
        this.terminal.onRender(() => {
          if (this.webglAddon && !this.webglAddon.isTextureAtlasBuilding) {
            this.startPerformanceTracking();
          }
        });
      } catch (error) {
        console.warn('WebGL addon failed to load, falling back to canvas renderer:', error);
      }

      // Search functionality
      this.searchAddon = new SearchAddon();
      this.terminal.loadAddon(this.searchAddon);

      // Serialization for session persistence
      this.serializeAddon = new SerializeAddon();
      this.terminal.loadAddon(this.serializeAddon);

      // Unicode support
      this.unicodeAddon = new Unicode11Addon();
      this.terminal.loadAddon(this.unicodeAddon);
      this.terminal.unicode.activeVersion = '11';

      // Clipboard support
      this.clipboardAddon = new ClipboardAddon();
      this.terminal.loadAddon(this.clipboardAddon);

      // Web links support
      this.webLinksAddon = new WebLinksAddon();
      this.terminal.loadAddon(this.webLinksAddon);

      // Open terminal in container
      this.terminal.open(this.container);

      // Fit to container
      this.fit();

      // Set up event handlers
      this.setupEventHandlers();

      // Set up resize observer
      this.setupResizeObserver();

      this.initialized = true;
      this.emit('initialized');

    } catch (error) {
      console.error('Failed to initialize terminal renderer:', error);
      throw error;
    }
  }

  private setupEventHandlers(): void {
    if (!this.terminal || !this.container) return;

    // Data events
    this.terminal.onData(data => {
      this.emit('data', data);
    });

    // Binary events
    this.terminal.onBinary(data => {
      this.emit('binary', data);
    });

    // Resize events
    this.terminal.onResize(({ cols, rows }) => {
      this.emit<ResizeEvent>('resize', { cols, rows });
    });

    // Title change events
    this.terminal.onTitleChange(title => {
      this.emit('title', title);
    });

    // Selection events
    this.terminal.onSelectionChange(() => {
      const selection = this.terminal?.getSelection();
      this.emit('selection', selection);
    });

    // Link events
    // Link provider is replaced by web-links addon

    // Custom key handlers
    this.terminal.attachCustomKeyEventHandler((event) => {
      // Ctrl+Shift+C for copy
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyC') {
        this.copySelection();
        return false;
      }

      // Ctrl+Shift+V for paste
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyV') {
        this.paste();
        return false;
      }

      // Ctrl+Shift+F for search
      if (event.ctrlKey && event.shiftKey && event.code === 'KeyF') {
        this.emit('search_requested');
        return false;
      }

      // Ctrl+L for clear
      if (event.ctrlKey && event.code === 'KeyL') {
        this.clear();
        return false;
      }

      return true;
    });

    // Mouse events for custom handling
    this.container.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.emit<ContextMenuEvent>('contextmenu', {
        x: e.clientX,
        y: e.clientY,
      });
    });
  }

  private setupResizeObserver(): void {
    if (!this.container) return;

    if (typeof ResizeObserver === 'undefined') {
      // Fallback for older browsers
      window.addEventListener('resize', () => this.fit());
      return;
    }

    const resizeObserver = new ResizeObserver(() => {
      if (this.initialized && this.container?.offsetParent !== null) {
        this.fit();
      }
    });

    resizeObserver.observe(this.container);

    // Store observer for cleanup
    this._resizeObserver = resizeObserver;
  }

  // Terminal Operations
  write(data: string | Uint8Array): void {
    if (!this.initialized || !this.terminal) {
      console.warn('Terminal not initialized');
      return;
    }

    if (data instanceof Uint8Array) {
      // Convert binary data to string
      const decoder = new TextDecoder();
      this.terminal.write(decoder.decode(data));
    } else {
      this.terminal.write(data);
    }
  }

  writeln(line: string): void {
    this.write(line + '\r\n');
  }

  clear(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.clear();
    this.emit('cleared');
  }

  reset(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.reset();
    this.emit('reset');
  }

  // Focus Management
  focus(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.focus();
    this.emit('focused');
  }

  blur(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.blur();
    this.emit('blurred');
  }

  hasFocus(): boolean {
    return this.initialized && this.terminal?.hasSelection() || false;
  }

  // Scrolling
  scrollToTop(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.scrollToTop();
  }

  scrollToBottom(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.scrollToBottom();
  }

  scrollLines(amount: number): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.scrollLines(amount);
  }

  scrollPages(amount: number): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.scrollPages(amount);
  }

  // Selection and Clipboard
  getSelection(): string {
    if (!this.initialized || !this.terminal) return '';

    return this.terminal.getSelection();
  }

  hasSelection(): boolean {
    if (!this.initialized || !this.terminal) return false;

    return this.terminal.hasSelection();
  }

  clearSelection(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.clearSelection();
  }

  selectAll(): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.selectAll();
  }

  async copySelection(): Promise<void> {
    const selection = this.getSelection();
    if (selection && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(selection);
        this.emit('copied', selection);
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
      }
    }
  }

  async paste(): Promise<void> {
    if (!navigator.clipboard) {
      return;
    }

    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        this.emit('data', text);
      }
    } catch (error) {
      console.error('Failed to paste from clipboard:', error);
    }
  }

  // Search
  findNext(searchTerm: string, options: Partial<ISearchOptions> = {}): boolean {
    if (!this.initialized || !this.searchAddon) return false;

    return this.searchAddon.findNext(searchTerm, {
      regex: options.regex || false,
      wholeWord: options.wholeWord || false,
      caseSensitive: options.caseSensitive || false,
      incremental: options.incremental || false,
    });
  }

  findPrevious(searchTerm: string, options: Partial<ISearchOptions> = {}): boolean {
    if (!this.initialized || !this.searchAddon) return false;

    return this.searchAddon.findPrevious(searchTerm, {
      regex: options.regex || false,
      wholeWord: options.wholeWord || false,
      caseSensitive: options.caseSensitive || false,
    });
  }

  // Sizing
  fit(): void {
    if (!this.initialized || !this.fitAddon) return;

    try {
      this.fitAddon.fit();

      const dimensions = this.fitAddon.proposeDimensions();
      if (dimensions) {
        this.emit<ResizeEvent>('resize', {
          cols: dimensions.cols,
          rows: dimensions.rows,
        });
      }
    } catch (error) {
      console.error('Failed to fit terminal:', error);
    }
  }

  getCols(): number {
    return this.initialized && this.terminal ? this.terminal.cols : 80;
  }

  getRows(): number {
    return this.initialized && this.terminal ? this.terminal.rows : 24;
  }

  resize(cols: number, rows: number): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.resize(cols, rows);
  }

  // Serialization
  serialize(): string | null {
    if (!this.initialized || !this.serializeAddon) return null;

    return this.serializeAddon.serialize();
  }

  restore(serializedData: string): void {
    if (!this.initialized) return;

    this.clear();
    this.write(serializedData);
  }

  // Theme Management
  setTheme(themeName: string): void {
    if (!this.initialized || !this.terminal) return;

    const theme = this.themes[themeName];
    if (theme) {
      this.terminal.options.theme = theme;
      this.config.theme = themeName;
      this.emit('theme_changed', themeName);
    }
  }

  updateTheme(themeOptions: Partial<ITheme>): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.options.theme = {
      ...this.terminal.options.theme,
      ...themeOptions,
    };
  }

  // Font Management
  setFontSize(size: number): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.options.fontSize = size;
    this.config.fontSize = size;
    this.fit();
  }

  setFontFamily(fontFamily: string): void {
    if (!this.initialized || !this.terminal) return;

    this.terminal.options.fontFamily = fontFamily;
    this.config.fontFamily = fontFamily;
    this.fit();
  }

  // Link detection is now handled by the web-links addon

  // Performance Tracking
  private startPerformanceTracking(): void {
    if (!this.webglAddon) return;

    let lastTime = performance.now();
    let frameCount = 0;

    const measureFPS = () => {
      const currentTime = performance.now();
      frameCount++;

      if (currentTime >= lastTime + 1000) {
        this.metrics.fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
        this.metrics.framesRendered += frameCount;
        this.metrics.lastFrameTime = currentTime;

        frameCount = 0;
        lastTime = currentTime;

        this.emit('performance_update', {
          fps: this.metrics.fps,
          totalFrames: this.metrics.framesRendered,
        });
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return {
      fps: this.metrics.fps,
      framesRendered: this.metrics.framesRendered,
      isWebGLEnabled: !!this.webglAddon,
      cols: this.getCols(),
      rows: this.getRows(),
    };
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

  // Cleanup
  destroy(): void {
    if (!this.initialized) return;

    // Remove resize observer
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = undefined;
    }

    // Dispose addons
    if (this.webglAddon) {
      this.webglAddon.dispose();
    }

    // Dispose terminal
    if (this.terminal) {
      this.terminal.dispose();
    }

    // Clear references
    this.terminal = null;
    this.fitAddon = null;
    this.webglAddon = null;
    this.searchAddon = null;
    this.serializeAddon = null;
    this.unicodeAddon = null;
    this.clipboardAddon = null;
    this.webLinksAddon = null;
    this.container = null;
    this.initialized = false;

    // Clear listeners
    this.listeners.clear();

    this.emit('destroyed');
  }
}

export default TerminalRenderer;