import { describe, it, expect } from 'vitest';
import { 
  API_PATHS, 
  CONSOLE_CONFIG,
  getConsoleHost,
  getConsoleWSUrl,
  getConsoleApiUrl,
  getBridgeHost,
  getBridgeApiUrl
} from '@business-org/shared-config-ts';
import {
  WSAgentStatusMessage,
  ConsoleMessage,
  PTYMessage,
  TerminalSession
} from '@business-org/shared-config-ts/console-types';

describe('Shared Config Integration', () => {
  describe('API Paths', () => {
    it('should use correct API paths', () => {
      expect(API_PATHS.health).toBe('/api/health');
      expect(API_PATHS.projects).toBe('/api/projects');
      expect(API_PATHS.terminal.auth).toBe('/api/terminal/auth');
      expect(API_PATHS.terminal.execute).toBe('/api/terminal/execute');
    });

    it('should generate correct project-specific paths', () => {
      const projectId = 'test-project';
      const path = API_PATHS.PROJECT_BY_ID(projectId);
      expect(path).toBe(`/api/projects/${projectId}`);
    });

    it('should have correct WebSocket paths', () => {
      expect(API_PATHS.ws.terminal).toBe('/ws/terminal');
      expect(API_PATHS.ws.projects).toBe('/ws/projects');
    });
  });

  describe('Console Configuration', () => {
    it('should have required console config values', () => {
      expect(CONSOLE_CONFIG.defaultHeight).toBeDefined();
      expect(CONSOLE_CONFIG.minHeight).toBeDefined();
      expect(CONSOLE_CONFIG.maxHeight).toBeDefined();
      expect(CONSOLE_CONFIG.fontFamily).toBeDefined();
      expect(CONSOLE_CONFIG.fontSize).toBeDefined();
      expect(CONSOLE_CONFIG.maxBufferSize).toBeDefined();
      expect(CONSOLE_CONFIG.reconnectInterval).toBeDefined();
      expect(CONSOLE_CONFIG.maxReconnectAttempts).toBeDefined();
      expect(CONSOLE_CONFIG.heartbeatInterval).toBeDefined();
    });
  });

  describe('URL Builders', () => {
    it('should build correct console URLs', () => {
      // These will use environment variables or defaults
      const consoleHost = getConsoleHost();
      expect(consoleHost).toMatch(/^https?:\/\//);
      
      const wsUrl = getConsoleWSUrl();
      expect(wsUrl).toMatch(/^wss?:\/\//);
      
      const apiUrl = getConsoleApiUrl('/test');
      expect(apiUrl).toMatch(/^https?:\/\/.*\/test$/);
    });

    it('should build correct bridge URLs', () => {
      const bridgeHost = getBridgeHost();
      expect(bridgeHost).toMatch(/^https?:\/\//);
      
      const bridgeApiUrl = getBridgeApiUrl('/test');
      expect(bridgeApiUrl).toMatch(/^https?:\/\/.*\/test$/);
    });
  });

  describe('WebSocket Messages', () => {
    it('should handle WSAgentStatusMessage with data property', () => {
      const message: WSAgentStatusMessage = {
        type: 'agent_status_update',
        timestamp: new Date().toISOString(),
        data: {
          agentId: 'test-agent',
          status: { 
            status: 'running',
            lastUpdate: new Date().toISOString()
          }
        }
      };
      
      // The message now has the data property built-in
      expect(message.data.agentId).toBe('test-agent');
      expect(message.data.status?.status).toBe('running');
    });

    it('should handle full agent status message', () => {
      const message: WSAgentStatusMessage = {
        type: 'agent_status_full',
        timestamp: new Date().toISOString(),
        data: {
          agents: {
            'agent-1': { status: 'running', lastUpdate: new Date().toISOString() },
            'agent-2': { status: 'stopped', lastUpdate: new Date().toISOString() }
          }
        }
      };
      
      expect(message.data.agents).toBeDefined();
      expect(Object.keys(message.data.agents!)).toHaveLength(2);
    });
  });

  describe('Console-specific Types', () => {
    it('should create valid ConsoleMessage', () => {
      const message: ConsoleMessage = {
        type: 'terminal_output',
        sessionId: 'test-session',
        data: { output: 'Hello World' }
      };
      
      expect(message.type).toBe('terminal_output');
      expect(message.sessionId).toBe('test-session');
      expect(message.data).toBeDefined();
    });

    it('should create valid PTYMessage', () => {
      const message: PTYMessage = {
        type: 'pty_output',
        sessionId: 'test-session',
        data: [72, 101, 108, 108, 111] // "Hello" in ASCII
      };
      
      expect(message.type).toBe('pty_output');
      expect(message.sessionId).toBe('test-session');
      expect(message.data).toBeInstanceOf(Array);
    });

    it('should create valid TerminalSession', () => {
      const session: TerminalSession = {
        id: 'test-session',
        projectId: 'test-project',
        cols: 80,
        rows: 24,
        cwd: '/home/user',
        env: { PATH: '/usr/bin:/bin' }
      };
      
      expect(session.id).toBe('test-session');
      expect(session.projectId).toBe('test-project');
      expect(session.cols).toBe(80);
      expect(session.rows).toBe(24);
      expect(session.cwd).toBe('/home/user');
      expect(session.env?.PATH).toBe('/usr/bin:/bin');
    });
  });
});