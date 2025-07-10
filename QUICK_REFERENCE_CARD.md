# 🚀 Nexus Console Quick Reference Card

## 🔴 CRITICAL PORT CHANGES

| Service | OLD (Wrong) | NEW (Correct) |
|---------|-------------|---------------|
| Console API | 8000 | **3001** |
| Bridge API | 3001 | **8080** |
| Console WebSocket | ws://localhost:8000 | **ws://localhost:3001** |

## 📦 Required Package Link

```bash
# One-time setup
cd ../happy-devkit/packages/shared-config && npm link
cd - && npm link @happy-devkit/shared-config
```

## 🔧 Most Common Replacements

### Import Statements
```typescript
// ❌ OLD
import { getBridgeHost } from './somewhere';

// ✅ NEW
import { getBridgeAPIUrl } from '@happy-devkit/shared-config';
```

### Bridge URLs
```typescript
// ❌ OLD
'http://localhost:3001/api/bridge'

// ✅ NEW
getBridgeAPIUrl('/health')  // Returns: http://localhost:8080/api/health
```

### Console WebSocket
```typescript
// ❌ OLD
'ws://localhost:8000/terminal/ws'

// ✅ NEW
getConsolePTYUrl(sessionId)  // Returns: ws://localhost:3001/ws/pty/{sessionId}
```

### Types
```typescript
// ❌ OLD - Don't define these
interface PTYMessage { ... }
interface TerminalSession { ... }

// ✅ NEW - Import them
import type { PTYMessage, TerminalSession } from '@happy-devkit/shared-config';
```

## 🌍 Environment Variables

### Required .env
```env
CONSOLE_HOST=localhost
CONSOLE_PORT=3001
BRIDGE_HOST=localhost
BRIDGE_PORT=8080
```

### Vite Config
```env
VITE_DEV_PORT=3000
VITE_CONSOLE_WS_TARGET=ws://localhost:3001
VITE_CONSOLE_API_TARGET=http://localhost:3001
```

## 🎯 Quick Checks

```bash
# Are ports correct?
grep -r "8000" src/  # Should return nothing
grep -r "3001.*bridge" src/  # Should return nothing

# Is shared config linked?
npm ls @happy-devkit/shared-config  # Should show link

# Do imports resolve?
npm run typecheck  # Should pass
```

## 🚦 Start Services

```bash
# Terminal 1: Console API (port 3001)
npm run server:dev

# Terminal 2: Dev server (port 3000)
npm run dev

# Terminal 3: Bridge (if needed, port 8080)
cd ../happy-devkit && npm run bridge:dev
```

## ⚠️ Common Mistakes

1. **Using port 8000** - Console is now 3001!
2. **Bridge on 3001** - Bridge is now 8080!
3. **Defining types locally** - Import from shared-config!
4. **Hardcoding URLs** - Use helper functions!

---
**Remember**: Console=3001, Bridge=8080 🎯