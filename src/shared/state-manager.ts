import { UserPreferences } from '@/types/storage';
import { chromeStorageManager } from '@/storage/chrome-storage';

export interface ExtensionRuntimeState {
  isYouTubePage: boolean;
  currentVideoId?: string;
  currentVideoTitle?: string;
  playerReady: boolean;
  gifCreationInProgress: boolean;
  activeJobs: string[];
  componentStates: {
    timeline: boolean;
    editor: boolean;
    popup: boolean;
  };
}

export interface StateChangeEvent<T = unknown> {
  type: string;
  data: T;
  timestamp: number;
}

export type StateListener<T = unknown> = (event: StateChangeEvent<T>) => void;

export class ExtensionStateManager {
  private runtimeState: ExtensionRuntimeState;
  private listeners: Map<string, StateListener[]> = new Map();
  private readonly STATE_KEY = 'extensionRuntimeState';

  constructor() {
    this.runtimeState = this.getInitialState();
    this.setupStorageListener();
    this.initializeFromStorage();
  }

  private getInitialState(): ExtensionRuntimeState {
    return {
      isYouTubePage: false,
      currentVideoId: undefined,
      currentVideoTitle: undefined,
      playerReady: false,
      gifCreationInProgress: false,
      activeJobs: [],
      componentStates: {
        timeline: false,
        editor: false,
        popup: false
      }
    };
  }

  private setupStorageListener(): void {
    chromeStorageManager.addEventListener((event) => {
      if (event.type === 'preferences-updated') {
        this.emit('preferences-changed', event.data);
      }
    });
  }

  private async initializeFromStorage(): Promise<void> {
    try {
      // Only access storage in background/popup context, not content scripts
      if (this.isStorageContext() && chrome.storage?.session) {
        const result = await chrome.storage.session.get(this.STATE_KEY);
        if (result[this.STATE_KEY]) {
          this.runtimeState = { ...this.runtimeState, ...result[this.STATE_KEY] };
        }
      }
    } catch (error) {
      // Only log storage errors in extension context, not content scripts
      if (this.isStorageContext()) {
        console.warn('Failed to initialize from storage:', error);
      }
      // Content scripts will silently skip storage operations
    }
  }

  private async persistState(): Promise<void> {
    try {
      // Only access storage in background/popup context, not content scripts
      if (this.isStorageContext() && chrome.storage?.session) {
        await chrome.storage.session.set({
          [this.STATE_KEY]: this.runtimeState
        });
      }
    } catch (error) {
      // Only log storage errors in extension context, not content scripts
      if (this.isStorageContext()) {
        console.warn('Failed to persist state:', error);
      }
      // Content scripts will silently skip storage operations
    }
  }

  private isStorageContext(): boolean {
    // Only allow storage access in background/popup context, never in content scripts
    try {
      // Content scripts run in the page context, not extension context
      if (typeof window !== 'undefined' && window.location && 
          window.location.protocol !== 'chrome-extension:') {
        return false;
      }
      
      // Check if we have proper chrome extension context
      return typeof chrome !== 'undefined' && 
             chrome.runtime && 
             !!chrome.runtime.id && 
             (chrome.runtime.getURL('').includes('chrome-extension://') || 
              (typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:'));
    } catch (error) {
      return false;
    }
  }

  // Runtime state getters
  getRuntimeState(): Readonly<ExtensionRuntimeState> {
    return { ...this.runtimeState };
  }

  isYouTubePage(): boolean {
    return this.runtimeState.isYouTubePage;
  }

  getCurrentVideoId(): string | undefined {
    return this.runtimeState.currentVideoId;
  }

  getCurrentVideoTitle(): string | undefined {
    return this.runtimeState.currentVideoTitle;
  }

  isPlayerReady(): boolean {
    return this.runtimeState.playerReady;
  }

  isGifCreationInProgress(): boolean {
    return this.runtimeState.gifCreationInProgress;
  }

  getActiveJobs(): string[] {
    return [...this.runtimeState.activeJobs];
  }

  getComponentState(component: keyof ExtensionRuntimeState['componentStates']): boolean {
    return this.runtimeState.componentStates[component];
  }

  // Runtime state setters
  async updateYouTubePage(isYouTubePage: boolean, videoId?: string, videoTitle?: string): Promise<void> {
    const oldState = this.runtimeState.isYouTubePage;
    const oldVideoId = this.runtimeState.currentVideoId;

    this.runtimeState.isYouTubePage = isYouTubePage;
    this.runtimeState.currentVideoId = videoId;
    this.runtimeState.currentVideoTitle = videoTitle;

    if (oldState !== isYouTubePage) {
      this.emit('youtube-page-changed', { isYouTubePage, videoId, videoTitle });
    }

    if (oldVideoId !== videoId) {
      this.emit('video-changed', { videoId, videoTitle });
    }

    await this.persistState();
  }

  async updatePlayerReady(ready: boolean): Promise<void> {
    if (this.runtimeState.playerReady !== ready) {
      this.runtimeState.playerReady = ready;
      this.emit('player-ready-changed', ready);
      await this.persistState();
    }
  }

  async updateGifCreationProgress(inProgress: boolean): Promise<void> {
    if (this.runtimeState.gifCreationInProgress !== inProgress) {
      this.runtimeState.gifCreationInProgress = inProgress;
      this.emit('gif-creation-progress-changed', inProgress);
      await this.persistState();
    }
  }

  async addActiveJob(jobId: string): Promise<void> {
    if (!this.runtimeState.activeJobs.includes(jobId)) {
      this.runtimeState.activeJobs.push(jobId);
      this.emit('active-jobs-changed', this.runtimeState.activeJobs);
      await this.persistState();
    }
  }

  async removeActiveJob(jobId: string): Promise<void> {
    const index = this.runtimeState.activeJobs.indexOf(jobId);
    if (index > -1) {
      this.runtimeState.activeJobs.splice(index, 1);
      this.emit('active-jobs-changed', this.runtimeState.activeJobs);
      await this.persistState();
    }
  }

  async updateComponentState(
    component: keyof ExtensionRuntimeState['componentStates'],
    isActive: boolean
  ): Promise<void> {
    if (this.runtimeState.componentStates[component] !== isActive) {
      this.runtimeState.componentStates[component] = isActive;
      this.emit('component-state-changed', { component, isActive });
      await this.persistState();
    }
  }

  // User preferences delegation
  async getPreferences(): Promise<UserPreferences> {
    return chromeStorageManager.getPreferences();
  }

  async savePreferences(preferences: Partial<UserPreferences>): Promise<void> {
    await chromeStorageManager.savePreferences(preferences);
  }

  async updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ): Promise<void> {
    await chromeStorageManager.updatePreference(key, value);
  }

  async resetPreferences(): Promise<void> {
    await chromeStorageManager.resetPreferences();
  }

  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    return chromeStorageManager.getTheme();
  }

  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    await chromeStorageManager.setTheme(theme);
  }

  async getGifSettings(): Promise<{
    frameRate: number;
    quality: number;
    maxDuration: number;
    autoSave: boolean;
  }> {
    return chromeStorageManager.getGifSettings();
  }

  // Event system
  on<T = unknown>(eventType: string, listener: StateListener<T>): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(listener as StateListener);
  }

  off<T = unknown>(eventType: string, listener: StateListener<T>): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      const index = eventListeners.indexOf(listener as StateListener);
      if (index > -1) {
        eventListeners.splice(index, 1);
      }
    }
  }

  once<T = unknown>(eventType: string, listener: StateListener<T>): void {
    const onceWrapper: StateListener<T> = (event) => {
      listener(event);
      this.off(eventType, onceWrapper);
    };
    this.on(eventType, onceWrapper);
  }

  private emit<T = unknown>(eventType: string, data: T): void {
    const event: StateChangeEvent<T> = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    const listeners = this.listeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(event);
        } catch (error) {
          console.error(`Error in state listener for event ${eventType}:`, error);
        }
      });
    }
  }

  // Utility methods
  async clearRuntimeState(): Promise<void> {
    this.runtimeState = this.getInitialState();
    await this.persistState();
    this.emit('state-cleared', null);
  }

  async getFullState(): Promise<{
    runtime: ExtensionRuntimeState;
    preferences: UserPreferences;
  }> {
    const preferences = await this.getPreferences();
    return {
      runtime: this.getRuntimeState(),
      preferences
    };
  }

  // Debug helper
  debug(): void {
    console.group('Extension State Debug');
    console.log('Runtime State:', this.runtimeState);
    console.log('Registered Listeners:', Object.fromEntries(
      Array.from(this.listeners.entries()).map(([key, listeners]) => [key, listeners.length])
    ));
    console.groupEnd();
  }
}

// Singleton instance
export const extensionStateManager = new ExtensionStateManager();