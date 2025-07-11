/**
 * Performance monitoring for Nexus Console
 * Tracks rendering performance, WebSocket latency, and resource usage
 */

import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  // Rendering performance
  fps: number;
  frameTime: number;
  droppedFrames: number;
  
  // Terminal performance
  renderTime: number;
  scrollPerformance: number;
  bufferSize: number;
  
  // WebSocket performance
  wsLatency: number;
  wsReconnections: number;
  messageQueueSize: number;
  
  // Resource usage
  memoryUsage: number;
  domNodes: number;
  eventListeners: number;
  
  // User interaction
  inputLatency: number;
  commandExecutionTime: number;
  responseTime: number;
}

export interface PerformanceBudget {
  maxFrameTime: number;        // ms (16.67ms for 60fps)
  maxRenderTime: number;       // ms
  maxInputLatency: number;     // ms
  maxMemoryUsage: number;      // MB
  maxWsLatency: number;        // ms
  maxBufferSize: number;       // lines
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics;
  private budget: PerformanceBudget;
  private observer: PerformanceObserver | null = null;
  private rafId: number | null = null;
  private lastFrameTime: number = 0;
  private frameCount: number = 0;
  private droppedFrames: number = 0;

  constructor() {
    super();
    
    this.metrics = this.initializeMetrics();
    this.budget = this.getDefaultBudget();
    
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      this.setupPerformanceObserver();
    }
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      fps: 0,
      frameTime: 0,
      droppedFrames: 0,
      renderTime: 0,
      scrollPerformance: 0,
      bufferSize: 0,
      wsLatency: 0,
      wsReconnections: 0,
      messageQueueSize: 0,
      memoryUsage: 0,
      domNodes: 0,
      eventListeners: 0,
      inputLatency: 0,
      commandExecutionTime: 0,
      responseTime: 0
    };
  }

  private getDefaultBudget(): PerformanceBudget {
    return {
      maxFrameTime: 16.67,      // 60fps
      maxRenderTime: 10,        // 10ms render budget
      maxInputLatency: 50,      // 50ms input response
      maxMemoryUsage: 100,      // 100MB memory limit
      maxWsLatency: 100,        // 100ms WebSocket latency
      maxBufferSize: 10000      // 10k lines buffer
    };
  }

  private setupPerformanceObserver(): void {
    try {
      this.observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.processPerformanceEntry(entry);
        }
      });

      // Observe different entry types
      this.observer.observe({ 
        entryTypes: ['measure', 'navigation', 'resource', 'paint', 'largest-contentful-paint'] 
      });
    } catch (error) {
      console.warn('PerformanceObserver not supported:', error);
    }
  }

  private processPerformanceEntry(entry: PerformanceEntry): void {
    switch (entry.entryType) {
      case 'measure':
        if (entry.name.startsWith('terminal-render')) {
          this.metrics.renderTime = entry.duration;
          this.checkBudget('renderTime', entry.duration, this.budget.maxRenderTime);
        }
        break;
      
      case 'paint':
        if (entry.name === 'first-contentful-paint') {
          this.emit('performance:paint', { fcp: entry.startTime });
        }
        break;
    }
  }

  public startFrameTracking(): void {
    let frameStartTime = 0;
    let frameTimes: number[] = [];
    
    const measureFrame = (timestamp: number) => {
      if (this.lastFrameTime > 0) {
        const frameTime = timestamp - this.lastFrameTime;
        frameTimes.push(frameTime);
        
        // Track frame drops (frames taking longer than 16.67ms)
        if (frameTime > 16.67) {
          this.droppedFrames++;
        }
        
        // Update FPS every 60 frames
        if (frameTimes.length >= 60) {
          const avgFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
          this.metrics.fps = Math.round(1000 / avgFrameTime);
          this.metrics.frameTime = avgFrameTime;
          this.metrics.droppedFrames = this.droppedFrames;
          
          this.emit('metrics:update', { fps: this.metrics.fps });
          
          // Reset for next measurement
          frameTimes = [];
          this.droppedFrames = 0;
        }
      }
      
      this.lastFrameTime = timestamp;
      this.rafId = requestAnimationFrame(measureFrame);
    };
    
    this.rafId = requestAnimationFrame(measureFrame);
  }

  public stopFrameTracking(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public measureRender(name: string, fn: () => void): void {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    performance.mark(startMark);
    fn();
    performance.mark(endMark);
    
    performance.measure(name, startMark, endMark);
  }

  public async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<T> {
    const startMark = `${name}-start`;
    const endMark = `${name}-end`;
    
    performance.mark(startMark);
    try {
      const result = await fn();
      performance.mark(endMark);
      performance.measure(name, startMark, endMark);
      return result;
    } catch (error) {
      performance.mark(endMark);
      performance.measure(name, startMark, endMark);
      throw error;
    }
  }

  public updateMemoryMetrics(): void {
    if ('memory' in performance && (performance as any).memory) {
      const memory = (performance as any).memory;
      this.metrics.memoryUsage = Math.round(memory.usedJSHeapSize / 1048576); // Convert to MB
      
      this.checkBudget('memoryUsage', this.metrics.memoryUsage, this.budget.maxMemoryUsage);
    }
    
    // Count DOM nodes
    this.metrics.domNodes = document.getElementsByTagName('*').length;
  }

  public updateWebSocketMetrics(latency: number, reconnections: number): void {
    this.metrics.wsLatency = latency;
    this.metrics.wsReconnections = reconnections;
    
    this.checkBudget('wsLatency', latency, this.budget.maxWsLatency);
  }

  public updateTerminalMetrics(bufferSize: number, scrollPerformance: number): void {
    this.metrics.bufferSize = bufferSize;
    this.metrics.scrollPerformance = scrollPerformance;
    
    this.checkBudget('bufferSize', bufferSize, this.budget.maxBufferSize);
  }

  public updateInputMetrics(inputLatency: number, commandTime: number): void {
    this.metrics.inputLatency = inputLatency;
    this.metrics.commandExecutionTime = commandTime;
    
    this.checkBudget('inputLatency', inputLatency, this.budget.maxInputLatency);
  }

  private checkBudget(metric: string, value: number, budget: number): void {
    if (value > budget) {
      this.emit('budget:exceeded', {
        metric,
        value,
        budget,
        severity: this.calculateSeverity(value, budget)
      });
    }
  }

  private calculateSeverity(value: number, budget: number): 'low' | 'medium' | 'high' {
    const ratio = value / budget;
    if (ratio >= 2) return 'high';
    if (ratio >= 1.5) return 'medium';
    return 'low';
  }

  public setBudget(budget: Partial<PerformanceBudget>): void {
    this.budget = { ...this.budget, ...budget };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getBudget(): PerformanceBudget {
    return { ...this.budget };
  }

  public generateReport(): string {
    const report = {
      timestamp: new Date().toISOString(),
      metrics: this.metrics,
      budget: this.budget,
      violations: this.checkAllBudgets()
    };
    
    return JSON.stringify(report, null, 2);
  }

  private checkAllBudgets(): Array<{ metric: string; value: number; budget: number }> {
    const violations = [];
    
    if (this.metrics.frameTime > this.budget.maxFrameTime) {
      violations.push({
        metric: 'frameTime',
        value: this.metrics.frameTime,
        budget: this.budget.maxFrameTime
      });
    }
    
    if (this.metrics.renderTime > this.budget.maxRenderTime) {
      violations.push({
        metric: 'renderTime',
        value: this.metrics.renderTime,
        budget: this.budget.maxRenderTime
      });
    }
    
    if (this.metrics.inputLatency > this.budget.maxInputLatency) {
      violations.push({
        metric: 'inputLatency',
        value: this.metrics.inputLatency,
        budget: this.budget.maxInputLatency
      });
    }
    
    if (this.metrics.memoryUsage > this.budget.maxMemoryUsage) {
      violations.push({
        metric: 'memoryUsage',
        value: this.metrics.memoryUsage,
        budget: this.budget.maxMemoryUsage
      });
    }
    
    if (this.metrics.wsLatency > this.budget.maxWsLatency) {
      violations.push({
        metric: 'wsLatency',
        value: this.metrics.wsLatency,
        budget: this.budget.maxWsLatency
      });
    }
    
    if (this.metrics.bufferSize > this.budget.maxBufferSize) {
      violations.push({
        metric: 'bufferSize',
        value: this.metrics.bufferSize,
        budget: this.budget.maxBufferSize
      });
    }
    
    return violations;
  }

  public destroy(): void {
    this.stopFrameTracking();
    
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    this.removeAllListeners();
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();