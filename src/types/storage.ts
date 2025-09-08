export interface GifData {
  id: string;
  title: string;
  description?: string;
  blob: Blob;
  thumbnailBlob?: Blob;
  metadata: {
    width: number;
    height: number;
    duration: number;
    frameRate: number;
    fileSize: number;
    createdAt: Date;
    lastModified?: Date;
    youtubeUrl?: string;
    startTime?: number;
    endTime?: number;
    editorVersion?: number;
    originalGifId?: string; // For tracking duplicates/versions
  };
  tags: string[];
}

export interface GifMetadata {
  id: string;
  title: string;
  description?: string;
  width: number;
  height: number;
  duration: number;
  frameRate: number;
  fileSize: number;
  createdAt: Date;
  lastModified?: Date;
  youtubeUrl?: string;
  startTime?: number;
  endTime?: number;
  editorVersion?: number;
  originalGifId?: string;
  tags: string[];
}

export interface UserPreferences {
  // GIF creation settings
  defaultFrameRate: number;
  defaultQuality: number;
  maxDuration: number;
  autoSave: boolean;
  
  // UI preferences
  theme: 'light' | 'dark' | 'system';
  showThumbnails: boolean;
  gridSize: 'small' | 'medium' | 'large';
  
  // Storage settings
  maxStorageSize: number; // in MB
  autoCleanup: boolean;
  cleanupOlderThan: number; // in days
}

export interface StorageQuota {
  used: number;
  total: number;
  available: number;
}

export interface DatabaseSchema {
  version: number;
  stores: {
    gifs: {
      keyPath: 'id';
      indexes: {
        createdAt: { unique: false };
        tags: { unique: false; multiEntry: true };
        fileSize: { unique: false };
      };
    };
    thumbnails: {
      keyPath: 'gifId';
      indexes: Record<string, never>;
    };
  };
}

export type StorageEvent = 
  | { type: 'gif-added'; data: GifData }
  | { type: 'gif-updated'; data: GifData }
  | { type: 'gif-deleted'; data: { id: string } }
  | { type: 'preferences-updated'; data: Partial<UserPreferences> }
  | { type: 'storage-quota-changed'; data: StorageQuota };

export interface StorageEventListener {
  (event: StorageEvent): void;
}

// Text overlay interface for GIF text overlays
export interface TextOverlay {
  id: string;
  text: string;
  position: { x: number; y: number };
  fontSize: number;
  fontFamily: string;
  color: string;
  strokeColor?: string;
  strokeWidth?: number;
  animation?: 'none' | 'fade-in' | 'fade-out';
}

// GIF settings interface for creation parameters
export interface GifSettings {
  startTime: number;
  endTime: number;
  frameRate: number;
  resolution: string;
  quality: 'low' | 'medium' | 'high';
  speed: number;
  brightness: number;
  contrast: number;
  textOverlays?: TextOverlay[];
}

// Timeline selection interface
export interface TimelineSelection {
  startTime: number;
  endTime: number;
  duration: number;
}