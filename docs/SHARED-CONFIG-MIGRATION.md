# Migrating to Shared Configuration

This guide helps you migrate from hardcoded URLs and ports to the new shared configuration system using `@business-org/shared-config-ts`.

## Overview

The shared configuration system provides:
- **Type-safe constants** for all API paths and WebSocket endpoints
- **Environment variable support** for deployment flexibility
- **Consistent configuration** across all Happy DevKit services
- **No more magic strings** in your code

## Quick Start

### 1. Install the Shared Configuration Package

```bash
npm install @business-org/shared-config-ts
```

Or if using workspace:
```json
"dependencies": {
  "@business-org/shared-config-ts": "workspace:*"
}
```

### 2. Import and Use Configuration

#### Before (Hardcoded):
```typescript
// ❌ Hardcoded URLs
const bridgeUrl = 'http://localhost:8080/api/bridge';
const wsUrl = 'ws://localhost:3001/terminal/ws';
const healthEndpoint = '/api/health';
```

#### After (Shared Config):
```typescript
// ✅ Type-safe configuration
import { 
  getBridgeApiUrl, 
  getConsoleWSUrl, 
  API_PATHS 
} from '@business-org/shared-config-ts';

const bridgeUrl = getBridgeApiUrl();
const wsUrl = getConsoleWSUrl();
const healthEndpoint = API_PATHS.health;
```

## Component Migration

### React Component

#### Before:
```tsx
<NexusConsoleComponent
  projectId="my-project"
  apiEndpoint="http://localhost:3001"
  bridgeUrl="http://localhost:8080/api/bridge"
/>
```

#### After:
```tsx
import { NexusConsoleConfigured } from '@business-org/nexus-console';

<NexusConsoleConfigured
  projectId="my-project"
  useSharedConfig={true}
  // URLs are automatically configured
/>
```

### WebSocket Connection

#### Before:
```typescript
const ws = new WebSocket('ws://localhost:3001/terminal/ws');
```

#### After:
```typescript
import { TerminalWebSocketConfigured } from '@business-org/nexus-console';

const ws = new TerminalWebSocketConfigured({
  projectId: 'my-project',
  useSharedConfig: true
});
```

### Bridge Client

#### Before:
```typescript
const bridge = new BridgeClient({
  bridgeUrl: 'http://localhost:8080/api/bridge'
});
```

#### After:
```typescript
import { getBridgeClient } from '@business-org/nexus-console';

const bridge = getBridgeClient({
  // URL is automatically configured
  enableMetrics: true
});
```

## API Path Migration

### Before:
```typescript
// ❌ Magic strings everywhere
fetch('/api/projects');
fetch('/api/terminal/auth');
fetch('/api/bridge/health');
```

### After:
```typescript
// ✅ Type-safe paths
import { API_PATHS, getBridgeApiUrl, getConsoleApiUrl } from '@business-org/shared-config-ts';

fetch(getConsoleApiUrl(API_PATHS.projects));
fetch(getConsoleApiUrl(API_PATHS.terminal.auth));
fetch(getBridgeApiUrl(API_PATHS.health));
```

## Environment Variables

### Set Up Environment Files

Create `.env.local`:
```bash
# Service hosts
CONSOLE_HOST=http://localhost:3000
BRIDGE_HOST=http://localhost:8080

# Features
ENABLE_BRIDGE_INTEGRATION=true
ENABLE_METRICS=true
```

### Production Configuration

Create `.env.production`:
```bash
# Production hosts
CONSOLE_HOST=https://console.mycompany.com
BRIDGE_HOST=https://bridge.mycompany.com
BRIDGE_API_KEY=sk-prod-key

# Security
JWT_SECRET=your-production-secret
SESSION_SECRET=your-session-secret
```

## TypeScript Types

The shared configuration provides comprehensive types:

```typescript
import type { 
  ServiceConfig,
  ConsoleMessage,
  PTYMessage,
  AgentCommand,
  TerminalSession 
} from '@business-org/shared-config-ts';

// Use types for better type safety
const message: ConsoleMessage = {
  type: 'session_create',
  sessionId: 'abc123',
  data: { cols: 80, rows: 24 }
};
```

## Vite Configuration

Update `vite.config.ts` to use environment variables:

```typescript
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    server: {
      port: parseInt(env.VITE_DEV_PORT || '3000'),
      proxy: {
        '/terminal/ws': {
          target: env.VITE_CONSOLE_WS_TARGET || 'ws://localhost:3001',
          ws: true,
          changeOrigin: true
        }
      }
    }
  };
});
```

## Docker Migration

Update your Dockerfile:

```dockerfile
# Use build args for configuration
ARG CONSOLE_HOST
ARG BRIDGE_HOST

ENV CONSOLE_HOST=${CONSOLE_HOST}
ENV BRIDGE_HOST=${BRIDGE_HOST}
```

Update docker-compose.yml:

```yaml
services:
  nexus-console:
    environment:
      - CONSOLE_HOST=${CONSOLE_HOST:-http://localhost:3000}
      - BRIDGE_HOST=${BRIDGE_HOST:-http://localhost:8080}
      - BRIDGE_API_KEY=${BRIDGE_API_KEY}
```

## Testing with Shared Config

```typescript
import { jest } from '@jest/globals';

// Mock the shared config
jest.mock('@business-org/shared-config-ts', () => ({
  getConsoleHost: () => 'http://test-console',
  getBridgeHost: () => 'http://test-bridge',
  API_PATHS: {
    health: '/api/health',
    projects: '/api/projects'
  }
}));
```

## Common Issues and Solutions

### Issue: URLs still pointing to localhost

**Solution**: Check environment variables are loaded:
```typescript
console.log('Console Host:', process.env.CONSOLE_HOST);
console.log('Bridge Host:', process.env.BRIDGE_HOST);
```

### Issue: TypeScript can't find shared-config

**Solution**: Update tsconfig.json:
```json
{
  "compilerOptions": {
    "paths": {
      "@business-org/shared-config-ts": ["../packages/shared-config/src"]
    }
  }
}
```

### Issue: Build fails with missing module

**Solution**: Ensure shared-config is built:
```bash
cd packages/shared-config
npm run build
```

## Benefits After Migration

1. **No More Hardcoded URLs** - All endpoints configured in one place
2. **Type Safety** - TypeScript catches configuration errors at compile time
3. **Environment Flexibility** - Easy deployment to different environments
4. **Consistency** - All services use the same configuration
5. **Maintainability** - Change URLs in one place, update everywhere

## Next Steps

1. Remove all hardcoded URLs from your code
2. Update CI/CD pipelines to set environment variables
3. Test in different environments
4. Document any custom configuration needs

The shared configuration system makes your code more maintainable and deployment more flexible while providing type safety throughout your application.