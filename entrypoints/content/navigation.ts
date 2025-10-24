// WXT-based YouTube navigation detection and page state management
import { MatchPattern } from 'wxt/sandbox';
import type { ContentScriptContext } from 'wxt/client';

export interface YouTubePageState {
  pageType: YouTubePageType;
  videoId: string | null;
  channelId: string | null;
  url: string;
  title: string;
  hasVideo: boolean;
  isLive: boolean;
  isShorts: boolean;
}

type YouTubePageType = 'watch' | 'channel' | 'search' | 'home' | 'shorts' | 'playlist' | 'unknown';

export interface YouTubeNavigationEvent {
  fromState: YouTubePageState;
  toState: YouTubePageState;
  timestamp: Date;
  navigationType: 'spa' | 'initial';
}

type NavigationCallback = (event: YouTubeNavigationEvent) => void;

export class WXTYouTubeNavigator {
  private currentState: YouTubePageState;
  private navigationCallbacks: Set<NavigationCallback> = new Set();
  private ctx: ContentScriptContext;
  private watchPagePattern = new MatchPattern('*://*.youtube.com/watch*');
  private shortsPagePattern = new MatchPattern('*://*.youtube.com/shorts/*');

  constructor(ctx: ContentScriptContext) {
    this.ctx = ctx;
    this.currentState = this.detectCurrentState();
    this.setupNavigationListener();
  }

  // Setup WXT's built-in SPA navigation listener
  private setupNavigationListener(): void {
    window.addEventListener('wxt:locationchange', (event) => {
      this.handleNavigation('spa');
    });

    console.log('[WXTYouTubeNavigator] Navigation listener initialized', {
      initialState: this.currentState
    });
  }

  // Get current page state
  public getCurrentState(): YouTubePageState {
    return { ...this.currentState };
  }

  // Force refresh the current state
  public refreshState(): void {
    const newState = this.detectCurrentState();
    if (this.hasStateChanged(this.currentState, newState)) {
      const oldState = this.currentState;
      this.currentState = newState;

      console.log('[WXTYouTubeNavigator] State refreshed', {
        oldState,
        newState,
        hasVideo: newState.hasVideo
      });

      const navigationEvent: YouTubeNavigationEvent = {
        fromState: oldState,
        toState: newState,
        timestamp: new Date(),
        navigationType: 'initial'
      };

      this.navigationCallbacks.forEach(callback => {
        try {
          callback(navigationEvent);
        } catch (error) {
          console.error('[WXTYouTubeNavigator] Error in refresh callback', error);
        }
      });
    }
  }

  // Register navigation callback
  public onNavigation(callback: NavigationCallback): () => void {
    this.navigationCallbacks.add(callback);

    return () => {
      this.navigationCallbacks.delete(callback);
    };
  }

  // Check if current page supports GIF creation
  public canCreateGif(): boolean {
    const hasVideo = this.hasVideoElement();
    const isLive = this.isLiveStream();
    return hasVideo && !isLive;
  }

  // Check if we're on a video watch page
  public isWatchPage(): boolean {
    return this.watchPagePattern.includes(window.location.href);
  }

  // Check if we're on YouTube Shorts
  public isShorts(): boolean {
    return this.shortsPagePattern.includes(window.location.href);
  }

  // Detect YouTube page type from URL
  private detectPageType(url: string): YouTubePageType {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    if (pathname.startsWith('/watch')) {
      return 'watch';
    } else if (pathname.startsWith('/shorts/')) {
      return 'shorts';
    } else if (pathname.startsWith('/channel/') || pathname.startsWith('/c/') || pathname.startsWith('/@')) {
      return 'channel';
    } else if (pathname.startsWith('/playlist')) {
      return 'playlist';
    } else if (pathname.startsWith('/results')) {
      return 'search';
    } else if (pathname === '/' || pathname.startsWith('/feed/')) {
      return 'home';
    }

    return 'unknown';
  }

  // Extract video ID from URL
  private extractVideoId(url: string): string | null {
    const urlObj = new URL(url);

    const videoIdParam = urlObj.searchParams.get('v');
    if (videoIdParam) {
      return videoIdParam;
    }

    const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
    if (shortsMatch) {
      return shortsMatch[1];
    }

    const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]+)/);
    if (embedMatch) {
      return embedMatch[1];
    }

    return null;
  }

  // Extract channel ID from page
  private extractChannelId(): string | null {
    const channelLink = document.querySelector('link[itemprop="url"]') as HTMLLinkElement;
    if (channelLink) {
      const match = channelLink.href.match(/\/channel\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }

    const channelIdMeta = document.querySelector('meta[property="og:url"]') as HTMLMetaElement;
    if (channelIdMeta) {
      const match = channelIdMeta.content.match(/\/channel\/([a-zA-Z0-9_-]+)/);
      if (match) return match[1];
    }

    return null;
  }

  // Check if page has video element
  private hasVideoElement(): boolean {
    const video = document.querySelector('video');
    if (!video) return false;

    const hasSource = !!(video.src || video.currentSrc);
    const hasDuration = !isNaN(video.duration) && video.duration > 0;

    return hasSource || hasDuration;
  }

  // Check if video is live stream
  private isLiveStream(): boolean {
    const liveBadge = document.querySelector('.ytp-live-badge') as HTMLElement;
    if (liveBadge) {
      const isVisible = liveBadge.offsetParent !== null && window.getComputedStyle(liveBadge).display !== 'none';
      const hasLiveText = liveBadge.textContent?.toLowerCase().includes('live');
      if (isVisible && hasLiveText) return true;
    }

    const video = document.querySelector('video') as HTMLVideoElement;
    if (video && video.duration === Infinity) {
      return true;
    }

    const strongIndicators = [
      '.ytp-live',
      '[data-is-live="true"]',
      '.live-badge:not(.ytp-live-badge)'
    ];

    return strongIndicators.some(selector => {
      const element = document.querySelector(selector) as HTMLElement;
      return element && element.offsetParent !== null;
    });
  }

  // Detect current page state
  private detectCurrentState(): YouTubePageState {
    const url = window.location.href;
    const pageType = this.detectPageType(url);
    const videoId = this.extractVideoId(url);
    const channelId = this.extractChannelId();
    const hasVideo = this.hasVideoElement();
    const isLive = this.isLiveStream();
    const isShorts = pageType === 'shorts';

    return {
      pageType,
      videoId,
      channelId,
      url,
      title: document.title,
      hasVideo,
      isLive,
      isShorts
    };
  }

  // Handle navigation event
  private handleNavigation(navigationType: 'spa' | 'initial'): void {
    const previousState = { ...this.currentState };
    const newState = this.detectCurrentState();

    if (this.hasStateChanged(previousState, newState)) {
      this.currentState = newState;

      const navigationEvent: YouTubeNavigationEvent = {
        fromState: previousState,
        toState: newState,
        timestamp: new Date(),
        navigationType
      };

      console.log('[WXTYouTubeNavigator] Navigation detected', {
        from: previousState.pageType,
        to: newState.pageType,
        videoId: newState.videoId,
        type: navigationType
      });

      this.navigationCallbacks.forEach(callback => {
        try {
          callback(navigationEvent);
        } catch (error) {
          console.error('[WXTYouTubeNavigator] Error in navigation callback', error);
        }
      });
    }
  }

  // Check if two states are significantly different
  private hasStateChanged(oldState: YouTubePageState, newState: YouTubePageState): boolean {
    return (
      oldState.pageType !== newState.pageType ||
      oldState.videoId !== newState.videoId ||
      oldState.hasVideo !== newState.hasVideo ||
      oldState.isLive !== newState.isLive ||
      oldState.url !== newState.url
    );
  }

  // Get video element if available
  public getVideoElement(): HTMLVideoElement | null {
    const selectors = [
      'video.video-stream.html5-main-video',
      'video.html5-main-video',
      '#movie_player video',
      '.html5-video-container video',
      'ytd-player video',
      'div#player video',
      'ytd-shorts video',
      'ytd-shorts-player video',
      '.ytd-shorts video',
      '.shorts-video-container video',
      '#shorts-player video',
      '.ytd-reel-video-renderer video',
      '.ytd-watch-flexy video',
      'ytd-video-primary-info-renderer video',
      'video'
    ];

    for (const selector of selectors) {
      const video = document.querySelector(selector) as HTMLVideoElement;
      if (video && this.isValidVideoElement(video)) {
        return video;
      }
    }

    return null;
  }

  // Validate video element
  private isValidVideoElement(video: HTMLVideoElement): boolean {
    if (!video.src && !video.currentSrc) {
      return false;
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return false;
    }

    const src = video.src || video.currentSrc;
    if (src.includes('maxresdefault') || src.includes('hqdefault') ||
        src.includes('thumbnail') || src.includes('vi.jpg')) {
      return false;
    }

    const rect = video.getBoundingClientRect();
    if (rect.width < 100 || rect.height < 100) {
      return false;
    }

    return true;
  }

  // Wait for video element to be available
  public async waitForVideoElement(timeout = 5000): Promise<HTMLVideoElement | null> {
    return new Promise((resolve) => {
      const video = this.getVideoElement();
      if (video && this.isVideoReady(video)) {
        resolve(video);
        return;
      }

      const timeoutId = setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);

      const observer = new MutationObserver(() => {
        const foundVideo = this.getVideoElement();
        if (foundVideo && this.isVideoReady(foundVideo)) {
          clearTimeout(timeoutId);
          observer.disconnect();
          resolve(foundVideo);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  }

  // Check if video element is ready
  public isVideoReady(video: HTMLVideoElement): boolean {
    const hasSource = !!(video.src || video.currentSrc);

    return hasSource &&
           video.readyState >= HTMLMediaElement.HAVE_METADATA &&
           video.duration > 0 &&
           !isNaN(video.duration);
  }

  // Get current player state
  public getPlayerState(): {
    isPlaying: boolean;
    isPaused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    playbackRate: number;
    buffered: TimeRanges | null;
    seekable: TimeRanges | null;
  } | null {
    const video = this.getVideoElement();
    if (!video || !this.isVideoReady(video)) {
      return null;
    }

    return {
      isPlaying: !video.paused && !video.ended,
      isPaused: video.paused,
      currentTime: video.currentTime,
      duration: video.duration,
      volume: video.volume,
      playbackRate: video.playbackRate,
      buffered: video.buffered,
      seekable: video.seekable
    };
  }

  // Get player container element
  public getPlayerContainer(): HTMLElement | null {
    const selectors = [
      '#movie_player',
      '.html5-video-container',
      '.video-player-container',
      '#player-container'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector) as HTMLElement;
      if (container) {
        return container;
      }
    }

    return null;
  }

  // Clean up resources
  public destroy(): void {
    this.navigationCallbacks.clear();
    console.log('[WXTYouTubeNavigator] Destroyed');
  }
}
