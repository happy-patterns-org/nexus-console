import { test, expect } from '@playwright/test';

test.describe('XSS Prevention', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should escape HTML in terminal output', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Try to inject script tag
    await page.keyboard.type('echo "<script>alert(\'XSS\');</script>"');
    await page.keyboard.press('Enter');
    
    // Set up dialog handler
    let alertTriggered = false;
    page.on('dialog', () => {
      alertTriggered = true;
    });
    
    // Wait and ensure no alert
    await page.waitForTimeout(1000);
    expect(alertTriggered).toBe(false);
    
    // Output should show escaped HTML
    const output = await page.locator('.xterm-screen').textContent();
    expect(output).toContain('<script>');
    expect(output).not.toContain('<script>alert');
  });

  test('should prevent inline event handlers', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Try various XSS vectors
    const xssVectors = [
      '<img src=x onerror="alert(1)">',
      '<svg onload="alert(2)">',
      '<iframe src="javascript:alert(3)">',
      '<a href="javascript:alert(4)">click</a>'
    ];
    
    for (const vector of xssVectors) {
      await page.keyboard.type(`echo "${vector}"`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
    }
    
    // Check no scripts executed
    const alerts = [];
    page.on('dialog', dialog => alerts.push(dialog));
    await page.waitForTimeout(1000);
    
    expect(alerts).toHaveLength(0);
  });

  test('should enforce Content Security Policy', async ({ page }) => {
    const cspViolations = [];
    
    // Listen for CSP violations
    page.on('console', msg => {
      if (msg.text().includes('Content Security Policy')) {
        cspViolations.push(msg.text());
      }
    });
    
    // Try to inject inline script
    await page.evaluate(() => {
      const script = document.createElement('script');
      script.textContent = 'console.log("inline script executed")';
      document.body.appendChild(script);
    });
    
    await page.waitForTimeout(500);
    
    // Should have CSP violation
    expect(cspViolations.length).toBeGreaterThan(0);
  });

  test('should sanitize user input', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Try command injection
    await page.keyboard.type('echo "test" && cat /etc/passwd');
    await page.keyboard.press('Enter');
    
    // Should not execute second command
    const output = await page.locator('.xterm-screen').textContent();
    expect(output).not.toContain('root:');
    expect(output).toContain('Command blocked');
  });

  test('should handle malicious ANSI sequences', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Try various malicious ANSI sequences
    const maliciousSequences = [
      '\x1b]2;malicious\x07', // Window title injection
      '\x1b[3;malicious\x07', // Operating system command
      '\x1b[?1049h\x1b[H\x1b[2J' // Screen manipulation
    ];
    
    for (const seq of maliciousSequences) {
      await page.keyboard.type(`echo -e "${seq}"`);
      await page.keyboard.press('Enter');
    }
    
    // Terminal should still be functional
    await page.keyboard.type('echo "Still working"');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.xterm-screen')).toContainText('Still working');
  });

  test('should prevent clickjacking', async ({ page }) => {
    // Check X-Frame-Options header
    const response = await page.goto('/');
    const headers = response?.headers();
    
    expect(headers?.['x-frame-options']).toBe('DENY');
    
    // Try to embed in iframe
    await page.goto('about:blank');
    await page.setContent(`
      <iframe src="http://localhost:5173" width="100%" height="600"></iframe>
    `);
    
    // Check iframe is blocked
    const iframe = await page.frameLocator('iframe');
    await expect(iframe.locator('body')).not.toBeVisible();
  });
});
