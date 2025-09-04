// Shared Message System - Central Export Point

// Export all message types and utilities
export * from './messages';

// Export message bus and utilities
export * from './message-bus';

// Export shared logging and error handling
export * from './logger';
export * from './error-handler';

// Re-export common patterns for convenience
export {
  // Types
  type BaseMessage,
  type BaseRequest,
  type BaseResponse,
  type RequestMessage,
  type ResponseMessage,
  type EventMessage,
  type ExtensionMessage,
  type MessageContext,
  
  // Message creation utilities
  createRequest,
  createBaseMessage,
  createSuccessResponse,
  createErrorResponse,
  generateMessageId,
  generateRequestId,
  
  // Validation utilities
  validateMessage,
  sanitizeMessage,
  isRequest,
  isResponse,
  isEvent,
  
  // Specific type guards
  isExtractFramesRequest,
  isEncodeGifRequest,
  isGetVideoStateRequest,
  isShowTimelineEvent,
  isTimelineSelectionUpdate,
  isJobProgressUpdate,
  isLogMessage
} from './messages';

export {
  // Message Bus
  MessageBus,
  messageBus,
  
  // Convenience functions
  initializeMessageBus,
  sendRequest,
  sendEvent,
  onRequest,
  onEvent,
  
  // Types
  type MessageBusOptions,
  type MessageHandler,
  type RequestHandler,
  type EventHandler
} from './message-bus';

export {
  // Shared Logger
  sharedLogger,
  withPerformanceTracking,
  performanceDecorator,
  
  // Types
  type PerformanceMetric,
  type AnalyticsEvent
} from './logger';

export {
  // Shared Error Handler
  sharedErrorHandler,
  withErrorBoundary,
  errorBoundaryDecorator,
  
  // Types
  type ErrorRecoveryStrategy,
  type UserFeedback
} from './error-handler';

export {
  // Extension State Management
  ExtensionStateManager,
  extensionStateManager,
  
  // Types
  type ExtensionRuntimeState,
  type StateChangeEvent,
  type StateListener
} from './state-manager';

export {
  // Preferences Management
  PreferencesManager,
  preferencesManager,
  
  // Types
  type PreferenceChangeEvent,
  type PreferenceChangeListener
} from './preferences';

export {
  // Clipboard Service
  ClipboardService,
  clipboard,
  
  // Types
  type ClipboardResult
} from './clipboard';

export {
  // Sharing Service
  SharingService,
  sharing,
  
  // Types
  type ShareOptions,
  type ShareResult,
  type ShareTarget
} from './sharing';