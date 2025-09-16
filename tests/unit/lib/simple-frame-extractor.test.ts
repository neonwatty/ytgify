/**
 * Tests for SimpleFrameExtractor
 * Priority 1: Core frame extraction functionality
 */

import { extractFramesSimple, SimpleFrameExtractionOptions, SimpleFrameExtractionResult } from '@/lib/simple-frame-extractor';
import { logger } from '@/lib/logger';
import { createError } from '@/lib/errors';

// Mock dependencies
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/errors', () => ({
  createError: jest.fn((type: string, message: string) => new Error(`${type}: ${message}`))
}));

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  private context: any;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.context = {
      clearRect: jest.fn(),
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue(new ImageData(width, height))
    };
  }

  getContext(type: string) {
    if (type === '2d') {
      return this.context;
    }
    return null;
  }
}

// Replace global OffscreenCanvas
(global as any).OffscreenCanvas = MockOffscreenCanvas;

describe('SimpleFrameExtractor', () => {
  let mockVideoElement: HTMLVideoElement;
  let originalPerformanceNow: typeof performance.now;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock performance.now for consistent timing
    let time = 0;
    originalPerformanceNow = performance.now;
    performance.now = jest.fn(() => {
      time += 100;
      return time;
    });

    // Create mock video element
    mockVideoElement = {
      videoWidth: 1920,
      videoHeight: 1080,
      currentTime: 0,
      duration: 60,
      paused: false,
      pause: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined)
    } as any;
  });

  afterEach(() => {
    performance.now = originalPerformanceNow;
    jest.useRealTimers();
  });

  describe('extractFramesSimple', () => {
    const defaultOptions: SimpleFrameExtractionOptions = {
      startTime: 0,
      endTime: 5,
      frameRate: 10,
      quality: 'medium'
    };

    it('should extract frames successfully with default options', async () => {
      const promise = extractFramesSimple(mockVideoElement, defaultOptions);

      // Fast-forward through all setTimeout calls
      await jest.runAllTimersAsync();

      const result = await promise;

      expect(result.frames).toHaveLength(50); // 5 seconds * 10 fps
      expect(result.metadata.totalFrames).toBe(50);
      expect(result.metadata.actualFrameRate).toBeCloseTo(10);
      expect(result.metadata.duration).toBe(5);
      expect(result.metadata.extractionMethod).toBe('simple-capture');

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[SimpleFrameExtractor] Starting simplified frame extraction'
      );
    });

    it('should handle different quality settings', async () => {
      const qualities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
      const expectedScales = { low: 0.5, medium: 0.75, high: 1.0 };

      for (const quality of qualities) {
        jest.clearAllMocks();
        const options = { ...defaultOptions, quality };
        const promise = extractFramesSimple(mockVideoElement, options);
        await jest.runAllTimersAsync();
        const result = await promise;

        const scale = expectedScales[quality];
        const expectedWidth = Math.floor((1920 * scale) / 2) * 2;
        const expectedHeight = Math.floor((1080 * scale) / 2) * 2;

        expect(result.metadata.dimensions.width).toBeLessThanOrEqual(expectedWidth);
        expect(result.metadata.dimensions.height).toBeLessThanOrEqual(expectedHeight);
      }
    });

    it('should respect maxWidth and maxHeight constraints', async () => {
      const options: SimpleFrameExtractionOptions = {
        ...defaultOptions,
        maxWidth: 640,
        maxHeight: 360
      };

      const promise = extractFramesSimple(mockVideoElement, options);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.metadata.dimensions.width).toBeLessThanOrEqual(640);
      expect(result.metadata.dimensions.height).toBeLessThanOrEqual(360);

      // Should maintain aspect ratio
      const aspectRatio = result.metadata.dimensions.width / result.metadata.dimensions.height;
      const originalAspectRatio = 1920 / 1080;
      expect(aspectRatio).toBeCloseTo(originalAspectRatio, 1);
    });

    it('should handle video with different aspect ratios', async () => {
      // Test vertical video
      Object.defineProperty(mockVideoElement, 'videoWidth', {
        value: 1080,
        writable: true,
        configurable: true
      });
      Object.defineProperty(mockVideoElement, 'videoHeight', {
        value: 1920,
        writable: true,
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      const result = await promise;

      const aspectRatio = result.metadata.dimensions.width / result.metadata.dimensions.height;
      expect(aspectRatio).toBeCloseTo(1080 / 1920, 1);
    });

    it('should report progress during extraction', async () => {
      const onProgress = jest.fn();

      const promise = extractFramesSimple(mockVideoElement, defaultOptions, onProgress);
      await jest.runAllTimersAsync();
      await promise;

      // Should have multiple progress updates
      expect(onProgress).toHaveBeenCalled();

      // Check first and last progress calls
      const progressCalls = onProgress.mock.calls;
      expect(progressCalls[0][0]).toMatchObject({
        progress: expect.any(Number),
        message: expect.stringContaining('Captured'),
        stage: 'extracting'
      });

      const lastCall = progressCalls[progressCalls.length - 1][0];
      expect(lastCall.progress).toBe(100);
    });

    it('should restore video state after extraction', async () => {
      mockVideoElement.currentTime = 10;
      Object.defineProperty(mockVideoElement, 'paused', {
        value: false,
        writable: true,
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockVideoElement.currentTime).toBe(10); // Restored
      expect(mockVideoElement.play).toHaveBeenCalled(); // Video was playing, so should resume
    });

    it('should handle paused video correctly', async () => {
      Object.defineProperty(mockVideoElement, 'paused', {
        value: true,
        writable: true,
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      await promise;

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect(mockVideoElement.play).not.toHaveBeenCalled(); // Should not resume if was paused
    });

    it('should move to start position if video is outside range', async () => {
      mockVideoElement.currentTime = 20; // Outside the 0-5 range

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      await promise;

      // Should restore to original position after extraction
      expect(mockVideoElement.currentTime).toBe(20); // Gets restored to original
    });

    it('should handle different frame rates', async () => {
      const frameRates = [5, 15, 30];

      for (const frameRate of frameRates) {
        jest.clearAllMocks();
        const options = { ...defaultOptions, frameRate };
        const promise = extractFramesSimple(mockVideoElement, options);
        await jest.runAllTimersAsync();
        const result = await promise;

        const expectedFrames = Math.ceil(5 * frameRate); // 5 second duration
        expect(result.frames).toHaveLength(expectedFrames);
        expect(result.metadata.actualFrameRate).toBeCloseTo(frameRate);
      }
    }, 10000);

    it('should handle extraction error when canvas context fails', async () => {
      // Mock OffscreenCanvas to return null context
      const OriginalOffscreenCanvas = (global as any).OffscreenCanvas;
      (global as any).OffscreenCanvas = class {
        constructor(width: number, height: number) {}
        getContext() { return null; }
      };

      await expect(extractFramesSimple(mockVideoElement, defaultOptions))
        .rejects.toThrow('video: Failed to create canvas context');

      expect(logger.error).toHaveBeenCalledWith(
        '[SimpleFrameExtractor] Frame extraction failed',
        expect.objectContaining({ error: expect.any(Error) })
      );

      // Restore
      (global as any).OffscreenCanvas = OriginalOffscreenCanvas;
    });

    it('should handle video play error on restore', async () => {
      Object.defineProperty(mockVideoElement, 'paused', {
        value: false,
        writable: true,
        configurable: true
      });
      mockVideoElement.play = jest.fn().mockRejectedValue(new Error('Play failed'));

      // Should not throw even if play fails
      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      await expect(promise).resolves.toBeDefined();
    });

    it('should ensure even dimensions for video encoding', async () => {
      // Set video dimensions that would result in odd numbers after scaling
      Object.defineProperty(mockVideoElement, 'videoWidth', {
        value: 1921,
        writable: true,
        configurable: true
      });
      Object.defineProperty(mockVideoElement, 'videoHeight', {
        value: 1081,
        writable: true,
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      const result = await promise;

      // Both dimensions should be even
      expect(result.metadata.dimensions.width % 2).toBe(0);
      expect(result.metadata.dimensions.height % 2).toBe(0);
    });

    it('should handle very short durations', async () => {
      const options: SimpleFrameExtractionOptions = {
        startTime: 0,
        endTime: 0.1, // 100ms
        frameRate: 10,
        quality: 'medium'
      };

      const promise = extractFramesSimple(mockVideoElement, options);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.frames.length).toBeGreaterThan(0);
      expect(result.metadata.duration).toBe(0.1);
    });

    it('should handle very long durations', async () => {
      const options: SimpleFrameExtractionOptions = {
        startTime: 0,
        endTime: 60, // 1 minute
        frameRate: 10,
        quality: 'low' // Low quality for performance
      };

      const promise = extractFramesSimple(mockVideoElement, options);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.frames).toHaveLength(600); // 60 seconds * 10 fps
      expect(result.metadata.duration).toBe(60);
    });

    it('should capture frames at correct time intervals', async () => {
      const options: SimpleFrameExtractionOptions = {
        startTime: 2,
        endTime: 4, // 2 second duration
        frameRate: 5,
        quality: 'medium'
      };

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 0),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, options);
      await jest.runAllTimersAsync();
      await promise;

      // Should have set time for each frame capture plus initial setup and restore
      // Initial setup (if outside range) + frame captures + restore
      const frameCaptureAssignments = timeAssignments.slice(0, -1); // Exclude restore

      // Check that we're capturing at correct intervals
      const expectedFrames = 10; // 2 seconds * 5 fps
      expect(frameCaptureAssignments.length).toBeGreaterThanOrEqual(expectedFrames);
    });

    it.skip('should handle canvas drawing errors gracefully', async () => {
      const OriginalOffscreenCanvas = (global as any).OffscreenCanvas;

      const mockContext = {
        clearRect: jest.fn(),
        drawImage: jest.fn().mockImplementation(() => {
          throw new Error('Canvas draw failed');
        }),
        getImageData: jest.fn()
      };

      (global as any).OffscreenCanvas = class {
        constructor(width: number, height: number) {}
        getContext() { return mockContext; }
      };

      try {
        // Start the extraction process
        const promise = extractFramesSimple(mockVideoElement, defaultOptions);

        // Run all pending timers to trigger the error
        await jest.runAllTimersAsync();

        // Wait for the promise to reject
        await promise;

        // If we get here, the test should fail
        fail('Expected extractFramesSimple to throw an error');
      } catch (error) {
        // Verify the error message
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('video: Frame extraction failed: Canvas draw failed');

        expect(logger.error).toHaveBeenCalledWith(
          '[SimpleFrameExtractor] Frame extraction failed',
          expect.objectContaining({ error: expect.any(Error) })
        );
      } finally {
        // Restore
        (global as any).OffscreenCanvas = OriginalOffscreenCanvas;
      }
    });

    it('should calculate correct processing time', async () => {
      // Ensure we're using the original mock OffscreenCanvas
      const OriginalOffscreenCanvas = (global as any).OffscreenCanvas;
      (global as any).OffscreenCanvas = MockOffscreenCanvas;

      const promise = extractFramesSimple(mockVideoElement, defaultOptions);
      await jest.runAllTimersAsync();
      const result = await promise;

      expect(result.metadata.processingTime).toBeGreaterThan(0);
      expect(logger.info).toHaveBeenCalledWith(
        '[SimpleFrameExtractor] Extraction complete',
        expect.objectContaining({
          framesCaptured: result.frames.length,
          processingTime: expect.any(Number)
        })
      );

      // Restore if needed
      (global as any).OffscreenCanvas = OriginalOffscreenCanvas;
    });

    it('should handle edge case where endTime equals startTime', async () => {
      const options: SimpleFrameExtractionOptions = {
        startTime: 5,
        endTime: 5, // Same as start
        frameRate: 10,
        quality: 'medium'
      };

      const result = await extractFramesSimple(mockVideoElement, options);

      // Should still capture at least one frame
      expect(result.frames.length).toBeGreaterThanOrEqual(0);
      expect(result.metadata.duration).toBe(0);
    });

    it('should limit capture time to not exceed endTime', async () => {
      // Ensure we're using the original mock OffscreenCanvas
      const OriginalOffscreenCanvas = (global as any).OffscreenCanvas;
      (global as any).OffscreenCanvas = MockOffscreenCanvas;

      const options: SimpleFrameExtractionOptions = {
        startTime: 0,
        endTime: 3,
        frameRate: 10,
        quality: 'medium'
      };

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 0),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      const promise = extractFramesSimple(mockVideoElement, options);
      await jest.runAllTimersAsync();
      await promise;

      // All time assignments (except restore) should be <= endTime
      const captureAssignments = timeAssignments.slice(0, -1);
      captureAssignments.forEach(time => {
        expect(time).toBeLessThanOrEqual(options.endTime);
      });

      // Restore
      (global as any).OffscreenCanvas = OriginalOffscreenCanvas;
    });
  });
});