/**
 * Terminal UI - User interface components for Nexus Terminal
 * Handles UI rendering, themes, and user interactions
 */

export interface TerminalUIConfig {
  container?: HTMLElement | string;
  theme?: 'nexus-dark' | 'nexus-light' | string;
  position?: 'bottom' | 'right' | 'fullscreen' | 'floating';
  initialSize?: { width: string; height: string };
  minSize?: { width: number; height: number };
  resizable?: boolean;
  showToolbar?: boolean;
  showStatusBar?: boolean;
  showTabs?: boolean;
  animations?: boolean;
}

export interface TerminalTab {
  id: string;
  title: string;
  element: HTMLElement | null;
}

export interface TerminalUIElements {
  wrapper: HTMLElement | null;
  toolbar: HTMLElement | null;
  tabBar: HTMLElement | null;
  terminalContainer: HTMLElement | null;
  statusBar: HTMLElement | null;
  resizeHandle: HTMLElement | null;
  contextMenu: HTMLElement | null;
  notifications: HTMLElement | null;
}

export interface TerminalUIState {
  visible: boolean;
  maximized: boolean;
  activeTab: string | null;
  tabs: Map<string, TerminalTab>;
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting';
  notifications: Array<{ id: string; message: string; type: string }>;
}

export interface ResizeState {
  isResizing: boolean;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
}

export interface ContextMenuItem {
  label: string;
  action?: () => void;
  shortcut?: string;
  disabled?: boolean;
  separator?: boolean;
}

export type NotificationType = 'info' | 'warning' | 'error' | 'success';
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

type EventCallback<T = any> = (data: T) => void;

class TerminalUI {
  private config: Required<TerminalUIConfig>;
  private elements: TerminalUIElements;
  private state: TerminalUIState;
  private resizeState: ResizeState;
  private listeners: Map<string, Set<EventCallback>>;

  constructor(config: TerminalUIConfig = {}) {
    this.config = {
      container: config.container || document.body,
      theme: config.theme || 'nexus-dark',
      position: config.position || 'bottom',
      initialSize: config.initialSize || { width: '100%', height: '50%' },
      minSize: config.minSize || { width: 400, height: 200 },
      resizable: config.resizable !== false,
      showToolbar: config.showToolbar !== false,
      showStatusBar: config.showStatusBar !== false,
      showTabs: config.showTabs !== false,
      animations: config.animations !== false,
    };

    // UI elements
    this.elements = {
      wrapper: null,
      toolbar: null,
      tabBar: null,
      terminalContainer: null,
      statusBar: null,
      resizeHandle: null,
      contextMenu: null,
      notifications: null,
    };

    // State
    this.state = {
      visible: false,
      maximized: false,
      activeTab: null,
      tabs: new Map(),
      connectionStatus: 'disconnected',
      notifications: [],
    };

    // Resize state
    this.resizeState = {
      isResizing: false,
      startX: 0,
      startY: 0,
      startWidth: 0,
      startHeight: 0,
    };

    // Event listeners
    this.listeners = new Map();
  }

  async initialize(): Promise<void> {
    // Create UI structure
    this.createUI();

    // Apply theme
    this.applyTheme(this.config.theme);

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize components
    if (this.config.showToolbar) {
      this.initializeToolbar();
    }

    if (this.config.showTabs) {
      this.initializeTabBar();
    }

    if (this.config.showStatusBar) {
      this.initializeStatusBar();
    }

    if (this.config.resizable) {
      this.initializeResize();
    }

    // Create context menu
    this.createContextMenu();

    // Create notifications container
    this.createNotifications();

    this.emit('initialized');
  }

  private createUI(): void {
    // Create wrapper
    this.elements.wrapper = document.createElement('div');
    this.elements.wrapper.className = 'nexus-terminal-wrapper';
    this.elements.wrapper.setAttribute('data-position', this.config.position);
    this.elements.wrapper.setAttribute('data-theme', this.config.theme);

    // Create toolbar
    if (this.config.showToolbar) {
      this.elements.toolbar = document.createElement('div');
      this.elements.toolbar.className = 'terminal-toolbar';
      this.elements.wrapper.appendChild(this.elements.toolbar);
    }

    // Create tab bar
    if (this.config.showTabs) {
      this.elements.tabBar = document.createElement('div');
      this.elements.tabBar.className = 'terminal-tab-bar';
      this.elements.wrapper.appendChild(this.elements.tabBar);
    }

    // Create terminal container
    this.elements.terminalContainer = document.createElement('div');
    this.elements.terminalContainer.className = 'terminal-container';
    this.elements.wrapper.appendChild(this.elements.terminalContainer);

    // Create status bar
    if (this.config.showStatusBar) {
      this.elements.statusBar = document.createElement('div');
      this.elements.statusBar.className = 'terminal-status-bar';
      this.elements.wrapper.appendChild(this.elements.statusBar);
    }

    // Create resize handle
    if (this.config.resizable && this.config.position !== 'fullscreen') {
      this.elements.resizeHandle = document.createElement('div');
      this.elements.resizeHandle.className = 'terminal-resize-handle';
      this.elements.wrapper.appendChild(this.elements.resizeHandle);
    }

    // Apply initial size
    this.applySize(this.config.initialSize);

    // Add to container
    const container = typeof this.config.container === 'string'
      ? document.querySelector(this.config.container) as HTMLElement
      : this.config.container;

    if (!container) {
      throw new Error('Container element not found');
    }

    container.appendChild(this.elements.wrapper);

    // Add styles
    this.injectStyles();
  }

  private initializeToolbar(): void {
    const toolbar = this.elements.toolbar;
    if (!toolbar) return;

    // Terminal title
    const title = document.createElement('div');
    title.className = 'terminal-title';
    title.textContent = 'Nexus Terminal';
    toolbar.appendChild(title);

    // Toolbar actions
    const actions = document.createElement('div');
    actions.className = 'terminal-actions';

    // Create action buttons
    const actionButtons = [
      { icon: '➕', title: 'New Session', action: 'new-session' },
      { icon: '📋', title: 'Copy', action: 'copy' },
      { icon: '📄', title: 'Paste', action: 'paste' },
      { icon: '🔍', title: 'Search', action: 'search' },
      { icon: '⚙️', title: 'Settings', action: 'settings' },
      { icon: '⬜', title: 'Maximize', action: 'maximize' },
      { icon: '✕', title: 'Close', action: 'close' },
    ];

    actionButtons.forEach(btn => {
      const button = document.createElement('button');
      button.className = 'terminal-action-btn';
      button.innerHTML = btn.icon;
      button.title = btn.title;
      button.dataset.action = btn.action;

      button.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleAction(btn.action);
      });

      actions.appendChild(button);
    });

    toolbar.appendChild(actions);
  }

  private initializeTabBar(): void {
    const tabBar = this.elements.tabBar;
    if (!tabBar) return;

    // Tab container
    const tabContainer = document.createElement('div');
    tabContainer.className = 'terminal-tabs';
    tabBar.appendChild(tabContainer);

    // New tab button
    const newTabBtn = document.createElement('button');
    newTabBtn.className = 'terminal-new-tab-btn';
    newTabBtn.innerHTML = '+';
    newTabBtn.title = 'New Tab';

    newTabBtn.addEventListener('click', () => {
      this.emit('new-tab-requested');
    });

    tabBar.appendChild(newTabBtn);
  }

  private initializeStatusBar(): void {
    const statusBar = this.elements.statusBar;
    if (!statusBar) return;

    // Connection status
    const connectionStatus = document.createElement('div');
    connectionStatus.className = 'status-item connection-status';
    connectionStatus.innerHTML = '<span class="status-indicator"></span> <span class="status-text">Disconnected</span>';
    statusBar.appendChild(connectionStatus);

    // Session info
    const sessionInfo = document.createElement('div');
    sessionInfo.className = 'status-item session-info';
    sessionInfo.textContent = 'No active session';
    statusBar.appendChild(sessionInfo);

    // Terminal size
    const terminalSize = document.createElement('div');
    terminalSize.className = 'status-item terminal-size';
    terminalSize.textContent = '80×24';
    statusBar.appendChild(terminalSize);

    // Performance metrics
    const performance = document.createElement('div');
    performance.className = 'status-item performance-metrics';
    performance.innerHTML = '<span class="fps">60 FPS</span> | <span class="latency">0ms</span>';
    statusBar.appendChild(performance);
  }

  private initializeResize(): void {
    const handle = this.elements.resizeHandle;
    if (!handle) return;

    handle.addEventListener('mousedown', (e) => {
      this.startResize(e);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.resizeState.isResizing) {
        this.doResize(e);
      }
    });

    document.addEventListener('mouseup', () => {
      this.endResize();
    });
  }

  private setupEventHandlers(): void {
    // Keyboard shortcuts
    const handleKeydown = (e: KeyboardEvent) => {
      if (!this.state.visible) return;

      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+Shift+T - New tab
      if (ctrl && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        this.emit('new-tab-requested');
      }
      // Ctrl+Shift+W - Close tab
      else if (ctrl && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        this.closeActiveTab();
      }
      // Ctrl+Tab - Next tab
      else if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        this.nextTab();
      }
    };

    document.addEventListener('keydown', handleKeydown);

    // Click outside to close context menu
    const handleDocumentClick = (e: MouseEvent) => {
      if (this.elements.contextMenu && !this.elements.contextMenu.contains(e.target as Node)) {
        this.hideContextMenu();
      }
    };

    document.addEventListener('click', handleDocumentClick);

    // Store handlers for cleanup
    (this as any).handleKeydown = handleKeydown;
    (this as any).handleDocumentClick = handleDocumentClick;
  }

  // Tab management
  addTab(id: string, title: string = 'Terminal'): void {
    if (this.state.tabs.has(id)) {
      return;
    }

    const tab: TerminalTab = {
      id,
      title,
      element: null,
    };

    // Create tab element
    const tabElement = document.createElement('div');
    tabElement.className = 'terminal-tab';
    tabElement.dataset.tabId = id;

    const tabTitle = document.createElement('span');
    tabTitle.className = 'tab-title';
    tabTitle.textContent = title;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close-btn';
    closeBtn.innerHTML = '×';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.closeTab(id);
    });

    tabElement.appendChild(tabTitle);
    tabElement.appendChild(closeBtn);

    tabElement.addEventListener('click', () => {
      this.activateTab(id);
    });

    tab.element = tabElement;
    this.state.tabs.set(id, tab);

    // Add to tab bar
    const tabContainer = this.elements.tabBar?.querySelector('.terminal-tabs');
    if (tabContainer) {
      tabContainer.appendChild(tabElement);
    }

    // Activate if first tab
    if (this.state.tabs.size === 1) {
      this.activateTab(id);
    }

    this.emit('tab-added', { id, title });
  }

  activateTab(id: string): void {
    const tab = this.state.tabs.get(id);
    if (!tab) return;

    // Deactivate current tab
    if (this.state.activeTab) {
      const currentTab = this.state.tabs.get(this.state.activeTab);
      if (currentTab?.element) {
        currentTab.element.classList.remove('active');
      }
    }

    // Activate new tab
    if (tab.element) {
      tab.element.classList.add('active');
    }
    this.state.activeTab = id;

    // Update session info
    this.updateSessionInfo(`Session: ${tab.title}`);

    this.emit('tab-activated', { id });
  }

  closeTab(id: string): void {
    const tab = this.state.tabs.get(id);
    if (!tab) return;

    // Remove from DOM
    if (tab.element) {
      tab.element.remove();
    }

    // Remove from state
    this.state.tabs.delete(id);

    // Activate another tab if this was active
    if (this.state.activeTab === id) {
      this.state.activeTab = null;

      // Activate first remaining tab
      const firstTab = this.state.tabs.keys().next().value;
      if (firstTab) {
        this.activateTab(firstTab);
      }
    }

    this.emit('tab-closed', { id });
  }

  closeActiveTab(): void {
    if (this.state.activeTab) {
      this.closeTab(this.state.activeTab);
    }
  }

  nextTab(): void {
    const tabIds = Array.from(this.state.tabs.keys());
    const currentIndex = this.state.activeTab ? tabIds.indexOf(this.state.activeTab) : -1;
    const nextIndex = (currentIndex + 1) % tabIds.length;

    if (tabIds[nextIndex]) {
      this.activateTab(tabIds[nextIndex]);
    }
  }

  // UI actions
  private handleAction(action: string): void {
    switch (action) {
      case 'new-session':
        this.emit('new-session-requested');
        break;

      case 'copy':
        this.emit('copy-requested');
        break;

      case 'paste':
        this.emit('paste-requested');
        break;

      case 'search':
        this.emit('search-requested');
        break;

      case 'settings':
        this.emit('settings-requested');
        break;

      case 'maximize':
        this.toggleMaximize();
        break;

      case 'close':
        this.hide();
        break;
    }
  }

  // Visibility
  show(): void {
    if (!this.elements.wrapper) return;

    if (this.config.animations) {
      this.elements.wrapper.style.display = 'flex';
      requestAnimationFrame(() => {
        if (this.elements.wrapper) {
          this.elements.wrapper.classList.add('visible');
        }
      });
    } else {
      this.elements.wrapper.style.display = 'flex';
      this.elements.wrapper.classList.add('visible');
    }

    this.state.visible = true;
    this.emit('shown');
  }

  hide(): void {
    if (!this.elements.wrapper) return;

    if (this.config.animations) {
      this.elements.wrapper.classList.remove('visible');
      setTimeout(() => {
        if (this.elements.wrapper) {
          this.elements.wrapper.style.display = 'none';
        }
      }, 300);
    } else {
      this.elements.wrapper.classList.remove('visible');
      this.elements.wrapper.style.display = 'none';
    }

    this.state.visible = false;
    this.emit('hidden');
  }

  toggle(): void {
    if (this.state.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isVisible(): boolean {
    return this.state.visible;
  }

  // Maximize/restore
  toggleMaximize(): void {
    if (this.state.maximized) {
      this.restore();
    } else {
      this.maximize();
    }
  }

  maximize(): void {
    if (!this.elements.wrapper) return;

    this.elements.wrapper.classList.add('maximized');
    this.state.maximized = true;

    // Update button
    const maximizeBtn = this.elements.toolbar?.querySelector('[data-action="maximize"]') as HTMLElement;
    if (maximizeBtn) {
      maximizeBtn.innerHTML = '⬛';
      maximizeBtn.title = 'Restore';
    }

    this.emit('maximized');
  }

  restore(): void {
    if (!this.elements.wrapper) return;

    this.elements.wrapper.classList.remove('maximized');
    this.state.maximized = false;

    // Update button
    const maximizeBtn = this.elements.toolbar?.querySelector('[data-action="maximize"]') as HTMLElement;
    if (maximizeBtn) {
      maximizeBtn.innerHTML = '⬜';
      maximizeBtn.title = 'Maximize';
    }

    this.emit('restored');
  }

  // Resize
  private startResize(e: MouseEvent): void {
    if (!this.elements.wrapper) return;

    this.resizeState.isResizing = true;
    this.resizeState.startX = e.clientX;
    this.resizeState.startY = e.clientY;

    const rect = this.elements.wrapper.getBoundingClientRect();
    this.resizeState.startWidth = rect.width;
    this.resizeState.startHeight = rect.height;

    this.elements.wrapper.classList.add('resizing');
    document.body.style.cursor = this.getResizeCursor();
  }

  private doResize(e: MouseEvent): void {
    if (!this.resizeState.isResizing || !this.elements.wrapper) return;

    const deltaX = e.clientX - this.resizeState.startX;
    const deltaY = e.clientY - this.resizeState.startY;

    let newWidth = this.resizeState.startWidth;
    let newHeight = this.resizeState.startHeight;

    switch (this.config.position) {
      case 'bottom':
        newHeight = this.resizeState.startHeight - deltaY;
        break;

      case 'right':
        newWidth = this.resizeState.startWidth - deltaX;
        break;

      case 'floating':
        newWidth = this.resizeState.startWidth + deltaX;
        newHeight = this.resizeState.startHeight + deltaY;
        break;
    }

    // Apply min size constraints
    newWidth = Math.max(newWidth, this.config.minSize.width);
    newHeight = Math.max(newHeight, this.config.minSize.height);

    this.applySize({ width: newWidth + 'px', height: newHeight + 'px' });

    this.emit('resized', { width: newWidth, height: newHeight });
  }

  private endResize(): void {
    if (!this.resizeState.isResizing || !this.elements.wrapper) return;

    this.resizeState.isResizing = false;
    this.elements.wrapper.classList.remove('resizing');
    document.body.style.cursor = '';
  }

  private getResizeCursor(): string {
    switch (this.config.position) {
      case 'bottom':
        return 'ns-resize';
      case 'right':
        return 'ew-resize';
      case 'floating':
        return 'nwse-resize';
      default:
        return 'default';
    }
  }

  private applySize(size: { width?: string; height?: string }): void {
    if (!this.elements.wrapper) return;

    if (size.width) {
      this.elements.wrapper.style.width = size.width;
    }
    if (size.height) {
      this.elements.wrapper.style.height = size.height;
    }
  }

  // Status updates
  setConnectionStatus(status: ConnectionStatus): void {
    this.state.connectionStatus = status;

    const statusElement = this.elements.statusBar?.querySelector('.connection-status');
    if (statusElement) {
      const indicator = statusElement.querySelector('.status-indicator') as HTMLElement;
      const text = statusElement.querySelector('.status-text') as HTMLElement;

      // Update indicator color
      indicator.className = 'status-indicator';
      switch (status) {
        case 'connected':
          indicator.classList.add('connected');
          text.textContent = 'Connected';
          break;
        case 'disconnected':
          indicator.classList.add('disconnected');
          text.textContent = 'Disconnected';
          break;
        case 'reconnecting':
          indicator.classList.add('reconnecting');
          text.textContent = 'Reconnecting...';
          break;
      }
    }
  }

  updateSessionInfo(info: string): void {
    const sessionElement = this.elements.statusBar?.querySelector('.session-info');
    if (sessionElement) {
      sessionElement.textContent = info;
    }
  }

  updateTerminalSize(cols: number, rows: number): void {
    const sizeElement = this.elements.statusBar?.querySelector('.terminal-size');
    if (sizeElement) {
      sizeElement.textContent = `${cols}×${rows}`;
    }
  }

  updatePerformance(fps: number, latency: number): void {
    const perfElement = this.elements.statusBar?.querySelector('.performance-metrics');
    if (perfElement) {
      const fpsElement = perfElement.querySelector('.fps') as HTMLElement;
      const latencyElement = perfElement.querySelector('.latency') as HTMLElement;
      if (fpsElement) fpsElement.textContent = `${fps} FPS`;
      if (latencyElement) latencyElement.textContent = `${latency}ms`;
    }
  }

  setTitle(title: string): void {
    const titleElement = this.elements.toolbar?.querySelector('.terminal-title');
    if (titleElement) {
      titleElement.textContent = title;
    }

    // Update active tab title
    if (this.state.activeTab) {
      const tab = this.state.tabs.get(this.state.activeTab);
      if (tab) {
        tab.title = title;
        const tabTitle = tab.element?.querySelector('.tab-title');
        if (tabTitle) {
          tabTitle.textContent = title;
        }
      }
    }
  }

  setActiveSession(sessionId: string | null): void {
    if (sessionId) {
      this.updateSessionInfo(`Session: ${sessionId}`);
    } else {
      this.updateSessionInfo('No active session');
    }
  }

  // Context menu
  private createContextMenu(): void {
    this.elements.contextMenu = document.createElement('div');
    this.elements.contextMenu.className = 'terminal-context-menu';
    document.body.appendChild(this.elements.contextMenu);
  }

  showContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    const menu = this.elements.contextMenu;
    if (!menu) return;

    menu.innerHTML = '';

    items.forEach(item => {
      if (item.separator) {
        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';
        menu.appendChild(separator);
      } else {
        const menuItem = document.createElement('div');
        menuItem.className = 'context-menu-item';
        if (item.disabled) {
          menuItem.classList.add('disabled');
        }

        menuItem.innerHTML = `
          <span class="menu-item-label">${item.label}</span>
          ${item.shortcut ? `<span class="menu-item-shortcut">${item.shortcut}</span>` : ''}
        `;

        if (!item.disabled) {
          menuItem.addEventListener('click', () => {
            this.hideContextMenu();
            if (item.action) {
              item.action();
            }
          });
        }

        menu.appendChild(menuItem);
      }
    });

    // Position menu
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.add('visible');

    // Ensure menu is within viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();

      if (rect.right > window.innerWidth) {
        menu.style.left = (x - rect.width) + 'px';
      }

      if (rect.bottom > window.innerHeight) {
        menu.style.top = (y - rect.height) + 'px';
      }
    });
  }

  hideContextMenu(): void {
    if (this.elements.contextMenu) {
      this.elements.contextMenu.classList.remove('visible');
    }
  }

  // Notifications
  private createNotifications(): void {
    this.elements.notifications = document.createElement('div');
    this.elements.notifications.className = 'terminal-notifications';
    if (this.elements.wrapper) {
      this.elements.wrapper.appendChild(this.elements.notifications);
    }
  }

  showNotification(message: string, type: NotificationType = 'info', duration: number = 3000): void {
    if (!this.elements.notifications) return;

    const notification = document.createElement('div');
    notification.className = `terminal-notification ${type}`;
    notification.textContent = message;

    this.elements.notifications.appendChild(notification);

    // Animate in
    requestAnimationFrame(() => {
      notification.classList.add('visible');
    });

    // Auto-hide
    setTimeout(() => {
      notification.classList.remove('visible');
      setTimeout(() => {
        notification.remove();
      }, 300);
    }, duration);

    // Click to dismiss
    notification.addEventListener('click', () => {
      notification.classList.remove('visible');
      setTimeout(() => {
        notification.remove();
      }, 300);
    });
  }

  // Theme management
  applyTheme(themeName: string): void {
    if (this.elements.wrapper) {
      this.elements.wrapper.setAttribute('data-theme', themeName);
    }
    this.config.theme = themeName;
  }

  // Getters
  getTerminalContainer(): HTMLElement | null {
    return this.elements.terminalContainer;
  }

  // Event emitter
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
    // Remove event listeners
    if ((this as any).handleKeydown) {
      document.removeEventListener('keydown', (this as any).handleKeydown);
    }
    if ((this as any).handleDocumentClick) {
      document.removeEventListener('click', (this as any).handleDocumentClick);
    }

    // Remove DOM elements
    this.elements.wrapper?.remove();
    this.elements.contextMenu?.remove();

    // Clear state
    this.state.tabs.clear();
    this.listeners.clear();

    this.emit('destroyed');
  }

  // Styles injection
  private injectStyles(): void {
    if (document.getElementById('nexus-terminal-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'nexus-terminal-styles';
    style.textContent = `
      .nexus-terminal-wrapper {
        position: fixed;
        display: none;
        flex-direction: column;
        background: var(--terminal-bg, #0a0a0a);
        border: 1px solid var(--terminal-border, #333);
        box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
        z-index: 10000;
        transition: all 0.3s ease;
      }
      
      .nexus-terminal-wrapper[data-position="bottom"] {
        bottom: 0;
        left: 0;
        right: 0;
        height: 50%;
        border-top: 2px solid var(--terminal-accent, #00d4aa);
      }
      
      .nexus-terminal-wrapper[data-position="right"] {
        top: 0;
        right: 0;
        bottom: 0;
        width: 50%;
        border-left: 2px solid var(--terminal-accent, #00d4aa);
      }
      
      .nexus-terminal-wrapper[data-position="fullscreen"] {
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
      }
      
      .nexus-terminal-wrapper[data-position="floating"] {
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 80%;
        height: 60%;
        border-radius: 8px;
      }
      
      .nexus-terminal-wrapper.visible {
        display: flex;
        opacity: 1;
      }
      
      .nexus-terminal-wrapper.maximized {
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        transform: none !important;
      }
      
      /* Toolbar */
      .terminal-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 32px;
        padding: 0 12px;
        background: var(--terminal-toolbar-bg, #1a1a1a);
        border-bottom: 1px solid var(--terminal-border, #333);
        user-select: none;
      }
      
      .terminal-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--terminal-text, #e4e4e4);
      }
      
      .terminal-actions {
        display: flex;
        gap: 4px;
      }
      
      .terminal-action-btn {
        width: 28px;
        height: 28px;
        border: none;
        background: transparent;
        color: var(--terminal-text, #e4e4e4);
        cursor: pointer;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        transition: all 0.2s;
      }
      
      .terminal-action-btn:hover {
        background: var(--terminal-hover, rgba(255, 255, 255, 0.1));
      }
      
      /* Tab bar */
      .terminal-tab-bar {
        display: flex;
        align-items: center;
        height: 32px;
        background: var(--terminal-tab-bg, #141414);
        border-bottom: 1px solid var(--terminal-border, #333);
        padding: 0 8px;
        overflow-x: auto;
      }
      
      .terminal-tabs {
        display: flex;
        flex: 1;
        gap: 2px;
      }
      
      .terminal-tab {
        display: flex;
        align-items: center;
        padding: 0 12px;
        height: 28px;
        background: var(--terminal-tab-inactive, #1a1a1a);
        border-radius: 4px 4px 0 0;
        cursor: pointer;
        user-select: none;
        transition: all 0.2s;
      }
      
      .terminal-tab.active {
        background: var(--terminal-bg, #0a0a0a);
        border: 1px solid var(--terminal-border, #333);
        border-bottom: none;
      }
      
      .tab-title {
        font-size: 12px;
        color: var(--terminal-text, #e4e4e4);
        margin-right: 8px;
      }
      
      .tab-close-btn {
        width: 16px;
        height: 16px;
        border: none;
        background: transparent;
        color: var(--terminal-text-secondary, #999);
        cursor: pointer;
        border-radius: 2px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        line-height: 1;
      }
      
      .tab-close-btn:hover {
        background: var(--terminal-hover, rgba(255, 255, 255, 0.1));
        color: var(--terminal-text, #e4e4e4);
      }
      
      .terminal-new-tab-btn {
        width: 24px;
        height: 24px;
        border: none;
        background: transparent;
        color: var(--terminal-text-secondary, #999);
        cursor: pointer;
        border-radius: 4px;
        font-size: 16px;
        margin-left: 4px;
      }
      
      .terminal-new-tab-btn:hover {
        background: var(--terminal-hover, rgba(255, 255, 255, 0.1));
        color: var(--terminal-text, #e4e4e4);
      }
      
      /* Terminal container */
      .terminal-container {
        flex: 1;
        overflow: hidden;
        background: var(--terminal-bg, #0a0a0a);
      }
      
      /* Status bar */
      .terminal-status-bar {
        display: flex;
        align-items: center;
        height: 24px;
        padding: 0 12px;
        background: var(--terminal-statusbar-bg, #1a1a1a);
        border-top: 1px solid var(--terminal-border, #333);
        font-size: 11px;
        color: var(--terminal-text-secondary, #999);
        user-select: none;
      }
      
      .status-item {
        display: flex;
        align-items: center;
        margin-right: 16px;
      }
      
      .status-item:last-child {
        margin-left: auto;
        margin-right: 0;
      }
      
      .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--terminal-text-secondary, #999);
        margin-right: 6px;
      }
      
      .status-indicator.connected {
        background: #50fa7b;
      }
      
      .status-indicator.disconnected {
        background: #ff5555;
      }
      
      .status-indicator.reconnecting {
        background: #f1fa8c;
        animation: pulse 1s infinite;
      }
      
      @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
      }
      
      /* Resize handle */
      .terminal-resize-handle {
        position: absolute;
        background: transparent;
        z-index: 10;
      }
      
      .nexus-terminal-wrapper[data-position="bottom"] .terminal-resize-handle {
        top: 0;
        left: 0;
        right: 0;
        height: 4px;
        cursor: ns-resize;
      }
      
      .nexus-terminal-wrapper[data-position="right"] .terminal-resize-handle {
        top: 0;
        left: 0;
        bottom: 0;
        width: 4px;
        cursor: ew-resize;
      }
      
      .nexus-terminal-wrapper[data-position="floating"] .terminal-resize-handle {
        bottom: 0;
        right: 0;
        width: 16px;
        height: 16px;
        cursor: nwse-resize;
      }
      
      /* Context menu */
      .terminal-context-menu {
        position: fixed;
        background: var(--terminal-menu-bg, #1a1a1a);
        border: 1px solid var(--terminal-border, #333);
        border-radius: 4px;
        padding: 4px 0;
        min-width: 160px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        z-index: 10001;
        display: none;
      }
      
      .terminal-context-menu.visible {
        display: block;
      }
      
      .context-menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 16px;
        font-size: 12px;
        color: var(--terminal-text, #e4e4e4);
        cursor: pointer;
        user-select: none;
      }
      
      .context-menu-item:hover:not(.disabled) {
        background: var(--terminal-hover, rgba(255, 255, 255, 0.1));
      }
      
      .context-menu-item.disabled {
        opacity: 0.5;
        cursor: default;
      }
      
      .context-menu-separator {
        height: 1px;
        background: var(--terminal-border, #333);
        margin: 4px 0;
      }
      
      .menu-item-shortcut {
        margin-left: 24px;
        font-size: 11px;
        color: var(--terminal-text-secondary, #999);
      }
      
      /* Notifications */
      .terminal-notifications {
        position: absolute;
        top: 8px;
        right: 8px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
      }
      
      .terminal-notification {
        padding: 8px 16px;
        background: var(--terminal-notification-bg, #2a2a2a);
        border: 1px solid var(--terminal-border, #333);
        border-radius: 4px;
        font-size: 12px;
        color: var(--terminal-text, #e4e4e4);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s;
        pointer-events: auto;
        cursor: pointer;
      }
      
      .terminal-notification.visible {
        opacity: 1;
        transform: translateX(0);
      }
      
      .terminal-notification.info {
        border-color: #8be9fd;
      }
      
      .terminal-notification.warning {
        border-color: #f1fa8c;
      }
      
      .terminal-notification.error {
        border-color: #ff5555;
      }
      
      .terminal-notification.success {
        border-color: #50fa7b;
      }
      
      /* Theme variables */
      .nexus-terminal-wrapper[data-theme="nexus-dark"] {
        --terminal-bg: #0a0a0a;
        --terminal-toolbar-bg: #1a1a1a;
        --terminal-tab-bg: #141414;
        --terminal-tab-inactive: #1a1a1a;
        --terminal-statusbar-bg: #1a1a1a;
        --terminal-menu-bg: #1a1a1a;
        --terminal-notification-bg: #2a2a2a;
        --terminal-border: #333;
        --terminal-accent: #00d4aa;
        --terminal-text: #e4e4e4;
        --terminal-text-secondary: #999;
        --terminal-hover: rgba(255, 255, 255, 0.1);
      }
      
      .nexus-terminal-wrapper[data-theme="nexus-light"] {
        --terminal-bg: #ffffff;
        --terminal-toolbar-bg: #f5f5f5;
        --terminal-tab-bg: #eeeeee;
        --terminal-tab-inactive: #f5f5f5;
        --terminal-statusbar-bg: #f5f5f5;
        --terminal-menu-bg: #ffffff;
        --terminal-notification-bg: #f5f5f5;
        --terminal-border: #ddd;
        --terminal-accent: #007acc;
        --terminal-text: #1a1a1a;
        --terminal-text-secondary: #666;
        --terminal-hover: rgba(0, 0, 0, 0.05);
      }
    `;

    document.head.appendChild(style);
  }
}

export default TerminalUI;