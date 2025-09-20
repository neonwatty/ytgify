import { ExtensionError, createError } from '../lib/errors';
import { sharedLogger } from './logger';

interface ErrorRecoveryStrategy {
  maxRetries?: number;
  delayMs?: number;
  exponentialBackoff?: boolean;
  fallbackAction?: () => void | Promise<void>;
}

interface UserFeedback {
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: () => void | Promise<void>;
  }>;
  persistent?: boolean;
}

class SharedErrorHandler {
  private static instance: SharedErrorHandler;
  private userFeedbackQueue: UserFeedback[] = [];
  private errorReportingEnabled = true;
  private criticalErrorCount = 0;
  private maxCriticalErrors = 5;

  private constructor() {
    this.setupGlobalErrorHandlers();
    this.loadSettings();
  }

  public static getInstance(): SharedErrorHandler {
    if (!SharedErrorHandler.instance) {
      SharedErrorHandler.instance = new SharedErrorHandler();
    }
    return SharedErrorHandler.instance;
  }

  private setupGlobalErrorHandlers(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.handleGlobalError(event.error || new Error(event.message), {
          source: 'global_error_handler',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.handleGlobalError(event.reason, {
          source: 'unhandled_promise_rejection',
        });
        event.preventDefault();
      });
    }

    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
        if (message.type === 'ERROR_REPORT') {
          this.handleRemoteError(message.data);
        }
      });
    }
  }

  private async loadSettings(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get(['errorReportingEnabled']);
      this.errorReportingEnabled = result.errorReportingEnabled ?? true;
    } catch {
      this.errorReportingEnabled = true;
    }
  }

  public handleError(
    error: unknown,
    context?: Record<string, unknown>,
    strategy?: ErrorRecoveryStrategy
  ): ExtensionError {
    const processedError = this.processError(error, context);

    sharedLogger.error(processedError.message, {
      code: processedError.code,
      ...processedError.context,
      ...context,
    });

    sharedLogger.trackError(processedError, context);

    if (this.isCriticalError(processedError)) {
      this.criticalErrorCount++;
      this.handleCriticalError(processedError);
    }

    if (this.errorReportingEnabled) {
      this.reportError(processedError).catch(() => {
        // Ignore reporting errors
      });
    }

    if (strategy?.fallbackAction) {
      try {
        const result = strategy.fallbackAction();
        if (result && typeof result.then === 'function') {
          result.catch(() => {
            // Ignore fallback errors
          });
        }
      } catch (fallbackError) {
        sharedLogger.warn('Fallback action failed', {
          originalError: processedError.message,
          fallbackError:
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        });
      }
    }

    return processedError;
  }

  private processError(error: unknown, context?: Record<string, unknown>): ExtensionError {
    if (error instanceof ExtensionError) {
      if (context) {
        return new ExtensionError(error.message, error.code, { ...error.context, ...context });
      }
      return error;
    }

    if (error instanceof Error) {
      return createError('generic', error.message, {
        originalName: error.name,
        stack: error.stack,
        ...context,
      });
    }

    const errorMessage = typeof error === 'string' ? error : 'Unknown error occurred';
    return createError('generic', errorMessage, {
      originalError: error,
      ...context,
    });
  }

  private isCriticalError(error: ExtensionError): boolean {
    const criticalCodes = ['CHROME_API_ERROR', 'SERVICE_WORKER_ERROR', 'STORAGE_ERROR'];
    return criticalCodes.includes(error.code) || error.message.toLowerCase().includes('critical');
  }

  private handleCriticalError(error: ExtensionError): void {
    this.showUserFeedback({
      type: 'error',
      title: 'Critical Error',
      message: `A critical error occurred: ${error.message}`,
      actions: [
        {
          label: 'Report Issue',
          action: () => this.openErrorReportDialog(error),
        },
        {
          label: 'Restart Extension',
          action: () => this.restartExtension(),
        },
      ],
      persistent: true,
    });

    if (this.criticalErrorCount >= this.maxCriticalErrors) {
      this.handleTooManyCriticalErrors();
    }
  }

  private handleTooManyCriticalErrors(): void {
    sharedLogger.error('Too many critical errors detected, entering safe mode');
    this.showUserFeedback({
      type: 'error',
      title: 'Extension Unstable',
      message: 'Multiple critical errors detected. The extension may be unstable.',
      actions: [
        {
          label: 'Reset Extension',
          action: () => this.resetExtension(),
        },
        {
          label: 'Disable Extension',
          action: () => this.disableExtension(),
        },
      ],
      persistent: true,
    });
  }

  public async withRecovery<T>(
    operation: () => Promise<T>,
    strategy: ErrorRecoveryStrategy = {}
  ): Promise<T> {
    const { maxRetries = 3, delayMs = 1000, exponentialBackoff = true, fallbackAction } = strategy;

    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        if (attempt === maxRetries) {
          const processedError = this.handleError(error, {
            operation: 'recovery_operation',
            attempt,
            maxRetries,
          });

          if (fallbackAction) {
            await fallbackAction();
          }

          throw processedError;
        }

        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt) : delayMs;

        sharedLogger.warn(
          `Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`,
          {
            error: error instanceof Error ? error.message : String(error),
          }
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  public wrapWithErrorBoundary<T extends unknown[], R>(
    fn: (...args: T) => Promise<R>,
    strategy?: ErrorRecoveryStrategy
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      try {
        return await fn(...args);
      } catch (error) {
        const processedError = this.handleError(
          error,
          {
            functionName: fn.name,
            arguments: args,
          },
          strategy
        );

        if (strategy?.fallbackAction) {
          await strategy.fallbackAction();
        }

        throw processedError;
      }
    };
  }

  public showUserFeedback(feedback: UserFeedback): void {
    this.userFeedbackQueue.push(feedback);
    sharedLogger.info(`User feedback queued: ${feedback.title}`, { type: feedback.type });

    this.broadcastUserFeedback(feedback);
  }

  private broadcastUserFeedback(feedback: UserFeedback): void {
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime
        .sendMessage({
          type: 'USER_FEEDBACK',
          data: feedback,
        })
        .catch(() => {
          // Message might not be received if popup is closed
        });
    }
  }

  public getUserFeedbackQueue(): UserFeedback[] {
    return [...this.userFeedbackQueue];
  }

  public clearUserFeedback(index?: number): void {
    if (typeof index === 'number') {
      this.userFeedbackQueue.splice(index, 1);
    } else {
      this.userFeedbackQueue = [];
    }
  }

  private handleGlobalError(error: unknown, context?: Record<string, unknown>): void {
    this.handleError(error, {
      ...context,
      source: 'global_error_handler',
    });
  }

  private handleRemoteError(errorData: unknown): void {
    sharedLogger.warn('Received remote error report', { errorData });

    if (typeof errorData === 'object' && errorData !== null) {
      const error = createError(
        'generic',
        'Remote error reported',
        errorData as Record<string, unknown>
      );
      this.handleError(error, { source: 'remote_error' });
    }
  }

  private async reportError(error: ExtensionError): Promise<void> {
    try {
      const report = {
        error: error.toJSON(),
        diagnostics: await sharedLogger.exportDiagnostics(),
        timestamp: new Date().toISOString(),
      };

      await chrome.storage.local.set({
        [`error_report_${Date.now()}`]: report,
      });

      sharedLogger.info('Error report stored', { errorCode: error.code });
    } catch (reportingError) {
      sharedLogger.warn('Failed to report error', {
        reportingError:
          reportingError instanceof Error ? reportingError.message : String(reportingError),
      });
    }
  }

  private async openErrorReportDialog(error: ExtensionError): Promise<void> {
    const diagnostics = await sharedLogger.exportDiagnostics();
    const mailtoLink = this.createErrorReportEmail(error, diagnostics);

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.create({ url: mailtoLink });
    } else if (typeof window !== 'undefined') {
      window.open(mailtoLink, '_blank');
    }
  }

  private createErrorReportEmail(error: ExtensionError, diagnostics: string): string {
    const subject = encodeURIComponent(`YTgify Extension Error: ${error.code}`);
    const body = encodeURIComponent(`
Error Report:
- Code: ${error.code}
- Message: ${error.message}
- Timestamp: ${error.timestamp.toISOString()}

Please describe what you were doing when this error occurred:
[Your description here]

Technical Details:
${diagnostics}
    `);

    return `mailto:support@example.com?subject=${subject}&body=${body}`;
  }

  private async restartExtension(): Promise<void> {
    sharedLogger.info('Restarting extension...');
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.reload();
    }
  }

  private async resetExtension(): Promise<void> {
    sharedLogger.info('Resetting extension data...');

    try {
      await chrome.storage.local.clear();
      await chrome.storage.sync.clear();
      this.criticalErrorCount = 0;
      this.clearUserFeedback();
      sharedLogger.clearPerformanceMetrics();
      sharedLogger.clearAnalyticsEvents();
    } catch (error) {
      sharedLogger.error('Failed to reset extension data', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async disableExtension(): Promise<void> {
    sharedLogger.info('Disabling extension...');

    if (typeof chrome !== 'undefined' && chrome.management) {
      try {
        const extensionInfo = await chrome.management.getSelf();
        await chrome.management.setEnabled(extensionInfo.id, false);
      } catch (error) {
        sharedLogger.error('Failed to disable extension', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  public async setErrorReporting(enabled: boolean): Promise<void> {
    this.errorReportingEnabled = enabled;
    try {
      await chrome.storage.sync.set({ errorReportingEnabled: enabled });
      sharedLogger.info(`Error reporting ${enabled ? 'enabled' : 'disabled'}`);
    } catch (error) {
      sharedLogger.error('Failed to save error reporting setting', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  public getErrorStats(): {
    totalErrors: number;
    criticalErrors: number;
    recentErrors: ExtensionError[];
  } {
    const logs = sharedLogger
      .getAnalyticsEvents()
      .filter((event) => event.eventName === 'error_occurred');
    const recentErrors: ExtensionError[] = [];

    return {
      totalErrors: logs.length,
      criticalErrors: this.criticalErrorCount,
      recentErrors,
    };
  }
}

export const sharedErrorHandler = SharedErrorHandler.getInstance();

function _withErrorBoundary<T extends unknown[], R>(
  operation: (...args: T) => Promise<R>,
  strategy?: ErrorRecoveryStrategy
): (...args: T) => Promise<R> {
  return sharedErrorHandler.wrapWithErrorBoundary(operation, strategy);
}

function _errorBoundaryDecorator(strategy?: ErrorRecoveryStrategy) {
  return function (target: unknown, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]) {
      const result = originalMethod.apply(this, args);

      if (result && typeof result.then === 'function') {
        return result.catch((error: unknown) => {
          const processedError = sharedErrorHandler.handleError(
            error,
            {
              className: target?.constructor?.name,
              methodName: propertyName,
              arguments: args,
            },
            strategy
          );

          if (strategy?.fallbackAction) {
            const fallback = strategy.fallbackAction();
            if (fallback && typeof fallback.then === 'function') {
              return fallback.catch(() => {
                throw processedError;
              });
            }
          }

          throw processedError;
        });
      }

      return result;
    };

    return descriptor;
  };
}
