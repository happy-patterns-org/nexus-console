/**
 * Enhanced Bridge Client using shared configuration
 * Provides optional telemetry and metrics integration with type-safe configuration
 */

import { 
  getBridgeApiUrl, 
  getBridgeHost,
  API_PATHS,
  type ServiceConfig 
} from '@happy-devkit/shared-config';
import type { SessionMetrics, BridgeStatus, TerminalEndpoint } from './BridgeClient';

export interface BridgeConfig {
  bridgeUrl?: string;
  apiKey?: string;
  projectId?: string;
  enableMetrics?: boolean;
  enableDiscovery?: boolean;
  metricsInterval?: number;
}

type MetricsCallback = (metrics: SessionMetrics) => void;

class BridgeClientEnhanced {
  private config: Required<BridgeConfig>;
  private status: BridgeStatus;
  private metricsQueue: SessionMetrics[] = [];
  private metricsTimer?: NodeJS.Timeout;
  private checkTimer?: NodeJS.Timeout;
  private callbacks: Set<MetricsCallback> = new Set();
  
  constructor(config: BridgeConfig = {}) {
    this.config = {
      bridgeUrl: config.bridgeUrl || getBridgeHost(),
      apiKey: config.apiKey || '',
      projectId: config.projectId || '',
      enableMetrics: config.enableMetrics ?? true,
      enableDiscovery: config.enableDiscovery ?? true,
      metricsInterval: config.metricsInterval || 30000 // 30 seconds
    };
    
    this.status = {
      available: false,
      lastCheck: 0
    };
    
    // Start periodic health checks
    this.startHealthChecks();
  }
  
  /**
   * Start periodic health checks for Bridge availability
   */
  private startHealthChecks(): void {
    const check = async () => {
      try {
        const healthUrl = getBridgeApiUrl(API_PATHS.health);
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: this.getHeaders(),
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        
        if (response.ok) {
          const data = await response.json();
          this.status = {
            available: true,
            version: data.version,
            features: data.features || [],
            lastCheck: Date.now()
          };
          
          // Start metrics reporting if newly available
          if (this.config.enableMetrics && !this.metricsTimer) {
            this.startMetricsReporting();
          }
        } else {
          this.markUnavailable();
        }
      } catch (error) {
        this.markUnavailable();
      }
    };
    
    // Initial check
    check();
    
    // Periodic checks every 60 seconds
    this.checkTimer = setInterval(check, 60000);
  }
  
  /**
   * Mark Bridge as unavailable
   */
  private markUnavailable(): void {
    const wasAvailable = this.status.available;
    this.status = {
      available: false,
      lastCheck: Date.now()
    };
    
    // Stop metrics reporting if Bridge became unavailable
    if (wasAvailable && this.metricsTimer) {
      this.stopMetricsReporting();
    }
  }
  
  /**
   * Get headers for Bridge API requests
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }
    
    if (this.config.projectId) {
      headers['X-Project-ID'] = this.config.projectId;
    }
    
    return headers;
  }
  
  /**
   * Discover available terminal endpoints via Bridge
   */
  async discoverEndpoints(): Promise<TerminalEndpoint[]> {
    if (!this.status.available || !this.config.enableDiscovery) {
      // Return default endpoint when Bridge is not available
      return [{
        id: 'default',
        url: API_PATHS.ws.terminal,
        protocol: window.location.protocol === 'https:' ? 'wss' : 'ws'
      }];
    }
    
    try {
      const endpointsUrl = getBridgeApiUrl('/terminal/endpoints');
      const response = await fetch(endpointsUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        const endpoints = await response.json();
        return endpoints;
      }
    } catch (error) {
      console.warn('Failed to discover endpoints via Bridge:', error);
    }
    
    // Fallback to default
    return [{
      id: 'default',
      url: API_PATHS.ws.terminal,
      protocol: window.location.protocol === 'https:' ? 'wss' : 'ws'
    }];
  }
  
  /**
   * Report session metrics to Bridge
   */
  async reportMetrics(metrics: SessionMetrics): Promise<void> {
    if (!this.status.available || !this.config.enableMetrics) {
      return;
    }
    
    // Queue metrics for batch reporting
    this.metricsQueue.push(metrics);
    
    // Notify callbacks
    this.callbacks.forEach(callback => callback(metrics));
  }
  
  /**
   * Start periodic metrics reporting
   */
  private startMetricsReporting(): void {
    this.metricsTimer = setInterval(async () => {
      if (this.metricsQueue.length === 0) return;
      
      const batch = [...this.metricsQueue];
      this.metricsQueue = [];
      
      try {
        const metricsUrl = getBridgeApiUrl('/terminal/metrics');
        const response = await fetch(metricsUrl, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({
            projectId: this.config.projectId,
            metrics: batch
          })
        });
        
        if (!response.ok) {
          // Re-queue metrics on failure
          this.metricsQueue.unshift(...batch);
        }
      } catch (error) {
        console.warn('Failed to report metrics to Bridge:', error);
        // Re-queue metrics on error
        this.metricsQueue.unshift(...batch);
      }
    }, this.config.metricsInterval);
  }
  
  /**
   * Stop metrics reporting
   */
  private stopMetricsReporting(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
  }
  
  /**
   * Subscribe to metrics updates
   */
  onMetrics(callback: MetricsCallback): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }
  
  /**
   * Get current Bridge status
   */
  getStatus(): BridgeStatus {
    return { ...this.status };
  }
  
  /**
   * Check if Bridge is available
   */
  isAvailable(): boolean {
    return this.status.available;
  }
  
  /**
   * Update configuration
   */
  updateConfig(config: Partial<BridgeConfig>): void {
    Object.assign(this.config, config);
    
    // Restart health checks if Bridge URL changed
    if (config.bridgeUrl) {
      this.destroy();
      this.startHealthChecks();
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = undefined;
    }
    
    this.callbacks.clear();
    this.metricsQueue = [];
  }
}

// Singleton instance
let bridgeInstance: BridgeClientEnhanced | null = null;

/**
 * Get or create Bridge client instance
 */
export function getBridgeClient(config?: BridgeConfig): BridgeClientEnhanced {
  if (!bridgeInstance) {
    bridgeInstance = new BridgeClientEnhanced(config);
  } else if (config) {
    bridgeInstance.updateConfig(config);
  }
  return bridgeInstance;
}

/**
 * Destroy Bridge client instance
 */
export function destroyBridgeClient(): void {
  if (bridgeInstance) {
    bridgeInstance.destroy();
    bridgeInstance = null;
  }
}

export default BridgeClientEnhanced;