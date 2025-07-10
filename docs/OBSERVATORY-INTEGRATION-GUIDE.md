# Nexus Console Integration Guide for Happy Observatory

## Overview

This guide explains how to integrate the Nexus Console into Happy Observatory using the new hybrid architecture. The console maintains direct WebSocket connections for terminal I/O while optionally integrating with the Bridge server for telemetry and metrics.

## Quick Start

### 1. Install the Package

```bash
npm install @happy-devkit/nexus-console
```

### 2. Basic Integration

```tsx
import { NexusConsoleComponent } from '@happy-devkit/nexus-console';

function WorkspaceConsole({ projectId, authToken }) {
  return (
    <NexusConsoleComponent
      projectId={projectId}
      authToken={authToken}
      height={200}
      theme="dark"
      onCommand={(cmd) => console.log('Command:', cmd)}
      onError={(err) => console.error('Error:', err)}
    />
  );
}
```

### 3. With Bridge Integration

```tsx
import { NexusConsoleComponent } from '@happy-devkit/nexus-console';

function WorkspaceConsole({ projectId, authToken }) {
  const [bridgeStatus, setBridgeStatus] = useState({ available: false });

  return (
    <NexusConsoleComponent
      projectId={projectId}
      authToken={authToken}
      
      // Bridge configuration
      enableBridge={true}
      bridgeUrl={process.env.BRIDGE_URL || 'http://localhost:8080/api/bridge'}
      bridgeApiKey={process.env.BRIDGE_API_KEY}
      enableMetrics={true}
      enableDiscovery={true}
      
      // Bridge status monitoring
      onBridgeStatus={(status) => {
        setBridgeStatus(status);
        console.log('Bridge available:', status.available);
      }}
      
      // Layout
      height={200}
      minHeight={40}
      maxHeight={600}
      theme="dark"
    />
  );
}
```

## Architecture Overview

```
Happy Observatory
       │
       ├─── Nexus Console Component (React)
       │           │
       │           ├─── Direct WebSocket ──→ Terminal Server (PTY)
       │           │
       │           └─── Optional Bridge ──→ Bridge Server (Telemetry)
       │
       └─── Other Components
```

## Key Features

### 1. Direct Terminal Connection
- WebSocket connection directly to terminal server
- No routing through Bridge for I/O operations
- Minimal latency for keyboard input and screen updates

### 2. Optional Bridge Integration
When Bridge is available, the console provides:
- **Session Metrics**: Commands executed, bytes transferred, latency stats
- **Endpoint Discovery**: Automatic discovery of available terminal servers
- **Health Monitoring**: Real-time status of terminal endpoints
- **Telemetry Reporting**: Usage patterns and performance data

### 3. Graceful Degradation
- Console works perfectly without Bridge
- Automatically detects Bridge availability
- Seamlessly enables/disables enhanced features

## Configuration Options

### Required Props

```typescript
interface NexusConsoleProps {
  // Authentication
  projectId: string;        // Current project context
  authToken?: string;       // JWT token for authentication
  
  // ... other props
}
```

### Bridge Configuration

```typescript
{
  // Bridge Integration
  enableBridge?: boolean;      // Enable Bridge integration (default: true)
  bridgeUrl?: string;         // Bridge server URL
  bridgeApiKey?: string;      // Optional API key for Bridge
  enableMetrics?: boolean;    // Enable metrics reporting (default: true)
  enableDiscovery?: boolean;  // Enable endpoint discovery (default: true)
}
```

### Layout Configuration

```typescript
{
  // Layout
  height?: number;            // Console height (default: 200)
  minHeight?: number;         // Minimum height (default: 40)
  maxHeight?: number;         // Maximum height (default: 600)
  width?: string | number;    // Console width (default: '100%')
}
```

### Theme Configuration

```typescript
{
  // Appearance
  theme?: 'light' | 'dark' | 'auto';  // Theme mode (default: 'dark')
  fontFamily?: string;                // Terminal font
  fontSize?: number;                  // Font size in pixels
}
```

### Event Handlers

```typescript
{
  // Events
  onCommand?: (command: string) => void;
  onResize?: (height: number) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
  onBridgeStatus?: (status: BridgeStatus) => void;
}
```

## Integration Patterns

### 1. Responsive Layout Integration

```tsx
function CollapsibleConsole() {
  const [collapsed, setCollapsed] = useState(false);
  
  return (
    <div className="console-container">
      <button onClick={() => setCollapsed(!collapsed)}>
        {collapsed ? 'Expand' : 'Collapse'} Console
      </button>
      
      <NexusConsoleComponent
        projectId={projectId}
        height={collapsed ? 40 : 200}
        onResize={(height) => {
          console.log('Console resized to:', height);
        }}
      />
    </div>
  );
}
```

### 2. With Status Monitoring

```tsx
function ConsoleWithStatus() {
  const [bridgeStatus, setBridgeStatus] = useState({ available: false });
  const [metrics, setMetrics] = useState(null);
  
  return (
    <div>
      <div className="status-bar">
        Bridge: {bridgeStatus.available ? '🟢 Connected' : '🔴 Disconnected'}
        {bridgeStatus.features && (
          <span>Features: {bridgeStatus.features.join(', ')}</span>
        )}
      </div>
      
      <NexusConsoleComponent
        projectId={projectId}
        enableBridge={true}
        onBridgeStatus={setBridgeStatus}
        onCommand={(cmd) => {
          // Track command for local analytics
          trackEvent('terminal_command', { command: cmd });
        }}
      />
    </div>
  );
}
```

### 3. Multi-Project Support

```tsx
function ProjectConsole({ projects }) {
  const [activeProject, setActiveProject] = useState(projects[0]?.id);
  
  return (
    <div>
      <select 
        value={activeProject} 
        onChange={(e) => setActiveProject(e.target.value)}
      >
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      
      <NexusConsoleComponent
        key={activeProject} // Force remount on project change
        projectId={activeProject}
        authToken={getProjectToken(activeProject)}
      />
    </div>
  );
}
```

## Bridge API Endpoints

If you're implementing a Bridge server, it should provide these endpoints:

### Health Check
```
GET /api/bridge/health
Response: {
  "version": "1.0.0",
  "features": ["metrics", "discovery"],
  "status": "healthy"
}
```

### Endpoint Discovery
```
GET /api/bridge/terminal/endpoints
Headers: {
  "X-Project-ID": "project-id"
}
Response: [
  {
    "id": "us-east-1",
    "url": "wss://terminal-us-east.example.com",
    "protocol": "wss",
    "region": "us-east",
    "health": "healthy"
  }
]
```

### Metrics Reporting
```
POST /api/bridge/terminal/metrics
Body: {
  "projectId": "project-id",
  "metrics": [{
    "sessionId": "session-123",
    "startTime": 1234567890,
    "commandCount": 42,
    "bytesTransferred": 10240,
    "errors": 0,
    "latency": {
      "min": 1,
      "max": 100,
      "avg": 25,
      "p95": 50,
      "p99": 90
    }
  }]
}
```

## Security Considerations

### Authentication
- Console accepts JWT tokens via `authToken` prop
- Tokens are passed to terminal server via WebSocket
- Bridge uses separate authentication (API key or project token)

### Network Security
- All connections should use TLS (wss://, https://)
- Implement proper CORS headers on Bridge server
- Terminal server should validate JWT tokens

### Content Security Policy
- Console works with strict CSP when embedded as component
- No `unsafe-inline` or `unsafe-eval` required
- Supports nonce-based CSP for inline scripts

## Performance Tips

### 1. Enable Virtual Scrolling
```tsx
<NexusConsoleComponent
  virtualScrolling={true}
  maxLogEntries={10000}
/>
```

### 2. Optimize Metrics Reporting
```tsx
<NexusConsoleComponent
  enableMetrics={true}
  // Report metrics every 60 seconds instead of 30
  bridgeUrl="http://bridge?metricsInterval=60000"
/>
```

### 3. Lazy Loading
```tsx
const NexusConsoleComponent = lazy(() => 
  import('@happy-devkit/nexus-console').then(m => ({ 
    default: m.NexusConsoleComponent 
  }))
);

function App() {
  return (
    <Suspense fallback={<div>Loading console...</div>}>
      <NexusConsoleComponent {...props} />
    </Suspense>
  );
}
```

## Troubleshooting

### Console Not Rendering
1. Check that container has defined height
2. Verify authentication token is valid
3. Check browser console for errors

### Bridge Not Connecting
1. Verify Bridge URL is accessible
2. Check CORS configuration
3. Ensure API key/auth is correct
4. Look for status in `onBridgeStatus` callback

### Performance Issues
1. Enable virtual scrolling
2. Limit max log entries
3. Increase metrics interval
4. Check network latency to servers

## Migration from Iframe

If migrating from iframe-based integration:

```tsx
// Old iframe approach
<iframe src={`/terminal?project=${projectId}`} />

// New component approach
<NexusConsoleComponent projectId={projectId} />
```

Benefits of migration:
- Better performance (no iframe overhead)
- Tighter integration (direct event handling)
- Enhanced security (no postMessage needed)
- Improved styling (inherits parent styles)

## Support

For issues or questions:
- Nexus Console: [GitHub Issues](https://github.com/happy-patterns-org/nexus-console/issues)
- Bridge Integration: Contact DevOps team
- Security: Contact Security team