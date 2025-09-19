// YouTube IFrame API integration for enhanced player control
import { logger } from '@/lib/logger';

interface YouTubePlayerAPI {
  Player: new (elementId: string | HTMLElement, config: YouTubePlayerConfig) => YouTubePlayer;
}

interface YouTubePlayerConfig {
  events?: {
    onReady?: () => void;
    onStateChange?: (event: YouTubePlayerStateChangeEvent) => void;
  };
}

interface YouTubePlayerStateChangeEvent {
  data: number;
}

declare global {
  interface Window {
    YT: YouTubePlayerAPI;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface YouTubePlayerState {
  UNSTARTED: -1;
  ENDED: 0;
  PLAYING: 1;
  PAUSED: 2;
  BUFFERING: 3;
  CUED: 5;
}

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead?: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  getPlaybackRate(): number;
  setPlaybackRate(rate: number): void;
  getVideoUrl(): string;
  addEventListener(event: string, listener: (event: YouTubePlayerStateChangeEvent) => void): void;
  removeEventListener(event: string, listener: (event: YouTubePlayerStateChangeEvent) => void): void;
  destroy(): void;
}

type PlayerStateChangeCallback = (state: number) => void;
type PlayerReadyCallback = (player: YouTubePlayer) => void;

export class YouTubeAPIIntegration {
  private static instance: YouTubeAPIIntegration;
  private player: YouTubePlayer | null = null;
  private isAPILoaded = false;
  private isPlayerReady = false;
  private readyCallbacks: Set<PlayerReadyCallback> = new Set();
  private stateChangeCallbacks: Set<PlayerStateChangeCallback> = new Set();
  private retryCount = 0;
  private maxRetries = 5;

  public static readonly PlayerState: YouTubePlayerState = {
    UNSTARTED: -1,
    ENDED: 0,
    PLAYING: 1,
    PAUSED: 2,
    BUFFERING: 3,
    CUED: 5
  };

  private constructor() {
    this.initializeAPI();
  }

  public static getInstance(): YouTubeAPIIntegration {
    if (!YouTubeAPIIntegration.instance) {
      YouTubeAPIIntegration.instance = new YouTubeAPIIntegration();
    }
    return YouTubeAPIIntegration.instance;
  }

  // Initialize YouTube IFrame API
  private async initializeAPI(): Promise<void> {
    try {
      // Check if API is already loaded
      if (window.YT && window.YT.Player) {
        this.isAPILoaded = true;
        this.connectToExistingPlayer();
        return;
      }

      // Don't try to load external scripts in content script due to CSP
      // Instead, wait for YouTube's own API to be available or use fallback
      if (typeof window !== 'undefined' && window.location.hostname.includes('youtube.com')) {
        logger.debug('[YouTubeAPI] Waiting for YouTube\'s native API to load');
        this.waitForNativeAPI();
      } else {
        logger.warn('[YouTubeAPI] Not on YouTube domain, skipping API initialization');
      }
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to initialize API', { error });
    }
  }

  private waitForNativeAPI(): void {
    // Check periodically if YouTube's API becomes available
    const checkForAPI = () => {
      if (window.YT && window.YT.Player) {
        this.isAPILoaded = true;
        this.connectToExistingPlayer();
        logger.info('[YouTubeAPI] Found YouTube\'s native API');
        return;
      }

      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        setTimeout(checkForAPI, 1000);
      } else {
        logger.warn('[YouTubeAPI] YouTube API not available, will use direct video element access');
      }
    };

    checkForAPI();
  }

  // Schedule connection attempt with retry logic
  private schedulePlayerConnection(): void {
    if (this.retryCount >= this.maxRetries) {
      logger.warn('[YouTubeAPI] Max retry attempts reached');
      return;
    }

    const delay = Math.pow(2, this.retryCount) * 1000;
    this.retryCount++;

    setTimeout(() => {
      this.connectToExistingPlayer();
    }, delay);
  }

  // Connect to existing YouTube player on page
  private async connectToExistingPlayer(): Promise<void> {
    if (!this.isAPILoaded || !window.YT || !window.YT.Player) {
      this.schedulePlayerConnection();
      return;
    }

    try {
      // Find existing player iframe
      const playerIframe = document.querySelector('iframe#movie_player') as HTMLIFrameElement;
      
      if (playerIframe) {
        // Create player instance from existing iframe
        this.player = new window.YT.Player(playerIframe, {
          events: {
            onReady: this.handlePlayerReady.bind(this),
            onStateChange: this.handleStateChange.bind(this)
          }
        });

        logger.info('[YouTubeAPI] Connected to existing player');
      } else {
        // No player found, schedule retry
        this.schedulePlayerConnection();
      }
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to connect to player', { error });
      this.schedulePlayerConnection();
    }
  }

  // Handle player ready event
  private handlePlayerReady(): void {
    this.isPlayerReady = true;
    this.retryCount = 0; // Reset retry counter on success
    
    logger.info('[YouTubeAPI] Player ready');

    // Notify all ready callbacks
    this.readyCallbacks.forEach(callback => {
      try {
        if (this.player) {
          callback(this.player);
        }
      } catch (error) {
        logger.error('[YouTubeAPI] Error in ready callback', { error });
      }
    });
  }

  // Handle player state change events
  private handleStateChange(event: YouTubePlayerStateChangeEvent): void {
    const state = event.data;
    
    logger.debug('[YouTubeAPI] Player state changed', { 
      state, 
      stateName: this.getStateString(state) 
    });

    // Notify all state change callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(state);
      } catch (error) {
        logger.error('[YouTubeAPI] Error in state change callback', { error });
      }
    });
  }

  // Convert state number to readable string
  private getStateString(state: number): string {
    switch (state) {
      case YouTubeAPIIntegration.PlayerState.UNSTARTED: return 'UNSTARTED';
      case YouTubeAPIIntegration.PlayerState.ENDED: return 'ENDED';
      case YouTubeAPIIntegration.PlayerState.PLAYING: return 'PLAYING';
      case YouTubeAPIIntegration.PlayerState.PAUSED: return 'PAUSED';
      case YouTubeAPIIntegration.PlayerState.BUFFERING: return 'BUFFERING';
      case YouTubeAPIIntegration.PlayerState.CUED: return 'CUED';
      default: return 'UNKNOWN';
    }
  }

  // Public API methods
  public isReady(): boolean {
    return this.isPlayerReady && this.player !== null;
  }

  public getPlayer(): YouTubePlayer | null {
    return this.player;
  }

  public onReady(callback: PlayerReadyCallback): () => void {
    this.readyCallbacks.add(callback);
    
    // If already ready, call immediately
    if (this.isReady() && this.player) {
      try {
        callback(this.player);
      } catch (error) {
        logger.error('[YouTubeAPI] Error in immediate ready callback', { error });
      }
    }

    // Return unsubscribe function
    return () => {
      this.readyCallbacks.delete(callback);
    };
  }

  public onStateChange(callback: PlayerStateChangeCallback): () => void {
    this.stateChangeCallbacks.add(callback);

    // Return unsubscribe function
    return () => {
      this.stateChangeCallbacks.delete(callback);
    };
  }

  // Player control methods with safety checks
  public async seekTo(seconds: number): Promise<boolean> {
    if (!this.isReady() || !this.player) {
      logger.warn('[YouTubeAPI] Cannot seek - player not ready');
      return false;
    }

    try {
      this.player.seekTo(seconds, true);
      return true;
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to seek', { error, seconds });
      return false;
    }
  }

  public async pause(): Promise<boolean> {
    if (!this.isReady() || !this.player) {
      return false;
    }

    try {
      this.player.pauseVideo();
      return true;
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to pause', { error });
      return false;
    }
  }

  public async play(): Promise<boolean> {
    if (!this.isReady() || !this.player) {
      return false;
    }

    try {
      this.player.playVideo();
      return true;
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to play', { error });
      return false;
    }
  }

  public getCurrentTime(): number {
    if (!this.isReady() || !this.player) {
      return 0;
    }

    try {
      return this.player.getCurrentTime();
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to get current time', { error });
      return 0;
    }
  }

  public getDuration(): number {
    if (!this.isReady() || !this.player) {
      return 0;
    }

    try {
      return this.player.getDuration();
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to get duration', { error });
      return 0;
    }
  }

  public getPlayerState(): number {
    if (!this.isReady() || !this.player) {
      return YouTubeAPIIntegration.PlayerState.UNSTARTED;
    }

    try {
      return this.player.getPlayerState();
    } catch (error) {
      logger.error('[YouTubeAPI] Failed to get player state', { error });
      return YouTubeAPIIntegration.PlayerState.UNSTARTED;
    }
  }

  // Clean up resources
  public destroy(): void {
    if (this.player) {
      try {
        this.player.destroy();
      } catch (error) {
        logger.error('[YouTubeAPI] Error destroying player', { error });
      }
    }

    this.player = null;
    this.isPlayerReady = false;
    this.readyCallbacks.clear();
    this.stateChangeCallbacks.clear();

    logger.info('[YouTubeAPI] Destroyed');
  }
}

// Export singleton instance
export const youTubeAPI = YouTubeAPIIntegration.getInstance();