import { describe, it, expect } from 'vitest';
import { 
  API_PATHS,
  WS_PATHS,
  SERVICE_PORTS,
  SERVICE_HOSTS,
  SERVICE_URLS,
  getBridgeAPIUrl,
  getBridgeWSUrl
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
      expect(API_PATHS.HEALTH).toBe('/api/health');
      expect(API_PATHS.PROJECTS).toBe('/api/projects');
      expect(API_PATHS.CONSOLE_TERMINALS).toBe('/api/console/terminals');
      expect(API_PATHS.CONSOLE_COMMANDS).toBe('/api/console/commands');
    });

    it('should generate correct project-specific paths', () => {
      const projectId = 'test-project';
      const path = API_PATHS.PROJECT_BY_ID(projectId);
      expect(path).toBe(`/api/projects/${projectId}`);
    });

    it('should have correct WebSocket paths', () => {
      expect(WS_PATHS.CONSOLE).toBe('/ws/console');
      expect(WS_PATHS.ROOT).toBe('/ws');
      expect(WS_PATHS.METRICS).toBe('/ws/metrics');
    });
  });

  describe('Console Configuration', () => {
    it('should have required console config values', () => {
      // Console port should be defined
      expect(SERVICE_PORTS.CONSOLE).toBe(3001);
      expect(SERVICE_HOSTS.CONSOLE).toBeDefined();
      expect(SERVICE_URLS.CONSOLE).toBeDefined();
      
      // Console WebSocket paths
      expect(WS_PATHS.CONSOLE).toBe('/ws/console');
      
      // Console API paths
      expect(API_PATHS.CONSOLE_TERMINALS).toBeDefined();
      expect(API_PATHS.CONSOLE_COMMANDS).toBeDefined();
    });
  });

  describe('URL Builders', () => {
    it('should build correct console URLs', () => {
      // Console service URL should be defined
      expect(SERVICE_URLS.CONSOLE).toBeDefined();
      expect(SERVICE_URLS.CONSOLE).toContain(`${SERVICE_PORTS.CONSOLE}`);
      
      // Console WebSocket URL can be built manually
      const wsUrl = `ws://${SERVICE_HOSTS.CONSOLE}:${SERVICE_PORTS.CONSOLE}${WS_PATHS.CONSOLE}`;
      expect(wsUrl).toMatch(/^wss?:\/\//);
    });

    it('should build correct bridge URLs', () => {
      // Bridge service URL should be defined
      expect(SERVICE_URLS.BRIDGE_SERVER).toBeDefined();
      
      // Test the bridge URL builder function
      const bridgeApiUrl = getBridgeAPIUrl('/test');
      expect(bridgeApiUrl).toBe(`${SERVICE_URLS.BRIDGE_SERVER}/test`);
      
      // Test WebSocket URL builder
      const bridgeWsUrl = getBridgeWSUrl('/ws/test');
      expect(bridgeWsUrl).toMatch(/^wss?:\/\/.*\/ws\/test$/);
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