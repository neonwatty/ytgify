// Centralized logging utility for Chrome Extension
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  source: 'background' | 'content' | 'popup';
}

export class Logger {
  private static instance: Logger;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;
  private isDevelopment = process.env.NODE_ENV === 'development';

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public log(
    level: LogLevel, 
    message: string, 
    context?: Record<string, unknown>, 
    source: LogEntry['source'] = 'background'
  ): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      source
    };

    // Add to buffer
    this.addToBuffer(entry);

    // Console output based on environment
    if (this.isDevelopment || level === 'error') {
      this.outputToConsole(entry);
    }

    // Store critical errors
    if (level === 'error') {
      this.storeError(entry).catch(() => {
        // Ignore storage errors to prevent recursion
      });
    }
  }

  public debug(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.log('debug', message, context, source);
  }

  public info(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.log('info', message, context, source);
  }

  public warn(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.log('warn', message, context, source);
  }

  public error(message: string, context?: Record<string, unknown>, source?: LogEntry['source']): void {
    this.log('error', message, context, source);
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  private outputToConsole(entry: LogEntry): void {
    const logMethod = console[entry.level] || console.log;
    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.source.toUpperCase()}] [${entry.level.toUpperCase()}]`;
    
    if (entry.context) {
      logMethod(`${prefix} ${entry.message}`, entry.context);
    } else {
      logMethod(`${prefix} ${entry.message}`);
    }
  }

  private async storeError(entry: LogEntry): Promise<void> {
    try {
      // Only store errors in Chrome storage for debugging
      const storageKey = `error_${Date.now()}`;
      const errorData = {
        ...entry,
        timestamp: entry.timestamp.toISOString()
      };

      await chrome.storage.local.set({ [storageKey]: errorData });

      // Clean up old errors (keep only last 20)
      const result = await chrome.storage.local.get(null);
      const errorKeys = Object.keys(result).filter(key => key.startsWith('error_'));
      
      if (errorKeys.length > 20) {
        const sortedKeys = errorKeys.sort();
        const keysToRemove = sortedKeys.slice(0, errorKeys.length - 20);
        
        for (const key of keysToRemove) {
          await chrome.storage.local.remove(key);
        }
      }
    } catch {
      // Silently fail if storage is not available
    }
  }

  public getLogBuffer(): LogEntry[] {
    return [...this.logBuffer];
  }

  public clearLogBuffer(): void {
    this.logBuffer = [];
  }

  public async exportLogs(): Promise<string> {
    const logs = this.getLogBuffer();
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: logs.length,
      logs
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

// Singleton instance
export const logger = Logger.getInstance();