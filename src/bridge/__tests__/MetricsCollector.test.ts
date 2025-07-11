/**
 * Tests for MetricsCollector
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetricsCollector } from '../MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector({
      sessionId: 'test-session',
      flushInterval: 1000 // 1 second for faster tests
    });
  });

  afterEach(() => {
    collector.destroy();
  });

  describe('command tracking', () => {
    it('should track command count', () => {
      collector.recordCommand();
      collector.recordCommand();
      collector.recordCommand();

      const metrics = collector.getSnapshot();
      expect(metrics.commandCount).toBe(3);
    });
  });

  describe('latency tracking', () => {
    it('should calculate latency statistics', () => {
      collector.recordLatency(10);
      collector.recordLatency(20);
      collector.recordLatency(30);
      collector.recordLatency(40);
      collector.recordLatency(50);

      const metrics = collector.getSnapshot();
      expect(metrics.latency.min).toBe(10);
      expect(metrics.latency.max).toBe(50);
      expect(metrics.latency.avg).toBe(30);
    });

    it('should handle percentiles correctly', () => {
      // Add 100 samples
      for (let i = 1; i <= 100; i++) {
        collector.recordLatency(i);
      }

      const metrics = collector.getSnapshot();
      expect(metrics.latency.p95).toBe(95);
      expect(metrics.latency.p99).toBe(99);
    });

    it('should limit latency samples', () => {
      const collector = new MetricsCollector({
        sessionId: 'test',
        maxLatencySamples: 10
      });

      // Add 20 samples
      for (let i = 1; i <= 20; i++) {
        collector.recordLatency(i);
      }

      const metrics = collector.getSnapshot();
      // Should only keep last 10
      expect(metrics.latency.min).toBe(11);
      expect(metrics.latency.max).toBe(20);
    });
  });

  describe('bytes tracking', () => {
    it('should accumulate bytes transferred', () => {
      collector.recordBytes(100);
      collector.recordBytes(200);
      collector.recordBytes(300);

      const metrics = collector.getSnapshot();
      expect(metrics.bytesTransferred).toBe(600);
    });
  });

  describe('error tracking', () => {
    it('should count errors', () => {
      collector.recordError();
      collector.recordError();

      const metrics = collector.getSnapshot();
      expect(metrics.errors).toBe(2);
    });
  });

  describe('auto flush', () => {
    it('should auto flush metrics at interval', async () => {
      const callback = vi.fn();
      collector.onFlush(callback);

      collector.recordCommand();
      collector.recordBytes(100);

      // Wait for auto flush
      await new Promise(resolve => setTimeout(resolve, 1100));

      expect(callback).toHaveBeenCalled();
      const metrics = callback.mock.calls[0][0];
      expect(metrics.commandCount).toBe(1);
      expect(metrics.bytesTransferred).toBe(100);
    });
  });

  describe('manual flush', () => {
    it('should flush metrics on demand', () => {
      const callback = vi.fn();
      collector.onFlush(callback);

      collector.recordCommand();
      collector.flush();

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('session end', () => {
    it('should provide final metrics on session end', async () => {
      collector.recordCommand();
      collector.recordBytes(500);
      collector.recordLatency(25);

      // Small delay to ensure endTime is different
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const finalMetrics = collector.endSession();
      
      expect(finalMetrics.sessionId).toBe('test-session');
      expect(finalMetrics.commandCount).toBe(1);
      expect(finalMetrics.bytesTransferred).toBe(500);
      expect(finalMetrics.endTime).toBeDefined();
      expect(finalMetrics.endTime).toBeGreaterThanOrEqual(finalMetrics.startTime);
    });

    it('should call flush callbacks on session end', () => {
      const callback = vi.fn();
      collector.onFlush(callback);

      collector.recordCommand();
      collector.endSession();

      expect(callback).toHaveBeenCalledTimes(1);
      const metrics = callback.mock.calls[0][0];
      expect(metrics.endTime).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      collector.recordCommand();
      collector.recordBytes(100);
      collector.recordError();
      collector.recordLatency(50);

      collector.reset();

      const metrics = collector.getSnapshot();
      expect(metrics.commandCount).toBe(0);
      expect(metrics.bytesTransferred).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.latency.min).toBe(0);
    });
  });

  describe('callbacks', () => {
    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      collector.onFlush(callback1);
      collector.onFlush(callback2);

      collector.flush();

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should handle callback errors gracefully', () => {
      const errorCallback = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      collector.onFlush(errorCallback);
      collector.onFlush(normalCallback);

      // Should not throw
      expect(() => collector.flush()).not.toThrow();
      
      // Normal callback should still be called
      expect(normalCallback).toHaveBeenCalledTimes(1);
    });

    it('should support unsubscribe', () => {
      const callback = vi.fn();
      const unsubscribe = collector.onFlush(callback);

      collector.flush();
      expect(callback).toHaveBeenCalledTimes(1);

      unsubscribe();
      collector.flush();
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });
  });
});