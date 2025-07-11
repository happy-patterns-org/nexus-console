/**
 * WebSocket Contract Test
 * 
 * This test ensures the WebSocket event contract never changes without explicit approval.
 * If this test fails, it means the contract has changed and all dependent tests may need updates.
 */

import { describe, it, expect } from 'vitest';
import { INTERNAL_SOCKET_CONTRACT } from '../../transport/TerminalWebSocketConfigured';

describe('WebSocket Contract', () => {
  it('should match the approved contract snapshot', () => {
    // This snapshot ensures the contract is explicitly tracked
    // Any changes will require updating this snapshot
    expect(INTERNAL_SOCKET_CONTRACT).toMatchInlineSnapshot(`
      {
        "eventsOut": [
          "connecting",
          "connected",
          "disconnected",
          "reconnecting",
          "error",
          "pty:output",
          "session_created",
          "session_closed",
          "session:session_created",
          "session:session_closed",
          "session:command_result",
          "session:error",
          "session:pong",
          "message",
        ],
        "messagesIn": [
          "pty_output",
          "session_created",
          "session_closed",
          "command_result",
          "error",
          "pong",
          "connected",
        ],
        "messagesOut": [
          "ping",
          "session_create",
          "session_resize",
          "session_close",
          "command_execute",
          "pty_input",
          "command",
          "fs_request_access",
          "fs_read",
          "fs_write",
          "fs_list",
          "fs_watch",
          "fs_unwatch",
        ],
      }
    `);
  });

  it('should have valid event names', () => {
    // Ensure no empty strings or invalid event names
    INTERNAL_SOCKET_CONTRACT.eventsOut.forEach(event => {
      expect(event).toBeTruthy();
      expect(event).not.toContain(' ');
    });

    INTERNAL_SOCKET_CONTRACT.messagesOut.forEach(msg => {
      expect(msg).toBeTruthy();
      expect(msg).not.toContain(' ');
    });

    INTERNAL_SOCKET_CONTRACT.messagesIn.forEach(msg => {
      expect(msg).toBeTruthy();
      expect(msg).not.toContain(' ');
    });
  });

  it('should not have duplicate entries', () => {
    const eventsOutSet = new Set(INTERNAL_SOCKET_CONTRACT.eventsOut);
    const messagesOutSet = new Set(INTERNAL_SOCKET_CONTRACT.messagesOut);
    const messagesInSet = new Set(INTERNAL_SOCKET_CONTRACT.messagesIn);

    expect(eventsOutSet.size).toBe(INTERNAL_SOCKET_CONTRACT.eventsOut.length);
    expect(messagesOutSet.size).toBe(INTERNAL_SOCKET_CONTRACT.messagesOut.length);
    expect(messagesInSet.size).toBe(INTERNAL_SOCKET_CONTRACT.messagesIn.length);
  });
});