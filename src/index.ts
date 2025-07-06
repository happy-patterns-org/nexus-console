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

// UI
export { default as TerminalUI } from './ui/TerminalUI';

// Transport
export { default as TerminalWebSocketManager } from './transport/TerminalWebSocket';

// File System
export { default as FileSystemProvider } from './filesystem/FileSystemProvider';

// Security
export { default as CommandSanitizer } from './security/CommandSanitizer';

// Cache
export { default as CacheManager } from './cache/CacheManager';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Factory function for convenience
export function createTerminal(config?: NexusConsoleConfig) {
  return new NexusConsole(config);
}