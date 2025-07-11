/**
 * Tests for BridgeClient
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getBridgeClient, destroyBridgeClient } from '../BridgeClient';
import type { BridgeConfig } from '../BridgeClient';

// Mock fetch
global.fetch = vi.fn();

describe('BridgeClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    destroyBridgeClient();
    
    // Mock fetch to return bridge unavailable by default
    (global.fetch as any).mockRejectedValue(new Error('Network error'));
  });

  afterEach(() => {
    destroyBridgeClient();
  });

  describe('initialization', () => {
    it('should create singleton instance', () => {
      const client1 = getBridgeClient();
      const client2 = getBridgeClient();
      expect(client1).toBe(client2);
    });

    it('should detect bridge URL from environment', () => {
      const client = getBridgeClient();
      expect(client).toBeDefined();
    });

    it('should use custom config when provided', () => {
      const config: BridgeConfig = {
        bridgeUrl: 'http://custom-bridge:3001',
        apiKey: 'test-key',
        projectId: 'test-project'
      };
      const client = getBridgeClient(config);
      expect(client).toBeDefined();
    });
  });

  describe('health checks', () => {
    it('should mark bridge as available when health check succeeds', async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ version: '1.0.0', features: ['metrics', 'discovery'] })
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const client = getBridgeClient();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(client.isAvailable()).toBe(true);
      expect(client.getStatus().version).toBe('1.0.0');
    });

    it('should mark bridge as unavailable when health check fails', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const client = getBridgeClient();
      
      // Wait for initial health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(client.isAvailable()).toBe(false);
    });
  });

  describe('endpoint discovery', () => {
    it('should return discovered endpoints when bridge is available', async () => {
      // Mock health check success
      const healthResponse = {
        ok: true,
        json: async () => ({ version: '1.0.0' })
      };
      (global.fetch as any).mockResolvedValueOnce(healthResponse);

      const client = getBridgeClient();
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock endpoint discovery
      const endpoints = [
        { id: 'us-east', url: 'wss://us-east.terminal.com', protocol: 'wss' },
        { id: 'eu-west', url: 'wss://eu-west.terminal.com', protocol: 'wss' }
      ];
      const endpointResponse = {
        ok: true,
        json: async () => endpoints
      };
      (global.fetch as any).mockResolvedValueOnce(endpointResponse);

      const discovered = await client.discoverEndpoints();
      expect(discovered).toEqual(endpoints);
    });

    it('should return default endpoint when bridge is unavailable', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

      const client = getBridgeClient();
      await new Promise(resolve => setTimeout(resolve, 100));

      const endpoints = await client.discoverEndpoints();
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe('default');
    });
  });

  describe('metrics reporting', () => {
    it('should queue metrics when bridge is available', async () => {
      // Mock health check success
      const healthResponse = {
        ok: true,
        json: async () => ({ version: '1.0.0' })
      };
      (global.fetch as any).mockResolvedValueOnce(healthResponse);

      const client = getBridgeClient({ enableMetrics: true });
      await new Promise(resolve => setTimeout(resolve, 100));

      const metrics = {
        sessionId: 'test-session',
        startTime: Date.now(),
        commandCount: 10,
        bytesTransferred: 1024,
        errors: 0,
        latency: { min: 1, max: 10, avg: 5, p95: 8, p99: 9 }
      };

      await client.reportMetrics(metrics);
      
      // Metrics should be queued, not sent immediately
      expect(fetch).toHaveBeenCalledTimes(1); // Only health check
    });

    it('should not report metrics when disabled', async () => {
      // Clear fetch mock count
      vi.clearAllMocks();
      
      const client = getBridgeClient({ 
        enableMetrics: false,
        metricsInterval: 1000000 // Very long interval to prevent auto-flush
      });
      
      const metrics = {
        sessionId: 'test-session',
        startTime: Date.now(),
        commandCount: 10,
        bytesTransferred: 1024,
        errors: 0,
        latency: { min: 1, max: 10, avg: 5, p95: 8, p99: 9 }
      };

      await client.reportMetrics(metrics);
      
      // Wait a bit to ensure no async operations
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Should only have the initial health check failure
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });
  });

  describe('callbacks', () => {
    it('should notify metrics callbacks', async () => {
      // Mock bridge as available for this test
      const mockResponse = {
        ok: true,
        json: async () => ({ version: '1.0.0', features: ['metrics'] })
      };
      (global.fetch as any).mockResolvedValueOnce(mockResponse);
      
      const callback = vi.fn();
      const client = getBridgeClient({ enableMetrics: true });
      
      // Wait for health check to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const unsubscribe = client.onMetrics(callback);

      const metrics = {
        sessionId: 'test-session',
        startTime: Date.now(),
        commandCount: 10,
        bytesTransferred: 1024,
        errors: 0,
        latency: { min: 1, max: 10, avg: 5, p95: 8, p99: 9 }
      };

      await client.reportMetrics(metrics);
      
      expect(callback).toHaveBeenCalledWith(metrics);
      
      // Test unsubscribe
      unsubscribe();
      await client.reportMetrics(metrics);
      expect(callback).toHaveBeenCalledTimes(1); // Not called again
    });
  });

  describe('cleanup', () => {
    it('should clean up resources on destroy', () => {
      const client = getBridgeClient();
      destroyBridgeClient();
      
      // Should create new instance after destroy
      const newClient = getBridgeClient();
      expect(newClient).not.toBe(client);
    });
  });
});