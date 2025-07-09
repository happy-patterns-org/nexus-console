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
  
  constructor(config: EnhancedWebSocketConfig = {}) {
    super(config);
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
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = this.config.wsUrl || `${window.location.host}/ws`;
      const url = new URL(`${wsProtocol}//${wsHost}`);
      
      // Create WebSocket with auth headers (requires a custom WebSocket implementation)
      // For standard WebSocket, we need to use a different approach
      this.ws = new WebSocket(url.toString(), [], {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      } as any);
      
      // If headers are not supported, fall back to URL parameter
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        url.searchParams.set('token', token);
        this.ws = new WebSocket(url.toString());
      }
      
      this.setupEventHandlers();
      
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