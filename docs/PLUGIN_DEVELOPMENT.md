# Nexus Console Plugin Development Guide

This guide explains how to create plugins to extend Nexus Console functionality.

## Overview

Nexus Console supports plugins that can:
- Add custom commands
- Modify terminal behavior
- Integrate external tools
- Provide UI extensions
- Add new themes
- Implement custom protocols

## Plugin Architecture

### Plugin Structure

```
my-nexus-plugin/
├── package.json
├── src/
│   ├── index.ts         # Main plugin entry
│   ├── commands.ts      # Custom commands
│   ├── ui/             # UI components
│   └── themes/         # Custom themes
├── dist/               # Compiled output
└── README.md
```

### Basic Plugin Template

```typescript
// src/index.ts
import { NexusPlugin, PluginContext } from '@happy-devkit/nexus-console';

export class MyPlugin implements NexusPlugin {
  name = 'my-plugin';
  version = '1.0.0';
  
  async activate(context: PluginContext): Promise<void> {
    console.log('MyPlugin activated!');
    
    // Register commands
    context.registerCommand('hello', this.handleHello.bind(this));
    
    // Add event listeners
    context.terminal.on('data', this.handleData.bind(this));
    
    // Register UI components
    context.ui.registerComponent('toolbar', this.ToolbarButton);
  }
  
  async deactivate(): Promise<void> {
    console.log('MyPlugin deactivated!');
    // Cleanup resources
  }
  
  private handleHello(args: string[]): void {
    this.context.terminal.write('Hello from plugin!\r\n');
  }
  
  private handleData(data: string): void {
    // Process terminal data
  }
}

// Export plugin factory
export default function createPlugin(): NexusPlugin {
  return new MyPlugin();
}
```

## Plugin API

### PluginContext

```typescript
interface PluginContext {
  // Terminal access
  terminal: Terminal;
  
  // Session management
  sessions: SessionManager;
  
  // UI extension points
  ui: UIManager;
  
  // Configuration
  config: ConfigManager;
  
  // Storage
  storage: StorageManager;
  
  // Events
  events: EventEmitter;
  
  // Commands
  commands: CommandRegistry;
  
  // Logging
  logger: Logger;
}
```

### Terminal API

```typescript
interface Terminal {
  // Write to terminal
  write(data: string): void;
  writeln(data: string): void;
  
  // Read from terminal
  read(): Promise<string>;
  readLine(): Promise<string>;
  
  // Terminal control
  clear(): void;
  reset(): void;
  
  // Cursor control
  cursorTo(x: number, y: number): void;
  cursorUp(lines: number): void;
  cursorDown(lines: number): void;
  
  // Styling
  setColor(color: string): void;
  setBgColor(color: string): void;
  setBold(bold: boolean): void;
  
  // Events
  on(event: 'data', handler: (data: string) => void): void;
  on(event: 'resize', handler: (size: { cols: number; rows: number }) => void): void;
}
```

## Command Plugins

### Creating Custom Commands

```typescript
import { Command, CommandContext } from '@happy-devkit/nexus-console';

export class GitStatusCommand implements Command {
  name = 'git-status';
  description = 'Enhanced git status with formatting';
  aliases = ['gs'];
  
  async execute(context: CommandContext, args: string[]): Promise<void> {
    const { terminal, cwd } = context;
    
    // Execute git status
    const result = await context.exec('git status --porcelain', { cwd });
    
    // Parse and format output
    const files = this.parseGitStatus(result.stdout);
    
    // Display formatted output
    terminal.writeln('\x1b[1mGit Status\x1b[0m');
    terminal.writeln('─'.repeat(40));
    
    files.forEach(file => {
      const color = this.getStatusColor(file.status);
      terminal.writeln(`${color}${file.status}\x1b[0m ${file.path}`);
    });
  }
  
  private parseGitStatus(output: string): GitFile[] {
    return output.split('\n')
      .filter(line => line.trim())
      .map(line => ({
        status: line.substring(0, 2),
        path: line.substring(3)
      }));
  }
  
  private getStatusColor(status: string): string {
    switch (status.trim()) {
      case 'M': return '\x1b[33m';  // Yellow for modified
      case 'A': return '\x1b[32m';  // Green for added
      case 'D': return '\x1b[31m';  // Red for deleted
      case '??': return '\x1b[90m'; // Gray for untracked
      default: return '';
    }
  }
}
```

### Command Registration

```typescript
export class CommandPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register single command
    context.commands.register(new GitStatusCommand());
    
    // Register command with handler
    context.commands.register('pwd-enhanced', {
      description: 'Show current directory with git info',
      execute: async (ctx) => {
        const pwd = process.cwd();
        const gitBranch = await this.getGitBranch(pwd);
        
        ctx.terminal.writeln(`\x1b[34m${pwd}\x1b[0m`);
        if (gitBranch) {
          ctx.terminal.writeln(`\x1b[32mBranch: ${gitBranch}\x1b[0m`);
        }
      }
    });
    
    // Register command with options
    context.commands.register('list-files', {
      description: 'List files with filters',
      options: [
        { name: 'all', alias: 'a', type: 'boolean', description: 'Show hidden files' },
        { name: 'long', alias: 'l', type: 'boolean', description: 'Long format' },
        { name: 'filter', alias: 'f', type: 'string', description: 'File filter' }
      ],
      execute: async (ctx, args, options) => {
        // Use parsed options
        const showHidden = options.all;
        const longFormat = options.long;
        const filter = options.filter || '*';
        
        // Implementation...
      }
    });
  }
}
```

## UI Extension Plugins

### Adding Toolbar Buttons

```typescript
import React from 'react';
import { ToolbarButton } from '@happy-devkit/nexus-console/ui';

export class UIPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register toolbar button
    context.ui.toolbar.add({
      id: 'clear-terminal',
      icon: 'trash',
      tooltip: 'Clear Terminal',
      onClick: () => {
        context.terminal.clear();
      }
    });
    
    // Register React component
    context.ui.toolbar.addComponent({
      id: 'git-branch',
      component: GitBranchIndicator,
      position: 'right'
    });
  }
}

// React component
function GitBranchIndicator({ terminal }) {
  const [branch, setBranch] = React.useState('');
  
  React.useEffect(() => {
    const updateBranch = async () => {
      const result = await terminal.exec('git branch --show-current');
      setBranch(result.stdout.trim());
    };
    
    updateBranch();
    const interval = setInterval(updateBranch, 5000);
    
    return () => clearInterval(interval);
  }, [terminal]);
  
  if (!branch) return null;
  
  return (
    <div className="git-branch-indicator">
      <span className="icon">🌿</span>
      <span className="branch-name">{branch}</span>
    </div>
  );
}
```

### Custom Panels

```typescript
export class PanelPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register side panel
    context.ui.registerPanel({
      id: 'file-explorer',
      title: 'Files',
      icon: 'folder',
      position: 'left',
      component: FileExplorerPanel,
      
      // Panel options
      defaultWidth: 250,
      minWidth: 150,
      maxWidth: 500,
      canClose: true,
      canResize: true
    });
    
    // Register bottom panel
    context.ui.registerPanel({
      id: 'problems',
      title: 'Problems',
      icon: 'warning',
      position: 'bottom',
      component: ProblemsPanel,
      defaultHeight: 200
    });
  }
}
```

## Theme Plugins

### Creating Custom Themes

```typescript
import { Theme } from '@happy-devkit/nexus-console';

export const cyberpunkTheme: Theme = {
  name: 'cyberpunk',
  type: 'dark',
  
  colors: {
    // Base colors
    foreground: '#00ff00',
    background: '#000000',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selection: '#00ff0044',
    
    // ANSI colors
    black: '#000000',
    red: '#ff0040',
    green: '#00ff00',
    yellow: '#ffff00',
    blue: '#0080ff',
    magenta: '#ff00ff',
    cyan: '#00ffff',
    white: '#ffffff',
    
    // Bright ANSI colors
    brightBlack: '#404040',
    brightRed: '#ff4080',
    brightGreen: '#40ff40',
    brightYellow: '#ffff80',
    brightBlue: '#40a0ff',
    brightMagenta: '#ff40ff',
    brightCyan: '#40ffff',
    brightWhite: '#ffffff'
  },
  
  // UI colors
  ui: {
    border: '#00ff00',
    scrollbar: '#00ff0040',
    statusBar: '#001100',
    toolbar: '#002200'
  }
};

export class ThemePlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register theme
    context.ui.registerTheme(cyberpunkTheme);
    
    // Register multiple themes
    context.ui.registerThemes([
      cyberpunkTheme,
      retroTheme,
      minimalTheme
    ]);
  }
}
```

## Protocol Plugins

### Custom Protocol Handler

```typescript
export class SSHPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register protocol handler
    context.protocols.register('ssh', {
      name: 'SSH Protocol',
      
      canHandle: (url: string) => {
        return url.startsWith('ssh://');
      },
      
      connect: async (url: string, options: any) => {
        const { hostname, port, username } = this.parseSSHUrl(url);
        
        // Create SSH connection
        const connection = new SSHConnection({
          host: hostname,
          port,
          username,
          ...options
        });
        
        await connection.connect();
        
        return {
          write: (data: string) => connection.stdin.write(data),
          onData: (handler: (data: string) => void) => {
            connection.stdout.on('data', handler);
          },
          onError: (handler: (error: Error) => void) => {
            connection.on('error', handler);
          },
          close: () => connection.close()
        };
      }
    });
  }
  
  private parseSSHUrl(url: string): SSHConfig {
    const match = url.match(/^ssh:\/\/(\w+)@([^:]+):(\d+)/);
    return {
      username: match[1],
      hostname: match[2],
      port: parseInt(match[3], 10)
    };
  }
}
```

## Storage and Settings

### Plugin Storage

```typescript
export class StoragePlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Get plugin storage
    const storage = context.storage;
    
    // Store data
    await storage.set('lastCommand', 'ls -la');
    await storage.set('favorites', ['~/projects', '~/documents']);
    
    // Retrieve data
    const lastCommand = await storage.get('lastCommand');
    const favorites = await storage.get('favorites', []);
    
    // Store complex data
    await storage.set('session', {
      id: 'abc123',
      startTime: Date.now(),
      commands: []
    });
    
    // Delete data
    await storage.delete('tempData');
    
    // Clear all plugin data
    await storage.clear();
  }
}
```

### Settings Schema

```typescript
export class SettingsPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    // Register settings schema
    context.settings.registerSchema({
      id: 'my-plugin',
      title: 'My Plugin Settings',
      
      properties: {
        'myPlugin.enabled': {
          type: 'boolean',
          default: true,
          description: 'Enable My Plugin'
        },
        
        'myPlugin.theme': {
          type: 'string',
          enum: ['light', 'dark', 'auto'],
          default: 'auto',
          description: 'Plugin theme'
        },
        
        'myPlugin.shortcuts': {
          type: 'object',
          properties: {
            'clear': {
              type: 'string',
              default: 'ctrl+l',
              description: 'Clear terminal shortcut'
            }
          }
        }
      }
    });
    
    // Read settings
    const enabled = context.settings.get('myPlugin.enabled');
    const theme = context.settings.get('myPlugin.theme');
    
    // Watch for changes
    context.settings.onDidChange('myPlugin.theme', (newValue, oldValue) => {
      this.updateTheme(newValue);
    });
  }
}
```

## Event Handling

### Terminal Events

```typescript
export class EventPlugin implements NexusPlugin {
  async activate(context: PluginContext): Promise<void> {
    const { terminal, events } = context;
    
    // Terminal data events
    terminal.on('data', (data: string) => {
      // Process input/output
    });
    
    // Session events
    events.on('session:created', (session) => {
      console.log('New session:', session.id);
    });
    
    events.on('session:closed', (session) => {
      console.log('Session closed:', session.id);
    });
    
    // Command events
    events.on('command:before', (event) => {
      console.log('Executing:', event.command);
      // Can modify or cancel command
      if (this.shouldBlock(event.command)) {
        event.preventDefault();
      }
    });
    
    events.on('command:after', (event) => {
      console.log('Completed:', event.command, 'Exit code:', event.exitCode);
    });
    
    // Custom events
    events.emit('myPlugin:ready', { version: '1.0.0' });
  }
}
```

## Testing Plugins

### Unit Testing

```typescript
import { createMockContext } from '@happy-devkit/nexus-console/testing';
import { MyPlugin } from '../src';

describe('MyPlugin', () => {
  let plugin: MyPlugin;
  let context: MockPluginContext;
  
  beforeEach(() => {
    context = createMockContext();
    plugin = new MyPlugin();
  });
  
  test('should register commands', async () => {
    await plugin.activate(context);
    
    expect(context.commands.has('hello')).toBe(true);
  });
  
  test('should handle hello command', async () => {
    await plugin.activate(context);
    
    const command = context.commands.get('hello');
    await command.execute(context, []);
    
    expect(context.terminal.output).toContain('Hello from plugin!');
  });
});
```

### Integration Testing

```typescript
import { NexusConsole } from '@happy-devkit/nexus-console';
import { MyPlugin } from '../src';

test('plugin integration', async () => {
  const terminal = new NexusConsole();
  
  // Load plugin
  await terminal.loadPlugin(MyPlugin);
  
  // Test plugin functionality
  await terminal.executeCommand('hello');
  
  expect(terminal.getOutput()).toContain('Hello from plugin!');
});
```

## Publishing Plugins

### Package.json

```json
{
  "name": "nexus-console-myplugin",
  "version": "1.0.0",
  "description": "My awesome Nexus Console plugin",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  
  "keywords": [
    "nexus-console",
    "nexus-console-plugin",
    "terminal"
  ],
  
  "peerDependencies": {
    "@happy-devkit/nexus-console": "^1.0.0"
  },
  
  "nexusPlugin": {
    "displayName": "My Plugin",
    "description": "Adds awesome features to Nexus Console",
    "icon": "icon.png",
    "categories": ["Productivity", "Other"],
    "activationEvents": [
      "onStartup",
      "onCommand:hello"
    ]
  }
}
```

### Publishing Steps

1. **Build your plugin**:
   ```bash
   npm run build
   npm test
   ```

2. **Publish to npm**:
   ```bash
   npm publish
   ```

3. **Submit to Plugin Registry**:
   ```bash
   npx nexus-console submit-plugin
   ```

## Best Practices

1. **Performance**
   - Lazy load heavy dependencies
   - Use debouncing for frequent events
   - Clean up resources on deactivate

2. **Error Handling**
   - Always catch and log errors
   - Provide meaningful error messages
   - Don't crash the terminal

3. **User Experience**
   - Follow terminal conventions
   - Provide clear command descriptions
   - Support common shortcuts

4. **Security**
   - Validate all user input
   - Don't execute arbitrary code
   - Use the sandbox API

5. **Compatibility**
   - Test across platforms
   - Handle missing dependencies
   - Provide fallbacks

## Example: Complete Plugin

```typescript
import { NexusPlugin, PluginContext } from '@happy-devkit/nexus-console';

export class GitEnhancerPlugin implements NexusPlugin {
  name = 'git-enhancer';
  version = '1.0.0';
  
  private context: PluginContext;
  
  async activate(context: PluginContext): Promise<void> {
    this.context = context;
    
    // Register commands
    context.commands.register('gs', {
      description: 'Enhanced git status',
      execute: this.gitStatus.bind(this)
    });
    
    context.commands.register('glog', {
      description: 'Pretty git log',
      execute: this.gitLog.bind(this)
    });
    
    // Add UI elements
    context.ui.statusBar.add({
      id: 'git-branch',
      alignment: 'right',
      priority: 100,
      component: GitBranchStatus
    });
    
    // Register theme
    context.ui.registerTheme(gitTheme);
    
    // Set up event handlers
    context.events.on('cwd:changed', this.updateGitStatus.bind(this));
  }
  
  async deactivate(): Promise<void> {
    // Cleanup
  }
  
  private async gitStatus(): Promise<void> {
    const result = await this.context.exec('git status --porcelain');
    // Format and display...
  }
  
  private async gitLog(): Promise<void> {
    const result = await this.context.exec('git log --oneline -10');
    // Format and display...
  }
  
  private async updateGitStatus(): Promise<void> {
    // Update status bar...
  }
}

export default GitEnhancerPlugin;
```

## Resources

- [Plugin API Reference](./api/plugin.html)
- [Example Plugins](https://github.com/business-org/nexus-console-plugins)
- [Plugin Template](https://github.com/business-org/nexus-console-plugin-template)
- [Plugin Registry](https://plugins.nexus-console.dev)
