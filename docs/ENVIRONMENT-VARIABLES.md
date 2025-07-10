# Environment Variables Configuration

This document describes all environment variables supported by Nexus Console for configuration and deployment flexibility.

## Recent Updates (January 2025)
- Removed last hardcoded URL from BridgeClient.ts
- Added BRIDGE_HOST and BRIDGE_PORT environment variables
- Created test setup file with proper environment configuration

## Overview

Nexus Console uses environment variables to configure various aspects of the application, allowing for easy deployment across different environments without code changes. All hardcoded URLs and ports have been replaced with configurable options.

## Environment Variables

### Development Server Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `VITE_DEV_PORT` or `DEV_PORT` | Development server port | `3000` | `3001` |
| `VITE_CONSOLE_WS_TARGET` or `CONSOLE_WS_TARGET` | WebSocket proxy target for development | `ws://localhost:3001` | `ws://terminal.local:8080` |
| `VITE_CONSOLE_API_TARGET` or `CONSOLE_API_TARGET` | API proxy target for development | `http://localhost:3001` | `http://api.local:8080` |

### Console Service Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CONSOLE_HOST` | Console service host URL | Auto-detected from window.location | `https://console.example.com` |
| `CONSOLE_WS_HOST` | Console WebSocket host | Auto-detected from CONSOLE_HOST | `wss://console.example.com` |
| `CONSOLE_API_PATH` | Base API path | `/api` | `/v1/api` |
| `CONSOLE_WS_PATH` | WebSocket base path | `/ws` | `/websocket` |

### Bridge Service Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `BRIDGE_HOST` | Bridge service hostname | `localhost` | `bridge.example.com` |
| `BRIDGE_PORT` | Bridge service port | `3001` | `3002` |
| `BRIDGE_API_PATH` | Bridge API base path | `/api/bridge` | `/v1/bridge` |
| `BRIDGE_API_KEY` | API key for Bridge authentication | None | `sk-1234567890` |

### Terminal Server Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `TERMINAL_SERVER_HOST` | Terminal server host | `localhost` | `terminal-server.internal` |
| `TERMINAL_SERVER_PORT` | Terminal server port | `8000` | `8080` |
| `TERMINAL_BIND_ADDRESS` | Server bind address | `0.0.0.0` | `127.0.0.1` |

### Security Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `JWT_SECRET` | JWT signing secret | Required in production | `your-secret-key` |
| `SESSION_SECRET` | Session encryption secret | Required in production | `your-session-secret` |
| `TRUST_PROXY_HEADERS` | Trust proxy headers for IP detection | `false` | `true` |
| `CORS_ORIGINS` | Allowed CORS origins (comma-separated) | `http://localhost:3000` | `https://app.example.com,https://www.example.com` |

### Feature Flags

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `ENABLE_BRIDGE_INTEGRATION` | Enable Bridge telemetry | `true` | `false` |
| `ENABLE_METRICS` | Enable metrics collection | `true` | `false` |
| `ENABLE_DISCOVERY` | Enable endpoint discovery | `true` | `false` |
| `ENABLE_VIRTUAL_SCROLLING` | Enable virtual scrolling for performance | `true` | `false` |

### Performance Configuration

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MAX_LOG_ENTRIES` | Maximum log entries to keep | `10000` | `50000` |
| `METRICS_INTERVAL` | Metrics reporting interval (ms) | `30000` | `60000` |
| `RECONNECT_INTERVAL` | WebSocket reconnect interval (ms) | `3000` | `5000` |
| `MAX_RECONNECT_ATTEMPTS` | Maximum reconnection attempts | `10` | `20` |
| `HEARTBEAT_INTERVAL` | WebSocket heartbeat interval (ms) | `30000` | `45000` |

## Usage Examples

### Development Environment (.env.development)

```bash
# Development server
VITE_DEV_PORT=3000
VITE_CONSOLE_WS_TARGET=ws://localhost:3001
VITE_CONSOLE_API_TARGET=http://localhost:3001

# Services
CONSOLE_HOST=http://localhost:3000
BRIDGE_HOST=http://localhost:8080

# Features
ENABLE_BRIDGE_INTEGRATION=true
ENABLE_METRICS=true
```

### Production Environment (.env.production)

```bash
# Services
CONSOLE_HOST=https://console.mycompany.com
BRIDGE_HOST=https://bridge.mycompany.com
BRIDGE_API_KEY=sk-prod-key-here

# Security
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
TRUST_PROXY_HEADERS=true
CORS_ORIGINS=https://app.mycompany.com,https://www.mycompany.com

# Performance
MAX_LOG_ENTRIES=50000
METRICS_INTERVAL=60000
```

### Docker Deployment (docker-compose.yml)

```yaml
services:
  nexus-console:
    image: nexus-console:latest
    environment:
      - CONSOLE_HOST=https://console.example.com
      - BRIDGE_HOST=https://bridge.example.com
      - BRIDGE_API_KEY=${BRIDGE_API_KEY}
      - JWT_SECRET=${JWT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - TRUST_PROXY_HEADERS=true
      - CORS_ORIGINS=https://app.example.com
    ports:
      - "8000:8000"
```

### Kubernetes Deployment (ConfigMap)

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nexus-console-config
data:
  CONSOLE_HOST: "https://console.cluster.local"
  BRIDGE_HOST: "https://bridge.cluster.local"
  ENABLE_METRICS: "true"
  MAX_LOG_ENTRIES: "100000"
  METRICS_INTERVAL: "60000"
```

## Using Shared Configuration

When using the `@happy-devkit/shared-config` package, many of these environment variables are automatically handled:

```typescript
import { getConsoleHost, getBridgeHost } from '@happy-devkit/shared-config';

// These functions automatically use the appropriate environment variables
const consoleUrl = getConsoleHost(); // Uses CONSOLE_HOST
const bridgeUrl = getBridgeHost();   // Uses BRIDGE_HOST
```

## Best Practices

1. **Never commit secrets** - Use `.env.local` for local secrets
2. **Use specific prefixes** - Vite requires `VITE_` prefix for client-side variables
3. **Provide defaults** - Always have sensible defaults for non-sensitive values
4. **Document changes** - Update this file when adding new variables
5. **Validate in production** - Ensure all required variables are set before deployment

## Troubleshooting

### Variables not loading

1. Check file naming: `.env`, `.env.local`, `.env.development`, `.env.production`
2. Restart the development server after changing environment variables
3. For Vite, ensure client-side variables have `VITE_` prefix

### WebSocket connection issues

1. Verify `CONSOLE_WS_TARGET` matches your terminal server
2. Check protocol: `ws://` for HTTP, `wss://` for HTTPS
3. Ensure CORS is configured correctly

### Bridge not connecting

1. Verify `BRIDGE_HOST` is accessible
2. Check `BRIDGE_API_KEY` if authentication is required
3. Ensure `ENABLE_BRIDGE_INTEGRATION` is `true`

## Migration from Hardcoded Values

If migrating from older versions with hardcoded values:

1. Replace `http://localhost:8080/api/bridge` → Use `BRIDGE_HOST`
2. Replace `ws://localhost:3001` → Use `CONSOLE_WS_TARGET`
3. Replace port `8000` in scripts → Use `TERMINAL_SERVER_PORT`
4. Replace `0.0.0.0` bind address → Use `TERMINAL_BIND_ADDRESS`

All hardcoded URLs and ports have been replaced with environment variables for maximum deployment flexibility.