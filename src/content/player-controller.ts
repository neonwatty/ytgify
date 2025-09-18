import { logger } from '@/lib/logger';
import { youTubeAPI, YouTubeAPIIntegration } from './youtube-api-integration';
import { playerIntegration, PlayerSizeInfo } from './player-integration';
import { previewLoop, PreviewLoopState } from './preview-loop';
import { TimelineSelection } from '@/types';

interface PlayerControllerState {
  isPreviewActive: boolean;
  playerReady: boolean;
  playerSize: PlayerSizeInfo | null;
  currentSelection: TimelineSelection | null;
  originalPlaybackState: {
    time: number;
    state: number;
    volume: number;
    playbackRate: number;
  } | null;
}

type PlayerControllerCallback = (state: PlayerControllerState) => void;

export class PlayerController {
  private static instance: PlayerController;
  private state: PlayerControllerState = {
    isPreviewActive: false,
    playerReady: false,
    playerSize: null,
    currentSelection: null,
    originalPlaybackState: null
  };
  
  private callbacks: Set<PlayerControllerCallback> = new Set();
  private cleanupFunctions: Array<() => void> = [];

  private constructor() {
    this.setupIntegrations();
  }

  public static getInstance(): PlayerController {
    if (!PlayerController.instance) {
      PlayerController.instance = new PlayerController();
    }
    return PlayerController.instance;
  }

  private setupIntegrations(): void {
    // Setup YouTube API integration
    const unsubscribeAPI = youTubeAPI.onReady(() => {
      this.state.playerReady = true;
      this.notifyCallbacks();
      logger.info('[PlayerController] YouTube API ready');
    });
    this.cleanupFunctions.push(unsubscribeAPI);

    // Setup player integration callbacks
    const unsubscribePlayerSize = playerIntegration.onSizeChange((sizeInfo) => {
      this.state.playerSize = sizeInfo;
      this.notifyCallbacks();
      logger.debug('[PlayerController] Player size changed', { sizeInfo });
    });
    this.cleanupFunctions.push(unsubscribePlayerSize);

    // Setup preview loop callbacks
    const unsubscribePreviewLoop = previewLoop.onStateChange((previewState) => {
      this.handlePreviewStateChange(previewState);
    });
    this.cleanupFunctions.push(unsubscribePreviewLoop);

    // Monitor player state changes for additional control
    const unsubscribePlayerState = youTubeAPI.onStateChange((playerState) => {
      this.handlePlayerStateChange(playerState);
    });
    this.cleanupFunctions.push(unsubscribePlayerState);
  }

  private handlePreviewStateChange(previewState: PreviewLoopState): void {
    const wasActive = this.state.isPreviewActive;
    this.state.isPreviewActive = previewState.isActive;
    this.state.currentSelection = previewState.selection;

    // If preview just started, store original playback state
    if (previewState.isActive && !wasActive) {
      this.storeOriginalPlaybackState();
    }

    // If preview just stopped, clear original playback state
    if (!previewState.isActive && wasActive) {
      this.state.originalPlaybackState = null;
    }

    this.notifyCallbacks();
    
    logger.debug('[PlayerController] Preview state changed', {
      isActive: previewState.isActive,
      selection: previewState.selection
    });
  }

  private handlePlayerStateChange(playerState: number): void {
    // Handle player state changes for additional control logic
    switch (playerState) {
      case YouTubeAPIIntegration.PlayerState.PLAYING:
        if (this.state.isPreviewActive) {
          logger.debug('[PlayerController] Video playing during preview');
        }
        break;
        
      case YouTubeAPIIntegration.PlayerState.PAUSED:
        if (this.state.isPreviewActive) {
          logger.debug('[PlayerController] Video paused during preview');
        }
        break;
        
      case YouTubeAPIIntegration.PlayerState.ENDED:
        if (this.state.isPreviewActive) {
          logger.debug('[PlayerController] Video ended during preview - will be handled by preview loop');
        }
        break;
    }

    this.notifyCallbacks();
  }

  private storeOriginalPlaybackState(): void {
    if (!youTubeAPI.isReady()) {
      return;
    }

    try {
      const player = youTubeAPI.getPlayer();
      if (player) {
        this.state.originalPlaybackState = {
          time: youTubeAPI.getCurrentTime(),
          state: youTubeAPI.getPlayerState(),
          volume: player.getVolume(),
          playbackRate: player.getPlaybackRate()
        };

        logger.debug('[PlayerController] Stored original playback state', {
          originalState: this.state.originalPlaybackState
        });
      }
    } catch (error) {
      logger.error('[PlayerController] Failed to store original playback state', { error });
    }
  }

  public async startPreview(selection: TimelineSelection): Promise<boolean> {
    if (!this.state.playerReady) {
      logger.warn('[PlayerController] Cannot start preview - player not ready');
      return false;
    }

    try {
      logger.info('[PlayerController] Starting video preview', { selection });
      
      const success = await previewLoop.startPreview(selection);
      
      if (success) {
        // Set button state to active
        playerIntegration.setButtonState(true);
        logger.info('[PlayerController] Preview started successfully');
      } else {
        logger.error('[PlayerController] Failed to start preview');
      }

      return success;
    } catch (error) {
      logger.error('[PlayerController] Error starting preview', { error });
      return false;
    }
  }

  public async stopPreview(): Promise<boolean> {
    if (!this.state.isPreviewActive) {
      return true;
    }

    try {
      logger.info('[PlayerController] Stopping video preview');
      
      const success = await previewLoop.stopPreview();
      
      if (success) {
        // Set button state to inactive
        playerIntegration.setButtonState(false);
        logger.info('[PlayerController] Preview stopped successfully');
      } else {
        logger.error('[PlayerController] Failed to stop preview');
      }

      return success;
    } catch (error) {
      logger.error('[PlayerController] Error stopping preview', { error });
      return false;
    }
  }

  public async updatePreviewSelection(selection: TimelineSelection): Promise<boolean> {
    if (!this.state.isPreviewActive) {
      logger.warn('[PlayerController] Cannot update selection - preview not active');
      return false;
    }

    try {
      logger.info('[PlayerController] Updating preview selection', { selection });
      
      const success = await previewLoop.updateSelection(selection);
      
      if (success) {
        logger.info('[PlayerController] Preview selection updated successfully');
      } else {
        logger.error('[PlayerController] Failed to update preview selection');
      }

      return success;
    } catch (error) {
      logger.error('[PlayerController] Error updating preview selection', { error });
      return false;
    }
  }

  public togglePreview(selection?: TimelineSelection): Promise<boolean> {
    if (this.state.isPreviewActive) {
      return this.stopPreview();
    } else if (selection) {
      return this.startPreview(selection);
    } else {
      logger.warn('[PlayerController] Cannot start preview - no selection provided');
      return Promise.resolve(false);
    }
  }

  public isPreviewActive(): boolean {
    return this.state.isPreviewActive;
  }

  public isPlayerReady(): boolean {
    return this.state.playerReady;
  }

  public getCurrentSelection(): TimelineSelection | null {
    return this.state.currentSelection ? { ...this.state.currentSelection } : null;
  }

  public getPlayerSize(): PlayerSizeInfo | null {
    return this.state.playerSize ? { ...this.state.playerSize } : null;
  }

  public getOriginalPlaybackState(): PlayerControllerState['originalPlaybackState'] {
    return this.state.originalPlaybackState ? { ...this.state.originalPlaybackState } : null;
  }

  public async restoreOriginalPlaybackState(): Promise<boolean> {
    const originalState = this.state.originalPlaybackState;
    if (!originalState || !youTubeAPI.isReady()) {
      return false;
    }

    try {
      const player = youTubeAPI.getPlayer();
      if (!player) {
        return false;
      }

      // Restore position
      const seekSuccess = await youTubeAPI.seekTo(originalState.time);
      if (!seekSuccess) {
        logger.error('[PlayerController] Failed to restore original position');
        return false;
      }

      // Restore playback state
      if (originalState.state === YouTubeAPIIntegration.PlayerState.PLAYING) {
        await youTubeAPI.play();
      } else if (originalState.state === YouTubeAPIIntegration.PlayerState.PAUSED) {
        await youTubeAPI.pause();
      }

      // Restore volume and playback rate
      try {
        player.setVolume(originalState.volume);
        player.setPlaybackRate(originalState.playbackRate);
      } catch (error) {
        logger.warn('[PlayerController] Failed to restore volume/playback rate', { error });
      }

      logger.info('[PlayerController] Original playback state restored', { originalState });
      return true;

    } catch (error) {
      logger.error('[PlayerController] Error restoring original playback state', { error });
      return false;
    }
  }

  public onStateChange(callback: PlayerControllerCallback): () => void {
    this.callbacks.add(callback);
    
    // Call immediately with current state
    callback(this.getState());
    
    return () => {
      this.callbacks.delete(callback);
    };
  }

  private notifyCallbacks(): void {
    const currentState = this.getState();
    this.callbacks.forEach(callback => {
      try {
        callback(currentState);
      } catch (error) {
        logger.error('[PlayerController] Error in state change callback', { error });
      }
    });
  }

  private getState(): PlayerControllerState {
    return {
      isPreviewActive: this.state.isPreviewActive,
      playerReady: this.state.playerReady,
      playerSize: this.state.playerSize ? { ...this.state.playerSize } : null,
      currentSelection: this.state.currentSelection ? { ...this.state.currentSelection } : null,
      originalPlaybackState: this.state.originalPlaybackState ? { ...this.state.originalPlaybackState } : null
    };
  }

  public destroy(): void {
    // Stop any active preview
    if (this.state.isPreviewActive) {
      this.stopPreview();
    }

    // Clean up all subscriptions
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        logger.error('[PlayerController] Error during cleanup', { error });
      }
    });
    this.cleanupFunctions = [];

    // Clear callbacks
    this.callbacks.clear();

    // Reset state
    this.state = {
      isPreviewActive: false,
      playerReady: false,
      playerSize: null,
      currentSelection: null,
      originalPlaybackState: null
    };

    logger.info('[PlayerController] Destroyed');
  }
}

export const playerController = PlayerController.getInstance();