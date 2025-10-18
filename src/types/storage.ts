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

export interface UserPreferences {
  defaultQuality: 'low' | 'medium' | 'high';
  autoDownload: boolean;
  defaultFrameRate: number;
  defaultWidth: number;
  showAdvancedOptions: boolean;
  theme: 'light' | 'dark' | 'system';
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

// Engagement tracking interface
export interface EngagementData {
  installDate: number; // timestamp
  totalGifsCreated: number;
  prompts: {
    primary: {
      shown: boolean;
      dismissedAt?: number;
      clickedAction?: 'rate' | 'share' | 'github';
    };
  };
  milestones: {
    milestone10: boolean; // shown
    milestone25: boolean;
    milestone50: boolean;
  };
  popupFooterDismissed: boolean;
}