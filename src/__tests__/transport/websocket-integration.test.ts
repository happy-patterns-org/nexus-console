/**
 * WebSocket Integration Tests
 * Tests real WebSocket communication scenarios
 */

import { WebSocket, WebSocketServer } from 'ws';
import { createServer } from 'http';
import TerminalWebSocketConfigured from '../../transport/TerminalWebSocketConfigured';
import type { ConsoleMessage, PTYMessage } from '@business-org/shared-config-ts/console-types';

describe('WebSocket Integration', () => {
  let server: any;
  let wss: WebSocketServer;
  let serverUrl: string;
  let manager: TerminalWebSocketConfigured;
  const port = 8765;

  beforeEach((done) => {
    // Create test server
    server = createServer();
    wss = new WebSocketServer({ server });
    
    // Handle WebSocket connections
    wss.on('connection', (ws) => {
      ws.on('message', (data) => {
        const message = JSON.parse(data.toString()) as ConsoleMessage;
        
        // Echo back with response based on message type
        switch (message.type) {
          case 'session_create':
            ws.send(JSON.stringify({
              type: 'session_created',
              sessionId: 'test-session-123',
              timestamp: Date.now()
            }));
            break;
            
          case 'pty_input':
            const ptyMessage = message as PTYMessage;
            ws.send(JSON.stringify({
              type: 'pty_output',
              sessionId: ptyMessage.sessionId,
              data: `echo: ${ptyMessage.data}`,
              timestamp: Date.now()
            }));
            break;
            
          case 'command':
            ws.send(JSON.stringify({
              type: 'command_result',
              sessionId: message.sessionId,
              success: true,
              output: 'Command executed',
              timestamp: Date.now()
            }));
            break;
            
          case 'ping':
            ws.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
            break;
        }
      });
      
      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        version: '1.0.0',
        timestamp: Date.now()
      }));
    });
    
    server.listen(port, () => {
      serverUrl = `ws://localhost:${port}`;
      done();
    });
  });

  afterEach((done) => {
    if (manager) {
      manager.disconnect();
    }
    
    wss.close(() => {
      server.close(done);
    });
  });

  describe('Connection Management', () => {
    test('should establish connection with retry', async () => {
      manager = new TerminalWebSocketConfigured(serverUrl, {
        maxReconnectAttempts: 3,
        reconnectDelay: 100
      });
      
      const connectPromise = new Promise<void>((resolve) => {
        manager.on('connected', resolve);
      });
      
      await manager.connect();
      await connectPromise;
      
      expect(manager.isConnected()).toBe(true);
    });

    test('should handle connection failure and retry', async () => {
      const badUrl = 'ws://localhost:9999'; // Non-existent server
      manager = new TerminalWebSocketConfigured(badUrl, {
        maxReconnectAttempts: 2,
        reconnectDelay: 50
      });
      
      let errorCount = 0;
      manager.on('error', () => {
        errorCount++;
      });
      
      try {
        await manager.connect();
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      // Wait for retries
      await new Promise(resolve => setTimeout(resolve, 200));
      
      expect(errorCount).toBeGreaterThanOrEqual(2);
      expect(manager.isConnected()).toBe(false);
    });

    test('should reconnect after disconnect', async () => {
      manager = new TerminalWebSocketConfigured(serverUrl, {
        maxReconnectAttempts: 3,
        reconnectDelay: 50
      });
      
      await manager.connect();
      expect(manager.isConnected()).toBe(true);
      
      // Force disconnect
      const clients = Array.from(wss.clients);
      clients[0].close();
      
      // Wait for reconnection
      const reconnectPromise = new Promise<void>((resolve) => {
        manager.on('reconnected', resolve);
      });
      
      await reconnectPromise;
      expect(manager.isConnected()).toBe(true);
    });
  });

  describe('Message Exchange', () => {
    beforeEach(async () => {
      manager = new TerminalWebSocketConfigured(serverUrl);
      await manager.connect();
    });

    test('should create session and receive session ID', async () => {
      const sessionPromise = new Promise<string>((resolve) => {
        manager.on('session_created', ({ sessionId }) => {
          resolve(sessionId);
        });
      });
      
      manager.createSession();
      const sessionId = await sessionPromise;
      
      expect(sessionId).toBe('test-session-123');
    });

    test('should send PTY input and receive output', async () => {
      const outputPromise = new Promise<string>((resolve) => {
        manager.on('pty_output', (message) => {
          resolve(message.data);
        });
      });
      
      manager.sendMessage({
        type: 'pty_input',
        sessionId: 'test-session',
        data: 'hello'
      });
      
      const output = await outputPromise;
      expect(output).toBe('echo: hello');
    });

    test('should handle command execution', async () => {
      const resultPromise = new Promise<any>((resolve) => {
        manager.on('command_result', resolve);
      });
      
      manager.sendMessage({
        type: 'command',
        sessionId: 'test-session',
        command: 'test-command',
        args: []
      });
      
      const result = await resultPromise;
      expect(result.success).toBe(true);
      expect(result.output).toBe('Command executed');
    });

    test('should handle ping/pong for keepalive', async () => {
      const pongPromise = new Promise<void>((resolve) => {
        manager.on('pong', resolve);
      });
      
      manager.sendMessage({ type: 'ping' });
      await pongPromise;
      
      // Test passed if pong received
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      manager = new TerminalWebSocketConfigured(serverUrl);
      await manager.connect();
    });

    test('should handle malformed messages', async () => {
      const errorPromise = new Promise<Error>((resolve) => {
        manager.on('error', resolve);
      });
      
      // Send malformed data directly through WebSocket
      const ws = (manager as any).ws;
      ws.send('invalid json');
      
      // Server will close connection on invalid JSON
      const error = await errorPromise;
      expect(error).toBeDefined();
    });

    test('should handle server errors', async () => {
      // Modify server to send error
      wss.on('connection', (ws) => {
        ws.send(JSON.stringify({
          type: 'error',
          code: 'SESSION_LIMIT',
          message: 'Session limit exceeded',
          timestamp: Date.now()
        }));
      });
      
      const errorPromise = new Promise<any>((resolve) => {
        manager.on('error', (error) => {
          if (error.code === 'SESSION_LIMIT') {
            resolve(error);
          }
        });
      });
      
      // Trigger reconnection to get new error
      manager.disconnect();
      await manager.connect();
      
      const error = await errorPromise;
      expect(error.code).toBe('SESSION_LIMIT');
      expect(error.message).toBe('Session limit exceeded');
    });
  });

  describe('Security', () => {
    test('should include authentication headers', async () => {
      let authHeader: string | undefined;
      
      wss.on('connection', (ws, req) => {
        authHeader = req.headers.authorization;
      });
      
      manager = new TerminalWebSocketConfigured(serverUrl, {
        headers: {
          'Authorization': 'Bearer test-token'
        }
      });
      
      await manager.connect();
      
      expect(authHeader).toBe('Bearer test-token');
    });

    test('should reject unauthorized connections', async () => {
      // Modify server to check auth
      const authWss = new WebSocketServer({
        server,
        verifyClient: (info) => {
          const auth = info.req.headers.authorization;
          return auth === 'Bearer valid-token';
        }
      });
      
      // Try with invalid token
      manager = new TerminalWebSocketConfigured(serverUrl, {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      });
      
      try {
        await manager.connect();
        fail('Should have rejected connection');
      } catch (error) {
        expect(error).toBeDefined();
      }
      
      authWss.close();
    });

    test('should validate message types', async () => {
      manager = new TerminalWebSocketConfigured(serverUrl);
      await manager.connect();
      
      const errorPromise = new Promise<Error>((resolve) => {
        manager.on('error', resolve);
      });
      
      // Try to send invalid message type
      try {
        manager.sendMessage({
          type: 'invalid_type' as any,
          sessionId: 'test'
        });
      } catch (error) {
        expect(error).toBeDefined();
        expect((error as Error).message).toContain('Invalid message type');
      }
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      manager = new TerminalWebSocketConfigured(serverUrl, {
        messageQueueSize: 100
      });
      await manager.connect();
    });

    test('should handle high message volume', async () => {
      const messageCount = 1000;
      const received: string[] = [];
      
      manager.on('pty_output', (message) => {
        received.push(message.data);
      });
      
      // Send many messages rapidly
      for (let i = 0; i < messageCount; i++) {
        manager.sendMessage({
          type: 'pty_input',
          sessionId: 'test-session',
          data: `msg-${i}`
        });
      }
      
      // Wait for all responses
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      expect(received.length).toBeGreaterThan(900); // Allow some loss
      expect(received[0]).toBe('echo: msg-0');
    });

    test('should queue messages when disconnected', async () => {
      const ws = (manager as any).ws;
      ws.close();
      
      // Queue messages while disconnected
      for (let i = 0; i < 10; i++) {
        manager.sendMessage({
          type: 'pty_input',
          sessionId: 'test-session',
          data: `queued-${i}`
        });
      }
      
      // Wait for reconnection and flush
      const outputs: string[] = [];
      manager.on('pty_output', (message) => {
        outputs.push(message.data);
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      expect(outputs.length).toBeGreaterThan(0);
      expect(outputs[0]).toContain('queued');
    });
  });
});
