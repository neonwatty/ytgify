// Debug log to check if content script loads

// Set webpack public path for dynamic imports in content script
declare let __webpack_public_path__: string;
if (typeof chrome !== 'undefined' && chrome.runtime) {
  __webpack_public_path__ = chrome.runtime.getURL('/');
}

import './styles.css';
import React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { 
  ExtensionMessage,
  GetVideoStateRequest,
  ShowTimelineRequest,
  HideTimelineRequest,
  LogMessage,
  TimelineSelection,
  TextOverlay,
  RequestVideoDataForGif,
  VideoDataResponse,
  GifCreationComplete,
  JobProgressUpdate,
  SuccessResponse,
  ErrorResponse
} from '@/types';
import { GifData, GifSettings } from '@/types/storage';
import { youTubeDetector, YouTubeNavigationEvent } from './youtube-detector';
import { injectionManager } from './injection-manager';
import { extensionStateManager } from '@/shared';
import { youTubeAPI, YouTubeAPIIntegration } from './youtube-api-integration';
import { ContentScriptFrameExtractor, ContentFrameExtractionRequest } from './frame-extractor';
import { gifProcessor } from './gif-processor';
import { playerIntegration } from './player-integration';
import { playerController } from './player-controller';
import { TimelineOverlayWrapper } from './timeline-overlay-wrapper';
import { TimelineOverlayWizard } from './timeline-overlay-wizard';
import { overlayStateManager } from './overlay-state';
import { cleanupManager } from './cleanup-manager';
import { initializeContentScriptFrameExtraction } from './frame-extractor';
import { themeDetector, youtubeMatcher } from '@/themes';
import { ResolutionScaler } from '@/processing/resolution-scaler';
import { parseResolution } from '@/utils/resolution-parser';

class YouTubeGifMaker {
  private gifButton: HTMLButtonElement | null = null;
  private timelineOverlay: HTMLDivElement | null = null;
  private timelineRoot: Root | null = null;
  private isActive = false;
  private isCreatingGif = false;
  private currentSelection: TimelineSelection | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private navigationUnsubscribe: (() => void) | null = null;
  private processingStatus: { stage: string; progress: number; message: string } | undefined = undefined;
  private isWizardMode = false;
  private wizardUpdateInterval: NodeJS.Timeout | null = null;
  private createdGifData: { dataUrl: string; size: number; metadata: Record<string, unknown> } | undefined = undefined;
  private buttonVisible = false; // Track button visibility state - default to hidden

  constructor() {
    
    this.init();
    
    // Add keyboard shortcut as backup trigger
    this.setupKeyboardShortcut();
  }
  
  private setupKeyboardShortcut() {
    // Listen for Ctrl+Shift+G (or Cmd+Shift+G on Mac) to trigger wizard
    document.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'G') {
        event.preventDefault();
        
        this.handleDirectWizardActivation();
      }
    });

    // openGifWizard functionality is available via keyboard shortcuts and GIF button
    // No script injection needed - removed for Chrome Web Store compliance
  }

  private init() {
    
    this.setupMessageListener();
    this.setupNavigationListener();
    this.setupOverlayStateListeners();
    this.setupCleanupManager();
    this.setupThemeSystem();
    this.setupStorageListener();
    this.loadButtonVisibility();
    this.setupInjectionSystem();
    this.setupFrameExtraction();
    this.findVideoElement();
  }

  // Setup storage listener for button visibility changes
  private setupStorageListener() {
    // Check if Chrome storage API is available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync' && changes.buttonVisibility) {
          const newVisibility = changes.buttonVisibility.newValue === true;

          this.updateButtonVisibility(newVisibility);
        }
      });
    } else {
      this.log('warn', '[Content] Chrome storage API not available for listener setup');
    }
  }

  // Load initial button visibility setting
  private async loadButtonVisibility() {
    // Check if Chrome storage API is available
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
      try {
        const result = await chrome.storage.sync.get(['buttonVisibility']);
        // Default to false if not set
        this.buttonVisible = result.buttonVisibility === true;

      } catch (error) {
        console.error('[Content] Error loading button visibility:', error);
        this.buttonVisible = false; // Default to hidden on error
      }
    } else {
      this.log('warn', '[Content] Chrome storage API not available, using default button visibility');
      this.buttonVisible = false; // Default to hidden when storage isn't available
    }
  }

  // Update button visibility
  private updateButtonVisibility(visible: boolean) {
    this.buttonVisible = visible;
    
    if (visible) {
      // Re-inject button if it was hidden
      if (!playerIntegration.hasButton()) {
        playerIntegration.injectButton((event) => {
          event.preventDefault();
          this.handleGifButtonClick();
        });
      }
    } else {
      // Remove button if it should be hidden
      playerIntegration.removeButton();
    }
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
        case 'SHOW_WIZARD_DIRECT':
          // Handle direct wizard activation from extension icon
          
          this.handleDirectWizardActivation();
          sendResponse({ 
            type: 'SUCCESS_RESPONSE',
            success: true 
          } as SuccessResponse);
          break;
        case 'HIDE_TIMELINE':
          this.hideTimelineOverlay();
          break;
        case 'GET_VIDEO_STATE':
          this.handleGetVideoState(message as GetVideoStateRequest, sendResponse);
          return true; // Async response
        case 'REQUEST_VIDEO_DATA_FOR_GIF':
          this.handleVideoDataRequest(message, sendResponse);
          return true; // Async response
        case 'GIF_CREATION_COMPLETE':
          this.handleGifCreationComplete(message);
          break;
        case 'JOB_PROGRESS_UPDATE':
          this.handleJobProgress(message);
          break;
        case 'CONTENT_SCRIPT_EXTRACT_FRAMES':
          this.log('info', '[Content] Received CONTENT_SCRIPT_EXTRACT_FRAMES message', { message });
          // Delegate to frame extractor - handle async properly
          (async () => {
            try {
              this.log('info', '[Content] Starting frame extraction');
              await ContentScriptFrameExtractor.getInstance().handleFrameExtractionRequest(
                message as ContentFrameExtractionRequest,
                (response) => sendResponse(response as unknown as ExtensionMessage)
              );
              this.log('info', '[Content] Frame extraction completed');
            } catch (error) {
              this.log('error', '[Content] Frame extraction failed', { error });
              sendResponse({ 
                type: 'ERROR_RESPONSE',
                success: false,
                error: 'Frame extraction failed'
              } as ErrorResponse);
            }
          })();
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
    // Only inject button if it should be visible
    if (!this.buttonVisible) {
      
      return;
    }

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
    // Use YouTubeDetector's enhanced video finding capabilities with longer timeout
    this.videoElement = await youTubeDetector.waitForVideoElement(10000);
    
    if (this.videoElement) {
      this.log('debug', '[Content] Found video element', {
        duration: this.videoElement.duration,
        currentTime: this.videoElement.currentTime,
        canCreateGif: youTubeDetector.canCreateGif(),
        src: this.videoElement.src || this.videoElement.currentSrc,
        readyState: this.videoElement.readyState
      });
    } else {
      this.log('warn', '[Content] No video element found after 10s timeout', {
        url: window.location.href,
        canCreateGif: youTubeDetector.canCreateGif(),
        pageType: youTubeDetector.getCurrentState().pageType
      });
    }
  }

  private async handleDirectWizardActivation() {

    this.log('info', '[Content] Direct wizard activation from extension icon');

    // Check if we're on YouTube Shorts
    const currentState = youTubeDetector.getCurrentState();
    if (currentState.isShorts) {
      this.log('info', '[Content] Shorts detected during direct activation');
      this.showGifCreationFeedback('info', 'GIF creation is not available on YouTube Shorts. Please open a regular YouTube video to create GIFs.');
      return;
    }

    // Ensure we have a video element
    if (!this.videoElement) {

      await this.findVideoElement();
    }

    // Check if we can create a GIF
    const videoState = this.getCurrentVideoState();

    if (!videoState) {
      console.error('[WIZARD ACTIVATION] No video found for GIF creation');
      this.log('warn', '[Content] No video found for GIF creation');
      // Show feedback to user
      this.showGifCreationFeedback('error', 'No video found on this page');
      return;
    }
    
    // Directly show the wizard overlay
    const showTimelineMessage: ShowTimelineRequest = {
      type: 'SHOW_TIMELINE',
      data: {
        videoDuration: videoState.duration,
        currentTime: videoState.currentTime
      }
    };
    
    // Set state to active for wizard
    this.isActive = true;
    
    // Update overlay state metadata
    overlayStateManager.setMetadata({
      videoDuration: videoState.duration,
      videoTitle: videoState.title || '',
      videoId: this.extractVideoIdFromUrl() || ''
    });
    
    // Activate overlay state manager
    await overlayStateManager.activate('timeline');
    
    // Show the wizard overlay directly
    
    this.showTimelineOverlay(showTimelineMessage);

    this.log('info', '[Content] Wizard opened directly from extension icon');
  }

  private async handleGifButtonClick() {
    this.log('info', '[Content] GIF button clicked');

    const currentState = youTubeDetector.getCurrentState();
    const isShorts = currentState.isShorts;

    // Check if we're on YouTube Shorts
    if (isShorts) {
      this.log('info', '[Content] Shorts detected - showing feedback');
      this.showGifCreationFeedback('info', 'GIF creation is not available on YouTube Shorts due to technical limitations. Please try on a regular YouTube video instead.');
      return;
    }

    // Check if GIF creation is possible on current page
    const canCreate = youTubeDetector.canCreateGif();
    this.log('info', '[Content] Can create GIF check', {
      canCreate,
      currentState: currentState
    });

    if (!canCreate) {
      this.log('warn', '[Content] GIF creation not supported on current page type, but proceeding anyway for testing');
      // For now, proceed even if canCreateGif returns false to allow functionality
      // TODO: Fix the canCreateGif logic to properly detect video availability
    }

    this.isActive = !this.isActive;
    this.log('info', '[Content] Toggling GIF mode', { isActive: this.isActive });
    
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
      console.error('[UI FIX DEBUG] No video state available!');
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

    // Send message to background to handle timeline display (optional)
    // Don't wait for background response - just fire and forget
    this.sendMessageToBackground(showTimelineMessage)
      .then(response => {
        this.log('debug', '[Content] Background communication result', { response });
      })
      .catch(error => {
        this.log('warn', '[Content] Background communication failed', { error });
      });

    // Always show timeline overlay regardless of background communication status

    try {
      this.showTimelineOverlay(showTimelineMessage);
      
    } catch (callError) {
      console.error('[UI FIX DEBUG] Error calling showTimelineOverlay:', callError);
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

  private showWizardOverlay(message: ShowTimelineRequest) {
    try {
      // Remove existing overlay
      this.hideTimelineOverlay();

      const { videoDuration, currentTime } = message.data;
      const videoTitle = document.title.replace(' - YouTube', '');

      // Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'ytgif-wizard-overlay';
      this.timelineOverlay = overlay;
      
      // Apply styles for the wizard overlay
      overlay.style.cssText = `
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        background: rgba(0, 0, 0, 0.85) !important;
        z-index: 2147483647 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      `;
      
      document.body.appendChild(overlay);

      // Create React root and render wizard
      this.timelineRoot = createRoot(overlay);
      
      // Register elements with overlay state manager
      overlayStateManager.setElements(overlay, this.timelineRoot);
      
      // Mark that we're in wizard mode
      this.isWizardMode = true;
      
      // Start regular updates for wizard
      this.startWizardUpdates();
      
      this.timelineRoot.render(
        React.createElement(TimelineOverlayWizard, {
          videoDuration,
          currentTime,
          videoTitle,
          videoElement: this.videoElement || undefined,
          onSelectionChange: this.handleSelectionChange.bind(this),
          onClose: this.deactivateGifMode.bind(this),
          onCreateGif: (selection: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string) => {
            this.handleCreateGif(selection, textOverlays, resolution);
          },
          onSeekTo: this.handleSeekTo.bind(this),
          isCreating: this.isCreatingGif,
          processingStatus: this.processingStatus,
          gifData: this.createdGifData
        })
      );

      this.log('info', '[Wizard] Overlay wizard shown', { 
        videoDuration, 
        currentTime,
        videoTitle
      });
    } catch (error) {
      console.error('[Wizard] Error showing overlay wizard:', error);
      this.log('error', '[Wizard] Failed to show overlay wizard', { error });
    }
  }

  private showTimelineOverlay(message: ShowTimelineRequest) {

    // Use the new wizard overlay
    this.showWizardOverlay(message);
    return;
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
    
    // Check if we're in wizard mode
    if (this.isWizardMode) {
      // Get video title
      const videoTitleElement = document.querySelector('#above-the-fold h1.ytd-watch-metadata yt-formatted-string') ||
                                document.querySelector('h1.title yt-formatted-string') ||
                                document.querySelector('.ytp-title-link');
      const videoTitle = videoTitleElement?.textContent || 'YouTube Video';
      
      // Re-render wizard with updated props
      this.timelineRoot.render(
        React.createElement(TimelineOverlayWizard, {
          videoDuration: videoState.duration,
          currentTime: videoState.currentTime,
          videoTitle,
          videoElement: this.videoElement || undefined,
          onSelectionChange: this.handleSelectionChange.bind(this),
          onClose: this.deactivateGifMode.bind(this),
          onCreateGif: (selection: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string) => {

            this.handleCreateGif(selection, textOverlays, resolution);
          },
          onSeekTo: this.handleSeekTo.bind(this),
          isCreating: this.isCreatingGif,
          processingStatus: this.processingStatus,
          gifData: this.createdGifData
        })
      );
    } else {
      // Render old timeline overlay
      this.timelineRoot.render(
        React.createElement(TimelineOverlayWrapper, {
          videoDuration: videoState.duration,
          currentTime: videoState.currentTime,
          onSelectionChange: this.handleSelectionChange.bind(this),
          onClose: this.deactivateGifMode.bind(this),
          onCreateGif: () => {
            // Old timeline mode doesn't support resolution
            if (this.currentSelection) {
              this.handleCreateGif(this.currentSelection);
            }
          },
          onSeekTo: this.handleSeekTo.bind(this),
          onPreviewToggle: this.handlePreviewToggle.bind(this),
          isCreating: this.isCreatingGif,
          isPreviewActive: playerController.isPreviewActive(),
          processingStatus: this.processingStatus
        })
      );
    }
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

  private async handleCreateGif(selection?: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string) {

    // Use provided selection or fall back to current selection
    const gifSelection = selection || this.currentSelection;

    if (!this.videoElement || !gifSelection) {
      this.log('warn', '[Content] Cannot create GIF - missing video or selection');
      return;
    }

    const { startTime, endTime, duration } = gifSelection;

    if (duration < 0.5) {
      this.log('warn', '[Content] Invalid time selection for GIF creation', { selection: gifSelection });
      return;
    }

    // Update current selection if a new one was provided
    if (selection) {
      this.currentSelection = selection;
    }

    // Process GIF directly with default settings
    this.log('info', '[Content] Starting GIF creation from wizard', { 
      startTime, 
      endTime, 
      duration,
      hasTextOverlays: !!textOverlays && textOverlays.length > 0
    });
    
    // Set initial processing status to trigger wizard screen change
    this.processingStatus = { stage: 'processing', progress: 0, message: 'Initializing...' };
    this.isCreatingGif = true;
    this.createdGifData = undefined; // Clear previous GIF data
    this.updateTimelineOverlay();
    
    // Use default settings for wizard-initiated GIF creation
    // Calculate default dimensions based on resolution
    const resolutionDefaults: Record<string, { width: number; height: number }> = {
      '144p': { width: 256, height: 144 },
      '240p': { width: 426, height: 240 },
      '360p': { width: 640, height: 360 },
      '480p': { width: 854, height: 480 }
    };

    const requestedResolution = resolution || '480p';
    const defaultDimensions = resolutionDefaults[requestedResolution] || resolutionDefaults['480p'];
    let scaledWidth = defaultDimensions.width;
    let scaledHeight = defaultDimensions.height;

    this.log('info', '[Content] Processing resolution selection', {
      resolution: requestedResolution,
      defaultDimensions
    });

    try {
      // Use ResolutionScaler for intelligent scaling
      const resolutionScaler = new ResolutionScaler();
      const preset = resolutionScaler.getPresetByName(requestedResolution);

      this.log('info', '[Content] Resolution preset found', {
        resolution: requestedResolution,
        preset: preset ? preset.name : 'none',
        targetHeight: preset?.targetHeight
      });

      if (preset && this.videoElement) {
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;

        // Validate video dimensions are available
        if (!videoWidth || !videoHeight) {
          this.log('warn', '[Content] Video dimensions not yet available', {
            videoWidth,
            videoHeight
          });
          // Keep default dimensions for the resolution
        } else {

          // Calculate scaled dimensions first
          const scaledDimensions = resolutionScaler.calculateScaledDimensions(
            videoWidth,
            videoHeight,
            preset
          );

          // Check estimated memory usage of TARGET dimensions, not original
          const targetPixelCount = scaledDimensions.width * scaledDimensions.height;
          const estimatedMemoryMB = (targetPixelCount * 4 * 2) / (1024 * 1024); // RGBA * 2 canvases

          // Progressive degradation for memory constraints based on TARGET size
          let finalPreset = preset;
          if (estimatedMemoryMB > 100) { // Much lower threshold for target dimensions
            this.log('warn', '[Content] Target resolution too large for memory, downgrading', {
              estimatedMemoryMB,
              targetDimensions: { width: scaledDimensions.width, height: scaledDimensions.height }
            });
            // Downgrade resolution if target is too large
            if (!resolutionScaler.getPresetByName(requestedResolution)) {
              finalPreset = resolutionScaler.getPresetByName('480p')!;
            } else if (requestedResolution === '480p') {
              finalPreset = resolutionScaler.getPresetByName('360p')!;
            }
            // Recalculate with downgraded preset
            const downgradedDimensions = resolutionScaler.calculateScaledDimensions(
              videoWidth,
              videoHeight,
              finalPreset
            );
            scaledWidth = downgradedDimensions.width;
            scaledHeight = downgradedDimensions.height;
          } else {
            // Use the calculated dimensions
            scaledWidth = scaledDimensions.width;
            scaledHeight = scaledDimensions.height;
          }

          this.log('info', '[Content] Resolution scaling applied', {
            original: { width: videoWidth, height: videoHeight },
            scaled: { width: scaledWidth, height: scaledHeight },
            preset: finalPreset.name,
            requestedResolution,
            estimatedMemoryMB
          });
        }
      } else {
        this.log('warn', '[Content] Using default dimensions - preset or video element not available', {
          hasPreset: !!preset,
          hasVideoElement: !!this.videoElement,
          usingDimensions: { width: scaledWidth, height: scaledHeight }
        });
      }
    } catch (error) {
      // Fallback to default dimensions if ResolutionScaler fails
      this.log('error', '[Content] ResolutionScaler failed, using fallback with resolution parser', {
        error,
        resolution: requestedResolution
      });

      // Use the resolution parser as fallback
      const dimensions = parseResolution(requestedResolution);

      if (dimensions && this.videoElement) {
        const videoWidth = this.videoElement.videoWidth;
        const videoHeight = this.videoElement.videoHeight;

        if (videoWidth && videoHeight) {
          // Calculate dimensions maintaining aspect ratio
          const videoAspectRatio = videoWidth / videoHeight;
          const targetAspectRatio = dimensions.width / dimensions.height;

          if (Math.abs(videoAspectRatio - targetAspectRatio) < 0.1) {
            // Close enough, use target dimensions
            scaledWidth = dimensions.width;
            scaledHeight = dimensions.height;
          } else if (videoAspectRatio > targetAspectRatio) {
            // Video is wider - fit to width
            scaledWidth = dimensions.width;
            scaledHeight = Math.round(dimensions.width / videoAspectRatio);
          } else {
            // Video is taller - fit to height
            scaledHeight = dimensions.height;
            scaledWidth = Math.round(dimensions.height * videoAspectRatio);
          }

          this.log('info', '[Content] Fallback dimensions calculated', {
            original: { width: videoWidth, height: videoHeight },
            scaled: { width: scaledWidth, height: scaledHeight },
            requestedResolution
          });
        } else {
          // Video dimensions not available, use preset defaults
          this.log('warn', '[Content] Video dimensions not available in fallback', {
            usingDimensions: { width: scaledWidth, height: scaledHeight }
          });
        }
      } else {
        // Last resort - dimensions already set from resolutionDefaults
        this.log('warn', '[Content] Using preset default dimensions', {
          dimensions: { width: scaledWidth, height: scaledHeight },
          requestedResolution
        });
      }

      // Ensure even dimensions
      scaledWidth = Math.floor(scaledWidth / 2) * 2;
      scaledHeight = Math.floor(scaledHeight / 2) * 2;

      this.log('info', '[Content] Using fallback dimensions', {
        scaledWidth,
        scaledHeight,
        resolution: resolution || '480p'
      });
    }

    // Final dimensions logging
    this.log('info', '[Content] Final GIF dimensions determined', {
      width: scaledWidth,
      height: scaledHeight,
      requestedResolution,
      hasVideoElement: !!this.videoElement,
      videoWidth: this.videoElement?.videoWidth,
      videoHeight: this.videoElement?.videoHeight
    });

    const defaultSettings = {
      frameRate: 15,
      width: scaledWidth,
      height: scaledHeight,
      quality: 'medium' as const
    };

    // Process the GIF with text overlays if provided
    await this.processGifWithSettings(defaultSettings, textOverlays || []);
  }





  private async processGifWithSettings(settings: Partial<GifSettings> & { frameRate?: number; width?: number; height?: number; quality?: string }, textOverlays: TextOverlay[] = [], download = false) {

    if (!this.videoElement || !this.currentSelection) return;

    // Set creating state
    this.isCreatingGif = true;
    window.dispatchEvent(new CustomEvent('ytgif-creating-state', {
      detail: { isCreating: true }
    }));

    const { startTime, endTime } = this.currentSelection;

    // Calculate default dimensions based on video aspect ratio if not provided
    let width = settings.width;
    let height = settings.height;

    if (!width || !height) {
      const videoAspectRatio = this.videoElement.videoWidth / this.videoElement.videoHeight;
      if (videoAspectRatio > 1) {
        width = width || 640;
        height = height || Math.round(640 / videoAspectRatio);
      } else {
        height = height || 640;
        width = width || Math.round(640 * videoAspectRatio);
      }
      // Ensure even dimensions
      width = Math.floor(width / 2) * 2;
      height = Math.floor(height / 2) * 2;
    }

    try {
      // Add memory check before processing
      const estimatedMemoryMB = (width * height * 4 * 2) / (1024 * 1024);
      if (estimatedMemoryMB > 1000) {
        throw new Error('Video dimensions too large for safe processing. Please reduce resolution.');
      }

      // Process GIF entirely in content script
      const result = await gifProcessor.processVideoToGif(
        this.videoElement,
        {
          startTime,
          endTime,
          frameRate: settings.frameRate || 15,
          width,
          height,
          quality: settings.quality || 'medium',
          textOverlays
        },
        (progress, message) => {
          // Determine stage based on message
          let stage = 'processing';
          if (message.includes('Capturing') || message.includes('frames')) {
            stage = 'capturing';
          } else if (message.includes('Encoding') || message.includes('encode')) {
            stage = 'encoding';
          } else if (message.includes('Complete') || progress === 100) {
            stage = 'completed';
          }
          
          this.processingStatus = { stage, progress, message };
          this.updateTimelineOverlay();
          this.log('debug', '[Content] GIF processing progress', { progress, message, stage });
          
          // Post progress to window for unified interface
          window.postMessage({
            type: 'GIF_PROGRESS',
            progress,
            message
          }, '*');
        }
      );

      this.log('info', '[Content] GIF created successfully', { 
        size: result.blob.size,
        metadata: result.metadata 
      });

      // Save to IndexedDB
      
      await gifProcessor.saveGifToStorage(result.blob, result.metadata);

      // Convert blob to data URL for preview
      const reader = new FileReader();
      const gifDataUrl = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(result.blob);
      });
      
      // Create proper GIF metadata
      const gifMetadata = {
        id: `gif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: document.title || 'YouTube GIF',
        width: settings.width || 640,
        height: settings.height || 360,
        duration: endTime - startTime,
        frameRate: settings.frameRate || 15,
        fileSize: result.blob.size,
        createdAt: new Date(),
        tags: []
      };

      // Store GIF data for preview
      this.createdGifData = {
        dataUrl: gifDataUrl,
        size: result.blob.size,
        metadata: gifMetadata
      };

      // Show success feedback
      this.processingStatus = { stage: 'completed', progress: 100, message: 'GIF created!' };
      
      // Force immediate update to pass GIF data to wizard
      this.updateTimelineOverlay();
      
      // If we're in wizard mode, don't hide the overlay - let the success screen handle it
      if (!this.isWizardMode) {
        // Wait a moment for the success screen to show
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // Hide timeline overlay for non-wizard mode
        this.hideTimelineOverlay();
      }
      
      if (download) {
        // Direct download
        const link = document.createElement('a');
        link.href = gifDataUrl;
        link.download = `youtube-gif-${Date.now()}.gif`;
        link.click();
      } else {
        // Preview modal removed - wizard handles everything
      }
      
      // Reset creating state
      this.isCreatingGif = false;
      window.dispatchEvent(new CustomEvent('ytgif-creating-state', {
        detail: { isCreating: false }
      }));
      
    } catch (error) {
      console.error('[Content] GIF creation failed:', error);
      this.log('error', '[Content] Failed to create GIF - caught exception', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });

      // Provide more specific error messages
      let errorMessage = 'Failed to create GIF. ';
      if (error instanceof Error) {
        if (error.message.includes('memory') || error.message.includes('dimensions')) {
          errorMessage = 'GIF creation failed due to memory constraints. Try reducing the resolution or duration.';
        } else if (error.message.includes('canvas')) {
          errorMessage = 'Failed to process video frames. Please refresh and try again.';
        } else if (error.message.includes('storage')) {
          errorMessage = 'Failed to save GIF. Check your browser storage settings.';
        } else {
          errorMessage += error.message;
        }
      }

      // Update processing status with error
      this.processingStatus = { stage: 'error', progress: 0, message: errorMessage };
      this.updateTimelineOverlay();

      // Only reset creating state if there's an actual error
      this.isCreatingGif = false;
      window.dispatchEvent(new CustomEvent('ytgif-creating-state', {
        detail: { isCreating: false }
      }));

      // Show error feedback with actual error message
      this.showGifCreationFeedback('error', errorMessage);
    }
  }

  private hideTimelineOverlay() {
    // Don't immediately reset wizard mode - let it persist through GIF save
    // It will be reset after the GIF is saved or on error
    this.stopWizardUpdates();
    
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

  // Handle request for video data from background script for GIF creation
  private handleVideoDataRequest(
    message: ExtensionMessage,
    sendResponse: (response: ExtensionMessage) => void
  ) {
    try {
      if (!this.videoElement) {
        sendResponse({
          type: 'ERROR_RESPONSE',
          success: false,
          error: 'No video element available for GIF creation'
        });
        return;
      }

      const videoData = (message as RequestVideoDataForGif).data;
      this.log('info', '[Content] Preparing video data for GIF creation', { videoData });

      // Create video element data for frame extraction
      const extractFrameData = {
        videoElement: {
          videoWidth: this.videoElement.videoWidth || 640,
          videoHeight: this.videoElement.videoHeight || 360,
          duration: this.videoElement.duration,
          currentTime: this.videoElement.currentTime,
          videoSrc: this.videoElement.src,
          // We need to capture the actual DOM element for frame extraction
          // In the background script, this will be used to access the video
          tabId: undefined // Will be set by background script
        },
        settings: {
          startTime: videoData.startTime,
          endTime: videoData.endTime,
          frameRate: 15,
          maxWidth: Math.min(this.videoElement.videoWidth || 480, 480),
          quality: 0.8
        }
      };

      const response: VideoDataResponse = {
        type: 'VIDEO_DATA_RESPONSE',
        success: true,
        data: extractFrameData
      };
      sendResponse(response);

      this.log('debug', '[Content] Video data sent to background for processing', { 
        videoWidth: extractFrameData.videoElement.videoWidth,
        videoHeight: extractFrameData.videoElement.videoHeight,
        duration: extractFrameData.settings.endTime - extractFrameData.settings.startTime
      });

    } catch (error) {
      this.log('error', '[Content] Failed to prepare video data for GIF creation', { error });
      sendResponse({
        type: 'ERROR_RESPONSE',
        success: false,
        error: error instanceof Error ? error.message : 'Failed to prepare video data'
      });
    }
  }

  // Handle GIF creation completion from background script
  private async handleGifCreationComplete(message: GifCreationComplete) {
    this.log('info', '[Content] GIF creation completed', { success: message.success });
    
    // Reset creating state and clear processing status
    this.isCreatingGif = false;
    this.processingStatus = undefined;
    window.dispatchEvent(new CustomEvent('ytgif-creating-state', {
      detail: { isCreating: false }
    }));
    
    if (message.success && message.data) {
      // Save the GIF using chrome.storage.local (accessible from all extension contexts)
      try {
        const gifId = `gif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Debug: Check what we received
        this.log('debug', '[Content] GIF data received', {
          hasGifDataUrl: !!message.data.gifDataUrl,
          gifDataUrlLength: message.data.gifDataUrl ? message.data.gifDataUrl.length : 0,
          hasGifBlob: !!message.data.gifBlob,
          gifBlobType: message.data.gifBlob ? message.data.gifBlob.constructor.name : 'undefined'
        });
        
        // GIF creation complete - download handled by background worker
        this.log('info', '[Content] GIF creation complete', { id: gifId });
        
        // Close the timeline overlay immediately if not in wizard mode
        if (!this.isWizardMode) {
          this.deactivateGifMode();
        } else {
          // Reset wizard mode after successful save
          this.isWizardMode = false;
        }

        // Reset wizard data after successful save
        if (this.createdGifData) {
          this.createdGifData = undefined;
        }
        // In wizard mode, the success screen handles navigation
        
      } catch (error) {
        this.log('error', '[Content] Failed to save GIF', { error });
        this.showGifCreationFeedback('error', 'GIF created but failed to save to library');
        
        // Still close overlay after error
        if (!this.isWizardMode) {
          setTimeout(() => {
            this.deactivateGifMode();
          }, 2000);
        } else {
          // Reset wizard mode after error
          this.isWizardMode = false;
        }
      }
      
      // Log success metrics
      this.log('debug', '[Content] GIF creation metrics', { 
        metadata: message.data?.metadata 
      });
    } else {
      // Show error feedback
      this.showGifCreationFeedback('error', message.error || 'GIF creation failed');
      this.log('error', '[Content] GIF creation failed', { error: message.error });
    }
    
    // Update timeline overlay UI to reflect completion
    this.updateTimelineOverlay();
  }

  // Handle job progress updates from background script
  private handleJobProgress(message: ExtensionMessage) {
    const progressData = (message as JobProgressUpdate).data;
    this.log('debug', '[Content] Job progress update', progressData);
    
    // Store processing status with detailed info
    this.processingStatus = {
      stage: progressData.stage || 'processing',
      progress: progressData.progress,
      message: progressData.message || `Processing... ${Math.round(progressData.progress)}%`
    };
    
    // Dispatch custom event for progress update
    if (this.timelineOverlay) {
      
      window.dispatchEvent(new CustomEvent('ytgif-progress-update', {
        detail: this.processingStatus
      }));
    }
  }

  // Save GIF directly to IndexedDB from content script
  private async saveGifToIndexedDB(gifData: GifData): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const dbName = 'YouTubeGifStore';
        const request = indexedDB.open(dbName, 3);
        
        request.onerror = () => {
          this.log('error', '[Content] Failed to open IndexedDB');
          resolve(false);
        };
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create stores if they don't exist
          if (!db.objectStoreNames.contains('gifs')) {
            const gifsStore = db.createObjectStore('gifs', { keyPath: 'id' });
            gifsStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('thumbnails')) {
            db.createObjectStore('thumbnails', { keyPath: 'gifId' });
          }
          
          if (!db.objectStoreNames.contains('metadata')) {
            const metaStore = db.createObjectStore('metadata', { keyPath: 'id' });
            metaStore.createIndex('youtubeUrl', 'youtubeUrl', { unique: false });
          }
        };
        
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction(['gifs'], 'readwrite');
          const gifsStore = transaction.objectStore('gifs');
          
          // Save GIF data
          const gifRequest = gifsStore.put(gifData);
          
          gifRequest.onsuccess = () => {
            this.log('info', '[Content] GIF saved to IndexedDB successfully');
            resolve(true);
          };
          
          gifRequest.onerror = () => {
            this.log('error', '[Content] Failed to save GIF to store');
            resolve(false);
          };
          
          transaction.onerror = () => {
            this.log('error', '[Content] Transaction failed');
            resolve(false);
          };
        };
      } catch (error) {
        this.log('error', '[Content] Exception in saveGifToIndexedDB', { error });
        resolve(false);
      }
    });
  }


  // Download GIF
  private downloadGif(dataUrl: string, title?: string) {
    // Convert data URL to blob
    fetch(dataUrl)
      .then(res => res.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'youtube-gif'}.gif`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showGifCreationFeedback('success', 'GIF downloaded!');
      })
      .catch(error => {
        this.log('error', 'Failed to download GIF', { error });
        this.showGifCreationFeedback('error', 'Failed to download GIF');
      });
  }

  // Open extension popup (library)
  private openExtensionPopup() {
    // Send message to background to open popup
    chrome.runtime.sendMessage({ 
      type: 'OPEN_POPUP',
      data: { tab: 'library' }
    }).catch(() => {
      // If opening popup fails, show feedback
      this.showGifCreationFeedback('info', 'Click the extension icon to view your library');
    });
  }

  // Show feedback for GIF creation status
  private showGifCreationFeedback(type: 'success' | 'error' | 'info', message: string) {
    // Create temporary feedback element
    const feedback = document.createElement('div');
    feedback.className = `ytgif-feedback ytgif-feedback--${type}`;
    feedback.textContent = message;
    feedback.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      padding: 12px 24px;
      border-radius: 4px;
      z-index: 10000;
      font-family: 'Roboto', Arial, sans-serif;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(feedback);
    
    // Fade in
    setTimeout(() => {
      feedback.style.opacity = '1';
      feedback.style.transform = 'translateX(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      feedback.style.opacity = '0';
      feedback.style.transform = 'translateX(100px)';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.parentNode.removeChild(feedback);
        }
      }, 300);
    }, 3000);
  }

  // Helper method to send messages to background script
  private async sendMessageToBackground(message: ExtensionMessage): Promise<ExtensionMessage> {
    return new Promise((resolve, reject) => {
      // Check if chrome.runtime is available
      if (typeof chrome === 'undefined' || !chrome.runtime) {
        this.log('warn', '[Content] Chrome runtime not available, skipping background communication', { messageType: message.type });
        // Resolve with an error response to allow the process to continue
        resolve({
          type: 'ERROR_RESPONSE',
          success: false,
          error: 'Chrome runtime not available'
        });
        return;
      }

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

  private startWizardUpdates() {
    // Stop any existing interval
    this.stopWizardUpdates();
    
    // Update wizard every 100ms when active
    this.wizardUpdateInterval = setInterval(() => {
      if (this.isWizardMode && this.timelineRoot && this.videoElement) {
        this.updateTimelineOverlay();
      }
    }, 100);
  }

  private stopWizardUpdates() {
    if (this.wizardUpdateInterval) {
      clearInterval(this.wizardUpdateInterval);
      this.wizardUpdateInterval = null;
    }
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