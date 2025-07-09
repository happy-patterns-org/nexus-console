# Nexus Console Hybrid Architecture

## Overview

The Nexus Console implements a hybrid architecture that maintains direct WebSocket connections for PTY communication while optionally integrating with the Bridge server for enhanced telemetry and metrics capabilities.

## Architecture Design

```
┌─────────────────┐       ┌──────────────────┐       ┌─────────────────┐
│                 │       │                  │       │                 │
│  Happy          │       │  Nexus Console   │       │  Terminal       │
│  Observatory    │──────▶│  (React/Core)    │──────▶│  Server         │
│                 │       │                  │  PTY  │  (FastAPI)      │
└─────────────────┘       └──────────────────┘       └─────────────────┘
                                  │                            
                                  │ Metrics/Telemetry         
                                  │ (Optional)                
                                  ▼                            
                          ┌──────────────────┐                
                          │                  │                
                          │  Bridge Server   │                
                          │  (Telemetry)     │                
                          │                  │                
                          └──────────────────┘                
```

## Key Principles

### 1. **Direct PTY Communication**
- Terminal maintains direct WebSocket connection to PTY server
- No routing through Bridge for terminal I/O
- Ensures minimal latency for keyboard input and screen updates
- Preserves existing high-performance architecture

### 2. **Optional Bridge Integration**
- Bridge provides enhanced features when available
- Graceful fallback when Bridge is unavailable
- No hard dependency on Bridge server
- Features include:
  - Session metrics collection
  - Terminal endpoint discovery
  - Unified telemetry reporting
  - Future: Authentication coordination

### 3. **Separation of Concerns**
- **PTY Stream**: Real-time, bidirectional, performance-critical
- **Telemetry**: Periodic, unidirectional, non-critical
- Different protocols for different purposes
- Clean architectural boundaries

## Implementation Details

### Bridge Client

The `BridgeClient` class provides:

```typescript
// Optional Bridge configuration
const bridgeConfig = {
  bridgeUrl: 'http://localhost:3001/api/bridge',
  apiKey: 'optional-api-key',
  projectId: 'my-project',
  enableMetrics: true,
  enableDiscovery: true
};

// Bridge automatically detects availability
const bridge = getBridgeClient(bridgeConfig);
```

Features:
- Automatic health checks (every 60 seconds)
- Graceful degradation when unavailable
- In-memory metrics queuing
- Batch metrics reporting

### Metrics Collection

The `MetricsCollector` tracks:

```typescript
interface SessionMetrics {
  sessionId: string;
  startTime: number;
  endTime?: number;
  commandCount: number;
  bytesTransferred: number;
  errors: number;
  latency: {
    min: number;
    max: number;
    avg: number;
    p95: number;
    p99: number;
  };
}
```

Metrics are:
- Collected in real-time
- Reported periodically (default: 30 seconds)
- Queued when Bridge is unavailable
- Automatically cleaned up on session end

### Hybrid Console

The `NexusConsoleHybrid` extends the base console:

```typescript
const console = new NexusConsoleHybrid({
  // Standard console config
  serverUrl: 'ws://localhost:8000',
  
  // Optional Bridge config
  enableBridge: true,
  bridge: {
    bridgeUrl: 'http://localhost:3001/api/bridge',
    enableMetrics: true,
    enableDiscovery: true
  }
});
```

## React Component Integration

The React component supports Bridge configuration:

```tsx
<NexusConsoleComponent
  projectId="my-project"
  authToken={token}
  
  // Bridge configuration
  enableBridge={true}
  bridgeUrl="http://localhost:3001/api/bridge"
  enableMetrics={true}
  enableDiscovery={true}
  
  // Bridge status callback
  onBridgeStatus={(status) => {
    console.log('Bridge available:', status.available);
    console.log('Features:', status.features);
  }}
/>
```

## Benefits

### Performance
- Zero latency impact on terminal I/O
- Metrics collected asynchronously
- No blocking operations

### Reliability
- Terminal works without Bridge
- Automatic reconnection handling
- Graceful degradation

### Flexibility
- Optional enhancement model
- Easy to enable/disable features
- Future-proof architecture

### Observability
- Rich session metrics
- Performance insights
- Usage patterns

## Configuration Examples

### Standalone Mode (No Bridge)
```typescript
const console = new NexusConsoleHybrid({
  serverUrl: 'ws://localhost:8000',
  enableBridge: false
});
```

### Full Integration Mode
```typescript
const console = new NexusConsoleHybrid({
  serverUrl: 'ws://localhost:8000',
  enableBridge: true,
  bridge: {
    bridgeUrl: process.env.BRIDGE_URL,
    apiKey: process.env.BRIDGE_API_KEY,
    projectId: 'production-app',
    enableMetrics: true,
    enableDiscovery: true,
    metricsInterval: 60000 // 1 minute
  }
});
```

### Development Mode
```typescript
const console = new NexusConsoleHybrid({
  serverUrl: 'ws://localhost:8000',
  enableBridge: true,
  bridge: {
    // Auto-detects local Bridge
    enableMetrics: true,
    enableDiscovery: false // Use direct connection
  }
});
```

## Future Enhancements

The hybrid architecture enables future features:

1. **Unified Authentication**
   - Bridge coordinates auth tokens
   - Single sign-on support
   - Token refresh handling

2. **Advanced Telemetry**
   - Command pattern analysis
   - Performance profiling
   - Usage analytics

3. **Multi-Region Support**
   - Bridge discovers nearest endpoints
   - Automatic failover
   - Load balancing

4. **Session Recording**
   - Optional session replay
   - Audit trails
   - Debugging support

## Migration Guide

For existing implementations:

1. **No changes required** - Existing code continues to work
2. **Opt-in to Bridge** - Add Bridge config when ready
3. **Monitor metrics** - Use Bridge status callbacks
4. **Gradual adoption** - Enable features incrementally

The hybrid architecture ensures Nexus Console remains fast, reliable, and extensible while providing a path for enhanced observability and future features.