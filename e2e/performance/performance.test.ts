import { test, expect } from '@playwright/test';

test.describe('Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should achieve sub-16ms render times', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Measure frame render times
    const renderTimes = await page.evaluate(async () => {
      const times: number[] = [];
      let lastTime = performance.now();
      
      return new Promise<number[]>((resolve) => {
        let frameCount = 0;
        
        function measureFrame() {
          const currentTime = performance.now();
          const deltaTime = currentTime - lastTime;
          times.push(deltaTime);
          lastTime = currentTime;
          frameCount++;
          
          if (frameCount < 60) { // Measure 60 frames
            requestAnimationFrame(measureFrame);
          } else {
            resolve(times);
          }
        }
        
        requestAnimationFrame(measureFrame);
      });
    });
    
    // Calculate average and check performance
    const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    const maxRenderTime = Math.max(...renderTimes);
    
    expect(avgRenderTime).toBeLessThan(16); // 60fps target
    expect(maxRenderTime).toBeLessThan(33); // No frame should take more than 2 frames worth
  });

  test('should handle rapid input efficiently', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    const startTime = Date.now();
    
    // Type rapidly
    for (let i = 0; i < 100; i++) {
      await page.keyboard.type(`echo "Line ${i}"`);
      await page.keyboard.press('Enter');
    }
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    // Should handle 100 commands in under 5 seconds
    expect(totalTime).toBeLessThan(5000);
    
    // Terminal should still be responsive
    await page.keyboard.type('echo "Performance test complete"');
    await page.keyboard.press('Enter');
    await expect(page.locator('.xterm-screen')).toContainText('Performance test complete');
  });

  test('should maintain 60fps scrolling', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Generate lots of output
    await page.keyboard.type('for i in {1..1000}; do echo "Line $i"; done');
    await page.keyboard.press('Enter');
    
    // Wait for output
    await page.waitForTimeout(2000);
    
    // Measure scroll performance
    const scrollPerformance = await page.evaluate(async () => {
      const terminal = document.querySelector('.xterm-viewport') as HTMLElement;
      if (!terminal) return { fps: 0, smoothness: 0 };
      
      const frames: number[] = [];
      let lastTime = performance.now();
      let scrollTop = 0;
      const scrollDistance = 1000;
      const scrollDuration = 1000; // 1 second
      const startTime = performance.now();
      
      return new Promise<{ fps: number; smoothness: number }>((resolve) => {
        function animateScroll() {
          const currentTime = performance.now();
          const elapsed = currentTime - startTime;
          const progress = Math.min(elapsed / scrollDuration, 1);
          
          // Smooth scroll
          terminal.scrollTop = scrollTop + (scrollDistance * progress);
          
          // Measure frame time
          const frameTime = currentTime - lastTime;
          frames.push(frameTime);
          lastTime = currentTime;
          
          if (progress < 1) {
            requestAnimationFrame(animateScroll);
          } else {
            const avgFrameTime = frames.reduce((a, b) => a + b, 0) / frames.length;
            const fps = 1000 / avgFrameTime;
            
            // Calculate smoothness (lower variance is better)
            const variance = frames.reduce((acc, time) => {
              return acc + Math.pow(time - avgFrameTime, 2);
            }, 0) / frames.length;
            
            resolve({ fps, smoothness: Math.sqrt(variance) });
          }
        }
        
        requestAnimationFrame(animateScroll);
      });
    });
    
    expect(scrollPerformance.fps).toBeGreaterThan(55); // Allow some margin
    expect(scrollPerformance.smoothness).toBeLessThan(5); // Low variance
  });

  test('should handle large outputs efficiently', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Measure memory before
    const memoryBefore = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Generate large output
    await page.keyboard.type('cat /dev/urandom | head -c 100000 | base64');
    await page.keyboard.press('Enter');
    
    // Wait for output
    await page.waitForTimeout(2000);
    
    // Measure memory after
    const memoryAfter = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }
      return 0;
    });
    
    // Memory increase should be reasonable (less than 50MB for 100KB output)
    const memoryIncrease = memoryAfter - memoryBefore;
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });

  test('should handle WebGL rendering efficiently', async ({ page }) => {
    // Check if WebGL is being used
    const webglEnabled = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      return !!gl;
    });
    
    if (webglEnabled) {
      // Measure WebGL performance
      const terminal = await page.locator('.xterm-helper-textarea');
      await terminal.click();
      
      // Generate complex output with colors
      await page.keyboard.type('for i in {1..100}; do echo -e "\\033[31mR\\033[32mG\\033[34mB\\033[33mY\\033[35mM\\033[36mC\\033[0m"; done');
      await page.keyboard.press('Enter');
      
      // Measure render performance
      const renderMetrics = await page.evaluate(() => {
        return new Promise<{ drawCalls: number; gpuTime: number }>((resolve) => {
          let drawCalls = 0;
          const startTime = performance.now();
          
          // Override WebGL draw calls to count them
          const canvas = document.querySelector('canvas');
          if (canvas) {
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (gl) {
              const originalDrawArrays = gl.drawArrays;
              gl.drawArrays = function(...args: any[]) {
                drawCalls++;
                return originalDrawArrays.apply(gl, args);
              };
            }
          }
          
          // Wait for a render cycle
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const gpuTime = performance.now() - startTime;
              resolve({ drawCalls, gpuTime });
            });
          });
        });
      });
      
      // Should use batched rendering (few draw calls)
      expect(renderMetrics.drawCalls).toBeLessThan(10);
      expect(renderMetrics.gpuTime).toBeLessThan(16);
    }
  });

  test('should handle terminal resize efficiently', async ({ page }) => {
    const terminal = await page.locator('.xterm-helper-textarea');
    await terminal.click();
    
    // Generate some content
    await page.keyboard.type('for i in {1..50}; do echo "Resize test line $i"; done');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    
    // Measure resize performance
    const resizeTimes: number[] = [];
    
    for (let i = 0; i < 5; i++) {
      const width = 800 + i * 100;
      const height = 600 + i * 50;
      
      const startTime = Date.now();
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(100); // Allow resize to complete
      const endTime = Date.now();
      
      resizeTimes.push(endTime - startTime);
    }
    
    // Average resize should be fast
    const avgResizeTime = resizeTimes.reduce((a, b) => a + b, 0) / resizeTimes.length;
    expect(avgResizeTime).toBeLessThan(200); // 200ms per resize
  });
});
