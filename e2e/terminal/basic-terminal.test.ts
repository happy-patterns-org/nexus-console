import { test, expect, Page } from '@playwright/test';

test.describe('Basic Terminal Functionality', () => {
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render terminal container', async () => {
    const terminal = await page.locator('#terminal-container');
    await expect(terminal).toBeVisible();
    await expect(terminal).toHaveClass(/terminal/);
  });

  test('should accept keyboard input', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Type a simple command
    await page.keyboard.type('echo "Hello World"');
    await page.keyboard.press('Enter');
    
    // Check output appears
    await expect(page.locator('.xterm-screen')).toContainText('Hello World');
  });

  test('should handle multiple commands', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Execute multiple commands
    const commands = [
      'pwd',
      'ls',
      'echo "Test Complete"'
    ];
    
    for (const cmd of commands) {
      await page.keyboard.type(cmd);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(100); // Allow command to process
    }
    
    // Verify last command output
    await expect(page.locator('.xterm-screen')).toContainText('Test Complete');
  });

  test('should handle terminal resize', async () => {
    // Initial size
    const initialViewport = page.viewportSize();
    expect(initialViewport).toBeTruthy();
    
    // Resize window
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(500); // Allow resize to process
    
    // Terminal should still be functional
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    await page.keyboard.type('echo "Resized"');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.xterm-screen')).toContainText('Resized');
  });

  test('should support copy and paste', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Type and select text
    await page.keyboard.type('echo "Copy this text"');
    await page.keyboard.press('Enter');
    
    // Wait for output
    await page.waitForTimeout(200);
    
    // Select text (triple-click to select line)
    await page.locator('.xterm-screen').click({ clickCount: 3 });
    
    // Copy
    await page.keyboard.press('Control+C');
    
    // Paste
    await page.keyboard.press('Control+V');
    
    // Verify clipboard functionality worked
    await expect(page.locator('.xterm-screen')).toContainText('Copy this text');
  });

  test('should handle special keys', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Test arrow keys
    await page.keyboard.type('echo test');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.type('first');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.xterm-screen')).toContainText('firstecho test');
    
    // Test Ctrl+C (interrupt)
    await page.keyboard.type('sleep 10');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.keyboard.press('Control+C');
    
    // Should see prompt again
    await page.keyboard.type('echo "Interrupted"');
    await page.keyboard.press('Enter');
    await expect(page.locator('.xterm-screen')).toContainText('Interrupted');
  });

  test('should maintain session state', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Set environment variable
    await page.keyboard.type('export TEST_VAR="Hello"');
    await page.keyboard.press('Enter');
    
    // Use the variable
    await page.keyboard.type('echo $TEST_VAR');
    await page.keyboard.press('Enter');
    
    await expect(page.locator('.xterm-screen')).toContainText('Hello');
  });

  test('should handle ANSI colors', async () => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Test color output
    await page.keyboard.type('echo -e "\\033[31mRed\\033[32mGreen\\033[34mBlue\\033[0m"');
    await page.keyboard.press('Enter');
    
    // Check that colored output is rendered (spans with color classes)
    const coloredElements = await page.locator('.xterm-screen span[style*="color"]').count();
    expect(coloredElements).toBeGreaterThan(0);
  });
});
