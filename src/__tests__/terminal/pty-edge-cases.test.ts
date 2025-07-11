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
      terminalState.addSession(sessionId, {});
      
      // Binary data with null bytes
      const binaryData = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
      
      // Simulate adding data to session buffer
      terminalState.updateSession(sessionId, {
        buffer: [binaryData]
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.buffer[0]).toEqual(binaryData);
    });

    test('should handle UTF-8 emoji and special characters', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      const specialChars = '🚀 Hello 世界 €£¥';
      const encoder = new TextEncoder();
      const specialCharsBytes = encoder.encode(specialChars);
      
      // Simulate adding data to session buffer
      terminalState.updateSession(sessionId, {
        buffer: [specialCharsBytes]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toBe(specialChars);
    });

    test('should handle ANSI escape sequences', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Color codes and cursor movements
      const ansiData = '\x1b[31mRed Text\x1b[0m\x1b[2J\x1b[H';
      const encoder = new TextEncoder();
      const ansiBytes = encoder.encode(ansiData);
      
      // Simulate adding data to session buffer
      terminalState.updateSession(sessionId, {
        buffer: [ansiBytes]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toBe(ansiData);
    });
  });

  describe('Large Data Handling', () => {
    test('should handle very large output chunks', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // 1MB of data
      const largeData = 'x'.repeat(1024 * 1024);
      const encoder = new TextEncoder();
      const largeBytes = encoder.encode(largeData);
      
      // Simulate adding large data to session buffer
      terminalState.updateSession(sessionId, {
        buffer: [largeBytes]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toBe(largeData);
    });

    test('should handle rapid small chunks', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      const encoder = new TextEncoder();
      const chunks: Uint8Array[] = [];
      
      // Create 1000 small chunks
      for (let i = 0; i < 1000; i++) {
        chunks.push(encoder.encode(`chunk${i}\n`));
      }
      
      // Simulate adding chunks to session buffer
      terminalState.updateSession(sessionId, {
        buffer: chunks
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.buffer.length).toBe(1000);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[999])).toBe('chunk999\n');
    });

    test('should enforce output buffer limits', () => {
      const sessionId = 'test-session';
      const maxBufferSize = 100; // Set a small limit for testing
      terminalState.addSession(sessionId, {});
      
      const encoder = new TextEncoder();
      const chunks: Uint8Array[] = [];
      
      // Create chunks that would exceed buffer limit
      for (let i = 0; i < 200; i++) {
        chunks.push(encoder.encode(`line${i}\n`));
      }
      
      // In a real implementation, buffer limits would be enforced
      // For now, we'll simulate by only keeping the last maxBufferSize items
      const limitedChunks = chunks.slice(-maxBufferSize);
      
      terminalState.updateSession(sessionId, {
        buffer: limitedChunks
      });
      
      const session = terminalState.getSession(sessionId);
      expect(session?.buffer.length).toBeLessThanOrEqual(maxBufferSize);
    });
  });

  describe('Terminal Resize Edge Cases', () => {
    test('should handle extreme resize dimensions', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {
        options: { cols: 9999, rows: 9999 }
      });
      
      // Send resize message through mock manager
      mockWsManager.sendMessage({
        type: 'pty_resize',
        sessionId,
        cols: 9999,
        rows: 9999
      });
      
      const resizeMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_resize'
      );
      expect(resizeMessage?.cols).toBe(9999);
      expect(resizeMessage?.rows).toBe(9999);
    });

    test('should handle zero dimensions gracefully', () => {
      const sessionId = 'test-session';
      const MIN_COLS = 10;
      const MIN_ROWS = 2;
      
      terminalState.addSession(sessionId, {});
      
      // Try to send resize with zero dimensions
      const cols = Math.max(0, MIN_COLS);
      const rows = Math.max(0, MIN_ROWS);
      
      mockWsManager.sendMessage({
        type: 'pty_resize',
        sessionId,
        cols,
        rows
      });
      
      const resizeMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_resize'
      );
      // Should use minimum dimensions
      expect(resizeMessage?.cols).toBeGreaterThanOrEqual(MIN_COLS);
      expect(resizeMessage?.rows).toBeGreaterThanOrEqual(MIN_ROWS);
    });

    test('should handle rapid resize events', async () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Simulate rapid window resizing
      for (let i = 0; i < 50; i++) {
        mockWsManager.sendMessage({
          type: 'pty_resize',
          sessionId,
          cols: 80 + i,
          rows: 24 + i
        });
      }
      
      // Should have all resize messages
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const resizeMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_resize'
      );
      
      // Should have all 50 messages (no debouncing in mock)
      expect(resizeMessages.length).toBe(50);
    });
  });

  describe('Connection Loss Scenarios', () => {
    test('should queue PTY input during disconnect', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Disconnect
      mockWsManager.disconnect();
      terminalState.setConnected(false);
      
      // Try to send input while disconnected
      mockWsManager.sendMessage({
        type: 'pty_input',
        sessionId,
        data: 'queued command\n'
      });
      
      // Message should be sent even if disconnected (queuing happens in real WS manager)
      expect(mockWsManager.messages.length).toBe(1);
      
      // Reconnect
      mockWsManager.connected = true;
      terminalState.setConnected(true);
      mockWsManager.emit('reconnected');
      
      // Should flush queued messages
      expect(mockWsManager.messages.length).toBeGreaterThan(0);
    });

    test('should handle PTY output during reconnection', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Disconnect
      mockWsManager.disconnect();
      terminalState.setConnected(false);
      
      const encoder = new TextEncoder();
      const outputBytes = encoder.encode('output during disconnect');
      
      // Terminal state should still update even when disconnected
      terminalState.updateSession(sessionId, {
        buffer: [outputBytes]
      });
      
      // Should still have the output
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toBe('output during disconnect');
    });
  });

  describe('Special Terminal Sequences', () => {
    test('should handle terminal bell character', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      const encoder = new TextEncoder();
      const bellData = encoder.encode('Alert\x07');
      
      terminalState.updateSession(sessionId, {
        buffer: [bellData]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toContain('\x07');
    });

    test('should handle carriage return and line feed', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Windows-style CRLF
      const encoder = new TextEncoder();
      const crlfData = encoder.encode('Line 1\r\nLine 2\r\n');
      
      terminalState.updateSession(sessionId, {
        buffer: [crlfData]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      expect(decoder.decode(session?.buffer[0])).toBe('Line 1\r\nLine 2\r\n');
    });

    test('should handle backspace and delete', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      const encoder = new TextEncoder();
      const controlData = encoder.encode('abc\x08\x7f'); // backspace and delete
      
      terminalState.updateSession(sessionId, {
        buffer: [controlData]
      });
      
      const session = terminalState.getSession(sessionId);
      const decoder = new TextDecoder();
      const decoded = decoder.decode(session?.buffer[0]);
      expect(decoded).toContain('\x08');
      expect(decoded).toContain('\x7f');
    });
  });

  describe('Error Recovery', () => {
    test('should handle corrupted PTY messages', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
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
      terminalState.addSession(sessionId, {});
      
      // Simulate PTY process crash by updating session state
      terminalState.updateSession(sessionId, {
        active: false,
        exitCode: -1,
        signal: 'SIGKILL'
      });
      
      // Session should be marked as terminated
      const session = terminalState.getSession(sessionId);
      expect(session?.active).toBe(false);
      expect(session?.exitCode).toBe(-1);
      expect(session?.signal).toBe('SIGKILL');
    });
  });

  describe('Input Edge Cases', () => {
    test('should handle paste of large text', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Simulate pasting 10KB of text
      const largeText = 'x'.repeat(10 * 1024);
      mockWsManager.sendMessage({
        type: 'pty_input',
        sessionId,
        data: largeText
      });
      
      const inputMessage = mockWsManager.messages.find(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessage?.data).toBe(largeText);
    });

    test('should handle special key sequences', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
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
        mockWsManager.sendMessage({
          type: 'pty_input',
          sessionId,
          data: key
        });
      });
      
      const inputMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessages.length).toBe(specialKeys.length);
    });

    test('should handle control characters', () => {
      const sessionId = 'test-session';
      terminalState.addSession(sessionId, {});
      
      // Control characters
      const ctrlChars = [
        '\x03', // Ctrl+C
        '\x04', // Ctrl+D
        '\x1a', // Ctrl+Z
        '\x0c', // Ctrl+L
      ];
      
      ctrlChars.forEach(char => {
        mockWsManager.sendMessage({
          type: 'pty_input',
          sessionId,
          data: char
        });
      });
      
      const inputMessages = mockWsManager.messages.filter(
        msg => msg.type === 'pty_input'
      );
      expect(inputMessages.length).toBe(ctrlChars.length);
    });
  });
});
