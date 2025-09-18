import { Root } from 'react-dom/client';
import { TimelineSelection } from '@/types';
import { extensionStateManager } from '@/shared/state-manager';

type OverlayMode = 'timeline' | 'editor' | 'preview' | 'inactive';

interface OverlayState {
  mode: OverlayMode;
  isVisible: boolean;
  isCreatingGif: boolean;
  currentSelection: TimelineSelection | null;
  playerState: {
    isTheaterMode: boolean;
    isFullscreen: boolean;
    isCompact: boolean;
    playerWidth: number;
    playerHeight: number;
  };
  metadata: {
    videoDuration: number;
    videoTitle: string;
    videoId: string;
  } | null;
}

interface OverlayElements {
  container: HTMLDivElement | null;
  root: Root | null;
}

interface OverlayStateChangeEvent {
  type: string;
  oldState: OverlayState;
  newState: OverlayState;
  timestamp: number;
}

type OverlayStateListener = (event: OverlayStateChangeEvent) => void;

class OverlayStateManager {
  private state: OverlayState;
  private elements: OverlayElements;
  private listeners: Map<string, OverlayStateListener[]> = new Map();
  private cleanupCallbacks: (() => void)[] = [];

  constructor() {
    this.state = this.getInitialState();
    this.elements = { container: null, root: null };
    this.setupStateListeners();
  }

  private getInitialState(): OverlayState {
    return {
      mode: 'inactive',
      isVisible: false,
      isCreatingGif: false,
      currentSelection: null,
      playerState: {
        isTheaterMode: false,
        isFullscreen: false,
        isCompact: false,
        playerWidth: 0,
        playerHeight: 0
      },
      metadata: null
    };
  }

  private setupStateListeners(): void {
    // Listen to extension state changes
    extensionStateManager.on('component-state-changed', (event) => {
      if (event.data && typeof event.data === 'object' && 'component' in event.data && 'isActive' in event.data) {
        const data = event.data as { component: string; isActive: boolean };
        if (data.component === 'timeline') {
          this.updateState({ isVisible: data.isActive });
        }
      }
    });

    extensionStateManager.on('gif-creation-progress-changed', (event) => {
      if (typeof event.data === 'boolean') {
        this.updateState({ isCreatingGif: event.data });
      }
    });

    // Listen to fullscreen changes
    const handleFullscreenChange = () => {
      this.updatePlayerState();
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);

    this.cleanupCallbacks.push(() => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
    });

    // Listen to window resize for player state updates
    const handleResize = () => {
      this.updatePlayerState();
    };
    
    window.addEventListener('resize', handleResize);
    this.cleanupCallbacks.push(() => {
      window.removeEventListener('resize', handleResize);
    });
  }

  // State getters
  getState(): Readonly<OverlayState> {
    return { ...this.state };
  }

  getMode(): OverlayMode {
    return this.state.mode;
  }

  isVisible(): boolean {
    return this.state.isVisible;
  }

  isCreatingGif(): boolean {
    return this.state.isCreatingGif;
  }

  getCurrentSelection(): TimelineSelection | null {
    return this.state.currentSelection ? { ...this.state.currentSelection } : null;
  }

  getPlayerState() {
    return { ...this.state.playerState };
  }

  getMetadata() {
    return this.state.metadata ? { ...this.state.metadata } : null;
  }

  // State setters
  updateState(partialState: Partial<OverlayState>): void {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...partialState };
    
    this.emitStateChange('state-updated', oldState, this.state);
  }

  setMode(mode: OverlayMode): void {
    if (this.state.mode !== mode) {
      const oldState = { ...this.state };
      this.state.mode = mode;
      
      // Update visibility based on mode
      const shouldBeVisible = mode !== 'inactive';
      if (this.state.isVisible !== shouldBeVisible) {
        this.state.isVisible = shouldBeVisible;
      }
      
      this.emitStateChange('mode-changed', oldState, this.state);
    }
  }

  setSelection(selection: TimelineSelection | null): void {
    if (JSON.stringify(this.state.currentSelection) !== JSON.stringify(selection)) {
      const oldState = { ...this.state };
      this.state.currentSelection = selection;
      
      this.emitStateChange('selection-changed', oldState, this.state);
    }
  }

  setMetadata(metadata: { videoDuration: number; videoTitle: string; videoId: string } | null): void {
    const oldState = { ...this.state };
    this.state.metadata = metadata;
    
    this.emitStateChange('metadata-changed', oldState, this.state);
  }

  updatePlayerState(): void {
    const oldState = { ...this.state };
    
    // Detect player modes
    this.state.playerState = {
      isTheaterMode: this.detectTheaterMode(),
      isFullscreen: this.detectFullscreenMode(),
      isCompact: this.detectCompactMode(),
      playerWidth: this.getPlayerWidth(),
      playerHeight: this.getPlayerHeight()
    };
    
    // Only emit if there were actual changes
    if (JSON.stringify(oldState.playerState) !== JSON.stringify(this.state.playerState)) {
      this.emitStateChange('player-state-changed', oldState, this.state);
    }
  }

  // Element management
  setElements(container: HTMLDivElement | null, root: Root | null): void {
    this.elements.container = container;
    this.elements.root = root;
  }

  getElements(): OverlayElements {
    return { ...this.elements };
  }

  // Activation and deactivation methods
  async activate(mode: OverlayMode = 'timeline'): Promise<void> {
    if (this.state.mode === 'inactive') {
      // Update player state on activation
      this.updatePlayerState();
      
      // Set mode and visibility
      this.setMode(mode);
      
      // Update extension state manager
      await extensionStateManager.updateComponentState('timeline', true);
      
      this.emitStateChange('activated', this.getInitialState(), this.state);
    }
  }

  async deactivate(): Promise<void> {
    if (this.state.mode !== 'inactive') {
      const oldState = { ...this.state };
      
      // Reset to inactive state
      this.state = this.getInitialState();
      
      // Update extension state manager
      await extensionStateManager.updateComponentState('timeline', false);
      
      this.emitStateChange('deactivated', oldState, this.state);
    }
  }

  // Player state detection helpers
  private detectTheaterMode(): boolean {
    const theaterSelectors = [
      'body[theater]',
      '.ytp-big-mode',
      '[data-theater="true"]',
      '.theater-mode'
    ];

    return theaterSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private detectFullscreenMode(): boolean {
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
    const compactSelectors = [
      '.ytp-miniplayer',
      '.miniplayer-is-active',
      '.compact-mode'
    ];

    // Check if player container is small
    const playerContainer = document.querySelector('#movie_player, .html5-video-container, video');
    if (playerContainer) {
      const rect = playerContainer.getBoundingClientRect();
      return rect.width < 400 || rect.height < 300;
    }

    return compactSelectors.some(selector => document.querySelector(selector) !== null);
  }

  private getPlayerWidth(): number {
    const playerContainer = document.querySelector('#movie_player, .html5-video-container, video');
    if (playerContainer) {
      return playerContainer.getBoundingClientRect().width;
    }
    return 0;
  }

  private getPlayerHeight(): number {
    const playerContainer = document.querySelector('#movie_player, .html5-video-container, video');
    if (playerContainer) {
      return playerContainer.getBoundingClientRect().height;
    }
    return 0;
  }

  // Navigation and cleanup handling
  handleNavigation(pageType: string, videoId?: string): void {
    const shouldDeactivate = pageType !== 'watch' && pageType !== 'shorts';
    
    if (shouldDeactivate && this.state.mode !== 'inactive') {
      // YouTube navigated away from video page, deactivate overlay
      this.deactivate();
    }
    
    // Update metadata if we have new video info
    if (videoId && pageType === 'watch') {
      this.updatePlayerState();
    }
  }

  // Event system
  on(eventType: string, listener: OverlayStateListener): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener);
  }

  off(eventType: string, listener: OverlayStateListener): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  once(eventType: string, listener: OverlayStateListener): void {
    const onceWrapper: OverlayStateListener = (event) => {
      listener(event);
      this.off(eventType, onceWrapper);
    };
    this.on(eventType, onceWrapper);
  }

  private emitStateChange(eventType: string, oldState: OverlayState, newState: OverlayState): void {
    const event: OverlayStateChangeEvent = {
      type: eventType,
      oldState: { ...oldState },
      newState: { ...newState },
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in overlay state listener for event ${eventType}:`, error);
        }
      });
    }

    // Also emit to generic listeners
    const genericListeners = this.listeners.get('*');
    if (genericListeners) {
      genericListeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in generic overlay state listener for event ${eventType}:`, error);
        }
      });
    }
  }

  // Cleanup and destruction
  destroy(): void {
    // Clean up all listeners
    this.cleanupCallbacks.forEach(cleanup => cleanup());
    this.cleanupCallbacks = [];
    
    // Clear local listeners
    this.listeners.clear();
    
    // Reset state
    this.state = this.getInitialState();
    this.elements = { container: null, root: null };
  }

  // Debug helper
  debug(): void {
    console.group('Overlay State Debug');
    console.log('Current State:', this.state);
    console.log('Listeners:', Object.entries(this.listeners)
      .map(([key, listeners]) => [key, listeners.length]));
    console.groupEnd();
  }
}

// Singleton instance
export const overlayStateManager = new OverlayStateManager();