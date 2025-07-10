# Nexus Console Troubleshooting Guide

This guide helps you diagnose and resolve common issues with Nexus Console.

## Quick Diagnostics

Run the diagnostic script to check your setup:

```bash
npx nexus-console diagnose
```

This will check:
- Node.js version compatibility
- Required dependencies
- WebSocket connectivity
- Browser compatibility
- Configuration validity

## Common Issues

### Installation Issues

#### Error: Cannot find module '@business-org/shared-config-ts'

**Problem**: The shared configuration package is not installed or not linked properly.

**Solution**:
```bash
# If using local development
cd ../shared-config/packages/shared-config-ts
npm link
cd ../../../nexus-console
npm link @business-org/shared-config-ts

# If using published package
npm install @business-org/shared-config-ts@latest
```

#### Error: ERESOLVE unable to resolve dependency tree

**Problem**: Conflicting peer dependencies.

**Solution**:
```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules and lock file
rm -rf node_modules package-lock.json

# Reinstall with legacy peer deps
npm install --legacy-peer-deps
```

### Connection Issues

#### Terminal Not Connecting

**Symptoms**:
- "Connecting..." message persists
- No terminal prompt appears
- WebSocket errors in console

**Diagnostic Steps**:

1. **Check WebSocket URL**:
   ```javascript
   // In browser console
   console.log(window.location.protocol === 'https:' ? 'wss://' : 'ws://');
   ```

2. **Verify server is running**:
   ```bash
   # Check if server is listening
   lsof -i :3001
   
   # Or using netstat
   netstat -an | grep 3001
   ```

3. **Test WebSocket connection**:
   ```javascript
   // In browser console
   const ws = new WebSocket('ws://localhost:3001/ws');
   ws.onopen = () => console.log('Connected!');
   ws.onerror = (e) => console.error('Error:', e);
   ws.onclose = (e) => console.log('Closed:', e.code, e.reason);
   ```

**Solutions**:

1. **CORS Issues**:
   ```typescript
   // Ensure CORS is configured on server
   app.use(cors({
     origin: ['http://localhost:5173', 'http://localhost:3000'],
     credentials: true
   }));
   ```

2. **Proxy Configuration**:
   ```javascript
   // vite.config.js
   export default {
     server: {
       proxy: {
         '/ws': {
           target: 'ws://localhost:3001',
           ws: true,
           changeOrigin: true
         }
       }
     }
   };
   ```

3. **Firewall/Antivirus**:
   - Add exception for localhost:3001
   - Temporarily disable to test
   - Check Windows Defender or macOS firewall settings

#### Authentication Failed

**Problem**: 401 Unauthorized errors.

**Solutions**:

1. **Check token expiry**:
   ```javascript
   // Decode JWT to check expiry
   const payload = JSON.parse(atob(token.split('.')[1]));
   console.log('Token expires:', new Date(payload.exp * 1000));
   ```

2. **Refresh token**:
   ```javascript
   async function refreshAuthToken() {
     const response = await fetch('/api/auth/refresh', {
       method: 'POST',
       credentials: 'include'
     });
     const { token } = await response.json();
     return token;
   }
   ```

3. **Clear session storage**:
   ```javascript
   sessionStorage.clear();
   localStorage.clear();
   // Reload page
   window.location.reload();
   ```

### Performance Issues

#### Slow Rendering / Low FPS

**Symptoms**:
- Laggy scrolling
- Delayed input response
- High CPU usage

**Diagnostic**:
```javascript
// Check rendering performance
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    console.log(`${entry.name}: ${entry.duration}ms`);
  }
});
observer.observe({ entryTypes: ['measure'] });
```

**Solutions**:

1. **Disable WebGL** (if causing issues):
   ```javascript
   new NexusConsole({
     rendererType: 'canvas', // or 'dom'
     // Disable WebGL
   });
   ```

2. **Reduce buffer size**:
   ```javascript
   new NexusConsole({
     scrollback: 1000, // Default might be 10000
     // Smaller buffer = better performance
   });
   ```

3. **Enable performance mode**:
   ```javascript
   new NexusConsole({
     fastScrollModifier: 'alt',
     macOptionIsMeta: true,
     rendererType: 'canvas',
     fontFamily: 'monospace', // Simpler font
   });
   ```

#### Memory Leaks

**Symptoms**:
- Memory usage grows over time
- Browser becomes unresponsive
- "Out of memory" errors

**Diagnostic**:
```javascript
// Monitor memory usage
setInterval(() => {
  if (performance.memory) {
    console.log('Memory:', {
      used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
    });
  }
}, 5000);
```

**Solutions**:

1. **Clean up on unmount**:
   ```javascript
   // React example
   useEffect(() => {
     const terminal = new NexusConsole(config);
     
     return () => {
       terminal.dispose();
     };
   }, []);
   ```

2. **Limit output history**:
   ```javascript
   // Clear old output periodically
   setInterval(() => {
     if (terminal.buffer.lines.length > 5000) {
       terminal.clear();
     }
   }, 60000); // Every minute
   ```

### Display Issues

#### Garbled or Incorrect Characters

**Problem**: Special characters, emojis, or Unicode not displaying correctly.

**Solutions**:

1. **Set correct locale**:
   ```bash
   export LANG=en_US.UTF-8
   export LC_ALL=en_US.UTF-8
   ```

2. **Configure terminal encoding**:
   ```javascript
   new NexusConsole({
     // Ensure UTF-8
     encoding: 'utf-8',
     // Use a font with good Unicode support
     fontFamily: 'JetBrains Mono, Consolas, monospace'
   });
   ```

3. **Handle ANSI escape sequences**:
   ```javascript
   // Enable full ANSI support
   new NexusConsole({
     convertEol: true,
     cursorBlink: true,
     screenReaderMode: false
   });
   ```

#### Terminal Size Issues

**Problem**: Terminal doesn't fit container or resize properly.

**Solutions**:

1. **Force fit to container**:
   ```javascript
   // After terminal creation
   const fitAddon = new FitAddon();
   terminal.loadAddon(fitAddon);
   fitAddon.fit();
   
   // On window resize
   window.addEventListener('resize', () => fitAddon.fit());
   ```

2. **Manual size calculation**:
   ```javascript
   function calculateTerminalSize(container) {
     const dims = {
       cols: Math.floor(container.clientWidth / 9), // Approximate char width
       rows: Math.floor(container.clientHeight / 17) // Approximate line height
     };
     terminal.resize(dims.cols, dims.rows);
   }
   ```

### Input Issues

#### Keyboard Input Not Working

**Problem**: Typing doesn't appear in terminal.

**Solutions**:

1. **Focus the terminal**:
   ```javascript
   terminal.focus();
   // Or click on the terminal area
   ```

2. **Check input handler**:
   ```javascript
   terminal.onData((data) => {
     console.log('Input received:', data);
     // Should see your keystrokes
   });
   ```

3. **Verify no conflicting handlers**:
   ```javascript
   // Remove any global keyboard handlers that might interfere
   document.removeEventListener('keydown', someGlobalHandler);
   ```

#### Copy/Paste Not Working

**Problem**: Can't copy from or paste to terminal.

**Solutions**:

1. **Enable selection**:
   ```javascript
   new NexusConsole({
     rightClickSelectsWord: true,
     selectionStyle: {
       background: '#264f78'
     }
   });
   ```

2. **Custom clipboard handling**:
   ```javascript
   // Copy
   terminal.onSelectionChange(() => {
     const selection = terminal.getSelection();
     if (selection) {
       navigator.clipboard.writeText(selection);
     }
   });
   
   // Paste
   document.addEventListener('paste', (e) => {
     if (terminal.element.contains(document.activeElement)) {
       const text = e.clipboardData.getData('text');
       terminal.paste(text);
       e.preventDefault();
     }
   });
   ```

### Security Issues

#### Commands Being Blocked

**Problem**: Safe commands are being rejected.

**Check sanitizer configuration**:
```javascript
// Log sanitizer decisions
const sanitizer = new CommandSanitizer({
  debug: true, // Enable debug logging
  allowedCommands: ['ls', 'cd', 'pwd', 'git', 'npm'],
  customRules: [
    // Add custom allowed patterns
    /^echo\s+[^&|;`$()<>]+$/
  ]
});
```

#### CSP Violations

**Problem**: Content Security Policy blocking resources.

**Solutions**:

1. **Check CSP headers**:
   ```javascript
   // In browser console
   console.log(document.querySelector('meta[http-equiv="Content-Security-Policy"]'));
   ```

2. **Adjust CSP for development**:
   ```html
   <meta http-equiv="Content-Security-Policy" content="
     default-src 'self';
     script-src 'self' 'unsafe-inline' 'unsafe-eval';
     style-src 'self' 'unsafe-inline';
     connect-src 'self' ws://localhost:* wss://localhost:*;
   ">
   ```

### Browser-Specific Issues

#### Safari WebSocket Issues

**Problem**: WebSocket connections fail in Safari.

**Solution**:
```javascript
// Safari-specific WebSocket handling
if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
  // Add small delay before connecting
  setTimeout(() => {
    terminal.connect();
  }, 100);
}
```

#### Firefox Performance

**Problem**: Slower performance in Firefox.

**Solution**:
```javascript
// Firefox-specific optimizations
if (navigator.userAgent.includes('Firefox')) {
  new NexusConsole({
    rendererType: 'dom', // DOM renderer works better in Firefox
    fastScrollModifier: 'shift'
  });
}
```

## Debug Mode

Enable comprehensive debugging:

```javascript
// Enable debug mode
window.NEXUS_DEBUG = true;

// Or via environment variable
NEXUS_CONSOLE_DEBUG=true npm run dev

// Debug configuration
new NexusConsole({
  debug: true,
  logLevel: 'debug',
  onLog: (level, message, ...args) => {
    console.log(`[${level}] ${message}`, ...args);
  }
});
```

## Logging

### Enable Detailed Logging

```javascript
// Browser console
localStorage.setItem('debug', 'nexus:*');

// Node.js
DEBUG=nexus:* npm run dev
```

### Log Categories

- `nexus:terminal` - Terminal core operations
- `nexus:websocket` - WebSocket communication
- `nexus:pty` - PTY process management
- `nexus:security` - Security and sanitization
- `nexus:performance` - Performance metrics

## Performance Profiling

### Browser DevTools

1. **Performance Tab**:
   - Record while reproducing issue
   - Look for long tasks > 50ms
   - Check for excessive reflows

2. **Memory Tab**:
   - Take heap snapshots
   - Compare before/after operations
   - Look for detached DOM nodes

### Built-in Metrics

```javascript
const metrics = terminal.getMetrics();
console.table({
  'Render Time': metrics.averageRenderTime + 'ms',
  'Frame Rate': metrics.fps + ' fps',
  'Messages/sec': metrics.messagesPerSecond,
  'Buffer Size': metrics.bufferSize + ' lines',
  'Memory Usage': metrics.memoryUsage + ' MB'
});
```

## Getting Help

### Collect Diagnostic Information

When reporting issues, include:

```javascript
// Run in browser console
const diagnostics = {
  browser: navigator.userAgent,
  nexusVersion: NexusConsole.VERSION,
  config: terminal.getConfiguration(),
  metrics: terminal.getMetrics(),
  errors: terminal.getErrors(),
  timestamp: new Date().toISOString()
};

console.log(JSON.stringify(diagnostics, null, 2));
```

### Support Channels

1. **GitHub Issues**: [Report bugs](https://github.com/business-org/nexus-console/issues)
2. **Discussions**: [Ask questions](https://github.com/business-org/nexus-console/discussions)
3. **Discord**: [Join community](https://discord.gg/nexus-console)
4. **Stack Overflow**: Tag with `nexus-console`

### Emergency Fixes

#### Reset Everything

```bash
# Full reset
rm -rf node_modules package-lock.json
rm -rf dist build
rm -rf ~/.nexus-console
npm cache clean --force
npm install
npm run build
```

#### Fallback Mode

```javascript
// Minimal configuration for troubleshooting
new NexusConsole({
  mode: 'fallback',
  disableWebGL: true,
  disableWebSocket: false,
  minimalUI: true
});
```

## Known Issues

### Current Limitations

1. **WebGL not supported in some environments**
   - Fallback to Canvas renderer
   - Some visual features may be limited

2. **Safari Private Mode**
   - LocalStorage not available
   - Session state won't persist

3. **Corporate Proxies**
   - WebSocket connections may be blocked
   - Use polling fallback mode

### Workarounds

See [GitHub Issues](https://github.com/business-org/nexus-console/issues?q=label:workaround) for specific workarounds.
