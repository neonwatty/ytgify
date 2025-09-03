import './styles.css';
import { 
  ExtensionMessage,
  GetVideoStateRequest,
  ShowTimelineRequest,
  HideTimelineRequest,
  TimelineSelectionUpdate,
  LogMessage
} from '@/types';
import { youTubeDetector, YouTubeNavigationEvent } from './youtube-detector';
import { injectionManager } from './injection-manager';
import { extensionStateManager } from '@/shared';

class YouTubeGifMaker {
  private gifButton: HTMLButtonElement | null = null;
  private timelineOverlay: HTMLDivElement | null = null;
  private isActive = false;
  private videoElement: HTMLVideoElement | null = null;
  private navigationUnsubscribe: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    this.setupMessageListener();
    this.setupNavigationListener();
    this.setupInjectionSystem();
    this.findVideoElement();
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

  // Setup injection system for GIF button
  private setupInjectionSystem() {
    injectionManager.createButtonInjection('ytgif-button', {
      selector: '.ytp-right-controls',
      pageTypes: ['watch', 'shorts'], // Only inject on video pages
      buttonClass: 'ytp-button ytgif-button',
      position: 'before', // Insert before settings button
      content: `
        <svg height="100%" version="1.1" viewBox="0 0 36 36" width="100%">
          <path fill="white" d="M8 10h20a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V12a2 2 0 0 1 2-2z" opacity="0.3"/>
          <path fill="white" d="M10 14h3v8h-3zM15 14h3v8h-3zM21 14h3v8h-3z"/>
          <circle fill="white" cx="29" cy="13" r="2" opacity="0.8"/>
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
    
    // Update extension state
    await extensionStateManager.updateComponentState('timeline', true);
    
    // Update button state
    this.gifButton = injectionManager.getInjectedElement('ytgif-button') as HTMLButtonElement;
    if (this.gifButton) {
      this.gifButton.classList.add('active');
    }

    // Ensure we have a video element
    if (!this.videoElement) {
      await this.findVideoElement();
    }

    // Get current video state
    const videoState = this.getCurrentVideoState();
    if (videoState) {
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
    } else {
      this.log('warn', '[Content] No video found to create GIF from');
      this.deactivateGifMode();
    }
  }

  private async deactivateGifMode() {
    this.log('info', '[Content] GIF mode deactivated');
    
    // Update extension state
    await extensionStateManager.updateComponentState('timeline', false);
    
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

    // Create timeline overlay UI
    this.timelineOverlay = document.createElement('div');
    this.timelineOverlay.id = 'ytgif-timeline-overlay';
    this.timelineOverlay.className = 'ytgif-timeline-overlay';
    
    this.timelineOverlay.innerHTML = `
      <div class="ytgif-timeline-container">
        <div class="ytgif-timeline-header">
          <h3>Select GIF Segment</h3>
          <button class="ytgif-timeline-close">×</button>
        </div>
        <div class="ytgif-timeline-controls">
          <div class="ytgif-timeline-track">
            <div class="ytgif-timeline-progress" style="width: ${(currentTime / videoDuration) * 100}%"></div>
            <div class="ytgif-timeline-selector">
              <div class="ytgif-timeline-handle ytgif-timeline-start" data-time="${Math.max(0, currentTime - 2)}"></div>
              <div class="ytgif-timeline-selection"></div>
              <div class="ytgif-timeline-handle ytgif-timeline-end" data-time="${Math.min(videoDuration, currentTime + 2)}"></div>
            </div>
          </div>
          <div class="ytgif-timeline-info">
            <span class="ytgif-timeline-duration">Duration: 4.0s</span>
          </div>
        </div>
        <div class="ytgif-timeline-actions">
          <button class="ytgif-timeline-create">Create GIF</button>
          <button class="ytgif-timeline-cancel">Cancel</button>
        </div>
      </div>
    `;

    // Insert overlay into page
    document.body.appendChild(this.timelineOverlay);

    // Setup timeline event listeners
    this.setupTimelineControls();

    this.log('debug', '[Content] Timeline overlay shown', { videoDuration, currentTime });
  }

  private setupTimelineControls() {
    if (!this.timelineOverlay) return;

    // Close button
    const closeButton = this.timelineOverlay.querySelector('.ytgif-timeline-close') as HTMLButtonElement;
    closeButton?.addEventListener('click', () => this.deactivateGifMode());

    // Cancel button
    const cancelButton = this.timelineOverlay.querySelector('.ytgif-timeline-cancel') as HTMLButtonElement;
    cancelButton?.addEventListener('click', () => this.deactivateGifMode());

    // Create GIF button
    const createButton = this.timelineOverlay.querySelector('.ytgif-timeline-create') as HTMLButtonElement;
    createButton?.addEventListener('click', () => this.handleCreateGif());

    // Timeline handles for segment selection
    const startHandle = this.timelineOverlay.querySelector('.ytgif-timeline-start') as HTMLElement;
    const endHandle = this.timelineOverlay.querySelector('.ytgif-timeline-end') as HTMLElement;

    if (startHandle && endHandle) {
      this.setupTimelineHandles(startHandle, endHandle);
    }
  }

  private setupTimelineHandles(_startHandle: HTMLElement, _endHandle: HTMLElement) {
    // TODO: Implement drag functionality for timeline handles
    // This would allow users to select start/end times for GIF creation
    this.log('debug', '[Content] Timeline handles setup complete');
  }

  private async handleCreateGif() {
    if (!this.videoElement || !this.timelineOverlay) return;

    // Get selection from timeline
    const startHandle = this.timelineOverlay.querySelector('.ytgif-timeline-start') as HTMLElement;
    const endHandle = this.timelineOverlay.querySelector('.ytgif-timeline-end') as HTMLElement;

    const startTime = parseFloat(startHandle?.dataset.time || '0');
    const endTime = parseFloat(endHandle?.dataset.time || '0');

    if (startTime >= endTime) {
      this.log('warn', '[Content] Invalid time selection for GIF creation');
      return;
    }

    this.log('info', '[Content] Creating GIF', { startTime, endTime });

    // Send selection update to background
    const selectionMessage: TimelineSelectionUpdate = {
      type: 'TIMELINE_SELECTION_UPDATE',
      data: {
        startTime,
        endTime,
        duration: endTime - startTime
      }
    };

    try {
      await this.sendMessageToBackground(selectionMessage);
      this.deactivateGifMode();
    } catch (error) {
      this.log('error', '[Content] Failed to create GIF', { error });
    }
  }

  private hideTimelineOverlay() {
    if (this.timelineOverlay) {
      this.timelineOverlay.remove();
      this.timelineOverlay = null;
    }
  }

  private getCurrentVideoState() {
    if (!this.videoElement) return null;

    return {
      isPlaying: !this.videoElement.paused,
      currentTime: this.videoElement.currentTime,
      duration: this.videoElement.duration || 0,
      videoUrl: window.location.href,
      title: document.title
    };
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
    
    // Clean up injection manager
    injectionManager.unregisterInjection('ytgif-button');
    
    // Clean up timeline overlay
    if (this.timelineOverlay) {
      this.timelineOverlay.remove();
    }
    
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