/**
 * Nexus Console - Main Entry Point
 * A sophisticated browser-based terminal with modular architecture
 */

import NexusConsole from './core/NexusConsole';
import type { NexusConsoleConfig } from './types';

// Core
export { default as TerminalState } from './core/TerminalState';
export { default as TerminalRenderer } from './core/TerminalRenderer';
export { NexusConsole };
export { default as NexusConsoleHybrid } from './core/NexusConsoleHybrid';

// UI
export { default as TerminalUI } from './ui/TerminalUI';

// Transport
export { default as TerminalWebSocketManager } from './transport/TerminalWebSocket';
export { default as TerminalWebSocketEnhanced } from './transport/TerminalWebSocketEnhanced';
export { default as TerminalWebSocketConfigured } from './transport/TerminalWebSocketConfigured';

// File System
export { default as FileSystemProvider } from './filesystem/FileSystemProvider';

// Security
export { default as CommandSanitizer } from './security/CommandSanitizer';

// Cache
export { default as CacheManager } from './cache/CacheManager';

// Bridge
export { getBridgeClient, destroyBridgeClient } from './bridge/BridgeClient';
export { MetricsCollector } from './bridge/MetricsCollector';
export type { BridgeConfig, TerminalEndpoint, SessionMetrics, BridgeStatus } from './bridge/BridgeClient';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Factory function for convenience
export function createTerminal(config?: NexusConsoleConfig) {
  return new NexusConsole(config);
}

// React components
export { NexusConsole as NexusConsoleComponent, useNexusConsoleAPI } from './react/NexusConsole';
export { NexusConsoleConfigured } from './react/NexusConsoleConfigured';
export { VirtualScroller } from './react/VirtualScroller';
export type { 
  NexusConsoleProps, 
  NexusConsoleAPI, 
  LogEntry, 
  AgentStatus,
  NexusConsoleTheme 
} from './react/types';
export type { NexusConsoleConfiguredProps } from './react/NexusConsoleConfigured';