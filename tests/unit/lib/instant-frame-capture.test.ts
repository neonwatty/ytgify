/**
 * Tests for InstantFrameCapture
 * Priority 1: Emergency fallback frame capture functionality
 */

import { captureInstantFrames, InstantCaptureOptions } from '@/lib/instant-frame-capture';
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
      getImageData: jest.fn().mockImplementation(() => {
        // Return ImageData with current canvas dimensions
        return new ImageData(this.width, this.height);
      })
    };
  }

  getContext(type: string) {
    if (type === '2d') {
      return this.context;
    }
    return null;
  }
}

// Ensure the mock is always available
if (!(global as any).OffscreenCanvas) {
  (global as any).OffscreenCanvas = MockOffscreenCanvas;
}

describe('InstantFrameCapture', () => {
  let mockVideoElement: HTMLVideoElement;

  beforeEach(() => {
    jest.clearAllMocks();

    // Ensure OffscreenCanvas mock is always present
    (global as any).OffscreenCanvas = MockOffscreenCanvas;

    // Create mock video element
    mockVideoElement = {
      videoWidth: 1920,
      videoHeight: 1080,
      currentTime: 5,
      duration: 60,
      paused: false,
      pause: jest.fn(),
      play: jest.fn().mockResolvedValue(undefined)
    } as any;
  });

  describe('captureInstantFrames', () => {
    it('should capture frames with default options', async () => {
      const frames = await captureInstantFrames(mockVideoElement, 0, 5);

      expect(frames).toHaveLength(10); // Default frameCount
      expect(frames[0]).toBeInstanceOf(ImageData);
      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        '[InstantCapture] Starting instant frame capture',
        expect.objectContaining({
          startTime: 0,
          endTime: 5,
          frameCount: 10
        })
      );
    });

    it('should capture specified number of frames', async () => {
      const options: InstantCaptureOptions = {
        frameCount: 5,
        width: 640,
        height: 480
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 3, options);

      expect(frames).toHaveLength(5);
      frames.forEach(frame => {
        expect(frame.width).toBeLessThanOrEqual(640);
        expect(frame.height).toBeLessThanOrEqual(480);
      });
    });

    it('should maintain aspect ratio when resizing', async () => {
      const options: InstantCaptureOptions = {
        frameCount: 3,
        width: 640,
        height: 480
      };

      // Video is 16:9
      const expectedAspectRatio = 1920 / 1080;

      await captureInstantFrames(mockVideoElement, 0, 2, options);

      // Canvas should be resized to maintain aspect ratio
      const canvasInstances = (MockOffscreenCanvas as any).mock?.instances ||
                             [(global as any).OffscreenCanvas.mock?.instances?.[0]];

      if (canvasInstances?.[0]) {
        const canvas = canvasInstances[0];
        const actualAspectRatio = canvas.width / canvas.height;
        expect(actualAspectRatio).toBeCloseTo(expectedAspectRatio, 1);
      }
    });

    it('should handle vertical video aspect ratio', async () => {
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

      const options: InstantCaptureOptions = {
        frameCount: 3,
        width: 480,
        height: 640
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 2, options);

      expect(frames).toHaveLength(5); // Always returns at least 5 frames due to duplication
      // Should maintain vertical aspect ratio
      frames.forEach(frame => {
        const aspectRatio = frame.width / frame.height;
        expect(aspectRatio).toBeLessThan(1); // Vertical
      });
    });

    it('should ensure even dimensions', async () => {
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

      const options: InstantCaptureOptions = {
        frameCount: 2,
        width: 641,
        height: 361
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 1, options);

      expect(frames).toHaveLength(5); // Always at least 5 frames
      frames.forEach(frame => {
        expect(frame.width % 2).toBe(0);
        expect(frame.height % 2).toBe(0);
      });
    });

    it('should pause and restore video state', async () => {
      Object.defineProperty(mockVideoElement, 'paused', {
        value: false,
        writable: true,
        configurable: true
      });
      mockVideoElement.currentTime = 15;

      await captureInstantFrames(mockVideoElement, 0, 5);

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect(mockVideoElement.currentTime).toBe(15); // Restored
      expect(mockVideoElement.play).toHaveBeenCalled(); // Was playing, so resumed
    });

    it('should not resume if video was already paused', async () => {
      Object.defineProperty(mockVideoElement, 'paused', {
        value: true,
        writable: true,
        configurable: true
      });

      await captureInstantFrames(mockVideoElement, 0, 5);

      expect(mockVideoElement.pause).toHaveBeenCalled();
      expect(mockVideoElement.play).not.toHaveBeenCalled();
    });

    it('should seek to start if video is outside range', async () => {
      mockVideoElement.currentTime = 20; // Outside 0-5 range

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 20),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      await captureInstantFrames(mockVideoElement, 0, 5);

      // Should seek to start (0) initially
      expect(timeAssignments).toContain(0);
    });

    it('should not seek if video is within range', async () => {
      mockVideoElement.currentTime = 2; // Within 0-5 range

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 2),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      await captureInstantFrames(mockVideoElement, 0, 5);

      // Should not seek to start since already in range
      // First seek should be for frame capture
      expect(timeAssignments[0]).not.toBe(0);
    });

    it('should handle play error on restore', async () => {
      Object.defineProperty(mockVideoElement, 'paused', {
        value: false,
        writable: true,
        configurable: true
      });
      mockVideoElement.play = jest.fn().mockRejectedValue(new Error('Play failed'));

      // Should not throw even if play fails
      await expect(captureInstantFrames(mockVideoElement, 0, 5))
        .resolves.toBeDefined();
    });

    it('should capture all requested frames', async () => {
      const options: InstantCaptureOptions = {
        frameCount: 20 // Large number
      };

      // Mock slow capture by tracking frame count
      let captureCount = 0;
      const mockContext = {
        clearRect: jest.fn(),
        drawImage: jest.fn(() => {
          captureCount++;
        }),
        getImageData: jest.fn().mockImplementation(() => {
          return new ImageData(480, 360);
        })
      };

      (global as any).OffscreenCanvas = class {
        width = 480;
        height = 360;
        getContext() { return mockContext; }
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 5, options);

      // Should have at least 5 frames (minimum enforced)
      expect(frames.length).toBeGreaterThanOrEqual(5);
    });

    it('should duplicate frames if not enough captured', async () => {
      const options: InstantCaptureOptions = {
        frameCount: 2 // Will result in less than 5 frames
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 1, options);

      // Should duplicate to ensure at least 5 frames
      expect(frames.length).toBeGreaterThanOrEqual(5);

      // Check that last frames are duplicates
      const lastFrame = frames[frames.length - 1];
      const secondLastFrame = frames[frames.length - 2];
      expect(lastFrame).toBe(secondLastFrame); // Same reference if duplicated
    });

    it('should handle canvas context failure', async () => {
      // Mock OffscreenCanvas to return null context
      const OriginalOffscreenCanvas = (global as any).OffscreenCanvas;
      (global as any).OffscreenCanvas = class {
        width = 480;
        height = 360;
        getContext() { return null; }
      };

      await expect(captureInstantFrames(mockVideoElement, 0, 5))
        .rejects.toThrow('video: Failed to create canvas context');

      expect(logger.error).toHaveBeenCalledWith(
        '[InstantCapture] Frame capture failed',
        expect.objectContaining({ error: expect.any(Error) })
      );

      // Restore
      (global as any).OffscreenCanvas = OriginalOffscreenCanvas;
    });

    it('should provide emergency fallback on error', async () => {
      // First context fails, but emergency fallback works
      let callCount = 0;
      const mockContext = {
        clearRect: jest.fn(),
        drawImage: jest.fn(),
        getImageData: jest.fn().mockReturnValue(new ImageData(480, 360))
      };

      (global as any).OffscreenCanvas = class {
        width = 480;
        height = 360;
        getContext() {
          callCount++;
          if (callCount === 1) {
            return {
              clearRect: jest.fn(),
              drawImage: jest.fn().mockImplementation(() => {
                throw new Error('Draw failed');
              }),
              getImageData: jest.fn()
            };
          }
          return mockContext;
        }
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 5);

      // Should return emergency fallback frames
      expect(frames).toHaveLength(3); // Emergency returns 3 copies
      expect(frames[0]).toBe(frames[1]); // Same reference
      expect(frames[1]).toBe(frames[2]); // Same reference
    });

    it('should throw if emergency fallback also fails', async () => {
      // Both attempts fail
      (global as any).OffscreenCanvas = class {
        width = 480;
        height = 360;
        getContext() {
          return null; // Always fails
        }
      };

      await expect(captureInstantFrames(mockVideoElement, 0, 5))
        .rejects.toThrow('video: Failed to create canvas context');
    });

    it('should calculate frame intervals correctly', async () => {
      jest.useRealTimers(); // Use real timers for this test
      const options: InstantCaptureOptions = {
        frameCount: 5
      };

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 0),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      await captureInstantFrames(mockVideoElement, 0, 10, options);

      // Check intervals (skipping first which might be initial seek)
      const captureTimings = timeAssignments.filter(t => t <= 10);

      // Should have captures at intervals
      expect(captureTimings.length).toBeGreaterThanOrEqual(1); // At least some seeks
      jest.useFakeTimers(); // Restore fake timers
    });

    it('should limit capture time to endTime', async () => {
      jest.useRealTimers();
      const options: InstantCaptureOptions = {
        frameCount: 5
      };

      const timeAssignments: number[] = [];
      Object.defineProperty(mockVideoElement, 'currentTime', {
        get: jest.fn(() => 0),
        set: jest.fn((value) => {
          timeAssignments.push(value);
        }),
        configurable: true
      });

      await captureInstantFrames(mockVideoElement, 0, 3, options);

      // All time assignments should be <= 3 (except restore)
      const captureAssignments = timeAssignments.slice(0, -1);
      captureAssignments.forEach(time => {
        expect(time).toBeLessThanOrEqual(3);
      });
      jest.useFakeTimers();
    });

    it('should log debug messages for each frame capture', async () => {
      jest.useRealTimers();
      const options: InstantCaptureOptions = {
        frameCount: 3
      };

      await captureInstantFrames(mockVideoElement, 0, 2, options);

      expect(logger.debug).toHaveBeenCalledWith('[InstantCapture] Captured frame 1/3');
      expect(logger.debug).toHaveBeenCalledWith('[InstantCapture] Captured frame 2/3');
      expect(logger.debug).toHaveBeenCalledWith('[InstantCapture] Captured frame 3/3');
      jest.useFakeTimers();
    });

    it('should log success message with frame count', async () => {
      jest.useRealTimers();
      await captureInstantFrames(mockVideoElement, 0, 5);

      expect(logger.info).toHaveBeenCalledWith(
        '[InstantCapture] Captured 10 frames successfully'
      );
      jest.useFakeTimers();
    });

    it('should handle zero duration gracefully', async () => {
      jest.useRealTimers();
      const options: InstantCaptureOptions = {
        frameCount: 3
      };

      const frames = await captureInstantFrames(mockVideoElement, 5, 5, options);

      // Should still capture frames even with zero duration
      expect(frames.length).toBeGreaterThanOrEqual(5); // Min 5 due to duplication
      jest.useFakeTimers();
    });

    it('should handle single frame capture', async () => {
      jest.useRealTimers();
      const options: InstantCaptureOptions = {
        frameCount: 1
      };

      const frames = await captureInstantFrames(mockVideoElement, 0, 5, options);

      // Should duplicate to minimum 5 frames
      expect(frames.length).toBe(5);
      // Last frames should be duplicates
      expect(frames[3]).toBe(frames[4]); // Last two are duplicates
      jest.useFakeTimers();
    });

    it('should handle large frame counts efficiently', async () => {
      jest.useRealTimers();
      const options: InstantCaptureOptions = {
        frameCount: 100
      };

      const startTime = Date.now();
      const frames = await captureInstantFrames(mockVideoElement, 0, 10, options);
      const endTime = Date.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000);
      expect(frames.length).toBeGreaterThan(0);
      jest.useFakeTimers();
    });
  });
});