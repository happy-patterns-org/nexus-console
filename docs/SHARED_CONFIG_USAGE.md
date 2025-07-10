# Shared Configuration Usage Examples

This guide demonstrates how Nexus Console integrates with the `@business-org/shared-config-ts` package for consistent configuration across the ecosystem.

## Overview

Nexus Console leverages shared configuration for:
- API endpoint consistency
- WebSocket connection management  
- Console-specific configurations
- Type-safe message protocols
- Broadcast monitoring for breaking changes

## Basic Usage

### 1. Importing Configuration

```typescript
import { 
  API_PATHS,
  CONSOLE_CONFIG,
  getConsoleWSUrl,
  getBridgeAPIUrl
} from '@business-org/shared-config-ts';

// Console-specific types
import type {
  ConsoleMessage,
  PTYMessage,
  SessionMessage
} from '@business-org/shared-config-ts/console-types';
```

### 2. Using API Paths

```typescript
import { API_PATHS } from '@business-org/shared-config-ts';

// Health check
const healthUrl = `${baseUrl}${API_PATHS.HEALTH}`;

// Project endpoints
const projectsUrl = `${baseUrl}${API_PATHS.PROJECTS}`;
const projectUrl = `${baseUrl}${API_PATHS.PROJECT_BY_ID(projectId)}`;

// Agent endpoints
const agentsUrl = `${baseUrl}${API_PATHS.PROJECT_AGENTS(projectId)}`;
const agentUrl = `${baseUrl}${API_PATHS.PROJECT_AGENT_BY_ID(projectId, agentId)}`;

// Console-specific endpoints
const sessionsUrl = `${baseUrl}${API_PATHS.CONSOLE_SESSIONS}`;
const sessionUrl = `${baseUrl}${API_PATHS.CONSOLE_SESSION_BY_ID(sessionId)}`;
```

### 3. WebSocket Configuration

```typescript
import { getConsoleWSUrl, CONSOLE_CONFIG } from '@business-org/shared-config-ts';

// Get WebSocket URL with environment detection
const wsUrl = getConsoleWSUrl();
// Development: ws://localhost:3001/ws
// Production: wss://api.example.com/ws

// Create WebSocket with configuration
const ws = new WebSocket(wsUrl, {
  // Use shared protocol version
  protocol: CONSOLE_CONFIG.wsProtocol,
  
  // Apply timeout settings
  handshakeTimeout: CONSOLE_CONFIG.wsHandshakeTimeout,
});

// Message handling with types
ws.on('message', (data: string) => {
  const message: ConsoleMessage = JSON.parse(data);
  
  switch (message.type) {
    case 'pty_output':
      handlePtyOutput(message as PTYMessage);
      break;
    case 'session_created':
      handleSessionCreated(message as SessionMessage);
      break;
  }
});
```

## Advanced Integration

### 1. Bridge Client Configuration

```typescript
import { getBridgeAPIUrl, API_PATHS } from '@business-org/shared-config-ts';
import type { AgentCommand } from '@business-org/shared-config-ts';

export class BridgeClientEnhanced {
  private baseUrl: string;
  
  constructor() {
    // Use shared config for base URL
    this.baseUrl = getBridgeAPIUrl();
  }
  
  async executeCommand(command: AgentCommand): Promise<void> {
    const url = `${this.baseUrl}${API_PATHS.AGENT_EXECUTE_COMMAND(
      command.projectId,
      command.agentId
    )}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });
    
    if (!response.ok) {
      throw new Error(`Command execution failed: ${response.statusText}`);
    }
  }
}
```

### 2. Terminal Configuration

```typescript
import { CONSOLE_CONFIG } from '@business-org/shared-config-ts';

export class TerminalWebSocketConfigured extends TerminalWebSocketEnhanced {
  constructor(url?: string, options?: WebSocketOptions) {
    // Use shared config defaults
    const wsUrl = url || getConsoleWSUrl();
    const config = {
      ...CONSOLE_CONFIG.defaultOptions,
      ...options,
    };
    
    super(wsUrl, config);
  }
  
  protected validateMessage(message: unknown): ConsoleMessage {
    // Use shared validation
    if (!isValidConsoleMessage(message)) {
      throw new Error('Invalid message format');
    }
    return message as ConsoleMessage;
  }
}
```

### 3. Broadcast Monitoring

```typescript
import { BroadcastMonitor } from './monitoring/broadcast-monitor';

// Monitor for breaking changes
const monitor = new BroadcastMonitor({
  sharedConfigDir: '~/.shared-config',
  checkIntervalMs: 30000, // 30 seconds
});

monitor.on('broadcast', (broadcast) => {
  if (broadcast.type === 'BREAKING_CHANGE_DETECTED') {
    console.warn('⚠️  Breaking change in shared configuration!');
    console.warn('Changes:', broadcast.changes);
    
    // In production: graceful shutdown
    // In development: show warning
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
});

monitor.start();
```

## Type-Safe Message Handling

### 1. Message Types

```typescript
import type { 
  ConsoleMessage,
  PTYMessage,
  SessionMessage,
  CommandMessage,
  ErrorMessage
} from '@business-org/shared-config-ts/console-types';

// Type guards
function isPTYMessage(msg: ConsoleMessage): msg is PTYMessage {
  return msg.type === 'pty_output' || 
         msg.type === 'pty_input' ||
         msg.type === 'pty_resize';
}

function isSessionMessage(msg: ConsoleMessage): msg is SessionMessage {
  return msg.type === 'session_create' || 
         msg.type === 'session_created' ||
         msg.type === 'session_close';
}

// Message handler with type safety
function handleMessage(message: ConsoleMessage): void {
  if (isPTYMessage(message)) {
    // TypeScript knows this is PTYMessage
    console.log('PTY data:', message.data);
  } else if (isSessionMessage(message)) {
    // TypeScript knows this is SessionMessage
    console.log('Session ID:', message.sessionId);
  }
}
```

### 2. Creating Messages

```typescript
import { createConsoleMessage } from '@business-org/shared-config-ts/console-types';

// Create type-safe messages
const ptyInput = createConsoleMessage('pty_input', {
  sessionId: 'abc123',
  data: 'ls -la\n',
});

const sessionCreate = createConsoleMessage('session_create', {
  cols: 80,
  rows: 24,
  cwd: '/home/user',
});

// Send messages
ws.send(JSON.stringify(ptyInput));
ws.send(JSON.stringify(sessionCreate));
```

## Environment-Specific Configuration

### 1. Development vs Production

```typescript
import { 
  isDevelopment,
  isProduction,
  getEnvironment 
} from '@business-org/shared-config-ts';

// Conditional configuration
const config = {
  // More verbose logging in development
  logLevel: isDevelopment() ? 'debug' : 'info',
  
  // Stricter security in production
  security: {
    requireAuth: isProduction(),
    enableCommandSanitization: true,
    maxSessionDuration: isDevelopment() ? 0 : 3600000, // 1 hour in prod
  },
  
  // Performance tuning
  performance: {
    enableWebGL: !isDevelopment(), // Disable in dev for easier debugging
    maxBufferSize: isDevelopment() ? 1000 : 10000,
  },
};
```

### 2. Feature Flags

```typescript
import { CONSOLE_CONFIG } from '@business-org/shared-config-ts';

// Check feature availability
if (CONSOLE_CONFIG.features.webglRenderer) {
  terminal.enableWebGL();
}

if (CONSOLE_CONFIG.features.collaborativeEditing) {
  terminal.enableCollaboration({
    wsUrl: getConsoleWSUrl('/collab'),
  });
}

if (CONSOLE_CONFIG.features.aiAssistant) {
  terminal.enableAIAssistant({
    apiKey: process.env.AI_API_KEY,
  });
}
```

## Error Handling

### 1. Typed Errors

```typescript
import type { ErrorMessage } from '@business-org/shared-config-ts/console-types';
import { ConsoleErrorCode } from '@business-org/shared-config-ts';

function handleError(error: ErrorMessage): void {
  switch (error.code) {
    case ConsoleErrorCode.SESSION_NOT_FOUND:
      console.error('Session expired or not found');
      reconnect();
      break;
      
    case ConsoleErrorCode.COMMAND_NOT_ALLOWED:
      console.error('Command blocked by security policy');
      showSecurityWarning();
      break;
      
    case ConsoleErrorCode.RATE_LIMIT_EXCEEDED:
      console.error('Too many requests');
      enableRateLimitBackoff();
      break;
      
    default:
      console.error('Unknown error:', error.message);
  }
}
```

### 2. Validation Errors

```typescript
import { validateConsoleConfig } from '@business-org/shared-config-ts';

try {
  const config = {
    wsUrl: 'ws://localhost:3001',
    maxReconnectAttempts: 5,
    // ... other config
  };
  
  // Validate against schema
  const validConfig = validateConsoleConfig(config);
  
  // Use validated config
  const terminal = new NexusConsole(validConfig);
  
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Invalid configuration:', error.errors);
  }
}
```

## Migration Guide

### From Hardcoded Values

```typescript
// Before: Hardcoded values
const wsUrl = 'ws://localhost:3001/ws';
const apiUrl = 'http://localhost:3000/api';

// After: Shared configuration
import { getConsoleWSUrl, getBridgeAPIUrl } from '@business-org/shared-config-ts';

const wsUrl = getConsoleWSUrl();
const apiUrl = getBridgeAPIUrl();
```

### From Custom Types

```typescript
// Before: Custom message types
interface TerminalMessage {
  type: string;
  data: any;
}

// After: Shared types
import type { ConsoleMessage } from '@business-org/shared-config-ts/console-types';
```

### From Manual Validation

```typescript
// Before: Manual validation
if (message.type && message.sessionId) {
  // Process message
}

// After: Type-safe validation
import { isValidConsoleMessage } from '@business-org/shared-config-ts';

if (isValidConsoleMessage(message)) {
  // TypeScript knows message is ConsoleMessage
}
```

## Best Practices

1. **Always use shared types** - Don't create duplicate type definitions
2. **Leverage environment detection** - Use `isDevelopment()` and `isProduction()`
3. **Monitor for breaking changes** - Set up broadcast monitoring in production
4. **Validate external data** - Use provided validation functions
5. **Use type guards** - Leverage TypeScript's type narrowing
6. **Handle all error codes** - Implement handlers for all `ConsoleErrorCode` values
7. **Keep configuration centralized** - Don't hardcode values that exist in shared config

## Testing with Shared Config

```typescript
import { mockConsoleConfig } from '@business-org/shared-config-ts/testing';

describe('Terminal Integration', () => {
  beforeEach(() => {
    // Mock shared configuration
    mockConsoleConfig({
      wsUrl: 'ws://test:3001/ws',
      features: {
        webglRenderer: false,
        collaborativeEditing: true,
      },
    });
  });
  
  test('uses shared WebSocket URL', () => {
    const terminal = new NexusConsole();
    expect(terminal.wsUrl).toBe('ws://test:3001/ws');
  });
});
```

## Troubleshooting

### Configuration Not Loading

```typescript
// Check if shared config is available
import { isSharedConfigAvailable } from '@business-org/shared-config-ts';

if (!isSharedConfigAvailable()) {
  console.error('Shared configuration not found!');
  console.error('Run: npm install @business-org/shared-config-ts');
}
```

### Type Mismatches

```typescript
// Ensure you're importing from the correct path
// ✅ Correct
import type { ConsoleMessage } from '@business-org/shared-config-ts/console-types';

// ❌ Wrong - might get wrong types
import type { ConsoleMessage } from '@business-org/shared-config-ts';
```

### Breaking Changes

```typescript
// Set up monitoring in your app initialization
import { startGlobalBroadcastMonitor } from './monitoring/broadcast-monitor';

if (process.env.NODE_ENV !== 'production') {
  startGlobalBroadcastMonitor({
    onBreakingChange: (broadcast) => {
      console.error('⚠️  Breaking change detected!');
      console.error('Please update your code to match the new shared configuration.');
      console.error('Changes:', broadcast.changes);
    },
  });
}
```

## Resources

- [Shared Config Repository](https://github.com/business-org/shared-config)
- [Type Definitions](../shared-config/packages/shared-config-ts/src/types)
- [Migration Guide](./MIGRATION_GUIDE.md)
- [API Documentation](./api/shared-config.html)
