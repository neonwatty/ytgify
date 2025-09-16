import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type {
  MessageHandler,
  RequestHandler,
  EventHandler,
  MessageBusOptions
} from '@/shared/message-bus';
import type {
  BaseMessage,
  BaseRequest,
  BaseResponse,
  EventMessage
} from '@/shared/messages';

// Mock chrome API
const mockChrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn(),
    lastError: null
  }
};

global.chrome = mockChrome as any;

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    log: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// Mock messages module
jest.mock('@/shared/messages', () => ({
  isRequest: jest.fn((msg: any) => msg.type?.endsWith('_REQUEST')),
  isResponse: jest.fn((msg: any) => msg.type?.endsWith('_RESPONSE')),
  isEvent: jest.fn((msg: any) => msg.type?.endsWith('_EVENT')),
  validateMessage: jest.fn(() => ({ valid: true, errors: [] })),
  sanitizeMessage: jest.fn((msg) => msg),
  generateMessageId: jest.fn(() => `msg-${Date.now()}-${Math.random()}`),
  createErrorResponse: jest.fn((error: any) => ({
    type: 'ERROR_RESPONSE',
    success: false,
    error: error.message
  }))
}));

describe('MessageBus', () => {
  let MessageBus: any;
  let messageBus: any;
  let messageListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();

    // Capture the message listener
    mockChrome.runtime.onMessage.addListener.mockImplementation((listener) => {
      messageListener = listener;
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Instance', () => {
    it('should create a singleton instance', async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;

      const instance1 = MessageBus.getInstance();
      const instance2 = MessageBus.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should accept configuration options', async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;

      const options: MessageBusOptions = {
        enableLogging: false,
        requestTimeout: 5000,
        maxRetries: 1
      };

      messageBus = MessageBus.getInstance(options);
      expect(messageBus).toBeDefined();
    });
  });

  describe('Initialization', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
    });

    it('should initialize message listener', () => {
      messageBus.initialize();
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
    });

    it('should only initialize once', () => {
      messageBus.initialize();
      messageBus.initialize();
      expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Message Handlers', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
      messageBus.initialize();
    });

    it('should register message handler', () => {
      const handler = jest.fn() as any;
      const unregister = messageBus.on('TEST_MESSAGE', handler);

      expect(typeof unregister).toBe('function');
    });

    it('should handle incoming messages', async () => {
      const handler = jest.fn(() => Promise.resolve({ success: true }));
      messageBus.on('TEST_REQUEST', handler);

      const message = { type: 'TEST_REQUEST', data: 'test' };
      const sender = { tab: { id: 1 } };
      const sendResponse = jest.fn();

      const keepChannelOpen = messageListener(message, sender, sendResponse);

      expect(keepChannelOpen).toBe(true); // Async response
      expect(handler).toHaveBeenCalledWith(message, sender);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle multiple handlers for same message type', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      messageBus.on('TEST_EVENT', handler1);
      messageBus.on('TEST_EVENT', handler2);

      const message = { type: 'TEST_EVENT', data: 'test' };
      messageListener(message, {}, jest.fn());

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    it('should unregister handler', () => {
      const handler = jest.fn();
      const unregister = messageBus.on('TEST_MESSAGE', handler);

      unregister();

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      messageListener(message, {}, jest.fn());

      expect(handler).not.toHaveBeenCalled();
    });

    it('should support once handlers', async () => {
      const handler = jest.fn();
      messageBus.once('TEST_EVENT', handler);

      const message = { type: 'TEST_EVENT', data: 'test' };

      // First call
      messageListener(message, {}, jest.fn());
      await new Promise(resolve => setTimeout(resolve, 10));

      // Second call
      messageListener(message, {}, jest.fn());
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Request/Response', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
      messageBus.initialize();
    });

    it('should send request and receive response', async () => {
      const request: BaseRequest = {
        type: 'TEST_REQUEST',
        requestId: '123',
        id: 'msg-123'
      };

      const response: BaseResponse = {
        type: 'TEST_RESPONSE',
        requestId: '123',
        id: 'msg-124',
        success: true
      };

      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: any) => {
        setTimeout(() => callback(response), 10);
        return true;
      });

      const result = await messageBus.sendRequest(request);
      expect(result).toEqual(response);
    });

    it('should handle request timeout', async () => {
      const request: BaseRequest = {
        type: 'TEST_REQUEST',
        requestId: '123',
        id: 'msg-125'
      };

      mockChrome.runtime.sendMessage.mockImplementation(() => {
        // Never call callback
        return true;
      });

      const messageBusWithTimeout = MessageBus.getInstance({ requestTimeout: 100 });
      messageBusWithTimeout.initialize();

      await expect(messageBusWithTimeout.sendRequest(request)).rejects.toThrow('timeout');
    });

    it('should retry failed requests', async () => {
      const request: BaseRequest = {
        type: 'TEST_REQUEST',
        requestId: '123',
        id: 'msg-126'
      };

      let callCount = 0;
      mockChrome.runtime.sendMessage.mockImplementation((msg: any, callback: any) => {
        callCount++;
        if (callCount < 3) {
          mockChrome.runtime.lastError = { message: 'Network error' } as any;
          callback(undefined);
        } else {
          mockChrome.runtime.lastError = null;
          callback({ success: true });
        }
        return true;
      });

      const result = await messageBus.sendRequest(request);
      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });
  });

  describe('Event Broadcasting', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
      messageBus.initialize();
    });

    it('should broadcast events', () => {
      const event: EventMessage = {
        type: 'SHOW_TIMELINE_EVENT' as const,
        id: 'msg-event-1',
        data: { value: 'test' }
      } as any;

      messageBus.broadcast(event);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'TEST_EVENT',
          data: { value: 'test' }
        }),
        expect.any(Function)
      );
    });

    it('should emit local events', async () => {
      const handler = jest.fn();
      messageBus.on('LOCAL_EVENT', handler);

      const event = {
        type: 'LOCAL_EVENT',
        data: 'test'
      };

      messageBus.emit(event);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(handler).toHaveBeenCalledWith(event, undefined);
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
      messageBus.initialize();
    });

    it('should handle handler errors gracefully', async () => {
      const { logger } = await import('@/lib/logger');

      const handler = jest.fn(() => Promise.reject(new Error('Handler error')));
      messageBus.on('ERROR_MESSAGE', handler);

      const message = { type: 'ERROR_MESSAGE', data: 'test' };
      const sendResponse = jest.fn();

      messageListener(message, {}, sendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(logger.error).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_RESPONSE',
          success: false
        })
      );
    });

    it('should handle invalid messages', async () => {
      const { validateMessage } = await import('@/shared/messages');
      (validateMessage as any).mockReturnValue({
        valid: false,
        errors: ['Invalid message format']
      });

      const handler = jest.fn();
      messageBus.on('INVALID_MESSAGE', handler);

      const message = { invalid: true };
      const sendResponse = jest.fn();

      messageListener(message, {}, sendResponse);

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ERROR_RESPONSE',
          success: false
        })
      );
    });
  });

  describe('Message Validation', () => {
    beforeEach(async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
    });

    it('should validate messages when enabled', async () => {
      const { validateMessage } = await import('@/shared/messages');

      messageBus = MessageBus.getInstance({ validateMessages: true });
      messageBus.initialize();

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      messageListener(message, {}, jest.fn());

      expect(validateMessage).toHaveBeenCalledWith(message);
    });

    it('should skip validation when disabled', async () => {
      const { validateMessage } = await import('@/shared/messages');

      messageBus = MessageBus.getInstance({ validateMessages: false });
      messageBus.initialize();

      const message = { type: 'TEST_MESSAGE', data: 'test' };
      messageListener(message, {}, jest.fn());

      expect(validateMessage).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      const module = await import('@/shared/message-bus');
      MessageBus = module.MessageBus;
      messageBus = MessageBus.getInstance();
      messageBus.initialize();

      const handler = jest.fn();
      messageBus.on('TEST_MESSAGE', handler);

      messageBus.destroy();

      expect(mockChrome.runtime.onMessage.removeListener).toHaveBeenCalled();

      // Handlers should be cleared
      const message = { type: 'TEST_MESSAGE', data: 'test' };
      if (messageListener) {
        messageListener(message, {}, jest.fn());
      }
      expect(handler).not.toHaveBeenCalled();
    });
  });
});