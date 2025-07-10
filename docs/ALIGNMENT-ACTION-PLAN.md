# Alignment Action Plan: Nexus Console with Shared Configuration

## Overview

This action plan provides step-by-step instructions to align nexus-console with the actual @happy-devkit/shared-config implementation.

## Key Discoveries

1. **Console runs on port 3001** (not 8000)
2. **Bridge runs on port 8080** (not 3001)
3. **Shared-config exists** with complete types and helpers
4. **PTY WebSocket path**: `/ws/pty/{sessionId}`

## Phase 1: Immediate Port Corrections

### Update Vite Configuration
```typescript
// vite.config.ts
const CONSOLE_WS_TARGET = env.VITE_CONSOLE_WS_TARGET || 'ws://localhost:3001';
const CONSOLE_API_TARGET = env.VITE_CONSOLE_API_TARGET || 'http://localhost:3001';
```

### Update Package.json Scripts
```json
// package.json
"server:dev": "cd server && python -m uvicorn main:app --reload --port 3001",
"server:prod": "cd server && python -m uvicorn main:app --host 0.0.0.0 --port 3001"
```

### Update Docker Configuration
```dockerfile
# Dockerfile
EXPOSE 3001
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
```

## Phase 2: Import Corrections

### 1. BridgeClient.ts Updates

```typescript
// Remove this:
const defaultPort = process.env.BRIDGE_PORT || '3001';
const defaultHost = process.env.BRIDGE_HOST || 'localhost';
return `http://${defaultHost}:${defaultPort}/api/bridge`;

// Replace with:
const defaultPort = process.env.BRIDGE_PORT || '8080';
const defaultHost = process.env.BRIDGE_HOST || 'localhost';
return `http://${defaultHost}:${defaultPort}/api`;
```

### 2. Use Shared Config Types

```typescript
// In TerminalWebSocketConfigured.ts
import type { 
  PTYMessage,
  TerminalSession,
  ConsoleConfig
} from '@happy-devkit/shared-config';

// Remove local definitions of these types
```

### 3. Update React Component

```typescript
// In NexusConsoleConfigured.tsx
import { 
  getConsoleAPIUrl,
  getBridgeAPIUrl,
  CONSOLE_CONFIG
} from '@happy-devkit/shared-config';

// Use config values
height = CONSOLE_CONFIG.defaultTerminalRows * CONSOLE_CONFIG.lineHeight;
```

## Phase 3: WebSocket Path Alignment

### Current Implementation
```typescript
// Wrong path
'/terminal/ws'
```

### Correct Implementation
```typescript
// From shared-config
'/ws/pty/{sessionId}'
'/ws/agent/{projectId}'
```

## Phase 4: Environment Variable Standardization

### Create .env.development
```bash
# Console Service
CONSOLE_HOST=localhost
CONSOLE_PORT=3001

# Bridge Service
BRIDGE_HOST=localhost
BRIDGE_PORT=8080

# Features
CONSOLE_PTY_ENABLED=true
CONSOLE_AGENT_MANAGEMENT=true
```

### Update Documentation
Replace all references to:
- `VITE_CONSOLE_WS_TARGET` → `CONSOLE_HOST:CONSOLE_PORT`
- `VITE_CONSOLE_API_TARGET` → `CONSOLE_HOST:CONSOLE_PORT`
- Bridge port 3001 → 8080
- Console port 8000 → 3001

## Phase 5: Type Alignment

### Remove Duplicate Types
Delete from nexus-console:
- `PTYMessage` interface
- `TerminalSession` interface
- `AgentCommand` type
- `ConsoleMessage` interface

### Import from Shared Config
```typescript
import type {
  PTYMessage,
  PTYDataMessage,
  PTYResizeMessage,
  PTYCommandMessage,
  TerminalSession,
  AgentCommand,
  AgentHealthData,
  ConsoleAPIResponse
} from '@happy-devkit/shared-config';
```

## Phase 6: Component Consolidation

### Merge Implementations
1. Keep only one BridgeClient (merge BridgeClient.ts and BridgeClientEnhanced.ts)
2. Keep only one WebSocket manager (merge base and configured versions)
3. Keep only one React component (merge base and configured versions)

### Naming Convention
- `NexusConsole` - The main React component
- `BridgeClient` - The Bridge integration client
- `TerminalWebSocket` - The WebSocket manager

## Validation Steps

### 1. Port Verification
```bash
# Check no references to old ports
grep -r "8000" src/
grep -r "3001.*bridge" src/
```

### 2. Type Checking
```bash
# Ensure all imports resolve
npm run typecheck
```

### 3. Integration Test
```typescript
// Test shared-config imports
import { getBridgeAPIUrl, getConsoleAPIUrl } from '@happy-devkit/shared-config';
console.log(getBridgeAPIUrl('/health')); // Should output: http://localhost:8080/api/health
console.log(getConsoleAPIUrl('/terminals')); // Should output: http://localhost:3001/api/terminals
```

## Timeline

1. **Day 1**: Port corrections and environment setup
2. **Day 2**: Import corrections and type alignment
3. **Day 3**: Component consolidation
4. **Day 4**: Testing and validation

## Success Criteria

- [ ] All services use correct ports
- [ ] No hardcoded URLs remain
- [ ] All types imported from shared-config
- [ ] Documentation matches implementation
- [ ] Tests pass with new configuration
- [ ] Can connect to Bridge on port 8080
- [ ] Console API responds on port 3001

## Risk Mitigation

1. **Backup current state** before making changes
2. **Test incrementally** after each phase
3. **Keep old components** until new ones are verified
4. **Document any deviations** from shared-config

## Support Needed from Happy-DevKit Team

1. **Confirm** port assignments are final
2. **Provide** npm link instructions for shared-config
3. **Clarify** if terminal server is separate from console API
4. **Review** this plan for accuracy