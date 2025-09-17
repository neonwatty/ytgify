/**
 * Tests for GifJsEncoder
 * Priority 1: Legacy GIF encoding with gif.js library
 */

import { GifJsEncoder } from '@/lib/encoders/gifjs-encoder';
import { EncodingOptions, FrameData } from '@/lib/encoders/abstract-encoder';

// Mock gif.js library
class MockGIF {
  running = false;
  frames: any[] = [];
  options: any;
  private callbacks: Map<string, Function[]> = new Map();

  constructor(options?: any) {
    this.options = options;
  }

  addFrame(element: any, options?: any) {
    this.frames.push({ element, options });
  }

  render() {
    this.running = true;

    // Simulate async rendering with immediate execution for tests
    setTimeout(() => {
      this.trigger('start');

      // Simulate progress updates
      setTimeout(() => this.trigger('progress', 0.2), 10);
      setTimeout(() => this.trigger('progress', 0.4), 20);
      setTimeout(() => this.trigger('progress', 0.6), 30);
      setTimeout(() => this.trigger('progress', 0.8), 40);
      setTimeout(() => this.trigger('progress', 1.0), 50);

      // Simulate completion
      setTimeout(() => {
        this.running = false;
        this.trigger('finished', new Blob(['gif-data'], { type: 'image/gif' }));
      }, 60);
    }, 5);
  }

  abort() {
    this.running = false;
    this.trigger('abort');
  }

  on(event: string, callback: Function) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event)!.push(callback);
  }

  private trigger(event: string, ...args: any[]) {
    const callbacks = this.callbacks.get(event) || [];
    callbacks.forEach(cb => cb(...args));
  }
}

// Mock OffscreenCanvas
class MockOffscreenCanvas {
  width: number;
  height: number;
  private context: any;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.context = {
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue(new ImageData(width, height)),
      putImageData: jest.fn(),
      fillStyle: '',
      fillRect: jest.fn()
    };
  }

  getContext(type: string) {
    if (type === '2d') {
      return this.context;
    }
    return null;
  }

  convertToBlob(options?: any): Promise<Blob> {
    return Promise.resolve(new Blob(['thumbnail'], { type: options?.type || 'image/png' }));
  }
}

// Setup globals
(global as any).OffscreenCanvas = MockOffscreenCanvas;
(global as any).window = {
  GIF: MockGIF
};
(global as any).GIF = MockGIF; // Also set on global for tests

// Create document mock
const mockCreateElement = jest.fn().mockImplementation((tagName: string) => {
  if (tagName === 'script') {
    return {
      onload: null,
      onerror: null,
      src: ''
    };
  }
  if (tagName === 'canvas') {
    return {
      width: 100,
      height: 100,
      getContext: jest.fn().mockReturnValue({
        drawImage: jest.fn(),
        getImageData: jest.fn().mockReturnValue(new ImageData(100, 100)),
        putImageData: jest.fn(),
        fillStyle: '',
        fillRect: jest.fn(),
        fillText: jest.fn(),
        font: '',
        textAlign: 'left',
        textBaseline: 'top'
      })
    };
  }
  return {};
});
const mockAppendChild = jest.fn();

(global as any).document = {
  createElement: mockCreateElement,
  head: {
    appendChild: mockAppendChild
  }
};

(global as any).chrome = {
  runtime: {
    getURL: jest.fn((path) => `chrome-extension://test/${path}`)
  }
};

describe('GifJsEncoder', () => {
  let encoder: GifJsEncoder;
  let mockFrames: FrameData[];
  let mockOptions: EncodingOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset window.GIF to MockGIF
    (global as any).window.GIF = MockGIF;

    encoder = new GifJsEncoder();

    // Create mock frame data
    mockFrames = [
      {
        imageData: new ImageData(100, 100),
        timestamp: 0,
        delay: 100
      },
      {
        imageData: new ImageData(100, 100),
        timestamp: 100,
        delay: 100
      }
    ];

    mockOptions = {
      width: 100,
      height: 100,
      frameRate: 10,
      quality: 'medium',
      loop: true
    };
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    // Reset window.GIF
    (global as any).window.GIF = MockGIF;
  });

  describe('Basic Properties', () => {
    it('should have correct name', () => {
      expect(encoder.name).toBe('gif.js');
    });

    it('should support GIF format only', () => {
      expect(encoder.supportedFormats).toEqual(['gif']);
    });

    it('should have correct characteristics', () => {
      expect(encoder.characteristics).toEqual({
        speed: 'medium',
        quality: 'medium',
        memoryUsage: 'high',
        browserSupport: 'excellent'
      });
    });
  });

  describe('Availability', () => {
    it('should be available when GIF is in window', () => {
      expect(encoder.isAvailable()).toBe(true);
    });

    it('should not be available when GIF is missing', () => {
      const originalGIF = (window as any).GIF;
      delete (window as any).GIF;

      expect(encoder.isAvailable()).toBe(false);

      (window as any).GIF = originalGIF;
    });

    it('should not be available in non-browser environment', () => {
      const originalWindow = (global as any).window;
      delete (global as any).window;

      expect(encoder.isAvailable()).toBe(false);

      (global as any).window = originalWindow;
    });
  });

  describe('Initialization', () => {
    it('should initialize immediately if already available', async () => {
      await expect(encoder.initialize()).resolves.toBeUndefined();
      expect(mockCreateElement).not.toHaveBeenCalled();
    });

  });

  describe('Encoding', () => {
    it('should encode frames successfully', async () => {
      const onProgress = jest.fn();

      const encodePromise = encoder.encode(mockFrames, mockOptions, onProgress);

      // Run timers to trigger gif.js callbacks
      await jest.runAllTimersAsync();

      const result = await encodePromise;

      expect(result).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.metadata).toMatchObject({
        frameCount: 2,
        width: 100,
        height: 100,
        encoder: 'gif.js'
      });

      // Check progress was reported
      expect(onProgress).toHaveBeenCalled();
    });

it('should handle abort signal', async () => {
      const abortController = new AbortController();
      const onProgress = jest.fn();

      const encodePromise = encoder.encode(
        mockFrames,
        mockOptions,
        onProgress,
        abortController.signal
      );

      // Abort after starting
      setTimeout(() => abortController.abort(), 50);

      jest.runAllTimers();

      await expect(encodePromise).rejects.toThrow('Encoding aborted');
    });

it('should generate result blob', async () => {
      (global as any).window.GIF = MockGIF;

      const encodePromise = encoder.encode(mockFrames, mockOptions);
      await jest.runAllTimersAsync();

      const result = await encodePromise;

      expect(result.blob).toBeDefined();
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should calculate metadata correctly', async () => {
      (global as any).window.GIF = MockGIF;

      const encodePromise = encoder.encode(mockFrames, mockOptions);
      await jest.runAllTimersAsync();

      const result = await encodePromise;

      expect(result.metadata).toMatchObject({
        frameCount: 2,
        width: 100,
        height: 100,
        format: 'gif',
        encoder: 'gif.js',
        encodingTime: expect.any(Number),
        averageFrameTime: expect.any(Number),
        fileSize: expect.any(Number)
      });
    });

  });

});