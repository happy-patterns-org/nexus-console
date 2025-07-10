import { test, expect } from '@playwright/test';
import { platform } from 'os';

test.describe('Multi-Shell Support', () => {
  // Skip shell-specific tests on incompatible platforms
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';
  const isLinux = platform() === 'linux';

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test.describe('Bash Shell', () => {
    test.skip(isWindows, 'Bash not available on Windows by default');
    
    test('should execute bash-specific commands', async ({ page }) => {
      // Select bash shell
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="bash"]');
      
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Test bash-specific syntax
      await page.keyboard.type('echo $BASH_VERSION');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText(/\d+\.\d+/);
      
      // Test bash array
      await page.keyboard.type('arr=(one two three); echo ${arr[1]}');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('two');
      
      // Test bash function
      await page.keyboard.type('function greet() { echo "Hello, $1!"; }; greet World');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('Hello, World!');
    });

    test('should handle bash history expansion', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Execute some commands
      await page.keyboard.type('echo "First command"');
      await page.keyboard.press('Enter');
      await page.keyboard.type('echo "Second command"');
      await page.keyboard.press('Enter');
      
      // Use history expansion
      await page.keyboard.type('!!');
      await page.keyboard.press('Enter');
      
      const output = await page.locator('.xterm-screen').textContent();
      expect(output).toContain('Second command');
      expect(output?.match(/Second command/g)?.length).toBeGreaterThanOrEqual(2);
    });
  });

  test.describe('Zsh Shell', () => {
    test.skip(isWindows, 'Zsh not available on Windows');
    test.skip(!isMac && !isLinux, 'Zsh may not be installed');
    
    test('should execute zsh-specific features', async ({ page }) => {
      // Select zsh shell
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="zsh"]');
      
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Test zsh version
      await page.keyboard.type('echo $ZSH_VERSION');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText(/\d+\.\d+/);
      
      // Test zsh associative array
      await page.keyboard.type('typeset -A assoc; assoc[key]="value"; echo $assoc[key]');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('value');
      
      // Test zsh glob patterns
      await page.keyboard.type('echo **/*.txt(N)');
      await page.keyboard.press('Enter');
      
      // Output depends on files present
      await page.waitForTimeout(100);
    });
  });

  test.describe('PowerShell', () => {
    test.skip(!isWindows, 'PowerShell test for Windows only');
    
    test('should execute PowerShell commands', async ({ page }) => {
      // Select PowerShell
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="powershell"]');
      
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Test PowerShell version
      await page.keyboard.type('$PSVersionTable.PSVersion');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('Major');
      
      // Test PowerShell cmdlet
      await page.keyboard.type('Get-Date -Format "yyyy-MM-dd"');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText(/\d{4}-\d{2}-\d{2}/);
      
      // Test PowerShell pipeline
      await page.keyboard.type('1..5 | ForEach-Object { $_ * 2 }');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('2');
      await expect(page.locator('.xterm-screen')).toContainText('10');
    });
  });

  test.describe('Shell Switching', () => {
    test('should switch between available shells', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      const shellSelector = page.locator('[data-testid="shell-selector"]');
      
      // Get list of available shells
      await shellSelector.click();
      const availableShells = await page.locator('[data-testid="shell-option"]').all();
      
      for (const shellOption of availableShells) {
        const shellName = await shellOption.getAttribute('data-value');
        if (!shellName) continue;
        
        // Skip incompatible shells
        if (shellName === 'powershell' && !isWindows) continue;
        if (shellName === 'zsh' && isWindows) continue;
        
        // Select shell
        await shellOption.click();
        await terminal.click();
        
        // Verify shell is active
        await page.keyboard.type('echo $0 || echo %COMSPEC%');
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(500);
        
        // Clear for next test
        await page.keyboard.press('Control+L');
      }
    });

    test('should maintain separate history per shell', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      
      // Use bash
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="bash"]');
      await terminal.click();
      
      await page.keyboard.type('echo "bash command"');
      await page.keyboard.press('Enter');
      
      // Switch to sh
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="sh"]');
      await terminal.click();
      
      await page.keyboard.type('echo "sh command"');
      await page.keyboard.press('Enter');
      
      // Go back to bash and check history
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="bash"]');
      await terminal.click();
      
      // Press up arrow to get last bash command
      await page.keyboard.press('ArrowUp');
      
      // Should see bash command, not sh command
      const currentLine = await page.evaluate(() => {
        const selection = window.getSelection();
        return selection?.toString() || '';
      });
      
      expect(currentLine).toContain('bash command');
      expect(currentLine).not.toContain('sh command');
    });
  });

  test.describe('Shell-Specific Features', () => {
    test('should handle shell-specific prompts', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      
      // Test different shell prompts
      const shells = [
        { name: 'bash', promptPattern: /\$|#/ },
        { name: 'sh', promptPattern: /\$|#/ },
        { name: 'zsh', promptPattern: /%|\$|#/, skip: isWindows },
        { name: 'powershell', promptPattern: />|PS/, skip: !isWindows }
      ];
      
      for (const shell of shells) {
        if (shell.skip) continue;
        
        await page.click('[data-testid="shell-selector"]');
        await page.click(`[data-value="${shell.name}"]`);
        await terminal.click();
        
        await page.waitForTimeout(500);
        
        const output = await page.locator('.xterm-screen').textContent();
        expect(output).toMatch(shell.promptPattern);
      }
    });

    test('should handle shell-specific environment variables', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      
      // Bash environment
      await page.click('[data-testid="shell-selector"]');
      await page.click('[data-value="bash"]');
      await terminal.click();
      
      await page.keyboard.type('echo "Shell: $SHELL, User: $USER"');
      await page.keyboard.press('Enter');
      
      const bashOutput = await page.locator('.xterm-screen').textContent();
      expect(bashOutput).toContain('Shell:');
      expect(bashOutput).toContain('User:');
      
      if (isWindows) {
        // PowerShell environment
        await page.click('[data-testid="shell-selector"]');
        await page.click('[data-value="powershell"]');
        await terminal.click();
        
        await page.keyboard.type('echo "User: $env:USERNAME, Computer: $env:COMPUTERNAME"');
        await page.keyboard.press('Enter');
        
        const psOutput = await page.locator('.xterm-screen').textContent();
        expect(psOutput).toContain('User:');
        expect(psOutput).toContain('Computer:');
      }
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid shell selection gracefully', async ({ page }) => {
      // Try to set invalid shell via console
      await page.evaluate(() => {
        window.postMessage({
          type: 'SET_SHELL',
          shell: 'invalid-shell-name'
        }, '*');
      });
      
      // Should fall back to default shell
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      await page.keyboard.type('echo "Still working"');
      await page.keyboard.press('Enter');
      
      await expect(page.locator('.xterm-screen')).toContainText('Still working');
    });

    test('should recover from shell crash', async ({ page }) => {
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Simulate shell exit
      await page.keyboard.type('exit');
      await page.keyboard.press('Enter');
      
      // Should show reconnect option or auto-reconnect
      await expect(page.locator('.xterm-screen')).toContainText(/disconnected|reconnect/i);
      
      // Click reconnect if available
      const reconnectBtn = page.locator('[data-testid="reconnect-button"]');
      if (await reconnectBtn.isVisible()) {
        await reconnectBtn.click();
        await page.waitForTimeout(1000);
        
        // Should be able to use terminal again
        await terminal.click();
        await page.keyboard.type('echo "Reconnected"');
        await page.keyboard.press('Enter');
        
        await expect(page.locator('.xterm-screen')).toContainText('Reconnected');
      }
    });
  });
});
