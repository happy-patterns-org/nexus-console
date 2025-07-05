/**
 * Command Sanitizer - Security layer for terminal command execution
 * Implements defense-in-depth with multiple sanitization strategies
 */

import type { SecurityRule } from '../types';

export type SecurityLevel = 'strict' | 'standard' | 'permissive';

export interface CommandSanitizerConfig {
  level?: SecurityLevel;
  allowedCommands?: string[] | Set<string>;
  blockedCommands?: string[] | Set<string>;
  maxCommandLength?: number;
  enableLogging?: boolean;
  customRules?: SecurityRule[];
  onAuditLog?: (entry: AuditLogEntry) => void;
  
  // Security level specific options
  allowShellOperators?: boolean;
  allowRedirection?: boolean;
  allowPipes?: boolean;
  allowCommandSubstitution?: boolean;
  allowBackgroundExecution?: boolean;
  allowPathTraversal?: boolean;
  enforceAllowlist?: boolean;
}

export interface AuditLogEntry {
  timestamp: number;
  original: string;
  sanitized: string | null;
  level: SecurityLevel;
  duration: number;
  blocked: boolean;
  reason?: string;
}

export interface SecurityLevelConfig {
  allowShellOperators: boolean;
  allowRedirection: boolean;
  allowPipes: boolean;
  allowCommandSubstitution: boolean;
  allowBackgroundExecution: boolean;
  allowPathTraversal: boolean;
  enforceAllowlist: boolean;
  maxCommandLength: number;
}

export interface CommandPatterns {
  shellOperators: RegExp;
  commandInjection: RegExp;
  pathTraversal: RegExp;
  dangerousCommands: RegExp;
  networkCommands: RegExp;
  systemCommands: RegExp;
  shellInvocation: RegExp;
  envManipulation: RegExp;
  redirection: RegExp;
  backgroundExecution: RegExp;
  commandSubstitution: RegExp;
}

class CommandSanitizer {
  private config: Required<CommandSanitizerConfig>;
  private patterns: CommandPatterns;
  private securityLevels: Record<SecurityLevel, SecurityLevelConfig>;
  private defaultAllowlist: string[];
  private auditLog: AuditLogEntry[];

  constructor(config: CommandSanitizerConfig = {}) {
    // Command patterns
    this.patterns = {
      // Dangerous shell operators
      shellOperators: /[;&|`$(){}[\]<>]/g,
      
      // Command injection attempts
      commandInjection: /(\||;|&|`|\$\(|\$\{|<\(|>\()/,
      
      // Path traversal
      pathTraversal: /\.\.\/|\.\.\\|\.\.[\/\\]/,
      
      // Dangerous commands (default blocklist)
      dangerousCommands: /^(rm|rmdir|del|format|fdisk|dd|mkfs|shutdown|reboot|poweroff|kill|pkill|killall)\s/i,
      
      // Network commands that might be restricted
      networkCommands: /^(nc|netcat|telnet|ssh|scp|curl|wget|ftp|sftp)\s/i,
      
      // System modification commands
      systemCommands: /^(chmod|chown|chgrp|mount|umount|systemctl|service|apt|yum|brew)\s/i,
      
      // Shell invocation
      shellInvocation: /^(sh|bash|zsh|fish|cmd|powershell|pwsh)\s/i,
      
      // Environment manipulation
      envManipulation: /^(export|set|unset|source|\.)\s/i,
      
      // Redirection and pipes
      redirection: /[<>|]/,
      
      // Background execution
      backgroundExecution: /&\s*$/,
      
      // Command substitution
      commandSubstitution: /\$\([^)]+\)|\$\{[^}]+\}|`[^`]+`/,
    };

    // Security levels configuration
    this.securityLevels = {
      strict: {
        allowShellOperators: false,
        allowRedirection: false,
        allowPipes: false,
        allowCommandSubstitution: false,
        allowBackgroundExecution: false,
        allowPathTraversal: false,
        enforceAllowlist: true,
        maxCommandLength: 1024,
      },
      standard: {
        allowShellOperators: false,
        allowRedirection: true,
        allowPipes: true,
        allowCommandSubstitution: false,
        allowBackgroundExecution: false,
        allowPathTraversal: false,
        enforceAllowlist: false,
        maxCommandLength: 4096,
      },
      permissive: {
        allowShellOperators: true,
        allowRedirection: true,
        allowPipes: true,
        allowCommandSubstitution: true,
        allowBackgroundExecution: true,
        allowPathTraversal: true,
        enforceAllowlist: false,
        maxCommandLength: 8192,
      },
    };

    // Default allowlist for strict mode
    this.defaultAllowlist = [
      'ls', 'dir', 'pwd', 'cd', 'echo', 'cat', 'type', 'more', 'less',
      'head', 'tail', 'grep', 'find', 'which', 'whereis', 'date', 'time',
      'whoami', 'hostname', 'uname', 'env', 'printenv', 'history', 'clear',
      'exit', 'logout', 'help', 'man', 'info',
    ];

    // Initialize config with defaults
    this.config = {
      level: 'standard',
      allowedCommands: null,
      blockedCommands: null,
      maxCommandLength: 4096,
      enableLogging: true,
      customRules: [],
      onAuditLog: undefined,
      allowShellOperators: false,
      allowRedirection: true,
      allowPipes: true,
      allowCommandSubstitution: false,
      allowBackgroundExecution: false,
      allowPathTraversal: false,
      enforceAllowlist: false,
      ...config,
    } as Required<CommandSanitizerConfig>;

    // Audit log
    this.auditLog = [];

    // Initialize based on security level
    this.initializeSecurityLevel();
  }

  private initializeSecurityLevel(): void {
    const level = this.securityLevels[this.config.level] || this.securityLevels.standard;

    // Apply security level settings
    Object.assign(this.config, level);

    // Set up allowlist if enforcing
    if (level.enforceAllowlist && !this.config.allowedCommands) {
      this.config.allowedCommands = new Set(this.defaultAllowlist);
    } else if (this.config.allowedCommands && Array.isArray(this.config.allowedCommands)) {
      this.config.allowedCommands = new Set(this.config.allowedCommands);
    }

    // Set up blocklist
    if (this.config.blockedCommands && Array.isArray(this.config.blockedCommands)) {
      this.config.blockedCommands = new Set(this.config.blockedCommands);
    }
  }

  sanitize(command: string): string {
    if (typeof command !== 'string') {
      throw new Error('Command must be a string');
    }

    const startTime = performance.now();
    const originalCommand = command;

    try {
      // Basic validation
      command = this.validateBasic(command);

      // Apply security rules based on level
      command = this.applySecurityRules(command);

      // Apply custom rules
      command = this.applyCustomRules(command);

      // Final validation
      this.validateFinal(command);

      // Log successful sanitization
      this.logSanitization({
        original: originalCommand,
        sanitized: command,
        level: this.config.level,
        duration: performance.now() - startTime,
        blocked: false,
        timestamp: Date.now(),
      });

      return command;

    } catch (error) {
      // Log blocked command
      this.logSanitization({
        original: originalCommand,
        sanitized: null,
        level: this.config.level,
        duration: performance.now() - startTime,
        blocked: true,
        reason: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      });

      throw error;
    }
  }

  private validateBasic(command: string): string {
    // Trim whitespace
    command = command.trim();

    // Check if empty
    if (!command) {
      throw new Error('Empty command');
    }

    // Check length
    if (command.length > this.config.maxCommandLength) {
      throw new Error(`Command too long (max ${this.config.maxCommandLength} characters)`);
    }

    // Check for null bytes
    if (command.includes('\0')) {
      throw new Error('Null bytes not allowed in command');
    }

    // Normalize whitespace
    command = command.replace(/\s+/g, ' ');

    return command;
  }

  private applySecurityRules(command: string): string {
    // Extract base command
    const baseCommand = this.extractBaseCommand(command);

    // Check allowlist
    if (this.config.enforceAllowlist && this.config.allowedCommands) {
      const allowedCommands = this.config.allowedCommands as Set<string>;
      if (!allowedCommands.has(baseCommand)) {
        throw new Error(`Command '${baseCommand}' not in allowlist`);
      }
    }

    // Check blocklist
    if (this.config.blockedCommands) {
      const blockedCommands = this.config.blockedCommands as Set<string>;
      if (blockedCommands.has(baseCommand)) {
        throw new Error(`Command '${baseCommand}' is blocked`);
      }
    }

    // Check dangerous commands pattern
    if (!this.config.allowShellOperators && this.patterns.dangerousCommands.test(command)) {
      throw new Error('Potentially dangerous command detected');
    }

    // Check for shell operators
    if (!this.config.allowShellOperators && this.patterns.shellOperators.test(command)) {
      // Remove shell operators
      command = command.replace(this.patterns.shellOperators, '');
    }

    // Check for command injection
    if (this.patterns.commandInjection.test(command)) {
      if (!this.config.allowCommandSubstitution) {
        throw new Error('Command injection attempt detected');
      }
    }

    // Check for path traversal
    if (!this.config.allowPathTraversal && this.patterns.pathTraversal.test(command)) {
      throw new Error('Path traversal detected');
    }

    // Check for redirection
    if (!this.config.allowRedirection && this.patterns.redirection.test(command)) {
      throw new Error('Redirection not allowed');
    }

    // Check for background execution
    if (!this.config.allowBackgroundExecution && this.patterns.backgroundExecution.test(command)) {
      throw new Error('Background execution not allowed');
    }

    // Check for command substitution
    if (!this.config.allowCommandSubstitution && this.patterns.commandSubstitution.test(command)) {
      throw new Error('Command substitution not allowed');
    }

    return command;
  }

  private applyCustomRules(command: string): string {
    for (const rule of this.config.customRules) {
      if (typeof rule === 'function') {
        command = rule(command);
      } else if (rule.pattern && rule.action) {
        if (rule.pattern.test(command)) {
          switch (rule.action) {
            case 'block':
              throw new Error(rule.message || 'Custom rule violation');
            case 'remove':
              command = command.replace(rule.pattern, rule.replacement || '');
              break;
            case 'transform':
              command = command.replace(rule.pattern, rule.replacement || '');
              break;
          }
        }
      }
    }

    return command;
  }

  private validateFinal(command: string): void {
    // Final safety check - ensure command is still valid
    if (!command.trim()) {
      throw new Error('Command became empty after sanitization');
    }

    // Check for any remaining suspicious patterns
    if (this.config.level === 'strict') {
      // In strict mode, be extra cautious
      if (/[^a-zA-Z0-9\s\-_.\/]/g.test(command)) {
        throw new Error('Command contains non-alphanumeric characters in strict mode');
      }
    }
  }

  private extractBaseCommand(command: string): string {
    // Extract the base command (first word)
    const match = command.match(/^(\S+)/);
    return match ? match[1] : '';
  }

  // Path sanitization
  sanitizePath(path: string): string {
    if (typeof path !== 'string') {
      throw new Error('Path must be a string');
    }

    // Remove null bytes
    path = path.replace(/\0/g, '');

    // Normalize path separators
    path = path.replace(/\\/g, '/');

    // Remove redundant slashes
    path = path.replace(/\/+/g, '/');

    // Check for path traversal
    if (!this.config.allowPathTraversal && this.patterns.pathTraversal.test(path)) {
      throw new Error('Path traversal detected');
    }

    // Resolve relative paths safely
    if (!this.config.allowPathTraversal) {
      const parts = path.split('/');
      const resolved: string[] = [];

      for (const part of parts) {
        if (part === '..') {
          // Don't allow going above root
          if (resolved.length > 0) {
            resolved.pop();
          }
        } else if (part !== '.' && part !== '') {
          resolved.push(part);
        }
      }

      path = '/' + resolved.join('/');
    }

    return path;
  }

  // Environment variable sanitization
  sanitizeEnvVar(name: string, value: string): { name: string; value: string } {
    // Validate variable name
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      throw new Error('Invalid environment variable name');
    }

    // Check for sensitive variables
    const sensitiveVars = ['PATH', 'LD_LIBRARY_PATH', 'PYTHONPATH', 'NODE_PATH'];
    if (this.config.level === 'strict' && sensitiveVars.includes(name.toUpperCase())) {
      throw new Error('Cannot modify sensitive environment variable');
    }

    // Sanitize value
    if (typeof value !== 'string') {
      value = String(value);
    }

    // Remove null bytes
    value = value.replace(/\0/g, '');

    // In strict mode, limit special characters
    if (this.config.level === 'strict') {
      value = value.replace(/[^\w\s\-_.\/]/g, '');
    }

    return { name, value };
  }

  // Argument sanitization
  sanitizeArguments(args: string | string[]): string[] {
    if (!Array.isArray(args)) {
      args = [args];
    }

    return args.map(arg => {
      if (typeof arg !== 'string') {
        arg = String(arg);
      }

      // Remove null bytes
      arg = arg.replace(/\0/g, '');

      // Quote arguments with spaces
      if (arg.includes(' ') && !arg.startsWith('"') && !arg.startsWith("'")) {
        arg = `"${arg}"`;
      }

      // Escape quotes within arguments
      if (arg.startsWith('"')) {
        arg = arg.replace(/(?<!\\)"/g, '\\"');
      }

      return arg;
    });
  }

  // Validation helpers
  isCommandAllowed(command: string): boolean {
    try {
      this.sanitize(command);
      return true;
    } catch {
      return false;
    }
  }

  getSafetyScore(command: string): number {
    let score = 100;

    // Deduct points for various patterns
    if (this.patterns.shellOperators.test(command)) score -= 20;
    if (this.patterns.commandInjection.test(command)) score -= 30;
    if (this.patterns.pathTraversal.test(command)) score -= 20;
    if (this.patterns.dangerousCommands.test(command)) score -= 25;
    if (this.patterns.networkCommands.test(command)) score -= 15;
    if (this.patterns.systemCommands.test(command)) score -= 20;
    if (this.patterns.commandSubstitution.test(command)) score -= 25;

    return Math.max(0, score);
  }

  // Logging
  private logSanitization(entry: AuditLogEntry): void {
    if (!this.config.enableLogging) {
      return;
    }

    this.auditLog.push(entry);

    // Limit audit log size
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    // Emit event for external logging
    if (this.config.onAuditLog) {
      this.config.onAuditLog(entry);
    }
  }

  getAuditLog(filter: Partial<AuditLogEntry> = {}): AuditLogEntry[] {
    let logs = [...this.auditLog];

    // Apply filters
    if (filter.blocked !== undefined) {
      logs = logs.filter(log => log.blocked === filter.blocked);
    }

    if (filter.level) {
      logs = logs.filter(log => log.level === filter.level);
    }

    if (filter.timestamp) {
      logs = logs.filter(log => log.timestamp >= filter.timestamp!);
    }

    return logs;
  }

  // Configuration
  setSecurityLevel(level: SecurityLevel): void {
    if (!this.securityLevels[level]) {
      throw new Error(`Invalid security level: ${level}`);
    }

    this.config.level = level;
    this.initializeSecurityLevel();
  }

  addAllowedCommand(command: string): void {
    if (!this.config.allowedCommands || Array.isArray(this.config.allowedCommands)) {
      this.config.allowedCommands = new Set();
    }
    (this.config.allowedCommands as Set<string>).add(command);
  }

  addBlockedCommand(command: string): void {
    if (!this.config.blockedCommands || Array.isArray(this.config.blockedCommands)) {
      this.config.blockedCommands = new Set();
    }
    (this.config.blockedCommands as Set<string>).add(command);
  }

  addCustomRule(rule: SecurityRule): void {
    this.config.customRules.push(rule);
  }

  // Utility methods
  escapeShellArg(arg: string): string {
    // Escape shell special characters
    return arg.replace(/(["\s'$`\\])/g, '\\$1');
  }

  quoteArg(arg: string): string {
    // Quote argument for shell
    if (!/^[\w\-\.\/]+$/.test(arg)) {
      return `'${arg.replace(/'/g, "'\\''")}'`;
    }
    return arg;
  }

  parseCommand(command: string): { executable: string; args: string[] } {
    // Parse command into executable and arguments
    const parts = command.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];

    return {
      executable: parts[0] || '',
      args: parts.slice(1).map(arg => {
        // Remove quotes
        if ((arg.startsWith('"') && arg.endsWith('"')) ||
            (arg.startsWith("'") && arg.endsWith("'"))) {
          return arg.slice(1, -1);
        }
        return arg;
      }),
    };
  }
}

export default CommandSanitizer;