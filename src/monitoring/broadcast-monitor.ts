/**
 * Broadcast Monitor for Shared Config Breaking Changes
 * 
 * Monitors for breaking change notifications from the shared-config system
 * and takes appropriate action to pause development when detected.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Use ~/.shared-config directory for better persistence across reboots
const SHARED_CONFIG_DIR = process.env.SHARED_STATE_DIR || path.join(os.homedir(), '.shared-config');
const BROADCAST_FILE = path.join(SHARED_CONFIG_DIR, 'broadcast.json');

// Ensure the directory exists
function ensureSharedConfigDir(): void {
  if (!fs.existsSync(SHARED_CONFIG_DIR)) {
    try {
      fs.mkdirSync(SHARED_CONFIG_DIR, { recursive: true });
    } catch (error) {
      if (process.env.DEBUG) {
        console.debug('BroadcastMonitor: Failed to create shared config directory:', error);
      }
    }
  }
}

interface Broadcast {
  type: 'BREAKING_CHANGE_DETECTED' | 'INFO' | 'WARNING' | 'MIGRATION_REQUIRED' | 'UPDATE_AVAILABLE' | 'SHARED_CONFIG_UPDATED';
  timestamp: string;
  changes?: Array<{
    file: string;
    breaking: boolean;
    description: string;
  }>;
  message?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  version?: string; // For UPDATE_AVAILABLE broadcasts
}

export class BroadcastMonitor {
  private checkInterval: NodeJS.Timer | null = null;
  private onBreakingChange?: (broadcast: Broadcast) => void;
  private checkIntervalMs: number = 30000; // 30 seconds default

  constructor(options?: {
    checkIntervalMs?: number;
    onBreakingChange?: (broadcast: Broadcast) => void;
  }) {
    if (options?.checkIntervalMs) {
      this.checkIntervalMs = options.checkIntervalMs;
    }
    if (options?.onBreakingChange) {
      this.onBreakingChange = options.onBreakingChange;
    }
  }

  /**
   * Start monitoring for broadcasts
   */
  start(): void {
    if (this.checkInterval) {
      console.warn('BroadcastMonitor: Already running');
      return;
    }

    // Ensure the directory exists before starting
    ensureSharedConfigDir();

    console.log(`BroadcastMonitor: Starting (checking every ${this.checkIntervalMs}ms)`);
    console.log(`BroadcastMonitor: Monitoring file at ${BROADCAST_FILE}`);
    
    // Check immediately on start
    this.checkForBroadcasts();
    
    // Then check periodically
    this.checkInterval = setInterval(() => {
      this.checkForBroadcasts();
    }, this.checkIntervalMs);
  }

  /**
   * Check for broadcast messages
   */
  private async checkForBroadcasts(): Promise<void> {
    try {
      if (!fs.existsSync(BROADCAST_FILE)) {
        return;
      }

      const content = fs.readFileSync(BROADCAST_FILE, 'utf-8');
      const broadcast = JSON.parse(content) as Broadcast;
      
      switch (broadcast.type) {
        case 'BREAKING_CHANGE_DETECTED':
          console.error('🚨 BREAKING CHANGE DETECTED IN SHARED CONFIG');
          console.error('Timestamp:', broadcast.timestamp);
          if (broadcast.changes) {
            console.error('Changes:');
            broadcast.changes.forEach(change => {
              console.error(`  - ${change.file}: ${change.description}`);
            });
          }
          if (broadcast.message) {
            console.error('\nMessage:', broadcast.message);
          }
          console.error('\n⏸️  PAUSING DEVELOPMENT - Please coordinate with other teams');
          console.error('📋 Check the shared-config repository for migration instructions');
          
          // Call custom handler if provided
          if (this.onBreakingChange) {
            this.onBreakingChange(broadcast);
          } else {
            // Default behavior: exit with error
            this.stop();
            process.exit(1);
          }
          break;

        case 'WARNING':
          console.warn('⚠️  Shared config warning:', broadcast.message);
          if (this.onBreakingChange) {
            this.onBreakingChange(broadcast);
          }
          break;

        case 'INFO':
          console.log('ℹ️  Shared config info:', broadcast.message);
          break;

        case 'MIGRATION_REQUIRED':
          console.warn('📦 Migration required for shared config');
          console.warn('Message:', broadcast.message);
          console.warn('Severity:', broadcast.severity || 'medium');
          if (this.onBreakingChange) {
            this.onBreakingChange(broadcast);
          }
          break;

        case 'UPDATE_AVAILABLE':
          console.log('🔄 Shared config update available');
          if (broadcast.version) {
            console.log('Version:', broadcast.version);
          }
          if (broadcast.message) {
            console.log('Message:', broadcast.message);
          }
          break;

        case 'SHARED_CONFIG_UPDATED':
          console.log('✅ Shared config has been updated');
          if (broadcast.message) {
            console.log('Message:', broadcast.message);
          }
          if (broadcast.changes && process.env.DEBUG) {
            console.debug('Changes:', broadcast.changes);
          }
          break;
      }
    } catch (error) {
      // Silently ignore errors in broadcast checking
      // This is a monitoring feature and shouldn't break the main application
      if (process.env.DEBUG) {
        console.debug('BroadcastMonitor: Error checking broadcasts:', error);
      }
    }
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('BroadcastMonitor: Stopped');
    }
  }

  /**
   * Check if monitor is running
   */
  isRunning(): boolean {
    return this.checkInterval !== null;
  }

  /**
   * Manually trigger a broadcast check
   */
  async checkNow(): Promise<void> {
    await this.checkForBroadcasts();
  }
}

// Singleton instance for easy global access
let globalMonitor: BroadcastMonitor | null = null;

/**
 * Get or create the global broadcast monitor instance
 */
export function getGlobalBroadcastMonitor(): BroadcastMonitor {
  if (!globalMonitor) {
    globalMonitor = new BroadcastMonitor();
  }
  return globalMonitor;
}

/**
 * Start the global broadcast monitor with default settings
 */
export function startGlobalBroadcastMonitor(options?: {
  checkIntervalMs?: number;
  onBreakingChange?: (broadcast: Broadcast) => void;
}): BroadcastMonitor {
  const monitor = getGlobalBroadcastMonitor();
  
  // Update options if provided
  if (options) {
    // Create new instance with options
    globalMonitor = new BroadcastMonitor(options);
  }
  
  if (!globalMonitor!.isRunning()) {
    globalMonitor!.start();
  }
  
  return globalMonitor!;
}

/**
 * Stop the global broadcast monitor
 */
export function stopGlobalBroadcastMonitor(): void {
  if (globalMonitor) {
    globalMonitor.stop();
  }
}