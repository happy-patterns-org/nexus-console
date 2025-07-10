/**
 * React component wrapper for Nexus Console
 * Provides seamless integration with Happy Observatory
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import NexusConsoleHybrid from '../core/NexusConsoleHybrid';
import type { HybridConsoleConfig } from '../core/NexusConsoleHybrid';

import type { NexusConsoleProps, NexusConsoleAPI, LogEntry, AgentStatus, NexusConsoleTheme } from './types';

// Default themes
const THEMES: Record<'light' | 'dark', NexusConsoleTheme> = {
  light: {
    background: '#ffffff',
    foreground: '#1a1a1a',
    cursor: '#1a1a1a',
    selection: 'rgba(0, 0, 0, 0.1)',
    black: '#000000',
    red: '#cd3131',
    green: '#00bc00',
    yellow: '#949800',
    blue: '#0451a5',
    magenta: '#bc05bc',
    cyan: '#0598bc',
    white: '#555555',
    brightBlack: '#686868',
    brightRed: '#cd3131',
    brightGreen: '#00bc00',
    brightYellow: '#949800',
    brightBlue: '#0451a5',
    brightMagenta: '#bc05bc',
    brightCyan: '#0598bc',
    brightWhite: '#a5a5a5'
  },
  dark: {
    background: '#1e1e1e',
    foreground: '#cccccc',
    cursor: '#cccccc',
    selection: 'rgba(255, 255, 255, 0.1)',
    black: '#000000',
    red: '#cd3131',
    green: '#0dbc79',
    yellow: '#e5e510',
    blue: '#2472c8',
    magenta: '#bc3fbc',
    cyan: '#11a8cd',
    white: '#e5e5e5',
    brightBlack: '#666666',
    brightRed: '#f14c4c',
    brightGreen: '#23d18b',
    brightYellow: '#f5f543',
    brightBlue: '#3b8eea',
    brightMagenta: '#d670d6',
    brightCyan: '#29b8db',
    brightWhite: '#e5e5e5'
  }
};

export const NexusConsole: React.FC<NexusConsoleProps> = ({
  projectId,
  height = 200,
  width = '100%',
  minHeight = 40,
  maxHeight = 600,
  theme = 'dark',
  fontFamily = 'JetBrains Mono, Consolas, monospace',
  fontSize = 14,
  securityLevel = 'standard',
  allowedCommands,
  blockedCommands,
  authToken,
  apiEndpoint,
  enableBridge = true,
  bridgeUrl,
  bridgeApiKey,
  enableMetrics = true,
  enableDiscovery = true,
  onCommand,
  onResize,
  onError,
  onReady,
  onBridgeStatus,
  virtualScrolling = true,
  maxLogEntries = 10000,
  debounceDelay = 100,
  className,
  style,
  autoConnect = true,
  showWelcomeMessage = true
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<NexusConsoleHybrid | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(height);
  const [bridgeStatus, setBridgeStatus] = useState<{ available: boolean; features?: string[] }>({ available: false });
  
  // Memoize theme
  const currentTheme = useMemo(() => {
    if (theme === 'auto') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return THEMES[isDark ? 'dark' : 'light'];
    }
    return THEMES[theme];
  }, [theme]);
  
  // Memoize configuration
  const config = useMemo<HybridConsoleConfig>(() => ({
    container: null, // Will be set later
    serverUrl: apiEndpoint || window.location.origin,
    token: authToken,
    theme: currentTheme,
    fontSize,
    fontFamily,
    scrollback: maxLogEntries,
    security: {
      level: securityLevel,
      allowedCommands,
      blockedCommands
    },
    features: {
      webGL: true,
      clipboard: true,
      search: true,
      links: true,
      unicode: true
    },
    enableBridge,
    bridge: enableBridge ? {
      bridgeUrl,
      apiKey: bridgeApiKey,
      projectId,
      enableMetrics,
      enableDiscovery
    } : undefined
  }), [apiEndpoint, authToken, currentTheme, fontSize, fontFamily, maxLogEntries, securityLevel, allowedCommands, blockedCommands, enableBridge, bridgeUrl, bridgeApiKey, projectId, enableMetrics, enableDiscovery]);
  
  // API implementation
  const api = useRef<NexusConsoleAPI>({
    setProject: (newProjectId: string) => {
      if (terminalRef.current) {
        // Update project context
        terminalRef.current.executeCommand(`cd /projects/${newProjectId}`, { raw: true });
      }
    },
    
    streamLogs: (logs: LogEntry[]) => {
      if (terminalRef.current) {
        logs.forEach(log => {
          const timestamp = new Date(log.timestamp).toISOString();
          const levelColor = {
            debug: '\x1b[90m',
            info: '\x1b[37m',
            warn: '\x1b[33m',
            error: '\x1b[31m'
          }[log.level];
          const reset = '\x1b[0m';
          
          terminalRef.current.write(`${levelColor}[${timestamp}] ${log.level.toUpperCase()}: ${log.message}${reset}\r\n`);
        });
      }
    },
    
    updateAgentStatus: (status: AgentStatus) => {
      if (terminalRef.current) {
        const statusColor = {
          idle: '\x1b[90m',
          running: '\x1b[32m',
          error: '\x1b[31m',
          stopped: '\x1b[33m'
        }[status.status];
        const reset = '\x1b[0m';
        
        terminalRef.current.write(`${statusColor}Agent ${status.name}: ${status.status}${reset}\r\n`);
      }
    },
    
    onCommand: (callback: (cmd: string) => void) => {
      if (terminalRef.current) {
        terminalRef.current.on('command', callback);
      }
    },
    
    onResize: (callback: (height: number) => void) => {
      // Store callback for resize observer
      resizeCallbackRef.current = callback;
    },
    
    onError: (callback: (error: Error) => void) => {
      if (terminalRef.current) {
        terminalRef.current.on('error', callback);
      }
    }
  });
  
  const resizeCallbackRef = useRef<((height: number) => void) | null>(null);
  
  // Handle resize
  const handleResize = useCallback((newHeight: number) => {
    const clampedHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
    setCurrentHeight(clampedHeight);
    
    if (onResize) {
      onResize(clampedHeight);
    }
    
    if (resizeCallbackRef.current) {
      resizeCallbackRef.current(clampedHeight);
    }
  }, [minHeight, maxHeight, onResize]);
  
  // Initialize terminal
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;
    
    try {
      // Create terminal instance
      const terminal = new NexusConsoleHybrid({
        ...config,
        container: containerRef.current
      });
      
      terminalRef.current = terminal;
      
      // Set up event handlers
      if (onCommand) {
        terminal.on('command', onCommand);
      }
      
      if (onError) {
        terminal.on('error', onError);
      }
      
      // Initialize terminal
      terminal.initialize().then(() => {
        setIsReady(true);
        
        if (showWelcomeMessage) {
          terminal.write('Welcome to Nexus Console\r\n');
          terminal.write(`Project: ${projectId}\r\n`);
          terminal.write('Type "help" for available commands\r\n\r\n');
        }
        
        if (autoConnect) {
          terminal.connect();
        }
        
        // Monitor Bridge status
        if (enableBridge) {
          const checkBridgeStatus = () => {
            const status = terminal.getBridgeStatus();
            setBridgeStatus(status);
            if (onBridgeStatus) {
              onBridgeStatus(status);
            }
          };
          
          // Check immediately and periodically
          checkBridgeStatus();
          const bridgeInterval = setInterval(checkBridgeStatus, 5000);
          
          // Clean up on unmount
          return () => clearInterval(bridgeInterval);
        }
        
        if (onReady) {
          onReady();
        }
      }).catch((error) => {
        console.error('Failed to initialize terminal:', error);
        if (onError) {
          onError(error);
        }
      });
      
    } catch (error) {
      console.error('Failed to create terminal:', error);
      if (onError) {
        onError(error as Error);
      }
    }
    
    return () => {
      if (terminalRef.current) {
        terminalRef.current.destroy();
        terminalRef.current = null;
      }
    };
  }, []); // Only run once on mount
  
  // Set up resize observer
  useEffect(() => {
    if (!containerRef.current) return;
    
    resizeObserverRef.current = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { height } = entry.contentRect;
        handleResize(height);
      }
    });
    
    resizeObserverRef.current.observe(containerRef.current);
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [handleResize]);
  
  // Update project when it changes
  useEffect(() => {
    if (isReady && terminalRef.current) {
      api.current.setProject(projectId);
    }
  }, [projectId, isReady]);
  
  // Container styles
  const containerStyles: React.CSSProperties = {
    height: currentHeight,
    width,
    backgroundColor: currentTheme.background,
    color: currentTheme.foreground,
    fontFamily,
    fontSize,
    overflow: 'hidden',
    position: 'relative',
    ...style
  };
  
  return (
    <div
      ref={containerRef}
      className={`nexus-console ${className || ''}`}
      style={containerStyles}
      data-testid="nexus-console"
    />
  );
};

// Export API reference hook
export const useNexusConsoleAPI = (ref: React.RefObject<HTMLDivElement>): NexusConsoleAPI | null => {
  const [api, setApi] = useState<NexusConsoleAPI | null>(null);
  
  useEffect(() => {
    if (ref.current) {
      // Access the API from the component instance
      const instance = (ref.current as any).__nexusConsoleAPI;
      if (instance) {
        setApi(instance);
      }
    }
  }, [ref]);
  
  return api;
};

export default NexusConsole;