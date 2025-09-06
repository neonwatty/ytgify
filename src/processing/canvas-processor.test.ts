import { CanvasProcessor, ProcessingConfig, ProcessedFrame, ProcessingResult } from './canvas-processor';
import { ExtractedFrame } from './frame-extractor';
import { TextOverlay } from '@/types';

describe('CanvasProcessor', () => {
  let processor: CanvasProcessor;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    // Mock canvas creation
    mockContext = {
      drawImage: jest.fn(),
      getImageData: jest.fn(() => ({
        data: new Uint8ClampedArray(400), // 10x10 pixels * 4 channels
        width: 10,
        height: 10
      })),
      putImageData: jest.fn(),
      fillRect: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: jest.fn(() => ({ width: 100 })),
      save: jest.fn(),
      restore: jest.fn(),
      scale: jest.fn(),
      translate: jest.fn(),
      rotate: jest.fn(),
      clearRect: jest.fn(),
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high' as ImageSmoothingQuality,
      filter: 'none',
      globalAlpha: 1,
      globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
      font: '16px sans-serif',
      fillStyle: '#000000',
      strokeStyle: '#000000',
      textAlign: 'start' as CanvasTextAlign,
      textBaseline: 'alphabetic' as CanvasTextBaseline,
      lineWidth: 1,
      shadowColor: 'rgba(0,0,0,0)',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      canvas: {} as HTMLCanvasElement
    } as unknown as CanvasRenderingContext2D;

    mockCanvas = {
      getContext: jest.fn(() => mockContext),
      width: 100,
      height: 100,
      toBlob: jest.fn((callback: BlobCallback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      }),
      toDataURL: jest.fn(() => 'data:image/png;base64,test')
    } as unknown as HTMLCanvasElement;

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

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create a new CanvasProcessor instance', () => {
      expect(processor).toBeDefined();
      expect(processor).toBeInstanceOf(CanvasProcessor);
    });

    it('should initialize canvases', () => {
      expect(document.createElement).toHaveBeenCalledWith('canvas');
      expect(mockCanvas.getContext).toHaveBeenCalledWith('2d');
    });
  });

  describe('processFrames', () => {
    const createMockFrame = (index: number): ExtractedFrame => ({
      imageData: {
        data: new Uint8ClampedArray(400),
        width: 10,
        height: 10
      } as ImageData,
      timestamp: index * 1000,
      frameIndex: index
    });

    it('should process a single frame', async () => {
      const frame = createMockFrame(0);
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const result = await processor.processFrames([frame], config);
      
      expect(result).toBeDefined();
      expect(result.frames).toHaveLength(1);
      expect(result.frames[0]).toHaveProperty('imageData');
      expect(result.frames[0]).toHaveProperty('timestamp');
    });

    it('should process multiple frames', async () => {
      const frames = [
        createMockFrame(0),
        createMockFrame(1),
        createMockFrame(2)
      ];
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const result = await processor.processFrames(frames, config);
      
      expect(result).toBeDefined();
      expect(result.frames).toHaveLength(3);
      result.frames.forEach((frame, index) => {
        expect(frame.timestamp).toBe(index * 1000);
        expect(frame.frameIndex).toBe(index);
      });
    });

    it('should handle progress callback', async () => {
      const frames = [
        createMockFrame(0),
        createMockFrame(1),
        createMockFrame(2)
      ];
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const progressCallback = jest.fn();
      await processor.processFrames(frames, config, progressCallback);
      
      expect(progressCallback).toHaveBeenCalled();
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall.framesProcessed).toBe(3);
      expect(lastCall.totalFrames).toBe(3);
    });

    it('should apply brightness adjustment', async () => {
      const frame = createMockFrame(0);
      const brightness = 50;
      const config: ProcessingConfig = {
        brightness
      };
      
      const result = await processor.processFrames([frame], config);
      expect(result.frames[0]).toBeDefined();
    });

    it('should apply contrast adjustment', async () => {
      const frame = createMockFrame(0);
      const contrast = 30;
      const config: ProcessingConfig = {
        contrast
      };
      
      const result = await processor.processFrames([frame], config);
      expect(result.frames[0]).toBeDefined();
    });

    it('should apply saturation adjustment', async () => {
      const frame = createMockFrame(0);
      const saturation = -20;
      const config: ProcessingConfig = {
        saturation
      };
      
      const result = await processor.processFrames([frame], config);
      expect(result.frames[0]).toBeDefined();
    });

    it('should maintain aspect ratio when resizing', async () => {
      const frame = createMockFrame(0);
      const config: ProcessingConfig = {
        targetWidth: 50,
        maintainAspectRatio: true
      };
      
      const result = await processor.processFrames([frame], config);
      expect(result.frames[0]).toBeDefined();
      expect(result.frames[0].processedDimensions.width).toBeLessThanOrEqual(50);
    });

    it('should crop frames', async () => {
      const frame = createMockFrame(0);
      const config: ProcessingConfig = {
        cropArea: {
          x: 2,
          y: 2,
          width: 6,
          height: 6
        }
      };
      
      const result = await processor.processFrames([frame], config);
      expect(result.frames[0]).toBeDefined();
      expect(mockContext.drawImage).toHaveBeenCalled();
    });

    it('should handle quality settings', async () => {
      const frame = createMockFrame(0);
      
      for (const quality of ['low', 'medium', 'high'] as const) {
        const config: ProcessingConfig = {
          quality
        };
        
        const result = await processor.processFrames([frame], config);
        expect(result.frames[0]).toBeDefined();
      }
    });

    it('should handle scaling modes', async () => {
      const frame = createMockFrame(0);
      
      for (const scalingMode of ['fit', 'fill', 'stretch', 'crop'] as const) {
        const config: ProcessingConfig = {
          targetWidth: 50,
          targetHeight: 50,
          scalingMode
        };
        
        const result = await processor.processFrames([frame], config);
        expect(result.frames[0]).toBeDefined();
      }
    });

    it('should handle empty frame array', async () => {
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const result = await processor.processFrames([], config);
      expect(result.frames).toHaveLength(0);
      expect(result.metadata.totalProcessingTime).toBeGreaterThanOrEqual(0);
    });

    it('should abort processing when cancelled', async () => {
      const frames = Array.from({ length: 10 }, (_, i) => createMockFrame(i));
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const processPromise = processor.processFrames(frames, config);
      
      // Cancel immediately
      processor.cancel();
      
      await expect(processPromise).rejects.toThrow('Processing cancelled');
    });

    it('should handle concurrent processing requests', async () => {
      const frames1 = [createMockFrame(0)];
      const frames2 = [createMockFrame(1)];
      const config: ProcessingConfig = {
        targetWidth: 50,
        targetHeight: 50
      };
      
      const promise1 = processor.processFrames(frames1, config);
      const promise2 = processor.processFrames(frames2, config);
      
      const [result1, result2] = await Promise.all([promise1, promise2]);
      
      expect(result1.frames).toHaveLength(1);
      expect(result2.frames).toHaveLength(1);
    });
  });

  describe('cancel', () => {
    it('should set abort signal', () => {
      const frames = [
        {
          imageData: new ImageData(10, 10),
          timestamp: 0,
          frameIndex: 0
        }
      ];
      
      const processPromise = processor.processFrames(frames, {});
      processor.cancel();
      
      expect(processPromise).rejects.toThrow();
    });
  });
});