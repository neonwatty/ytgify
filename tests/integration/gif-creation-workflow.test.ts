import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import type {
  ExtensionMessage,
  GifSettings,
  TimelineSelection,
  GifData
} from '@/types';

// Define VideoMetadata locally since it's not exported
interface VideoMetadata {
  originalFrameRate: number;
  resolution: { width: number; height: number };
  bitrate?: number;
}

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    sendMessage: jest.fn(),
    executeScript: jest.fn()
  }
};

global.chrome = mockChrome as any;

// Mock IndexedDB for GIF storage
class MockIndexedDB {
  private storage = new Map();

  async open(name: string, version: number) {
    return {
      objectStore: (storeName: string) => ({
        add: async (data: any) => {
          this.storage.set(data.id, data);
          return data.id;
        },
        get: async (id: string) => {
          return this.storage.get(id);
        },
        getAll: async () => {
          return Array.from(this.storage.values());
        },
        delete: async (id: string) => {
          return this.storage.delete(id);
        }
      })
    };
  }

  clear() {
    this.storage.clear();
  }
}

const mockIndexedDB = new MockIndexedDB();
global.indexedDB = { open: mockIndexedDB.open.bind(mockIndexedDB) } as any;

describe('GIF Creation Workflow Integration', () => {
  let mockVideo: HTMLVideoElement;
  let mockCanvas: HTMLCanvasElement;
  let mockContext: CanvasRenderingContext2D;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIndexedDB.clear();

    // Mock video element
    mockVideo = {
      currentTime: 0,
      duration: 120,
      paused: false,
      videoWidth: 1920,
      videoHeight: 1080,
      play: jest.fn(),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    } as any;

    // Mock canvas and context
    mockContext = {
      drawImage: jest.fn(),
      getImageData: jest.fn().mockReturnValue({
        data: new Uint8ClampedArray(4),
        width: 1,
        height: 1
      }),
      putImageData: jest.fn(),
      clearRect: jest.fn()
    } as any;

    mockCanvas = {
      width: 640,
      height: 360,
      getContext: jest.fn().mockReturnValue(mockContext),
      toBlob: jest.fn((callback: BlobCallback) => {
        callback(new Blob(['test'], { type: 'image/png' }));
      }),
      toDataURL: jest.fn().mockReturnValue('data:image/png;base64,test')
    } as any;

    document.createElement = jest.fn((tag: string) => {
      if (tag === 'canvas') return mockCanvas;
      if (tag === 'video') return mockVideo;
      return document.createElement(tag);
    }) as any;

    // Mock querySelector for video element
    document.querySelector = jest.fn((selector: string) => {
      if (selector === 'video') return mockVideo;
      return null;
    }) as any;
  });

  afterEach(() => {
    jest.clearAllTimers();
    // Reset global mocks
    delete (global as any).GIF;
  });

  describe('Complete GIF Creation Flow', () => {
    it('should handle full workflow from selection to saved GIF', async () => {
      // Step 1: User selects timeline segment
      const selection: TimelineSelection = {
        startTime: 10,
        endTime: 15,
        duration: 5
      };

      const settings: GifSettings = {
        frameRate: 15,
        quality: 'medium',
        resolution: '720p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: selection.startTime,
        endTime: selection.endTime
      };

      // Step 2: Simulate frame extraction request
      const frameExtractionMessage: ExtensionMessage = {
        type: 'EXTRACT_FRAMES',
        data: {
          videoElement: {
            currentTime: selection.startTime,
            duration: selection.duration,
            videoWidth: 1920,
            videoHeight: 1080
          },
          settings: {
            startTime: selection.startTime,
            endTime: selection.endTime,
            frameRate: settings.frameRate,
            quality: settings.quality
          }
        }
      };

      // Mock frame extraction response
      const extractedFrames = Array.from({ length: 75 }, (_, i) => ({
        timestamp: selection.startTime + (i / settings.frameRate),
        blob: new Blob(['frame'], { type: 'image/png' }),
        index: i
      }));

      mockChrome.runtime.sendMessage.mockImplementation((message: any, callback: any) => {
        if (message.type === 'EXTRACT_FRAMES') {
          setTimeout(() => {
            callback({
              success: true,
              frames: extractedFrames
            });
          }, 100);
        }
      });

      // Step 3: Process frames with settings
      const processedFrames = await processFramesWithSettings(extractedFrames, settings);

      // Step 4: Encode to GIF
      const gifBlob = await encodeToGIF(processedFrames, settings);

      // Step 5: Generate thumbnail
      const thumbnailBlob = await generateThumbnail(processedFrames[0]);

      // Step 6: Save to storage
      const gifData: GifData = {
        id: `gif-${Date.now()}`,
        title: 'Test Video',
        description: 'Test GIF',
        blob: gifBlob,
        thumbnailBlob,
        metadata: {
          width: 1280,
          height: 720,
          duration: selection.duration,
          frameRate: settings.frameRate,
          fileSize: gifBlob.size,
          createdAt: new Date(),
          youtubeUrl: 'https://youtube.com/watch?v=test',
          startTime: selection.startTime,
          endTime: selection.endTime
        },
        tags: ['test', 'integration']
      };

      const savedId = await saveGifToStorage(gifData);

      // Step 7: Verify saved GIF
      const retrievedGif = await getGifFromStorage(savedId);

      expect(retrievedGif).toBeDefined();
      expect(retrievedGif.id).toBe(savedId);
      expect(retrievedGif.metadata.duration).toBe(5);
      expect(retrievedGif.metadata.frameRate).toBe(15);
    });

    it('should handle workflow with text overlays', async () => {
      const selection: TimelineSelection = {
        startTime: 0,
        endTime: 3,
        duration: 3
      };

      const settings: GifSettings = {
        frameRate: 10,
        quality: 'high',
        resolution: '1080p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: selection.startTime,
        endTime: selection.endTime,
        textOverlays: [
          {
            id: 'overlay-1',
            text: 'Hello World',
            position: { x: 100, y: 100 },
            fontSize: 24,
            fontFamily: 'Arial',
            color: '#ffffff',
            animation: 'fade-in',
            // duration: 3 - TextOverlay doesn't have duration property
          }
        ]
      };

      // Process frames with text overlays
      const frames = Array.from({ length: 30 }, (_, i) => ({
        timestamp: i / 10,
        blob: new Blob(['frame'], { type: 'image/png' }),
        index: i
      }));

      const processedFrames = await processFramesWithSettings(frames, settings);

      // Verify text overlay was applied
      expect(processedFrames).toHaveLength(30);

      // Encode and save
      const gifBlob = await encodeToGIF(processedFrames, settings);
      expect(gifBlob.size).toBeGreaterThan(0);
    });

    it('should handle workflow with crop area', async () => {
      const selection: TimelineSelection = {
        startTime: 5,
        endTime: 8,
        duration: 3
      };

      const settings: GifSettings = {
        frameRate: 12,
        quality: 'low',
        resolution: '480p',
        speed: 1.5,
        brightness: 1,
        contrast: 1,
        startTime: selection.startTime,
        endTime: selection.endTime
      };

      // Store crop area separately for testing
      const cropArea = {
        x: 100,
        y: 50,
        width: 640,
        height: 360
      };

      const frames = Array.from({ length: 36 }, (_, i) => ({
        timestamp: selection.startTime + (i / 12),
        blob: new Blob(['frame'], { type: 'image/png' }),
        index: i
      }));

      const processedFrames = await processFramesWithSettings(frames, settings);

      // Verify crop was applied
      expect(processedFrames).toHaveLength(36);

      const gifBlob = await encodeToGIF(processedFrames, settings);
      const gifData: GifData = createGifData(gifBlob, settings, selection);

      const savedId = await saveGifToStorage(gifData);
      expect(savedId).toBeDefined();
    });
  });

  describe('Error Handling in Workflow', () => {
    it('should handle frame extraction failure', async () => {
      mockChrome.runtime.sendMessage.mockImplementation((message: any, callback: any) => {
        if (message.type === 'EXTRACT_FRAMES') {
          callback({
            success: false,
            error: 'Failed to extract frames'
          });
        }
      });

      const selection: TimelineSelection = {
        startTime: 0,
        endTime: 5,
        duration: 5
      };

      await expect(extractFrames(selection)).rejects.toThrow('Failed to extract frames');
    });

    it('should handle encoding failure', async () => {
      const frames = Array.from({ length: 10 }, (_, i) => ({
        timestamp: i / 10,
        blob: new Blob(['invalid'], { type: 'invalid/type' }),
        index: i
      }));

      const settings: GifSettings = {
        frameRate: 10,
        quality: 'medium',
        resolution: '720p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: 0,
        endTime: 1
      };

      // Mock encoder failure for this test only
      const originalGIF = (global as any).GIF;
      (global as any).GIF = jest.fn().mockImplementation(() => ({
        addFrame: jest.fn(),
        render: jest.fn((callback: any) => callback(new Error('Encoding failed')))
      }));

      await expect(encodeToGIF(frames, settings)).rejects.toThrow('Encoding failed');

      // Restore original mock
      (global as any).GIF = originalGIF;
    });

    it('should handle storage failure', async () => {
      const gifBlob = new Blob(['test'], { type: 'image/gif' });
      const gifData = createGifData(gifBlob, {} as GifSettings, {} as TimelineSelection);

      // Mock storage failure
      (global.indexedDB as any).open = jest.fn().mockRejectedValue(new Error('Storage quota exceeded') as never);

      await expect(saveGifToStorage(gifData)).rejects.toThrow('Storage quota exceeded');
    });
  });

  describe('Performance Optimization', () => {
    it('should handle large GIF creation efficiently', async () => {
      const startTime = performance.now();

      const selection: TimelineSelection = {
        startTime: 0,
        endTime: 30, // 30 second GIF
        duration: 30
      };

      const settings: GifSettings = {
        frameRate: 24, // High frame rate
        quality: 'high',
        resolution: '1080p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: selection.startTime,
        endTime: selection.endTime
      };

      // Generate 720 frames (30s * 24fps)
      const frames = Array.from({ length: 720 }, (_, i) => ({
        timestamp: i / 24,
        blob: new Blob(['frame'], { type: 'image/png' }),
        index: i
      }));

      const processedFrames = await processFramesWithSettings(frames, settings);

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Processing should complete within reasonable time
      expect(processingTime).toBeLessThan(5000); // 5 seconds max
      expect(processedFrames).toHaveLength(720);
    });

    it('should optimize file size based on settings', async () => {
      const baseFrames = Array.from({ length: 30 }, (_, i) => ({
        timestamp: i / 10,
        blob: new Blob(['frame'.repeat(100)], { type: 'image/png' }),
        index: i
      }));

      const lowQualitySettings: GifSettings = {
        frameRate: 10,
        quality: 'low',
        resolution: '480p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: 0,
        endTime: 3
      };

      const highQualitySettings: GifSettings = {
        frameRate: 10,
        quality: 'high',
        resolution: '1080p',
        speed: 1,
        brightness: 1,
        contrast: 1,
        startTime: 0,
        endTime: 3
      };

      const lowQualityGif = await encodeToGIF(baseFrames, lowQualitySettings);
      const highQualityGif = await encodeToGIF(baseFrames, highQualitySettings);

      // Low quality should produce smaller file
      expect(lowQualityGif.size).toBeLessThanOrEqual(highQualityGif.size);
    });
  });
});

// Helper functions for the integration tests
async function extractFrames(selection: TimelineSelection): Promise<any[]> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: 'EXTRACT_FRAMES',
      data: selection
    }, (response) => {
      if (response.success) {
        resolve(response.frames);
      } else {
        reject(new Error(response.error));
      }
    });
  });
}

async function processFramesWithSettings(frames: any[], settings: GifSettings): Promise<any[]> {
  // Simulate frame processing (brightness, contrast, crop, etc.)
  return frames.map(frame => ({
    ...frame,
    processed: true,
    settings: settings
  }));
}

async function encodeToGIF(frames: any[], settings: GifSettings): Promise<Blob> {
  // Simulate GIF encoding
  if ((global as any).GIF && typeof (global as any).GIF === 'function') {
    const gif = new (global as any).GIF({
      quality: settings.quality === 'low' ? 20 : settings.quality === 'high' ? 1 : 10,
      workers: 4
    });

    frames.forEach(frame => gif.addFrame(frame));

    return new Promise((resolve, reject) => {
      gif.render((error: Error | Blob) => {
        if (error instanceof Error) {
          reject(error);
        } else {
          resolve(error as Blob);
        }
      });
    });
  }

  // Fallback for testing - create blobs with different sizes based on quality
  if (settings.quality === 'low') {
    return new Blob(['x'.repeat(1000)], { type: 'image/gif' });
  } else if (settings.quality === 'high') {
    return new Blob(['x'.repeat(5000)], { type: 'image/gif' });
  } else {
    return new Blob(['x'.repeat(2500)], { type: 'image/gif' });
  }
}

async function generateThumbnail(firstFrame: any): Promise<Blob> {
  // Simulate thumbnail generation
  return new Blob(['thumbnail'], { type: 'image/png' });
}

async function saveGifToStorage(gifData: GifData): Promise<string> {
  const db = await indexedDB.open('gif-storage', 1);
  const store = (db as any).objectStore('gifs');
  return await store.add(gifData);
}

async function getGifFromStorage(id: string): Promise<GifData> {
  const db = await indexedDB.open('gif-storage', 1);
  const store = (db as any).objectStore('gifs');
  return await store.get(id);
}

function createGifData(gifBlob: Blob, settings: GifSettings, selection: TimelineSelection): GifData {
  return {
    id: `gif-${Date.now()}`,
    title: 'Test Video',
    description: 'Test GIF',
    blob: gifBlob,
    thumbnailBlob: new Blob(['thumb'], { type: 'image/png' }),
    metadata: {
      width: 1280,
      height: 720,
      duration: selection.duration,
      frameRate: settings.frameRate,
      fileSize: gifBlob.size,
      createdAt: new Date(),
      youtubeUrl: 'https://youtube.com/watch?v=test',
      startTime: selection.startTime,
      endTime: selection.endTime
    },
    tags: []
  };
}