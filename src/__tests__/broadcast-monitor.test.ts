import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { 
  BroadcastMonitor, 
  getGlobalBroadcastMonitor, 
  startGlobalBroadcastMonitor,
  stopGlobalBroadcastMonitor 
} from '../monitoring/broadcast-monitor';

// Mock fs module
vi.mock('fs');

describe('BroadcastMonitor', () => {
  const mockBroadcastFile = path.join(os.homedir(), '.shared-config', 'broadcast.json');
  const mockBreakingChange = {
    type: 'BREAKING_CHANGE_DETECTED',
    timestamp: new Date().toISOString(),
    changes: [
      {
        file: 'console-types.ts',
        breaking: true,
        description: 'Changed WSMessage interface'
      }
    ],
    message: 'Breaking change in shared configuration'
  };

  beforeEach(() => {
    vi.useFakeTimers();
    // Reset all mocks
    vi.clearAllMocks();
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    stopGlobalBroadcastMonitor();
  });

  describe('Basic functionality', () => {
    it('should create a new monitor instance', () => {
      const monitor = new BroadcastMonitor();
      expect(monitor).toBeDefined();
      expect(monitor.isRunning()).toBe(false);
    });

    it('should start and stop monitoring', () => {
      const monitor = new BroadcastMonitor();
      
      monitor.start();
      expect(monitor.isRunning()).toBe(true);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('Starting'));
      
      monitor.stop();
      expect(monitor.isRunning()).toBe(false);
      expect(console.log).toHaveBeenCalledWith('BroadcastMonitor: Stopped');
    });

    it('should warn when starting an already running monitor', () => {
      const monitor = new BroadcastMonitor();
      
      monitor.start();
      monitor.start(); // Start again
      
      expect(console.warn).toHaveBeenCalledWith('BroadcastMonitor: Already running');
    });

    it('should check for broadcasts on configured interval', () => {
      const monitor = new BroadcastMonitor({ checkIntervalMs: 5000 });
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      monitor.start();
      
      // Should check immediately
      expect(fs.existsSync).toHaveBeenCalledTimes(1);
      
      // Advance timer
      vi.advanceTimersByTime(5000);
      expect(fs.existsSync).toHaveBeenCalledTimes(2);
      
      vi.advanceTimersByTime(5000);
      expect(fs.existsSync).toHaveBeenCalledTimes(3);
      
      monitor.stop();
    });
  });

  describe('Event type handling', () => {
    it('should handle SHARED_CONFIG_UPDATED events', () => {
      const customHandler = vi.fn();
      const monitor = new BroadcastMonitor({ onBreakingChange: customHandler });
      const updateBroadcast = {
        type: 'SHARED_CONFIG_UPDATED',
        timestamp: new Date().toISOString(),
        version: '1.0.1',
        message: 'Shared config updated to version 1.0.1'
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(updateBroadcast));
      
      monitor.start();
      vi.runOnlyPendingTimers();
      
      // Since it's not a breaking change, it shouldn't trigger the handler
      expect(customHandler).not.toHaveBeenCalled();
      expect(console.error).not.toHaveBeenCalled();
      
      monitor.stop();
    });
  });

  describe('Breaking change detection', () => {
    it('should detect and handle breaking changes', () => {
      const monitor = new BroadcastMonitor();
      const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exit');
      });
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBreakingChange));
      
      monitor.start();
      
      expect(() => {
        vi.runOnlyPendingTimers();
      }).toThrow('Process exit');
      
      expect(console.error).toHaveBeenCalledWith('🚨 BREAKING CHANGE DETECTED IN SHARED CONFIG');
      expect(console.error).toHaveBeenCalledWith('Timestamp:', mockBreakingChange.timestamp);
      expect(console.error).toHaveBeenCalledWith(expect.stringContaining('console-types.ts'));
      expect(mockExit).toHaveBeenCalledWith(1);
      
      mockExit.mockRestore();
    });

    it('should use custom breaking change handler', () => {
      const customHandler = vi.fn();
      const monitor = new BroadcastMonitor({ onBreakingChange: customHandler });
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockBreakingChange));
      
      monitor.start();
      vi.runOnlyPendingTimers();
      
      expect(customHandler).toHaveBeenCalledWith(mockBreakingChange);
      expect(console.error).toHaveBeenCalledWith('🚨 BREAKING CHANGE DETECTED IN SHARED CONFIG');
    });

    it('should ignore non-breaking-change broadcasts', () => {
      const monitor = new BroadcastMonitor();
      const nonBreakingBroadcast = {
        type: 'INFO',
        message: 'Just an info message'
      };
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(nonBreakingBroadcast));
      
      monitor.start();
      vi.runOnlyPendingTimers();
      
      expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('BREAKING CHANGE'));
      
      monitor.stop();
    });
  });

  describe('Error handling', () => {
    it('should silently ignore file read errors', () => {
      const monitor = new BroadcastMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });
      
      expect(() => {
        monitor.start();
        vi.runOnlyPendingTimers();
      }).not.toThrow();
      
      monitor.stop();
    });

    it('should log errors in debug mode', () => {
      const originalDebug = process.env.DEBUG;
      process.env.DEBUG = 'true';
      
      const monitor = new BroadcastMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File read error');
      });
      
      monitor.start();
      vi.runOnlyPendingTimers();
      
      expect(console.debug).toHaveBeenCalledWith(
        'BroadcastMonitor: Error checking broadcasts:',
        expect.any(Error)
      );
      
      monitor.stop();
      process.env.DEBUG = originalDebug;
    });

    it('should handle invalid JSON gracefully', () => {
      const monitor = new BroadcastMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid json');
      
      expect(() => {
        monitor.start();
        vi.runOnlyPendingTimers();
      }).not.toThrow();
      
      monitor.stop();
    });
  });

  describe('Manual checking', () => {
    it('should support manual broadcast checks', async () => {
      const monitor = new BroadcastMonitor();
      
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      await monitor.checkNow();
      
      expect(fs.existsSync).toHaveBeenCalledWith(mockBroadcastFile);
    });
  });

  describe('Global monitor', () => {
    it('should provide a global singleton instance', () => {
      const monitor1 = getGlobalBroadcastMonitor();
      const monitor2 = getGlobalBroadcastMonitor();
      
      expect(monitor1).toBe(monitor2);
    });

    it('should start global monitor with options', () => {
      const customHandler = vi.fn();
      
      const monitor = startGlobalBroadcastMonitor({
        checkIntervalMs: 10000,
        onBreakingChange: customHandler
      });
      
      expect(monitor.isRunning()).toBe(true);
      
      // Verify custom interval works
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.advanceTimersByTime(10000);
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should not start global monitor twice', () => {
      const monitor1 = startGlobalBroadcastMonitor();
      const monitor2 = startGlobalBroadcastMonitor();
      
      expect(monitor1).toBe(monitor2);
      expect(console.warn).not.toHaveBeenCalled(); // Should not warn since it checks isRunning
    });

    it('should stop global monitor', () => {
      const monitor = startGlobalBroadcastMonitor();
      expect(monitor.isRunning()).toBe(true);
      
      stopGlobalBroadcastMonitor();
      expect(monitor.isRunning()).toBe(false);
    });
  });

  describe('Environment variable support', () => {
    it('should use custom broadcast file location from env', () => {
      const originalEnv = process.env.SHARED_STATE_DIR;
      process.env.SHARED_STATE_DIR = '/custom/path';
      
      // Need to re-import to pick up new env value
      vi.resetModules();
      
      const monitor = new BroadcastMonitor();
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      monitor.start();
      vi.runOnlyPendingTimers();
      
      expect(fs.existsSync).toHaveBeenCalledWith(
        path.join('/custom/path', 'shared-config-broadcast.json')
      );
      
      monitor.stop();
      process.env.SHARED_STATE_DIR = originalEnv;
    });
  });
});