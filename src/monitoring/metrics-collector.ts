import { performanceTracker, PerformanceMetric, PerformanceSnapshot } from './performance-tracker';

interface CollectedMetrics {
  sessionId: string;
  startTime: number;
  endTime: number;
  totalFramesProcessed: number;
  totalGifsCreated: number;
  averageProcessingTime: number;
  peakMemoryUsage: number;
  errors: ErrorMetric[];
  userActions: UserAction[];
  systemInfo: SystemInfo;
}

interface ErrorMetric {
  timestamp: number;
  type: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
}

interface UserAction {
  timestamp: number;
  action: string;
  details?: Record<string, unknown>;
}

interface SystemInfo {
  userAgent: string;
  platform: string;
  language: string;
  screenResolution: string;
  connectionType?: string;
  deviceMemory?: number;
}

interface PrivacySettings {
  collectAnalytics: boolean;
  collectErrors: boolean;
  collectPerformance: boolean;
  anonymizeData: boolean;
}

type MetricsListener = (metrics: CollectedMetrics) => void;

export class MetricsCollector {
  private static instance: MetricsCollector;
  private sessionId: string;
  private startTime: number;
  private metrics: CollectedMetrics;
  private listeners: Set<MetricsListener> = new Set();
  private privacySettings: PrivacySettings;
  private userActions: UserAction[] = [];
  private errors: ErrorMetric[] = [];
  private frameCount = 0;
  private gifCount = 0;
  private peakMemory = 0;
  private unsubscribePerformance: (() => void) | null = null;
  
  private readonly MAX_ERRORS = 100;
  private readonly MAX_USER_ACTIONS = 500;
  private readonly BATCH_INTERVAL_MS = 30000; // Send metrics every 30 seconds
  private batchTimer: number | null = null;

  private constructor() {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    
    this.privacySettings = this.loadPrivacySettings();
    this.metrics = this.initializeMetrics();
    
    this.setupPerformanceTracking();
    this.setupErrorTracking();
    this.startBatchTimer();
  }

  public static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeMetrics(): CollectedMetrics {
    return {
      sessionId: this.sessionId,
      startTime: this.startTime,
      endTime: 0,
      totalFramesProcessed: 0,
      totalGifsCreated: 0,
      averageProcessingTime: 0,
      peakMemoryUsage: 0,
      errors: [],
      userActions: [],
      systemInfo: this.collectSystemInfo()
    };
  }

  private loadPrivacySettings(): PrivacySettings {
    // Load from chrome.storage or use defaults
    const stored = localStorage.getItem('privacy-settings');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Use defaults
      }
    }
    
    return {
      collectAnalytics: true,
      collectErrors: true,
      collectPerformance: true,
      anonymizeData: true
    };
  }

  public updatePrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
    localStorage.setItem('privacy-settings', JSON.stringify(this.privacySettings));
    
    // Restart tracking with new settings
    if (this.unsubscribePerformance) {
      this.unsubscribePerformance();
      this.setupPerformanceTracking();
    }
  }

  private collectSystemInfo(): SystemInfo {
    const info: SystemInfo = {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      language: navigator.language,
      screenResolution: `${screen.width}x${screen.height}`
    };
    
    // Connection type (if available)
    if ('connection' in navigator) {
      const conn = (navigator as unknown as { connection: { effectiveType?: string } }).connection;
      if (conn && conn.effectiveType) {
        info.connectionType = conn.effectiveType;
      }
    }
    
    // Device memory (if available)
    if ('deviceMemory' in navigator) {
      info.deviceMemory = (navigator as unknown as { deviceMemory: number }).deviceMemory;
    }
    
    return info;
  }

  private setupPerformanceTracking(): void {
    if (!this.privacySettings.collectPerformance) return;
    
    this.unsubscribePerformance = performanceTracker.subscribe((snapshot: PerformanceSnapshot) => {
      // Update peak memory
      if (snapshot.summary.memoryUsage > this.peakMemory) {
        this.peakMemory = snapshot.summary.memoryUsage;
      }
      
      // Update metrics
      this.metrics.peakMemoryUsage = this.peakMemory;
      this.metrics.averageProcessingTime = 
        (snapshot.summary.averageFrameExtractionTime + snapshot.summary.averageEncodingTime) / 2;
    });
  }

  private setupErrorTracking(): void {
    if (!this.privacySettings.collectErrors) return;
    
    // Global error handler
    window.addEventListener('error', (event) => {
      this.recordError({
        type: 'uncaught-error',
        message: event.message,
        stack: event.error?.stack,
        context: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      });
    });
    
    // Promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.recordError({
        type: 'unhandled-rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        context: {
          promise: String(event.promise)
        }
      });
    });
  }

  public recordError(error: Omit<ErrorMetric, 'timestamp'>): void {
    if (!this.privacySettings.collectErrors) return;
    
    const errorMetric: ErrorMetric = {
      ...error,
      timestamp: Date.now()
    };
    
    // Anonymize if needed
    if (this.privacySettings.anonymizeData) {
      errorMetric.stack = this.anonymizeStackTrace(errorMetric.stack);
    }
    
    this.errors.push(errorMetric);
    
    // Maintain max errors
    if (this.errors.length > this.MAX_ERRORS) {
      this.errors.shift();
    }
    
    // Also track in performance tracker
    performanceTracker.incrementOperationCount(`error-${error.type}`, false);
  }

  private anonymizeStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;
    
    // Remove file paths and keep only relative paths
    return stack.replace(/file:\/\/[^\s]+/g, '<file>')
               .replace(/https?:\/\/[^\s]+/g, '<url>')
               .replace(/\/Users\/[^\s]+/g, '<path>')
               .replace(/C:\\[^\s]+/g, '<path>');
  }

  public recordUserAction(action: string, details?: Record<string, unknown>): void {
    if (!this.privacySettings.collectAnalytics) return;

    const userAction: UserAction = {
      timestamp: Date.now(),
      action,
      details: this.privacySettings.anonymizeData ? this.anonymizeDetails(details) : details
    };

    this.userActions.push(userAction);

    // Maintain max user actions
    if (this.userActions.length > this.MAX_USER_ACTIONS) {
      this.userActions.shift();
    }
  }

  private anonymizeDetails(details?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!details) return undefined;
    
    const anonymized: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(details)) {
      // Remove potentially sensitive keys
      if (['url', 'videoId', 'userId', 'email'].includes(key)) {
        anonymized[key] = '<redacted>';
      } else if (typeof value === 'string' && value.includes('http')) {
        anonymized[key] = '<url>';
      } else {
        anonymized[key] = value;
      }
    }
    
    return anonymized;
  }

  public incrementFrameCount(count: number = 1): void {
    this.frameCount += count;
    this.metrics.totalFramesProcessed = this.frameCount;
  }

  public incrementGifCount(): void {
    this.gifCount++;
    this.metrics.totalGifsCreated = this.gifCount;
    
    // Track user action
    this.recordUserAction('gif-created', {
      totalCreated: this.gifCount,
      sessionDuration: Date.now() - this.startTime
    });
  }

  public trackFrameExtraction(frameNumber: number, duration: number, success: boolean): void {
    if (!this.privacySettings.collectPerformance) return;
    
    performanceTracker.recordFrameExtraction(frameNumber, duration, success);
    
    if (success) {
      this.incrementFrameCount();
    }
  }

  public trackEncodingPhase(
    phase: 'quantization' | 'palette' | 'encoding' | 'optimization',
    duration: number,
    metadata?: Record<string, unknown>
  ): void {
    if (!this.privacySettings.collectPerformance) return;
    
    performanceTracker.recordEncodingMetric(phase, duration, metadata);
  }

  // Start performance timer
  public startOperation(operationId: string): void {
    if (!this.privacySettings.collectPerformance) return;
    
    performanceTracker.startTimer(operationId);
  }

  // End performance timer
  public endOperation(
    operationId: string,
    category: PerformanceMetric['category'],
    metadata?: Record<string, unknown>
  ): number {
    if (!this.privacySettings.collectPerformance) return -1;
    
    return performanceTracker.endTimer(operationId, category, metadata);
  }

  // Get current collected metrics
  public getMetrics(): CollectedMetrics {
    return {
      ...this.metrics,
      endTime: Date.now(),
      errors: [...this.errors],
      userActions: [...this.userActions]
    };
  }

  // Subscribe to metrics updates
  public subscribe(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    
    // Send initial metrics
    listener(this.getMetrics());
    
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Notify listeners
  private notifyListeners(): void {
    const metrics = this.getMetrics();
    
    this.listeners.forEach(listener => {
      try {
        listener(metrics);
      } catch (error) {
        console.error('[MetricsCollector] Error in listener:', error);
      }
    });
  }

  // Start batch timer for periodic updates
  private startBatchTimer(): void {
    if (this.batchTimer) return;
    
    this.batchTimer = window.setInterval(() => {
      this.notifyListeners();
      this.sendAnalytics();
    }, this.BATCH_INTERVAL_MS);
  }

  // Stop batch timer
  private stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // Send analytics (privacy-compliant)
  private async sendAnalytics(): Promise<void> {
    if (!this.privacySettings.collectAnalytics) return;
    
    const metrics = this.getMetrics();
    
    // Only send non-sensitive, aggregated data
    const payload = {
      sessionId: this.privacySettings.anonymizeData ? 'anonymous' : metrics.sessionId,
      duration: metrics.endTime - metrics.startTime,
      totalFrames: metrics.totalFramesProcessed,
      totalGifs: metrics.totalGifsCreated,
      avgProcessingTime: metrics.averageProcessingTime,
      peakMemory: metrics.peakMemoryUsage,
      errorCount: metrics.errors.length,
      actionCount: metrics.userActions.length,
      systemInfo: this.privacySettings.anonymizeData 
        ? { platform: metrics.systemInfo.platform }
        : metrics.systemInfo
    };
    
    // Send to analytics endpoint (if configured)
    try {
      // This would be replaced with actual analytics endpoint
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'ANALYTICS',
          data: payload
        });
      }
    } catch {
      // Silently ignore metrics collection errors
    }
  }

  // Generate user-facing performance report
  public generateUserReport(): {
    summary: string;
    stats: Record<string, string | number>;
    recommendations: string[];
  } {
    const metrics = this.getMetrics();
    const performanceReport = performanceTracker.generateReport();

    const duration = metrics.endTime - metrics.startTime;
    const durationMinutes = Math.floor(duration / 60000);

    const stats = {
      'Session Duration': `${durationMinutes} minutes`,
      'GIFs Created': metrics.totalGifsCreated,
      'Frames Processed': metrics.totalFramesProcessed,
      'Avg Processing Time': `${Math.round(metrics.averageProcessingTime)}ms`,
      'Peak Memory Usage': `${Math.round(metrics.peakMemoryUsage)}MB`,
      'Success Rate': `${Math.round(performanceReport.summary.successRate)}%`
    };

    const summary = metrics.totalGifsCreated > 0
      ? `You've created ${metrics.totalGifsCreated} GIF${metrics.totalGifsCreated > 1 ? 's' : ''} in ${durationMinutes} minutes!`
      : 'Start creating GIFs to see your performance stats!';

    return {
      summary,
      stats,
      recommendations: performanceReport.recommendations
    };
  }

  // Export all metrics for debugging
  public exportForDebugging(): Record<string, unknown> {
    return {
      collected: this.getMetrics(),
      performance: performanceTracker.exportMetrics(),
      privacySettings: this.privacySettings,
      timestamp: Date.now()
    };
  }

  // Reset metrics
  public reset(): void {
    this.sessionId = this.generateSessionId();
    this.startTime = Date.now();
    this.metrics = this.initializeMetrics();
    this.errors = [];
    this.userActions = [];
    this.frameCount = 0;
    this.gifCount = 0;
    this.peakMemory = 0;
    
    performanceTracker.clear();
    this.notifyListeners();
  }

  // Clean up
  public destroy(): void {
    this.stopBatchTimer();
    
    if (this.unsubscribePerformance) {
      this.unsubscribePerformance();
      this.unsubscribePerformance = null;
    }
    
    this.listeners.clear();
    performanceTracker.destroy();
  }
}

export const metricsCollector = MetricsCollector.getInstance();