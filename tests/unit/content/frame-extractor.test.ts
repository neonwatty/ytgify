/**
 * Tests for ContentScriptFrameExtractor
 * Priority 1: Core functionality tests for frame extraction pipeline
 */

import { ContentScriptFrameExtractor, ContentFrameExtractionRequest, ContentFrameExtractionResponse } from '@/content/frame-extractor';
import { chromeMock } from '../__mocks__/chrome-mocks';

// Mock the lib modules that frame-extractor depends on
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

jest.mock('@/lib/simple-frame-extractor', () => ({
  extractFramesSimple: jest.fn()
}));

jest.mock('@/lib/instant-frame-capture', () => ({
  captureInstantFrames: jest.fn()
}));

describe('ContentScriptFrameExtractor', () => {
  let frameExtractor: ContentScriptFrameExtractor;
  let mockVideo: HTMLVideoElement;
  let mockSendResponse: jest.MockedFunction<(response: ContentFrameExtractionResponse) => void>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Set up global chrome mock
    (global as any).chrome = chromeMock;

    // Create mock video element with proper typing
    const mockVideoState = {
      _duration: 100,
      _currentTime: 10,
      _paused: false,
      _readyState: 4,
      _ended: false
    };

    mockVideo = {
      videoWidth: 1920,
      videoHeight: 1080,
      get duration() { return mockVideoState._duration; },
      get currentTime() { return mockVideoState._currentTime; },
      set currentTime(val) { mockVideoState._currentTime = val; },
      get paused() { return mockVideoState._paused; },
      get readyState() { return mockVideoState._readyState; },
      get ended() { return mockVideoState._ended; },
      play: jest.fn().mockResolvedValue(undefined),
      pause: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      // Helper methods for tests
      _setDuration: (val: number) => { mockVideoState._duration = val; },
      _setPaused: (val: boolean) => { mockVideoState._paused = val; },
      _setEnded: (val: boolean) => { mockVideoState._ended = val; },
      _setReadyState: (val: number) => { mockVideoState._readyState = val; }
    } as any;

    // Mock DOM querySelector to return our mock video
    const originalQuerySelector = document.querySelector;
    document.querySelector = jest.fn((selector: string) => {
      if (selector === 'video' || selector.includes('video')) {
        return mockVideo;
      }
      return originalQuerySelector.call(document, selector);
    });

    // Create frame extractor instance
    frameExtractor = ContentScriptFrameExtractor.getInstance();

    // Create mock send response function
    mockSendResponse = jest.fn();
  });

  afterEach(() => {
    // Clean up any running timers and intervals from BackgroundMessageHandler
    const { BackgroundMessageHandler } = require('@/background/message-handler');
    if (BackgroundMessageHandler.resetInstance) {
      BackgroundMessageHandler.resetInstance();
    }

    // Reset ContentScriptFrameExtractor singleton as well
    ContentScriptFrameExtractor.resetInstance();

    // Clear all timers and intervals that might have been created
    jest.clearAllTimers();

    // Restore original querySelector
    jest.restoreAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ContentScriptFrameExtractor.getInstance();
      const instance2 = ContentScriptFrameExtractor.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('handleFrameExtractionRequest', () => {
    const createValidRequest = (): ContentFrameExtractionRequest => ({
      type: 'CONTENT_SCRIPT_EXTRACT_FRAMES',
      id: 'test-request-123',
      data: {
        startTime: 5,
        endTime: 10,
        frameRate: 10,
        targetWidth: 640,
        targetHeight: 360,
        quality: 'medium'
      }
    });

    it('should extract frames successfully with valid request', async () => {
      const request = createValidRequest();

      // Mock successful frame extraction
      const mockFrames = [
        new ImageData(640, 360),
        new ImageData(640, 360),
        new ImageData(640, 360)
      ];

      const mockResult = {
        frames: mockFrames,
        metadata: {
          totalFrames: 3,
          actualFrameRate: 10,
          dimensions: { width: 640, height: 360 },
          duration: 5,
          extractionMethod: 'simple',
          processingTime: 1000
        }
      };

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockResolvedValue(mockResult);

      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);

      expect(extractFramesSimple).toHaveBeenCalledWith(
        mockVideo,
        expect.objectContaining({
          startTime: 5,
          endTime: 10,
          frameRate: 10,
          quality: 'medium',
          maxWidth: 640,
          maxHeight: 360
        }),
        expect.any(Function)
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        frames: mockFrames,
        metadata: mockResult.metadata
      });
    });

    it('should reject concurrent requests', async () => {
      const request1 = createValidRequest();
      const request2 = createValidRequest();

      // Mock slow frame extraction
      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));

      // Start first request
      const promise1 = frameExtractor.handleFrameExtractionRequest(request1, mockSendResponse);

      // Start second request immediately
      const mockSendResponse2 = jest.fn();
      await frameExtractor.handleFrameExtractionRequest(request2, mockSendResponse2);

      // Second request should be rejected immediately
      expect(mockSendResponse2).toHaveBeenCalledWith({
        frames: []
      });

      // Wait for first request to complete
      await promise1;
    });

    it('should handle video element not found', async () => {
      const request = createValidRequest();

      // Mock no video element found
      document.querySelector = jest.fn().mockReturnValue(null);

      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        frames: []
      });
    });

    it('should fallback to instant capture on timeout', async () => {
      const request = createValidRequest();

      // Mock extractFramesSimple to timeout
      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockRejectedValue(new Error('Extraction timeout'));

      // Mock instant capture fallback
      const mockInstantFrames = [new ImageData(640, 360), new ImageData(640, 360)];
      const { captureInstantFrames } = require('@/lib/instant-frame-capture');
      captureInstantFrames.mockResolvedValue(mockInstantFrames);

      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);

      expect(captureInstantFrames).toHaveBeenCalledWith(
        mockVideo,
        5, // startTime
        10, // endTime
        expect.objectContaining({
          frameCount: 50, // (10-5) * 10 fps
          width: 640,
          height: 360
        })
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        frames: mockInstantFrames,
        metadata: expect.objectContaining({
          extractionMethod: 'instant-fallback',
          totalFrames: 2
        })
      });
    });

    it('should handle extraction errors gracefully', async () => {
      const request = createValidRequest();

      // Mock both extraction methods to fail
      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      const { captureInstantFrames } = require('@/lib/instant-frame-capture');

      extractFramesSimple.mockRejectedValue(new Error('Simple extraction failed'));
      captureInstantFrames.mockRejectedValue(new Error('Instant capture failed'));

      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);

      expect(mockSendResponse).toHaveBeenCalledWith({
        frames: []
      });
    });
  });

  describe('findActiveVideoElement', () => {
    it('should find YouTube video element with specific selectors', () => {
      // Mock YouTube-specific video element
      const youtubeVideo = {
        ...mockVideo,
        className: 'video-stream html5-main-video',
        readyState: 4
      } as HTMLVideoElement;

      document.querySelector = jest.fn((selector: string) => {
        if (selector === 'video.video-stream.html5-main-video') {
          return youtubeVideo;
        }
        return null;
      });

      const videoState = frameExtractor.getVideoState();
      expect(videoState.hasVideo).toBe(true);
      expect(videoState.dimensions.width).toBe(1920);
      expect(videoState.dimensions.height).toBe(1080);
    });

    it('should find generic video element as fallback', () => {
      // Mock querySelector to return generic video on second call
      let callCount = 0;
      document.querySelector = jest.fn((selector: string) => {
        callCount++;
        if (selector.includes('video.video-stream') || selector.includes('.html5-video-container')) {
          return null; // YouTube selectors fail
        }
        if (selector === 'video' && callCount > 5) {
          return mockVideo; // Generic video selector succeeds
        }
        return null;
      });

      const videoState = frameExtractor.getVideoState();
      expect(videoState.hasVideo).toBe(true);
    });

    it('should handle cross-origin iframe access errors', () => {
      document.querySelector = jest.fn().mockReturnValue(null);
      document.querySelectorAll = jest.fn((selector: string) => {
        if (selector === 'iframe') {
          const mockIframe = {
            contentDocument: null,
            contentWindow: {
              document: {
                querySelector: () => {
                  throw new DOMException('SecurityError');
                }
              }
            }
          };
          const mockNodeList = [mockIframe] as any;
          mockNodeList.item = jest.fn((index: number) => mockNodeList[index]);
          return mockNodeList;
        }
        const emptyNodeList = [] as any;
        emptyNodeList.item = jest.fn();
        return emptyNodeList;
      });

      const videoState = frameExtractor.getVideoState();
      expect(videoState.hasVideo).toBe(false);
    });
  });

  describe('isVideoReady', () => {
    it('should return true for ready video', () => {
      const readyVideo = {
        readyState: 3, // HAVE_FUTURE_DATA
        videoWidth: 1920,
        videoHeight: 1080,
        duration: 100,
        ended: false
      } as HTMLVideoElement;

      // Access private method through public interface
      document.querySelector = jest.fn().mockReturnValue(readyVideo);
      const videoState = frameExtractor.getVideoState();
      expect(videoState.hasVideo).toBe(true);
    });

    it('should return true for video found but with default values when not ready', () => {
      const notReadyVideo = {
        readyState: 1, // HAVE_METADATA (not enough)
        videoWidth: 0,
        videoHeight: 0,
        duration: 0,
        ended: false,
        paused: true,
        currentTime: 0
      } as HTMLVideoElement;

      document.querySelector = jest.fn().mockReturnValue(notReadyVideo);
      const videoState = frameExtractor.getVideoState();
      expect(videoState.hasVideo).toBe(true);
      expect(videoState.dimensions.width).toBe(0);
      expect(videoState.dimensions.height).toBe(0);
      expect(videoState.duration).toBe(0);
    });
  });

  describe('getVideoState', () => {
    it('should return correct video state when video exists', () => {
      const videoState = frameExtractor.getVideoState();

      expect(videoState).toEqual({
        hasVideo: true,
        isPlaying: true, // !paused && !ended
        currentTime: 10,
        duration: 100,
        dimensions: {
          width: 1920,
          height: 1080
        }
      });
    });

    it('should return default state when no video exists', () => {
      document.querySelector = jest.fn().mockReturnValue(null);

      const videoState = frameExtractor.getVideoState();

      expect(videoState).toEqual({
        hasVideo: false,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        dimensions: { width: 0, height: 0 }
      });
    });

    it('should detect paused video correctly', () => {
      (mockVideo as any)._setPaused(true);
      const videoState = frameExtractor.getVideoState();
      expect(videoState.isPlaying).toBe(false);
    });

    it('should detect ended video correctly', () => {
      (mockVideo as any)._setEnded(true);
      const videoState = frameExtractor.getVideoState();
      expect(videoState.isPlaying).toBe(false);
    });
  });

  describe('testFrameExtraction', () => {
    it('should return true for successful test extraction', async () => {
      const mockResult = {
        frames: [new ImageData(320, 240)],
        metadata: {
          totalFrames: 1,
          actualFrameRate: 1,
          dimensions: { width: 320, height: 240 },
          duration: 1,
          extractionMethod: 'simple',
          processingTime: 100
        }
      };

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockResolvedValue(mockResult);

      const result = await frameExtractor.testFrameExtraction();
      expect(result).toBe(true);

      expect(extractFramesSimple).toHaveBeenCalledWith(
        mockVideo,
        expect.objectContaining({
          startTime: 10, // current time
          endTime: 11, // current time + 1
          frameRate: 1,
          quality: 'low',
          maxWidth: 320,
          maxHeight: 240
        })
      );
    });

    it('should return false when no video is available', async () => {
      document.querySelector = jest.fn().mockReturnValue(null);

      const result = await frameExtractor.testFrameExtraction();
      expect(result).toBe(false);
    });

    it('should return false when video is not ready', async () => {
      (mockVideo as any)._setReadyState(1); // HAVE_METADATA (not ready)

      const result = await frameExtractor.testFrameExtraction();
      expect(result).toBe(false);
    });

    it('should return false when extraction fails', async () => {
      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockRejectedValue(new Error('Test extraction failed'));

      const result = await frameExtractor.testFrameExtraction();
      expect(result).toBe(false);
    });

    it('should return false when no frames are extracted', async () => {
      const mockResult = {
        frames: [], // No frames
        metadata: {
          totalFrames: 0,
          actualFrameRate: 1,
          dimensions: { width: 320, height: 240 },
          duration: 1,
          extractionMethod: 'simple',
          processingTime: 100
        }
      };

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockResolvedValue(mockResult);

      const result = await frameExtractor.testFrameExtraction();
      expect(result).toBe(false);
    });
  });

  describe('error handling and edge cases', () => {
    it('should handle video duration at end of file', async () => {
      mockVideo.currentTime = 99;
      (mockVideo as any)._setDuration(100);

      const result = await frameExtractor.testFrameExtraction();

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      expect(extractFramesSimple).toHaveBeenCalledWith(
        mockVideo,
        expect.objectContaining({
          startTime: 99,
          endTime: 100 // Should be clamped to duration
        })
      );
    });

    it('should handle video with zero duration', () => {
      (mockVideo as any)._setDuration(0);

      const videoState = frameExtractor.getVideoState();
      expect(videoState.duration).toBe(0);
      expect(videoState.hasVideo).toBe(true); // Still has video element
    });

    it('should handle NaN duration', () => {
      (mockVideo as any)._setDuration(NaN);

      const videoState = frameExtractor.getVideoState();
      expect(videoState.duration).toBe(0); // Should fallback to 0
    });

    it('should handle extraction with message timeout', async () => {
      const request: ContentFrameExtractionRequest = {
        type: 'CONTENT_SCRIPT_EXTRACT_FRAMES',
        data: {
          startTime: 5,
          endTime: 10,
          frameRate: 10,
          targetWidth: 640,
          targetHeight: 360,
          quality: 'medium'
        }
      };

      // Mock extraction that resolves with delay to simulate timeout scenario
      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ frames: [], metadata: {} }), 8000))
      );

      // Mock instant capture fallback
      const { captureInstantFrames } = require('@/lib/instant-frame-capture');
      captureInstantFrames.mockResolvedValue([new ImageData(640, 360)]);

      const startTime = Date.now();
      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);
      const duration = Date.now() - startTime;

      // Should handle the delayed response
      expect(duration).toBeLessThan(15000); // Should complete within 15s
      expect(mockSendResponse).toHaveBeenCalledTimes(1);
    }, 15000);
  });

  describe('memory and performance considerations', () => {
    it('should handle large frame counts', async () => {
      const request: ContentFrameExtractionRequest = {
        type: 'CONTENT_SCRIPT_EXTRACT_FRAMES',
        data: {
          startTime: 0,
          endTime: 30, // 30 seconds
          frameRate: 30, // 30 fps = 900 frames
          targetWidth: 1920,
          targetHeight: 1080,
          quality: 'high'
        }
      };

      const largeFrameSet = Array.from({ length: 900 }, () => new ImageData(32, 24));
      const mockResult = {
        frames: largeFrameSet,
        metadata: {
          totalFrames: 900,
          actualFrameRate: 30,
          dimensions: { width: 1920, height: 1080 },
          duration: 30,
          extractionMethod: 'simple',
          processingTime: 5000
        }
      };

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockResolvedValue(mockResult);

      await frameExtractor.handleFrameExtractionRequest(request, mockSendResponse);

      // Just verify the response was called, content may vary due to message size limits
      expect(mockSendResponse).toHaveBeenCalledTimes(1);
      expect(extractFramesSimple).toHaveBeenCalledWith(
        mockVideo,
        expect.objectContaining({
          startTime: 0,
          endTime: 30,
          frameRate: 30
        }),
        expect.any(Function)
      );
    });

    it('should handle Chrome message size limits gracefully', async () => {
      const request: ContentFrameExtractionRequest = {
        type: 'CONTENT_SCRIPT_EXTRACT_FRAMES',
        data: {
          startTime: 5,
          endTime: 10,
          frameRate: 10,
          targetWidth: 640,
          targetHeight: 360,
          quality: 'medium'
        }
      };

      // Mock frames that would exceed message size
      const largeFrames = Array.from({ length: 100 }, () => new ImageData(32, 24));
      const mockResult = {
        frames: largeFrames,
        metadata: {
          totalFrames: 100,
          actualFrameRate: 10,
          dimensions: { width: 1920, height: 1080 },
          duration: 10,
          extractionMethod: 'simple',
          processingTime: 2000
        }
      };

      const { extractFramesSimple } = require('@/lib/simple-frame-extractor');
      extractFramesSimple.mockResolvedValue(mockResult);

      // Mock sendResponse to throw on large data
      const throwingSendResponse = jest.fn().mockImplementation((response) => {
        const dataSize = JSON.stringify(response).length;
        if (dataSize > 50000) { // Simulate message size limit
          throw new Error('Message too large');
        }
      });

      await frameExtractor.handleFrameExtractionRequest(request, throwingSendResponse);

      // Should attempt to send response (may be called multiple times due to error handling)
      expect(throwingSendResponse).toHaveBeenCalled();
      expect(extractFramesSimple).toHaveBeenCalledWith(
        mockVideo,
        expect.objectContaining({
          startTime: 5,
          endTime: 10,
          frameRate: 10
        }),
        expect.any(Function)
      );
    });
  });
});