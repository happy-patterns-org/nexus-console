/**
 * PTY Edge Case Tests
 * Tests for pseudo-terminal edge cases and error conditions
 */

import { EventEmitter } from 'events';
import TerminalState from '../../core/TerminalState';
import type { PTYMessage } from '@business-org/shared-config-ts/console-types';

// Mock WebSocket manager
class MockWebSocketManager extends EventEmitter {
  connected = true;
  messages: any[] = [];
  
  sendMessage(message: any): void {
    this.messages.push(message);
    
    // Simulate responses
    if (message.type === 'pty_resize') {
      setTimeout(() => {
        this.emit('pty_resize_ack', {
          sessionId: message.sessionId,
          cols: message.cols,
          rows: message.rows
        });
      }, 10);
    }
  }
  
  isConnected(): boolean {
    return this.connected;
  }
  
  disconnect(): void {
    this.connected = false;
    this.emit('disconnected');
  }
}

describe('PTY Edge Cases', () => {
  let terminalState: TerminalState;
  let mockWsManager: MockWebSocketManager;
  
  beforeEach(() => {
    mockWsManager = new MockWebSocketManager();
    terminalState = new TerminalState();
    (terminalState as any).wsManager = mockWsManager;
  });

  describe('Binary Data Handling', () => {
    test('should handle binary data in PTY output', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Binary data with null bytes
      const binaryData = '\x00\x01\x02\x03\x04';
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: binaryData
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe(binaryData);
    });

    test('should handle UTF-8 emoji and special characters', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      const specialChars = '🚀 Hello 世界 €£¥';
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: specialChars
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe(specialChars);
    });

    test('should handle ANSI escape sequences', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Color codes and cursor movements
      const ansiData = '\x1b[31mRed Text\x1b[0m\x1b[2J\x1b[H';
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: ansiData
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe(ansiData);
    });
  });

  describe('Large Data Handling', () => {
    test('should handle very large output chunks', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // 1MB of data
      const largeData = 'x'.repeat(1024 * 1024);
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: largeData
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe(largeData);
    });

    test('should handle rapid small chunks', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Send 1000 small chunks rapidly
      for (let i = 0; i < 1000; i++) {
        mockWsManager.emit('pty_output', {
          type: 'pty_output',
          sessionId,
          data: `chunk${i}\n`
        });
      }
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output.length).toBe(1000);
      expect(session?.output[999]).toBe('chunk999\n');
    });

    test('should enforce output buffer limits', () => {
      const sessionId = 'test-session';
      const maxBufferSize = 100; // Set a small limit for testing
      
      // Configure terminal with buffer limit
      (terminalState as any).maxBufferSize = maxBufferSize;
      terminalState.createSession(sessionId);
      
      // Send more data than buffer allows
      for (let i = 0; i < 200; i++) {
        mockWsManager.emit('pty_output', {
          type: 'pty_output',
          sessionId,
          data: `line${i}\n`
        });
      }
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output.length).toBeLessThanOrEqual(maxBufferSize);
    });
  });

  describe('Terminal Resize Edge Cases', () => {
    test('should handle extreme resize dimensions', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Very large dimensions
      terminalState.resizePTY(sessionId, 9999, 9999);
      
      const resizeMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_resize'
      );
      expect(resizeMessage?.cols).toBe(9999);
      expect(resizeMessage?.rows).toBe(9999);
    });

    test('should handle zero dimensions gracefully', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Zero dimensions (minimized window)
      terminalState.resizePTY(sessionId, 0, 0);
      
      const resizeMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_resize'
      );
      // Should use minimum dimensions
      expect(resizeMessage?.cols).toBeGreaterThan(0);
      expect(resizeMessage?.rows).toBeGreaterThan(0);
    });

    test('should handle rapid resize events', async () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Simulate rapid window resizing
      for (let i = 0; i < 50; i++) {
        terminalState.resizePTY(sessionId, 80 + i, 24 + i);
      }
      
      // Should debounce or queue appropriately
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const resizeMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_resize'
      );
      
      // Should not send all 50 messages
      expect(resizeMessages.length).toBeLessThan(50);
    });
  });

  describe('Connection Loss Scenarios', () => {
    test('should queue PTY input during disconnect', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Disconnect
      mockWsManager.disconnect();
      
      // Try to send input
      terminalState.sendPTYInput(sessionId, 'queued command\n');
      
      // Should be queued, not sent
      expect(mockWsManager.messages.length).toBe(0);
      
      // Reconnect
      mockWsManager.connected = true;
      mockWsManager.emit('reconnected');
      
      // Should flush queued messages
      expect(mockWsManager.messages.length).toBeGreaterThan(0);
    });

    test('should handle PTY output during reconnection', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Disconnect and immediately receive output
      mockWsManager.disconnect();
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: 'output during disconnect'
      });
      
      // Should still process the output
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe('output during disconnect');
    });
  });

  describe('Special Terminal Sequences', () => {
    test('should handle terminal bell character', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: 'Alert\x07'
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toContain('\x07');
    });

    test('should handle carriage return and line feed', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Windows-style CRLF
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: 'Line 1\r\nLine 2\r\n'
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toBe('Line 1\r\nLine 2\r\n');
    });

    test('should handle backspace and delete', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        data: 'abc\x08\x7f' // backspace and delete
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.output[0]).toContain('\x08');
      expect(session?.output[0]).toContain('\x7f');
    });
  });

  describe('Error Recovery', () => {
    test('should handle corrupted PTY messages', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Emit corrupted message
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId,
        // Missing data field
      } as PTYMessage);
      
      // Should not crash
      const session = terminalState.getSession(sessionId);
      expect(session).toBeDefined();
    });

    test('should handle PTY output for non-existent session', () => {
      // No session created
      
      mockWsManager.emit('pty_output', {
        type: 'pty_output',
        sessionId: 'non-existent',
        data: 'orphaned output'
      });
      
      // Should not crash
      expect(terminalState.getSession('non-existent')).toBeUndefined();
    });

    test('should recover from PTY process crash', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Simulate PTY process crash
      mockWsManager.emit('pty_exit', {
        type: 'pty_exit',
        sessionId,
        code: -1,
        signal: 'SIGKILL'
      });
      
      // Session should be marked as terminated
      const session = terminalState.getSession(sessionId);
      expect(session?.active).toBe(false);
    });
  });

  describe('Input Edge Cases', () => {
    test('should handle paste of large text', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Simulate pasting 10KB of text
      const largeText = 'x'.repeat(10 * 1024);
      terminalState.sendPTYInput(sessionId, largeText);
      
      const inputMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessage?.data).toBe(largeText);
    });

    test('should handle special key sequences', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Special keys
      const specialKeys = [
        '\x1b[A', // Up arrow
        '\x1b[B', // Down arrow
        '\x1b[C', // Right arrow
        '\x1b[D', // Left arrow
        '\x1b[3~', // Delete
        '\x1b[H', // Home
        '\x1b[F', // End
      ];
      
      specialKeys.forEach(key => {
        terminalState.sendPTYInput(sessionId, key);
      });
      
      const inputMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessages.length).toBe(specialKeys.length);
    });

    test('should handle control characters', () => {
      const sessionId = 'test-session';
      terminalState.createSession(sessionId);
      
      // Control characters
      const ctrlChars = [
        '\x03', // Ctrl+C
        '\x04', // Ctrl+D
        '\x1a', // Ctrl+Z
        '\x0c', // Ctrl+L
      ];
      
      ctrlChars.forEach(char => {
        terminalState.sendPTYInput(sessionId, char);
      });
      
      const inputMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessages.length).toBe(ctrlChars.length);
    });
  });
});
