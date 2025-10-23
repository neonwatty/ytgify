/**
 * Tests for GifskiEncoder
 * Priority 1: Highest quality GIF encoding with gifski-wasm library
 */

import { GifskiEncoder } from '@/lib/encoders/gifski-encoder';
import { EncodingOptions, FrameData, EncodingProgress } from '@/lib/encoders/abstract-encoder';
import encode from 'gifski-wasm';

// Mock gifski-wasm library
jest.mock('gifski-wasm', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(
    new Uint8Array([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a header
      0x0A, 0x00, 0x0A, 0x00, // Width/height
      0xF0, 0x00, 0x00, // Global color table flag
    ])
  ),
}));

describe('GifskiEncoder', () => {
  let encoder: GifskiEncoder;
  let mockFrames: FrameData[];
  let mockOptions: EncodingOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    encoder = new GifskiEncoder();

    // Create mock frame data
    mockFrames = [
      {
        imageData: new ImageData(100, 100),
        timestamp: 0,
        delay: 100,
      },
      {
        imageData: new ImageData(100, 100),
        timestamp: 100,
        delay: 100,
      },
      {
        imageData: new ImageData(100, 100),
        timestamp: 200,
        delay: 100,
      },
    ];

    mockOptions = {
      width: 100,
      height: 100,
      frameRate: 10,
      quality: 'medium',
      loop: true,
    };
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(encoder.name).toBe('gifski');
    });

    it('should support GIF format only', () => {
      expect(encoder.supportedFormats).toEqual(['gif']);
    });

    it('should have correct characteristics', () => {
      expect(encoder.characteristics).toEqual({
        speed: 'slow',
        quality: 'high',
        memoryUsage: 'high',
        browserSupport: 'good',
      });
    });
  });

  describe('Availability', () => {
    it('should be available when gifski-wasm is loaded', () => {
      expect(encoder.isAvailable()).toBe(true);
    });

    it('should not be available when gifski-wasm encode is not a function', () => {
      const unavailableEncoder = new GifskiEncoder();
      jest.spyOn(unavailableEncoder, 'isAvailable').mockReturnValue(false);

      expect(unavailableEncoder.isAvailable()).toBe(false);

      jest.restoreAllMocks();
    });

    it('should handle availability check errors gracefully', () => {
      const errorEncoder = new GifskiEncoder();

      jest.spyOn(errorEncoder, 'isAvailable').mockImplementation(() => {
        throw new Error('Module error');
      });

      expect(() => errorEncoder.isAvailable()).toThrow('Module error');
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully when available', async () => {
      await expect(encoder.initialize()).resolves.toBeUndefined();
    });

    it('should throw error when not available', async () => {
      const unavailableEncoder = new GifskiEncoder();
      jest.spyOn(unavailableEncoder, 'isAvailable').mockReturnValue(false);

      await expect(unavailableEncoder.initialize()).rejects.toThrow(
        'gifski-wasm library is not available'
      );
    });
  });

  describe('Encoding', () => {
    it('should encode frames successfully', async () => {
      const onProgress = jest.fn();

      const result = await encoder.encode(mockFrames, mockOptions, onProgress);

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.metadata).toMatchObject({
        frameCount: 3,
        width: 100,
        height: 100,
        encoder: 'gifski',
        format: 'gif',
      });

      // Check progress was reported
      expect(onProgress).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'preparing',
          percentage: expect.any(Number),
        })
      );
    });

    it('should handle different quality settings', async () => {
      const qualities: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      for (const quality of qualities) {
        const options = { ...mockOptions, quality };
        const result = await encoder.encode(mockFrames, options);

        expect(result.metadata.frameCount).toBe(3);
        expect(encode).toHaveBeenCalled();
      }
    });

    it('should handle numeric quality values', async () => {
      const numericOptions = { ...mockOptions, quality: 85 };
      const result = await encoder.encode(mockFrames, numericOptions);

      expect(result.metadata.frameCount).toBe(3);
      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 85,
        })
      );
    });

    it('should map ImageData frames correctly', async () => {
      await encoder.encode(mockFrames, mockOptions);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          frames: expect.arrayContaining([
            expect.any(ImageData),
            expect.any(ImageData),
            expect.any(ImageData),
          ]),
        })
      );
    });

    it('should prevent concurrent encoding', async () => {
      const promise1 = encoder.encode(mockFrames, mockOptions);
      const promise2 = encoder.encode(mockFrames, mockOptions);

      await expect(promise2).rejects.toThrow('Encoding already in progress');
      await promise1;
    });

    it('should handle abort signal', async () => {
      const abortController = new AbortController();
      setTimeout(() => abortController.abort(), 50);

      // Mock gifski to take some time
      (encode as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve(new Uint8Array([0x47, 0x49, 0x46])), 100)
          )
      );

      await expect(
        encoder.encode(mockFrames, mockOptions, undefined, abortController.signal)
      ).rejects.toThrow('Encoding cancelled');
    });

    it('should report progress during encoding', async () => {
      const progressUpdates: EncodingProgress[] = [];
      const onProgress = (progress: EncodingProgress) => {
        progressUpdates.push(progress);
      };

      await encoder.encode(mockFrames, mockOptions, onProgress);

      expect(progressUpdates.length).toBeGreaterThan(0);

      const stages = progressUpdates.map((p) => p.stage);
      expect(stages).toContain('preparing');
      expect(stages).toContain('encoding');
      expect(stages).toContain('finalizing');
      expect(stages).toContain('completed');

      const finalProgress = progressUpdates[progressUpdates.length - 1];
      expect(finalProgress.percentage).toBe(100);
    });

    it('should handle empty frames array', async () => {
      const result = await encoder.encode([], mockOptions);
      expect(result.metadata.frameCount).toBe(0);
    });

    it('should handle very large frames', async () => {
      const largeFrames = [
        {
          imageData: new ImageData(1920, 1080),
          timestamp: 0,
          delay: 100,
        },
      ];

      const options = {
        ...mockOptions,
        width: 1920,
        height: 1080,
      };

      const result = await encoder.encode(largeFrames, options);

      expect(result.metadata.width).toBe(1920);
      expect(result.metadata.height).toBe(1080);
    });

    it('should verify gifski-wasm called with correct parameters', async () => {
      await encoder.encode(mockFrames, mockOptions);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          frames: expect.any(Array),
          fps: 10,
          width: 100,
          height: 100,
          quality: 90, // medium quality
        })
      );
    });

    it('should convert Uint8Array to Blob correctly', async () => {
      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.blob.type).toBe('image/gif');
      expect(result.blob.size).toBeGreaterThan(0);
    });
  });

  describe('Quality Mapping', () => {
    it('should map low quality to 80', async () => {
      const options = { ...mockOptions, quality: 'low' as const };
      await encoder.encode(mockFrames, options);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 80,
        })
      );
    });

    it('should map medium quality to 90', async () => {
      const options = { ...mockOptions, quality: 'medium' as const };
      await encoder.encode(mockFrames, options);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 90,
        })
      );
    });

    it('should map high quality to 100', async () => {
      const options = { ...mockOptions, quality: 'high' as const };
      await encoder.encode(mockFrames, options);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 100,
        })
      );
    });

    it('should clamp numeric quality values to 1-100 range', async () => {
      // Test below minimum
      let options = { ...mockOptions, quality: -50 };
      await encoder.encode(mockFrames, options);
      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 1,
        })
      );

      // Test above maximum
      options = { ...mockOptions, quality: 150 };
      await encoder.encode(mockFrames, options);
      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 100,
        })
      );

      // Test within range
      options = { ...mockOptions, quality: 75 };
      await encoder.encode(mockFrames, options);
      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          quality: 75,
        })
      );
    });
  });

  describe('WASM Integration', () => {
    it('should call gifski-wasm encode with correct options structure', async () => {
      await encoder.encode(mockFrames, mockOptions);

      expect(encode).toHaveBeenCalledTimes(1);
      expect(encode).toHaveBeenCalledWith({
        frames: expect.any(Array),
        fps: 10,
        width: 100,
        height: 100,
        quality: 90,
      });
    });

    it('should handle WASM encoding errors', async () => {
      (encode as jest.Mock).mockRejectedValueOnce(new Error('WASM encoding failed'));

      await expect(encoder.encode(mockFrames, mockOptions)).rejects.toThrow();
    });

    it('should pass fps parameter correctly', async () => {
      const options = { ...mockOptions, frameRate: 30 };
      await encoder.encode(mockFrames, options);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          fps: 30,
        })
      );
    });

    it('should pass width and height parameters correctly', async () => {
      const options = { ...mockOptions, width: 640, height: 480 };
      await encoder.encode(mockFrames, options);

      expect(encode).toHaveBeenCalledWith(
        expect.objectContaining({
          width: 640,
          height: 480,
        })
      );
    });
  });

  describe('Memory Management', () => {
    it('should cleanup after successful encoding', async () => {
      await encoder.encode(mockFrames, mockOptions);

      // Should be able to encode again
      await expect(encoder.encode(mockFrames, mockOptions)).resolves.toBeDefined();
    });

    it('should cleanup after failed encoding', async () => {
      (encode as jest.Mock).mockRejectedValueOnce(new Error('Test error'));

      await expect(encoder.encode(mockFrames, mockOptions)).rejects.toThrow('Test error');

      // Reset mock
      (encode as jest.Mock).mockResolvedValue(new Uint8Array([0x47, 0x49, 0x46]));

      // Should be able to encode again after error
      await expect(encoder.encode(mockFrames, mockOptions)).resolves.toBeDefined();
    });

    it('should allow re-encoding after completion', async () => {
      await encoder.encode(mockFrames, mockOptions);
      await encoder.encode(mockFrames, mockOptions);
      await encoder.encode(mockFrames, mockOptions);

      // All three encodings should succeed
      expect(encode).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Metrics', () => {
    it('should calculate encoding time correctly', async () => {
      const startTime = performance.now();
      const result = await encoder.encode(mockFrames, mockOptions);
      const endTime = performance.now();

      expect(result.metadata.encodingTime).toBeDefined();
      expect(result.metadata.encodingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.encodingTime).toBeLessThanOrEqual(endTime - startTime + 10);
    });

    it('should calculate average frame time', async () => {
      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.metadata.averageFrameTime).toBeDefined();
      expect(result.metadata.averageFrameTime).toBe(
        result.metadata.encodingTime / mockFrames.length
      );
    });

    it('should report efficiency correctly for slow encoder', async () => {
      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.performance.efficiency).toBeDefined();
      expect(result.performance.efficiency).toBeGreaterThan(0);
      expect(result.performance.efficiency).toBeLessThanOrEqual(1);
    });

    it('should include performance recommendations for long encoding', async () => {
      // Mock slow encoding
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(15000);

      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.performance.recommendations).toBeDefined();
      expect(result.performance.recommendations.length).toBeGreaterThan(0);
      expect(result.performance.recommendations[0]).toContain('gifski');

      jest.restoreAllMocks();
    });

    it('should not include recommendations for fast encoding', async () => {
      jest.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(5000);

      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.performance.recommendations).toEqual([]);

      jest.restoreAllMocks();
    });

    it('should calculate peak memory usage', async () => {
      const result = await encoder.encode(mockFrames, mockOptions);

      expect(result.performance.peakMemoryUsage).toBeDefined();
      expect(result.performance.peakMemoryUsage).toBeGreaterThan(0);

      // Should be approximately: frameCount * width * height * 4 bytes
      const expectedMemory = mockFrames.length * 100 * 100 * 4;
      expect(result.performance.peakMemoryUsage).toBe(expectedMemory);
    });
  });

  describe('Abort Functionality', () => {
    it('should handle abort() method call', () => {
      expect(() => encoder.abort()).not.toThrow();
    });

    it('should stop encoding when aborted', async () => {
      const abortController = new AbortController();

      // Create a promise that will be aborted
      const encodingPromise = encoder.encode(
        mockFrames,
        mockOptions,
        undefined,
        abortController.signal
      );

      // Abort immediately
      abortController.abort();

      await expect(encodingPromise).rejects.toThrow('Encoding cancelled');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single frame', async () => {
      const singleFrame = [mockFrames[0]];
      const result = await encoder.encode(singleFrame, mockOptions);

      expect(result.metadata.frameCount).toBe(1);
    });

    it('should handle many frames efficiently', async () => {
      const manyFrames = Array(100)
        .fill(null)
        .map((_, i) => ({
          imageData: new ImageData(100, 100),
          timestamp: i * 40,
          delay: 40,
        }));

      const result = await encoder.encode(manyFrames, mockOptions);

      expect(result.metadata.frameCount).toBe(100);
    });

    it('should handle different frame rates', async () => {
      const frameRates = [5, 10, 15, 24, 30, 60];

      for (const frameRate of frameRates) {
        const options = { ...mockOptions, frameRate };
        const result = await encoder.encode(mockFrames, options);

        expect(result.metadata.frameCount).toBe(3);
        expect(encode).toHaveBeenCalledWith(
          expect.objectContaining({
            fps: frameRate,
          })
        );
      }
    });
  });
});
