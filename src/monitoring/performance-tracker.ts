interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface PerformanceMetric {
  name: string;
  value: number;
  unit: 'ms' | 'MB' | 'fps' | 'percent';
  timestamp: number;
  category: 'frame-extraction' | 'encoding' | 'memory' | 'cpu' | 'general';
  metadata?: Record<string, unknown>;
}

export interface PerformanceSnapshot {
  timestamp: number;
  metrics: PerformanceMetric[];
  summary: {
    averageFrameExtractionTime: number;
    averageEncodingTime: number;
    memoryUsage: number;
    cpuUsage: number;
    totalOperations: number;
    successRate: number;
  };
}

type PerformanceListener = (snapshot: PerformanceSnapshot) => void;

export class PerformanceTracker {
  private static instance: PerformanceTracker;
  private metrics: PerformanceMetric[] = [];
  private listeners: Set<PerformanceListener> = new Set();
  private operationTimers: Map<string, number> = new Map();
  private operationCounts: Map<string, { success: number; failure: number }> = new Map();
  private snapshotInterval: number | null = null;
  private readonly MAX_METRICS_HISTORY = 1000;
  private readonly SNAPSHOT_INTERVAL_MS = 5000;

  private constructor() {
    this.startSnapshotTimer();
  }

  public static getInstance(): PerformanceTracker {
    if (!PerformanceTracker.instance) {
      PerformanceTracker.instance = new PerformanceTracker();
    }
    return PerformanceTracker.instance;
  }

  // Timer operations for measuring durations
  public startTimer(operationId: string): void {
    this.operationTimers.set(operationId, performance.now());
  }

  public endTimer(
    operationId: string,
    category: PerformanceMetric['category'],
    metadata?: Record<string, unknown>
  ): number {
    const startTime = this.operationTimers.get(operationId);
    if (!startTime) {
      console.warn(`[PerformanceTracker] Timer not found for operation: ${operationId}`);
      return -1;
    }

    const duration = performance.now() - startTime;
    this.operationTimers.delete(operationId);

    this.recordMetric({
      name: operationId,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category,
      metadata
    });

    // Track operation success
    this.incrementOperationCount(operationId, true);

    return duration;
  }

  // Record a single metric
  public recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Maintain max history
    if (this.metrics.length > this.MAX_METRICS_HISTORY) {
      this.metrics.shift();
    }
  }

  // Track operation success/failure rates
  public incrementOperationCount(operation: string, success: boolean): void {
    const current = this.operationCounts.get(operation) || { success: 0, failure: 0 };
    
    if (success) {
      current.success++;
    } else {
      current.failure++;
    }
    
    this.operationCounts.set(operation, current);
  }

  // Memory monitoring
  public async recordMemoryUsage(): Promise<void> {
    if ('memory' in performance && (performance as unknown as { memory: MemoryInfo }).memory) {
      const memory = (performance as unknown as { memory: MemoryInfo }).memory;
      
      this.recordMetric({
        name: 'heap-used',
        value: memory.usedJSHeapSize / (1024 * 1024),
        unit: 'MB',
        timestamp: Date.now(),
        category: 'memory',
        metadata: {
          heapLimit: memory.jsHeapSizeLimit / (1024 * 1024),
          totalHeap: memory.totalJSHeapSize / (1024 * 1024)
        }
      });
    }
  }

  // Frame extraction performance
  public recordFrameExtraction(frameNumber: number, duration: number, success: boolean): void {
    this.recordMetric({
      name: `frame-${frameNumber}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'frame-extraction',
      metadata: {
        frameNumber,
        success
      }
    });

    if (!success) {
      this.incrementOperationCount('frame-extraction', false);
    }
  }

  // Encoding performance
  public recordEncodingMetric(
    phase: 'quantization' | 'palette' | 'encoding' | 'optimization',
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    this.recordMetric({
      name: `encoding-${phase}`,
      value: duration,
      unit: 'ms',
      timestamp: Date.now(),
      category: 'encoding',
      metadata
    });
  }

  // Get performance snapshot
  public getSnapshot(): PerformanceSnapshot {
    const now = Date.now();
    const recentMetrics = this.metrics.filter(m => now - m.timestamp < 60000); // Last minute
    
    // Calculate averages
    const frameExtractionMetrics = recentMetrics.filter(m => m.category === 'frame-extraction');
    const encodingMetrics = recentMetrics.filter(m => m.category === 'encoding');
    const memoryMetrics = recentMetrics.filter(m => m.category === 'memory');
    
    const averageFrameExtractionTime = frameExtractionMetrics.length > 0
      ? frameExtractionMetrics.reduce((sum, m) => sum + m.value, 0) / frameExtractionMetrics.length
      : 0;
    
    const averageEncodingTime = encodingMetrics.length > 0
      ? encodingMetrics.reduce((sum, m) => sum + m.value, 0) / encodingMetrics.length
      : 0;
    
    const latestMemory = memoryMetrics[memoryMetrics.length - 1];
    const memoryUsage = latestMemory ? latestMemory.value : 0;
    
    // Calculate success rate
    let totalSuccess = 0;
    let totalFailure = 0;
    
    this.operationCounts.forEach((counts) => {
      totalSuccess += counts.success;
      totalFailure += counts.failure;
    });
    
    const successRate = totalSuccess + totalFailure > 0
      ? (totalSuccess / (totalSuccess + totalFailure)) * 100
      : 100;
    
    return {
      timestamp: now,
      metrics: recentMetrics,
      summary: {
        averageFrameExtractionTime,
        averageEncodingTime,
        memoryUsage,
        cpuUsage: this.estimateCPUUsage(),
        totalOperations: totalSuccess + totalFailure,
        successRate
      }
    };
  }

  // Subscribe to performance updates
  public subscribe(listener: PerformanceListener): () => void {
    this.listeners.add(listener);
    
    // Send initial snapshot
    listener(this.getSnapshot());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify listeners with current snapshot
  private notifyListeners(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch (error) {
        console.error('[PerformanceTracker] Error in listener:', error);
      }
    });
  }

  // Start periodic snapshot updates
  private startSnapshotTimer(): void {
    if (this.snapshotInterval) return;
    
    this.snapshotInterval = window.setInterval(() => {
      this.recordMemoryUsage();
      this.notifyListeners();
    }, this.SNAPSHOT_INTERVAL_MS);
  }

  // Stop snapshot timer
  private stopSnapshotTimer(): void {
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }
  }

  // Estimate CPU usage based on operation frequency
  private estimateCPUUsage(): number {
    const now = Date.now();
    const recentOps = this.metrics.filter(m => now - m.timestamp < 5000);
    
    if (recentOps.length === 0) return 0;
    
    // Calculate total processing time in last 5 seconds
    const totalProcessingTime = recentOps.reduce((sum, m) => sum + m.value, 0);
    
    // Estimate CPU usage as percentage of time spent processing
    const cpuUsage = Math.min((totalProcessingTime / 5000) * 100, 100);
    
    return Math.round(cpuUsage);
  }

  // Clear all metrics
  public clear(): void {
    this.metrics = [];
    this.operationTimers.clear();
    this.operationCounts.clear();
  }

  // Generate performance report
  public generateReport(): {
    summary: PerformanceSnapshot['summary'];
    topOperations: Array<{ name: string; avgDuration: number; count: number }>;
    memoryTrend: 'stable' | 'increasing' | 'decreasing';
    recommendations: string[];
  } {
    const snapshot = this.getSnapshot();
    
    // Analyze top operations by time
    const operationDurations = new Map<string, { total: number; count: number }>();
    
    this.metrics.forEach(metric => {
      if (metric.unit === 'ms') {
        const current = operationDurations.get(metric.name) || { total: 0, count: 0 };
        current.total += metric.value;
        current.count++;
        operationDurations.set(metric.name, current);
      }
    });
    
    const topOperations = Array.from(operationDurations.entries())
      .map(([name, data]) => ({
        name,
        avgDuration: data.total / data.count,
        count: data.count
      }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);
    
    // Analyze memory trend
    const memoryMetrics = this.metrics
      .filter(m => m.category === 'memory')
      .slice(-10);
    
    let memoryTrend: 'stable' | 'increasing' | 'decreasing' = 'stable';
    
    if (memoryMetrics.length >= 2) {
      const firstHalf = memoryMetrics.slice(0, memoryMetrics.length / 2);
      const secondHalf = memoryMetrics.slice(memoryMetrics.length / 2);
      
      const firstAvg = firstHalf.reduce((sum, m) => sum + m.value, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, m) => sum + m.value, 0) / secondHalf.length;
      
      if (secondAvg > firstAvg * 1.1) {
        memoryTrend = 'increasing';
      } else if (secondAvg < firstAvg * 0.9) {
        memoryTrend = 'decreasing';
      }
    }
    
    // Generate recommendations
    const recommendations: string[] = [];
    
    if (snapshot.summary.averageFrameExtractionTime > 100) {
      recommendations.push('Frame extraction is slow. Consider reducing video resolution.');
    }
    
    if (snapshot.summary.averageEncodingTime > 500) {
      recommendations.push('Encoding is taking longer than expected. Try reducing GIF quality or dimensions.');
    }
    
    if (snapshot.summary.memoryUsage > 500) {
      recommendations.push('High memory usage detected. Consider processing smaller segments.');
    }
    
    if (snapshot.summary.successRate < 90) {
      recommendations.push('Low success rate detected. Check for errors in processing pipeline.');
    }
    
    if (memoryTrend === 'increasing') {
      recommendations.push('Memory usage is increasing. Possible memory leak detected.');
    }
    
    return {
      summary: snapshot.summary,
      topOperations,
      memoryTrend,
      recommendations
    };
  }

  // Export metrics for analytics
  public exportMetrics(): {
    metrics: PerformanceMetric[];
    operationCounts: Record<string, { success: number; failure: number }>;
    timestamp: number;
  } {
    return {
      metrics: [...this.metrics],
      operationCounts: Object.fromEntries(this.operationCounts),
      timestamp: Date.now()
    };
  }

  // Clean up
  public destroy(): void {
    this.stopSnapshotTimer();
    this.listeners.clear();
    this.clear();
  }
}

export const performanceTracker = PerformanceTracker.getInstance();