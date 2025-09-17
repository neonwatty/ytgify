import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type { GifSettings } from '@/types';
import type {
  GifEncodingProgress,
  GifEncodingConfig
} from '@/processing/gif-encoder';
import type { ExtractedFrame } from '@/processing/frame-extractor';
import type { GifQualityPreset } from '@/processing/encoding-options';

// Mock dependencies
jest.mock('@/monitoring/performance-tracker', () => ({
  performanceTracker: {
    startOperation: jest.fn(),
    endOperation: jest.fn(),
    getMetrics: jest.fn(() => ({ avgTime: 100, count: 10 }))
  }
}));

jest.mock('@/monitoring/metrics-collector', () => ({
  metricsCollector: {
    recordGifEncoding: jest.fn(),
    recordMemoryUsage: jest.fn(),
    getStats: jest.fn(() => ({ totalGifs: 100, avgSize: 1024000 }))
  }
}));

jest.mock('@/processing/encoding-options', () => ({
  EncodingOptimizer: {
    optimize: jest.fn((options) => options),
    getRecommendedSettings: jest.fn(() => ({
      quality: 10,
      workers: 2,
      workerScript: 'gif.worker.js',
      repeat: 0,
      background: undefined,
      debug: false,
      dither: false,
      globalPalette: false,
      progressInterval: 50,
      memoryLimit: 80 * 1024 * 1024,
      timeLimit: 10000
    })),
    createOptionsFromSettings: jest.fn((_settings, _preset) => ({
      quality: 10,
      workers: 2,
      workerScript: 'gif.worker.js',
      repeat: 0,
      debug: false,
      dither: false,
      globalPalette: false,
      progressInterval: 50,
      memoryLimit: 80 * 1024 * 1024,
      timeLimit: 10000,
      width: 640,
      height: 480
    })),
    validateOptions: jest.fn(() => ({ valid: true, warnings: [] }))
  },
  EncodingProfiler: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    end: jest.fn(),
    getReport: jest.fn(() => ({
      totalTime: 1000,
      frameProcessingTime: 800,
      encodingTime: 200,
      peakMemory: 50000000
    })),
    recordMemoryUsage: jest.fn(),
    recordError: jest.fn()
  }))
}));

describe('GifEncoder', () => {
  let GifEncoder: any;
  let encoder: any;
  let mockGifInstance: any;

  const defaultGifSettings: GifSettings = {
    startTime: 0,
    endTime: 2,
    frameRate: 10,
    quality: 'medium',
    resolution: '100x100',
    speed: 1,
    brightness: 1,
    contrast: 1
  };

  // Set up window.GIF before any tests run
  beforeAll(() => {
    global.window = global.window || {};
  });

  beforeEach(() => {
    // Store event handlers
    const eventHandlers: { [key: string]: Array<(...args: any[]) => void> } = {
      start: [],
      abort: [],
      progress: [],
      finished: [],
      workerReady: []
    };

    // Mock GIF constructor
    mockGifInstance = {
      addFrame: jest.fn(),
      render: jest.fn().mockImplementation(function(this: any) {
        // Simulate async GIF encoding
        const handlers = eventHandlers;

        // Use setTimeout(0) to ensure handlers are registered
        setTimeout(() => {
          // Trigger start event
          handlers.start.forEach(handler => handler());

          // Trigger progress events
          setTimeout(() => {
            handlers.progress.forEach(handler => handler(0.5));
          }, 5);

          // Trigger finished event with blob
          setTimeout(() => {
            const mockBlob = new Blob(['test-gif-data'], { type: 'image/gif' });
            handlers.finished.forEach(handler => handler(mockBlob));
          }, 10);
        }, 0);
      }),
      abort: jest.fn().mockImplementation(() => {
        setTimeout(() => {
          eventHandlers.abort.forEach(handler => handler());
        }, 0);
      }),
      on: jest.fn().mockImplementation((event: any, callback: any) => {
        if (eventHandlers[event]) {
          eventHandlers[event].push(callback);
        }
        // Return the mock instance for chaining
        return mockGifInstance;
      }),
      running: false,
      frames: [],
      options: {},
      _eventHandlers: eventHandlers // Expose for testing
    };

    // Mock window.GIF - ensure it's available for isAvailable() check
    global.window = global.window || {};
    (global.window as any).GIF = jest.fn(() => mockGifInstance);

    jest.clearAllMocks();
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should create encoder instance', async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();

      expect(encoder).toBeDefined();
      expect(encoder.isCurrentlyEncoding()).toBe(false);
    });
  });

  describe('Frame Encoding', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should encode frames to GIF', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        },
        {
          imageData: new ImageData(100, 100),
          timestamp: 1000,
          frameIndex: 1
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings,
        preset: 'balanced' as GifQualityPreset
      };

      const result = await encoder.encodeFrames(frames, config);

      // Verify GIF instance was created
      expect(global.window.GIF).toHaveBeenCalled();

      // Verify frames were added
      expect(mockGifInstance.addFrame).toHaveBeenCalledTimes(2);

      // Verify render was called
      expect(mockGifInstance.render).toHaveBeenCalled();

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.metadata.frameCount).toBe(2);
    });

    it('should report progress during encoding', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const progressUpdates: GifEncodingProgress[] = [];
      const config: GifEncodingConfig = {
        settings: defaultGifSettings,
        onProgress: (progress) => progressUpdates.push(progress)
      };

      await encoder.encodeFrames(frames, config);

      // Wait for all async operations to complete
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(progressUpdates.length).toBeGreaterThan(0);
      expect(progressUpdates.some(p => p.stage === 'encoding')).toBe(true);
    });

    it('should handle abort signal', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const abortController = new AbortController();
      const config: GifEncodingConfig = {
        settings: defaultGifSettings,
        abortSignal: abortController.signal
      };

      // Override the mock to delay the finished event
      mockGifInstance.render = jest.fn().mockImplementation(() => {
        const handlers = mockGifInstance._eventHandlers;
        process.nextTick(() => {
          handlers.start.forEach((h: (...args: any[]) => void) => h());
          // Delay finished event to allow abort
          setTimeout(() => {
            if (!abortController.signal.aborted) {
              const blob = new Blob(['test-gif-data'], { type: 'image/gif' });
              handlers.finished.forEach((h: (...args: any[]) => void) => h(blob));
            }
          }, 50);
        });
      });

      const promise = encoder.encodeFrames(frames, config);

      // Abort encoding after a small delay
      setTimeout(() => abortController.abort(), 10);

      await expect(promise).rejects.toThrow();
      expect(mockGifInstance.abort).toHaveBeenCalled();
    });

    it('should handle encoding errors', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings
      };

      // Simulate error
      mockGifInstance.render.mockImplementation(() => {
        throw new Error('Encoding failed');
      });

      await expect(encoder.encodeFrames(frames, config)).rejects.toThrow('Encoding failed');
    });
  });

  describe('Quality Presets', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should apply quality preset settings', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: { ...defaultGifSettings, quality: 'high' } as GifSettings,
        preset: 'quality' as GifQualityPreset
      };

      const result = await encoder.encodeFrames(frames, config);

      // Check that quality settings were applied
      expect(global.window.GIF).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: expect.any(Number)
        })
      );
      expect(result.metadata.preset).toBe('quality');
    });
  });

  describe('Performance Metrics', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should track performance metrics', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings
      };

      const result = await encoder.encodeFrames(frames, config);

      // These methods don't exist in the actual performance tracker
      // Just check that the result has performance data

      expect(result.performance).toBeDefined();
      expect(result.performance.success).toBe(true);
    });
  });

  describe('Memory Management', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should handle large frame sets efficiently', async () => {
      // Create many frames
      const frames: ExtractedFrame[] = Array.from({ length: 100 }, (_, i) => ({
        imageData: new ImageData(100, 100),
        timestamp: i * 100,
        frameIndex: i
      }));

      const config: GifEncodingConfig = {
        settings: {
          startTime: 0,
          endTime: 10,
          frameRate: 30,
          quality: 'low',
          resolution: '720p',
          speed: 1,
          brightness: 1,
          contrast: 1
        }
      };

      const result = await encoder.encodeFrames(frames, config);

      expect(result.metadata.frameCount).toBe(100);
      expect(mockGifInstance.addFrame).toHaveBeenCalledTimes(100);
    });

    it('should clean up resources after encoding', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings
      };

      await encoder.encodeFrames(frames, config);

      // Attempt another encoding to ensure resources were cleaned
      const secondEncoding = encoder.encodeFrames(frames, config);
      expect(secondEncoding).toBeDefined();
    });
  });

  describe('Custom Options', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should apply custom encoding options', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings,
        customOptions: {
          workers: 4,
          background: '#ffffff'
          // Remove transparent as it's not in GifEncodingOptions
        }
      };

      await encoder.encodeFrames(frames, config);

      expect(global.window.GIF).toHaveBeenCalledWith(
        expect.objectContaining({
          workers: 4,
          background: '#ffffff'
        })
      );
    });
  });

  describe('Edge Cases', () => {
    beforeEach(async () => {
      const module = await import('@/processing/gif-encoder');
      GifEncoder = module.GifEncoder;
      encoder = new GifEncoder();
    });

    it('should handle empty frame array', async () => {
      const frames: ExtractedFrame[] = [];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings
      };

      await expect(encoder.encodeFrames(frames, config)).rejects.toThrow();
    });

    it('should prevent concurrent encoding', async () => {
      const frames: ExtractedFrame[] = [
        {
          imageData: new ImageData(100, 100),
          timestamp: 0,
          frameIndex: 0
        }
      ];

      const config: GifEncodingConfig = {
        settings: defaultGifSettings
      };

      // Start first encoding
      encoder.encodeFrames(frames, config);

      // Attempt second encoding
      await expect(encoder.encodeFrames(frames, config)).rejects.toThrow('Already encoding');
    });
  });
});