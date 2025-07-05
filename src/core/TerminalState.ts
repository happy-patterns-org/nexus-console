/**
 * Terminal State - State management for Nexus Terminal
 * Centralized state tracking and management with type safety
 */

import type { TerminalSession } from '../types';

export interface TerminalConfig {
  theme: string;
  fontSize: number;
  cursorBlink: boolean;
  bellStyle: 'none' | 'sound' | 'visual' | 'both';
}

export interface TerminalMetrics {
  commandsExecuted: number;
  totalUptime: number;
  lastActivity: number;
  sessionCount?: number;
}

export interface TerminalStateData {
  initialized: boolean;
  connected: boolean;
  activeSession: string | null;
  error: Error | null;
  mode: 'normal' | 'search' | 'command';
  sessions: Map<string, TerminalSession>;
  config: TerminalConfig;
  metrics: TerminalMetrics;
}

export type StateChangeCallback<T = any> = (
  newValue: T,
  oldValue: T | null,
  key: string
) => void;

export type UnwatchFunction = () => void;

class TerminalState {
  private state: TerminalStateData;
  private listeners: Map<string, Set<StateChangeCallback>>;
  private startTime: number;
  private uptimeInterval?: NodeJS.Timer;

  constructor() {
    this.state = {
      initialized: false,
      connected: false,
      activeSession: null,
      error: null,
      mode: 'normal',
      sessions: new Map(),
      config: {
        theme: 'nexus-dark',
        fontSize: 14,
        cursorBlink: true,
        bellStyle: 'sound',
      },
      metrics: {
        commandsExecuted: 0,
        totalUptime: 0,
        lastActivity: Date.now(),
      },
    };

    this.listeners = new Map();
    this.startTime = Date.now();
    this.startUptimeTracking();
  }

  // Initialization state
  setInitialized(initialized: boolean): void {
    this.updateState('initialized', initialized);
  }

  isInitialized(): boolean {
    return this.state.initialized;
  }

  // Connection state
  setConnected(connected: boolean): void {
    this.updateState('connected', connected);
  }

  isConnected(): boolean {
    return this.state.connected;
  }

  // Session management
  setActiveSession(sessionId: string | null): void {
    this.updateState('activeSession', sessionId);
  }

  getActiveSession(): string | null {
    return this.state.activeSession;
  }

  addSession(sessionId: string, sessionData: Partial<TerminalSession>): void {
    const sessions = new Map(this.state.sessions);
    sessions.set(sessionId, {
      id: sessionId,
      created: Date.now(),
      active: true,
      buffer: [],
      history: [],
      cwd: '/',
      ...sessionData,
      options: sessionData.options || {},
    } as TerminalSession);
    this.updateState('sessions', sessions);
  }

  updateSession(sessionId: string, updates: Partial<TerminalSession>): void {
    const sessions = new Map(this.state.sessions);
    const session = sessions.get(sessionId);
    if (session) {
      sessions.set(sessionId, {
        ...session,
        ...updates,
        lastActivity: Date.now(),
      } as TerminalSession);
      this.updateState('sessions', sessions);
    }
  }

  removeSession(sessionId: string): void {
    const sessions = new Map(this.state.sessions);
    sessions.delete(sessionId);
    this.updateState('sessions', sessions);

    // Clear active session if it was removed
    if (this.state.activeSession === sessionId) {
      this.setActiveSession(null);
    }
  }

  getSession(sessionId: string): TerminalSession | undefined {
    return this.state.sessions.get(sessionId);
  }

  getAllSessions(): TerminalSession[] {
    return Array.from(this.state.sessions.values());
  }

  // Error state
  setError(error: Error | null): void {
    this.updateState('error', error);
  }

  clearError(): void {
    this.updateState('error', null);
  }

  hasError(): boolean {
    return this.state.error !== null;
  }

  getError(): Error | null {
    return this.state.error;
  }

  // Mode
  setMode(mode: 'normal' | 'search' | 'command'): void {
    this.updateState('mode', mode);
  }

  getMode(): 'normal' | 'search' | 'command' {
    return this.state.mode;
  }

  // Configuration
  updateConfig(config: Partial<TerminalConfig>): void {
    this.updateState('config', {
      ...this.state.config,
      ...config,
    });
  }

  getConfig(): TerminalConfig {
    return { ...this.state.config };
  }

  // Metrics
  incrementCommandCount(): void {
    this.updateState('metrics', {
      ...this.state.metrics,
      commandsExecuted: this.state.metrics.commandsExecuted + 1,
      lastActivity: Date.now(),
    });
  }

  updateActivity(): void {
    this.updateState('metrics', {
      ...this.state.metrics,
      lastActivity: Date.now(),
    });
  }

  getMetrics(): TerminalMetrics {
    return {
      ...this.state.metrics,
      totalUptime: Date.now() - this.startTime,
      sessionCount: this.state.sessions.size,
    };
  }

  // State management
  private updateState<K extends keyof TerminalStateData>(
    key: K,
    value: TerminalStateData[K]
  ): void {
    const oldValue = this.state[key];
    this.state[key] = value;

    // Notify listeners
    this.notifyListeners(key, value, oldValue);

    // Notify global state change listeners
    this.notifyListeners('*', this.state, null);
  }

  getState(): Omit<TerminalStateData, 'sessions'> & { sessions: TerminalSession[] } {
    return {
      ...this.state,
      sessions: Array.from(this.state.sessions.entries()).map(([id, session]) => ({
        id,
        ...session,
      })),
    };
  }

  // State observation
  watch<K extends keyof TerminalStateData>(
    key: K,
    callback: StateChangeCallback<TerminalStateData[K]>
  ): UnwatchFunction;
  watch(key: '*', callback: StateChangeCallback<TerminalStateData>): UnwatchFunction;
  watch(key: string, callback: StateChangeCallback): UnwatchFunction {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(callback);

    // Return unwatch function
    return () => {
      const callbacks = this.listeners.get(key);
      if (callbacks) {
        callbacks.delete(callback);
      }
    };
  }

  watchMultiple(keys: string[], callback: StateChangeCallback): UnwatchFunction {
    const unwatchers = keys.map((key) => this.watch(key as any, callback));

    // Return function to unwatch all
    return () => {
      unwatchers.forEach((unwatch) => unwatch());
    };
  }

  private notifyListeners(key: string, newValue: any, oldValue: any): void {
    const callbacks = this.listeners.get(key);
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(newValue, oldValue, key);
        } catch (error) {
          console.error(`Error in state listener for ${key}:`, error);
        }
      });
    }
  }

  // Uptime tracking
  private startUptimeTracking(): void {
    this.uptimeInterval = setInterval(() => {
      this.state.metrics.totalUptime = Date.now() - this.startTime;
    }, 1000);
  }

  // Reset
  reset(): void {
    // Preserve some state
    const config = this.state.config;

    // Reset state
    this.state = {
      initialized: false,
      connected: false,
      activeSession: null,
      error: null,
      mode: 'normal',
      sessions: new Map(),
      config,
      metrics: {
        commandsExecuted: 0,
        totalUptime: 0,
        lastActivity: Date.now(),
      },
    };

    // Notify listeners
    this.notifyListeners('*', this.state, null);
  }

  // Serialization for persistence
  serialize(): string {
    return JSON.stringify({
      config: this.state.config,
      metrics: this.state.metrics,
      sessions: Array.from(this.state.sessions.entries()).map(([id, session]) => ({
        id,
        ...session,
      })),
    });
  }

  deserialize(data: string): void {
    try {
      const parsed = JSON.parse(data);

      if (parsed.config) {
        this.updateConfig(parsed.config);
      }

      if (parsed.metrics) {
        this.state.metrics = {
          ...this.state.metrics,
          ...parsed.metrics,
        };
      }

      if (parsed.sessions) {
        const sessions = new Map<string, TerminalSession>();
        parsed.sessions.forEach((session: any) => {
          sessions.set(session.id, session);
        });
        this.updateState('sessions', sessions);
      }
    } catch (error) {
      console.error('Failed to deserialize state:', error);
    }
  }

  // Cleanup
  destroy(): void {
    if (this.uptimeInterval) {
      clearInterval(this.uptimeInterval);
      this.uptimeInterval = undefined;
    }
    this.listeners.clear();
  }
}

export default TerminalState;