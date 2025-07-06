/**
 * Basic Usage Example - Nexus Console
 * Demonstrates how to create and use a terminal instance
 */

import { createTerminal, NexusConsole } from '../src';

// Option 1: Using the factory function
async function exampleWithFactory() {
  const terminal = createTerminal({
    container: document.getElementById('terminal-container'),
    theme: 'nexus-dark',
    fontSize: 14,
    wsUrl: 'ws://localhost:8080/terminal/ws',
    enableFileSystem: true,
    enableCache: true,
    securityLevel: 'standard',
  });

  // Wait for initialization
  terminal.on('initialized', () => {
    console.log('Terminal initialized successfully');
  });

  // Handle errors
  terminal.on('error', (error) => {
    console.error('Terminal error:', error);
  });

  // Create a session
  const sessionId = await terminal.createSession({
    shell: '/bin/bash',
    cwd: '/workspace',
  });

  console.log('Created session:', sessionId);
}

// Option 2: Direct instantiation
async function exampleWithClass() {
  const terminal = new NexusConsole({
    container: '#terminal-container',
    theme: 'nexus-dark',
    position: 'bottom',
    showToolbar: true,
    showTabs: true,
    showStatusBar: true,
  });

  // Initialize manually
  await terminal.initialize();

  // Listen for command execution
  terminal.on('command_executed', ({ command, sessionId }) => {
    console.log(`Command executed in session ${sessionId}: ${command}`);
  });

  // Execute a command
  await terminal.executeCommand('ls -la');

  // Request file system access
  if (terminal.config.enableFileSystem) {
    await terminal.requestFileAccess();
    
    // Read a file
    const content = await terminal.readFile('/etc/hosts');
    console.log('File content:', content);
  }
}

// Option 3: Advanced usage with multiple sessions
async function advancedExample() {
  const terminal = new NexusConsole();

  // Create multiple sessions
  const session1 = await terminal.createSession({ cwd: '/home/user' });
  const session2 = await terminal.createSession({ cwd: '/workspace' });

  // Switch between sessions
  await terminal.attachToSession(session1);
  await terminal.executeCommand('pwd');

  await terminal.attachToSession(session2);
  await terminal.executeCommand('pwd');

  // Monitor performance
  setInterval(() => {
    const metrics = terminal.getMetrics();
    console.log('Terminal metrics:', {
      sessions: metrics.sessions,
      commandCount: metrics.commandCount,
      averageLatency: metrics.averageCommandLatency,
      connected: metrics.connected,
    });
  }, 5000);

  // Handle keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === '`') {
      terminal.toggle();
    }
  });
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', exampleWithFactory);
} else {
  exampleWithFactory();
}