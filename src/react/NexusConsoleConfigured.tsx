/**
 * Nexus Console React Component with Shared Configuration
 * Uses type-safe configuration from @business-org/shared-config-ts
 */

import { 
  getConsoleHost,
  getBridgeHost,
  CONSOLE_CONFIG
} from '@business-org/shared-config-ts';
import {
  ConsoleTheme
} from '@business-org/shared-config-ts/console-types';
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';

import { getBridgeClient } from '../bridge/BridgeClientEnhanced';
import NexusConsoleHybrid from '../core/NexusConsoleHybrid';
import type { HybridConsoleConfig } from '../core/NexusConsoleHybrid';

import type { NexusConsoleProps, NexusConsoleAPI, LogEntry, AgentStatus } from './types';

// Map shared config themes to component themes
const THEME_MAP: Record<ConsoleTheme['name'], NexusConsoleProps['theme']> = {
  'Dracula': 'dark',
  'Solarized Light': 'light',
  'Monokai': 'dark',
  'Terminal': 'dark'
};

export interface NexusConsoleConfiguredProps extends Omit<NexusConsoleProps, 'apiEndpoint' | 'bridgeUrl'> {
  // Override with configuration options
  useSharedConfig?: boolean;
  customApiEndpoint?: string;
  customBridgeUrl?: string;
  consoleTheme?: ConsoleTheme['name'];
}

export const NexusConsoleConfigured: React.FC<NexusConsoleConfiguredProps> = ({
  projectId,
  height = CONSOLE_CONFIG.defaultHeight,
  width = '100%',
  minHeight = CONSOLE_CONFIG.minHeight,
  maxHeight = CONSOLE_CONFIG.maxHeight,
  theme,
  consoleTheme,
  fontFamily = CONSOLE_CONFIG.fontFamily,
  fontSize = CONSOLE_CONFIG.fontSize,
  securityLevel = 'standard',
  allowedCommands,
  blockedCommands,
  authToken,
  useSharedConfig = true,
  customApiEndpoint,
  customBridgeUrl,
  enableBridge = true,
  bridgeApiKey,
  enableMetrics = true,
  enableDiscovery = true,
  onCommand,
  onResize,
  onError,
  onReady,
  onBridgeStatus,
  virtualScrolling = true,
  maxLogEntries = CONSOLE_CONFIG.maxBufferSize,
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
  
  // Determine theme
  const effectiveTheme = useMemo(() => {
    if (theme) return theme;
    if (consoleTheme) return THEME_MAP[consoleTheme] || 'dark';
    return 'dark';
  }, [theme, consoleTheme]);
  
  // Get theme configuration
  const currentTheme = useMemo(() => {
    // In a real implementation, this would come from shared config
    // For now, use the existing theme logic
    const isDark = effectiveTheme === 'dark' || 
                   (effectiveTheme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    return isDark ? 'dark' : 'light';
  }, [effectiveTheme]);
  
  // Memoize configuration
  const config = useMemo<HybridConsoleConfig>(() => ({
    container: null, // Will be set later
    serverUrl: useSharedConfig ? getConsoleHost() : (customApiEndpoint || window.location.origin),
    token: authToken,
    theme: currentTheme as any, // Theme object would come from shared config
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
      bridgeUrl: useSharedConfig ? getBridgeHost() : customBridgeUrl,
      apiKey: bridgeApiKey,
      projectId,
      enableMetrics,
      enableDiscovery
    } : undefined
  }), [
    useSharedConfig, customApiEndpoint, authToken, currentTheme, fontSize, fontFamily, 
    maxLogEntries, securityLevel, allowedCommands, blockedCommands, enableBridge, 
    customBridgeUrl, bridgeApiKey, projectId, enableMetrics, enableDiscovery
  ]);
  
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
          if (useSharedConfig) {
            terminal.write('Using shared configuration\r\n');
          }
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
    backgroundColor: '#1e1e1e', // Would come from theme
    color: '#cccccc', // Would come from theme
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
      data-use-shared-config={useSharedConfig}
    />
  );
};

// Export the existing component as default for backwards compatibility
export { NexusConsole } from './NexusConsole';
export default NexusConsoleConfigured;