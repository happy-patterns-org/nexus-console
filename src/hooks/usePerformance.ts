/**
 * React hook for performance monitoring in Nexus Console
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { performanceMonitor, PerformanceMetrics } from '../performance/PerformanceMonitor';
import { getPerformanceConfig, PERFORMANCE_MARKS, PERFORMANCE_MEASURES } from '../performance/performanceConfig';

interface UsePerformanceOptions {
  enabled?: boolean;
  reportInterval?: number;
  onBudgetExceeded?: (violation: any) => void;
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

interface PerformanceState {
  metrics: PerformanceMetrics;
  violations: Array<{ metric: string; value: number; budget: number; timestamp: number }>;
  isMonitoring: boolean;
}

export function usePerformance(options: UsePerformanceOptions = {}) {
  const config = getPerformanceConfig();
  const {
    enabled = config.enabled,
    reportInterval = config.reporting.interval,
    onBudgetExceeded,
    onMetricsUpdate
  } = options;

  const [state, setState] = useState<PerformanceState>({
    metrics: performanceMonitor.getMetrics(),
    violations: [],
    isMonitoring: false
  });

  const violationsRef = useRef<Array<any>>([]);
  const metricsIntervalRef = useRef<number>();
  const memoryIntervalRef = useRef<number>();

  // Start monitoring
  const startMonitoring = useCallback(() => {
    if (!enabled || state.isMonitoring) return;

    setState(prev => ({ ...prev, isMonitoring: true }));
    
    // Start frame tracking
    performanceMonitor.startFrameTracking();

    // Set up metrics update interval
    metricsIntervalRef.current = window.setInterval(() => {
      const metrics = performanceMonitor.getMetrics();
      setState(prev => ({ ...prev, metrics }));
      onMetricsUpdate?.(metrics);
    }, reportInterval);

    // Set up memory monitoring
    memoryIntervalRef.current = window.setInterval(() => {
      performanceMonitor.updateMemoryMetrics();
    }, 5000); // Check memory every 5 seconds

    // Listen for budget violations
    const handleBudgetExceeded = (violation: any) => {
      const timestampedViolation = { ...violation, timestamp: Date.now() };
      violationsRef.current.push(timestampedViolation);
      
      // Keep only last 100 violations
      if (violationsRef.current.length > 100) {
        violationsRef.current = violationsRef.current.slice(-100);
      }

      setState(prev => ({
        ...prev,
        violations: [...violationsRef.current]
      }));

      onBudgetExceeded?.(timestampedViolation);
    };

    performanceMonitor.on('budget:exceeded', handleBudgetExceeded);

    return () => {
      performanceMonitor.off('budget:exceeded', handleBudgetExceeded);
    };
  }, [enabled, state.isMonitoring, reportInterval, onBudgetExceeded, onMetricsUpdate]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }));
    performanceMonitor.stopFrameTracking();

    if (metricsIntervalRef.current) {
      clearInterval(metricsIntervalRef.current);
    }
    if (memoryIntervalRef.current) {
      clearInterval(memoryIntervalRef.current);
    }
  }, []);

  // Measure performance of a function
  const measure = useCallback(<T extends any[], R>(
    name: string,
    fn: (...args: T) => R
  ): ((...args: T) => R) => {
    return (...args: T): R => {
      return performanceMonitor.measureRender(name, () => fn(...args)) as R;
    };
  }, []);

  // Measure async performance
  const measureAsync = useCallback(<T extends any[], R>(
    name: string,
    fn: (...args: T) => Promise<R>
  ): ((...args: T) => Promise<R>) => {
    return async (...args: T): Promise<R> => {
      return performanceMonitor.measureAsync(name, () => fn(...args));
    };
  }, []);

  // Mark performance points
  const mark = useCallback((name: string) => {
    performance.mark(name);
  }, []);

  // Measure between marks
  const measureBetween = useCallback((name: string, startMark: string, endMark: string) => {
    try {
      performance.measure(name, startMark, endMark);
    } catch (error) {
      console.warn(`Failed to measure ${name}:`, error);
    }
  }, []);

  // Update specific metrics
  const updateWebSocketMetrics = useCallback((latency: number, reconnections: number) => {
    performanceMonitor.updateWebSocketMetrics(latency, reconnections);
  }, []);

  const updateTerminalMetrics = useCallback((bufferSize: number, scrollPerformance: number) => {
    performanceMonitor.updateTerminalMetrics(bufferSize, scrollPerformance);
  }, []);

  const updateInputMetrics = useCallback((inputLatency: number, commandTime: number) => {
    performanceMonitor.updateInputMetrics(inputLatency, commandTime);
  }, []);

  // Get performance report
  const getReport = useCallback(() => {
    return performanceMonitor.generateReport();
  }, []);

  // Clear violations
  const clearViolations = useCallback(() => {
    violationsRef.current = [];
    setState(prev => ({ ...prev, violations: [] }));
  }, []);

  // Effect to start/stop monitoring based on enabled prop
  useEffect(() => {
    if (enabled && !state.isMonitoring) {
      startMonitoring();
    } else if (!enabled && state.isMonitoring) {
      stopMonitoring();
    }

    return () => {
      if (state.isMonitoring) {
        stopMonitoring();
      }
    };
  }, [enabled, state.isMonitoring, startMonitoring, stopMonitoring]);

  return {
    // State
    metrics: state.metrics,
    violations: state.violations,
    isMonitoring: state.isMonitoring,
    
    // Actions
    startMonitoring,
    stopMonitoring,
    measure,
    measureAsync,
    mark,
    measureBetween,
    
    // Metric updates
    updateWebSocketMetrics,
    updateTerminalMetrics,
    updateInputMetrics,
    
    // Utils
    getReport,
    clearViolations,
    
    // Constants
    MARKS: PERFORMANCE_MARKS,
    MEASURES: PERFORMANCE_MEASURES
  };
}

// Helper hook for measuring component render performance
export function useRenderPerformance(componentName: string) {
  const renderCount = useRef(0);
  const renderTimes = useRef<number[]>([]);
  
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      renderCount.current++;
      renderTimes.current.push(renderTime);
      
      // Keep only last 100 render times
      if (renderTimes.current.length > 100) {
        renderTimes.current = renderTimes.current.slice(-100);
      }
      
      // Log slow renders
      if (renderTime > 16.67) { // Slower than 60fps
        console.warn(`Slow render in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }
    };
  });
  
  return {
    renderCount: renderCount.current,
    averageRenderTime: renderTimes.current.length > 0
      ? renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length
      : 0,
    lastRenderTime: renderTimes.current[renderTimes.current.length - 1] || 0
  };
}