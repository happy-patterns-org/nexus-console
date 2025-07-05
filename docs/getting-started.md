# Getting Started with Nexus Console

## Installation

### NPM
```bash
npm install nexus-console
```

### Yarn
```bash
yarn add nexus-console
```

### CDN
```html
<script type="module">
  import NexusConsole from 'https://unpkg.com/nexus-console@latest/dist/nexus-console.es.js';
</script>
```

## Basic Usage

### Simple Terminal
```javascript
import NexusConsole from 'nexus-console';

// Create terminal instance
const terminal = new NexusConsole({
  container: document.getElementById('terminal')
});

// Initialize and create session
await terminal.initialize();
const session = await terminal.createSession();

// Execute commands
await terminal.executeCommand('ls -la');
```

### With File System Access
```javascript
const terminal = new NexusConsole({
  container: document.getElementById('terminal'),
  enableFileSystem: true
});

await terminal.initialize();

// Request file system access
const handle = await terminal.requestFileAccess({
  mode: 'readwrite'
});

// Read and write files
const content = await terminal.readFile('/path/to/file.txt');
await terminal.writeFile('/path/to/output.txt', 'Hello World');
```

### Multiple Sessions
```javascript
// Create multiple sessions
const session1 = await terminal.createSession({ cwd: '/project1' });
const session2 = await terminal.createSession({ cwd: '/project2' });

// Switch between sessions
await terminal.attachToSession(session1);
await terminal.executeCommand('npm install');

await terminal.attachToSession(session2);
await terminal.executeCommand('npm run build');
```

## Configuration Options

### Basic Options
```javascript
{
  container: HTMLElement | string,     // Required: Container element or selector
  theme: 'nexus-dark',                 // Theme: 'nexus-dark' | 'nexus-light'
  fontSize: 14,                        // Font size in pixels
  fontFamily: '"SF Mono", monospace',  // Terminal font family
  cursorStyle: 'block',                // Cursor: 'block' | 'underline' | 'bar'
  cursorBlink: true,                   // Enable cursor blinking
}
```

### Layout Options
```javascript
{
  position: 'bottom',                  // Position: 'bottom' | 'right' | 'fullscreen' | 'floating'
  initialSize: {                       // Initial terminal size
    width: '100%',
    height: '50%'
  },
  minSize: {                          // Minimum size constraints
    width: 400,
    height: 200
  },
  resizable: true,                    // Allow user resizing
}
```

### Feature Flags
```javascript
{
  enableFileSystem: true,             // Enable file system access
  enableCache: true,                  // Enable performance caching
  showToolbar: true,                  // Show terminal toolbar
  showTabs: true,                     // Enable multi-tab support
  showStatusBar: true,                // Show status information
  animations: true,                   // Enable UI animations
}
```

### Security Options
```javascript
{
  securityLevel: 'standard',          // Security: 'strict' | 'standard' | 'permissive'
  allowedCommands: ['ls', 'cd'],      // Command allowlist (strict mode)
  blockedCommands: ['rm', 'sudo'],    // Command blocklist
}
```

## Events

### Connection Events
```javascript
terminal.on('connected', () => {
  console.log('Terminal connected to server');
});

terminal.on('disconnected', ({ code, reason }) => {
  console.log(`Disconnected: ${reason} (code: ${code})`);
});

terminal.on('reconnecting', ({ attempt, delay }) => {
  console.log(`Reconnecting... attempt ${attempt}`);
});
```

### Session Events
```javascript
terminal.on('session_created', ({ sessionId }) => {
  console.log(`New session created: ${sessionId}`);
});

terminal.on('session_closed', ({ sessionId, exitCode }) => {
  console.log(`Session closed: ${sessionId} (exit: ${exitCode})`);
});

terminal.on('command_executed', ({ command, timestamp }) => {
  console.log(`Executed: ${command} at ${timestamp}`);
});
```

### UI Events
```javascript
terminal.on('resized', ({ width, height }) => {
  console.log(`Terminal resized to ${width}x${height}`);
});

terminal.on('title_changed', ({ title }) => {
  document.title = title;
});
```

## Next Steps

- [API Reference](./api-reference.md) - Complete API documentation
- [Architecture Guide](./architecture.md) - Understanding the internals
- [Security Model](./security.md) - Security features and configuration
- [Examples](../examples/) - More usage examples