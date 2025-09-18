import { logger as libLogger, LogLevel as LibLogLevel, LogEntry } from '../lib/logger';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: Date;
  context?: Record<string, unknown>;
}

interface AnalyticsEvent {
  eventName: string;
  properties?: Record<string, unknown>;
  timestamp: Date;
  userId?: string;
}

export class Logger {
  private static globalLevel: LogLevel = LogLevel.INFO;
  private static useGlobalLevel: boolean = false;
  private name: string;
  private level: LogLevel | null = null;
  private timestampEnabled: boolean = false;
  private prefix: string = '';
  private filter: RegExp | null = null;
  private timers: Map<string, number> = new Map();

  constructor(name: string, level?: LogLevel) {
    this.name = name;
    if (level !== undefined) {
      this.level = level;
    } else if (!Logger.useGlobalLevel) {
      // Set default level based on environment only if not using global level
      const env = typeof process !== 'undefined' ? process.env?.NODE_ENV : undefined;
      if (env === 'production') {
        this.level = LogLevel.WARN;
      } else if (env === 'development') {
        this.level = LogLevel.DEBUG;
      }
      // If env is undefined or 'test', don't set a level, use global default
    }
  }

  static setGlobalLevel(level: LogLevel): void {
    Logger.globalLevel = level;
    Logger.useGlobalLevel = true;
  }

  static resetGlobalSettings(): void {
    Logger.globalLevel = LogLevel.INFO;
    Logger.useGlobalLevel = false;
  }

  getName(): string {
    return this.name;
  }

  getLevel(): LogLevel {
    if (Logger.useGlobalLevel && this.level === null) {
      return Logger.globalLevel;
    }
    return this.level ?? Logger.globalLevel;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  enableTimestamp(enabled: boolean): void {
    this.timestampEnabled = enabled;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  setFilter(filter: RegExp): void {
    this.filter = filter;
  }

  clearFilter(): void {
    this.filter = null;
  }

  isProduction(): boolean {
    return typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  }

  child(name: string): Logger {
    const childLogger = new Logger(`${this.name}:${name}`);
    childLogger.level = this.level;
    childLogger.timestampEnabled = this.timestampEnabled;
    childLogger.prefix = this.prefix;
    childLogger.filter = this.filter;
    return childLogger;
  }

  private shouldLog(level: LogLevel): boolean {
    const currentLevel = this.getLevel();
    return level >= currentLevel;
  }

  private formatPrefix(): string {
    let fullPrefix = '';
    
    if (this.timestampEnabled) {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const seconds = now.getSeconds().toString().padStart(2, '0');
      const ms = now.getMilliseconds().toString().padStart(3, '0');
      fullPrefix += `[${hours}:${minutes}:${seconds}.${ms}] `;
    }
    
    if (this.prefix) {
      fullPrefix += `${this.prefix} `;
    }
    
    fullPrefix += `[${this.name}]`;
    
    return fullPrefix;
  }

  private getLogLevelString(level: LogLevel): string {
    switch (level) {
      case LogLevel.DEBUG:
        return 'DEBUG';
      case LogLevel.INFO:
        return 'INFO';
      case LogLevel.WARN:
        return 'WARN';
      case LogLevel.ERROR:
        return 'ERROR';
      default:
        return 'UNKNOWN';
    }
  }

  private doLog(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    if (this.filter && !this.filter.test(message)) {
      return;
    }

    const prefix = `${this.formatPrefix()} [${this.getLogLevelString(level)}]`;
    
    try {
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(prefix, message, ...args);
          break;
        case LogLevel.INFO:
          console.info(prefix, message, ...args);
          break;
        case LogLevel.WARN:
          console.warn(prefix, message, ...args);
          break;
        case LogLevel.ERROR:
          console.error(prefix, message, ...args);
          break;
      }
    } catch {
      // Silently ignore logging errors
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.doLog(LogLevel.DEBUG, message, ...args);
  }

  info(message: string, ...args: unknown[]): void {
    this.doLog(LogLevel.INFO, message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.doLog(LogLevel.WARN, message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.doLog(LogLevel.ERROR, message, ...args);
  }

  time(label: string): void {
    this.timers.set(label, performance.now());
  }

  timeEnd(label: string): void {
    const startTime = this.timers.get(label);
    if (startTime === undefined) {
      this.warn(`Timer "${label}" does not exist`);
      return;
    }

    const duration = performance.now() - startTime;
    this.timers.delete(label);
    this.info(`${label}:`, `${Math.round(duration)}ms`);
  }

  group(label: string): void {
    console.group(`[${this.name}] ${label}`);
  }

  groupCollapsed(label: string): void {
    console.groupCollapsed(`[${this.name}] ${label}`);
  }

  groupEnd(): void {
    console.groupEnd();
  }

  destroy(): void {
    this.timers.clear();
  }
}

// SharedLogger class for backwards compatibility
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
    } catch {
      this.isAnalyticsEnabled = false;
    }
  }

  public log(
    level: LibLogLevel,
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

function _withPerformanceTracking<T extends unknown[], R>(
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

function _performanceDecorator(name?: string) {
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