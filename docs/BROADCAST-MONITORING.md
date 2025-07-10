# Broadcast Monitoring System

## Overview

The Broadcast Monitoring System is a critical component of the nexus-console that monitors for breaking changes in the shared configuration system. It provides automatic detection and alerting when incompatible changes are detected, helping prevent runtime errors and ensuring smooth coordination across teams.

## Purpose

When multiple repositories depend on a shared configuration package, breaking changes can cause significant disruption. The broadcast monitor:

- **Detects** breaking changes in real-time
- **Alerts** developers immediately
- **Prevents** deployment of incompatible code
- **Coordinates** team responses to breaking changes

## How It Works

### 1. Monitoring Process

The broadcast monitor checks a designated file (`/tmp/shared-config-broadcast.json`) at regular intervals for breaking change notifications:

```typescript
import { startGlobalBroadcastMonitor } from '@business-org/nexus-console';

// Start monitoring with default settings (30-second intervals)
startGlobalBroadcastMonitor();
```

### 2. Breaking Change Detection

When the shared-config repository detects a breaking change, it writes a broadcast message:

```json
{
  "type": "BREAKING_CHANGE_DETECTED",
  "timestamp": "2025-01-10T10:30:00Z",
  "changes": [
    {
      "file": "console-types.ts",
      "breaking": true,
      "description": "Changed WSMessage interface structure"
    }
  ],
  "message": "Update required: WSMessage now uses 'data' property"
}
```

### 3. Response Actions

The monitor can be configured with different response strategies:

#### Default: Exit Process (Production)
```typescript
// In production, exit immediately to prevent issues
startGlobalBroadcastMonitor();
```

#### Custom Handler (Development)
```typescript
// In development, show warning but continue
startGlobalBroadcastMonitor({
  onBreakingChange: (broadcast) => {
    console.error('⚠️  Breaking change detected!');
    showNotificationToUser(broadcast.message);
    // Don't exit, allow developer to finish current work
  }
});
```

## Usage

### Basic Setup

The broadcast monitor is automatically started in development mode:

```typescript
// In src/index.ts
if (process.env.NODE_ENV !== 'production') {
  startGlobalBroadcastMonitor({
    checkIntervalMs: 30000, // Check every 30 seconds
    onBreakingChange: (broadcast) => {
      console.error('⚠️  Breaking change detected in shared-config!');
      console.error('Consider pausing development and checking for updates.');
    }
  });
}
```

### Manual Control

You can also control the monitor manually:

```typescript
import { 
  BroadcastMonitor,
  getGlobalBroadcastMonitor,
  stopGlobalBroadcastMonitor 
} from '@business-org/nexus-console';

// Create a custom monitor
const monitor = new BroadcastMonitor({
  checkIntervalMs: 60000, // Check every minute
  onBreakingChange: (broadcast) => {
    // Custom handling
    logToSentry(broadcast);
    notifySlackChannel(broadcast);
  }
});

// Start monitoring
monitor.start();

// Check manually
await monitor.checkNow();

// Stop when needed
monitor.stop();

// Or use the global instance
const globalMonitor = getGlobalBroadcastMonitor();
globalMonitor.checkNow();
```

### React Integration

For React applications, you might want to show UI notifications:

```tsx
import { useEffect, useState } from 'react';
import { startGlobalBroadcastMonitor } from '@business-org/nexus-console';

function App() {
  const [breakingChange, setBreakingChange] = useState(null);

  useEffect(() => {
    const monitor = startGlobalBroadcastMonitor({
      onBreakingChange: (broadcast) => {
        setBreakingChange(broadcast);
      }
    });

    return () => {
      stopGlobalBroadcastMonitor();
    };
  }, []);

  return (
    <>
      {breakingChange && (
        <Alert severity="error">
          Breaking change detected: {breakingChange.message}
        </Alert>
      )}
      {/* Rest of your app */}
    </>
  );
}
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SHARED_STATE_DIR` | Directory for broadcast files | `/tmp` |
| `DEBUG` | Enable debug logging | `false` |

### Monitor Options

```typescript
interface BroadcastMonitorOptions {
  // Check interval in milliseconds
  checkIntervalMs?: number; // Default: 30000 (30 seconds)
  
  // Custom handler for breaking changes
  onBreakingChange?: (broadcast: BreakingChangeBroadcast) => void;
}
```

### Broadcast Message Format

```typescript
interface BreakingChangeBroadcast {
  type: 'BREAKING_CHANGE_DETECTED';
  timestamp: string; // ISO 8601 format
  changes: Array<{
    file: string;
    breaking: boolean;
    description: string;
  }>;
  message?: string; // Optional human-readable message
}
```

## Best Practices

### 1. Environment-Specific Behavior

```typescript
// Production: Exit immediately
if (process.env.NODE_ENV === 'production') {
  startGlobalBroadcastMonitor(); // Uses default exit behavior
}

// Development: Warn but continue
if (process.env.NODE_ENV === 'development') {
  startGlobalBroadcastMonitor({
    onBreakingChange: (broadcast) => {
      console.warn('Breaking change:', broadcast);
      // Show notification but don't exit
    }
  });
}
```

### 2. Integration with CI/CD

```yaml
# In your CI pipeline
- name: Check for breaking changes
  run: |
    # The monitor will exit with code 1 if breaking changes exist
    npm run check:breaking-changes
```

### 3. Custom Notification Systems

```typescript
startGlobalBroadcastMonitor({
  onBreakingChange: async (broadcast) => {
    // Send to multiple channels
    await Promise.all([
      sendSlackNotification(broadcast),
      createJiraTicket(broadcast),
      updateStatusPage(broadcast)
    ]);
    
    // Gracefully shut down after notifications
    await gracefulShutdown();
    process.exit(1);
  }
});
```

## Troubleshooting

### Monitor Not Detecting Changes

1. Check the broadcast file exists:
   ```bash
   ls -la /tmp/shared-config-broadcast.json
   ```

2. Verify file permissions:
   ```bash
   chmod 644 /tmp/shared-config-broadcast.json
   ```

3. Enable debug logging:
   ```bash
   DEBUG=true npm start
   ```

### Custom Broadcast Location

If using a custom location:

```bash
export SHARED_STATE_DIR=/custom/path
npm start
```

### Testing Broadcast Detection

Create a test broadcast file:

```bash
echo '{
  "type": "BREAKING_CHANGE_DETECTED",
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
  "changes": [{
    "file": "test.ts",
    "breaking": true,
    "description": "Test breaking change"
  }],
  "message": "This is a test broadcast"
}' > /tmp/shared-config-broadcast.json
```

## Security Considerations

1. **File Permissions**: Ensure broadcast files are readable but not writable by the application
2. **Trusted Source**: Only accept broadcasts from trusted sources
3. **Validation**: The monitor validates the broadcast format before processing
4. **No Code Execution**: Broadcasts only trigger predefined actions, never arbitrary code

## Future Enhancements

Planned improvements include:

- WebSocket-based real-time notifications
- Integration with package registries
- Automatic migration suggestions
- Version compatibility matrix
- Rollback capabilities

## Related Documentation

- [Shared Configuration Migration Guide](./SHARED-CONFIG-MIGRATION.md)
- [Environment Variables](./ENVIRONMENT-VARIABLES.md)
- [Migration Guide for Repos](../shared-config/docs/migration-guide-for-repos.md)