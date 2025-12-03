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

// Feature voting types for user feedback
export interface ProposedFeature {
  id: string;
  name: string;
  description: string;
  category: 'sharing' | 'storage' | 'community' | 'other';
}

export interface FeatureVote {
  featureId: string;
  vote: 'up' | 'down' | null;
  votedAt: number;
}

export interface FeedbackSubmission {
  id: string;
  timestamp: number;
  featureVotes: FeatureVote[];
  suggestion?: string;
  surveyClicked: boolean;
}

export interface FeedbackData {
  firstGifCreatedAt: number | null;
  lastFeedbackPromptAt: number | null;
  feedbackCompletedAt: number | null;
  surveyLinkClickedAt: number | null;
  submissions: FeedbackSubmission[];
  milestoneFeedbackShown: {
    milestone10: boolean;
    milestone25: boolean;
    milestone50: boolean;
  };
  postSuccessFeedbackLastShown: number | null;
  postSuccessFeedbackCount: number;
}