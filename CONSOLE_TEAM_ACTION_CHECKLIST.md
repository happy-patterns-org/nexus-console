# Console Team Action Checklist

## 🚨 CRITICAL: Fix Alignment Issues Before Testing

This checklist must be completed IN ORDER before any testing can begin.

## Pre-Flight Checks

- [ ] **STOP** all running console services
- [ ] **BACKUP** current state: `tar -czf nexus-console-backup-$(date +%Y%m%d).tar.gz --exclude=node_modules .`
- [ ] **READ** HAPPY_DEVKIT_CONFIGURATION_STANDARD.md for the official configuration

## Phase 1: Fix Port Configuration (IMMEDIATE)

- [ ] Run the port fix script:
  ```bash
  chmod +x ./scripts/fix-console-ports.sh
  ./scripts/fix-console-ports.sh
  ```
- [ ] Verify changes:
  - Console port: 3001 (was 8000)
  - Bridge port: 8080 (was 3001)

## Phase 2: Link Shared Configuration Package

- [ ] Navigate to shared config and build:
  ```bash
  cd ../shared-config/packages/shared-config-ts
  npm install
  npm run build
  npm link
  ```
- [ ] Link in nexus-console:
  ```bash
  cd ../../../nexus-console
  npm link @business-org/shared-config-ts
  ```
- [ ] Verify link worked:
  ```bash
  npm ls @business-org/shared-config-ts
  ```

## Phase 3: Consolidate Implementations

- [ ] Run consolidation script:
  ```bash
  chmod +x ./scripts/consolidate-console-implementations.sh
  ./scripts/consolidate-console-implementations.sh
  ```
- [ ] Manual consolidation tasks:
  - [ ] Remove BridgeClient.ts (keep BridgeClientEnhanced as BridgeClient)
  - [ ] Remove duplicate WebSocket implementations
  - [ ] Remove duplicate React components
  - [ ] Update all imports to use consolidated versions

## Phase 4: Update Environment Configuration

- [ ] Create proper .env file:
  ```bash
  cp .env.shared-config .env.local
  ```
- [ ] Update .env.local with your values:
  ```env
  CONSOLE_HOST=localhost
  CONSOLE_PORT=3001
  BRIDGE_HOST=localhost
  BRIDGE_PORT=8080
  ```

## Phase 5: Verify Alignment

- [ ] Run verification script:
  ```bash
  chmod +x ./scripts/verify-console-alignment.py
  python3 ./scripts/verify-console-alignment.py
  ```
- [ ] Address any issues reported by the script
- [ ] If quick-fix script is generated, review and run it

## Phase 6: Update Imports

- [ ] Replace all hardcoded URLs with shared config imports:
  ```typescript
  // OLD
  const bridgeUrl = 'http://localhost:3001/api/bridge';
  
  // NEW
  import { getBridgeApiUrl } from '@business-org/shared-config-ts';
  const bridgeUrl = getBridgeApiUrl('/health');
  ```

- [ ] Use shared config types:
  ```typescript
  import type { 
    PTYMessage, 
    TerminalSession,
    AgentCommand 
  } from '@business-org/shared-config-ts';
  ```

## Phase 7: Test Configuration

- [ ] Start services with new ports:
  ```bash
  # Terminal 1: Start console on port 3001
  npm run server:dev
  
  # Terminal 2: Start dev server
  npm run dev
  ```

- [ ] Verify connections:
  - [ ] Console API responds on http://localhost:3001
  - [ ] Can connect to Bridge on http://localhost:8080
  - [ ] WebSocket connections work on ws://localhost:3001

## Phase 8: Final Validation

- [ ] Run type checking:
  ```bash
  npm run typecheck
  ```
- [ ] Run linting:
  ```bash
  npm run lint
  ```
- [ ] Run tests:
  ```bash
  npm test
  ```

## Success Criteria

All of these must be TRUE before proceeding:

- ✅ Console runs on port 3001
- ✅ Bridge connections use port 8080
- ✅ No duplicate implementations exist
- ✅ All imports from @business-org/shared-config-ts resolve
- ✅ No hardcoded URLs remain in source code
- ✅ Environment variables match configuration standard
- ✅ All tests pass

## Common Issues and Solutions

### Issue: "Cannot find module '@business-org/shared-config-ts'"
**Solution**: Ensure you've run `npm link @business-org/shared-config-ts`

### Issue: "Connection refused on port 3001"
**Solution**: Update all server start scripts to use port 3001

### Issue: "Bridge connection failed"
**Solution**: Ensure Bridge is running on port 8080, not 3001

### Issue: Types not resolving
**Solution**: Rebuild shared-config package and re-link

## Support

If you encounter issues:
1. Check HAPPY_DEVKIT_CONFIGURATION_STANDARD.md
2. Review error output from verify-console-alignment.py
3. Consult ALIGNMENT-ACTION-PLAN.md for detailed instructions

## Sign-Off

- [ ] All checklist items completed
- [ ] Verification script shows no issues
- [ ] Ready for integration testing

**Team Member**: ___________________
**Date Completed**: ___________________
**Notes**: ___________________