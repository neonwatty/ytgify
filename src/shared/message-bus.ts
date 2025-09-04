// Type-Safe Message Bus for Chrome Extension Communication

import {
  BaseMessage,
  BaseRequest,
  BaseResponse,
  RequestMessage,
  ResponseMessage,
  EventMessage,
  AllMessages,
  isRequest,
  isResponse,
  isEvent,
  validateMessage,
  sanitizeMessage,
  generateMessageId,
  createErrorResponse
} from './messages';
import { logger } from '@/lib/logger';

// Message Handler Types
export type MessageHandler<T extends BaseMessage = BaseMessage> = (
  message: T,
  sender?: chrome.runtime.MessageSender
) => Promise<BaseResponse | void> | BaseResponse | void;

export type RequestHandler<TReq extends BaseRequest, TRes extends BaseResponse> = (
  request: TReq,
  sender?: chrome.runtime.MessageSender
) => Promise<TRes> | TRes;

export type EventHandler<T extends EventMessage> = (
  event: T,
  sender?: chrome.runtime.MessageSender
) => Promise<void> | void;

// Message Bus Configuration
export interface MessageBusOptions {
  enableLogging?: boolean;
  requestTimeout?: number;
  maxRetries?: number;
  validateMessages?: boolean;
  enableProgressTracking?: boolean;
}

// Pending Request Tracking
interface PendingRequest {
  requestId: string;
  resolve: (response: BaseResponse) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
  retryCount: number;
  originalMessage: BaseRequest;
}

// Event Listener Management
interface EventListener {
  id: string;
  handler: MessageHandler;
  options?: {
    once?: boolean;
    priority?: number;
  };
}

export class MessageBus {
  private static instance: MessageBus;
  private handlers = new Map<string, EventListener[]>();
  private pendingRequests = new Map<string, PendingRequest>();
  private options: Required<MessageBusOptions>;
  private isInitialized = false;

  private constructor(options: MessageBusOptions = {}) {
    this.options = {
      enableLogging: true,
      requestTimeout: 30000, // 30 seconds
      maxRetries: 3,
      validateMessages: true,
      enableProgressTracking: true,
      ...options
    };
  }

  public static getInstance(options?: MessageBusOptions): MessageBus {
    if (!MessageBus.instance) {
      MessageBus.instance = new MessageBus(options);
    }
    return MessageBus.instance;
  }

  // Initialize the message bus
  public initialize(): void {
    if (this.isInitialized) {
      return;
    }

    // Set up Chrome message listener
    chrome.runtime.onMessage.addListener(
      (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void) => {
        return this.handleIncomingMessage(message, sender, sendResponse);
      }
    );

    this.isInitialized = true;
    this.log('info', 'MessageBus initialized');
  }

  // Send a request and wait for response
  public async sendRequest<TReq extends RequestMessage, TRes extends ResponseMessage>(
    message: TReq,
    target?: number | 'background' // tab ID or 'background'
  ): Promise<TRes> {
    if (!this.isInitialized) {
      throw new Error('MessageBus not initialized. Call initialize() first.');
    }

    if (this.options.validateMessages && !validateMessage(message)) {
      throw new Error('Invalid message format');
    }

    const sanitizedMessage = this.options.validateMessages 
      ? sanitizeMessage(message) as TReq
      : message;

    this.log('debug', 'Sending request', { type: message.type, requestId: message.requestId, target });

    return new Promise<TRes>((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(message.requestId);
        reject(new Error(`Request timeout: ${message.type}`));
      }, this.options.requestTimeout);

      // Store pending request
      this.pendingRequests.set(message.requestId, {
        requestId: message.requestId,
        resolve: resolve as (response: BaseResponse) => void,
        reject,
        timeout,
        retryCount: 0,
        originalMessage: message
      });

      try {
        // Send message
        if (target === 'background' || target === undefined) {
          chrome.runtime.sendMessage(sanitizedMessage);
        } else if (typeof target === 'number') {
          chrome.tabs.sendMessage(target, sanitizedMessage);
        } else {
          throw new Error('Invalid target for message sending');
        }
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(message.requestId);
        reject(error);
      }
    });
  }

  // Send an event (no response expected)
  public sendEvent<T extends EventMessage>(
    event: T,
    target?: number | 'background' | 'broadcast'
  ): void {
    if (!this.isInitialized) {
      throw new Error('MessageBus not initialized. Call initialize() first.');
    }

    const sanitizedEvent = this.options.validateMessages 
      ? sanitizeMessage(event) as T
      : event;

    this.log('debug', 'Sending event', { type: event.type, target });

    try {
      if (target === 'background' || target === undefined) {
        chrome.runtime.sendMessage(sanitizedEvent);
      } else if (target === 'broadcast') {
        // Broadcast to all tabs and background
        chrome.runtime.sendMessage(sanitizedEvent);
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, sanitizedEvent);
            }
          });
        });
      } else if (typeof target === 'number') {
        chrome.tabs.sendMessage(target, sanitizedEvent);
      }
    } catch (error) {
      this.log('error', 'Failed to send event', { error, eventType: event.type });
    }
  }

  // Register a request handler
  public onRequest<TReq extends RequestMessage, TRes extends ResponseMessage>(
    messageType: TReq['type'],
    handler: RequestHandler<TReq, TRes>,
    options?: { priority?: number }
  ): string {
    const listenerId = generateMessageId();
    
    const wrappedHandler: MessageHandler = async (message, sender) => {
      try {
        const response = await handler(message as TReq, sender);
        return response;
      } catch (error) {
        this.log('error', 'Request handler error', { messageType, error });
        throw error;
      }
    };

    const listeners = this.handlers.get(messageType) || [];
    listeners.push({
      id: listenerId,
      handler: wrappedHandler,
      options
    });

    // Sort by priority (higher numbers first)
    listeners.sort((a, b) => (b.options?.priority || 0) - (a.options?.priority || 0));
    
    this.handlers.set(messageType, listeners);
    
    this.log('debug', 'Registered request handler', { messageType, listenerId });
    return listenerId;
  }

  // Register an event handler
  public onEvent<T extends EventMessage>(
    messageType: T['type'],
    handler: EventHandler<T>,
    options?: { once?: boolean; priority?: number }
  ): string {
    const listenerId = generateMessageId();
    
    const wrappedHandler: MessageHandler = async (message, sender) => {
      try {
        await handler(message as T, sender);
        
        // Remove handler if it's a one-time listener
        if (options?.once) {
          this.removeHandler(messageType, listenerId);
        }
      } catch (error) {
        this.log('error', 'Event handler error', { messageType, error });
      }
    };

    const listeners = this.handlers.get(messageType) || [];
    listeners.push({
      id: listenerId,
      handler: wrappedHandler,
      options
    });

    listeners.sort((a, b) => (b.options?.priority || 0) - (a.options?.priority || 0));
    
    this.handlers.set(messageType, listeners);
    
    this.log('debug', 'Registered event handler', { messageType, listenerId });
    return listenerId;
  }

  // Remove a handler
  public removeHandler(messageType: string, handlerId: string): boolean {
    const listeners = this.handlers.get(messageType);
    if (!listeners) {
      return false;
    }

    const index = listeners.findIndex(l => l.id === handlerId);
    if (index === -1) {
      return false;
    }

    listeners.splice(index, 1);
    
    if (listeners.length === 0) {
      this.handlers.delete(messageType);
    }

    this.log('debug', 'Removed handler', { messageType, handlerId });
    return true;
  }

  // Handle incoming messages from Chrome runtime
  private handleIncomingMessage(
    message: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean {
    try {
      if (this.options.validateMessages && !validateMessage(message)) {
        this.log('warn', 'Invalid message received', { message });
        return false;
      }

      const msg = message as AllMessages;
      this.log('debug', 'Received message', { type: msg.type, from: sender.tab?.url || 'extension' });

      // Handle responses to pending requests
      if (isResponse(msg)) {
        return this.handleResponse(msg);
      }

      // Handle requests and events
      if (isRequest(msg) || isEvent(msg)) {
        return this.handleRequestOrEvent(msg, sender, sendResponse);
      }

      return false;

    } catch (error) {
      this.log('error', 'Message handling error', { error, message });
      return false;
    }
  }

  // Handle response messages
  private handleResponse(response: ResponseMessage): boolean {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      this.log('warn', 'Received response for unknown request', { requestId: response.requestId });
      return false;
    }

    // Clear timeout and remove from pending
    if (pending.timeout) {
      clearTimeout(pending.timeout);
    }
    this.pendingRequests.delete(response.requestId);

    // Resolve or reject based on response
    if (response.success) {
      pending.resolve(response);
    } else {
      const error = new Error(response.error?.message || 'Request failed');
      error.name = response.error?.code || 'REQUEST_ERROR';
      pending.reject(error);
    }

    return false; // No response needed
  }

  // Handle request and event messages
  private handleRequestOrEvent(
    message: RequestMessage | EventMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ): boolean {
    const listeners = this.handlers.get(message.type);
    if (!listeners || listeners.length === 0) {
      if (isRequest(message)) {
        // Send error response for unhandled requests
        const errorResponse = createErrorResponse(
          message,
          `${message.type.replace('_REQUEST', '_RESPONSE')}` as ResponseMessage['type'],
          { code: 'UNHANDLED_REQUEST', message: `No handler for ${message.type}` }
        );
        sendResponse(errorResponse);
        return false;
      }
      return false; // Ignore unhandled events
    }

    // Execute handlers (for events, execute all; for requests, execute first one)
    let responseHandled = false;

    const executeHandler = async (listener: EventListener) => {
      try {
        const result = await listener.handler(message, sender);
        
        // For requests, send the response
        if (isRequest(message) && result && !responseHandled) {
          sendResponse(result);
          responseHandled = true;
        }
      } catch (error) {
        this.log('error', 'Handler execution error', { messageType: message.type, error });
        
        if (isRequest(message) && !responseHandled) {
          const errorResponse = createErrorResponse(
            message,
            `${message.type.replace('_REQUEST', '_RESPONSE')}` as ResponseMessage['type'],
            { code: 'HANDLER_ERROR', message: error instanceof Error ? error.message : 'Handler execution failed' }
          );
          sendResponse(errorResponse);
          responseHandled = true;
        }
      }
    };

    if (isEvent(message)) {
      // Execute all event handlers
      listeners.forEach(listener => {
        executeHandler(listener).catch(error => {
          this.log('error', 'Async event handler error', { messageType: message.type, error });
        });
      });
      return false;
    } else {
      // Execute first request handler
      executeHandler(listeners[0]).catch(error => {
        this.log('error', 'Async request handler error', { messageType: message.type, error });
      });
      return true; // Keep sendResponse available for async response
    }
  }

  // Get bus statistics
  public getStats() {
    return {
      handlersRegistered: Array.from(this.handlers.entries()).reduce((acc, [type, handlers]) => {
        acc[type] = handlers.length;
        return acc;
      }, {} as Record<string, number>),
      pendingRequests: this.pendingRequests.size,
      isInitialized: this.isInitialized
    };
  }

  // Clean up resources
  public cleanup(): void {
    // Clear all timeouts for pending requests
    this.pendingRequests.forEach(pending => {
      if (pending.timeout) {
        clearTimeout(pending.timeout);
      }
    });

    this.pendingRequests.clear();
    this.handlers.clear();
    this.isInitialized = false;
    
    this.log('info', 'MessageBus cleaned up');
  }

  // Internal logging
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>): void {
    if (this.options.enableLogging) {
      logger.log(level, `[MessageBus] ${message}`, { ...data, component: 'MessageBus' });
    }
  }
}

// Export singleton instance
export const messageBus = MessageBus.getInstance();

// Convenience functions for common patterns
export function initializeMessageBus(options?: MessageBusOptions): MessageBus {
  const bus = MessageBus.getInstance(options);
  bus.initialize();
  return bus;
}

export function sendRequest<TReq extends RequestMessage, TRes extends ResponseMessage>(
  message: TReq,
  target?: number | 'background'
): Promise<TRes> {
  return messageBus.sendRequest<TReq, TRes>(message, target);
}

export function sendEvent<T extends EventMessage>(
  event: T,
  target?: number | 'background' | 'broadcast'
): void {
  return messageBus.sendEvent(event, target);
}

export function onRequest<TReq extends RequestMessage, TRes extends ResponseMessage>(
  messageType: TReq['type'],
  handler: RequestHandler<TReq, TRes>,
  options?: { priority?: number }
): string {
  return messageBus.onRequest(messageType, handler, options);
}

export function onEvent<T extends EventMessage>(
  messageType: T['type'],
  handler: EventHandler<T>,
  options?: { once?: boolean; priority?: number }
): string {
  return messageBus.onEvent(messageType, handler, options);
}