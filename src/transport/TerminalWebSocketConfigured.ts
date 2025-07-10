/**
 * Terminal WebSocket Manager with Shared Configuration
 * Uses type-safe configuration from @business-org/shared-config-ts
 */

import { 
  getConsoleWSUrl, 
  API_PATHS,
  CONSOLE_CONFIG
} from '@business-org/shared-config-ts';
import {
  ConsoleMessage,
  PTYMessage
} from '@business-org/shared-config-ts/console-types';

import TerminalWebSocketEnhanced from './TerminalWebSocketEnhanced';
import type { EnhancedWebSocketConfig } from './TerminalWebSocketEnhanced';

export interface ConfiguredWebSocketConfig extends Omit<EnhancedWebSocketConfig, 'wsUrl'> {
  projectId?: string;
  useSharedConfig?: boolean;
  customWsUrl?: string; // Allow override if needed
}

export class TerminalWebSocketConfigured extends TerminalWebSocketEnhanced {
  private projectId?: string;
  private useSharedConfig: boolean;
  
  constructor(config: ConfiguredWebSocketConfig = {}) {
    // Determine WebSocket URL
    const wsUrl = config.customWsUrl || 
                  (config.useSharedConfig !== false ? getConsoleWSUrl() : undefined);
    
    super({
      ...config,
      wsUrl,
      reconnectInterval: config.reconnectInterval || CONSOLE_CONFIG.reconnectInterval,
      maxReconnectAttempts: config.maxReconnectAttempts || CONSOLE_CONFIG.maxReconnectAttempts,
      heartbeatInterval: config.heartbeatInterval || CONSOLE_CONFIG.heartbeatInterval
    });
    
    this.projectId = config.projectId;
    this.useSharedConfig = config.useSharedConfig !== false;
  }
  
  /**
   * Connect with project-specific endpoint if configured
   */
  async connect(): Promise<void> {
    if (this.useSharedConfig && this.projectId) {
      // Use project-specific WebSocket endpoint
      const projectWsUrl = getConsoleWSUrl(`${API_PATHS.ws.projects}/${this.projectId}`);
      (this as any).config.wsUrl = projectWsUrl;
    }
    
    return super.connect();
  }
  
  /**
   * Create a terminal session with type-safe message
   */
  async createSession(options?: any): Promise<any> {
    const message: ConsoleMessage = {
      type: 'session_create',
      sessionId: this.generateId(),
      data: {
        cols: options?.cols || 80,
        rows: options?.rows || 24,
        cwd: options?.cwd,
        env: options?.env
      }
    };
    
    return this.sendMessage(message);
  }
  
  /**
   * Send PTY input with type-safe message
   */
  sendPtyInput(sessionId: string, data: string | Uint8Array): void {
    const message: PTYMessage = {
      type: 'pty_input',
      sessionId,
      data: typeof data === 'string' ? 
        Array.from(new TextEncoder().encode(data)) : 
        Array.from(data)
    };
    
    this.sendMessage(message);
  }
  
  /**
   * Resize terminal with type-safe message
   */
  resizeTerminal(sessionId: string, cols: number, rows: number): void {
    const message: ConsoleMessage = {
      type: 'session_resize',
      sessionId,
      data: { cols, rows }
    };
    
    this.sendMessage(message);
  }
  
  /**
   * Execute command with type-safe message
   */
  async executeCommand(sessionId: string, command: string): Promise<any> {
    const message: ConsoleMessage = {
      type: 'command_execute',
      sessionId,
      data: { command }
    };
    
    return this.sendMessage(message);
  }
  
  /**
   * Close session with type-safe message
   */
  async closeSession(sessionId: string): Promise<void> {
    const message: ConsoleMessage = {
      type: 'session_close',
      sessionId
    };
    
    await this.sendMessage(message);
  }
  
  /**
   * Handle incoming messages with proper typing
   */
  protected handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      // Handle based on message type
      switch (message.type) {
        case 'pty_output':
          this.handlePtyOutput(message as PTYMessage);
          break;
          
        case 'session_created':
        case 'session_closed':
        case 'command_result':
          this.handleSessionMessage(message as ConsoleMessage);
          break;
          
        case 'error':
          this.handleErrorMessage(message as ConsoleMessage);
          break;
          
        default:
          super.handleMessage(event);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      super.handleMessage(event);
    }
  }
  
  /**
   * Handle PTY output messages
   */
  private handlePtyOutput(message: PTYMessage): void {
    const data = new Uint8Array(message.data);
    this.emit('pty:output', {
      sessionId: message.sessionId,
      data
    });
  }
  
  /**
   * Handle session-related messages
   */
  private handleSessionMessage(message: ConsoleMessage): void {
    this.emit(`session:${message.type}`, {
      sessionId: message.sessionId,
      data: message.data
    });
  }
  
  /**
   * Handle error messages
   */
  private handleErrorMessage(message: ConsoleMessage): void {
    const error = new Error(message.data?.message || 'Unknown error');
    (error as any).code = message.data?.code;
    this.emit('error', error);
  }
  
  /**
   * Update project ID and reconnect if needed
   */
  async setProjectId(projectId: string): Promise<void> {
    if (this.projectId === projectId) return;
    
    this.projectId = projectId;
    
    // Reconnect with new project endpoint
    if (this.state.connected) {
      await this.disconnect();
      await this.connect();
    }
  }
  
  /**
   * Get current configuration
   */
  getConfiguration(): {
    projectId?: string;
    wsUrl: string;
    useSharedConfig: boolean;
  } {
    return {
      projectId: this.projectId,
      wsUrl: (this as any).config.wsUrl,
      useSharedConfig: this.useSharedConfig
    };
  }
}

export default TerminalWebSocketConfigured;