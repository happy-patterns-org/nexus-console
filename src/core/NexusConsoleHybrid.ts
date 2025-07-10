/**
 * Hybrid Nexus Console with optional Bridge integration
 * Maintains direct WebSocket for PTY while adding Bridge capabilities
 */

import { getBridgeClient, type BridgeConfig } from '../bridge/BridgeClientEnhanced';
import { MetricsCollector } from '../bridge/MetricsCollector';
import type { NexusConsoleConfig } from '../types';

import NexusConsole from './NexusConsole';

export interface HybridConsoleConfig extends NexusConsoleConfig {
  bridge?: BridgeConfig;
  enableBridge?: boolean;
}

export class NexusConsoleHybrid extends NexusConsole {
  private bridge?: ReturnType<typeof getBridgeClient>;
  private metricsCollector?: MetricsCollector;
  private bridgeEnabled: boolean;
  
  constructor(config?: HybridConsoleConfig) {
    super(config);
    
    this.bridgeEnabled = config?.enableBridge ?? true;
    
    if (this.bridgeEnabled && config?.bridge) {
      this.initializeBridge(config.bridge);
    }
  }
  
  /**
   * Initialize Bridge integration
   */
  private initializeBridge(bridgeConfig: BridgeConfig): void {
    this.bridge = getBridgeClient(bridgeConfig);
    
    // Wait for Bridge to be available before setting up features
    const checkBridge = () => {
      if (this.bridge?.isAvailable()) {
        console.log('Bridge connection established, enabling enhanced features');
        this.setupBridgeFeatures();
      } else {
        // Retry after 5 seconds
        setTimeout(checkBridge, 5000);
      }
    };
    
    checkBridge();
  }
  
  /**
   * Set up Bridge-enhanced features
   */
  private setupBridgeFeatures(): void {
    // No need to modify terminal endpoint discovery - keep direct WebSocket
    console.log('Bridge features enabled: metrics reporting, telemetry');
  }
  
  /**
   * Override connect to discover endpoints via Bridge
   */
  async connect(): Promise<void> {
    // If Bridge is available, discover endpoints
    if (this.bridge?.isAvailable()) {
      try {
        const endpoints = await this.bridge.discoverEndpoints();
        if (endpoints.length > 0) {
          // Use the first healthy endpoint
          const endpoint = endpoints.find(e => e.health !== 'unhealthy') || endpoints[0];
          
          // Update WebSocket URL if different
          if (this.ws) {
            const currentUrl = (this.ws as any).config?.wsUrl;
            if (currentUrl !== endpoint.url) {
              console.log(`Using Bridge-discovered endpoint: ${endpoint.url}`);
              (this.ws as any).config.wsUrl = endpoint.url;
            }
          }
        }
      } catch (error) {
        console.warn('Failed to discover endpoints via Bridge, using default:', error);
      }
    }
    
    // Continue with normal connection
    return super.connect();
  }
  
  /**
   * Override session creation to add metrics collection
   */
  async createSession(options?: any): Promise<any> {
    const session = await super.createSession(options);
    
    // Set up metrics collection for this session
    if (this.bridge?.isAvailable() && session?.id) {
      this.metricsCollector = new MetricsCollector({
        sessionId: session.id
      });
      
      // Report metrics to Bridge
      this.metricsCollector.onFlush((metrics) => {
        this.bridge?.reportMetrics(metrics);
      });
    }
    
    return session;
  }
  
  /**
   * Override command execution to track metrics
   */
  async executeCommand(command: string, options?: any): Promise<any> {
    const startTime = Date.now();
    
    // Record command in metrics
    if (this.metricsCollector) {
      this.metricsCollector.recordCommand();
    }
    
    try {
      const result = await super.executeCommand(command, options);
      
      // Record latency
      if (this.metricsCollector) {
        const latency = Date.now() - startTime;
        this.metricsCollector.recordLatency(latency);
      }
      
      return result;
    } catch (error) {
      // Record error
      if (this.metricsCollector) {
        this.metricsCollector.recordError();
      }
      throw error;
    }
  }
  
  /**
   * Override write to track bytes
   */
  write(data: string | Uint8Array): void {
    // Track bytes transferred
    if (this.metricsCollector) {
      const bytes = typeof data === 'string' 
        ? new TextEncoder().encode(data).length 
        : data.length;
      this.metricsCollector.recordBytes(bytes);
    }
    
    super.write(data);
  }
  
  /**
   * Handle PTY output to track bytes
   */
  protected handlePtyOutput(event: any): void {
    // Track output bytes
    if (this.metricsCollector && event.data) {
      this.metricsCollector.recordBytes(event.data.length);
    }
    
    super.handlePtyOutput(event);
  }
  
  /**
   * Get Bridge status
   */
  getBridgeStatus(): { available: boolean; features?: string[] } {
    if (!this.bridge) {
      return { available: false };
    }
    
    const status = this.bridge.getStatus();
    return {
      available: status.available,
      features: status.features
    };
  }
  
  /**
   * Enable or disable Bridge integration
   */
  setBridgeEnabled(enabled: boolean): void {
    this.bridgeEnabled = enabled;
    
    if (!enabled && this.metricsCollector) {
      this.metricsCollector.destroy();
      this.metricsCollector = undefined;
    }
  }
  
  /**
   * Update Bridge configuration
   */
  updateBridgeConfig(config: BridgeConfig): void {
    if (!this.bridge) {
      this.initializeBridge(config);
    } else {
      this.bridge.updateConfig(config);
    }
  }
  
  /**
   * Override destroy to clean up Bridge resources
   */
  destroy(): void {
    // End metrics collection
    if (this.metricsCollector) {
      const finalMetrics = this.metricsCollector.endSession();
      
      // Send final metrics
      if (this.bridge?.isAvailable()) {
        this.bridge.reportMetrics(finalMetrics);
      }
      
      this.metricsCollector.destroy();
      this.metricsCollector = undefined;
    }
    
    // Clean up Bridge client
    if (this.bridge) {
      this.bridge = undefined;
    }
    
    super.destroy();
  }
}

export default NexusConsoleHybrid;