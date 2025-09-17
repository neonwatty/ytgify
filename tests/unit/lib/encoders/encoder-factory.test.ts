/**
 * Tests for EncoderFactory
 * Priority 1: Core encoder selection and management functionality
 */

import { EncoderFactory, encoderFactory, selectEncoder, getPerformanceRecommendations } from '@/lib/encoders/encoder-factory';
import { GifencEncoder } from '@/lib/encoders/gifenc-encoder';
import { GifJsEncoder } from '@/lib/encoders/gifjs-encoder';
import { AbstractEncoder } from '@/lib/encoders/abstract-encoder';

// Mock the encoder modules
jest.mock('@/lib/encoders/gifenc-encoder');
jest.mock('@/lib/encoders/gifjs-encoder');

describe('EncoderFactory', () => {
  let factory: EncoderFactory;
  let mockGifencEncoder: jest.Mocked<GifencEncoder>;
  let mockGifJsEncoder: jest.Mocked<GifJsEncoder>;

  beforeEach(() => {
    jest.clearAllMocks();
    factory = EncoderFactory.getInstance();
    factory.clearCache();

    // Setup mock encoders
    mockGifencEncoder = {
      name: 'gifenc',
      supportedFormats: ['gif'],
      characteristics: {
        speed: 'fast',
        quality: 'high',
        memoryUsage: 'medium',
        browserSupport: 'excellent'
      },
      isAvailable: jest.fn().mockReturnValue(true),
      initialize: jest.fn().mockResolvedValue(undefined),
      encode: jest.fn().mockResolvedValue(new Blob(['gifenc-data'], { type: 'image/gif' }))
    } as any;

    mockGifJsEncoder = {
      name: 'gif.js',
      supportedFormats: ['gif'],
      characteristics: {
        speed: 'medium',
        quality: 'medium',
        memoryUsage: 'high',
        browserSupport: 'good'
      },
      isAvailable: jest.fn().mockReturnValue(true),
      initialize: jest.fn().mockResolvedValue(undefined),
      encode: jest.fn().mockResolvedValue(new Blob(['gifjs-data'], { type: 'image/gif' }))
    } as any;

    (GifencEncoder as jest.MockedClass<typeof GifencEncoder>).mockImplementation(() => mockGifencEncoder);
    (GifJsEncoder as jest.MockedClass<typeof GifJsEncoder>).mockImplementation(() => mockGifJsEncoder);
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = EncoderFactory.getInstance();
      const instance2 = EncoderFactory.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getEncoder', () => {
    it('should return primary encoder when available', async () => {
      const result = await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      expect(result.encoder).toBe(mockGifencEncoder);
      expect(result.reason).toBe('User preference: gifenc');
      expect(result.characteristics).toEqual(mockGifencEncoder.characteristics);
    });

    it('should fallback to secondary encoder when primary unavailable', async () => {
      mockGifencEncoder.isAvailable.mockReturnValue(false);

      const result = await factory.getEncoder({
        primary: 'gifenc',
        fallback: 'gif.js',
        format: 'gif'
      });

      expect(result.encoder).toBe(mockGifJsEncoder);
      expect(result.reason).toBe('Fallback to gif.js (primary unavailable)');
    });

    it('should auto-select best encoder when primary is auto', async () => {
      const result = await factory.getEncoder({
        primary: 'auto',
        format: 'gif'
      });

      expect(result.encoder).toBe(mockGifencEncoder);
      expect(result.reason).toBe('Auto-selected based on performance characteristics');
    });

    it('should use emergency fallback when no preferred encoders available', async () => {
      mockGifencEncoder.isAvailable.mockReturnValue(false);

      const result = await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      expect(result.encoder).toBe(mockGifJsEncoder);
      expect(result.reason).toBe('Emergency fallback to any available encoder');
    });

    it('should throw error when no encoders available', async () => {
      mockGifencEncoder.isAvailable.mockReturnValue(false);
      mockGifJsEncoder.isAvailable.mockReturnValue(false);

      await expect(factory.getEncoder({
        primary: 'auto',
        format: 'gif'
      })).rejects.toThrow('No GIF encoder available in this environment');
    });

    it('should throw error for unsupported format', async () => {
      await expect(factory.getEncoder({
        primary: 'auto',
        format: 'mp4'
      })).rejects.toThrow('Format mp4 not yet supported');
    });

    it('should cache encoder instances', async () => {
      await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      // Should only create one instance
      expect(GifencEncoder).toHaveBeenCalledTimes(1);
    });

    it('should handle encoder initialization failure', async () => {
      mockGifencEncoder.initialize.mockRejectedValue(new Error('Init failed'));

      const result = await factory.getEncoder({
        primary: 'gifenc',
        fallback: 'gif.js',
        format: 'gif'
      });

      expect(result.encoder).toBe(mockGifJsEncoder);
      expect(result.reason).toBe('Fallback to gif.js (primary unavailable)');
    });
  });

  describe('getSpecificEncoder', () => {
    it('should return gifenc encoder when requested', async () => {
      const encoder = await factory.getSpecificEncoder('gifenc');
      expect(encoder).toBe(mockGifencEncoder);
    });

    it('should return gif.js encoder when requested', async () => {
      const encoder = await factory.getSpecificEncoder('gif.js');
      expect(encoder).toBe(mockGifJsEncoder);
    });

    it('should return null when encoder is unavailable', async () => {
      mockGifencEncoder.isAvailable.mockReturnValue(false);
      const encoder = await factory.getSpecificEncoder('gifenc');
      expect(encoder).toBeNull();
    });

    it('should auto-select when type is auto', async () => {
      const encoder = await factory.getSpecificEncoder('auto');
      expect(encoder).toBe(mockGifencEncoder);
    });

    it('should throw error for unknown encoder type', async () => {
      await expect(factory.getSpecificEncoder('unknown' as any))
        .rejects.toThrow('Unknown encoder type: unknown');
    });
  });

  describe('getAvailableEncoders', () => {
    it('should return information about all encoders', async () => {
      const encoders = await factory.getAvailableEncoders();

      expect(encoders).toHaveLength(2);
      expect(encoders[0]).toEqual({
        name: 'gifenc',
        type: 'gifenc',
        available: true,
        characteristics: mockGifencEncoder.characteristics,
        supportedFormats: ['gif']
      });
      expect(encoders[1]).toEqual({
        name: 'gif.js',
        type: 'gif.js',
        available: true,
        characteristics: mockGifJsEncoder.characteristics,
        supportedFormats: ['gif']
      });
    });

    it('should handle encoder availability check errors', async () => {
      mockGifencEncoder.isAvailable.mockImplementation(() => {
        throw new Error('Availability check failed');
      });

      const encoders = await factory.getAvailableEncoders();

      expect(encoders[0].available).toBe(false);
      expect(encoders[1].available).toBe(true);
    });
  });

  describe('benchmarkEncoders', () => {
    beforeEach(() => {
      // Mock performance.now()
      let time = 0;
      jest.spyOn(performance, 'now').mockImplementation(() => {
        time += 100;
        return time;
      });
    });

    it('should benchmark available encoders', async () => {
      const results = await factory.benchmarkEncoders(10);

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        name: 'gifenc',
        type: 'gifenc',
        available: true,
        benchmarkTime: expect.any(Number),
        framesPerSecond: expect.any(Number)
      });
      expect(results[1]).toMatchObject({
        name: 'gif.js',
        type: 'gif.js',
        available: true,
        benchmarkTime: expect.any(Number),
        framesPerSecond: expect.any(Number)
      });

      expect(mockGifencEncoder.encode).toHaveBeenCalled();
      expect(mockGifJsEncoder.encode).toHaveBeenCalled();
    });

    it('should skip unavailable encoders', async () => {
      mockGifencEncoder.isAvailable.mockReturnValue(false);

      const results = await factory.benchmarkEncoders(10);

      expect(results[0]).toMatchObject({
        name: 'gifenc',
        type: 'gifenc',
        available: false
      });
      expect(results[0].benchmarkTime).toBeUndefined();
    });

    it('should handle encoding errors during benchmark', async () => {
      mockGifencEncoder.encode.mockRejectedValue(new Error('Encode failed'));

      const results = await factory.benchmarkEncoders(10);

      expect(results[0]).toMatchObject({
        name: 'gifenc',
        type: 'gifenc',
        available: false
      });
    });

    it('should calculate memory usage when available', async () => {
      // Mock performance.memory
      const originalMemory = (performance as any).memory;
      (performance as any).memory = {
        usedJSHeapSize: 1000000
      };

      const results = await factory.benchmarkEncoders(10);

      expect(results[0].memoryUsage).toBeDefined();

      // Restore
      if (originalMemory) {
        (performance as any).memory = originalMemory;
      } else {
        delete (performance as any).memory;
      }
    });
  });

  describe('clearCache', () => {
    it('should clear availability and instance caches', async () => {
      // Populate caches
      await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      factory.clearCache();

      // Should create new instance after cache clear
      await factory.getEncoder({
        primary: 'gifenc',
        format: 'gif'
      });

      expect(GifencEncoder).toHaveBeenCalledTimes(2);
    });
  });
});

describe('Convenience functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('selectEncoder', () => {
    it('should select encoder with default parameters', async () => {
      const result = await selectEncoder();

      expect(result.encoder).toBeDefined();
      expect(result.reason).toBeDefined();
      expect(result.characteristics).toBeDefined();
    });

    it('should select encoder with specific preferences', async () => {
      const result = await selectEncoder('gif', 'gifenc');

      expect(result.encoder).toBeDefined();
      expect(result.reason).toContain('gifenc');
      expect(result.characteristics).toBeDefined();
    });
  });

  describe('getPerformanceRecommendations', () => {
    it('should recommend fastest available encoder', async () => {
      const recommendations = await getPerformanceRecommendations();

      expect(recommendations.recommended).toBeDefined();
      expect(recommendations.reason).toBeDefined();
      expect(recommendations.alternatives).toBeDefined();

      // Should recommend gifenc as it's the fastest when available
      if (recommendations.recommended === 'gifenc') {
        expect(recommendations.reason).toContain('performance');
      }
    });

    it('should handle when only some encoders are available', async () => {
      // Mock gifenc as unavailable
      const mockGifencEncoder = (GifencEncoder as jest.MockedClass<typeof GifencEncoder>).mock.instances[0];
      if (mockGifencEncoder) {
        mockGifencEncoder.isAvailable = jest.fn().mockReturnValue(false);
      }

      const recommendations = await getPerformanceRecommendations();

      expect(recommendations.recommended).toBeDefined();
      expect(recommendations.alternatives).toBeDefined();
    });
  });
});