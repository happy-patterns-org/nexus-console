/**
 * Performance monitoring dashboard for Nexus Console
 * Displays real-time performance metrics and budget violations
 */

import React, { useMemo } from 'react';
import { usePerformance } from '../hooks/usePerformance';
import { PerformanceMetrics } from '../performance/PerformanceMonitor';

interface PerformanceDashboardProps {
  className?: string;
  compact?: boolean;
  onClose?: () => void;
}

export const PerformanceDashboard: React.FC<PerformanceDashboardProps> = ({
  className = '',
  compact = false,
  onClose
}) => {
  const {
    metrics,
    violations,
    isMonitoring,
    startMonitoring,
    stopMonitoring,
    clearViolations
  } = usePerformance({
    enabled: true,
    reportInterval: 1000 // Update every second
  });

  const recentViolations = useMemo(() => {
    return violations.slice(-5).reverse();
  }, [violations]);

  const getMetricStatus = (value: number, threshold: number): string => {
    if (value > threshold * 1.5) return 'critical';
    if (value > threshold) return 'warning';
    return 'good';
  };

  const formatMetricValue = (value: number, unit: string): string => {
    if (unit === 'ms') return `${value.toFixed(1)}ms`;
    if (unit === 'MB') return `${value.toFixed(1)}MB`;
    if (unit === 'fps') return `${Math.round(value)} FPS`;
    return value.toString();
  };

  if (compact) {
    return (
      <div className={`performance-dashboard-compact ${className}`}>
        <div className="metrics-row">
          <span className={`metric fps-${getMetricStatus(60 - metrics.fps, 30)}`}>
            {Math.round(metrics.fps)} FPS
          </span>
          <span className={`metric memory-${getMetricStatus(metrics.memoryUsage, 50)}`}>
            {metrics.memoryUsage.toFixed(0)}MB
          </span>
          <span className={`metric latency-${getMetricStatus(metrics.inputLatency, 50)}`}>
            {metrics.inputLatency.toFixed(0)}ms
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`performance-dashboard ${className}`}>
      <div className="dashboard-header">
        <h3>Performance Monitor</h3>
        <div className="dashboard-controls">
          {isMonitoring ? (
            <button onClick={stopMonitoring} className="btn-stop">
              Stop Monitoring
            </button>
          ) : (
            <button onClick={startMonitoring} className="btn-start">
              Start Monitoring
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="btn-close" aria-label="Close">
              ×
            </button>
          )}
        </div>
      </div>

      <div className="dashboard-content">
        <div className="metrics-grid">
          <MetricCard
            title="Frame Rate"
            value={metrics.fps}
            unit="fps"
            threshold={30}
            inverse
          />
          <MetricCard
            title="Frame Time"
            value={metrics.frameTime}
            unit="ms"
            threshold={16.67}
          />
          <MetricCard
            title="Render Time"
            value={metrics.renderTime}
            unit="ms"
            threshold={10}
          />
          <MetricCard
            title="Input Latency"
            value={metrics.inputLatency}
            unit="ms"
            threshold={50}
          />
          <MetricCard
            title="WebSocket Latency"
            value={metrics.wsLatency}
            unit="ms"
            threshold={100}
          />
          <MetricCard
            title="Memory Usage"
            value={metrics.memoryUsage}
            unit="MB"
            threshold={50}
          />
          <MetricCard
            title="Buffer Size"
            value={metrics.bufferSize}
            unit="lines"
            threshold={10000}
          />
          <MetricCard
            title="DOM Nodes"
            value={metrics.domNodes}
            unit="nodes"
            threshold={5000}
          />
        </div>

        {violations.length > 0 && (
          <div className="violations-section">
            <div className="violations-header">
              <h4>Budget Violations ({violations.length})</h4>
              <button onClick={clearViolations} className="btn-clear">
                Clear
              </button>
            </div>
            <div className="violations-list">
              {recentViolations.map((violation, index) => (
                <div key={index} className={`violation severity-${violation.severity}`}>
                  <span className="violation-metric">{violation.metric}</span>
                  <span className="violation-value">
                    {violation.value.toFixed(1)} / {violation.budget}
                  </span>
                  <span className="violation-time">
                    {new Date(violation.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .performance-dashboard {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 400px;
          background: rgba(0, 0, 0, 0.9);
          border: 1px solid #333;
          border-radius: 8px;
          color: #fff;
          font-family: monospace;
          font-size: 12px;
          z-index: 10000;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 15px;
          border-bottom: 1px solid #333;
        }

        .dashboard-header h3 {
          margin: 0;
          font-size: 14px;
        }

        .dashboard-controls {
          display: flex;
          gap: 10px;
        }

        .dashboard-controls button {
          padding: 4px 8px;
          border: 1px solid #444;
          background: #222;
          color: #fff;
          border-radius: 4px;
          cursor: pointer;
          font-size: 11px;
        }

        .dashboard-controls button:hover {
          background: #333;
        }

        .btn-close {
          width: 24px;
          height: 24px;
          padding: 0;
          font-size: 18px;
        }

        .dashboard-content {
          padding: 15px;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
          margin-bottom: 15px;
        }

        .violations-section {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #333;
        }

        .violations-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .violations-header h4 {
          margin: 0;
          font-size: 12px;
        }

        .violations-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .violation {
          display: flex;
          justify-content: space-between;
          padding: 5px 8px;
          background: rgba(255, 0, 0, 0.1);
          border-radius: 4px;
          font-size: 11px;
        }

        .violation.severity-high {
          background: rgba(255, 0, 0, 0.2);
          border: 1px solid rgba(255, 0, 0, 0.3);
        }

        .violation.severity-medium {
          background: rgba(255, 165, 0, 0.2);
          border: 1px solid rgba(255, 165, 0, 0.3);
        }

        .violation.severity-low {
          background: rgba(255, 255, 0, 0.1);
          border: 1px solid rgba(255, 255, 0, 0.2);
        }

        .performance-dashboard-compact {
          position: fixed;
          top: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.8);
          border: 1px solid #333;
          border-radius: 4px;
          padding: 5px 10px;
          font-family: monospace;
          font-size: 11px;
          color: #fff;
          z-index: 10000;
        }

        .metrics-row {
          display: flex;
          gap: 15px;
        }

        .metric {
          padding: 2px 6px;
          border-radius: 3px;
        }

        .metric.fps-good { background: rgba(0, 255, 0, 0.2); }
        .metric.fps-warning { background: rgba(255, 165, 0, 0.2); }
        .metric.fps-critical { background: rgba(255, 0, 0, 0.2); }

        .metric.memory-good { background: rgba(0, 255, 0, 0.2); }
        .metric.memory-warning { background: rgba(255, 165, 0, 0.2); }
        .metric.memory-critical { background: rgba(255, 0, 0, 0.2); }

        .metric.latency-good { background: rgba(0, 255, 0, 0.2); }
        .metric.latency-warning { background: rgba(255, 165, 0, 0.2); }
        .metric.latency-critical { background: rgba(255, 0, 0, 0.2); }
      `}</style>
    </div>
  );
};

interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  threshold: number;
  inverse?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  threshold,
  inverse = false
}) => {
  const status = inverse
    ? value < threshold ? 'critical' : value < threshold * 1.5 ? 'warning' : 'good'
    : value > threshold * 1.5 ? 'critical' : value > threshold ? 'warning' : 'good';

  const formattedValue = unit === 'ms' ? value.toFixed(1)
    : unit === 'MB' ? value.toFixed(1)
    : unit === 'fps' ? Math.round(value).toString()
    : value.toString();

  return (
    <div className={`metric-card status-${status}`}>
      <div className="metric-title">{title}</div>
      <div className="metric-value">
        {formattedValue} <span className="metric-unit">{unit}</span>
      </div>
      <style jsx>{`
        .metric-card {
          padding: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid #333;
          border-radius: 4px;
        }

        .metric-card.status-good {
          border-color: rgba(0, 255, 0, 0.3);
          background: rgba(0, 255, 0, 0.05);
        }

        .metric-card.status-warning {
          border-color: rgba(255, 165, 0, 0.3);
          background: rgba(255, 165, 0, 0.05);
        }

        .metric-card.status-critical {
          border-color: rgba(255, 0, 0, 0.3);
          background: rgba(255, 0, 0, 0.05);
        }

        .metric-title {
          font-size: 10px;
          color: #999;
          margin-bottom: 4px;
        }

        .metric-value {
          font-size: 16px;
          font-weight: bold;
        }

        .metric-unit {
          font-size: 11px;
          color: #999;
          font-weight: normal;
        }
      `}</style>
    </div>
  );
};