import { ExtensionMessage } from '@/types';
import { messageHandler } from './message-handler';
import { backgroundWorker } from './worker';
import { logger } from '@/lib/logger';
import { initializeMessageBus } from '@/shared/message-bus';
import { sharedLogger, sharedErrorHandler, extensionStateManager } from '@/shared';
import { engagementTracker } from '@/shared/engagement-tracker';
import { databaseCleanup } from '@/shared/database-cleanup';
import { TokenManager } from './token-manager';
import { StorageAdapter } from '@/lib/storage/storage-adapter';
import { apiClient } from '@/lib/api/api-client';

// Service Worker lifecycle events with enhanced logging and error handling
chrome.runtime.onInstalled.addListener(
  sharedErrorHandler.wrapWithErrorBoundary(
    async (details) => {
      const endTimer = await sharedLogger.startPerformanceTimer('extension_installation');

      try {
        sharedLogger.info(
          '[Background] YTgify extension installed',
          {
            reason: details.reason,
            version: chrome.runtime.getManifest().version,
          },
          'background'
        );

        sharedLogger.trackEvent('extension_installed', {
          reason: details.reason,
          version: chrome.runtime.getManifest().version,
        });

        // Initialize default storage
        await initializeStorage();

        if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
          // First install - log the event without opening a tab
          sharedLogger.info('[Background] First install completed', {}, 'background');
          sharedLogger.trackUserAction('first_install');

          // Initialize engagement tracking
          await engagementTracker.initializeEngagement();
          sharedLogger.info('[Background] Engagement tracking initialized', {}, 'background');

          // Set up token refresh alarm
          await TokenManager.setupTokenRefreshAlarm();
          sharedLogger.info('[Background] Token refresh alarm initialized', {}, 'background');
        }

        // Handle extension updates - clean up old IndexedDB data
        if (details.reason === chrome.runtime.OnInstalledReason.UPDATE) {
          // Skip cleanup if this is a development reload (no previous version means fresh load)
          const previousVersion = details.previousVersion;

          if (!previousVersion) {
            sharedLogger.info(
              '[Background] Skipping IndexedDB cleanup - no previous version (development reload)',
              { version: chrome.runtime.getManifest().version },
              'background'
            );
          } else {
            try {
              // Check if database exists first
              const dbExists = await databaseCleanup.databaseExists();

              if (!dbExists) {
                sharedLogger.info(
                  '[Background] No IndexedDB to cleanup - database does not exist',
                  { version: chrome.runtime.getManifest().version, previousVersion },
                  'background'
                );
              } else {
                sharedLogger.info(
                  '[Background] Extension updated - cleaning up IndexedDB',
                  { version: chrome.runtime.getManifest().version, previousVersion },
                  'background'
                );

                const deleted = await databaseCleanup.deleteDatabase();

                if (deleted) {
                  sharedLogger.info(
                    '[Background] IndexedDB cleanup completed successfully',
                    {},
                    'background'
                  );
                  sharedLogger.trackEvent('indexeddb_cleanup_completed', {
                    version: chrome.runtime.getManifest().version,
                    previousVersion,
                  });
                } else {
                  sharedLogger.warn(
                    '[Background] IndexedDB cleanup returned false',
                    {},
                    'background'
                  );
                }
              }
            } catch (error) {
              // Improved error serialization
              const errorMessage =
                error instanceof Error
                  ? `${error.name}: ${error.message}`
                  : String(error);

              sharedLogger.error(
                `[Background] Failed to cleanup IndexedDB during update: ${errorMessage}`,
                {
                  errorType: error instanceof Error ? error.name : typeof error,
                  errorMessage: error instanceof Error ? error.message : String(error),
                  errorStack: error instanceof Error ? error.stack : undefined,
                  version: chrome.runtime.getManifest().version,
                  previousVersion,
                },
                'background'
              );
              // Don't throw - cleanup failure shouldn't block extension startup
            }
          }
        }

        endTimer();
      } catch (error) {
        endTimer();
        sharedErrorHandler.handleError(error, { context: 'extension_installation' });
        throw error;
      }
    },
    {
      maxRetries: 1,
      fallbackAction: async () => {
        sharedLogger.error('[Background] Installation fallback triggered', {}, 'background');
      },
    }
  )
);

chrome.runtime.onStartup.addListener(
  sharedErrorHandler.wrapWithErrorBoundary(
    async () => {
      sharedLogger.info('[Background] YTgify extension started', {}, 'background');
      sharedLogger.trackEvent('extension_started');

      // Initialize extension state on startup
      await extensionStateManager.clearRuntimeState();

      // Check and refresh token if needed
      await TokenManager.onServiceWorkerActivation();
    },
    {
      maxRetries: 0,
    }
  )
);

// Enhanced message routing with comprehensive error handling and performance tracking
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: ExtensionMessage) => void
  ) => {
    const messageStartTime = performance.now();
    const messageId = message?.id || 'unknown';
    const messageType = message?.type || 'unknown';

    try {
      // Validate message structure
      if (!message || !message.type) {
        sharedLogger.warn(
          '[Background] Invalid message received',
          {
            message,
            sender: sender.tab?.url,
          },
          'background'
        );

        sharedLogger.trackEvent('invalid_message_received', {
          senderUrl: sender.tab?.url,
          senderId: sender.tab?.id,
        });

        sendResponse({
          type: 'ERROR_RESPONSE',
          success: false,
          error: 'Invalid message structure',
        } as ExtensionMessage);
        return false;
      }

      sharedLogger.debug(
        '[Background] Received message',
        {
          type: messageType,
          from: sender.tab?.url || 'popup',
          messageId: messageId,
        },
        'background'
      );

      sharedLogger.trackEvent('message_received', {
        messageType,
        source: sender.tab?.url ? 'content' : 'popup',
      });

      // Use enhanced message handler with error recovery
      return sharedErrorHandler
        .withRecovery(() => messageHandler.handleMessage(message, sender, sendResponse), {
          maxRetries: 1,
          delayMs: 100,
          fallbackAction: async () => {
            sharedLogger.warn(
              '[Background] Using message fallback handler',
              {
                messageType,
                messageId,
              },
              'background'
            );

            sendResponse({
              type: 'ERROR_RESPONSE',
              success: false,
              error: 'Message handling temporarily unavailable',
            } as ExtensionMessage);
          },
        })
        .then((requiresAsyncResponse) => {
          sharedLogger.trackPerformance('message_handling', messageStartTime, {
            messageType,
            success: true,
          });
          return requiresAsyncResponse;
        })
        .catch((error) => {
          sharedLogger.trackPerformance('message_handling', messageStartTime, {
            messageType,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });

          sharedLogger.error(
            '[Background] Message handling failed',
            {
              error: error instanceof Error ? error.message : String(error),
              messageType,
              messageId,
            },
            'background'
          );

          sharedErrorHandler.handleError(error, {
            messageType,
            messageId,
            senderId: sender.tab?.id,
            senderUrl: sender.tab?.url,
            context: 'message_handling',
          });

          sendResponse({
            type: 'ERROR_RESPONSE',
            success: false,
            error: error instanceof Error ? error.message : 'Message handling failed',
          } as ExtensionMessage);

          return false;
        });
    } catch (error) {
      sharedLogger.trackPerformance('message_handling', messageStartTime, {
        messageType,
        success: false,
        critical: true,
        error: error instanceof Error ? error.message : String(error),
      });

      sharedLogger.error(
        '[Background] Critical message handling error',
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'background'
      );

      sharedErrorHandler.handleError(error, {
        messageType,
        messageId,
        context: 'critical_message_handling',
      });

      sendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: 'Critical error in message processing',
      } as ExtensionMessage);

      return false;
    }
  }
);

// Handle keyboard command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === '_execute_action') {
    // Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id || !tab.url) {
      return;
    }

    const isYouTubePage =
      tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts');

    if (!isYouTubePage) {
      await chrome.tabs.update(tab.id, { url: 'https://www.youtube.com' });
      return;
    }

    // Send message to content script to show wizard
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'SHOW_WIZARD_DIRECT',
        data: { triggeredBy: 'command' },
      });
    } catch (error) {
      console.error('[BACKGROUND] Failed to send message:', error);
    }
  }
});

// ========================================
// Auth Message Handlers (Phase 1)
// ========================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AUTH') {
    // Check if user is authenticated
    (async () => {
      const status = await TokenManager.checkAuthStatus();
      const profile = status.authenticated ? await StorageAdapter.getUserProfile() : null;

      sendResponse({
        authenticated: status.authenticated,
        userProfile: profile,
        expiresIn: status.expiresIn,
        needsRefresh: status.needsRefresh,
      });
    })();
    return true;
  }

  if (message.type === 'REFRESH_TOKEN') {
    // Manual token refresh requested
    (async () => {
      const success = await TokenManager.manualRefresh();
      sendResponse({ success });
    })();
    return true;
  }

  if (message.type === 'LOGIN') {
    // Handle login request from popup/content script
    (async () => {
      try {
        const { email, password } = message.data;
        const response = await apiClient.login(email, password);
        sendResponse({ success: true, data: response });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Login failed',
        });
      }
    })();
    return true;
  }

  if (message.type === 'LOGOUT') {
    // Handle logout request
    (async () => {
      try {
        await apiClient.logout();
        await TokenManager.clearTokenRefreshAlarm();
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Logout failed',
        });
      }
    })();
    return true;
  }

  if (message.type === 'GET_USER_PROFILE') {
    // Get cached or fetch user profile
    (async () => {
      try {
        let profile = await StorageAdapter.getUserProfile();

        if (!profile) {
          // Fetch from API if not cached
          profile = await apiClient.getCurrentUser();
        }

        sendResponse({ success: true, data: profile });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get profile',
        });
      }
    })();
    return true;
  }

  return false;
});

// ========================================
// Token Refresh Alarm Handler
// ========================================

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'refreshToken') {
    await TokenManager.onTokenRefreshAlarm();
  }
});

// Enhanced service worker with new architecture
// All message handling is now managed by the MessageHandler
// All video processing is managed by the BackgroundWorker

// Initialize enhanced logging for service worker lifecycle
chrome.runtime.onInstalled.addListener((details) => {
  logger.info('[Background] YTgify extension installed', {
    reason: details.reason,
    version: chrome.runtime.getManifest().version,
  });
});

// Initialize storage and preferences with comprehensive error handling and analytics
async function initializeStorage(): Promise<void> {
  const endTimer = await sharedLogger.startPerformanceTimer('storage_initialization');

  try {
    const result = await sharedErrorHandler.withRecovery(
      () => chrome.storage.local.get(['userPreferences']),
      {
        maxRetries: 3,
        delayMs: 500,
        exponentialBackoff: true,
      }
    );

    if (!result.userPreferences) {
      // Set default preferences optimized for video processing
      const defaultPreferences = {
        defaultFrameRate: 15,
        defaultQuality: 'medium' as const,
        maxDuration: 10,
        autoSave: true,
        theme: 'system' as const,
        showThumbnails: true,
        gridSize: 'medium' as const,
        maxStorageSize: 100, // 100MB
        autoCleanup: true,
        cleanupOlderThan: 30, // 30 days
        // New preferences for enhanced worker
        maxConcurrentJobs: 3,
        enableProgressUpdates: true,
        jobTimeout: 300000, // 5 minutes
        preferWebCodecs: true,
        enableAdvancedGifOptimization: true,
        // Analytics and error reporting preferences
        analyticsEnabled: false, // Privacy-first default
        errorReportingEnabled: true,
        performanceMonitoringEnabled: true,
      };

      await sharedErrorHandler.withRecovery(
        () => chrome.storage.local.set({ userPreferences: defaultPreferences }),
        {
          maxRetries: 3,
          delayMs: 500,
          exponentialBackoff: true,
        }
      );

      sharedLogger.info('[Background] Initialized enhanced default preferences', {}, 'background');
      sharedLogger.trackEvent('preferences_initialized', { isFirstTime: true });
    } else {
      sharedLogger.info('[Background] Using existing user preferences', {}, 'background');
      sharedLogger.trackEvent('preferences_loaded', { isFirstTime: false });

      // Migrate old preferences if needed
      await migratePreferences(result.userPreferences);
    }

    endTimer();
  } catch (error) {
    endTimer();
    sharedLogger.error(
      '[Background] Failed to initialize storage',
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'background'
    );

    sharedErrorHandler.handleError(error, { context: 'storage_initialization' });

    // Fallback to minimal defaults
    sharedErrorHandler.showUserFeedback({
      type: 'warning',
      title: 'Storage Initialization Warning',
      message: 'Could not load user preferences. Using defaults.',
      actions: [
        {
          label: 'Retry',
          action: () => initializeStorage(),
        },
      ],
    });

    throw error;
  }
}

// Migrate preferences to ensure compatibility with new features
async function migratePreferences(preferences: Record<string, unknown>): Promise<void> {
  try {
    let needsUpdate = false;
    const updatedPreferences = { ...preferences };

    // Add new analytics preferences if missing
    if (!('analyticsEnabled' in updatedPreferences)) {
      updatedPreferences.analyticsEnabled = false; // Privacy-first default
      needsUpdate = true;
    }

    if (!('errorReportingEnabled' in updatedPreferences)) {
      updatedPreferences.errorReportingEnabled = true;
      needsUpdate = true;
    }

    if (!('performanceMonitoringEnabled' in updatedPreferences)) {
      updatedPreferences.performanceMonitoringEnabled = true;
      needsUpdate = true;
    }

    if (needsUpdate) {
      await chrome.storage.local.set({ userPreferences: updatedPreferences });
      sharedLogger.info(
        '[Background] Migrated user preferences',
        {
          addedFields: Object.keys(updatedPreferences).filter((key) => !(key in preferences)),
        },
        'background'
      );

      sharedLogger.trackEvent('preferences_migrated');
    }
  } catch (error) {
    sharedLogger.warn(
      '[Background] Failed to migrate preferences',
      {
        error: error instanceof Error ? error.message : String(error),
      },
      'background'
    );
  }
}

// Enhanced cleanup and error recovery
chrome.runtime.onSuspend.addListener(() => {
  logger.info('[Background] Service worker suspending - performing cleanup');

  try {
    // Cleanup message handler resources
    messageHandler.cleanup();

    // Cleanup old worker jobs
    backgroundWorker.cleanupOldJobs();

    // Clear logger buffer if needed
    logger.clearLogBuffer();
  } catch (error) {
    logger.error('[Background] Error during cleanup', { error });
  }
});

// Enhanced keep-alive mechanism with monitoring
function keepAlive(): void {
  chrome.runtime.onMessage.addListener(() => {
    // This listener keeps the service worker active during processing
    return false;
  });

  // Periodic cleanup and monitoring
  setInterval(() => {
    try {
      // Clean up old jobs every 5 minutes
      const cleanedJobs = backgroundWorker.cleanupOldJobs();

      if (cleanedJobs > 0) {
        logger.debug('[Background] Cleaned up old jobs', { count: cleanedJobs });
      }

      // Log worker status periodically
      const workerStats = backgroundWorker.getQueueStatus();
      const handlerStats = messageHandler.getStatistics();

      if (workerStats.queueLength > 0 || handlerStats.activeJobs > 0) {
        logger.debug('[Background] Worker status', { workerStats, handlerStats });
      }
    } catch (error) {
      logger.error('[Background] Error in periodic cleanup', { error });
    }
  }, 300000); // Every 5 minutes
}

// Initialize enhanced keep-alive mechanism
keepAlive();

// Initialize the new message bus alongside the existing system
initializeMessageBus({
  enableLogging: true,
  requestTimeout: 30000,
  maxRetries: 3,
  validateMessages: true,
  enableProgressTracking: true,
});

// Log successful initialization
logger.info('[Background] Enhanced background service worker initialized', {
  messageHandlerEnabled: true,
  backgroundWorkerEnabled: true,
  messageBusEnabled: true,
  webCodecsSupported: 'VideoDecoder' in globalThis,
});

export {};
