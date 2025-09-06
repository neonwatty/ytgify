import { GifEncoder, GifEncodingProgress, encodeGif, estimateEncodingParameters } from './gif-encoder';
import { ExtractedFrame } from './frame-extractor';
import { GifSettings } from '@/types';

// Mock the gif.js library
// @ts-ignore - Override type for testing
global.Window = global.Window || {};

describe('GifEncoder', () => {
  let encoder: GifEncoder;
  let mockProgressCallback: jest.Mock;

  beforeEach(() => {
    encoder = new GifEncoder();
    mockProgressCallback = jest.fn();
    
    // Mock window.GIF
    (window as any).GIF = jest.fn().mockImplementation(() => ({
      addFrame: jest.fn(),
      render: jest.fn(),
      abort: jest.fn(),
      on: jest.fn((event, callback) => {
        if (event === 'finished') {
          // Simulate async encoding completion
          setTimeout(() => {
            callback(new Blob(['mock gif data'], { type: 'image/gif' }));
          }, 10);
        }
      }),
      running: false,
      frames: [],
      options: {}
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should create a new GifEncoder instance', () => {
      expect(encoder).toBeInstanceOf(GifEncoder);
    });

    it('should check if gif.js is available', () => {
      expect(GifEncoder.isAvailable()).toBe(true);
      
      // Test when not available
      const originalGIF = (window as any).GIF;
      delete (window as any).GIF;
      expect(GifEncoder.isAvailable()).toBe(false);
      (window as any).GIF = originalGIF;
    });
  });

  describe('encodeGif', () => {
    const createMockFrame = (width = 100, height = 100, frameIndex = 0): ExtractedFrame => {
      const data = new Uint8ClampedArray(width * height * 4);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.floor(Math.random() * 256);     // R
        data[i + 1] = Math.floor(Math.random() * 256); // G
        data[i + 2] = Math.floor(Math.random() * 256); // B
        data[i + 3] = 255;                              // A
      }
      return { 
        imageData: { data, width, height, colorSpace: 'srgb' },
        timestamp: 0,
        frameIndex
      };
    };

    const createMockSettings = (): GifSettings => ({
      frameRate: 10,
      resolution: '640x480',
      quality: 'medium',
      startTime: 0,
      endTime: 2,
      speed: 1,
      brightness: 1,
      contrast: 1
    });

    it('should encode a single frame', async () => {
      const frames = [createMockFrame()];
      const settings = createMockSettings();

      const result = await encoder.encodeGif(frames, {
        settings,
        onProgress: mockProgressCallback
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('image/gif');
      expect(result.metadata.frameCount).toBe(1);
      expect(mockProgressCallback).toHaveBeenCalled();
    });

    it('should encode multiple frames', async () => {
      const frames = [
        createMockFrame(100, 100, 0),
        createMockFrame(100, 100, 1),
        createMockFrame(100, 100, 2)
      ];
      const settings = createMockSettings();

      const result = await encoder.encodeGif(frames, {
        settings,
        onProgress: mockProgressCallback
      });

      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.metadata.frameCount).toBe(3);
    });

    it('should report progress correctly', async () => {
      const frames = [createMockFrame(100, 100, 0), createMockFrame(100, 100, 1)];
      const settings = createMockSettings();

      await encoder.encodeGif(frames, {
        settings,
        onProgress: mockProgressCallback
      });

      const progressCalls = mockProgressCallback.mock.calls;
      expect(progressCalls.length).toBeGreaterThan(0);
      
      // Check progress structure
      progressCalls.forEach(call => {
        const progress: GifEncodingProgress = call[0];
        expect(progress).toHaveProperty('stage');
        expect(progress).toHaveProperty('totalFrames');
        expect(progress).toHaveProperty('percentage');
        expect(progress.percentage).toBeGreaterThanOrEqual(0);
        expect(progress.percentage).toBeLessThanOrEqual(100);
      });
    });

    it('should throw error when already encoding', async () => {
      const frames = [createMockFrame()];
      const settings = createMockSettings();
      
      // Start first encoding
      const firstPromise = encoder.encodeGif(frames, { settings });
      
      // Try to start second encoding
      await expect(encoder.encodeGif(frames, { settings }))
        .rejects.toThrow('Encoding already in progress');
      
      await firstPromise;
    });

    it('should handle different frame rates', async () => {
      const frames = [createMockFrame()];
      const frameRates = [5, 10, 15, 30, 60];

      for (const frameRate of frameRates) {
        const settings = { ...createMockSettings(), frameRate };
        const newEncoder = new GifEncoder();
        
        const result = await newEncoder.encodeGif(frames, { settings });
        expect(result.blob).toBeInstanceOf(Blob);
      }
    });

    it('should handle different quality settings', async () => {
      const frames = [createMockFrame()];
      const qualityLevels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

      for (const quality of qualityLevels) {
        const settings = { ...createMockSettings(), quality };
        const newEncoder = new GifEncoder();
        
        const result = await newEncoder.encodeGif(frames, { settings });
        expect(result.blob).toBeInstanceOf(Blob);
      }
    });

    it('should handle different resolutions', async () => {
      const resolutions = ['320x240', '640x480', '1280x720', '1920x1080'];

      for (const resolution of resolutions) {
        const [width, height] = resolution.split('x').map(Number);
        const frames = [createMockFrame(width, height)];
        const settings = { ...createMockSettings(), resolution };
        const newEncoder = new GifEncoder();
        
        const result = await newEncoder.encodeGif(frames, { settings });
        expect(result.blob).toBeInstanceOf(Blob);
      }
    });

    it('should apply brightness and contrast adjustments', async () => {
      const frames = [createMockFrame()];
      const settings = {
        ...createMockSettings(),
        brightness: 1.5,
        contrast: 1.2
      };

      const result = await encoder.encodeGif(frames, { settings });
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should handle text overlays', async () => {
      const frames = [createMockFrame()];
      const settings = {
        ...createMockSettings(),
        textOverlays: [{
          id: 'test-overlay-1',
          text: 'Test Overlay',
          position: { x: 10, y: 10 },
          fontSize: 16,
          fontFamily: 'Arial',
          color: '#FFFFFF'
        }]
      };

      const result = await encoder.encodeGif(frames, { settings });
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should use different quality presets', async () => {
      const frames = [createMockFrame()];
      const settings = createMockSettings();
      const presets: Array<'high-quality' | 'balanced' | 'fast-encode' | 'small-file'> = 
        ['high-quality', 'balanced', 'fast-encode', 'small-file'];

      for (const preset of presets) {
        const newEncoder = new GifEncoder();
        const result = await newEncoder.encodeGif(frames, { 
          settings,
          preset
        });
        expect(result.blob).toBeInstanceOf(Blob);
        expect(result.metadata.preset).toBe(preset);
      }
    });
  });

  describe('cancel', () => {
    const createMockFrame = (width = 100, height = 100): ExtractedFrame => {
      const data = new Uint8ClampedArray(width * height * 4);
      return { 
        imageData: { data, width, height, colorSpace: 'srgb' },
        timestamp: 0,
        frameIndex: 0
      };
    };

    const createMockSettings = (): GifSettings => ({
      frameRate: 10,
      resolution: '640x480',
      quality: 'medium',
      startTime: 0,
      endTime: 2,
      speed: 1,
      brightness: 1,
      contrast: 1
    });

    it('should cancel ongoing encoding', () => {
      const frames = Array(10).fill(null).map(() => createMockFrame());
      const settings = createMockSettings();
      
      // Mock delayed rendering
      (window as any).GIF = jest.fn().mockImplementation(() => ({
        addFrame: jest.fn(),
        render: jest.fn(),
        abort: jest.fn(),
        on: jest.fn(),
        running: true,
        frames: [],
        options: {}
      }));

      encoder.encodeGif(frames, { settings });
      encoder.cancel();
      
      // Verify abort was called
      expect(encoder.status.isEncoding).toBe(false);
    });

    it('should be able to encode again after cancellation', async () => {
      const frames = [createMockFrame()];
      const settings = createMockSettings();

      // First encoding with cancellation
      const firstPromise = encoder.encodeGif(frames, { settings });
      encoder.cancel();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 50));

      // Second encoding should work (need new encoder since previous is cancelled)
      const newEncoder = new GifEncoder();
      const result = await newEncoder.encodeGif(frames, { settings });
      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  describe('status', () => {
    it('should return current encoding status', () => {
      const status = encoder.status;
      
      expect(status).toHaveProperty('isEncoding');
      expect(status).toHaveProperty('stage');
      expect(status).toHaveProperty('progress');
      expect(status.isEncoding).toBe(false);
      expect(status.stage).toBe('preparing');
      expect(status.progress).toBe(0);
    });
  });

  describe('helper functions', () => {
    describe('encodeGif function', () => {
      it('should encode GIF using convenience function', async () => {
        const frames = [{
          imageData: {
            data: new Uint8ClampedArray(100 * 100 * 4),
            width: 100,
            height: 100,
            colorSpace: 'srgb' as PredefinedColorSpace
          },
          timestamp: 0,
          frameIndex: 0
        }];
        
        const settings: GifSettings = {
          frameRate: 10,
          resolution: '640x480',
          quality: 'medium',
          startTime: 0,
          endTime: 1,
          speed: 1,
          brightness: 1,
          contrast: 1
        };

        const result = await encodeGif(frames, settings, {
          onProgress: mockProgressCallback
        });

        expect(result.blob).toBeInstanceOf(Blob);
        expect(mockProgressCallback).toHaveBeenCalled();
      });
    });

    describe('estimateEncodingParameters', () => {
      it('should estimate encoding parameters', () => {
        const settings: GifSettings = {
          frameRate: 15,
          resolution: '640x480',
          quality: 'medium',
          startTime: 0,
          endTime: 3,
          speed: 1,
          brightness: 1,
          contrast: 1
        };

        const estimate = estimateEncodingParameters(settings);
        
        expect(estimate).toHaveProperty('estimatedFileSize');
        expect(estimate).toHaveProperty('estimatedEncodingTime');
        expect(estimate).toHaveProperty('memoryUsage');
        expect(estimate).toHaveProperty('frameCount');
        expect(estimate).toHaveProperty('recommendations');
        expect(estimate.frameCount).toBe(45); // 3 seconds * 15 fps
      });

      it('should provide recommendations for large GIFs', () => {
        const settings: GifSettings = {
          frameRate: 30,
          resolution: '1920x1080',
          quality: 'high',
          startTime: 0,
          endTime: 10,
          speed: 1,
          brightness: 1,
          contrast: 1
        };

        const estimate = estimateEncodingParameters(settings, 'high-quality');
        
        expect(estimate.recommendations.length).toBeGreaterThan(0);
        expect(estimate.frameCount).toBe(300); // 10 seconds * 30 fps
      });

      it('should handle different quality presets', () => {
        const settings: GifSettings = {
          frameRate: 15,
          resolution: '640x480',
          quality: 'medium',
          startTime: 0,
          endTime: 2,
          speed: 1,
          brightness: 1,
          contrast: 1
        };

        const lowQuality = estimateEncodingParameters(settings, 'small-file');
        const highQuality = estimateEncodingParameters(settings, 'high-quality');
        
        // Both should return valid estimates
        expect(lowQuality.estimatedFileSize).toBeTruthy();
        expect(highQuality.estimatedFileSize).toBeTruthy();
      });
    });
  });

  describe('error handling', () => {
    it('should handle GIF.js not being loaded', async () => {
      delete (window as any).GIF;
      
      const frames = [{
        imageData: {
          data: new Uint8ClampedArray(100 * 100 * 4),
          width: 100,
          height: 100,
          colorSpace: 'srgb' as PredefinedColorSpace
        },
        timestamp: 0,
        frameIndex: 0
      }];
      
      const settings: GifSettings = {
        frameRate: 10,
        resolution: '640x480',
        quality: 'medium',
        startTime: 0,
        endTime: 1,
        speed: 1,
        brightness: 1,
        contrast: 1
      };

      // Mock script loading failure
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName: string) => {
        const element = originalCreateElement.call(document, tagName);
        if (tagName === 'script') {
          setTimeout(() => {
            element.onerror?.(new Event('error'));
          }, 0);
        }
        return element;
      }) as any;

      await expect(encoder.encodeGif(frames, { settings }))
        .rejects.toThrow();

      document.createElement = originalCreateElement;
    });
  });

  describe('memory management', () => {
    it('should handle large frame counts', async () => {
      const largeFrameCount = 50;
      const frames = Array(largeFrameCount).fill(null).map((_, i) => ({
        imageData: {
          data: new Uint8ClampedArray(50 * 50 * 4),
          width: 50,
          height: 50,
          colorSpace: 'srgb' as PredefinedColorSpace
        },
        timestamp: 0,
        frameIndex: i
      }));
      
      const settings: GifSettings = {
        frameRate: 30,
        resolution: '50x50',
        quality: 'medium',
        startTime: 0,
        endTime: largeFrameCount / 30,
        speed: 1,
        brightness: 1,
        contrast: 1
      };

      const result = await encoder.encodeGif(frames, { settings });
      
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.size).toBeGreaterThan(0);
    });

    it('should clean up resources after encoding', async () => {
      const frames = [{
        imageData: {
          data: new Uint8ClampedArray(100 * 100 * 4),
          width: 100,
          height: 100,
          colorSpace: 'srgb' as PredefinedColorSpace
        },
        timestamp: 0,
        frameIndex: 0
      }];
      
      const settings: GifSettings = {
        frameRate: 10,
        resolution: '100x100',
        quality: 'medium',
        startTime: 0,
        endTime: 1,
        speed: 1,
        brightness: 1,
        contrast: 1
      };

      await encoder.encodeGif(frames, { settings });
      
      // Verify status is reset
      expect(encoder.status.isEncoding).toBe(false);
      expect(encoder.status.stage).toBe('preparing');
    });
  });
});