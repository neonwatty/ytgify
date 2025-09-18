import { logger } from '@/lib/logger';
import { youTubeAPI, YouTubeAPIIntegration } from './youtube-api-integration';
import { TimelineSelection } from '@/types';

export interface PreviewLoopState {
  isActive: boolean;
  selection: TimelineSelection | null;
  originalTime: number;
  originalState: number;
  loopInterval: NodeJS.Timeout | null;
}

type PreviewLoopCallback = (state: PreviewLoopState) => void;

export class VideoPreviewLoop {
  private static instance: VideoPreviewLoop;
  private state: PreviewLoopState = {
    isActive: false,
    selection: null,
    originalTime: 0,
    originalState: YouTubeAPIIntegration.PlayerState.UNSTARTED,
    loopInterval: null
  };
  
  private callbacks: Set<PreviewLoopCallback> = new Set();
  private stateChangeUnsubscribe: (() => void) | null = null;
  private isListeningToPlayer = false;

  private constructor() {
    this.setupPlayerIntegration();
  }

  public static getInstance(): VideoPreviewLoop {
    if (!VideoPreviewLoop.instance) {
      VideoPreviewLoop.instance = new VideoPreviewLoop();
    }
    return VideoPreviewLoop.instance;
  }

  private setupPlayerIntegration(): void {
    youTubeAPI.onReady(() => {
      this.isListeningToPlayer = true;
      logger.debug('[PreviewLoop] YouTube player ready for preview control');
    });
  }

  public startPreview(selection: TimelineSelection): Promise<boolean> {
    return new Promise((resolve) => {
      if (!youTubeAPI.isReady()) {
        logger.warn('[PreviewLoop] Cannot start preview - YouTube API not ready');
        resolve(false);
        return;
      }

      if (this.state.isActive) {
        this.stopPreview();
      }

      try {
        // Store original player state
        this.state.originalTime = youTubeAPI.getCurrentTime();
        this.state.originalState = youTubeAPI.getPlayerState();
        this.state.selection = { ...selection };

        logger.info('[PreviewLoop] Starting preview', {
          selection,
          originalTime: this.state.originalTime,
          originalState: this.state.originalState
        });

        // Seek to start of selection
        youTubeAPI.seekTo(selection.startTime).then((seekSuccess) => {
          if (!seekSuccess) {
            logger.error('[PreviewLoop] Failed to seek to preview start');
            resolve(false);
            return;
          }

          // Start looping
          this.state.isActive = true;
          this.startLoop();
          this.setupLoopStateMonitoring();
          
          this.notifyCallbacks();
          resolve(true);
        });

      } catch (error) {
        logger.error('[PreviewLoop] Error starting preview', { error });
        resolve(false);
      }
    });
  }

  public stopPreview(): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.state.isActive) {
        resolve(true);
        return;
      }

      try {
        logger.info('[PreviewLoop] Stopping preview', {
          originalTime: this.state.originalTime,
          originalState: this.state.originalState
        });

        // Clear loop interval
        if (this.state.loopInterval) {
          clearInterval(this.state.loopInterval);
          this.state.loopInterval = null;
        }

        // Stop listening to player state changes
        if (this.stateChangeUnsubscribe) {
          this.stateChangeUnsubscribe();
          this.stateChangeUnsubscribe = null;
        }

        // Restore original player state
        youTubeAPI.seekTo(this.state.originalTime).then((seekSuccess) => {
          if (seekSuccess) {
            // Restore original playback state
            if (this.state.originalState === YouTubeAPIIntegration.PlayerState.PLAYING) {
              youTubeAPI.play();
            } else if (this.state.originalState === YouTubeAPIIntegration.PlayerState.PAUSED) {
              youTubeAPI.pause();
            }
          } else {
            logger.warn('[PreviewLoop] Failed to restore original position');
          }

          // Reset state
          this.state.isActive = false;
          this.state.selection = null;
          this.state.originalTime = 0;
          this.state.originalState = YouTubeAPIIntegration.PlayerState.UNSTARTED;

          this.notifyCallbacks();
          resolve(true);
        });

      } catch (error) {
        logger.error('[PreviewLoop] Error stopping preview', { error });
        
        // Force reset state even on error
        this.state.isActive = false;
        this.state.selection = null;
        this.notifyCallbacks();
        resolve(false);
      }
    });
  }

  public isActive(): boolean {
    return this.state.isActive;
  }

  public getCurrentSelection(): TimelineSelection | null {
    return this.state.selection ? { ...this.state.selection } : null;
  }

  public updateSelection(selection: TimelineSelection): Promise<boolean> {
    if (!this.state.isActive) {
      logger.warn('[PreviewLoop] Cannot update selection - preview not active');
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      this.state.selection = { ...selection };
      
      // Restart loop with new selection
      if (this.state.loopInterval) {
        clearInterval(this.state.loopInterval);
        this.state.loopInterval = null;
      }

      youTubeAPI.seekTo(selection.startTime).then((seekSuccess) => {
        if (seekSuccess) {
          this.startLoop();
          this.notifyCallbacks();
          resolve(true);
        } else {
          logger.error('[PreviewLoop] Failed to seek to updated selection start');
          resolve(false);
        }
      });
    });
  }

  public onStateChange(callback: PreviewLoopCallback): () => void {
    this.callbacks.add(callback);
    
    // Call immediately with current state
    callback(this.getState());
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private startLoop(): void {
    if (!this.state.selection || !this.state.isActive) {
      return;
    }

    const selection = this.state.selection;
    const checkInterval = 100; // Check every 100ms

    this.state.loopInterval = setInterval(() => {
      if (!this.state.isActive || !youTubeAPI.isReady()) {
        return;
      }

      const currentTime = youTubeAPI.getCurrentTime();
      
      // If we've reached or passed the end time, loop back to start
      if (currentTime >= selection.endTime) {
        youTubeAPI.seekTo(selection.startTime);
        logger.debug('[PreviewLoop] Looped back to start', {
          from: currentTime,
          to: selection.startTime
        });
      }
    }, checkInterval);

    logger.debug('[PreviewLoop] Loop started', { selection, checkInterval });
  }

  private setupLoopStateMonitoring(): void {
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
    }

    this.stateChangeUnsubscribe = youTubeAPI.onStateChange((playerState) => {
      if (!this.state.isActive) {
        return;
      }

      // Handle player state changes during preview
      switch (playerState) {
        case YouTubeAPIIntegration.PlayerState.ENDED:
          // Video ended during preview - loop back to start
          if (this.state.selection) {
            youTubeAPI.seekTo(this.state.selection.startTime);
            youTubeAPI.play();
          }
          break;
          
        case YouTubeAPIIntegration.PlayerState.PAUSED:
          // User paused during preview - maintain preview but respect pause
          logger.debug('[PreviewLoop] Player paused during preview');
          break;
          
        case YouTubeAPIIntegration.PlayerState.BUFFERING:
          // Handle buffering during preview
          logger.debug('[PreviewLoop] Player buffering during preview');
          break;
      }

      this.notifyCallbacks();
    });
  }

  private notifyCallbacks(): void {
    const currentState = this.getState();
    this.callbacks.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        logger.error('[PreviewLoop] Error in state change callback', { error });
      }
    });
  }

  private getState(): PreviewLoopState {
    return {
      isActive: this.state.isActive,
      selection: this.state.selection ? { ...this.state.selection } : null,
      originalTime: this.state.originalTime,
      originalState: this.state.originalState,
      loopInterval: this.state.loopInterval
    };
  }

  public destroy(): void {
    this.stopPreview();
    this.callbacks.clear();
    
    if (this.stateChangeUnsubscribe) {
      this.stateChangeUnsubscribe();
      this.stateChangeUnsubscribe = null;
    }

    logger.info('[PreviewLoop] Destroyed');
  }
}

export const previewLoop = VideoPreviewLoop.getInstance();