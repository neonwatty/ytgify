import { ExtensionMessage } from '@/types';
import { messageHandler } from './message-handler';
import { backgroundWorker } from './worker';
import { logger } from '@/lib/logger';
import { initializeMessageBus } from '@/shared/message-bus';
import { sharedLogger, sharedErrorHandler, extensionStateManager } from '@/shared';

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

// Note: chrome.action.onClicked is not used when default_popup is defined in manifest.json
// The popup will handle the extension icon click instead
// Keeping this commented out for reference
/*

chrome.action.onClicked.addListener(async (tab) => {
  
  try {
    sharedLogger.info('[Background] Extension icon clicked', { 
      tabId: tab.id,
      url: tab.url 
    }, 'background');
    
    // Check if we're on a YouTube video page
    if (!tab.id || !tab.url) {
      sharedLogger.warn('[Background] No tab information available', {}, 'background');
      return;
    }
    
    const isYouTubePage = tab.url.includes('youtube.com/watch') || tab.url.includes('youtube.com/shorts');
    
    if (!isYouTubePage) {
      // If not on YouTube, open YouTube in the current tab
      sharedLogger.info('[Background] Not on YouTube, navigating to YouTube', {}, 'background');
      await chrome.tabs.update(tab.id, { url: 'https://www.youtube.com' });
      return;
    }
    
    // Send message to content script to show wizard directly
    const message: ExtensionMessage = {
      type: 'SHOW_WIZARD_DIRECT',
      data: {
        triggeredBy: 'extension_icon'
      }
    };
    
    try {
      await chrome.tabs.sendMessage(tab.id, message);
      sharedLogger.info('[Background] Sent SHOW_WIZARD_DIRECT message to content script', {
        tabId: tab.id
      }, 'background');
      
      sharedLogger.trackUserAction('wizard_opened_via_icon');
    } catch (error) {
      sharedLogger.error('[Background] Failed to send message to content script', { 
        error: error instanceof Error ? error.message : String(error),
        tabId: tab.id
      }, 'background');
      
      // Try to inject content script if it's not loaded
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        
        // Retry sending message after injection
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id!, message);
            sharedLogger.info('[Background] Successfully sent message after content script injection', {}, 'background');
          } catch (retryError) {
            sharedLogger.error('[Background] Failed to send message even after injection', {
              error: retryError instanceof Error ? retryError.message : String(retryError)
            }, 'background');
          }
        }, 500);
      } catch (injectError) {
        sharedLogger.error('[Background] Failed to inject content script', {
          error: injectError instanceof Error ? injectError.message : String(injectError)
        }, 'background');
      }
    }
  } catch (error) {
    sharedLogger.error('[Background] Error handling extension icon click', {
      error: error instanceof Error ? error.message : String(error)
    }, 'background');
    
    sharedErrorHandler.handleError(error, { context: 'extension_icon_click' });
  }
});
*/

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
