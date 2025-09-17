import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { CanvasProcessor } from '@/processing/canvas-processor';
import { ExtractedFrame } from '@/processing/frame-extractor';

describe('CanvasProcessor - Resolution Scaling', () => {
  let processor: CanvasProcessor;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock canvas and context
    mockContext = {
      drawImage: jest.fn(),
      getImageData: jest.fn(() => new ImageData(100, 100)),
      putImageData: jest.fn(),
      clearRect: jest.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high' as ImageSmoothingQuality,
    } as any;

    mockCanvas = {
      width: 0,
      height: 0,
      getContext: jest.fn().mockReturnValue(mockContext),
    } as any;

    // Mock document.createElement to return our mock canvas
    const originalCreateElement = document.createElement;
    jest.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName === 'canvas') {
        return mockCanvas;
      }
      return originalCreateElement.call(document, tagName);
    });

    processor = new CanvasProcessor();
  });

  describe('Resolution Scaling for 16:9 Videos', () => {
    describe('480p Resolution (852x480)', () => {
      it('should scale 1920x1080 video to 852x480 when 480p is selected', async () => {
        // Create test frames at 1920x1080
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 100,
            frameIndex: 1,
          },
        ];

        // Process frames with 480p resolution
        const config = {
          targetWidth: 852,
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Verify dimensions are correct for 480p
        expect(result.frames[0].processedDimensions.width).toBe(852);
        expect(result.frames[0].processedDimensions.height).toBe(480);
        expect(result.frames[1].processedDimensions.width).toBe(852);
        expect(result.frames[1].processedDimensions.height).toBe(480);

        // Verify aspect ratio is maintained (approximately 16:9)
        const aspectRatio = 852 / 480;
        expect(aspectRatio).toBeCloseTo(16 / 9, 2);

        // Verify metadata
        expect(result.metadata.originalDimensions).toEqual({ width: 1920, height: 1080 });
        expect(result.metadata.finalDimensions).toEqual({ width: 852, height: 480 });
      });

      it('should scale 1280x720 video to 852x480 when 480p is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1280, 720),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetWidth: 852,
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        expect(result.frames[0].processedDimensions.width).toBe(852);
        expect(result.frames[0].processedDimensions.height).toBe(480);
        expect(result.metadata.originalDimensions).toEqual({ width: 1280, height: 720 });
        expect(result.metadata.finalDimensions).toEqual({ width: 852, height: 480 });
      });

      it('should upscale 640x360 video to 852x480 when 480p is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(640, 360),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetWidth: 852,
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // CanvasProcessor applies target dimensions (upscaling is allowed)
        expect(result.frames[0].processedDimensions.width).toBe(852);
        expect(result.frames[0].processedDimensions.height).toBe(480);
      });
    });

    describe('720p Resolution (1280x720)', () => {
      it('should scale 1920x1080 video to 1280x720 when 720p is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 100,
            frameIndex: 1,
          },
        ];

        const config = {
          targetWidth: 1280,
          targetHeight: 720,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Verify dimensions are correct for 720p
        expect(result.frames[0].processedDimensions.width).toBe(1280);
        expect(result.frames[0].processedDimensions.height).toBe(720);
        expect(result.frames[1].processedDimensions.width).toBe(1280);
        expect(result.frames[1].processedDimensions.height).toBe(720);

        // Verify aspect ratio is maintained (exactly 16:9)
        const aspectRatio = 1280 / 720;
        expect(aspectRatio).toBeCloseTo(16 / 9, 10);

        // Verify metadata
        expect(result.metadata.originalDimensions).toEqual({ width: 1920, height: 1080 });
        expect(result.metadata.finalDimensions).toEqual({ width: 1280, height: 720 });
      });

      it('should scale 3840x2160 (4K) video to 1280x720 when 720p is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(3840, 2160),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetWidth: 1280,
          targetHeight: 720,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        expect(result.frames[0].processedDimensions.width).toBe(1280);
        expect(result.frames[0].processedDimensions.height).toBe(720);
        expect(result.metadata.originalDimensions).toEqual({ width: 3840, height: 2160 });
        expect(result.metadata.finalDimensions).toEqual({ width: 1280, height: 720 });
      });

      it('should upscale 640x360 video to 1280x720 when 720p is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(640, 360),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetWidth: 1280,
          targetHeight: 720,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // CanvasProcessor applies target dimensions (upscaling is allowed)
        expect(result.frames[0].processedDimensions.width).toBe(1280);
        expect(result.frames[0].processedDimensions.height).toBe(720);
      });
    });

    describe('Original Resolution', () => {
      it('should preserve original 1920x1080 dimensions when original is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        // When no target dimensions are specified, original should be preserved
        const config = {
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Should maintain original dimensions
        expect(result.frames[0].processedDimensions.width).toBe(1920);
        expect(result.frames[0].processedDimensions.height).toBe(1080);
        expect(result.metadata.originalDimensions).toEqual({ width: 1920, height: 1080 });
        expect(result.metadata.finalDimensions).toEqual({ width: 1920, height: 1080 });
      });

      it('should preserve original 3840x2160 (4K) dimensions when original is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(3840, 2160),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Should maintain original dimensions
        expect(result.frames[0].processedDimensions.width).toBe(3840);
        expect(result.frames[0].processedDimensions.height).toBe(2160);
        expect(result.metadata.originalDimensions).toEqual({ width: 3840, height: 2160 });
        expect(result.metadata.finalDimensions).toEqual({ width: 3840, height: 2160 });
      });

      it('should preserve original 640x360 dimensions when original is selected', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(640, 360),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Should maintain original dimensions
        expect(result.frames[0].processedDimensions.width).toBe(640);
        expect(result.frames[0].processedDimensions.height).toBe(360);
        expect(result.metadata.originalDimensions).toEqual({ width: 640, height: 360 });
        expect(result.metadata.finalDimensions).toEqual({ width: 640, height: 360 });
      });
    });

    describe('Different Aspect Ratios', () => {
      it('should correctly scale portrait video (9:16) to 480p', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1080, 1920),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // For portrait 9:16, when height is 480, width should be 270
        expect(result.frames[0].processedDimensions.width).toBe(270);
        expect(result.frames[0].processedDimensions.height).toBe(480);

        // Verify aspect ratio is maintained
        const aspectRatio = 270 / 480;
        expect(aspectRatio).toBeCloseTo(9 / 16, 2);
      });

      it('should correctly scale square video (1:1) to 480p', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1080, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // For square video, width and height should be equal
        expect(result.frames[0].processedDimensions.width).toBe(480);
        expect(result.frames[0].processedDimensions.height).toBe(480);

        // Verify aspect ratio is maintained (1:1)
        const aspectRatio = 480 / 480;
        expect(aspectRatio).toBe(1);
      });

      it('should correctly scale ultra-wide video (21:9) to 720p', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(2560, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetHeight: 720,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // For 2560x1080 scaled to height 720, calculate expected width
        const originalAspectRatio = 2560 / 1080;
        // Width should be 1706 after rounding and making even

        expect(result.frames[0].processedDimensions.width).toBe(1706);
        expect(result.frames[0].processedDimensions.height).toBe(720);

        // Verify aspect ratio is approximately maintained
        const resultAspectRatio =
          result.frames[0].processedDimensions.width / result.frames[0].processedDimensions.height;
        expect(resultAspectRatio).toBeCloseTo(originalAspectRatio, 2);
      });
    });

    describe('Batch Processing with Multiple Resolutions', () => {
      it('should correctly process multiple frames at consistent resolution', async () => {
        const frames: ExtractedFrame[] = Array.from({ length: 10 }, (_, i) => ({
          imageData: new ImageData(1920, 1080),
          timestamp: i * 100,
          frameIndex: i,
        }));

        const config = {
          targetWidth: 1280,
          targetHeight: 720,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Verify all frames have the same dimensions
        result.frames.forEach((frame) => {
          expect(frame.processedDimensions.width).toBe(1280);
          expect(frame.processedDimensions.height).toBe(720);
        });

        // Verify metadata
        expect(result.metadata.totalFrames).toBe(10);
        expect(result.metadata.finalDimensions).toEqual({ width: 1280, height: 720 });
      });
    });

    describe('Even Dimension Enforcement', () => {
      it('should ensure dimensions are even for video encoding compatibility', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1921, 1081),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetHeight: 480,
          maintainAspectRatio: true,
        };

        const result = await processor.processFrames(frames, config);

        // Both dimensions should be even
        expect(result.frames[0].processedDimensions.width % 2).toBe(0);
        expect(result.frames[0].processedDimensions.height % 2).toBe(0);
      });
    });

    describe('Performance Validation', () => {
      it('should track processing time for each frame', async () => {
        const frames: ExtractedFrame[] = [
          {
            imageData: new ImageData(1920, 1080),
            timestamp: 0,
            frameIndex: 0,
          },
        ];

        const config = {
          targetWidth: 1280,
          targetHeight: 720,
        };

        const result = await processor.processFrames(frames, config);

        expect(result.frames[0].processingTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata.averageProcessingTime).toBeGreaterThanOrEqual(0);
        expect(result.metadata.totalProcessingTime).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
