/**
 * Tests for PerformanceMonitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PerformanceMonitor } from '../../performance/PerformanceMonitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    
    // Mock performance API
    global.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      getEntries: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      getEntriesByName: vi.fn(() => []),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      memory: {
        usedJSHeapSize: 50 * 1024 * 1024, // 50MB
        totalJSHeapSize: 100 * 1024 * 1024,
        jsHeapSizeLimit: 2048 * 1024 * 1024
      }
    } as any;

    // Mock PerformanceObserver
    const mockPerformanceObserver = vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));
    (mockPerformanceObserver as any).supportedEntryTypes = ['measure', 'navigation', 'resource', 'paint'];
    global.PerformanceObserver = mockPerformanceObserver as any;

    // Mock requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      setTimeout(() => cb(Date.now()), 16);
      return 1;
    });
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    monitor.destroy();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default metrics', () => {
      const metrics = monitor.getMetrics();
      
      expect(metrics.fps).toBe(0);
      expect(metrics.frameTime).toBe(0);
      expect(metrics.renderTime).toBe(0);
      expect(metrics.memoryUsage).toBe(0);
    });

    it('should initialize with default budget', () => {
      const budget = monitor.getBudget();
      
      expect(budget.maxFrameTime).toBe(16.67);
      expect(budget.maxRenderTime).toBe(10);
      expect(budget.maxInputLatency).toBe(50);
      expect(budget.maxMemoryUsage).toBe(100);
    });
  });

  describe('frame tracking', () => {
    it('should start and stop frame tracking', () => {
      monitor.startFrameTracking();
      expect(global.requestAnimationFrame).toHaveBeenCalled();
      
      monitor.stopFrameTracking();
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
    });

    it('should calculate FPS', () => {
      let rafCallback: (time: number) => void;
      
      global.requestAnimationFrame = vi.fn((cb) => {
        rafCallback = cb;
        return 1;
      });

      monitor.startFrameTracking();
      
      // Simulate 61 frames at ~60fps (need 60 frame times, so 61 timestamps)
      for (let i = 0; i <= 61; i++) {
        rafCallback!(i * 16.67);
      }

      // FPS should be calculated after 60 frames
      const metrics = monitor.getMetrics();
      expect(metrics.fps).toBe(60); // 1000 / 16.67 ≈ 60
      expect(metrics.frameTime).toBeCloseTo(16.67, 1);
    });
  });

  describe('performance measurement', () => {
    it('should measure synchronous operations', () => {
      const fn = vi.fn(() => 'result');
      
      monitor.measureRender('test-operation', fn);
      
      expect(fn).toHaveBeenCalled();
      expect(global.performance.mark).toHaveBeenCalledWith('test-operation-start');
      expect(global.performance.mark).toHaveBeenCalledWith('test-operation-end');
      expect(global.performance.measure).toHaveBeenCalledWith(
        'test-operation',
        'test-operation-start',
        'test-operation-end'
      );
    });

    it('should measure async operations', async () => {
      const fn = vi.fn(async () => 'result');
      
      const result = await monitor.measureAsync('async-operation', fn);
      
      expect(result).toBe('result');
      expect(fn).toHaveBeenCalled();
      expect(global.performance.mark).toHaveBeenCalledWith('async-operation-start');
      expect(global.performance.mark).toHaveBeenCalledWith('async-operation-end');
    });

    it('should handle async operation errors', async () => {
      const error = new Error('Test error');
      const fn = vi.fn(async () => { throw error; });
      
      await expect(monitor.measureAsync('failing-operation', fn)).rejects.toThrow(error);
      
      // Should still mark end even on error
      expect(global.performance.mark).toHaveBeenCalledWith('failing-operation-end');
    });
  });

  describe('memory metrics', () => {
    it('should update memory metrics', () => {
      monitor.updateMemoryMetrics();
      
      const metrics = monitor.getMetrics();
      expect(metrics.memoryUsage).toBe(50); // 50MB from mock
    });

    it('should count DOM nodes', () => {
      // Mock DOM
      const mockElements = new Array(100).fill(null);
      document.getElementsByTagName = vi.fn().mockReturnValue(mockElements);
      
      monitor.updateMemoryMetrics();
      
      const metrics = monitor.getMetrics();
      expect(metrics.domNodes).toBe(100);
    });
  });

  describe('WebSocket metrics', () => {
    it('should update WebSocket metrics', () => {
      monitor.updateWebSocketMetrics(75, 3);
      
      const metrics = monitor.getMetrics();
      expect(metrics.wsLatency).toBe(75);
      expect(metrics.wsReconnections).toBe(3);
    });
  });

  describe('terminal metrics', () => {
    it('should update terminal metrics', () => {
      monitor.updateTerminalMetrics(5000, 25);
      
      const metrics = monitor.getMetrics();
      expect(metrics.bufferSize).toBe(5000);
      expect(metrics.scrollPerformance).toBe(25);
    });
  });

  describe('input metrics', () => {
    it('should update input metrics', () => {
      monitor.updateInputMetrics(45, 120);
      
      const metrics = monitor.getMetrics();
      expect(metrics.inputLatency).toBe(45);
      expect(metrics.commandExecutionTime).toBe(120);
    });
  });

  describe('budget checking', () => {
    it('should emit event when budget is exceeded', () => {
      const budgetListener = vi.fn();
      monitor.on('budget:exceeded', budgetListener);
      
      // Exceed input latency budget (50ms)
      monitor.updateInputMetrics(75, 100);
      
      expect(budgetListener).toHaveBeenCalledWith({
        metric: 'inputLatency',
        value: 75,
        budget: 50,
        severity: 'medium'
      });
    });

    it('should calculate severity correctly', () => {
      const budgetListener = vi.fn();
      monitor.on('budget:exceeded', budgetListener);
      
      // Low severity (just over budget)
      monitor.updateInputMetrics(55, 100);
      expect(budgetListener).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'low' })
      );
      
      // Medium severity (1.5x budget)
      monitor.updateInputMetrics(80, 100);
      expect(budgetListener).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'medium' })
      );
      
      // High severity (2x budget)
      monitor.updateInputMetrics(120, 100);
      expect(budgetListener).toHaveBeenLastCalledWith(
        expect.objectContaining({ severity: 'high' })
      );
    });
  });

  describe('custom budgets', () => {
    it('should allow setting custom budgets', () => {
      monitor.setBudget({
        maxInputLatency: 100,
        maxMemoryUsage: 200
      });
      
      const budget = monitor.getBudget();
      expect(budget.maxInputLatency).toBe(100);
      expect(budget.maxMemoryUsage).toBe(200);
      // Other budgets should remain default
      expect(budget.maxFrameTime).toBe(16.67);
    });
  });

  describe('report generation', () => {
    it('should generate a performance report', () => {
      monitor.updateInputMetrics(45, 120);
      monitor.updateMemoryMetrics();
      
      const report = monitor.generateReport();
      const parsed = JSON.parse(report);
      
      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('budget');
      expect(parsed).toHaveProperty('violations');
      expect(parsed.metrics.inputLatency).toBe(45);
    });

    it('should include violations in report', () => {
      // Create violations
      monitor.updateInputMetrics(100, 120); // Exceeds 50ms budget
      monitor.updateWebSocketMetrics(200, 5); // Exceeds 100ms budget
      
      const report = monitor.generateReport();
      const parsed = JSON.parse(report);
      
      expect(parsed.violations).toHaveLength(2);
      expect(parsed.violations).toContainEqual({
        metric: 'inputLatency',
        value: 100,
        budget: 50
      });
      expect(parsed.violations).toContainEqual({
        metric: 'wsLatency',
        value: 200,
        budget: 100
      });
    });
  });

  describe('PerformanceObserver integration', () => {
    it('should process performance entries', () => {
      // Set up window mock
      (global as any).window = {
        PerformanceObserver: true
      };
      
      let observerCallback: (list: any) => void;
      
      const mockPO = vi.fn().mockImplementation((cb) => {
        observerCallback = cb;
        return {
          observe: vi.fn(),
          disconnect: vi.fn()
        };
      });
      (mockPO as any).supportedEntryTypes = ['measure', 'navigation', 'resource', 'paint'];
      global.PerformanceObserver = mockPO as any;

      const monitor = new PerformanceMonitor();
      
      // Wait for the observer to be created
      expect(mockPO).toHaveBeenCalled();
      expect(observerCallback!).toBeDefined();
      
      // Simulate performance entry
      observerCallback!({
        getEntries: () => [{
          entryType: 'measure',
          name: 'terminal-render',
          duration: 12.5
        }]
      });

      const metrics = monitor.getMetrics();
      expect(metrics.renderTime).toBe(12.5);
      
      // Clean up
      delete (global as any).window;
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      const listener = vi.fn();
      monitor.on('test', listener);
      
      monitor.startFrameTracking();
      monitor.destroy();
      
      expect(global.cancelAnimationFrame).toHaveBeenCalled();
      
      // Should remove all listeners
      monitor.emit('test');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});