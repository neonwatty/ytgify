// Extension-specific error classes and handling utilities

export class ExtensionError extends Error {
  public readonly code: string;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(message: string, code: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'ExtensionError';
    this.code = code;
    this.context = context;
    this.timestamp = new Date();
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

class VideoProcessingError extends ExtensionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'VIDEO_PROCESSING_ERROR', context);
    this.name = 'VideoProcessingError';
  }
}

class GifCreationError extends ExtensionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'GIF_CREATION_ERROR', context);
    this.name = 'GifCreationError';
  }
}

class StorageError extends ExtensionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'STORAGE_ERROR', context);
    this.name = 'StorageError';
  }
}

class MessagePassingError extends ExtensionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'MESSAGE_PASSING_ERROR', context);
    this.name = 'MessagePassingError';
  }
}

class YouTubeIntegrationError extends ExtensionError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'YOUTUBE_INTEGRATION_ERROR', context);
    this.name = 'YouTubeIntegrationError';
  }
}

// Error handling utilities
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorReportingEnabled = true;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Wrap async functions with error handling
  public wrapAsync<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    context?: Record<string, unknown>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }

  // Wrap synchronous functions with error handling
  public wrapSync<T extends unknown[], R>(
    fn: (...args: T) => R,
    context?: Record<string, unknown>
  ): (...args: T) => R {
    return (...args: T): R => {
      try {
        return fn(...args);
      } catch (error) {
        this.handleError(error, context);
        throw error;
      }
    };
  }

  // Handle and report errors
  public handleError(error: unknown, context?: Record<string, unknown>): void {
    const processedError = this.processError(error, context);
    
    // Log error details
    console.error('[ErrorHandler] Error occurred:', processedError);

    // Store error for debugging
    this.storeError(processedError).catch(() => {
      // Ignore storage errors
    });

    // Report to extension logging system if available
    if (this.errorReportingEnabled) {
      this.reportError(processedError).catch(() => {
        // Ignore reporting errors
      });
    }
  }

  private processError(error: unknown, context?: Record<string, unknown>): ExtensionError {
    if (error instanceof ExtensionError) {
      // Already processed error, just add additional context if needed
      if (context && error.context) {
        return new ExtensionError(
          error.message,
          error.code,
          { ...error.context, ...context }
        );
      }
      return error;
    }

    if (error instanceof Error) {
      // Convert standard Error to ExtensionError
      return new ExtensionError(
        error.message,
        'GENERIC_ERROR',
        {
          originalName: error.name,
          stack: error.stack,
          ...context
        }
      );
    }

    // Handle unknown error types
    const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
    return new ExtensionError(
      errorMessage,
      'UNKNOWN_ERROR',
      {
        originalError: error,
        ...context
      }
    );
  }

  private async storeError(error: ExtensionError): Promise<void> {
    try {
      const storageKey = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      await chrome.storage.local.set({
        [storageKey]: {
          ...error.toJSON(),
          userAgent: navigator.userAgent,
          url: window.location?.href,
          timestamp: error.timestamp.toISOString()
        }
      });
    } catch (storageError) {
      console.warn('[ErrorHandler] Failed to store error:', storageError);
    }
  }

  private async reportError(error: ExtensionError): Promise<void> {
    try {
      // Send error to background script for centralized logging
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'LOG',
          data: {
            level: 'error',
            message: `${error.name}: ${error.message}`,
            context: {
              code: error.code,
              ...error.context
            }
          }
        }).catch(() => {
          // Ignore message sending errors
        });
      }
    } catch (reportingError) {
      console.warn('[ErrorHandler] Failed to report error:', reportingError);
    }
  }

  public setErrorReporting(enabled: boolean): void {
    this.errorReportingEnabled = enabled;
  }

  // Utility for handling Chrome API errors
  public checkChromeError(operation: string): void {
    if (chrome.runtime.lastError) {
      throw new ExtensionError(
        `Chrome API error during ${operation}: ${chrome.runtime.lastError.message}`,
        'CHROME_API_ERROR',
        {
          operation,
          chromeError: chrome.runtime.lastError.message
        }
      );
    }
  }

  // Recovery utilities
  public async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    delayMs = 1000,
    context?: Record<string, unknown>
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxRetries) {
          // Final attempt failed
          this.handleError(error, {
            ...context,
            operation: 'retry_operation',
            attempt,
            maxRetries
          });
          throw error;
        }

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, attempt)));
      }
    }

    throw lastError;
  }
}

// Singleton instance
export const errorHandler = ErrorHandler.getInstance();

// Utility functions
export function createError(
  type: 'video' | 'gif' | 'storage' | 'messaging' | 'youtube' | 'generic',
  message: string,
  context?: Record<string, unknown>
): ExtensionError {
  switch (type) {
    case 'video':
      return new VideoProcessingError(message, context);
    case 'gif':
      return new GifCreationError(message, context);
    case 'storage':
      return new StorageError(message, context);
    case 'messaging':
      return new MessagePassingError(message, context);
    case 'youtube':
      return new YouTubeIntegrationError(message, context);
    default:
      return new ExtensionError(message, 'GENERIC_ERROR', context);
  }
}

// Decorator for automatic error handling
function _handleErrors(
  target: unknown,
  propertyName: string,
  descriptor: PropertyDescriptor
): PropertyDescriptor {
  const method = descriptor.value;

  descriptor.value = function (...args: unknown[]) {
    try {
      const result = method.apply(this, args);
      
      // Handle async methods
      if (result && typeof result.then === 'function') {
        return result.catch((error: unknown) => {
          errorHandler.handleError(error, {
            className: target?.constructor?.name,
            methodName: propertyName,
            arguments: args
          });
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      errorHandler.handleError(error, {
        className: target?.constructor?.name,
        methodName: propertyName,
        arguments: args
      });
      throw error;
    }
  };

  return descriptor;
}