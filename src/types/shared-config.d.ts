/**
 * Type declarations for @happy-devkit/shared-config
 * This file provides type stubs until the actual package is available
 */

declare module '@happy-devkit/shared-config' {
  // Service configuration
  export interface ServiceConfig {
    host: string;
    port: number;
    protocol: 'http' | 'https' | 'ws' | 'wss';
  }

  // API paths
  export const API_PATHS: {
    health: string;
    projects: string;
    terminal: {
      auth: string;
      execute: string;
    };
    ws: {
      terminal: string;
      projects: string;
    };
  };

  // Console configuration
  export const CONSOLE_CONFIG: {
    defaultHeight: number;
    minHeight: number;
    maxHeight: number;
    fontFamily: string;
    fontSize: number;
    maxBufferSize: number;
    reconnectInterval: number;
    maxReconnectAttempts: number;
    heartbeatInterval: number;
  };

  // Message types
  export interface ConsoleMessage {
    type: string;
    sessionId: string;
    data?: any;
  }

  export interface PTYMessage {
    type: 'pty_input' | 'pty_output';
    sessionId: string;
    data: number[];
  }

  // Theme types
  export interface ConsoleTheme {
    name: 'Dracula' | 'Solarized Light' | 'Monokai' | 'Terminal';
    colors: Record<string, string>;
  }

  // Helper functions
  export function getConsoleHost(): string;
  export function getConsoleWSUrl(path?: string): string;
  export function getConsoleApiUrl(path: string): string;
  export function getBridgeHost(): string;
  export function getBridgeApiUrl(path?: string): string;
  export function getBridgeWSUrl(projectId?: string): string;

  // Session types
  export interface TerminalSession {
    id: string;
    projectId: string;
    cols: number;
    rows: number;
    cwd?: string;
    env?: Record<string, string>;
  }

  // Agent types
  export interface AgentCommand {
    agentId: string;
    action: 'start' | 'stop' | 'restart' | 'status';
    params?: Record<string, any>;
  }
}