/**
 * React component types and interfaces for Nexus Console integration
 */

export interface LogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: Record<string, any>;
}

export interface AgentStatus {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'error' | 'stopped';
  lastActivity?: number;
  metrics?: {
    cpu?: number;
    memory?: number;
    uptime?: number;
  };
}

export interface NexusConsoleAPI {
  // Incoming messages from parent
  setProject: (projectId: string) => void;
  streamLogs: (logs: LogEntry[]) => void;
  updateAgentStatus: (status: AgentStatus) => void;
  
  // Outgoing messages to parent
  onCommand: (callback: (cmd: string) => void) => void;
  onResize: (callback: (height: number) => void) => void;
  onError: (callback: (error: Error) => void) => void;
}

export interface NexusConsoleProps {
  // Required props
  projectId: string;
  
  // Layout props
  height?: number;
  width?: string | number;
  minHeight?: number;
  maxHeight?: number;
  
  // Theme props
  theme?: 'light' | 'dark' | 'auto';
  fontFamily?: string;
  fontSize?: number;
  
  // Security props
  securityLevel?: 'strict' | 'standard' | 'permissive';
  allowedCommands?: string[];
  blockedCommands?: string[];
  
  // Authentication
  authToken?: string;
  apiEndpoint?: string;
  
  // Event handlers
  onCommand?: (command: string) => void;
  onResize?: (height: number) => void;
  onError?: (error: Error) => void;
  onReady?: () => void;
  
  // Performance options
  virtualScrolling?: boolean;
  maxLogEntries?: number;
  debounceDelay?: number;
  
  // Additional options
  className?: string;
  style?: React.CSSProperties;
  autoConnect?: boolean;
  showWelcomeMessage?: boolean;
}

export interface NexusConsoleTheme {
  background: string;
  foreground: string;
  cursor: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}