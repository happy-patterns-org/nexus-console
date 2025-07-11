/**
 * Enhanced Terminal WebSocket Manager with Bearer Token Support
 * Compatible with Happy Observatory's authentication system
 */

import TerminalWebSocketManager from './TerminalWebSocket';
import type { WebSocketConfig } from './TerminalWebSocket';

export interface EnhancedWebSocketConfig extends WebSocketConfig {
  authToken?: string;
  authEndpoint?: string;
  useAuthHeaders?: boolean;
  tokenStorage?: 'memory' | 'sessionStorage' | 'none';
}

export class TerminalWebSocketEnhanced extends TerminalWebSocketManager {
  private authToken?: string;
  private authEndpoint?: string;
  private useAuthHeaders: boolean;
  private tokenStorage: 'memory' | 'sessionStorage' | 'none';
  private WS: any; // Access parent's WS implementation
  
  constructor(config: EnhancedWebSocketConfig = {}) {
    super(config);
    // Get WebSocket implementation from parent
    this.WS = (this as any).WS;
    this.authToken = config.authToken;
    this.authEndpoint = config.authEndpoint || '/api/auth/token';
    this.useAuthHeaders = config.useAuthHeaders ?? true;
    this.tokenStorage = config.tokenStorage || 'memory';
  }
  
  /**
   * Override connect to use auth headers
   */
  async connect(): Promise<void> {
    if (this.useAuthHeaders) {
      // Use the enhanced connection method
      return this.connectWithHeaders();
    }
    // Fall back to parent implementation
    return super.connect();
  }
  
  /**
   * Connect with authorization headers
   */
  private async connectWithHeaders(): Promise<void> {
    if (this.ws && this.state.connected) {
      console.warn('Already connected');
      return;
    }
    
    this.state.connecting = true;
    
    try {
      // Get authentication token
      const token = await this.getAuthToken();
      
      // Create WebSocket URL
      let url: URL;
      if (this.config.wsUrl) {
        // Use provided URL directly if it's absolute
        if (this.config.wsUrl.startsWith('ws://') || this.config.wsUrl.startsWith('wss://')) {
          url = new URL(this.config.wsUrl);
        } else {
          // Relative URL - prepend protocol and host
          const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          url = new URL(`${wsProtocol}//${window.location.host}${this.config.wsUrl}`);
        }
      } else {
        // Default WebSocket URL
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url = new URL(`${wsProtocol}//${window.location.host}/ws`);
      }
      
      // Create WebSocket with auth headers
      // Use injected WebSocket implementation if available
      if (this.WS) {
        // If we have an injected WebSocket, use it
        url.searchParams.set('token', token);
        this.ws = new this.WS(url.toString());
      } else if (typeof require !== 'undefined') {
        // Check if we're in Node.js environment with ws package
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const WS = require('ws');
          this.ws = new WS(url.toString(), {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
        } catch {
          // Fallback to standard WebSocket with token in URL
          url.searchParams.set('token', token);
          this.ws = new WebSocket(url.toString());
        }
      } else {
        // Browser environment - add token to URL
        url.searchParams.set('token', token);
        this.ws = new WebSocket(url.toString());
      }
      
      this.setupEventHandlers();
      
      // Wait for connection to be established
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 5000);
        
        const onConnected = () => {
          clearTimeout(timeout);
          this.off('connected', onConnected);
          this.off('error', onError);
          resolve();
        };
        
        const onError = (error: any) => {
          clearTimeout(timeout);
          this.off('connected', onConnected);
          this.off('error', onError);
          reject(error);
        };
        
        this.on('connected', onConnected);
        this.on('error', onError);
      });
      
    } catch (error) {
      this.state.connecting = false;
      this.handleError('Connection failed', error);
      throw error;
    }
  }
  
  /**
   * Enhanced auth token getter
   */
  protected async getAuthToken(): Promise<string> {
    // Use provided token if available
    if (this.authToken) {
      return this.authToken;
    }
    
    // Check storage based on configuration
    if (this.tokenStorage !== 'none') {
      const storedToken = this.getStoredToken();
      if (storedToken && !this.isTokenExpired(storedToken)) {
        return storedToken;
      }
    }
    
    // Request new token
    const newToken = await this.requestNewToken();
    
    // Store token based on configuration
    if (this.tokenStorage !== 'none') {
      this.storeToken(newToken);
    }
    
    return newToken;
  }
  
  /**
   * Request new token with bearer auth support
   */
  protected async requestNewToken(): Promise<string> {
    const response = await fetch(this.authEndpoint!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Include existing auth token if refreshing
        ...(this.authToken ? { 'Authorization': `Bearer ${this.authToken}` } : {})
      },
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to authenticate');
    }
    
    const data = await response.json();
    return data.token;
  }
  
  /**
   * Get stored token based on storage configuration
   */
  private getStoredToken(): string | null {
    switch (this.tokenStorage) {
      case 'sessionStorage':
        return sessionStorage.getItem('nexus_console_token');
      case 'memory':
        return this.authToken || null;
      default:
        return null;
    }
  }
  
  /**
   * Store token based on storage configuration
   */
  private storeToken(token: string): void {
    switch (this.tokenStorage) {
      case 'sessionStorage':
        sessionStorage.setItem('nexus_console_token', token);
        break;
      case 'memory':
        this.authToken = token;
        break;
    }
  }
  
  /**
   * Set auth token programmatically
   */
  public setAuthToken(token: string): void {
    this.authToken = token;
    if (this.tokenStorage !== 'none') {
      this.storeToken(token);
    }
  }
  
  /**
   * Clear stored auth token
   */
  public clearAuthToken(): void {
    this.authToken = undefined;
    if (this.tokenStorage === 'sessionStorage') {
      sessionStorage.removeItem('nexus_console_token');
    }
  }
  
  /**
   * Override destroy to clean up auth
   */
  destroy(): void {
    if (this.tokenStorage === 'memory') {
      this.authToken = undefined;
    }
    super.destroy();
  }
}

export default TerminalWebSocketEnhanced;