/**
 * Performance monitoring and metrics collection exports
 * 
 * This module provides comprehensive performance tracking for the YouTube GIF Maker extension,
 * including frame extraction times, encoding performance, memory usage, and user analytics.
 */

// Core monitoring exports
export { 
  PerformanceTracker, 
  performanceTracker,
  type PerformanceMetric,
  type PerformanceSnapshot,
  type PerformanceListener
} from './performance-tracker';

export { 
  MetricsCollector,
  metricsCollector,
  type CollectedMetrics,
  type ErrorMetric,
  type UserAction,
  type SystemInfo,
  type PrivacySettings
} from './metrics-collector';

// Import singleton instances
import { performanceTracker } from './performance-tracker';
import { metricsCollector } from './metrics-collector';

// Convenience functions for common operations
export const startPerformanceMonitoring = () => {
  // Ensure both trackers are initialized
  performanceTracker.clear();
  metricsCollector.reset();
  
  // Start automatic memory monitoring
  const memoryInterval = setInterval(async () => {
    await performanceTracker.recordMemoryUsage();
  }, 10000); // Every 10 seconds
  
  return () => {
    clearInterval(memoryInterval);
    performanceTracker.destroy();
    metricsCollector.destroy();
  };
};

// Quick access to performance status
export const getPerformanceStatus = () => {
  const snapshot = performanceTracker.getSnapshot();
  const report = performanceTracker.generateReport();
  const userReport = metricsCollector.generateUserReport();
  
  return {
    healthy: snapshot.summary.successRate >= 90 && 
             snapshot.summary.memoryUsage < 500 &&
             snapshot.summary.averageFrameExtractionTime < 100,
    snapshot,
    report,
    userReport
  };
};

// Export performance metrics for debugging
export const exportPerformanceData = () => {
  return {
    performance: performanceTracker.exportMetrics(),
    metrics: metricsCollector.exportForDebugging(),
    timestamp: Date.now()
  };
};