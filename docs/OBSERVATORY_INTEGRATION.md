# Happy Observatory Integration Guide

This guide explains how Nexus Console integrates with Happy Observatory for monitoring, metrics, and observability.

## Overview

Nexus Console automatically reports metrics and events to Happy Observatory, providing:

- Terminal usage analytics
- Performance metrics
- Error tracking
- Security event monitoring
- User behavior insights

## Automatic Metrics

Nexus Console automatically collects and reports these metrics:

### Performance Metrics

```typescript
interface TerminalPerformanceMetrics {
  // Rendering performance
  renderTime: number;          // Average frame render time (ms)
  fps: number;                 // Frames per second
  frameDrops: number;          // Dropped frames count
  
  // Resource usage
  memoryUsage: number;         // Memory used (MB)
  bufferSize: number;          // Terminal buffer size (lines)
  
  // Responsiveness
  inputLatency: number;        // Input to display latency (ms)
  commandLatency: number;      // Command execution time (ms)
  
  // Network
  wsLatency: number;           // WebSocket round-trip time (ms)
  reconnections: number;       // WebSocket reconnection count
}
```

### Usage Metrics

```typescript
interface TerminalUsageMetrics {
  // Session data
  sessionDuration: number;     // Session length (seconds)
  commandCount: number;        // Commands executed
  outputVolume: number;        // Output data (bytes)
  
  // User activity
  activeTime: number;          // Time with user input (seconds)
  idleTime: number;           // Time without input (seconds)
  
  // Features used
  featuresUsed: string[];      // ['copy-paste', 'search', 'split-pane']
  shellType: string;           // 'bash', 'zsh', 'powershell'
}
```

## Manual Integration

### 1. Basic Setup

```typescript
import { NexusConsole } from '@happy-devkit/nexus-console';
import { Observatory } from '@happy-devkit/observatory';

const terminal = new NexusConsole({
  // Enable observatory reporting
  telemetry: {
    enabled: true,
    endpoint: Observatory.getEndpoint(),
    apiKey: process.env.OBSERVATORY_API_KEY,
    
    // Optional: Custom reporting interval
    reportInterval: 30000, // 30 seconds
    
    // Optional: Data filtering
    includeMetrics: ['performance', 'usage', 'errors'],
    excludeMetrics: ['commands'], // Don't log actual commands
  }
});
```

### 2. Custom Events

```typescript
// Report custom events
terminal.reportEvent('custom_action', {
  action: 'split_pane',
  direction: 'vertical',
  paneCount: 2
});

// Track feature usage
terminal.on('featureUsed', (feature) => {
  Observatory.track('terminal_feature_used', {
    feature: feature.name,
    timestamp: Date.now(),
    sessionId: terminal.sessionId
  });
});
```

### 3. Error Reporting

```typescript
// Automatic error reporting
terminal.on('error', (error) => {
  Observatory.reportError({
    error,
    context: {
      component: 'nexus-console',
      sessionId: terminal.sessionId,
      userAgent: navigator.userAgent,
      config: terminal.getConfiguration()
    }
  });
});

// Manual error reporting
try {
  await terminal.executeCommand(userCommand);
} catch (error) {
  Observatory.reportError({
    error,
    severity: 'medium',
    tags: ['user-command', 'execution-failed']
  });
}
```

## Performance Monitoring

### Real-time Metrics

```typescript
// Enable performance observer
const perfObserver = terminal.createPerformanceObserver();

perfObserver.on('metric', (metric) => {
  // Send to Observatory
  Observatory.metric(metric.name, metric.value, {
    unit: metric.unit,
    tags: {
      terminal_id: terminal.id,
      session_id: terminal.sessionId
    }
  });
});

// Start observing
perfObserver.observe({
  entryTypes: ['render', 'input', 'network']
});
```

### Performance Budgets

```typescript
// Set performance budgets
terminal.setPerformanceBudgets({
  maxRenderTime: 16,      // 16ms for 60fps
  maxInputLatency: 50,    // 50ms max input delay
  maxMemoryUsage: 100,    // 100MB memory limit
});

// Monitor budget violations
terminal.on('budgetExceeded', (violation) => {
  Observatory.alert('performance_budget_exceeded', {
    metric: violation.metric,
    actual: violation.actual,
    budget: violation.budget,
    severity: violation.severity
  });
});
```

## User Analytics

### Session Tracking

```typescript
// Track session lifecycle
terminal.on('sessionStart', () => {
  Observatory.startSession({
    component: 'terminal',
    metadata: {
      shellType: terminal.shell,
      terminalSize: terminal.size,
      features: terminal.enabledFeatures
    }
  });
});

terminal.on('sessionEnd', (summary) => {
  Observatory.endSession({
    duration: summary.duration,
    metrics: {
      commandsExecuted: summary.commandCount,
      errorsEncountered: summary.errorCount,
      dataTransferred: summary.bytesTransferred
    }
  });
});
```

### Command Analytics

```typescript
// Track command patterns (privacy-safe)
terminal.on('commandExecuted', (event) => {
  // Don't send actual command content
  Observatory.track('terminal_command', {
    commandType: classifyCommand(event.command), // 'navigation', 'file-op', etc.
    executionTime: event.duration,
    exitCode: event.exitCode,
    outputSize: event.outputSize
  });
});

function classifyCommand(command: string): string {
  // Classify without exposing content
  if (/^(cd|pushd|popd)/.test(command)) return 'navigation';
  if (/^(ls|dir|find)/.test(command)) return 'listing';
  if (/^(git|hg|svn)/.test(command)) return 'vcs';
  if (/^(npm|yarn|pnpm)/.test(command)) return 'package-manager';
  return 'other';
}
```

## Security Monitoring

### Security Events

```typescript
// Monitor security-relevant events
terminal.on('securityEvent', (event) => {
  Observatory.securityLog({
    eventType: event.type,
    severity: event.severity,
    details: {
      action: event.action,
      blocked: event.blocked,
      reason: event.reason
    },
    timestamp: Date.now()
  });
});

// Track blocked commands
terminal.on('commandBlocked', (event) => {
  Observatory.track('security_command_blocked', {
    pattern: event.pattern,
    rule: event.rule,
    timestamp: Date.now()
  });
});
```

### Audit Trail

```typescript
// Enable audit logging
terminal.enableAuditLog({
  logLevel: 'info',
  includeCommands: false, // Privacy
  includeTimestamps: true,
  
  onAuditEvent: (event) => {
    Observatory.audit({
      action: event.action,
      resource: event.resource,
      outcome: event.outcome,
      metadata: event.metadata
    });
  }
});
```

## Dashboards and Alerts

### Creating Dashboards

Observatory automatically creates dashboards for Nexus Console:

```typescript
// Access pre-built dashboards
const dashboardUrl = Observatory.getDashboardUrl('nexus-console');

// Dashboards include:
// - Terminal Usage Overview
// - Performance Metrics
// - Error Rates
// - Security Events
// - User Activity Patterns
```

### Setting Up Alerts

```typescript
// Configure alerts in Observatory
Observatory.createAlert({
  name: 'High Terminal Error Rate',
  metric: 'nexus_console.errors.rate',
  condition: 'above',
  threshold: 10, // errors per minute
  duration: '5m',
  
  actions: [{
    type: 'email',
    recipients: ['oncall@example.com']
  }, {
    type: 'slack',
    channel: '#alerts'
  }]
});

// Performance degradation alert
Observatory.createAlert({
  name: 'Terminal Performance Degradation',
  metric: 'nexus_console.render_time.p95',
  condition: 'above',
  threshold: 33, // 33ms = below 30fps
  duration: '2m'
});
```

## Data Privacy

### Privacy Controls

```typescript
// Configure privacy settings
new NexusConsole({
  telemetry: {
    enabled: true,
    privacy: {
      // Never send command content
      excludeCommandContent: true,
      
      // Hash user identifiers
      hashUserIds: true,
      
      // Exclude sensitive paths
      excludePaths: ['/home/*/.ssh', '/etc/passwd'],
      
      // Redact patterns
      redactPatterns: [
        /password=\S+/gi,
        /api[_-]?key=\S+/gi,
        /token=\S+/gi
      ]
    }
  }
});
```

### GDPR Compliance

```typescript
// Handle user data requests
terminal.on('gdprRequest', async (request) => {
  switch (request.type) {
    case 'export':
      const data = await terminal.exportUserData();
      Observatory.fulfillGDPR(request.id, data);
      break;
      
    case 'delete':
      await terminal.deleteUserData();
      Observatory.confirmGDPRDeletion(request.id);
      break;
  }
});
```

## Debugging Observatory Integration

### Enable Debug Mode

```typescript
// Debug telemetry
new NexusConsole({
  telemetry: {
    debug: true,
    logRequests: true,
    
    onBeforeSend: (data) => {
      console.log('Sending to Observatory:', data);
      // Modify or filter data
      return data;
    }
  }
});
```

### Verify Connection

```typescript
// Test Observatory connection
const isConnected = await terminal.testObservatoryConnection();
console.log('Observatory connected:', isConnected);

// Check metrics queue
const queueStatus = terminal.getMetricsQueueStatus();
console.log('Pending metrics:', queueStatus.pending);
console.log('Failed metrics:', queueStatus.failed);
```

### Local Development

```typescript
// Use local Observatory instance
if (process.env.NODE_ENV === 'development') {
  Observatory.configure({
    endpoint: 'http://localhost:8080',
    apiKey: 'dev-key',
    debug: true
  });
}
```

## Best Practices

1. **Respect Privacy**: Never send sensitive user data
2. **Sample High-Volume Metrics**: Use sampling for frequent events
3. **Batch Reports**: Group metrics to reduce network overhead
4. **Handle Failures**: Queue metrics when Observatory is unreachable
5. **Monitor Dashboard**: Regularly check Observatory dashboards
6. **Set Meaningful Alerts**: Avoid alert fatigue
7. **Document Custom Metrics**: Keep metric definitions updated

## Example Integration

```typescript
import { NexusConsole } from '@happy-devkit/nexus-console';
import { Observatory } from '@happy-devkit/observatory';

// Complete integration setup
export function setupTerminalWithObservatory() {
  const terminal = new NexusConsole({
    telemetry: {
      enabled: true,
      endpoint: Observatory.getEndpoint(),
      apiKey: process.env.OBSERVATORY_API_KEY,
      reportInterval: 30000,
      
      privacy: {
        excludeCommandContent: true,
        hashUserIds: true
      },
      
      sampling: {
        performance: 0.1, // Sample 10% of performance metrics
        errors: 1.0,      // Report all errors
        usage: 0.5        // Sample 50% of usage metrics
      }
    }
  });
  
  // Custom event tracking
  terminal.on('featureUsed', (feature) => {
    if (shouldTrackFeature(feature)) {
      Observatory.track('terminal_feature', {
        feature: feature.name,
        context: feature.context
      });
    }
  });
  
  // Performance monitoring
  terminal.on('performanceEntry', (entry) => {
    if (entry.duration > 100) { // Only report slow operations
      Observatory.metric('terminal.slow_operation', entry.duration, {
        operation: entry.name,
        severity: getPerformanceSeverity(entry.duration)
      });
    }
  });
  
  // Error tracking with context
  terminal.on('error', (error) => {
    Observatory.reportError({
      error,
      context: {
        sessionId: terminal.sessionId,
        uptime: terminal.uptime,
        lastCommand: 'redacted',
        environment: getEnvironmentInfo()
      }
    });
  });
  
  return terminal;
}
```

## Resources

- [Observatory Documentation](https://observatory.happydevkit.com/docs)
- [Metrics Reference](./METRICS_REFERENCE.md)
- [Dashboard Templates](https://observatory.happydevkit.com/templates/nexus-console)
- [Alert Examples](https://observatory.happydevkit.com/alerts/examples)
