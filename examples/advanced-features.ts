/**
 * Advanced Features Example - Nexus Console
 * Demonstrates advanced terminal features and customization
 */

import { 
  NexusConsole, 
  TerminalState, 
  CommandSanitizer,
  CacheManager,
  type NexusConsoleConfig,
  type SessionOptions,
} from '../src';

class AdvancedTerminalExample {
  private terminal: NexusConsole;
  private sessionManager: Map<string, { name: string; purpose: string }>;

  constructor() {
    this.sessionManager = new Map();
  }

  async initialize() {
    // Custom configuration
    const config: NexusConsoleConfig = {
      container: document.getElementById('terminal-container'),
      theme: 'nexus-dark',
      fontSize: 14,
      fontFamily: '"SF Mono", Monaco, "Cascadia Code", monospace',
      cursorStyle: 'block',
      cursorBlink: true,
      scrollback: 10000,
      wsUrl: process.env.TERMINAL_WS_URL || 'ws://localhost:3001/terminal/ws',
      enableFileSystem: true,
      enableCache: true,
      securityLevel: 'strict',
      position: 'bottom',
      macOptionIsMeta: true,
      rightClickSelectsWord: true,
      allowTransparency: true,
      showToolbar: true,
      showTabs: true,
      showStatusBar: true,
      resizable: true,
      animations: true,
    };

    this.terminal = new NexusConsole(config);

    // Set up event handlers
    this.setupEventHandlers();

    // Initialize terminal
    await this.terminal.initialize();

    // Create initial sessions
    await this.createNamedSession('main', 'Main workspace', {
      cwd: '/workspace',
      env: { PROJECT: 'nexus-console' },
    });

    await this.createNamedSession('logs', 'Log monitoring', {
      cwd: '/var/log',
      env: { TERM_PURPOSE: 'logs' },
    });

    await this.createNamedSession('docker', 'Docker management', {
      shell: '/bin/bash',
      env: { DOCKER_HOST: 'unix:///var/run/docker.sock' },
    });
  }

  private setupEventHandlers() {
    // Connection events
    this.terminal.on('connected', () => {
      this.showNotification('Connected to terminal server', 'success');
    });

    this.terminal.on('disconnected', ({ reason }) => {
      this.showNotification(`Disconnected: ${reason}`, 'error');
    });

    this.terminal.on('reconnecting', ({ attempt, delay }) => {
      this.showNotification(`Reconnecting (attempt ${attempt})...`, 'info');
    });

    // Session events
    this.terminal.on('session_created', ({ sessionId, options }) => {
      console.log('Session created:', sessionId, options);
    });

    this.terminal.on('session_closed', ({ sessionId }) => {
      const sessionInfo = this.sessionManager.get(sessionId);
      if (sessionInfo) {
        this.showNotification(`Session "${sessionInfo.name}" closed`, 'info');
        this.sessionManager.delete(sessionId);
      }
    });

    // Command events
    this.terminal.on('command_executed', ({ command, sessionId }) => {
      // Log commands for audit
      this.logCommand(sessionId, command);
    });

    // Error handling
    this.terminal.on('error', (error) => {
      console.error('Terminal error:', error);
      this.showNotification(`Error: ${error.message}`, 'error');
    });

    // Custom keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  private setupKeyboardShortcuts() {
    document.addEventListener('keydown', async (e) => {
      // Ctrl+Shift+T: New session
      if (e.ctrlKey && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        await this.createQuickSession();
      }

      // Ctrl+Shift+W: Close current session
      if (e.ctrlKey && e.shiftKey && e.key === 'W') {
        e.preventDefault();
        const activeSession = this.terminal.getActiveSession();
        if (activeSession) {
          await this.terminal.closeSession(activeSession);
        }
      }

      // Ctrl+Tab: Next session
      if (e.ctrlKey && e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        await this.switchToNextSession();
      }

      // Ctrl+Shift+Tab: Previous session
      if (e.ctrlKey && e.shiftKey && e.key === 'Tab') {
        e.preventDefault();
        await this.switchToPreviousSession();
      }

      // Ctrl+Shift+C: Copy
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        this.terminal.emit('copy-requested');
      }

      // Ctrl+Shift+V: Paste
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.terminal.emit('paste-requested');
      }

      // Ctrl+L: Clear terminal
      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        this.terminal.clear();
      }
    });
  }

  private async createNamedSession(
    name: string, 
    purpose: string, 
    options?: SessionOptions
  ): Promise<string> {
    const sessionId = await this.terminal.createSession(options);
    this.sessionManager.set(sessionId, { name, purpose });
    return sessionId;
  }

  private async createQuickSession() {
    const name = `session-${Date.now()}`;
    const sessionId = await this.createNamedSession(
      name,
      'Quick session',
      { cwd: process.cwd() }
    );
    await this.terminal.attachToSession(sessionId);
  }

  private async switchToNextSession() {
    const sessions = this.terminal.getSessions();
    const activeSession = this.terminal.getActiveSession();
    
    if (sessions.length <= 1) return;

    const currentIndex = sessions.findIndex(s => s.id === activeSession);
    const nextIndex = (currentIndex + 1) % sessions.length;
    
    await this.terminal.attachToSession(sessions[nextIndex].id);
  }

  private async switchToPreviousSession() {
    const sessions = this.terminal.getSessions();
    const activeSession = this.terminal.getActiveSession();
    
    if (sessions.length <= 1) return;

    const currentIndex = sessions.findIndex(s => s.id === activeSession);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessions.length - 1;
    
    await this.terminal.attachToSession(sessions[prevIndex].id);
  }

  // Advanced file operations
  async demonstrateFileOperations() {
    try {
      // Request file system access
      await this.terminal.requestFileAccess();

      // List directory contents
      const files = await this.terminal.listDirectory('/workspace');
      console.log('Directory contents:', files);

      // Read a configuration file
      const configContent = await this.terminal.readFile('/workspace/config.json');
      const config = JSON.parse(configContent as string);
      console.log('Configuration:', config);

      // Write a new file
      const logData = {
        timestamp: new Date().toISOString(),
        sessions: this.terminal.getSessions(),
        metrics: this.terminal.getMetrics(),
      };
      
      await this.terminal.writeFile(
        '/workspace/terminal-log.json',
        JSON.stringify(logData, null, 2)
      );

      this.showNotification('File operations completed', 'success');

    } catch (error) {
      console.error('File operation error:', error);
      this.showNotification(`File operation failed: ${error.message}`, 'error');
    }
  }

  // Performance monitoring
  startPerformanceMonitoring() {
    setInterval(() => {
      const metrics = this.terminal.getMetrics();
      
      // Update performance display
      this.updatePerformanceDisplay({
        sessions: metrics.sessions,
        commands: metrics.commandCount,
        avgLatency: metrics.averageCommandLatency || 0,
        connected: metrics.connected,
        messagesPerSec: this.calculateMessageRate(metrics),
        bandwidth: this.formatBytes(metrics.bytesTransferred || 0),
      });

      // Alert if performance degrades
      if (metrics.averageCommandLatency && metrics.averageCommandLatency > 100) {
        console.warn('High command latency detected:', metrics.averageCommandLatency);
      }
    }, 1000);
  }

  // Utility methods
  private showNotification(message: string, type: 'info' | 'success' | 'error' = 'info') {
    // Implementation would show actual UI notification
    console.log(`[${type.toUpperCase()}] ${message}`);
  }

  private logCommand(sessionId: string, command: string) {
    const sessionInfo = this.sessionManager.get(sessionId);
    console.log(`Command log: [${sessionInfo?.name || sessionId}] ${command}`);
  }

  private updatePerformanceDisplay(stats: any) {
    // Implementation would update UI with performance stats
    console.log('Performance stats:', stats);
  }

  private calculateMessageRate(metrics: any): number {
    // Simple message rate calculation
    return metrics.messagesReceived || 0;
  }

  private formatBytes(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }

  // Theme customization
  async applyCustomTheme() {
    // Create a custom theme
    const customTheme = {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#aeafad',
      cursorAccent: '#000000',
      selection: '#264f78',
      black: '#000000',
      red: '#cd3131',
      green: '#0dbc79',
      yellow: '#e5e510',
      blue: '#2472c8',
      magenta: '#bc3fbc',
      cyan: '#11a8cd',
      white: '#e5e5e5',
      brightBlack: '#666666',
      brightRed: '#f14c4c',
      brightGreen: '#23d18b',
      brightYellow: '#f5f543',
      brightBlue: '#3b8eea',
      brightMagenta: '#d670d6',
      brightCyan: '#29b8db',
      brightWhite: '#e5e5e5',
    };

    // Apply theme
    this.terminal.setTheme('custom-theme');
  }
}

// Initialize the example
const example = new AdvancedTerminalExample();
example.initialize().then(() => {
  console.log('Advanced terminal example initialized');
  
  // Start performance monitoring
  example.startPerformanceMonitoring();
  
  // Demonstrate file operations after 2 seconds
  setTimeout(() => {
    example.demonstrateFileOperations();
  }, 2000);
}).catch(error => {
  console.error('Failed to initialize terminal:', error);
});