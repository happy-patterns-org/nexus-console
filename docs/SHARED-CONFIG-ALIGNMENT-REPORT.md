# Shared Configuration Alignment Report for Happy-DevKit Team

## Executive Summary

This report outlines the alignment requirements between nexus-console and the shared-config package, identifying specific implementations needed and corrections required.

## Current Shared-Config Implementation Analysis

### What Exists in Shared-Config:
1. **Service Configuration**:
   - Console Port: 3001 (not 8000 as we were using)
   - Bridge Port: 8080 (not 3001 as we were using)
   - Console Host: localhost (with CONSOLE_HOST override)

2. **Console-Specific Features**:
   - PTY types and messages
   - Agent management types
   - Terminal session interfaces
   - Console API paths

3. **Helper Functions**:
   - `getConsoleAPIUrl(path)`
   - `getConsolePTYUrl(sessionId)`
   - `getBridgeAPIUrl(path)`
   - `getBridgeWSUrl(projectId)`

## Critical Misalignments Found

### 1. Port Configuration Mismatch

**Current nexus-console**:
```typescript
// Using port 8000 for console
target: 'ws://localhost:8000'
```

**Shared-config expects**:
```typescript
CONSOLE_PORT = 3001
BRIDGE_PORT = 8080
```

**Action Required**: Update all nexus-console port references

### 2. WebSocket URL Construction

**Current nexus-console**:
```typescript
// Direct WebSocket connection
'ws://localhost:8000/terminal/ws'
```

**Shared-config provides**:
```typescript
getConsolePTYUrl(sessionId: string): string
// Returns: ws://localhost:3001/ws/pty/{sessionId}
```

**Action Required**: Use shared-config URL builders

### 3. Bridge API Integration

**Current nexus-console**:
```typescript
// BridgeClient.ts
'http://localhost:3001/api/bridge'
```

**Shared-config expects**:
```typescript
getBridgeAPIUrl('/health')
// Returns: http://localhost:8080/api/health
```

**Action Required**: Update Bridge client to use port 8080

## Implementation Requirements for Nexus-Console

### 1. Update Import Statements

```typescript
// Replace all instances of:
import { getBridgeHost, getConsoleHost } from '@happy-devkit/shared-config';

// With actual imports:
import { 
  getBridgeAPIUrl,
  getConsoleAPIUrl,
  getConsolePTYUrl,
  CONSOLE_API_PATHS,
  type PTYMessage,
  type TerminalSession,
  type AgentCommand
} from '@happy-devkit/shared-config';
```

### 2. Update BridgeClient Implementation

```typescript
// BridgeClient.ts should use:
const healthUrl = getBridgeAPIUrl('/health');
const metricsUrl = getBridgeAPIUrl('/terminal/metrics');
const endpointsUrl = getBridgeAPIUrl('/terminal/endpoints');
```

### 3. Update WebSocket Connections

```typescript
// TerminalWebSocketConfigured.ts should use:
import { getConsolePTYUrl } from '@happy-devkit/shared-config';

// For PTY connections:
const wsUrl = getConsolePTYUrl(sessionId);
```

### 4. Fix Environment Variable Names

**Current Documentation**:
- `VITE_CONSOLE_WS_TARGET`
- `VITE_CONSOLE_API_TARGET`

**Should Be**:
- `CONSOLE_HOST`
- `CONSOLE_PORT`
- `BRIDGE_HOST`
- `BRIDGE_PORT`

### 5. Update Type Definitions

Remove local type definitions that now exist in shared-config:
- `PTYMessage` (exists in console-types.ts)
- `TerminalSession` (exists in console-types.ts)
- `AgentCommand` (exists in console-types.ts)

## Scripts Needed from Happy-DevKit Team

### 1. Package Build Script

```json
// In nexus-console package.json
{
  "scripts": {
    "build:shared-config": "cd ../happy-devkit/packages/shared-config && npm run build",
    "link:shared-config": "cd ../happy-devkit/packages/shared-config && npm link && cd - && npm link @happy-devkit/shared-config"
  }
}
```

### 2. Development Setup Script

```bash
#!/bin/bash
# setup-shared-config.sh

echo "Setting up shared configuration..."

# Build shared-config
cd ../happy-devkit/packages/shared-config
npm install
npm run build

# Link for development
npm link

# Link in nexus-console
cd ../../nexus-console
npm link @happy-devkit/shared-config

echo "Shared configuration linked successfully!"
```

### 3. Environment Template

```bash
# .env.shared-config
# Aligned with shared-config defaults

# Console Configuration
CONSOLE_HOST=localhost
CONSOLE_PORT=3001

# Bridge Configuration  
BRIDGE_HOST=localhost
BRIDGE_PORT=8080

# Feature Flags
CONSOLE_PTY_ENABLED=true
CONSOLE_AGENT_MANAGEMENT=true
```

## Validation Checklist

After alignment, verify:
- [ ] Console runs on port 3001 (not 8000)
- [ ] Bridge connections use port 8080 (not 3001)  
- [ ] All imports from @happy-devkit/shared-config resolve
- [ ] WebSocket URLs match shared-config patterns
- [ ] Environment variables match shared-config names
- [ ] Types are imported, not redefined

## Migration Priority

1. **Immediate**: Fix port numbers (breaking change)
2. **High**: Update import statements
3. **Medium**: Remove duplicate type definitions
4. **Low**: Update documentation

## Questions for Happy-DevKit Team

1. Should nexus-console's terminal server also run on port 3001, or is that just the API?
2. Is the PTY WebSocket path `/ws/pty/{sessionId}` final?
3. Should we use the Bridge for all API calls, or can console make direct calls?
4. Are there plans to publish @happy-devkit/shared-config to npm?

## Next Steps

1. **Happy-DevKit Team**: Review and confirm port assignments
2. **Console Team**: Update all port references
3. **Both Teams**: Test with correct shared-config imports
4. **DevOps**: Update deployment configurations for new ports