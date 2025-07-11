/**
 * Nexus Console - Main Entry Point
 * A sophisticated browser-based terminal with modular architecture
 */

import NexusConsole from './core/NexusConsole';
import { startGlobalBroadcastMonitor } from './monitoring/broadcast-monitor';
import type { NexusConsoleConfig } from './types';

// Start broadcast monitor in development mode
if (process.env.NODE_ENV !== 'production') {
  startGlobalBroadcastMonitor({
    checkIntervalMs: 30000, // Check every 30 seconds
    onBreakingChange: (broadcast) => {
      // In development, log but don't exit
      console.error('⚠️  Breaking change detected in shared-config!');
      console.error('Consider pausing development and checking for updates.');
      // In a real application, you might want to show a notification to the user
    }
  });
}

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
export { 
  ContentSecurityPolicy,
  defaultCSP,
  getWebSocketCSP,
  getDevelopmentCSP
} from './security/ContentSecurityPolicy';
export type { 
  CSPDirectives, 
  SecurityHeadersConfig 
} from './security/ContentSecurityPolicy';

// Cache
export { default as CacheManager } from './cache/CacheManager';

// Monitoring
export { 
  BroadcastMonitor,
  getGlobalBroadcastMonitor,
  startGlobalBroadcastMonitor,
  stopGlobalBroadcastMonitor
} from './monitoring/broadcast-monitor';

// Bridge
export { getBridgeClient, destroyBridgeClient } from './bridge/BridgeClientEnhanced';
export { default as BridgeClient } from './bridge/BridgeClientEnhanced';
export { MetricsCollector } from './bridge/MetricsCollector';
export type { BridgeConfig, TerminalEndpoint, SessionMetrics, BridgeStatus } from './bridge/BridgeClient';

// Performance
export { PerformanceMonitor, performanceMonitor } from './performance/PerformanceMonitor';
export { usePerformance, useRenderPerformance } from './hooks/usePerformance';
export { PerformanceDashboard } from './components/PerformanceDashboard';
export { 
  getPerformanceConfig,
  defaultPerformanceConfig,
  PERFORMANCE_MARKS,
  PERFORMANCE_MEASURES
} from './performance/performanceConfig';
export type { PerformanceMetrics, PerformanceBudget } from './performance/PerformanceMonitor';
export type { PerformanceConfig } from './performance/performanceConfig';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Factory function for convenience
export function createTerminal(config?: NexusConsoleConfig) {
  return new NexusConsole(config);
}

// React components
export { NexusConsoleConfigured as NexusConsoleComponent } from './react/NexusConsoleConfigured';
export { NexusConsole as NexusConsoleReact } from './react/NexusConsole';
export { useNexusConsoleAPI } from './react/NexusConsole';
export { VirtualScroller } from './react/VirtualScroller';
export type { 
  NexusConsoleProps, 
  NexusConsoleAPI, 
  LogEntry, 
  AgentStatus,
  NexusConsoleTheme 
} from './react/types';
export type { NexusConsoleConfiguredProps } from './react/NexusConsoleConfigured';