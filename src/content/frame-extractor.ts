// Content script frame extractor for WebCodecs integration
import { logger } from '@/lib/logger';
import { createError } from '@/lib/errors';
import { extractVideoFrames } from '@/lib/video-processor';

export interface ContentFrameExtractionRequest {
  type: 'CONTENT_SCRIPT_EXTRACT_FRAMES';
  data: {
    startTime: number;
    endTime: number;
    frameRate: number;
    targetWidth: number;
    targetHeight: number;
    quality: 'low' | 'medium' | 'high';
  };
}

export interface ContentFrameExtractionResponse {
  frames: ImageData[];
  metadata?: {
    totalFrames: number;
    actualFrameRate: number;
    dimensions: { width: number; height: number };
    duration: number;
    extractionMethod: string;
    processingTime: number;
  };
}

export class ContentScriptFrameExtractor {
  private static instance: ContentScriptFrameExtractor;
  private isProcessing = false;

  private constructor() {
    this.initializeMessageHandling();
  }

  public static getInstance(): ContentScriptFrameExtractor {
    if (!ContentScriptFrameExtractor.instance) {
      ContentScriptFrameExtractor.instance = new ContentScriptFrameExtractor();
    }
    return ContentScriptFrameExtractor.instance;
  }

  // Initialize message handling from background script
  private initializeMessageHandling(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'CONTENT_SCRIPT_EXTRACT_FRAMES') {
        this.handleFrameExtractionRequest(message as ContentFrameExtractionRequest, sendResponse);
        return true; // Indicate async response
      }
      return false;
    });

    logger.info('[ContentScriptFrameExtractor] Message handling initialized');
  }

  // Handle frame extraction requests from background script
  private async handleFrameExtractionRequest(
    request: ContentFrameExtractionRequest,
    sendResponse: (response: ContentFrameExtractionResponse) => void
  ): Promise<void> {
    if (this.isProcessing) {
      sendResponse({
        frames: []
      });
      return;
    }

    this.isProcessing = true;

    try {
      logger.info('[ContentScriptFrameExtractor] Processing frame extraction request', {
        startTime: request.data.startTime,
        endTime: request.data.endTime,
        frameRate: request.data.frameRate,
        targetDimensions: {
          width: request.data.targetWidth,
          height: request.data.targetHeight
        }
      });

      // Find the active video element
      const videoElement = this.findActiveVideoElement();
      if (!videoElement) {
        throw createError('video', 'No active video element found on page');
      }

      // Prepare video processing options
      const processingOptions = {
        startTime: request.data.startTime,
        endTime: request.data.endTime,
        frameRate: request.data.frameRate,
        quality: request.data.quality,
        maxWidth: request.data.targetWidth,
        maxHeight: request.data.targetHeight,
        enableWebCodecs: true
      };

      // Set up progress tracking
      const onProgress = (progress: { progress: number; message: string; stage: string }) => {
        logger.debug('[ContentScriptFrameExtractor] Progress update', {
          stage: progress.stage,
          progress: progress.progress,
          message: progress.message
        });
      };

      // Extract frames using the video processor
      const result = await extractVideoFrames(videoElement, processingOptions, onProgress);

      // Send response back to background script
      const response: ContentFrameExtractionResponse = {
        frames: result.frames,
        metadata: result.metadata
      };

      sendResponse(response);

      logger.info('[ContentScriptFrameExtractor] Frame extraction completed successfully', {
        frameCount: result.frames.length,
        processingTime: result.metadata.processingTime,
        method: result.metadata.extractionMethod
      });

    } catch (error) {
      logger.error('[ContentScriptFrameExtractor] Frame extraction failed', { error });
      
      // Send empty response on error
      sendResponse({
        frames: []
      });
    } finally {
      this.isProcessing = false;
    }
  }

  // Find the currently active video element on the page
  private findActiveVideoElement(): HTMLVideoElement | null {
    // Try to find YouTube video element first
    let videoElement = this.findYouTubeVideoElement();
    
    if (videoElement) {
      logger.debug('[ContentScriptFrameExtractor] Found YouTube video element');
      return videoElement;
    }

    // Fallback to any video element
    videoElement = document.querySelector('video') as HTMLVideoElement;
    
    if (videoElement) {
      logger.debug('[ContentScriptFrameExtractor] Found generic video element');
      return videoElement;
    }

    // Try to find video in iframes (for embedded videos)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (iframeDoc) {
          const iframeVideo = iframeDoc.querySelector('video') as HTMLVideoElement;
          if (iframeVideo) {
            logger.debug('[ContentScriptFrameExtractor] Found video element in iframe');
            return iframeVideo;
          }
        }
      } catch (error) {
        // Ignore cross-origin iframe access errors
        logger.debug('[ContentScriptFrameExtractor] Cannot access iframe content (cross-origin)');
      }
    }

    logger.warn('[ContentScriptFrameExtractor] No video element found on page');
    return null;
  }

  // Specifically find YouTube video element using YouTube's selectors
  private findYouTubeVideoElement(): HTMLVideoElement | null {
    // YouTube uses specific selectors for video elements
    const selectors = [
      'video.video-stream.html5-main-video', // Main YouTube video
      '.html5-video-container video',        // YouTube container
      '#movie_player video',                 // YouTube player
      'video[src*="youtube"]',              // Generic YouTube video
      'video[src*="ytimg"]',                // YouTube image/video
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLVideoElement;
      if (element && element.readyState >= 2) {
        // Ensure video is ready for processing
        return element;
      }
    }

    return null;
  }

  // Check if video is ready for processing
  private isVideoReady(video: HTMLVideoElement): boolean {
    return video.readyState >= 2 && 
           video.videoWidth > 0 && 
           video.videoHeight > 0 && 
           video.duration > 0 && 
           !video.ended;
  }

  // Get video state information
  public getVideoState(): {
    hasVideo: boolean;
    isPlaying: boolean;
    currentTime: number;
    duration: number;
    dimensions: { width: number; height: number };
  } {
    const video = this.findActiveVideoElement();
    
    if (!video) {
      return {
        hasVideo: false,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        dimensions: { width: 0, height: 0 }
      };
    }

    return {
      hasVideo: true,
      isPlaying: !video.paused && !video.ended,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      dimensions: {
        width: video.videoWidth,
        height: video.videoHeight
      }
    };
  }

  // Test frame extraction capability
  public async testFrameExtraction(): Promise<boolean> {
    try {
      const video = this.findActiveVideoElement();
      if (!video || !this.isVideoReady(video)) {
        return false;
      }

      // Test with a small extraction
      const testOptions = {
        startTime: video.currentTime,
        endTime: Math.min(video.currentTime + 1, video.duration),
        frameRate: 1,
        quality: 'low' as const,
        maxWidth: 320,
        maxHeight: 240,
        enableWebCodecs: true
      };

      const result = await extractVideoFrames(video, testOptions);
      
      logger.info('[ContentScriptFrameExtractor] Test frame extraction successful', {
        frameCount: result.frames.length,
        method: result.metadata.extractionMethod
      });
      
      return result.frames.length > 0;
    } catch (error) {
      logger.error('[ContentScriptFrameExtractor] Test frame extraction failed', { error });
      return false;
    }
  }
}

// Initialize the content script frame extractor
export const contentScriptFrameExtractor = ContentScriptFrameExtractor.getInstance();

// Export utility functions
export function initializeContentScriptFrameExtraction(): void {
  contentScriptFrameExtractor.getVideoState(); // Initialize
  logger.info('[ContentScriptFrameExtractor] Initialized');
}

export function getContentScriptVideoState() {
  return contentScriptFrameExtractor.getVideoState();
}

export async function testContentScriptFrameExtraction(): Promise<boolean> {
  return contentScriptFrameExtractor.testFrameExtraction();
}