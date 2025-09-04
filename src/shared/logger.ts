import { logger as libLogger, LogLevel, LogEntry } from '../lib/logger';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

export interface AnalyticsEvent {
  eventName: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
}

class SharedLogger {
  private static instance: SharedLogger;
  private performanceBuffer: PerformanceMetric[] = [];
  private analyticsBuffer: AnalyticsEvent[] = [];
  private maxBufferSize = 50;
  private isAnalyticsEnabled = false;

  private constructor() {
    this.initializeAnalyticsSettings();
  }

  public static getInstance(): SharedLogger {
    if (!SharedLogger.instance) {
      SharedLogger.instance = new SharedLogger();
    }
    return SharedLogger.instance;
  }

  private async initializeAnalyticsSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['analyticsEnabled']);
      this.isAnalyticsEnabled = result.analyticsEnabled ?? false;
    } catch (error) {
      this.isAnalyticsEnabled = false;
    }
  }

  public log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>,
    source: LogEntry['source'] = 'background'
  ): void {
    libLogger.log(level, message, context, source);
  }

  public debug(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    libLogger.debug(message, context, source);
  }

  public info(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    libLogger.info(message, context, source);
  }

  public warn(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    libLogger.warn(message, context, source);
  }

  public error(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    libLogger.error(message, context, source);
  }

  public trackPerformance(name: string, startTime: number, context?: Record<string, unknown>): void {
    const duration = performance.now() - startTime;
    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      context
    };

    this.performanceBuffer.push(metric);
    
    if (this.performanceBuffer.length > this.maxBufferSize) {
      this.performanceBuffer.shift();
    }

    this.debug(`Performance: ${name} took ${duration.toFixed(2)}ms`, context);

    if (duration > 1000) {
      this.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`, context);
    }
  }

  public async startPerformanceTimer(name: string): Promise<() => void> {
    const startTime = performance.now();
    return () => this.trackPerformance(name, startTime);
  }

  public trackEvent(eventName: string, properties?: Record<string, unknown>): void {
    if (!this.isAnalyticsEnabled) {
      return;
    }

    const event: AnalyticsEvent = {
      eventName,
      properties,
      timestamp: new Date()
    };

    this.analyticsBuffer.push(event);
    
    if (this.analyticsBuffer.length > this.maxBufferSize) {
      this.analyticsBuffer.shift();
    }

    this.debug(`Analytics event: ${eventName}`, properties);
  }

  public trackUserAction(action: string, context?: Record<string, unknown>): void {
    this.trackEvent('user_action', { action, ...context });
  }

  public trackFeatureUsage(feature: string, context?: Record<string, unknown>): void {
    this.trackEvent('feature_usage', { feature, ...context });
  }

  public trackError(error: Error, context?: Record<string, unknown>): void {
    this.trackEvent('error_occurred', {
      errorName: error.name,
      errorMessage: error.message,
      ...context
    });
  }

  public getPerformanceMetrics(): PerformanceMetric[] {
    return [...this.performanceBuffer];
  }

  public getAnalyticsEvents(): AnalyticsEvent[] {
    if (!this.isAnalyticsEnabled) {
      return [];
    }
    return [...this.analyticsBuffer];
  }

  public clearPerformanceMetrics(): void {
    this.performanceBuffer = [];
  }

  public clearAnalyticsEvents(): void {
    this.analyticsBuffer = [];
  }

  public async setAnalyticsEnabled(enabled: boolean): Promise<void> {
    this.isAnalyticsEnabled = enabled;
    try {
      await chrome.storage.sync.set({ analyticsEnabled: enabled });
      this.info(`Analytics ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      this.error('Failed to save analytics setting', { error: error instanceof Error ? error.message : String(error) });
    }
  }

  public isAnalyticsEnabledSync(): boolean {
    return this.isAnalyticsEnabled;
  }

  public async exportDiagnostics(): Promise<string> {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      logs: libLogger.getLogBuffer(),
      performance: this.getPerformanceMetrics(),
      analytics: this.isAnalyticsEnabled ? this.getAnalyticsEvents() : [],
      systemInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        chrome: {
          runtime: !!chrome?.runtime,
          storage: !!chrome?.storage
        }
      }
    };

    return JSON.stringify(diagnostics, null, 2);
  }
}

export const sharedLogger = SharedLogger.getInstance();

export function withPerformanceTracking<T extends unknown[], R>(
  name: string,
  fn: (...args: T) => R | Promise<R>
): (...args: T) => R | Promise<R> {
  return async (...args: T): Promise<R> => {
    const endTimer = await sharedLogger.startPerformanceTimer(name);
    try {
      const result = await fn(...args);
      endTimer();
      return result;
    } catch (error) {
      endTimer();
      sharedLogger.trackError(error as Error, { operation: name });
      throw error;
    }
  };
}

export function performanceDecorator(name?: string) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const metricName = name || `${target?.constructor?.name || 'Unknown'}.${propertyName}`;

    descriptor.value = function (...args: unknown[]) {
      const result = originalMethod.apply(this, args);
      
      if (result && typeof result.then === 'function') {
        return (async () => {
          const endTimer = await sharedLogger.startPerformanceTimer(metricName);
          try {
            const awaited = await result;
            endTimer();
            return awaited;
          } catch (error) {
            endTimer();
            sharedLogger.trackError(error as Error, { operation: metricName });
            throw error;
          }
        })();
      } else {
        const startTime = performance.now();
        sharedLogger.trackPerformance(metricName, startTime);
        return result;
      }
    };

    return descriptor;
  };
}