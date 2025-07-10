# Security Policy

## Reporting Security Vulnerabilities

We take the security of Nexus Console seriously. If you believe you have found a security vulnerability, please report it to us as described below.

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@a0-compliant.dev

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.x.x   | ✅ |
| < 1.0   | ❌ |

## Reporting a Vulnerability

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g. command injection, XSS, WebSocket hijacking, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

## Terminal Security

### Command Injection Prevention

Nexus Console implements multiple layers of protection against command injection:

1. **Input Sanitization**: All user input is sanitized through `CommandSanitizer`
   - Escapes shell metacharacters
   - Validates command structure
   - Blocks dangerous command patterns

2. **PTY Isolation**: Each terminal session runs in an isolated pseudo-terminal
   - No direct shell command execution
   - Input/output streams are controlled
   - Session-specific permissions

3. **Command Allowlisting**: Optional configuration for allowed commands
   ```typescript
   const config = {
     allowedCommands: ['ls', 'cd', 'pwd', 'echo'],
     blockDangerousFlags: true
   };
   ```

### Session Management Security

- Unique session IDs using cryptographically secure random generation
- Session timeout after inactivity
- Proper session cleanup on disconnect
- Rate limiting per session

## WebSocket Security

### Authentication Flow

1. **Initial Handshake**: JWT-based authentication required
   ```typescript
   const ws = new WebSocket(url, {
     headers: {
       'Authorization': `Bearer ${token}`
     }
   });
   ```

2. **Message Validation**: All messages are validated against schemas
   - Type checking with TypeScript
   - Runtime validation with schema validators
   - Message size limits enforced

3. **Connection Security**:
   - TLS/WSS required in production
   - Origin validation
   - CORS properly configured
   - Connection rate limiting

### Rate Limiting Implementation

```typescript
const rateLimiter = {
  maxConnectionsPerIP: 10,
  maxMessagesPerMinute: 600,
  maxDataPerMinute: 10 * 1024 * 1024 // 10MB
};
```

## File System Access Security

### Restricted Access

1. **Sandboxed Environment**: File operations restricted to allowed directories
   ```typescript
   const allowedPaths = [
     '/workspace',
     '/tmp/nexus-console'
   ];
   ```

2. **Path Traversal Prevention**:
   - Canonical path resolution
   - Symlink resolution
   - Parent directory access blocked

3. **Permission Checks**:
   - Read/write permissions validated
   - User context enforcement
   - No privilege escalation

### Safe File Operations

```typescript
// Example of safe file read
async function safeReadFile(path: string): Promise<string> {
  const sanitized = sanitizePath(path);
  if (!isAllowedPath(sanitized)) {
    throw new SecurityError('Access denied');
  }
  return await fs.readFile(sanitized, 'utf8');
}
```

## Content Security Policy (CSP)

Nexus Console implements strict CSP headers:

```typescript
const cspPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'nonce-{random}'"],
  'style-src': ["'self'", "'unsafe-inline'"], // Required for terminal styling
  'connect-src': ["'self'", "wss://"],
  'img-src': ["'self'", "data:"],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'none'"]
};
```

## Security Headers

All HTTP responses include security headers:

```typescript
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});
```

## Input Sanitization

### Terminal Input

```typescript
class CommandSanitizer {
  private readonly dangerousPatterns = [
    /(\||&|;|`|\$\(|\))/g,  // Command chaining
    /(\.\.|~)/g,             // Path traversal
    /(>|<|>>)/g,             // Redirection
  ];

  sanitize(input: string): string {
    let sanitized = input;
    for (const pattern of this.dangerousPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized.trim();
  }
}
```

### WebSocket Messages

All incoming WebSocket messages are validated:

```typescript
function validateMessage(message: unknown): ConsoleMessage {
  if (!isValidMessageType(message.type)) {
    throw new ValidationError('Invalid message type');
  }
  if (!isValidSessionId(message.sessionId)) {
    throw new ValidationError('Invalid session ID');
  }
  return message as ConsoleMessage;
}
```

## Security Testing

### Automated Security Tests

Located in `src/__tests__/security/`:

- Command injection tests
- Path traversal tests
- XSS prevention tests
- WebSocket fuzzing tests
- Session hijacking tests

### Running Security Tests

```bash
npm run test:security
```

## Security Checklist for Contributors

- [ ] All user input is sanitized
- [ ] No hardcoded secrets or credentials
- [ ] Error messages don't leak sensitive information
- [ ] All endpoints require authentication
- [ ] Rate limiting is implemented
- [ ] Security headers are present
- [ ] Dependencies are up to date
- [ ] Security tests pass

## Known Security Considerations

1. **Terminal Escape Sequences**: Some terminal escape sequences can be malicious
   - ANSI escape sequence filtering implemented
   - Dangerous sequences blocked

2. **Resource Exhaustion**: Large amounts of terminal output can cause issues
   - Output buffering limits
   - Memory usage monitoring
   - Automatic session termination on limits

3. **Cross-Site WebSocket Hijacking**: Prevented through origin validation
   - Strict origin checking
   - CSRF tokens for WebSocket upgrade

## Compliance

Nexus Console follows:
- OWASP Top 10 guidelines
- CWE/SANS Top 25
- WebSocket security best practices
- Terminal emulator security standards

## Contact

For security concerns: security@a0-compliant.dev
For general questions: Use GitHub discussions

## Acknowledgments

We thank security researchers who responsibly disclose vulnerabilities.