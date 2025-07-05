/**
 * Nexus Console - Main Entry Point
 * A sophisticated browser-based terminal with modular architecture
 */

export { default as NexusConsole } from './core/NexusConsole';
export { default as TerminalWebSocketManager } from './transport/TerminalWebSocket';
export { default as TerminalRenderer } from './core/TerminalRenderer';
export { default as TerminalState } from './core/TerminalState';
export { default as FileSystemProvider } from './filesystem/FileSystemProvider';
export { default as CommandSanitizer } from './security/CommandSanitizer';
export { default as CacheManager } from './cache/CacheManager';
export { default as TerminalUI } from './ui/TerminalUI';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Factory function
export function createTerminal(config?: any) {
  const NexusConsole = require('./core/NexusConsole').default;
  return new NexusConsole(config);
}