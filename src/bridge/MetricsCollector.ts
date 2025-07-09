/**
 * Metrics Collector for terminal sessions
 * Collects performance and usage metrics for Bridge reporting
 */

import type { SessionMetrics } from './BridgeClient';

export interface MetricsSnapshot {
  timestamp: number;
  commandCount: number;
  bytesTransferred: number;
  errors: number;
  latencies: number[];
}

export interface CollectorConfig {
  sessionId: string;
  maxLatencySamples?: number;
  flushInterval?: number;
}

export class MetricsCollector {
  private config: Required<CollectorConfig>;
  private startTime: number;
  private commandCount: number = 0;
  private bytesTransferred: number = 0;
  private errors: number = 0;
  private latencies: number[] = [];
  private lastCommandTime: number = 0;
  private flushCallbacks: Set<(metrics: SessionMetrics) => void> = new Set();
  private flushTimer?: NodeJS.Timeout;
  
  constructor(config: CollectorConfig) {
    this.config = {
      sessionId: config.sessionId,
      maxLatencySamples: config.maxLatencySamples || 1000,
      flushInterval: config.flushInterval || 30000 // 30 seconds
    };
    
    this.startTime = Date.now();
    this.startAutoFlush();
  }
  
  /**
   * Record a command execution
   */
  recordCommand(): void {
    this.commandCount++;
    this.lastCommandTime = Date.now();
  }
  
  /**
   * Record command response latency
   */
  recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs);
    
    // Keep only recent samples to prevent memory growth
    if (this.latencies.length > this.config.maxLatencySamples) {
      this.latencies = this.latencies.slice(-this.config.maxLatencySamples);
    }
  }
  
  /**
   * Record bytes transferred (input or output)
   */
  recordBytes(bytes: number): void {
    this.bytesTransferred += bytes;
  }
  
  /**
   * Record an error occurrence
   */
  recordError(): void {
    this.errors++;
  }
  
  /**
   * Calculate latency statistics
   */
  private calculateLatencyStats(): SessionMetrics['latency'] {
    if (this.latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        avg: 0,
        p95: 0,
        p99: 0
      };
    }
    
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99)
    };
  }
  
  /**
   * Calculate percentile value
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
  }
  
  /**
   * Get current metrics snapshot
   */
  getSnapshot(): SessionMetrics {
    return {
      sessionId: this.config.sessionId,
      startTime: this.startTime,
      endTime: Date.now(),
      commandCount: this.commandCount,
      bytesTransferred: this.bytesTransferred,
      errors: this.errors,
      latency: this.calculateLatencyStats()
    };
  }
  
  /**
   * Start automatic metric flushing
   */
  private startAutoFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }
  
  /**
   * Flush current metrics to callbacks
   */
  flush(): void {
    const metrics = this.getSnapshot();
    this.flushCallbacks.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in metrics flush callback:', error);
      }
    });
  }
  
  /**
   * Subscribe to metrics flush events
   */
  onFlush(callback: (metrics: SessionMetrics) => void): () => void {
    this.flushCallbacks.add(callback);
    return () => this.flushCallbacks.delete(callback);
  }
  
  /**
   * Mark session as ended
   */
  endSession(): SessionMetrics {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    const finalMetrics = this.getSnapshot();
    finalMetrics.endTime = Date.now();
    
    // Final flush
    this.flushCallbacks.forEach(callback => {
      try {
        callback(finalMetrics);
      } catch (error) {
        console.error('Error in final metrics flush:', error);
      }
    });
    
    return finalMetrics;
  }
  
  /**
   * Reset metrics (useful for long-running sessions)
   */
  reset(): void {
    this.commandCount = 0;
    this.bytesTransferred = 0;
    this.errors = 0;
    this.latencies = [];
    this.startTime = Date.now();
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    this.flushCallbacks.clear();
  }
}

export default MetricsCollector;