import type { GifData, GifSettings } from '@/types/storage';
import type { EditorState } from '@/storage/settings-cache';
import { settingsCache } from '@/storage/settings-cache';
import { storageManager } from '@/storage';

export interface ReEditingCapabilities {
  canReEdit: boolean;
  hasOriginalVideo: boolean;
  hasCachedSettings: boolean;
  lastEditedAt?: Date;
  settingsVersion?: number;
}

export interface ReEditSession {
  gifId: string;
  gifData: GifData;
  editorState: EditorState;
  originalVideoUrl?: string;
  isNewEdit: boolean;
  capabilities: ReEditingCapabilities;
}

export interface EditorEventListener {
  onStateChange?: (session: ReEditSession) => void;
  onSettingsSaved?: (session: ReEditSession) => void;
  onEditCompleted?: (gifData: GifData) => void;
  onEditCancelled?: (session: ReEditSession) => void;
  onError?: (error: Error, session?: ReEditSession) => void;
}

export class GifEditor {
  private currentSession: ReEditSession | null = null;
  private listeners = new Set<EditorEventListener>();
  private autoSaveEnabled = true;
  private autoSaveInterval = 30000; // 30 seconds
  private autoSaveTimer: number | null = null;

  async initialize(): Promise<void> {
    await settingsCache.initialize();
  }

  async canReEditGif(gifId: string): Promise<ReEditingCapabilities> {
    try {
      const gifData = await storageManager.getGif(gifId);
      const cachedSettings = await settingsCache.getEditorState(gifId);
      
      const capabilities: ReEditingCapabilities = {
        canReEdit: !!gifData,
        hasOriginalVideo: !!(gifData?.metadata.youtubeUrl),
        hasCachedSettings: !!cachedSettings,
        lastEditedAt: cachedSettings?.editorState.lastModified,
        settingsVersion: cachedSettings?.editorState.version
      };

      return capabilities;
    } catch (error) {
      console.error('Failed to check re-editing capabilities:', error);
      return {
        canReEdit: false,
        hasOriginalVideo: false,
        hasCachedSettings: false
      };
    }
  }

  async startReEditSession(gifId: string, options: {
    useOriginalVideo?: boolean;
    restoreSettings?: boolean;
    createNewVersion?: boolean;
  } = {}): Promise<ReEditSession> {
    try {
      // Get the original GIF data
      const gifData = await storageManager.getGif(gifId);
      if (!gifData) {
        throw new Error(`GIF with ID ${gifId} not found`);
      }

      // Check capabilities
      const capabilities = await this.canReEditGif(gifId);
      if (!capabilities.canReEdit) {
        throw new Error('GIF cannot be re-edited');
      }

      // Get cached editor state or create default
      let editorState: EditorState;
      let isNewEdit = false;

      if (options.restoreSettings && capabilities.hasCachedSettings) {
        const cached = await settingsCache.getEditorState(gifId);
        editorState = cached!.editorState;
      } else {
        // Create new editor state from GIF metadata
        const baseSettings: Partial<GifSettings> = {
          startTime: gifData.metadata.startTime || 0,
          endTime: gifData.metadata.endTime || gifData.metadata.duration,
          frameRate: gifData.metadata.frameRate,
          resolution: `${gifData.metadata.width}x${gifData.metadata.height}`,
          quality: this.inferQualityFromSize(gifData.metadata.fileSize, gifData.metadata.width, gifData.metadata.height),
          textOverlays: []
        };
        
        editorState = await settingsCache.createDefaultEditorState(gifId, baseSettings);
        isNewEdit = true;
      }

      // Create the edit session
      const session: ReEditSession = {
        gifId,
        gifData,
        editorState,
        originalVideoUrl: capabilities.hasOriginalVideo ? gifData.metadata.youtubeUrl : undefined,
        isNewEdit,
        capabilities
      };

      this.currentSession = session;
      this.startAutoSave();
      this.notifyListeners('onStateChange', session);

      return session;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to start re-edit session');
      this.notifyListeners('onError', err);
      throw err;
    }
  }

  getCurrentSession(): ReEditSession | null {
    return this.currentSession;
  }

  async updateEditorState(updates: Partial<EditorState>): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active edit session');
    }

    this.currentSession.editorState = {
      ...this.currentSession.editorState,
      ...updates,
      lastModified: new Date(),
      version: this.currentSession.editorState.version + 1
    };

    this.notifyListeners('onStateChange', this.currentSession);
    
    if (this.autoSaveEnabled) {
      await this.saveCurrentState(true); // Save as temporary
    }
  }

  async saveCurrentState(isTemporary = false): Promise<void> {
    if (!this.currentSession) {
      throw new Error('No active edit session');
    }

    await settingsCache.saveEditorState(
      this.currentSession.gifId,
      this.currentSession.editorState,
      { isTemporary }
    );

    this.notifyListeners('onSettingsSaved', this.currentSession);
  }

  async exportEditedGif(outputSettings?: {
    format?: 'gif' | 'webp' | 'mp4';
    quality?: 'low' | 'medium' | 'high';
    optimization?: 'size' | 'quality' | 'balanced';
    createNewGif?: boolean;
  }): Promise<GifData> {
    if (!this.currentSession) {
      throw new Error('No active edit session');
    }

    try {
      // This would integrate with the existing GIF processing system
      // For now, we'll simulate the export process
      const exportedGif: GifData = {
        ...this.currentSession.gifData,
        id: outputSettings?.createNewGif ? this.generateId() : this.currentSession.gifId,
        metadata: {
          ...this.currentSession.gifData.metadata,
          lastModified: new Date()
        }
      };

      // Save the settings as permanent
      await this.saveCurrentState(false);
      
      // If creating a new GIF, save it to storage
      if (outputSettings?.createNewGif) {
        await storageManager.saveGif(exportedGif);
      }

      this.notifyListeners('onEditCompleted', exportedGif);
      return exportedGif;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to export edited GIF');
      this.notifyListeners('onError', err, this.currentSession);
      throw err;
    }
  }

  async cancelEditSession(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    const session = this.currentSession;
    this.stopAutoSave();
    
    // Clean up temporary state if this was a new edit
    if (session.isNewEdit) {
      await settingsCache.removeEditorState(session.gifId);
    }

    this.notifyListeners('onEditCancelled', session);
    this.currentSession = null;
  }

  async discardChanges(): Promise<void> {
    if (!this.currentSession) {
      return;
    }

    // Remove any temporary cached settings
    await settingsCache.removeEditorState(this.currentSession.gifId);
    await this.cancelEditSession();
  }

  async duplicateForEditing(originalGifId: string): Promise<ReEditSession> {
    const originalGif = await storageManager.getGif(originalGifId);
    if (!originalGif) {
      throw new Error('Original GIF not found');
    }

    // Create a new GIF ID for the duplicate
    const newGifId = this.generateId();
    
    // Copy the original GIF data with new ID
    const duplicatedGif: GifData = {
      ...originalGif,
      id: newGifId,
      title: `${originalGif.title} (Copy)`,
      metadata: {
        ...originalGif.metadata,
        createdAt: new Date()
      }
    };

    // Start editing session for the new duplicate
    const session = await this.startReEditSession(newGifId, {
      useOriginalVideo: true,
      restoreSettings: false,
      createNewVersion: true
    });

    // Update the session with duplicated data
    session.gifData = duplicatedGif;
    session.isNewEdit = true;

    return session;
  }

  async getEditHistory(gifId: string): Promise<{
    versions: Array<{
      version: number;
      lastModified: Date;
      isTemporary: boolean;
      settings: EditorState;
    }>;
    currentVersion: number;
  }> {
    // This would typically fetch from a more comprehensive version history
    // For now, we'll return the current cached state if available
    const cached = await settingsCache.getEditorState(gifId);
    
    if (!cached) {
      return {
        versions: [],
        currentVersion: 0
      };
    }

    return {
      versions: [{
        version: cached.editorState.version,
        lastModified: cached.editorState.lastModified,
        isTemporary: cached.isTemporary,
        settings: cached.editorState
      }],
      currentVersion: cached.editorState.version
    };
  }

  async restoreFromVersion(gifId: string, _version: number): Promise<ReEditSession> {
    // This would restore from a specific version in the history
    // For now, we'll start a new session with cached settings
    return this.startReEditSession(gifId, {
      restoreSettings: true
    });
  }

  setAutoSave(enabled: boolean, intervalMs?: number): void {
    this.autoSaveEnabled = enabled;
    if (intervalMs) {
      this.autoSaveInterval = intervalMs;
    }
    
    if (enabled && this.currentSession) {
      this.startAutoSave();
    } else {
      this.stopAutoSave();
    }
  }

  addEventListener(listener: EditorEventListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(listener: EditorEventListener): void {
    this.listeners.delete(listener);
  }

  private startAutoSave(): void {
    this.stopAutoSave();
    
    if (!this.autoSaveEnabled || !this.currentSession) {
      return;
    }

    this.autoSaveTimer = window.setInterval(async () => {
      if (this.currentSession) {
        try {
          await this.saveCurrentState(true);
        } catch (error) {
          console.error('Auto-save failed:', error);
        }
      }
    }, this.autoSaveInterval);
  }

  private stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  private notifyListeners(event: keyof EditorEventListener, ...args: unknown[]): void {
    this.listeners.forEach(listener => {
      try {
        const handler = listener[event];
        if (handler) {
          (handler as (...args: unknown[]) => void)(...args);
        }
      } catch (error) {
        console.error('Error in editor event listener:', error);
      }
    });
  }

  private generateId(): string {
    return `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private inferQualityFromSize(fileSize: number, width: number, height: number): 'low' | 'medium' | 'high' {
    const pixelCount = width * height;
    const bytesPerPixel = fileSize / pixelCount;
    
    // These are rough heuristics
    if (bytesPerPixel < 0.5) return 'low';
    if (bytesPerPixel < 1.5) return 'medium';
    return 'high';
  }

  async cleanup(): Promise<void> {
    this.stopAutoSave();
    if (this.currentSession) {
      await this.cancelEditSession();
    }
    this.listeners.clear();
  }
}

// Singleton instance
export const gifEditor = new GifEditor();