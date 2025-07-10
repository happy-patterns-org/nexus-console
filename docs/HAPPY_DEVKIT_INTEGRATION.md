# Happy DevKit Integration Guide

This guide explains how to integrate Nexus Console with Happy DevKit to provide a powerful terminal interface for your development environment.

## Overview

Nexus Console can be seamlessly integrated with Happy DevKit to provide:
- Terminal access within the DevKit UI
- Remote command execution on agents
- File system browsing and editing
- Real-time log streaming
- Interactive debugging sessions

## Installation

### 1. Install Nexus Console

```bash
npm install @happy-devkit/nexus-console
# or
yarn add @happy-devkit/nexus-console
```

### 2. Configure Happy DevKit

Update your Happy DevKit configuration to include Nexus Console:

```typescript
// happy-devkit.config.ts
import { defineConfig } from '@happy-devkit/core';
import { NexusConsolePlugin } from '@happy-devkit/nexus-console/plugin';

export default defineConfig({
  plugins: [
    new NexusConsolePlugin({
      // Enable terminal for all agents
      enableForAgents: true,
      
      // Custom terminal configuration
      terminalConfig: {
        theme: 'nexus-dark',
        fontSize: 14,
        fontFamily: 'JetBrains Mono, monospace',
      },
      
      // Security settings
      security: {
        allowedCommands: ['ls', 'cd', 'pwd', 'git', 'npm', 'yarn'],
        requireAuth: true,
      }
    })
  ],
});
```

## Basic Integration

### 1. Adding Terminal to Agent View

```tsx
// components/AgentView.tsx
import { NexusConsole } from '@happy-devkit/nexus-console';
import { useAgent } from '@happy-devkit/core';

export function AgentView({ agentId }: { agentId: string }) {
  const agent = useAgent(agentId);
  
  return (
    <div className="agent-view">
      <h2>{agent.name}</h2>
      
      {/* Terminal component */}
      <NexusConsole
        agentId={agentId}
        height="400px"
        onCommand={(cmd) => {
          console.log(`Command executed: ${cmd}`);
        }}
      />
    </div>
  );
}
```

### 2. Remote Command Execution

```typescript
import { createTerminalSession } from '@happy-devkit/nexus-console';
import { connectToAgent } from '@happy-devkit/core';

async function executeRemoteCommand(agentId: string, command: string) {
  // Connect to agent
  const agent = await connectToAgent(agentId);
  
  // Create terminal session
  const session = await createTerminalSession({
    agentId,
    sessionType: 'remote',
  });
  
  // Execute command
  const result = await session.execute(command);
  
  console.log('Output:', result.output);
  console.log('Exit code:', result.exitCode);
  
  // Clean up
  await session.close();
}
```

## Advanced Features

### 1. File System Integration

```typescript
import { FileSystemProvider } from '@happy-devkit/nexus-console';
import { useFileSystem } from '@happy-devkit/core';

export function FileExplorer({ agentId }: { agentId: string }) {
  const fs = useFileSystem(agentId);
  const fsProvider = new FileSystemProvider(fs);
  
  return (
    <NexusConsole
      agentId={agentId}
      fileSystemProvider={fsProvider}
      enableFileExplorer={true}
      onFileOpen={(path) => {
        // Handle file open in editor
        openInEditor(path);
      }}
    />
  );
}
```

### 2. Log Streaming

```typescript
import { LogStreamer } from '@happy-devkit/nexus-console';
import { useAgentLogs } from '@happy-devkit/core';

export function LogViewer({ agentId }: { agentId: string }) {
  const logs = useAgentLogs(agentId);
  
  return (
    <NexusConsole
      agentId={agentId}
      mode="log-viewer"
      logStreamer={new LogStreamer({
        source: logs,
        follow: true,
        filters: [
          { level: 'error', color: 'red' },
          { level: 'warn', color: 'yellow' },
        ],
      })}
    />
  );
}
```

### 3. Interactive Debugging

```typescript
import { DebugSession } from '@happy-devkit/nexus-console';
import { useDebugger } from '@happy-devkit/core';

export function DebugConsole({ agentId }: { agentId: string }) {
  const debugger = useDebugger(agentId);
  
  return (
    <NexusConsole
      agentId={agentId}
      mode="debug"
      debugSession={new DebugSession({
        debugger,
        enableBreakpoints: true,
        enableStepThrough: true,
        enableVariableInspection: true,
      })}
      onBreakpoint={(bp) => {
        console.log('Breakpoint hit:', bp);
      }}
    />
  );
}
```

## Shared Configuration

Nexus Console uses the shared configuration system for consistent settings across Happy DevKit:

```typescript
import { CONSOLE_CONFIG } from '@business-org/shared-config-ts';

// Terminal configuration is automatically loaded from shared config
const terminalConfig = {
  ...CONSOLE_CONFIG.terminal,
  // Override specific settings
  theme: 'custom-theme',
};
```

## Security Considerations

### 1. Command Sanitization

All commands are automatically sanitized before execution:

```typescript
const secureConsole = (
  <NexusConsole
    agentId={agentId}
    security={{
      enableCommandSanitization: true,
      blockedCommands: ['rm', 'format', 'shutdown'],
      allowedPaths: ['/workspace', '/tmp'],
    }}
  />
);
```

### 2. Authentication

```typescript
import { withAuth } from '@happy-devkit/core';

const AuthenticatedConsole = withAuth(NexusConsole, {
  requiredPermissions: ['terminal:access', 'agent:control'],
});
```

### 3. Rate Limiting

```typescript
const rateLimitedConsole = (
  <NexusConsole
    agentId={agentId}
    rateLimit={{
      maxCommandsPerMinute: 60,
      maxOutputPerMinute: 10 * 1024 * 1024, // 10MB
    }}
  />
);
```

## UI Customization

### 1. Custom Themes

```typescript
import { createTheme } from '@happy-devkit/nexus-console';

const customTheme = createTheme({
  name: 'devkit-dark',
  colors: {
    background: '#1e1e1e',
    foreground: '#d4d4d4',
    cursor: '#aeafad',
    selection: '#264f78',
    // ... more colors
  },
});

<NexusConsole theme={customTheme} />
```

### 2. Custom Toolbar

```typescript
import { TerminalToolbar } from '@happy-devkit/nexus-console';

function CustomToolbar({ session }) {
  return (
    <TerminalToolbar>
      <TerminalToolbar.Button
        icon="play"
        onClick={() => session.execute('npm start')}
      >
        Start Dev Server
      </TerminalToolbar.Button>
      
      <TerminalToolbar.Button
        icon="stop"
        onClick={() => session.interrupt()}
      >
        Stop
      </TerminalToolbar.Button>
      
      <TerminalToolbar.Separator />
      
      <TerminalToolbar.Select
        value={session.shell}
        onChange={(shell) => session.changeShell(shell)}
        options={[
          { value: 'bash', label: 'Bash' },
          { value: 'zsh', label: 'Zsh' },
          { value: 'powershell', label: 'PowerShell' },
        ]}
      />
    </TerminalToolbar>
  );
}
```

## Event Handling

```typescript
<NexusConsole
  agentId={agentId}
  
  // Session events
  onSessionCreate={(session) => {
    console.log('Session created:', session.id);
  }}
  
  onSessionClose={(session) => {
    console.log('Session closed:', session.id);
  }}
  
  // Command events
  onCommandStart={(cmd) => {
    trackEvent('terminal_command', { command: cmd });
  }}
  
  onCommandComplete={(cmd, exitCode) => {
    if (exitCode !== 0) {
      notifyError(`Command failed: ${cmd}`);
    }
  }}
  
  // Output events
  onOutput={(data) => {
    // Process output data
  }}
  
  // Error events
  onError={(error) => {
    console.error('Terminal error:', error);
  }}
/>
```

## Performance Optimization

### 1. Lazy Loading

```typescript
import { lazy } from 'react';

const NexusConsole = lazy(() => 
  import('@happy-devkit/nexus-console').then(m => ({ default: m.NexusConsole }))
);
```

### 2. Virtual Scrolling

```typescript
<NexusConsole
  agentId={agentId}
  performance={{
    enableVirtualScrolling: true,
    maxBufferSize: 10000, // lines
    scrollbackLimit: 5000,
  }}
/>
```

### 3. WebGL Rendering

```typescript
<NexusConsole
  agentId={agentId}
  rendering={{
    backend: 'webgl',
    devicePixelRatio: window.devicePixelRatio,
    allowTransparency: false, // Better performance
  }}
/>
```

## Troubleshooting

### Common Issues

1. **Terminal not connecting**
   ```typescript
   // Check WebSocket connection
   const console = (
     <NexusConsole
       agentId={agentId}
       debug={true}
       onConnectionError={(error) => {
         console.error('Connection failed:', error);
         // Retry logic
       }}
     />
   );
   ```

2. **Performance issues**
   ```typescript
   // Disable heavy features
   <NexusConsole
     agentId={agentId}
     performance={{
       disableWebGL: true,
       reducedMotion: true,
       simplifiedRendering: true,
     }}
   />
   ```

3. **Authentication errors**
   ```typescript
   // Ensure proper token handling
   <NexusConsole
     agentId={agentId}
     auth={{
       getToken: async () => {
         const token = await refreshAuthToken();
         return token;
       },
       onAuthError: () => {
         redirectToLogin();
       },
     }}
   />
   ```

## Best Practices

1. **Always sanitize user input**
2. **Implement proper error boundaries**
3. **Use rate limiting for production**
4. **Monitor terminal resource usage**
5. **Provide keyboard shortcuts for common actions**
6. **Test across different browsers and platforms**
7. **Implement proper cleanup on unmount**

## Example: Complete Integration

```typescript
import React, { useState, useEffect } from 'react';
import { NexusConsole, createTerminalSession } from '@happy-devkit/nexus-console';
import { useAgent, useAuth } from '@happy-devkit/core';

export function AgentTerminal({ agentId }: { agentId: string }) {
  const agent = useAgent(agentId);
  const auth = useAuth();
  const [session, setSession] = useState(null);
  
  useEffect(() => {
    // Create session on mount
    createTerminalSession({
      agentId,
      auth: auth.token,
    }).then(setSession);
    
    // Cleanup on unmount
    return () => {
      session?.close();
    };
  }, [agentId]);
  
  if (!session) {
    return <div>Connecting to terminal...</div>;
  }
  
  return (
    <div className="agent-terminal-container">
      <div className="terminal-header">
        <h3>Terminal - {agent.name}</h3>
        <span className="status">
          {session.connected ? '🟢 Connected' : '🔴 Disconnected'}
        </span>
      </div>
      
      <NexusConsole
        session={session}
        height="500px"
        theme="nexus-dark"
        
        // Features
        enableFileExplorer={true}
        enableCommandHistory={true}
        enableAutoComplete={true}
        
        // Security
        security={{
          requireAuth: true,
          allowedCommands: agent.config.allowedCommands,
          maxSessionDuration: 3600000, // 1 hour
        }}
        
        // Performance
        performance={{
          enableWebGL: true,
          enableVirtualScrolling: true,
        }}
        
        // Events
        onCommand={(cmd) => {
          console.log(`[${agent.name}] Executing: ${cmd}`);
        }}
        
        onError={(error) => {
          console.error(`[${agent.name}] Error:`, error);
        }}
      />
    </div>
  );
}
```

## Next Steps

- [WebSocket Protocol Documentation](./WEBSOCKET_PROTOCOL.md)
- [Plugin Development Guide](./PLUGIN_DEVELOPMENT.md)
- [Security Best Practices](./SECURITY_GUIDE.md)
- [API Reference](./api/index.html)
