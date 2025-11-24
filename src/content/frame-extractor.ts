// Content script frame extractor for WebCodecs integration
import { logger } from '@/lib/logger';
import { createError } from '@/lib/errors';
import { extractFramesSimple } from '@/lib/simple-frame-extractor';
import { captureInstantFrames } from '@/lib/instant-frame-capture';

export interface ContentFrameExtractionRequest {
  type: 'CONTENT_SCRIPT_EXTRACT_FRAMES';
  id?: string;
  data: {
    startTime: number;
    endTime: number;
    frameRate: number;
    targetWidth: number;
    targetHeight: number;
    quality: 'low' | 'medium' | 'high';
  };
}

/** @internal */
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
    // Message handling is now done in the main content script
    // to avoid duplicate listeners
    logger.info(
      '[ContentScriptFrameExtractor] Initialized (message handling via main content script)'
    );
  }

  public static getInstance(): ContentScriptFrameExtractor {
    if (!ContentScriptFrameExtractor.instance) {
      ContentScriptFrameExtractor.instance = new ContentScriptFrameExtractor();
    }
    return ContentScriptFrameExtractor.instance;
  }

  public static resetInstance(): void {
    ContentScriptFrameExtractor.instance = undefined as unknown as ContentScriptFrameExtractor;
  }

  // Initialize message handling from background script
  private initializeMessageHandling(): void {
    // Check if chrome.runtime is available
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'CONTENT_SCRIPT_EXTRACT_FRAMES') {
          this.handleFrameExtractionRequest(message as ContentFrameExtractionRequest, sendResponse);
          return true; // Indicate async response
        }
        return false;
      });

      logger.info('[ContentScriptFrameExtractor] Message handling initialized');
    } else {
      logger.warn(
        '[ContentScriptFrameExtractor] Chrome runtime not available for message handling'
      );
    }
  }

  // Handle frame extraction requests from background script
  public async handleFrameExtractionRequest(
    request: ContentFrameExtractionRequest,
    sendResponse: (response: ContentFrameExtractionResponse) => void
  ): Promise<void> {
    logger.info('[ContentScriptFrameExtractor] handleFrameExtractionRequest called', {
      isProcessing: this.isProcessing,
      requestData: request.data,
    });

    if (this.isProcessing) {
      logger.warn('[ContentScriptFrameExtractor] Already processing, rejecting request');
      sendResponse({
        frames: [],
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
          height: request.data.targetHeight,
        },
      });

      // Find the active video element
      logger.info('[ContentScriptFrameExtractor] Finding video element');
      const videoElement = this.findActiveVideoElement();
      if (!videoElement) {
        logger.error('[ContentScriptFrameExtractor] No video element found!');
        throw createError('video', 'No active video element found on page');
      }
      logger.info('[ContentScriptFrameExtractor] Video element found', {
        width: videoElement.videoWidth,
        height: videoElement.videoHeight,
        duration: videoElement.duration,
        currentTime: videoElement.currentTime,
        paused: videoElement.paused,
        readyState: videoElement.readyState,
      });

      // Prepare video processing options
      const processingOptions = {
        startTime: request.data.startTime,
        endTime: request.data.endTime,
        frameRate: request.data.frameRate,
        quality: request.data.quality,
        maxWidth: request.data.targetWidth,
        maxHeight: request.data.targetHeight,
      };

      // Set up progress tracking
      const onProgress = (progress: { progress: number; message: string; stage: string }) => {
        logger.debug('[ContentScriptFrameExtractor] Progress update', {
          stage: progress.stage,
          progress: progress.progress,
          message: progress.message,
        });
      };

      // Try simplified extractor with timeout (calculated based on expected frames)
      let result;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const duration = request.data.endTime - request.data.startTime;
      const expectedFrames = Math.ceil(duration * request.data.frameRate);
      // Account for buffering waits (up to 3s per frame worst case) + base processing time
      // Conservative: 3.5s per frame for slow connections, minimum 90s
      const timeoutMs = Math.max(90000, expectedFrames * 3500);

      const extractionTimeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          logger.error(
            `[ContentScriptFrameExtractor] Extraction timeout after ${timeoutMs / 1000}s`
          );
          reject(new Error('Extraction timeout'));
        }, timeoutMs);
      });

      logger.info('[ContentScriptFrameExtractor] Starting extractFramesSimple with timeout');
      try {
        result = await Promise.race([
          extractFramesSimple(videoElement, processingOptions, onProgress),
          extractionTimeout,
        ]);
        if (timeoutId) clearTimeout(timeoutId);
        logger.info('[ContentScriptFrameExtractor] extractFramesSimple completed', {
          frameCount: result.frames.length,
          method: result.metadata.extractionMethod,
        });
      } catch (timeoutError) {
        if (timeoutId) clearTimeout(timeoutId);
        logger.warn(
          '[ContentScriptFrameExtractor] Simple extraction timed out, using instant capture',
          {
            error: timeoutError instanceof Error ? timeoutError.message : 'Unknown error',
          }
        );

        // Fallback to instant capture
        const instantFrames = await captureInstantFrames(
          videoElement,
          request.data.startTime,
          request.data.endTime,
          {
            frameCount: Math.ceil(
              (request.data.endTime - request.data.startTime) * request.data.frameRate
            ),
            width: request.data.targetWidth,
            height: request.data.targetHeight,
          }
        );

        result = {
          frames: instantFrames,
          metadata: {
            totalFrames: instantFrames.length,
            actualFrameRate: instantFrames.length / (request.data.endTime - request.data.startTime),
            dimensions: { width: request.data.targetWidth, height: request.data.targetHeight },
            duration: request.data.endTime - request.data.startTime,
            extractionMethod: 'instant-fallback',
            processingTime: 0,
          },
        };
      }

      // Chrome message size limit workaround: Send frames in chunks
      logger.info('[ContentScriptFrameExtractor] Preparing response with frame chunks');

      // Send response with frames
      // Send all frames - Chrome can handle larger messages in Manifest V3
      try {
        const response: ContentFrameExtractionResponse = {
          frames: result.frames, // Send all frames
          metadata: result.metadata,
        };

        logger.info('[ContentScriptFrameExtractor] Sending complete frame response', {
          frameCount: result.frames.length,
        });

        sendResponse(response);
      } catch (error) {
        logger.error(
          '[ContentScriptFrameExtractor] Failed to send frames, sending empty response',
          { error }
        );
        sendResponse({
          frames: [],
          metadata: result.metadata,
        });
      }

      logger.info('[ContentScriptFrameExtractor] Frame extraction completed successfully', {
        frameCount: result.frames.length,
        processingTime: result.metadata.processingTime,
        method: result.metadata.extractionMethod,
      });
    } catch (error) {
      logger.error('[ContentScriptFrameExtractor] Frame extraction failed', { error });

      // Send empty response on error
      sendResponse({
        frames: [],
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
      } catch {
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
      '.html5-video-container video', // YouTube container
      '#movie_player video', // YouTube player
      'video[src*="youtube"]', // Generic YouTube video
      'video[src*="ytimg"]', // YouTube image/video
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
    return (
      video.readyState >= 2 &&
      video.videoWidth > 0 &&
      video.videoHeight > 0 &&
      video.duration > 0 &&
      !video.ended
    );
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
        dimensions: { width: 0, height: 0 },
      };
    }

    return {
      hasVideo: true,
      isPlaying: !video.paused && !video.ended,
      currentTime: video.currentTime,
      duration: video.duration || 0,
      dimensions: {
        width: video.videoWidth,
        height: video.videoHeight,
      },
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
      };

      const result = await extractFramesSimple(video, testOptions);

      logger.info('[ContentScriptFrameExtractor] Test frame extraction successful', {
        frameCount: result.frames.length,
        method: result.metadata.extractionMethod,
      });

      return result.frames.length > 0;
    } catch (error) {
      logger.error('[ContentScriptFrameExtractor] Test frame extraction failed', { error });
      return false;
    }
  }
}

// Export utility functions
export function initializeContentScriptFrameExtraction(): void {
  const extractor = ContentScriptFrameExtractor.getInstance();
  extractor.getVideoState(); // Initialize
  logger.info('[ContentScriptFrameExtractor] Initialized');
}
