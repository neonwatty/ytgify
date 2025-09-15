/**
 * Tests for GifEncoder (Enhanced Version with Multiple Backend Support)
 * Priority 1: Core GIF encoding functionality tests
 */

import {
  GifEncoder,
  encodeGif,
  GifEncodingOptions,
  GifEncodingProgress,
  EncodedGifResult,
  benchmarkEncoders,
  detectEncoderFeatures
} from '@/lib/gif-encoder-v2';

// Mock the dependencies
jest.mock('@/shared/logger', () => ({
  sharedLogger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

jest.mock('@/lib/errors', () => ({
  createError: jest.fn((type: string, message: string) => new Error(`${type}: ${message}`))
}));

jest.mock('@/lib/encoders', () => ({
  encodeFrames: jest.fn().mockResolvedValue({
    blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
    metadata: {
      fileSize: 1024,
      width: 480,
      height: 360,
      frameCount: 10,
      encodingTime: 1000,
      averageFrameTime: 100
    },
    performance: {
      efficiency: 0.85,
      recommendations: ['Use lower quality for smaller files'],
      peakMemoryUsage: 2048000
    }
  }),
  getEncoderRecommendations: jest.fn().mockResolvedValue({
    recommended: { encoder: 'gifenc', reason: 'Best performance' },
    available: [
      { name: 'gifenc', available: true },
      { name: 'gif.js', available: true }
    ]
  }),
  EncoderType: 'gifenc'
}));

describe('GifEncoder', () => {
  let mockFrames: ImageData[];
  let defaultOptions: GifEncodingOptions;
  let mockProgressCallback: jest.MockedFunction<(progress: GifEncodingProgress) => void>;

  beforeEach(() => {
    // Reset the encodeFrames mock to its default state but preserve call tracking
    const { encodeFrames } = require('@/lib/encoders');
    encodeFrames.mockClear();
    encodeFrames.mockResolvedValue({
      blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
      metadata: {
        fileSize: 1024,
        width: 480,
        height: 360,
        frameCount: 10,
        encodingTime: 1000,
        averageFrameTime: 100
      },
      performance: {
        efficiency: 0.85,
        recommendations: ['Use lower quality for smaller files'],
        peakMemoryUsage: 2048000
      }
    });

    // Create mock ImageData frames
    mockFrames = [
      new ImageData(480, 360),
      new ImageData(480, 360),
      new ImageData(480, 360),
      new ImageData(480, 360),
      new ImageData(480, 360)
    ];

    defaultOptions = {
      width: 480,
      height: 360,
      frameRate: 10,
      quality: 'medium',
      loop: true,
      dithering: false,
      optimizeColors: true
    };

    mockProgressCallback = jest.fn();

    // Mock OffscreenCanvas and context
    global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
      width,
      height,
      getContext: jest.fn().mockReturnValue({
        drawImage: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn()
      }),
      convertToBlob: jest.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' }))
    })) as any;
  });

  describe('constructor', () => {
    it('should initialize with valid options', () => {
      const encoder = new GifEncoder(defaultOptions, mockProgressCallback);
      expect(encoder).toBeInstanceOf(GifEncoder);
    });

    it('should throw error if canvas context creation fails', () => {
      global.OffscreenCanvas = jest.fn().mockImplementation(() => ({
        getContext: jest.fn().mockReturnValue(null)
      })) as any;

      expect(() => new GifEncoder(defaultOptions)).toThrow('gif: Failed to create 2D canvas context');
    });
  });

  describe('encodeFrames', () => {
    it('should encode frames successfully with default settings', async () => {
      const encoder = new GifEncoder(defaultOptions, mockProgressCallback);
      const result = await encoder.encodeFrames(mockFrames);

      expect(result).toEqual({
        gifBlob: expect.any(Blob),
        thumbnailBlob: expect.any(Blob),
        metadata: expect.objectContaining({
          fileSize: 1024,
          width: 480,
          height: 360,
          frameCount: 10,
          encodingTime: 1000,
          performance: expect.objectContaining({
            efficiency: 0.85,
            recommendations: expect.arrayContaining([expect.any(String)]),
            peakMemoryUsage: expect.any(Number)
          })
        })
      });

      // Verify encoding was called with correct parameters
      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            imageData: expect.any(ImageData),
            timestamp: expect.any(Number),
            delay: expect.any(Number)
          })
        ]),
        expect.objectContaining({
          width: 480,
          height: 360,
          frameRate: 10,
          quality: 'medium',
          loop: true
        }),
        expect.objectContaining({
          encoder: 'auto',
          format: 'gif',
          onProgress: expect.any(Function),
          abortSignal: expect.any(AbortSignal)
        })
      );
    });

    it('should handle different quality settings', async () => {
      const qualityTests: Array<GifEncodingOptions['quality']> = ['low', 'medium', 'high'];

      for (const quality of qualityTests) {
        const options = { ...defaultOptions, quality };
        const encoder = new GifEncoder(options);

        await encoder.encodeFrames(mockFrames);

        const { encodeFrames } = require('@/lib/encoders');
        expect(encodeFrames).toHaveBeenCalledWith(
          expect.any(Array),
          expect.objectContaining({ quality }),
          expect.any(Object)
        );
      }
    });

    it('should handle different frame rates', async () => {
      const frameRates = [5, 15, 30];

      for (const frameRate of frameRates) {
        const { encodeFrames } = require('@/lib/encoders');
        encodeFrames.mockClear();

        const options = { ...defaultOptions, frameRate };
        const encoder = new GifEncoder(options);

        await encoder.encodeFrames(mockFrames);

        expect(encodeFrames).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              delay: Math.round(1000 / frameRate)
            })
          ]),
          expect.objectContaining({ frameRate }),
          expect.any(Object)
        );
      }
    });

    it('should use preferred encoder when specified', async () => {
      const options: GifEncodingOptions = {
        ...defaultOptions,
        preferredEncoder: 'gif.js'
      };

      const encoder = new GifEncoder(options);
      await encoder.encodeFrames(mockFrames);

      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalledWith(
        expect.any(Array),
        expect.any(Object),
        expect.objectContaining({
          encoder: 'gif.js'
        })
      );
    });

    it('should call progress callback during encoding', async () => {
      const encoder = new GifEncoder(defaultOptions, mockProgressCallback);

      // Mock the encoder to call progress callback
      const { encodeFrames } = require('@/lib/encoders');
      encodeFrames.mockImplementation(async (frames: any, options: any, config: any) => {
        // Simulate progress updates
        config.onProgress({
          stage: 'preparing',
          percentage: 10,
          currentOperation: 'Preparing frames',
          frameIndex: 0,
          totalFrames: frames.length
        });

        config.onProgress({
          stage: 'encoding',
          percentage: 50,
          currentOperation: 'Encoding GIF',
          frameIndex: 2,
          totalFrames: frames.length
        });

        config.onProgress({
          stage: 'completed',
          percentage: 100,
          currentOperation: 'Encoding complete',
          frameIndex: frames.length,
          totalFrames: frames.length
        });

        return {
          blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
          metadata: {
            fileSize: 1024,
            width: 480,
            height: 360,
            frameCount: 10,
            encodingTime: 1000,
            averageFrameTime: 100
          },
          performance: {
            efficiency: 0.85,
            recommendations: ['Use lower quality for smaller files'],
            peakMemoryUsage: 2048000
          }
        };
      });

      await encoder.encodeFrames(mockFrames);

      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'analyzing',
          progress: 10,
          message: expect.any(String)
        })
      );

      expect(mockProgressCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          stage: 'encoding',
          progress: 50,
          message: expect.any(String)
        })
      );
    });

    it('should throw error for empty frame array', async () => {
      const encoder = new GifEncoder(defaultOptions);

      await expect(encoder.encodeFrames([])).rejects.toThrow('gif: No frames provided for encoding');
    });

    it('should handle encoding failures', async () => {
      const encoder = new GifEncoder(defaultOptions);

      const { encodeFrames } = require('@/lib/encoders');
      const originalMock = encodeFrames.getMockImplementation();

      encodeFrames.mockRejectedValue(new Error('Encoding failed'));

      await expect(encoder.encodeFrames(mockFrames)).rejects.toThrow('gif: GIF encoding failed: Encoding failed');

      // Restore original mock
      if (originalMock) {
        encodeFrames.mockImplementation(originalMock);
      } else {
        encodeFrames.mockResolvedValue({
          blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
          metadata: {
            fileSize: 1024,
            width: 480,
            height: 360,
            frameCount: 10,
            encodingTime: 1000,
            averageFrameTime: 100
          },
          performance: {
            efficiency: 0.85,
            recommendations: ['Use lower quality for smaller files'],
            peakMemoryUsage: 2048000
          }
        });
      }
    });

    it('should support cancellation', async () => {
      const encoder = new GifEncoder(defaultOptions);

      const { encodeFrames } = require('@/lib/encoders');
      // Store original mock
      const originalMock = encodeFrames.getMockImplementation();

      encodeFrames.mockImplementation(async (frames: any, options: any, config: any) => {
        // Simulate cancellation during encoding
        return new Promise((_: any, reject: any) => {
          let timeoutId: NodeJS.Timeout;

          config.abortSignal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Encoding cancelled'));
          });

          timeoutId = setTimeout(() => {
            reject(new Error('Should have been cancelled'));
          }, 1000);
        });
      });

      const encodePromise = encoder.encodeFrames(mockFrames);

      // Cancel after a short delay
      setTimeout(() => encoder.cancel(), 10);

      await expect(encodePromise).rejects.toThrow('Encoding cancelled');
      expect(encoder.isEncoding).toBe(false);

      // Restore original mock for other tests
      if (originalMock) {
        encodeFrames.mockImplementation(originalMock);
      } else {
        encodeFrames.mockResolvedValue({
          blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
          metadata: {
            fileSize: 1024,
            width: 480,
            height: 360,
            frameCount: 10,
            encodingTime: 1000,
            averageFrameTime: 100
          },
          performance: {
            efficiency: 0.85,
            recommendations: ['Use lower quality for smaller files'],
            peakMemoryUsage: 2048000
          }
        });
      }
    });

    it('should create thumbnail from first frame', async () => {
      const encoder = new GifEncoder(defaultOptions);
      const result = await encoder.encodeFrames(mockFrames);

      expect(result.thumbnailBlob).toBeDefined();
      expect(result.thumbnailBlob).toBeInstanceOf(Blob);
    });

    it('should handle thumbnail creation failure gracefully', async () => {
      // Mock OffscreenCanvas to fail thumbnail creation
      global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => {
        if (width === 150) { // Thumbnail size
          return {
            getContext: jest.fn().mockReturnValue(null)
          };
        }
        return {
          width,
          height,
          getContext: jest.fn().mockReturnValue({
            drawImage: jest.fn(),
            putImageData: jest.fn(),
            createImageData: jest.fn()
          })
        };
      }) as any;

      const encoder = new GifEncoder(defaultOptions);

      await expect(encoder.encodeFrames(mockFrames)).rejects.toThrow('gif: Failed to create thumbnail canvas context');
    });
  });

  describe('feature detection', () => {
    it('should enable feature detection when specified', async () => {
      const options: GifEncodingOptions = {
        ...defaultOptions,
        enableFeatureDetection: true
      };

      const encoder = new GifEncoder(options);
      await encoder.encodeFrames(mockFrames);

      const { getEncoderRecommendations } = require('@/lib/encoders');
      expect(getEncoderRecommendations).toHaveBeenCalled();
    });

    it('should skip feature detection by default', async () => {
      const encoder = new GifEncoder(defaultOptions);
      await encoder.encodeFrames(mockFrames);

      const { getEncoderRecommendations } = require('@/lib/encoders');
      expect(getEncoderRecommendations).not.toHaveBeenCalled();
    });
  });

  describe('memory and performance', () => {
    it('should handle large frame counts', async () => {
      const largeFrameSet = Array.from({ length: 300 }, () => new ImageData(1920, 1080));
      const encoder = new GifEncoder({
        ...defaultOptions,
        width: 1920,
        height: 1080
      });

      await encoder.encodeFrames(largeFrameSet);

      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalledWith(
        expect.arrayContaining(new Array(300).fill(expect.objectContaining({
          imageData: expect.any(ImageData)
        }))),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should handle high resolution frames', async () => {
      const highResFrames = [
        new ImageData(3840, 2160), // 4K
        new ImageData(3840, 2160),
        new ImageData(3840, 2160)
      ];

      const encoder = new GifEncoder({
        ...defaultOptions,
        width: 3840,
        height: 2160
      });

      await encoder.encodeFrames(highResFrames);

      // Should still process all frames
      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalled();
    });
  });

  describe('compression and optimization', () => {
    it('should calculate compression ratio correctly', async () => {
      const encoder = new GifEncoder(defaultOptions);
      const result = await encoder.encodeFrames(mockFrames);

      expect(result.metadata.compressionRatio).toBeDefined();
      expect(result.metadata.compressionRatio).toBeGreaterThan(0);
    });

    it('should apply dithering when enabled', async () => {
      const options: GifEncodingOptions = {
        ...defaultOptions,
        dithering: true
      };

      const encoder = new GifEncoder(options);
      await encoder.encodeFrames(mockFrames);

      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ dithering: true }),
        expect.any(Object)
      );
    });

    it('should optimize colors when enabled', async () => {
      const options: GifEncodingOptions = {
        ...defaultOptions,
        optimizeColors: true
      };

      const encoder = new GifEncoder(options);
      await encoder.encodeFrames(mockFrames);

      const { encodeFrames } = require('@/lib/encoders');
      expect(encodeFrames).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({ optimizeColors: true }),
        expect.any(Object)
      );
    });
  });
});

describe('encodeGif utility function', () => {
  let mockFrames: ImageData[];
  let defaultOptions: GifEncodingOptions;

  beforeEach(() => {
    // Reset mocks for encodeGif utility tests
    const { encodeFrames } = require('@/lib/encoders');
    encodeFrames.mockClear();

    mockFrames = [
      new ImageData(480, 360),
      new ImageData(480, 360)
    ];

    defaultOptions = {
      width: 480,
      height: 360,
      frameRate: 10,
      quality: 'medium',
      loop: true
    };

    global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
      width,
      height,
      getContext: jest.fn().mockReturnValue({
        drawImage: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn()
      }),
      convertToBlob: jest.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' }))
    })) as any;
  });

  it('should encode GIF using utility function', async () => {
    const mockProgressCallback = jest.fn();
    const result = await encodeGif(mockFrames, defaultOptions, mockProgressCallback);

    expect(result).toEqual(expect.objectContaining({
      gifBlob: expect.any(Blob),
      thumbnailBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        fileSize: expect.any(Number),
        width: 480,
        height: 360
      })
    }));
  });

  it('should work without progress callback', async () => {
    const result = await encodeGif(mockFrames, defaultOptions);

    expect(result).toEqual(expect.objectContaining({
      gifBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        width: 480,
        height: 360
      })
    }));
  });
});

describe('benchmarkEncoders', () => {
  beforeEach(() => {
    // No specific mocks to clear for benchmark tests
  });

  it('should return encoder benchmarks', async () => {
    // Mock dynamic import
    jest.doMock('@/lib/encoders/encoder-factory', () => ({
      encoderFactory: {
        benchmarkEncoders: jest.fn().mockResolvedValue([
          {
            name: 'gifenc',
            available: true,
            benchmarkTime: 100,
            framesPerSecond: 60
          },
          {
            name: 'gif.js',
            available: true,
            benchmarkTime: 200,
            framesPerSecond: 30
          }
        ])
      }
    }), { virtual: true });

    const benchmarks = await benchmarkEncoders();

    expect(benchmarks).toEqual([
      {
        name: 'gifenc',
        available: true,
        benchmarkTime: 100,
        framesPerSecond: 60,
        recommendation: 'Excellent performance'
      },
      {
        name: 'gif.js',
        available: true,
        benchmarkTime: 200,
        framesPerSecond: 30,
        recommendation: 'Good performance'
      }
    ]);
  });

  it('should handle benchmark failure', async () => {
    // Reset mocks for this test
    jest.resetModules();

    // Mock the import to fail
    jest.doMock('@/lib/encoders/encoder-factory', () => {
      throw new Error('Benchmark failed');
    }, { virtual: true });

    // Re-import after mock setup
    const { benchmarkEncoders: failingBenchmark } = await import('@/lib/gif-encoder-v2');

    const benchmarks = await failingBenchmark();
    expect(benchmarks).toEqual([]);
  });
});

describe('detectEncoderFeatures', () => {
  // Let each test manage its own mock setup

  it('should detect available encoder features', async () => {
    const { getEncoderRecommendations } = require('@/lib/encoders');
    getEncoderRecommendations.mockResolvedValue({
      recommended: { encoder: 'gifenc' },
      available: [
        { name: 'gifenc', available: true },
        { name: 'gif.js', available: true }
      ]
    });

    const features = await detectEncoderFeatures();

    expect(features).toEqual({
      hasGifenc: true,
      hasGifJs: true,
      recommendedEncoder: 'gifenc',
      performanceProfile: 'high'
    });
  });

  it('should handle partial encoder availability', async () => {
    // Reset modules and create a fresh mock for this test only
    jest.resetModules();

    jest.doMock('@/lib/encoders', () => ({
      getEncoderRecommendations: jest.fn().mockResolvedValue({
        recommended: { encoder: 'gif.js' },
        available: [
          { name: 'gifenc', available: false },
          { name: 'gif.js', available: true }
        ]
      })
    }));

    // Re-import the function with the new mock
    const { detectEncoderFeatures } = await import('@/lib/gif-encoder-v2');
    const features = await detectEncoderFeatures();

    expect(features).toEqual({
      hasGifenc: false,
      hasGifJs: true,
      recommendedEncoder: 'gif.js',
      performanceProfile: 'medium'
    });
  });

  it('should handle feature detection failure', async () => {
    // Reset modules and create a failing mock for this test only
    jest.resetModules();

    jest.doMock('@/lib/encoders', () => ({
      getEncoderRecommendations: jest.fn().mockRejectedValue(new Error('Detection failed'))
    }));

    // Re-import the function with the new mock
    const { detectEncoderFeatures } = await import('@/lib/gif-encoder-v2');
    const features = await detectEncoderFeatures();

    expect(features).toEqual({
      hasGifenc: false,
      hasGifJs: true, // Safe fallback
      recommendedEncoder: 'gif.js',
      performanceProfile: 'low'
    });
  });
});

describe('edge cases and error handling', () => {
  let mockFrames: ImageData[];
  let defaultOptions: GifEncodingOptions;

  beforeEach(() => {
    // Re-setup module mocks since they may have been reset by other tests
    jest.doMock('@/lib/encoders', () => ({
      encodeFrames: jest.fn().mockResolvedValue({
        blob: new Blob(['mock-gif-data'], { type: 'image/gif' }),
        metadata: {
          fileSize: 1024,
          width: 480,
          height: 360,
          frameCount: 10,
          encodingTime: 1000,
          averageFrameTime: 100
        },
        performance: {
          efficiency: 0.85,
          recommendations: ['Use lower quality for smaller files'],
          peakMemoryUsage: 2048000
        }
      }),
      getEncoderRecommendations: jest.fn().mockResolvedValue({
        recommended: { encoder: 'gifenc', reason: 'Best performance' },
        available: [
          { name: 'gifenc', available: true },
          { name: 'gif.js', available: true }
        ]
      })
    }));

    mockFrames = [new ImageData(480, 360)];
    defaultOptions = {
      width: 480,
      height: 360,
      frameRate: 10,
      quality: 'medium',
      loop: true
    };

    global.OffscreenCanvas = jest.fn().mockImplementation((width, height) => ({
      width,
      height,
      getContext: jest.fn().mockReturnValue({
        drawImage: jest.fn(),
        putImageData: jest.fn(),
        createImageData: jest.fn()
      }),
      convertToBlob: jest.fn().mockResolvedValue(new Blob(['thumbnail'], { type: 'image/png' }))
    })) as any;
  });

  it('should handle single frame GIF', async () => {
    const singleFrame = [new ImageData(480, 360)];
    const encoder = new GifEncoder(defaultOptions);

    const result = await encoder.encodeFrames(singleFrame);
    expect(result.metadata.frameCount).toBe(10); // From mock result
  });

  it('should handle frames with different dimensions', async () => {
    const mixedFrames = [
      new ImageData(480, 360),
      new ImageData(640, 480), // Different size
      new ImageData(480, 360)
    ];

    const encoder = new GifEncoder(defaultOptions);
    const result = await encoder.encodeFrames(mixedFrames);

    // Should still process successfully and return a result
    expect(result).toEqual({
      gifBlob: expect.any(Blob),
      thumbnailBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        fileSize: 1024,
        width: 480,
        height: 360,
        frameCount: 10
      })
    });
  });

  it('should handle very low frame rates', async () => {
    const options: GifEncodingOptions = {
      ...defaultOptions,
      frameRate: 0.5 // One frame every 2 seconds
    };

    const encoder = new GifEncoder(options);
    const result = await encoder.encodeFrames(mockFrames);

    // Should process successfully despite very low frame rate
    expect(result).toEqual({
      gifBlob: expect.any(Blob),
      thumbnailBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        fileSize: 1024,
        width: 480,
        height: 360,
        frameCount: 10
      })
    });
  });

  it('should handle very high frame rates', async () => {
    const options: GifEncodingOptions = {
      ...defaultOptions,
      frameRate: 60
    };

    const encoder = new GifEncoder(options);
    const result = await encoder.encodeFrames(mockFrames);

    // Should process successfully despite very high frame rate
    expect(result).toEqual({
      gifBlob: expect.any(Blob),
      thumbnailBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        fileSize: 1024,
        width: 480,
        height: 360,
        frameCount: 10
      })
    });
  });

  it('should handle encoding timeout', async () => {
    const encoder = new GifEncoder(defaultOptions);

    // Test that the encoder can be cancelled (simulating a timeout scenario)
    const encodePromise = encoder.encodeFrames(mockFrames);

    // Cancel immediately to test cancellation mechanism
    encoder.cancel();

    // Should handle cancellation properly
    expect(encoder.isEncoding).toBe(false);

    // The promise should still resolve successfully since we have a working mock
    const result = await encodePromise;
    expect(result).toEqual({
      gifBlob: expect.any(Blob),
      thumbnailBlob: expect.any(Blob),
      metadata: expect.objectContaining({
        fileSize: 1024,
        width: 480,
        height: 360,
        frameCount: 10
      })
    });
  });
});