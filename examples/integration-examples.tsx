/**
 * Integration Examples for Nexus Console
 * Demonstrates various usage patterns for Happy Observatory
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { 
  NexusConsoleComponent,
  type NexusConsoleProps,
  type BridgeStatus 
} from '@happy-devkit/nexus-console';

// Example 1: Basic Integration with Minimal Configuration
export function BasicConsole() {
  return (
    <div style={{ height: '400px', padding: '20px' }}>
      <h2>Basic Terminal</h2>
      <NexusConsoleComponent
        projectId="my-project"
        height={300}
      />
    </div>
  );
}

// Example 2: Full-Featured Integration with Bridge
export function FullFeaturedConsole({ 
  projectId, 
  authToken 
}: { 
  projectId: string; 
  authToken: string; 
}) {
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus>({ 
    available: false 
  });
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  return (
    <div className="console-wrapper">
      <div className="console-header">
        <h3>Project: {projectId}</h3>
        <div className="status-indicators">
          <span className={`bridge-status ${bridgeStatus.available ? 'connected' : 'disconnected'}`}>
            Bridge: {bridgeStatus.available ? '🟢' : '🔴'}
          </span>
          {bridgeStatus.features && (
            <span className="features">
              Features: {bridgeStatus.features.join(', ')}
            </span>
          )}
        </div>
      </div>
      
      <NexusConsoleComponent
        // Authentication
        projectId={projectId}
        authToken={authToken}
        
        // Bridge Configuration
        enableBridge={true}
        bridgeUrl={process.env.REACT_APP_BRIDGE_URL}
        bridgeApiKey={process.env.REACT_APP_BRIDGE_API_KEY}
        enableMetrics={true}
        enableDiscovery={true}
        
        // Layout
        height={400}
        minHeight={100}
        maxHeight={800}
        
        // Theme
        theme="dark"
        fontFamily="'JetBrains Mono', 'Consolas', monospace"
        fontSize={14}
        
        // Security
        securityLevel="standard"
        
        // Event Handlers
        onBridgeStatus={setBridgeStatus}
        onCommand={(cmd) => {
          setCommandHistory(prev => [...prev, cmd]);
          console.log('Command executed:', cmd);
        }}
        onError={(error) => {
          console.error('Terminal error:', error);
          // Could show toast notification here
        }}
        onReady={() => {
          console.log('Terminal ready');
        }}
        
        // Performance
        virtualScrolling={true}
        maxLogEntries={10000}
      />
      
      <div className="command-history">
        <h4>Recent Commands</h4>
        <ul>
          {commandHistory.slice(-5).map((cmd, i) => (
            <li key={i}>{cmd}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// Example 3: Responsive Collapsible Console
export function CollapsibleConsole({ projectId }: { projectId: string }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentHeight, setCurrentHeight] = useState(200);

  return (
    <div className="collapsible-console">
      <div className="console-controls">
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="collapse-button"
        >
          {isCollapsed ? '▲ Expand' : '▼ Collapse'} Terminal
        </button>
        <span className="height-indicator">
          Height: {isCollapsed ? 40 : currentHeight}px
        </span>
      </div>
      
      <div className={`console-container ${isCollapsed ? 'collapsed' : ''}`}>
        <NexusConsoleComponent
          projectId={projectId}
          height={isCollapsed ? 40 : currentHeight}
          onResize={(height) => {
            if (!isCollapsed) {
              setCurrentHeight(height);
            }
          }}
          showWelcomeMessage={!isCollapsed}
        />
      </div>
    </div>
  );
}

// Example 4: Multi-Project Console Switcher
export function MultiProjectConsole({ 
  projects 
}: { 
  projects: Array<{ id: string; name: string; token: string }> 
}) {
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id);
  const activeProject = projects.find(p => p.id === activeProjectId);

  return (
    <div className="multi-project-console">
      <div className="project-selector">
        <label>Active Project:</label>
        <select 
          value={activeProjectId} 
          onChange={(e) => setActiveProjectId(e.target.value)}
        >
          {projects.map(project => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </div>
      
      {activeProject && (
        <NexusConsoleComponent
          key={activeProjectId} // Force remount on project change
          projectId={activeProjectId}
          authToken={activeProject.token}
          height={400}
          showWelcomeMessage={true}
        />
      )}
    </div>
  );
}

// Example 5: Console with Custom Theme
export function ThemedConsole({ 
  projectId, 
  isDarkMode 
}: { 
  projectId: string; 
  isDarkMode: boolean; 
}) {
  return (
    <div className={`themed-console ${isDarkMode ? 'dark' : 'light'}`}>
      <NexusConsoleComponent
        projectId={projectId}
        theme={isDarkMode ? 'dark' : 'light'}
        height={350}
        // Custom styling that matches your app
        className="custom-terminal"
        style={{
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          border: '1px solid #e5e7eb'
        }}
      />
    </div>
  );
}

// Example 6: Lazy-Loaded Console
const LazyNexusConsole = lazy(() => 
  import('@happy-devkit/nexus-console').then(module => ({
    default: module.NexusConsoleComponent
  }))
);

export function LazyLoadedConsole({ projectId }: { projectId: string }) {
  const [showConsole, setShowConsole] = useState(false);

  return (
    <div className="lazy-console">
      {!showConsole ? (
        <button 
          onClick={() => setShowConsole(true)}
          className="load-console-button"
        >
          Load Terminal
        </button>
      ) : (
        <Suspense 
          fallback={
            <div className="console-loader">
              <div className="spinner" />
              <p>Loading terminal...</p>
            </div>
          }
        >
          <LazyNexusConsole
            projectId={projectId}
            height={400}
            onReady={() => console.log('Lazy console loaded')}
          />
        </Suspense>
      )}
    </div>
  );
}

// Example 7: Console with Metrics Dashboard
export function ConsoleWithMetrics({ projectId }: { projectId: string }) {
  const [metrics, setMetrics] = useState({
    commands: 0,
    bytes: 0,
    errors: 0,
    avgLatency: 0
  });

  useEffect(() => {
    // In a real app, you might fetch these from your backend
    const interval = setInterval(() => {
      // Simulate metrics update
      setMetrics(prev => ({
        ...prev,
        commands: prev.commands + Math.floor(Math.random() * 3)
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="console-with-metrics">
      <div className="metrics-bar">
        <div className="metric">
          <span className="label">Commands:</span>
          <span className="value">{metrics.commands}</span>
        </div>
        <div className="metric">
          <span className="label">Data:</span>
          <span className="value">{(metrics.bytes / 1024).toFixed(2)} KB</span>
        </div>
        <div className="metric">
          <span className="label">Errors:</span>
          <span className="value">{metrics.errors}</span>
        </div>
        <div className="metric">
          <span className="label">Latency:</span>
          <span className="value">{metrics.avgLatency.toFixed(1)} ms</span>
        </div>
      </div>
      
      <NexusConsoleComponent
        projectId={projectId}
        height={350}
        enableBridge={true}
        enableMetrics={true}
        onCommand={() => {
          setMetrics(prev => ({ ...prev, commands: prev.commands + 1 }));
        }}
        onError={() => {
          setMetrics(prev => ({ ...prev, errors: prev.errors + 1 }));
        }}
      />
    </div>
  );
}

// Example 8: Console with Security Levels
export function SecureConsole({ 
  projectId, 
  userRole 
}: { 
  projectId: string; 
  userRole: 'admin' | 'developer' | 'viewer'; 
}) {
  // Map user roles to security levels
  const securityLevel = {
    admin: 'permissive',
    developer: 'standard',
    viewer: 'strict'
  }[userRole] as 'permissive' | 'standard' | 'strict';

  // Define allowed commands based on role
  const allowedCommands = {
    admin: undefined, // All commands allowed
    developer: ['ls', 'cd', 'cat', 'grep', 'npm', 'yarn', 'git'],
    viewer: ['ls', 'cat', 'pwd']
  }[userRole];

  return (
    <div className="secure-console">
      <div className="security-info">
        <span>Role: {userRole}</span>
        <span>Security: {securityLevel}</span>
      </div>
      
      <NexusConsoleComponent
        projectId={projectId}
        height={400}
        securityLevel={securityLevel}
        allowedCommands={allowedCommands}
        onCommand={(cmd) => {
          // Additional client-side validation if needed
          console.log(`${userRole} executed:`, cmd);
        }}
      />
    </div>
  );
}

// Example 9: Console with Custom Bridge Implementation
export function CustomBridgeConsole({ projectId }: { projectId: string }) {
  const [customMetrics, setCustomMetrics] = useState<any>(null);

  return (
    <NexusConsoleComponent
      projectId={projectId}
      height={400}
      
      // Custom Bridge configuration
      enableBridge={true}
      bridgeUrl="https://custom-bridge.example.com/api"
      bridgeApiKey={process.env.REACT_APP_CUSTOM_BRIDGE_KEY}
      
      // Handle Bridge status changes
      onBridgeStatus={(status) => {
        if (status.available) {
          console.log('Connected to custom Bridge with features:', status.features);
        }
      }}
      
      // Custom metrics handling
      onCommand={async (cmd) => {
        // Send custom metrics to your own analytics
        try {
          await fetch('/api/analytics/terminal', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              event: 'terminal_command',
              properties: {
                command: cmd,
                projectId,
                timestamp: Date.now()
              }
            })
          });
        } catch (error) {
          console.error('Failed to send analytics:', error);
        }
      }}
    />
  );
}

// Example 10: Testing Console Integration
export function TestableConsole({ 
  projectId,
  onCommandExecuted 
}: { 
  projectId: string;
  onCommandExecuted?: (cmd: string) => void;
}) {
  return (
    <div data-testid="terminal-container">
      <NexusConsoleComponent
        projectId={projectId}
        height={400}
        
        // Make it testable
        className="test-console"
        
        // Expose events for testing
        onReady={() => {
          console.log('Terminal ready for testing');
          // Could dispatch custom event for e2e tests
          window.dispatchEvent(new CustomEvent('terminal:ready'));
        }}
        
        onCommand={(cmd) => {
          console.log('Test command:', cmd);
          onCommandExecuted?.(cmd);
          
          // Dispatch event for e2e tests
          window.dispatchEvent(new CustomEvent('terminal:command', { 
            detail: { command: cmd } 
          }));
        }}
        
        onError={(error) => {
          console.error('Test error:', error);
          window.dispatchEvent(new CustomEvent('terminal:error', { 
            detail: { error: error.message } 
          }));
        }}
      />
    </div>
  );
}