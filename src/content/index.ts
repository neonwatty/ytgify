import './styles.css';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { 
  ExtensionMessage,
  GetVideoStateRequest,
  ShowTimelineRequest,
  HideTimelineRequest,
  TimelineSelectionUpdate,
  LogMessage,
  TimelineSelection
} from '@/types';
import { youTubeDetector, YouTubeNavigationEvent } from './youtube-detector';
import { injectionManager } from './injection-manager';
import { extensionStateManager } from '@/shared';
import { youTubeAPI, YouTubeAPIIntegration } from './youtube-api-integration';
import { playerIntegration } from './player-integration';
import { playerController } from './player-controller';
import { TimelineOverlay } from './timeline-overlay';
import { overlayStateManager } from './overlay-state';
import { cleanupManager } from './cleanup-manager';
import { initializeContentScriptFrameExtraction } from './frame-extractor';
import { themeDetector, youtubeMatcher } from '@/themes';

class YouTubeGifMaker {
  private gifButton: HTMLButtonElement | null = null;
  private timelineOverlay: HTMLDivElement | null = null;
  private timelineRoot: Root | null = null;
  private isActive = false;
  private isCreatingGif = false;
  private currentSelection: TimelineSelection | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private navigationUnsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.setupMessageListener();
    this.setupNavigationListener();
    this.setupOverlayStateListeners();
    this.setupCleanupManager();
    this.setupThemeSystem();
    this.setupInjectionSystem();
    this.setupFrameExtraction();
    this.findVideoElement();
  }

  // Setup theme system for automatic YouTube theme matching
  private setupThemeSystem() {
    // Initialize theme detection and YouTube matching
    themeDetector.getCurrentTheme();
    youtubeMatcher.getCurrentMapping();
    
    // Sync theme transitions with YouTube
    youtubeMatcher.syncWithYouTubeTransitions();
    
    this.log('debug', '[Content] Theme system initialized', {
      currentTheme: themeDetector.getCurrentTheme(),
      themeMapping: youtubeMatcher.getCurrentMapping()
    });
  }

  // Setup frame extraction for WebCodecs integration
  private setupFrameExtraction() {
    // Initialize content script frame extraction capability
    initializeContentScriptFrameExtraction();
    this.log('debug', '[Content] Frame extraction initialized');
  }

  // Setup message listener for communication with background script
  private setupMessageListener() {
    chrome.runtime.onMessage.addListener((
      message: ExtensionMessage, 
      sender: chrome.runtime.MessageSender, 
      sendResponse: (response: ExtensionMessage) => void
    ) => {
      this.log('debug', `[Content] Received message: ${message.type}`, { message });

      switch (message.type) {
        case 'SHOW_TIMELINE':
          this.showTimelineOverlay(message as ShowTimelineRequest);
          break;
        case 'HIDE_TIMELINE':
          this.hideTimelineOverlay();
          break;
        case 'GET_VIDEO_STATE':
          this.handleGetVideoState(message as GetVideoStateRequest, sendResponse);
          return true; // Async response
      }

      return false;
    });
  }

  // Setup navigation listener for YouTube SPA changes
  private setupNavigationListener() {
    this.navigationUnsubscribe = youTubeDetector.onNavigation(async (event: YouTubeNavigationEvent) => {
      this.log('info', '[Content] YouTube navigation detected', {
        from: event.fromState.pageType,
        to: event.toState.pageType,
        canCreateGif: youTubeDetector.canCreateGif()
      });

      // Update extension state with YouTube page information
      const isYouTubePage = event.toState.pageType === 'watch' || event.toState.pageType === 'shorts';
      await extensionStateManager.updateYouTubePage(
        isYouTubePage,
        event.toState.videoId || undefined,
        document.title
      );

      // Update video element reference on navigation
      this.findVideoElement();

      // Handle GIF mode state during navigation
      if (this.isActive && !youTubeDetector.canCreateGif()) {
        this.log('info', '[Content] Deactivating GIF mode - page no longer supports GIF creation');
        this.deactivateGifMode();
      }
    });
  }

  // Setup overlay state manager listeners
  private setupOverlayStateListeners() {
    // Listen to overlay state changes to sync with local state
    overlayStateManager.on('mode-changed', (event) => {
      const wasActive = this.isActive;
      this.isActive = event.newState.mode !== 'inactive';
      
      // Sync with local state if there's a mismatch
      if (wasActive !== this.isActive) {
        this.log('debug', '[Content] Syncing overlay state with local state', {
          wasActive,
          isActive: this.isActive,
          mode: event.newState.mode
        });
      }
    });

    // Listen to selection changes
    overlayStateManager.on('selection-changed', (event) => {
      this.currentSelection = event.newState.currentSelection;
      this.log('debug', '[Content] Selection synced from overlay state', {
        selection: this.currentSelection
      });
    });

    // Listen to creating state changes
    overlayStateManager.on('state-updated', (event) => {
      if (event.newState.isCreatingGif !== event.oldState.isCreatingGif) {
        this.isCreatingGif = event.newState.isCreatingGif;
        this.log('debug', '[Content] Creating state synced from overlay state', {
          isCreatingGif: this.isCreatingGif
        });
      }
    });

    // Listen to overlay activation/deactivation
    overlayStateManager.on('activated', (event) => {
      this.log('info', '[Content] Overlay state activated', { mode: event.newState.mode });
    });

    overlayStateManager.on('deactivated', (_event) => {
      this.log('info', '[Content] Overlay state deactivated');
    });
  }

  // Setup cleanup manager
  private setupCleanupManager() {
    // Register navigation listener for cleanup coordination
    cleanupManager.addNavigationListener((navigationEvent) => {
      this.log('debug', '[Content] Navigation event from cleanup manager', { 
        from: navigationEvent.from,
        to: navigationEvent.to,
        videoId: navigationEvent.videoId,
        timestamp: navigationEvent.timestamp
      });
      
      // Update overlay state manager with navigation info
      overlayStateManager.handleNavigation(navigationEvent.to, navigationEvent.videoId);
      
      // Clear local references if navigating away from video page
      if (navigationEvent.to !== 'watch' && navigationEvent.to !== 'shorts') {
        this.videoElement = null;
        this.currentSelection = null;
      }
    });

    // Register custom cleanup tasks for YouTubeGifMaker
    cleanupManager.registerCleanupTask({
      id: 'youtube-gif-maker-cleanup',
      name: 'YouTube GIF Maker Cleanup',
      priority: 95,
      cleanup: async () => {
        this.log('debug', '[Content] Running YouTube GIF Maker cleanup');
        
        // Stop any preview that might be running
        if (playerController.isPreviewActive()) {
          try {
            await playerController.stopPreview();
          } catch (error) {
            this.log('warn', '[Content] Error stopping preview during cleanup', { error });
          }
        }
        
        // Reset local state
        this.isActive = false;
        this.isCreatingGif = false;
        this.currentSelection = null;
        
        // Clean up timeline overlay if it exists and isn't managed by overlay state
        if (this.timelineOverlay && this.timelineOverlay.parentNode) {
          this.hideTimelineOverlay();
        }
      }
    });
  }

  // Setup enhanced button injection system
  private setupInjectionSystem() {
    // Use the new player integration system for better button positioning
    const injected = playerIntegration.injectButton((event) => {
      event.preventDefault();
      this.handleGifButtonClick();
    });

    if (injected) {
      // Set up state change listeners
      playerIntegration.onStateChange((isActive, playerInfo) => {
        this.log('debug', '[Content] Button state changed', { isActive, playerInfo });
      });

      playerIntegration.onSizeChange((sizeInfo) => {
        this.log('debug', '[Content] Player size changed', { sizeInfo });
        // Update timeline overlay positioning if needed
        if (this.timelineOverlay) {
          this.adaptOverlayToPlayerState();
        }
      });

      this.log('info', '[Content] Enhanced button injection successful');
    } else {
      // Fallback to original injection system
      this.log('warn', '[Content] Enhanced button injection failed, using fallback');
      this.setupFallbackInjection();
    }
  }

  // Fallback injection system (original approach)
  private setupFallbackInjection() {
    injectionManager.createButtonInjection('ytgif-button', {
      selector: '.ytp-right-controls',
      pageTypes: ['watch', 'shorts'],
      buttonClass: 'ytp-button ytgif-button',
      position: 'prepend',
      content: `
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <rect x="6" y="10" width="24" height="16" rx="2" ry="2" fill="currentColor" fill-opacity="0.3"/>
          <rect x="8" y="14" width="3" height="8" fill="currentColor"/>
          <rect x="13" y="14" width="3" height="8" fill="currentColor"/>
          <rect x="18" y="14" width="3" height="8" fill="currentColor"/>
          <rect x="23" y="14" width="3" height="8" fill="currentColor"/>
          <circle cx="29" cy="13" r="2" fill="currentColor" fill-opacity="0.6"/>
        </svg>
      `,
      onClick: (event) => {
        event.preventDefault();
        this.handleGifButtonClick();
      }
    });

    // Update button reference after injection
    setTimeout(() => {
      this.gifButton = injectionManager.getInjectedElement('ytgif-button') as HTMLButtonElement;
    }, 100);
  }

  private async findVideoElement() {
    // Use YouTubeDetector's enhanced video finding capabilities
    this.videoElement = await youTubeDetector.waitForVideoElement(3000);
    
    if (this.videoElement) {
      this.log('debug', '[Content] Found video element', {
        duration: this.videoElement.duration,
        currentTime: this.videoElement.currentTime,
        canCreateGif: youTubeDetector.canCreateGif()
      });
    } else {
      this.log('warn', '[Content] No video element found');
    }
  }

  private async handleGifButtonClick() {
    // Check if GIF creation is possible on current page
    if (!youTubeDetector.canCreateGif()) {
      this.log('warn', '[Content] GIF creation not supported on current page type');
      return;
    }

    this.isActive = !this.isActive;
    
    if (this.isActive) {
      await this.activateGifMode();
    } else {
      this.deactivateGifMode();
    }
  }

  private async activateGifMode() {
    this.log('info', '[Content] GIF mode activated');
    
    // Ensure we have a video element
    if (!this.videoElement) {
      await this.findVideoElement();
    }

    // Get current video state
    const videoState = this.getCurrentVideoState();
    if (!videoState) {
      this.log('warn', '[Content] No video found to create GIF from');
      this.deactivateGifMode();
      return;
    }

    // Update overlay state metadata
    overlayStateManager.setMetadata({
      videoDuration: videoState.duration,
      videoTitle: videoState.title || '',
      videoId: this.extractVideoIdFromUrl() || ''
    });

    // Activate overlay state manager
    await overlayStateManager.activate('timeline');
    
    // Update button state using new player integration
    playerIntegration.setButtonState(true);
    
    // Also update fallback button if it exists
    this.gifButton = injectionManager.getInjectedElement('ytgif-button') as HTMLButtonElement;
    if (this.gifButton) {
      this.gifButton.classList.add('active');
    }

    // Update player ready state
    await extensionStateManager.updatePlayerReady(true);
    
    // Show timeline overlay for segment selection
    const showTimelineMessage: ShowTimelineRequest = {
      type: 'SHOW_TIMELINE',
      data: {
        videoDuration: videoState.duration,
        currentTime: videoState.currentTime
      }
    };

    // Send message to background to handle timeline display
    try {
      await this.sendMessageToBackground(showTimelineMessage);
      this.showTimelineOverlay(showTimelineMessage);
    } catch (error) {
      this.log('error', '[Content] Failed to activate GIF mode', { error });
    }
  }

  private async deactivateGifMode() {
    this.log('info', '[Content] GIF mode deactivated');
    
    // Stop any active preview
    if (playerController.isPreviewActive()) {
      try {
        await playerController.stopPreview();
        this.log('debug', '[Content] Preview stopped during deactivation');
      } catch (error) {
        this.log('error', '[Content] Error stopping preview during deactivation', { error });
      }
    }
    
    // Deactivate overlay state manager
    await overlayStateManager.deactivate();
    
    // Update button state using new player integration
    playerIntegration.setButtonState(false);
    
    // Also update fallback button if it exists
    if (this.gifButton) {
      this.gifButton.classList.remove('active');
    }

    this.hideTimelineOverlay();

    // Notify background
    const hideMessage: HideTimelineRequest = {
      type: 'HIDE_TIMELINE'
    };
    this.sendMessageToBackground(hideMessage).catch((error) => {
      this.log('error', '[Content] Failed to send hide timeline message', { error });
    });
  }

  private showTimelineOverlay(message: ShowTimelineRequest) {
    // Remove existing overlay
    this.hideTimelineOverlay();

    const { videoDuration, currentTime } = message.data;

    // Create timeline overlay container
    this.timelineOverlay = document.createElement('div');
    this.timelineOverlay.id = 'ytgif-timeline-overlay';
    document.body.appendChild(this.timelineOverlay);

    // Create React root and render timeline overlay
    this.timelineRoot = createRoot(this.timelineOverlay);
    
    // Register elements with overlay state manager
    overlayStateManager.setElements(this.timelineOverlay, this.timelineRoot);
    
    this.timelineRoot.render(
      React.createElement(TimelineOverlay, {
        videoDuration,
        currentTime,
        onSelectionChange: this.handleSelectionChange.bind(this),
        onClose: this.deactivateGifMode.bind(this),
        onCreateGif: this.handleCreateGif.bind(this),
        onSeekTo: this.handleSeekTo.bind(this),
        onPreviewToggle: this.handlePreviewToggle.bind(this),
        isCreating: this.isCreatingGif,
        isPreviewActive: playerController.isPreviewActive()
      })
    );

    this.log('debug', '[Content] Timeline overlay shown with React', { videoDuration, currentTime });
  }

  private handleSelectionChange(selection: TimelineSelection) {
    this.currentSelection = selection;
    // Update overlay state manager with new selection
    overlayStateManager.setSelection(selection);
    this.log('debug', '[Content] Timeline selection updated', { selection });
    
    // Update preview if active
    if (playerController.isPreviewActive()) {
      playerController.updatePreviewSelection(selection).catch((error) => {
        this.log('error', '[Content] Failed to update preview selection', { error });
      });
    }
    
    // Update React component if needed
    this.updateTimelineOverlay();
  }

  private updateTimelineOverlay() {
    if (!this.timelineRoot || !this.videoElement) return;
    
    const videoState = this.getCurrentVideoState();
    if (!videoState) return;
    
    this.timelineRoot.render(
      React.createElement(TimelineOverlay, {
        videoDuration: videoState.duration,
        currentTime: videoState.currentTime,
        onSelectionChange: this.handleSelectionChange.bind(this),
        onClose: this.deactivateGifMode.bind(this),
        onCreateGif: this.handleCreateGif.bind(this),
        onSeekTo: this.handleSeekTo.bind(this),
        onPreviewToggle: this.handlePreviewToggle.bind(this),
        isCreating: this.isCreatingGif,
        isPreviewActive: playerController.isPreviewActive()
      })
    );
  }

  private handleSeekTo(time: number) {
    // Use YouTube API first for more reliable seeking
    if (youTubeAPI.isReady()) {
      try {
        youTubeAPI.seekTo(time);
        return;
      } catch (error) {
        this.log('warn', '[Content] YouTube API seek failed, falling back to video element', { error });
      }
    }

    // Fallback to direct video element seeking
    if (this.videoElement) {
      this.videoElement.currentTime = time;
    }
  }

  private async handlePreviewToggle() {
    if (!this.currentSelection) {
      this.log('warn', '[Content] Cannot toggle preview - no selection available');
      return;
    }

    try {
      if (playerController.isPreviewActive()) {
        await playerController.stopPreview();
        this.log('info', '[Content] Preview stopped');
      } else {
        const success = await playerController.startPreview(this.currentSelection);
        if (success) {
          this.log('info', '[Content] Preview started', { selection: this.currentSelection });
        } else {
          this.log('error', '[Content] Failed to start preview');
        }
      }
      
      // Update timeline overlay to reflect preview state
      this.updateTimelineOverlay();
    } catch (error) {
      this.log('error', '[Content] Error toggling preview', { error });
    }
  }

  private adaptOverlayToPlayerState() {
    if (!this.timelineOverlay) return;

    // Detect player mode and state
    const isTheaterMode = this.detectTheaterMode();
    const isFullscreen = this.detectFullscreenMode();
    const isCompact = this.detectCompactMode();

    // Apply appropriate data attributes for CSS targeting
    if (isTheaterMode) {
      this.timelineOverlay.setAttribute('data-theater', 'true');
    }
    
    if (isFullscreen) {
      this.timelineOverlay.setAttribute('data-fullscreen', 'true');
    }
    
    if (isCompact) {
      this.timelineOverlay.setAttribute('data-compact', 'true');
    }

    this.log('debug', '[Content] Adapted overlay to player state', {
      isTheaterMode,
      isFullscreen,
      isCompact
    });
  }

  private detectTheaterMode(): boolean {
    // Check for theater mode indicators
    const theaterSelectors = [
      'body[theater]',
      '.ytp-big-mode',
      '[data-theater="true"]',
      '.theater-mode'
    ];

    return theaterSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private detectFullscreenMode(): boolean {
    // Check for fullscreen mode
    const doc = document as Document & {
      webkitFullscreenElement?: Element;
      mozFullScreenElement?: Element;
      msFullscreenElement?: Element;
    };
    
    return document.fullscreenElement !== null ||
           doc.webkitFullscreenElement !== undefined ||
           doc.mozFullScreenElement !== undefined ||
           doc.msFullscreenElement !== undefined;
  }

  private detectCompactMode(): boolean {
    // Check for compact/mini player mode
    const compactSelectors = [
      '.ytp-miniplayer',
      '.miniplayer-is-active',
      '.compact-mode'
    ];

    const player = youTubeDetector.getPlayerContainer();
    if (player) {
      const rect = player.getBoundingClientRect();
      // Consider compact if player is very small
      return rect.width < 400 || rect.height < 300;
    }

    return compactSelectors.some(selector => document.querySelector(selector) !== null);
  }



  private async handleCreateGif() {
    if (!this.videoElement || !this.currentSelection) {
      this.log('warn', '[Content] Cannot create GIF - missing video or selection');
      return;
    }

    const { startTime, endTime, duration } = this.currentSelection;

    if (duration < 0.5) {
      this.log('warn', '[Content] Invalid time selection for GIF creation', { selection: this.currentSelection });
      return;
    }

    // Set creating state and update UI
    this.isCreatingGif = true;
    this.updateTimelineOverlay();
    
    this.log('info', '[Content] Creating GIF', { startTime, endTime, duration });

    try {
      // Send selection update to background
      const selectionMessage: TimelineSelectionUpdate = {
        type: 'TIMELINE_SELECTION_UPDATE',
        data: this.currentSelection
      };

      await this.sendMessageToBackground(selectionMessage);
      
      // Success - close overlay after brief delay
      setTimeout(() => {
        this.deactivateGifMode();
      }, 1000);
      
    } catch (error) {
      this.log('error', '[Content] Failed to create GIF', { error });
      
      // Reset creating state and update UI
      this.isCreatingGif = false;
      this.updateTimelineOverlay();
    }
  }


  private hideTimelineOverlay() {
    if (this.timelineRoot) {
      this.timelineRoot.unmount();
      this.timelineRoot = null;
    }
    
    if (this.timelineOverlay) {
      this.timelineOverlay.remove();
      this.timelineOverlay = null;
    }
    
    this.currentSelection = null;
    this.log('debug', '[Content] Timeline overlay hidden');
  }

  private getCurrentVideoState() {
    // Try YouTube API first for more reliable state
    if (youTubeAPI.isReady()) {
      try {
        const apiCurrentTime = youTubeAPI.getCurrentTime();
        const apiDuration = youTubeAPI.getDuration();
        const apiState = youTubeAPI.getPlayerState();
        
        if (apiDuration > 0 && !isNaN(apiCurrentTime) && !isNaN(apiDuration)) {
          return {
            isPlaying: apiState === YouTubeAPIIntegration.PlayerState.PLAYING,
            currentTime: apiCurrentTime,
            duration: apiDuration,
            videoUrl: window.location.href,
            title: document.title,
            playerState: apiState,
            source: 'youtube-api'
          };
        }
      } catch (error) {
        this.log('warn', '[Content] YouTube API error, falling back to video element', { error });
      }
    }

    // Fallback to direct video element
    if (!this.videoElement) {
      // Try to find video element as final fallback
      this.videoElement = youTubeDetector.getVideoElement();
      if (!this.videoElement) {
        this.log('warn', '[Content] No video element available');
        return null;
      }
    }

    try {
      return {
        isPlaying: !this.videoElement.paused && !this.videoElement.ended,
        currentTime: this.videoElement.currentTime || 0,
        duration: this.videoElement.duration || 0,
        videoUrl: window.location.href,
        title: document.title,
        source: 'video-element'
      };
    } catch (error) {
      this.log('error', '[Content] Failed to get video state', { error });
      return null;
    }
  }

  private handleGetVideoState(
    message: GetVideoStateRequest, 
    sendResponse: (response: ExtensionMessage) => void
  ) {
    const videoState = this.getCurrentVideoState();
    
    if (videoState) {
      sendResponse({
        type: 'GET_VIDEO_STATE_RESPONSE',
        success: true,
        data: videoState
      });
    } else {
      sendResponse({
        type: 'GET_VIDEO_STATE_RESPONSE',
        success: false,
        error: 'No video element found'
      });
    }
  }

  // Helper method to send messages to background script
  private async sendMessageToBackground(message: ExtensionMessage): Promise<ExtensionMessage> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response: ExtensionMessage) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  // Helper method to extract video ID from current URL
  private extractVideoIdFromUrl(): string | null {
    try {
      const url = new URL(window.location.href);
      
      // Standard watch URLs
      if (url.pathname === '/watch') {
        return url.searchParams.get('v');
      }
      
      // Shorts URLs
      if (url.pathname.includes('/shorts/')) {
        const shortId = url.pathname.split('/shorts/')[1];
        return shortId?.split('/')[0] || null;
      }
      
      return null;
    } catch (error) {
      this.log('warn', '[Content] Error extracting video ID from URL', { error });
      return null;
    }
  }

  // Centralized logging that forwards to background
  private log(level: 'info' | 'warn' | 'error' | 'debug', message: string, context?: Record<string, unknown>) {
    // Local console log
    const logMethod = console[level] || console.log;
    if (context) {
      logMethod(`[Content] ${message}`, context);
    } else {
      logMethod(`[Content] ${message}`);
    }

    // Forward to background for centralized logging
    const logMessage: LogMessage = {
      type: 'LOG',
      data: {
        level,
        message: `[Content] ${message}`,
        context
      }
    };

    this.sendMessageToBackground(logMessage).catch(() => {
      // Ignore logging errors to prevent recursion
    });
  }

  public destroy() {
    // Unsubscribe from navigation events
    if (this.navigationUnsubscribe) {
      this.navigationUnsubscribe();
    }
    
    // Clean up theme system
    themeDetector.destroy();
    youtubeMatcher.destroy();
    
    // Clean up overlay state manager
    overlayStateManager.destroy();
    
    // Clean up cleanup manager
    cleanupManager.destroy().catch((error) => {
      this.log('error', '[Content] Error destroying cleanup manager', { error });
    });
    
    // Clean up player controller
    playerController.destroy();
    
    // Clean up new player integration
    playerIntegration.destroy();
    
    // Clean up fallback injection manager
    injectionManager.unregisterInjection('ytgif-button');
    
    // Clean up timeline overlay and React root
    this.hideTimelineOverlay();
    
    this.log('info', '[Content] YouTubeGifMaker destroyed');
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new YouTubeGifMaker();
  });
} else {
  new YouTubeGifMaker();
}

export {};