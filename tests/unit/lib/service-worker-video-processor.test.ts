/**
 * Tests for ServiceWorkerVideoProcessor
 * Priority 1: Core background video processing functionality
 */

import {
  ServiceWorkerVideoProcessor,
  extractVideoFramesInServiceWorker,
  ServiceWorkerVideoProcessingOptions,
  ServiceWorkerVideoProcessingProgress,
  createServiceWorkerProcessorOptions
} from '@/lib/service-worker-video-processor';
import { logger } from '@/lib/logger';
import { createError } from '@/lib/errors';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/errors', () => ({
  createError: jest.fn((type: string, message: string, data?: any) => {
    const error = new Error(`${type}: ${message}`);
    if (data) (error as any).data = data;
    return error;
  })
}));

// Mock Chrome API
const mockChrome = {
  runtime: {
    lastError: null as any,
    sendMessage: jest.fn()
  },
  tabs: {
    sendMessage: jest.fn()
  }
};

(global as any).chrome = mockChrome;

describe('ServiceWorkerVideoProcessor', () => {
  let processor: ServiceWorkerVideoProcessor;
  let defaultOptions: ServiceWorkerVideoProcessingOptions;
  let onProgress: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockChrome.runtime.lastError = null;

    defaultOptions = {
      startTime: 0,
      endTime: 5,
      frameRate: 10,
      quality: 'medium',
      videoWidth: 1920,
      videoHeight: 1080
    };

    onProgress = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default maxWidth and maxHeight', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions);

      // Options should include defaults
      expect((processor as any).options).toEqual({
        ...defaultOptions,
        maxWidth: 1920,
        maxHeight: 1080
      });
    });

    it('should accept custom maxWidth and maxHeight', () => {
      const options = {
        ...defaultOptions,
        maxWidth: 640,
        maxHeight: 480
      };

      processor = new ServiceWorkerVideoProcessor(options);

      expect((processor as any).options.maxWidth).toBe(640);
      expect((processor as any).options.maxHeight).toBe(480);
    });

    it('should store tabId and onProgress callback', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, 123, onProgress);

      expect((processor as any).tabId).toBe(123);
      expect((processor as any).onProgress).toBe(onProgress);
    });
  });

  describe('extractFrames', () => {
    beforeEach(() => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, 123, onProgress);
    });

    // Tests that need real timers due to complex async flows
    const realTimerTests = [
      'should handle Chrome runtime errors',
      'should handle invalid response from content script',
      'should handle timeout from content script',
      'should generate synthetic frames when no tabId provided',
      'should handle errors during frame extraction'
    ];

    function isRealTimerTest(testName: string): boolean {
      return realTimerTests.some(name => testName.includes(name));
    }

    it('should successfully extract frames from content script', async () => {
      const mockFrames = [
        new ImageData(1440, 810),
        new ImageData(1440, 810)
      ];

      mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
        callback({ frames: mockFrames });
      });

      const result = await processor.extractFrames();

      expect(result.frames).toEqual(mockFrames);
      expect(result.metadata.totalFrames).toBe(2);
      expect(result.metadata.extractionMethod).toBe('content-script-relay');
      expect(result.metadata.duration).toBe(5);
      expect(result.metadata.dimensions).toEqual({ width: 1440, height: 810 });

      // Check progress reporting
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'initializing',
          progress: 0
        })
      );
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'completed',
          progress: 100
        })
      );
    });

    it('should validate inputs before processing', async () => {
      const invalidOptions = {
        ...defaultOptions,
        startTime: 5,
        endTime: 0 // Invalid: endTime < startTime
      };

      processor = new ServiceWorkerVideoProcessor(invalidOptions);

      await expect(processor.extractFrames()).rejects.toThrow('Invalid time range specified');
    });

    it('should validate frame rate', async () => {
      const invalidOptions = {
        ...defaultOptions,
        frameRate: 70 // Invalid: > 60
      };

      processor = new ServiceWorkerVideoProcessor(invalidOptions);

      await expect(processor.extractFrames()).rejects.toThrow('Invalid frame rate specified');
    });

    it('should validate video dimensions', async () => {
      const invalidOptions = {
        ...defaultOptions,
        videoWidth: 0,
        videoHeight: 0
      };

      processor = new ServiceWorkerVideoProcessor(invalidOptions);

      await expect(processor.extractFrames()).rejects.toThrow('Invalid video dimensions');
    });

    it('should warn about very high frame counts', async () => {
      const options = {
        ...defaultOptions,
        endTime: 100, // 100 seconds
        frameRate: 30 // Will result in 3000 frames
      };

      processor = new ServiceWorkerVideoProcessor(options, 123, onProgress);

      // Setup mock response
      mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
        callback({ frames: [] });
      });

      await processor.extractFrames();

      expect(logger.warn).toHaveBeenCalledWith(
        '[ServiceWorkerVideoProcessor] Very high frame count detected',
        expect.objectContaining({
          expectedFrames: 3000
        })
      );
    });

    it('should handle Chrome runtime errors', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Mock setTimeout to resolve immediately
      const originalSetTimeout = global.setTimeout;
      (global.setTimeout as any) = jest.fn((callback: any) => {
        callback();
        return 1 as any;
      });

      mockChrome.runtime.lastError = { message: 'Tab not found' };
      mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
        // Simulate immediate callback with error
        callback(null);
      });

      const result = await processor.extractFrames();

      expect(result.frames.length).toBe(50); // Falls back to synthetic frames
      expect(logger.warn).toHaveBeenCalledWith(
        '[ServiceWorkerVideoProcessor] Content script extraction failed, using synthetic frames',
        expect.anything()
      );

      // Restore original setTimeout and fake timers
      global.setTimeout = originalSetTimeout;
      jest.useFakeTimers();
    });

    it('should handle invalid response from content script', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Mock setTimeout to resolve immediately
      const originalSetTimeout = global.setTimeout;
      (global.setTimeout as any) = jest.fn((callback: any) => {
        callback();
        return 1 as any;
      });

      mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
        // Simulate immediate callback with invalid response
        callback({ /* no frames property */ });
      });

      const result = await processor.extractFrames();

      expect(result.frames.length).toBe(50); // 5 seconds * 10 fps
      expect(logger.warn).toHaveBeenCalledWith(
        '[ServiceWorkerVideoProcessor] Content script extraction failed, using synthetic frames',
        expect.anything()
      );

      // Restore original setTimeout and fake timers
      global.setTimeout = originalSetTimeout;
      jest.useFakeTimers();
    });

    it('should handle timeout from content script', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Mock setTimeout: timeouts resolve immediately, yields are also immediate
      const originalSetTimeout = global.setTimeout;
      (global.setTimeout as any) = jest.fn((callback: any, delay?: number) => {
        // If it's the 60-second timeout (delay = 60000), reject immediately
        // If it's a yield timeout (delay = 1), call immediately
        callback();
        return 1 as any;
      });

      mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
        // Never call callback to simulate timeout
      });

      const result = await processor.extractFrames();
      expect(result.frames.length).toBe(50);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ServiceWorkerVideoProcessor] Content script extraction failed, using synthetic frames',
        expect.anything()
      );

      // Restore original setTimeout and fake timers
      global.setTimeout = originalSetTimeout;
      jest.useFakeTimers();
    });

    it('should generate synthetic frames when no tabId provided', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Mock setTimeout to resolve immediately
      const originalSetTimeout = global.setTimeout;
      (global.setTimeout as any) = jest.fn((callback: any) => {
        callback();
        return 1 as any;
      });

      processor = new ServiceWorkerVideoProcessor(defaultOptions, undefined, onProgress);

      const result = await processor.extractFrames();

      expect(result.frames.length).toBe(50); // 5 seconds * 10 fps
      expect(result.metadata.extractionMethod).toBe('content-script-relay');

      // Should not attempt to send message
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();

      // Restore original setTimeout and fake timers
      global.setTimeout = originalSetTimeout;
      jest.useFakeTimers();
    });

    it('should handle errors during frame extraction', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      // Mock setTimeout to resolve immediately
      const originalSetTimeout = global.setTimeout;
      (global.setTimeout as any) = jest.fn((callback: any) => {
        callback();
        return 1 as any;
      });

      mockChrome.tabs.sendMessage.mockImplementation(() => {
        throw new Error('Messaging failed');
      });

      const result = await processor.extractFrames();
      expect(result.frames.length).toBe(50);
      expect(logger.warn).toHaveBeenCalledWith(
        '[ServiceWorkerVideoProcessor] Content script extraction failed, using synthetic frames',
        expect.anything()
      );

      // Restore original setTimeout and fake timers
      global.setTimeout = originalSetTimeout;
      jest.useFakeTimers();
    });
  });

  describe('calculateTargetDimensions', () => {
    it('should calculate dimensions for low quality', () => {
      const options = {
        ...defaultOptions,
        quality: 'low' as const
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width).toBe(960); // 1920 * 0.5
      expect(dimensions.height).toBe(540); // 1080 * 0.5
    });

    it('should calculate dimensions for medium quality', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width).toBe(1440); // 1920 * 0.75
      expect(dimensions.height).toBe(810); // 1080 * 0.75
    });

    it('should calculate dimensions for high quality', () => {
      const options = {
        ...defaultOptions,
        quality: 'high' as const
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width).toBe(1920); // 1920 * 1.0
      expect(dimensions.height).toBe(1080); // 1080 * 1.0
    });

    it('should respect maxWidth constraint', () => {
      const options = {
        ...defaultOptions,
        quality: 'high' as const,
        maxWidth: 640
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width).toBe(640);
      expect(dimensions.height).toBe(360); // Maintains aspect ratio
    });

    it('should respect maxHeight constraint', () => {
      const options = {
        ...defaultOptions,
        quality: 'high' as const,
        maxHeight: 480
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.height).toBe(480);
      expect(dimensions.width).toBe(852); // Maintains aspect ratio, rounded to even (853.33 -> 852)
    });

    it('should ensure even dimensions', () => {
      const options = {
        ...defaultOptions,
        videoWidth: 1921,
        videoHeight: 1081,
        quality: 'high' as const
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width % 2).toBe(0);
      expect(dimensions.height % 2).toBe(0);
    });

    it('should handle vertical video aspect ratio', () => {
      const options = {
        ...defaultOptions,
        videoWidth: 1080,
        videoHeight: 1920,
        quality: 'medium' as const
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      const aspectRatio = dimensions.width / dimensions.height;
      expect(aspectRatio).toBeCloseTo(1080 / 1920, 2);
    });

    it('should ensure minimum dimensions of 2x2', () => {
      const options = {
        ...defaultOptions,
        videoWidth: 1,
        videoHeight: 1,
        quality: 'low' as const
      };

      processor = new ServiceWorkerVideoProcessor(options);
      const dimensions = (processor as any).calculateTargetDimensions();

      expect(dimensions.width).toBeGreaterThanOrEqual(2);
      expect(dimensions.height).toBeGreaterThanOrEqual(2);
    });
  });

  describe('generateSyntheticFrames', () => {
    it('should generate correct number of synthetic frames', async () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, undefined, onProgress);

      const promise = (processor as any).generateSyntheticFrames(10, { width: 100, height: 100 });
      jest.runAllTimers();
      const frames = await promise;

      expect(frames.length).toBe(10);
      frames.forEach((frame: ImageData) => {
        expect(frame).toBeInstanceOf(ImageData);
        expect(frame.width).toBe(100);
        expect(frame.height).toBe(100);
      });
    });

    it('should report progress during synthetic frame generation', async () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, undefined, onProgress);

      const promise = (processor as any).generateSyntheticFrames(5, { width: 100, height: 100 });
      jest.runAllTimers();
      await promise;

      // Check progress reporting
      const progressCalls = onProgress.mock.calls.filter(
        call => call[0].stage === 'processing'
      );
      expect(progressCalls.length).toBeGreaterThan(0);
    });

    it('should yield periodically to prevent blocking', async () => {
      // Use real timers for this test
      jest.useRealTimers();

      processor = new ServiceWorkerVideoProcessor(defaultOptions, undefined, onProgress);

      const setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation((callback: any, delay?: number) => {
        // Call immediately for testing purposes
        callback();
        return 1 as any;
      });

      await (processor as any).generateSyntheticFrames(25, { width: 100, height: 100 });

      // Should have yielded at least twice (every 10 frames)
      const yieldCalls = setTimeoutSpy.mock.calls.filter(
        call => call[1] === 1
      );
      expect(yieldCalls.length).toBeGreaterThanOrEqual(2);

      setTimeoutSpy.mockRestore();
      jest.useFakeTimers();
    });
  });

  describe('fillFrameWithPattern', () => {
    it('should fill frame with procedural pattern', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions);

      const imageData = new ImageData(10, 10);
      (processor as any).fillFrameWithPattern(imageData, 0, 0, 10);

      // Check that pixels are filled (not all zeros)
      const hasNonZeroPixels = imageData.data.some((value, index) => {
        // Skip alpha channel (every 4th value)
        return index % 4 !== 3 && value !== 0;
      });
      expect(hasNonZeroPixels).toBe(true);

      // Check that all alpha values are 255
      for (let i = 3; i < imageData.data.length; i += 4) {
        expect(imageData.data[i]).toBe(255);
      }
    });

    it('should create different patterns for different frames', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions);

      const imageData1 = new ImageData(10, 10);
      const imageData2 = new ImageData(10, 10);

      (processor as any).fillFrameWithPattern(imageData1, 0, 0, 10);
      (processor as any).fillFrameWithPattern(imageData2, 5, 2.5, 10);

      // Patterns should be different
      let differenceCount = 0;
      for (let i = 0; i < imageData1.data.length; i++) {
        if (imageData1.data[i] !== imageData2.data[i]) {
          differenceCount++;
        }
      }

      expect(differenceCount).toBeGreaterThan(0);
    });
  });

  describe('reportProgress', () => {
    it('should report progress with clamped values', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, 123, onProgress);

      (processor as any).reportProgress('processing', 150, 'Test message');

      expect(onProgress).toHaveBeenCalledWith({
        stage: 'processing',
        progress: 100, // Clamped to 100
        message: 'Test message'
      });

      (processor as any).reportProgress('processing', -50, 'Test message');

      expect(onProgress).toHaveBeenCalledWith({
        stage: 'processing',
        progress: 0, // Clamped to 0
        message: 'Test message'
      });
    });

    it('should include extra properties', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, 123, onProgress);

      (processor as any).reportProgress('receiving', 50, 'Test message', {
        framesReceived: 10,
        totalFrames: 20
      });

      expect(onProgress).toHaveBeenCalledWith({
        stage: 'receiving',
        progress: 50,
        message: 'Test message',
        framesReceived: 10,
        totalFrames: 20
      });
    });

    it('should not call callback if not provided', () => {
      processor = new ServiceWorkerVideoProcessor(defaultOptions, 123);

      // Should not throw
      expect(() => {
        (processor as any).reportProgress('processing', 50, 'Test message');
      }).not.toThrow();
    });
  });
});

describe('extractVideoFramesInServiceWorker', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should create processor and extract frames', async () => {
    const options: ServiceWorkerVideoProcessingOptions = {
      startTime: 0,
      endTime: 5,
      frameRate: 10,
      quality: 'medium',
      videoWidth: 1920,
      videoHeight: 1080
    };

    mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
      callback({ frames: [new ImageData(100, 100)] });
    });

    const promise = extractVideoFramesInServiceWorker(options, 123);
    jest.runAllTimers();
    const result = await promise;

    expect(result.frames.length).toBe(1);
    expect(result.metadata.extractionMethod).toBe('content-script-relay');
  });

  it('should pass progress callback to processor', async () => {
    const options: ServiceWorkerVideoProcessingOptions = {
      startTime: 0,
      endTime: 5,
      frameRate: 10,
      quality: 'medium',
      videoWidth: 1920,
      videoHeight: 1080
    };

    const onProgress = jest.fn();

    mockChrome.tabs.sendMessage.mockImplementation((tabId, request, callback) => {
      callback({ frames: [] });
    });

    const promise = extractVideoFramesInServiceWorker(options, 123, onProgress);
    jest.runAllTimers();
    await promise;

    expect(onProgress).toHaveBeenCalled();
  });
});

describe('createServiceWorkerProcessorOptions', () => {
  it('should create options from input data', () => {
    const data = {
      videoElement: {
        currentTime: 0,
        duration: 60,
        videoWidth: 1920,
        videoHeight: 1080
      },
      settings: {
        startTime: 0,
        endTime: 10,
        frameRate: 15,
        quality: 'high' as const,
        maxWidth: 1280,
        maxHeight: 720
      }
    };

    const options = createServiceWorkerProcessorOptions(data);

    expect(options).toEqual({
      startTime: 0,
      endTime: 10,
      frameRate: 15,
      quality: 'high',
      videoWidth: 1920,
      videoHeight: 1080,
      maxWidth: 1280,
      maxHeight: 720
    });
  });

  it('should handle missing max dimensions', () => {
    const data = {
      videoElement: {
        currentTime: 0,
        duration: 60,
        videoWidth: 1920,
        videoHeight: 1080
      },
      settings: {
        startTime: 0,
        endTime: 10,
        frameRate: 15,
        quality: 'medium' as const
      }
    };

    const options = createServiceWorkerProcessorOptions(data);

    expect(options).toEqual({
      startTime: 0,
      endTime: 10,
      frameRate: 15,
      quality: 'medium',
      videoWidth: 1920,
      videoHeight: 1080
    });
  });
});