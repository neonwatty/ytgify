import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { JSDOM } from 'jsdom';


// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('YouTubeDetector', () => {
  let YouTubeDetector: any;
  let youTubeDetector: any;
  let dom: JSDOM;
  let mockVideo: HTMLVideoElement;
  beforeEach(() => {
    // Mock timers to prevent hanging
    jest.useFakeTimers();

    // Setup DOM environment
    dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.youtube.com/watch?v=test123',
      pretendToBeVisual: true
    });

    global.document = dom.window.document as any;
    global.window = dom.window as any;
    global.HTMLMediaElement = dom.window.HTMLMediaElement as any;
    global.HTMLVideoElement = dom.window.HTMLVideoElement as any;
    global.Element = dom.window.Element as any;
    global.TimeRanges = dom.window.TimeRanges as any;

    // Mock MutationObserver with callback functionality
    let mutationObserverCallback: any = null;
    global.MutationObserver = jest.fn().mockImplementation((callback: any) => {
      mutationObserverCallback = callback;
      return {
        observe: jest.fn(),
        disconnect: jest.fn(() => {
          mutationObserverCallback = null;
        }),
        takeRecords: jest.fn().mockReturnValue([])
      };
    }) as any;

    // Helper to trigger mutation observer
    (global as any).triggerMutationObserver = () => {
      if (mutationObserverCallback) {
        // Create mock mutation records that would trigger video detection
        const mutations = [{
          target: document.body,
          type: 'childList',
          addedNodes: [mockVideo],
          removedNodes: [],
          attributeName: null,
          oldValue: null
        }];
        mutationObserverCallback(mutations as any, {} as MutationObserver);
      }
    };

    // Create mock video element
    mockVideo = document.createElement('video');
    Object.defineProperties(mockVideo, {
      src: { value: 'https://youtube.com/video.mp4', writable: true },
      currentSrc: { value: 'https://youtube.com/video.mp4', writable: true },
      duration: { value: 300, writable: true },
      currentTime: { value: 10, writable: true },
      paused: { value: false, writable: true },
      ended: { value: false, writable: true },
      volume: { value: 1, writable: true },
      playbackRate: { value: 1, writable: true },
      videoWidth: { value: 1920, writable: true },
      videoHeight: { value: 1080, writable: true },
      readyState: { value: 4, writable: true }, // HAVE_ENOUGH_DATA
      buffered: { value: { length: 0, start: () => 0, end: () => 0 }, writable: true },
      seekable: { value: { length: 0, start: () => 0, end: () => 0 }, writable: true }
    });

    // Mock getBoundingClientRect
    mockVideo.getBoundingClientRect = jest.fn(() => ({
      width: 640,
      height: 360,
      top: 100,
      left: 100,
      right: 740,
      bottom: 460,
      x: 100,
      y: 100,
      toJSON: () => ({})
    }));

    // Clear module cache and re-import
    jest.resetModules();
  });

  afterEach(() => {
    // Clean up detector instance
    if (youTubeDetector && youTubeDetector.destroy) {
      youTubeDetector.destroy();
    }

    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Singleton Instance', () => {
    it('should create a singleton instance', async () => {
      const module = await import('@/content/youtube-detector');
      YouTubeDetector = module.YouTubeDetector;

      const instance1 = YouTubeDetector.getInstance();
      const instance2 = YouTubeDetector.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe('Page Type Detection', () => {
    it('should detect watch page', async () => {
      // Reset modules before changing URL
      jest.resetModules();

      // Update the URL
      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/watch?v=abc123'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('watch');
      expect(state.videoId).toBe('abc123');
    });

    it('should detect shorts page', async () => {
      jest.resetModules();

      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/shorts/xyz789'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('shorts');
      expect(state.videoId).toBe('xyz789');
      expect(state.isShorts).toBe(true);
    });

    it('should detect channel page', async () => {
      jest.resetModules();

      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/@username'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('channel');
    });

    it('should detect home page', async () => {
      jest.resetModules();

      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('home');
    });

    it('should detect search results page', async () => {
      jest.resetModules();

      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/results?search_query=test'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('search');
    });

    it('should detect playlist page', async () => {
      jest.resetModules();

      Object.defineProperty(global.window, 'location', {
        value: new URL('https://www.youtube.com/playlist?list=PLtest123'),
        writable: true,
        configurable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const state = youTubeDetector.getCurrentState();
      expect(state.pageType).toBe('playlist');
    });
  });

  describe('Video Detection', () => {
    beforeEach(async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;
    });

    afterEach(() => {
      // Clean up DOM between tests
      document.body.innerHTML = '';
    });

    it('should detect video element', () => {
      document.body.appendChild(mockVideo);

      const video = youTubeDetector.getVideoElement();
      expect(video).toBe(mockVideo);
    });

    it('should return null when no video present', () => {
      const video = youTubeDetector.getVideoElement();
      expect(video).toBeNull();
    });

    it('should validate video element correctly', () => {
      document.body.appendChild(mockVideo);

      const video = youTubeDetector.getVideoElement();
      const isReady = youTubeDetector.isVideoReady(video);

      expect(isReady).toBe(true);
    });

    it('should not validate invalid video element', () => {
      const invalidVideo = document.createElement('video');
      Object.defineProperties(invalidVideo, {
        src: { value: '', writable: true },
        duration: { value: NaN, writable: true },
        readyState: { value: 0, writable: true }
      });

      const isReady = youTubeDetector.isVideoReady(invalidVideo);
      expect(isReady).toBe(false);
    });

    it('should wait for video element', async () => {
      const promise = youTubeDetector.waitForVideoElement(1000);

      // Add video after a delay
      jest.advanceTimersByTime(100);
      document.body.appendChild(mockVideo);

      // Trigger mutation observer to simulate DOM change detection
      (global as any).triggerMutationObserver();

      const video = await promise;
      expect(video).toBe(mockVideo);
    });

    it('should timeout when waiting for video', async () => {
      const promise = youTubeDetector.waitForVideoElement(100);

      // Advance timers to trigger timeout
      jest.advanceTimersByTime(101);

      const video = await promise;
      expect(video).toBeNull();
    });
  });

  describe('Navigation Detection', () => {
    beforeEach(async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;
    });

    it('should register navigation callbacks', () => {
      const callback = jest.fn();
      const unsubscribe = youTubeDetector.onNavigation(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should detect URL changes', async () => {
      const callback = jest.fn();
      youTubeDetector.onNavigation(callback);

      // Change URL manually and trigger detection
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=newvideo' },
        writable: true
      });

      // Advance timers for URL polling interval (500ms)
      jest.advanceTimersByTime(600);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          fromState: expect.any(Object),
          toState: expect.objectContaining({
            videoId: 'newvideo'
          }),
          timestamp: expect.any(Date),
          navigationType: 'spa'
        })
      );
    });

    it('should unsubscribe from navigation events', () => {
      const callback = jest.fn();
      const unsubscribe = youTubeDetector.onNavigation(callback);

      unsubscribe();

      // Change URL
      dom.reconfigure({ url: 'https://www.youtube.com/watch?v=another' });

      // Callback should not be called after unsubscribe
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Player State', () => {
    beforeEach(async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;
      document.body.appendChild(mockVideo);
    });

    afterEach(() => {
      // Clean up DOM between tests
      document.body.innerHTML = '';
    });

    it('should get player state', () => {
      const state = youTubeDetector.getPlayerState();

      expect(state).toEqual({
        isPlaying: true,
        isPaused: false,
        currentTime: 10,
        duration: 300,
        volume: 1,
        playbackRate: 1,
        buffered: expect.any(Object),
        seekable: expect.any(Object)
      });
    });

    it('should return null when no video', () => {
      // Clear all DOM content to ensure no video element
      document.body.innerHTML = '';

      const state = youTubeDetector.getPlayerState();
      expect(state).toBeNull();
    });

    it('should detect paused state', () => {
      Object.defineProperty(mockVideo, 'paused', { value: true });

      const state = youTubeDetector.getPlayerState();
      expect(state?.isPaused).toBe(true);
      expect(state?.isPlaying).toBe(false);
    });
  });

  describe('GIF Creation Checks', () => {
    beforeEach(async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;
    });

    it('should allow GIF creation on watch page with video', () => {
      document.body.appendChild(mockVideo);

      // Force a state update by triggering URL polling which calls handleNavigation
      // Change URL slightly to trigger state refresh
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=test123#newstate' },
        writable: true
      });

      // Advance timers for URL polling interval (500ms)
      jest.advanceTimersByTime(600);

      const canCreate = youTubeDetector.canCreateGif();
      expect(canCreate).toBe(true);
    });

    it('should not allow GIF creation on live streams', async () => {
      // Add live indicator before importing
      const liveElement = document.createElement('div');
      liveElement.className = 'ytp-live';
      document.body.appendChild(liveElement);
      document.body.appendChild(mockVideo);

      // Re-import to trigger new state detection
      jest.resetModules();
      const module = await import('@/content/youtube-detector');
      const detector = module.youTubeDetector;

      const canCreate = detector.canCreateGif();
      expect(canCreate).toBe(false);
    });

    it('should not allow GIF creation without video', () => {
      const canCreate = youTubeDetector.canCreateGif();
      expect(canCreate).toBe(false);
    });
  });

  describe('Player Container', () => {
    beforeEach(async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;
    });

    it('should find player container', () => {
      const container = document.createElement('div');
      container.id = 'movie_player';
      document.body.appendChild(container);

      const found = youTubeDetector.getPlayerContainer();
      expect(found).toBe(container);
    });

    it('should return null when no container', async () => {
      // Clean up any existing containers
      document.querySelectorAll('#movie_player').forEach(el => el.remove());

      // Re-import to ensure clean state
      jest.resetModules();
      const module = await import('@/content/youtube-detector');
      const detector = module.youTubeDetector;

      const container = detector.getPlayerContainer();
      expect(container).toBeNull();
    });
  });

  describe('Cleanup', () => {
    it('should clean up resources on destroy', async () => {
      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      const callback = jest.fn();
      youTubeDetector.onNavigation(callback);

      youTubeDetector.destroy();

      // Try to trigger navigation after destroy
      dom.reconfigure({ url: 'https://www.youtube.com/watch?v=test' });

      // Callback should not be called after destroy
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Shorts Detection', () => {
    it('should detect shorts correctly', async () => {
      // Reset modules and set up shorts URL before importing
      jest.resetModules();

      // Properly set the window location for shorts
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/shorts/abc123' },
        writable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      expect(youTubeDetector.isShorts()).toBe(true);
    });

    it('should not detect regular videos as shorts', async () => {
      // Reset modules and set up regular watch URL before importing
      jest.resetModules();

      // Properly set the window location for regular watch video
      Object.defineProperty(window, 'location', {
        value: { href: 'https://www.youtube.com/watch?v=abc123' },
        writable: true
      });

      const module = await import('@/content/youtube-detector');
      youTubeDetector = module.youTubeDetector;

      expect(youTubeDetector.isShorts()).toBe(false);
    });
  });
});