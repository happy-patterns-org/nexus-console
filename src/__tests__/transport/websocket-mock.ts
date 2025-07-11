/**
 * Simple WebSocket Mock for Vitest
 * 
 * Provides a mock WebSocket implementation for testing without real connections
 */

import { EventEmitter } from 'events';
import { vi } from 'vitest';

export class MockWebSocket extends EventEmitter {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState: number = MockWebSocket.CONNECTING;
  url: string;
  protocol: string = '';
  extensions: string = '';
  bufferedAmount: number = 0;
  binaryType: 'blob' | 'arraybuffer' = 'blob';

  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string, protocols?: string | string[]) {
    super();
    this.url = url;
  }

  send(data: string | ArrayBuffer | Blob | ArrayBufferView): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.emit('send', data);
  }

  close(code?: number, reason?: string): void {
    if (this.readyState === MockWebSocket.CLOSED) return;
    
    this.readyState = MockWebSocket.CLOSING;
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      const event = new CloseEvent('close', { code, reason });
      if (this.onclose) this.onclose(event);
      this.emit('close', event);
    }, 0);
  }

  // Test helpers
  mockOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    const event = new Event('open');
    if (this.onopen) this.onopen(event);
    this.emit('open', event);
  }

  mockMessage(data: any): void {
    const event = new MessageEvent('message', { data });
    if (this.onmessage) this.onmessage(event);
    this.emit('message', event);
  }

  mockError(error?: any): void {
    const event = new ErrorEvent('error', { error });
    if (this.onerror) this.onerror(event);
    this.emit('error', event);
  }

  mockClose(code: number = 1000, reason: string = ''): void {
    this.close(code, reason);
  }
}

export class MockWebSocketServer {
  clients: Set<MockWebSocket> = new Set();
  url: string;
  private messageHandlers: Map<string, (data: any) => any> = new Map();

  constructor(url: string) {
    this.url = url;
  }

  // Configure server responses
  on(messageType: string, handler: (data: any) => any): void {
    this.messageHandlers.set(messageType, handler);
  }

  // Helper to create a connected client
  createConnectedClient(): MockWebSocket {
    const ws = new MockWebSocket(this.url);
    this.clients.add(ws);
    
    // Auto-handle messages based on registered handlers
    ws.on('send', (data: string) => {
      try {
        const message = JSON.parse(data);
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
          const response = handler(message);
          if (response) {
            setTimeout(() => {
              ws.mockMessage(JSON.stringify(response));
            }, 0);
          }
        }
      } catch (e) {
        // Not JSON, ignore
      }
    });

    // Clean up on close
    ws.on('close', () => {
      this.clients.delete(ws);
    });

    return ws;
  }

  // Broadcast to all connected clients
  broadcast(data: any): void {
    const message = typeof data === 'string' ? data : JSON.stringify(data);
    this.clients.forEach(client => {
      if (client.readyState === MockWebSocket.OPEN) {
        client.mockMessage(message);
      }
    });
  }

  close(): void {
    this.clients.forEach(client => client.close());
    this.clients.clear();
  }
}

// Helper to replace global WebSocket with mock
export function mockWebSocket(): {
  server: MockWebSocketServer;
  restore: () => void;
} {
  const server = new MockWebSocketServer('ws://mock-server');
  const OriginalWebSocket = global.WebSocket;

  // Replace global WebSocket
  (global as any).WebSocket = vi.fn().mockImplementation((url: string) => {
    const ws = server.createConnectedClient();
    ws.url = url;
    
    // Auto-open after a tick
    setTimeout(() => ws.mockOpen(), 0);
    
    return ws;
  });

  return {
    server,
    restore: () => {
      (global as any).WebSocket = OriginalWebSocket;
    }
  };
}

// Event classes for Node.js environment
if (typeof Event === 'undefined') {
  (global as any).Event = class Event {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };
}

if (typeof MessageEvent === 'undefined') {
  (global as any).MessageEvent = class MessageEvent extends Event {
    data: any;
    constructor(type: string, init?: { data?: any }) {
      super(type);
      this.data = init?.data;
    }
  };
}

if (typeof CloseEvent === 'undefined') {
  (global as any).CloseEvent = class CloseEvent extends Event {
    code: number;
    reason: string;
    wasClean: boolean;
    constructor(type: string, init?: { code?: number; reason?: string }) {
      super(type);
      this.code = init?.code || 1000;
      this.reason = init?.reason || '';
      this.wasClean = this.code === 1000;
    }
  };
}

if (typeof ErrorEvent === 'undefined') {
  (global as any).ErrorEvent = class ErrorEvent extends Event {
    error: any;
    message: string;
    constructor(type: string, init?: { error?: any; message?: string }) {
      super(type);
      this.error = init?.error;
      this.message = init?.message || '';
    }
  };
}