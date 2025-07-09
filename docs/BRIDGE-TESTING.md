# Bridge Integration Testing Guide

## Overview

This guide covers testing strategies for the Nexus Console Bridge integration, including unit tests, integration tests, and mock server setup.

## Testing Architecture

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│                 │       │                  │       │                 │
│  Test Suite     │──────▶│  Nexus Console   │──────▶│  Mock Bridge    │
│                 │       │  (Under Test)    │       │  Server         │
└─────────────────┘       └──────────────────┘       └─────────────────┘
```

## Unit Testing

### Testing BridgeClient

```typescript
import { BridgeClient } from '../src/bridge/BridgeClient';
import { jest } from '@jest/globals';

describe('BridgeClient', () => {
  let bridge: BridgeClient;
  let fetchMock: jest.SpyInstance;
  
  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
    bridge = new BridgeClient({
      bridgeUrl: 'http://localhost:3001/api/bridge',
      enableMetrics: true,
      enableDiscovery: true
    });
  });
  
  afterEach(() => {
    bridge.destroy();
    fetchMock.mockRestore();
  });
  
  describe('Health Checks', () => {
    test('should detect available Bridge', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          version: '1.0.0',
          features: ['metrics', 'discovery']
        })
      });
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(bridge.isAvailable()).toBe(true);
      expect(bridge.getStatus().version).toBe('1.0.0');
    });
    
    test('should handle unavailable Bridge', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(bridge.isAvailable()).toBe(false);
    });
  });
  
  describe('Endpoint Discovery', () => {
    test('should discover endpoints when Bridge available', async () => {
      // Mock health check
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' })
      });
      
      // Mock endpoint discovery
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            id: 'us-east-1',
            url: 'wss://terminal-us-east-1.example.com/ws',
            protocol: 'wss',
            region: 'us-east-1',
            health: 'healthy'
          }
        ]
      });
      
      const endpoints = await bridge.discoverEndpoints();
      
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe('us-east-1');
    });
    
    test('should fallback to default endpoint when Bridge unavailable', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      
      const endpoints = await bridge.discoverEndpoints();
      
      expect(endpoints).toHaveLength(1);
      expect(endpoints[0].id).toBe('default');
      expect(endpoints[0].url).toBe('/ws/terminal');
    });
  });
  
  describe('Metrics Reporting', () => {
    test('should queue metrics when Bridge available', async () => {
      // Mock available Bridge
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: '1.0.0' })
      });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const metrics = {
        sessionId: 'test-session',
        startTime: Date.now(),
        commandCount: 5,
        bytesTransferred: 1024,
        errors: 0,
        latency: {
          min: 10,
          max: 100,
          avg: 50,
          p95: 90,
          p99: 99
        }
      };
      
      await bridge.reportMetrics(metrics);
      
      // Verify metrics were queued (internal state)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/health'),
        expect.any(Object)
      );
    });
    
    test('should not report metrics when Bridge unavailable', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Connection refused'));
      
      const metrics = {
        sessionId: 'test-session',
        startTime: Date.now(),
        commandCount: 5,
        bytesTransferred: 1024,
        errors: 0,
        latency: { min: 10, max: 100, avg: 50, p95: 90, p99: 99 }
      };
      
      await bridge.reportMetrics(metrics);
      
      // Should not attempt to send metrics
      expect(fetchMock).toHaveBeenCalledTimes(1); // Only health check
    });
  });
});
```

### Testing MetricsCollector

```typescript
import { MetricsCollector } from '../src/bridge/MetricsCollector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;
  
  beforeEach(() => {
    collector = new MetricsCollector({
      sessionId: 'test-session',
      flushInterval: 100 // Fast flush for testing
    });
  });
  
  afterEach(() => {
    collector.destroy();
  });
  
  test('should track command metrics', () => {
    collector.recordCommand();
    collector.recordCommand();
    collector.recordLatency(50);
    collector.recordLatency(100);
    collector.recordBytes(1024);
    collector.recordError();
    
    const snapshot = collector.getSnapshot();
    
    expect(snapshot.commandCount).toBe(2);
    expect(snapshot.bytesTransferred).toBe(1024);
    expect(snapshot.errors).toBe(1);
    expect(snapshot.latency.avg).toBe(75);
  });
  
  test('should calculate latency percentiles', () => {
    // Add 100 latency samples
    for (let i = 1; i <= 100; i++) {
      collector.recordLatency(i);
    }
    
    const snapshot = collector.getSnapshot();
    
    expect(snapshot.latency.min).toBe(1);
    expect(snapshot.latency.max).toBe(100);
    expect(snapshot.latency.p95).toBe(95);
    expect(snapshot.latency.p99).toBe(99);
  });
  
  test('should trigger flush callbacks', (done) => {
    let flushCount = 0;
    
    collector.onFlush((metrics) => {
      flushCount++;
      expect(metrics.sessionId).toBe('test-session');
      
      if (flushCount === 2) {
        done();
      }
    });
    
    // Wait for auto-flush
    setTimeout(() => {
      collector.flush(); // Manual flush
    }, 150);
  });
});
```

### Testing NexusConsoleHybrid

```typescript
import { NexusConsoleHybrid } from '../src/core/NexusConsoleHybrid';
import { BridgeClient } from '../src/bridge/BridgeClient';

jest.mock('../src/bridge/BridgeClient');

describe('NexusConsoleHybrid', () => {
  let console: NexusConsoleHybrid;
  let mockBridge: jest.Mocked<BridgeClient>;
  
  beforeEach(() => {
    mockBridge = {
      isAvailable: jest.fn().mockReturnValue(true),
      discoverEndpoints: jest.fn().mockResolvedValue([
        { id: 'default', url: '/ws/terminal', protocol: 'ws' }
      ]),
      reportMetrics: jest.fn(),
      getStatus: jest.fn().mockReturnValue({ available: true })
    } as any;
    
    (BridgeClient as jest.Mock).mockReturnValue(mockBridge);
    
    console = new NexusConsoleHybrid({
      enableBridge: true,
      bridge: {
        bridgeUrl: 'http://localhost:3001/api/bridge'
      }
    });
  });
  
  afterEach(() => {
    console.destroy();
  });
  
  test('should use Bridge for endpoint discovery', async () => {
    await console.connect();
    
    expect(mockBridge.discoverEndpoints).toHaveBeenCalled();
  });
  
  test('should track command metrics', async () => {
    await console.createSession({ id: 'test-session' });
    await console.executeCommand('ls -la');
    
    // Wait for metrics flush
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(mockBridge.reportMetrics).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'test-session',
        commandCount: 1
      })
    );
  });
  
  test('should work without Bridge', async () => {
    mockBridge.isAvailable.mockReturnValue(false);
    
    await console.connect();
    await console.createSession();
    
    // Should not throw
    expect(console.getBridgeStatus().available).toBe(false);
  });
});
```

## Integration Testing

### Mock Bridge Server

Create a mock Bridge server for integration tests:

```typescript
// test/mock-bridge-server.ts
import express from 'express';
import { Server } from 'http';

export class MockBridgeServer {
  private app: express.Application;
  private server?: Server;
  private endpoints = [
    {
      id: 'mock-endpoint',
      url: 'ws://localhost:8001/ws/terminal',
      protocol: 'ws',
      health: 'healthy'
    }
  ];
  private metrics: any[] = [];
  
  constructor() {
    this.app = express();
    this.app.use(express.json());
    
    // Health endpoint
    this.app.get('/api/bridge/health', (req, res) => {
      res.json({
        version: '1.0.0-mock',
        features: ['metrics', 'discovery']
      });
    });
    
    // Endpoint discovery
    this.app.get('/api/bridge/terminal/endpoints', (req, res) => {
      res.json(this.endpoints);
    });
    
    // Metrics collection
    this.app.post('/api/bridge/terminal/metrics', (req, res) => {
      this.metrics.push(...req.body.metrics);
      res.status(200).json({ accepted: req.body.metrics.length });
    });
  }
  
  start(port = 3001): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(port, () => {
        console.log(`Mock Bridge server running on port ${port}`);
        resolve();
      });
    });
  }
  
  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
  
  getMetrics(): any[] {
    return this.metrics;
  }
  
  clearMetrics(): void {
    this.metrics = [];
  }
}
```

### Integration Test Suite

```typescript
// test/bridge-integration.test.ts
import { NexusConsoleHybrid } from '../src/core/NexusConsoleHybrid';
import { MockBridgeServer } from './mock-bridge-server';

describe('Bridge Integration', () => {
  let mockBridge: MockBridgeServer;
  let console: NexusConsoleHybrid;
  
  beforeAll(async () => {
    mockBridge = new MockBridgeServer();
    await mockBridge.start(3001);
  });
  
  afterAll(async () => {
    await mockBridge.stop();
  });
  
  beforeEach(() => {
    mockBridge.clearMetrics();
    console = new NexusConsoleHybrid({
      enableBridge: true,
      bridge: {
        bridgeUrl: 'http://localhost:3001/api/bridge',
        enableMetrics: true,
        enableDiscovery: true,
        metricsInterval: 1000 // Fast reporting for tests
      }
    });
  });
  
  afterEach(() => {
    console.destroy();
  });
  
  test('should discover endpoints from Bridge', async () => {
    // Wait for Bridge to be detected
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const status = console.getBridgeStatus();
    expect(status.available).toBe(true);
    
    await console.connect();
    // Verify endpoint was discovered (check internal state or logs)
  });
  
  test('should report session metrics to Bridge', async () => {
    // Wait for Bridge connection
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Create session and execute commands
    await console.createSession({ id: 'test-session' });
    await console.executeCommand('echo "test1"');
    await console.executeCommand('echo "test2"');
    console.write('test input');
    
    // Wait for metrics flush
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const metrics = mockBridge.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
    
    const sessionMetrics = metrics.find(m => m.sessionId === 'test-session');
    expect(sessionMetrics).toBeDefined();
    expect(sessionMetrics.commandCount).toBe(2);
    expect(sessionMetrics.bytesTransferred).toBeGreaterThan(0);
  });
  
  test('should handle Bridge outage gracefully', async () => {
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Stop Bridge server
    await mockBridge.stop();
    
    // Console should continue working
    await console.connect();
    await console.createSession();
    await console.executeCommand('echo "still works"');
    
    // Verify terminal still functional
    const status = console.getBridgeStatus();
    expect(status.available).toBe(false);
  });
});
```

## React Component Testing

```typescript
// test/nexus-console-react.test.tsx
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { NexusConsole } from '../src/react/NexusConsole';

describe('NexusConsole React Component', () => {
  test('should render with Bridge configuration', () => {
    const onBridgeStatus = jest.fn();
    
    render(
      <NexusConsole
        projectId="test-project"
        enableBridge={true}
        bridgeUrl="http://localhost:3001/api/bridge"
        onBridgeStatus={onBridgeStatus}
      />
    );
    
    expect(screen.getByTestId('nexus-console')).toBeInTheDocument();
  });
  
  test('should report Bridge status', async () => {
    const onBridgeStatus = jest.fn();
    
    render(
      <NexusConsole
        projectId="test-project"
        enableBridge={true}
        bridgeUrl="http://localhost:3001/api/bridge"
        onBridgeStatus={onBridgeStatus}
      />
    );
    
    await waitFor(() => {
      expect(onBridgeStatus).toHaveBeenCalledWith(
        expect.objectContaining({
          available: expect.any(Boolean)
        })
      );
    }, { timeout: 10000 });
  });
});
```

## E2E Testing

### Playwright Test

```typescript
// e2e/bridge-e2e.test.ts
import { test, expect } from '@playwright/test';
import { MockBridgeServer } from '../test/mock-bridge-server';

test.describe('Bridge E2E Tests', () => {
  let mockBridge: MockBridgeServer;
  
  test.beforeAll(async () => {
    mockBridge = new MockBridgeServer();
    await mockBridge.start(3001);
  });
  
  test.afterAll(async () => {
    await mockBridge.stop();
  });
  
  test('should connect to terminal with Bridge enabled', async ({ page }) => {
    await page.goto('http://localhost:3000/terminal');
    
    // Wait for terminal to initialize
    await page.waitForSelector('.nexus-console');
    
    // Type a command
    await page.keyboard.type('echo "Hello Bridge"');
    await page.keyboard.press('Enter');
    
    // Verify output
    await expect(page.locator('.nexus-console')).toContainText('Hello Bridge');
    
    // Check metrics were collected
    const metrics = mockBridge.getMetrics();
    expect(metrics.length).toBeGreaterThan(0);
  });
});
```

## Testing Best Practices

### 1. Test Isolation
- Each test should be independent
- Clean up resources after each test
- Use fresh instances for each test

### 2. Mock Strategies
- Mock external dependencies (fetch, WebSocket)
- Use mock Bridge server for integration tests
- Test both success and failure scenarios

### 3. Timing Considerations
- Bridge health checks occur periodically
- Metrics are batched and flushed on intervals
- Use appropriate timeouts in tests

### 4. Coverage Goals
- Unit tests: 90%+ coverage for Bridge components
- Integration tests: Key workflows
- E2E tests: Critical user paths

### 5. CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Test Bridge Integration

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit
    
    - name: Start mock Bridge server
      run: |
        npm run mock:bridge &
        sleep 5
    
    - name: Run integration tests
      run: npm run test:integration
    
    - name: Run E2E tests
      run: npm run test:e2e
```

## Debugging Tips

### 1. Enable Debug Logging
```typescript
const console = new NexusConsoleHybrid({
  debug: true,
  bridge: {
    debug: true
  }
});
```

### 2. Inspect Bridge Status
```typescript
// In tests or development
setInterval(() => {
  console.log('Bridge status:', console.getBridgeStatus());
}, 5000);
```

### 3. Monitor Network Traffic
Use browser DevTools or proxy tools to inspect:
- Bridge health check requests
- Endpoint discovery calls
- Metrics batch submissions

### 4. Test Failure Scenarios
- Simulate network failures
- Test with slow Bridge responses
- Verify queue behavior under load

## Summary

This testing guide provides comprehensive coverage for Bridge integration:

1. **Unit tests** for individual components
2. **Integration tests** with mock Bridge server
3. **React component tests** for UI integration
4. **E2E tests** for full workflow validation
5. **Best practices** for reliable testing

Follow these patterns to ensure robust Bridge integration that gracefully handles all scenarios.