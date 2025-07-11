/**
 * Performance configuration and standards for Nexus Console
 * Based on web performance best practices and terminal-specific requirements
 */

export interface PerformanceConfig {
  // Enable/disable performance monitoring
  enabled: boolean;
  
  // Sampling rates (0-1)
  sampling: {
    frames: number;      // Frame tracking sampling
    memory: number;      // Memory measurement sampling
    network: number;     // Network metrics sampling
  };
  
  // Performance budgets
  budgets: {
    // Core Web Vitals aligned
    fcp: number;         // First Contentful Paint (ms)
    lcp: number;         // Largest Contentful Paint (ms)
    fid: number;         // First Input Delay (ms)
    cls: number;         // Cumulative Layout Shift
    
    // Terminal-specific budgets
    terminalRender: number;     // Terminal render time (ms)
    scrollLatency: number;      // Scroll response time (ms)
    inputLatency: number;       // Keystroke to display (ms)
    wsRoundTrip: number;        // WebSocket round trip (ms)
    
    // Resource budgets
    memoryLimit: number;        // Memory usage limit (MB)
    bufferSize: number;         // Terminal buffer lines
    domNodes: number;           // Maximum DOM nodes
  };
  
  // Reporting configuration
  reporting: {
    interval: number;           // Reporting interval (ms)
    endpoint?: string;          // Telemetry endpoint
    includeMetrics: string[];   // Metrics to include
    excludeMetrics: string[];   // Metrics to exclude
  };
  
  // Alert thresholds
  alerts: {
    enabled: boolean;
    thresholds: {
      fps: number;              // Minimum acceptable FPS
      memory: number;           // Memory warning threshold (MB)
      errors: number;           // Error rate threshold
    };
  };
}

// Default performance configuration
export const defaultPerformanceConfig: PerformanceConfig = {
  enabled: true,
  
  sampling: {
    frames: 0.1,      // Sample 10% of frames
    memory: 0.05,     // Sample memory 5% of the time
    network: 0.2      // Sample 20% of network requests
  },
  
  budgets: {
    // Core Web Vitals
    fcp: 1800,        // 1.8s First Contentful Paint
    lcp: 2500,        // 2.5s Largest Contentful Paint
    fid: 100,         // 100ms First Input Delay
    cls: 0.1,         // 0.1 Cumulative Layout Shift
    
    // Terminal-specific
    terminalRender: 16,       // 16ms for 60fps
    scrollLatency: 50,        // 50ms scroll response
    inputLatency: 50,         // 50ms input latency
    wsRoundTrip: 100,         // 100ms WebSocket RTT
    
    // Resources
    memoryLimit: 100,         // 100MB memory limit
    bufferSize: 10000,        // 10k lines buffer
    domNodes: 5000            // 5k DOM nodes max
  },
  
  reporting: {
    interval: 30000,          // Report every 30 seconds
    includeMetrics: ['*'],    // Include all metrics by default
    excludeMetrics: []        // No exclusions
  },
  
  alerts: {
    enabled: true,
    thresholds: {
      fps: 30,                // Alert if FPS drops below 30
      memory: 80,             // Alert at 80MB memory usage
      errors: 10              // Alert at 10 errors per minute
    }
  }
};

// Development configuration (more lenient)
export const developmentPerformanceConfig: PerformanceConfig = {
  ...defaultPerformanceConfig,
  
  budgets: {
    ...defaultPerformanceConfig.budgets,
    terminalRender: 33,       // 30fps acceptable in dev
    inputLatency: 100,        // 100ms input latency
    memoryLimit: 200          // 200MB in development
  },
  
  alerts: {
    enabled: false,           // Disable alerts in development
    thresholds: {
      fps: 15,
      memory: 150,
      errors: 50
    }
  }
};

// Production configuration (strict)
export const productionPerformanceConfig: PerformanceConfig = {
  ...defaultPerformanceConfig,
  
  sampling: {
    frames: 0.01,             // Sample 1% in production
    memory: 0.01,
    network: 0.05
  },
  
  budgets: {
    ...defaultPerformanceConfig.budgets,
    terminalRender: 10,       // Strict 10ms render budget
    inputLatency: 30,         // 30ms input latency
    memoryLimit: 50           // 50MB memory limit
  },
  
  alerts: {
    enabled: true,
    thresholds: {
      fps: 45,                // Alert if below 45fps
      memory: 40,             // Alert at 40MB
      errors: 5               // Alert at 5 errors per minute
    }
  }
};

// Get configuration based on environment
export function getPerformanceConfig(): PerformanceConfig {
  const env = process.env.NODE_ENV || 'development';
  
  switch (env) {
    case 'production':
      return productionPerformanceConfig;
    case 'development':
      return developmentPerformanceConfig;
    default:
      return defaultPerformanceConfig;
  }
}

// Performance marks and measures
export const PERFORMANCE_MARKS = {
  // Terminal lifecycle
  TERMINAL_INIT_START: 'terminal-init-start',
  TERMINAL_INIT_END: 'terminal-init-end',
  TERMINAL_READY: 'terminal-ready',
  
  // Rendering
  RENDER_START: 'render-start',
  RENDER_END: 'render-end',
  PAINT_START: 'paint-start',
  PAINT_END: 'paint-end',
  
  // WebSocket
  WS_CONNECT_START: 'ws-connect-start',
  WS_CONNECT_END: 'ws-connect-end',
  WS_MESSAGE_SENT: 'ws-message-sent',
  WS_MESSAGE_RECEIVED: 'ws-message-received',
  
  // User interaction
  INPUT_START: 'input-start',
  INPUT_PROCESSED: 'input-processed',
  COMMAND_START: 'command-start',
  COMMAND_END: 'command-end'
} as const;

// Performance measure names
export const PERFORMANCE_MEASURES = {
  TERMINAL_INIT: 'terminal-initialization',
  RENDER_CYCLE: 'render-cycle',
  PAINT_CYCLE: 'paint-cycle',
  WS_CONNECT: 'websocket-connection',
  WS_ROUNDTRIP: 'websocket-roundtrip',
  INPUT_LATENCY: 'input-latency',
  COMMAND_EXECUTION: 'command-execution'
} as const;