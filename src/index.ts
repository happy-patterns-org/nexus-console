/**
 * Nexus Console - Main Entry Point
 * A sophisticated browser-based terminal with modular architecture
 */

// Core
export { default as TerminalState } from './core/TerminalState';
export { default as TerminalRenderer } from './core/TerminalRenderer';

// Transport
export { default as TerminalWebSocketManager } from './transport/TerminalWebSocket';

// File System
export { default as FileSystemProvider } from './filesystem/FileSystemProvider';

// Security
export { default as CommandSanitizer } from './security/CommandSanitizer';

// Cache
export { default as CacheManager } from './cache/CacheManager';

// TODO: Export these once migrated
// export { default as NexusConsole } from './core/NexusConsole';
// export { default as TerminalUI } from './ui/TerminalUI';

// Types
export * from './types';

// Version
export const VERSION = '1.0.0';

// Factory function - TODO: Enable once NexusConsole is migrated
// export function createTerminal(config?: any) {
//   const NexusConsole = require('./core/NexusConsole').default;
//   return new NexusConsole(config);
// }