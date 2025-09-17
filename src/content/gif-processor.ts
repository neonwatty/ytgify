// Content Script GIF Processor - Handles complete GIF creation in content script
import { logger } from '@/lib/logger';
import { createError } from '@/lib/errors';
import { SimpleEncoderFactory } from '@/lib/encoders/simple-encoder-factory';
import { FrameData, EncoderOptions } from '@/lib/encoders/base-encoder';
import { TextOverlay } from '@/types';

export interface GifProcessingOptions {
  startTime: number;
  endTime: number;
  frameRate?: number;
  width?: number;
  height?: number;
  quality?: 'low' | 'medium' | 'high';
  textOverlays?: TextOverlay[];
}

export interface GifProcessingResult {
  blob: Blob;
  metadata: {
    fileSize: number;
    duration: number;
    frameCount: number;
    width: number;
    height: number;
    id: string;
  };
}

export interface StageProgressInfo {
  stage: string;
  stageNumber: number;
  totalStages: number;
  stageName: string;
  message: string;
  progress: number;
}

export class ContentScriptGifProcessor {
  private static instance: ContentScriptGifProcessor;
  private isProcessing = false;
  private messageTimer: NodeJS.Timeout | null = null;
  private currentStage: string | null = null;
  private messageIndex = 0;
  private progressCallback: ((stageInfo: StageProgressInfo) => void) | undefined = undefined;

  // Stage definitions
  private stages = {
    CAPTURING: {
      name: 'Capturing Frames',
      icon: '📹',
      messages: [
        'Reading video data...',
        'Extracting frames...',
        'Processing frame timings...',
        'Capturing pixel data...',
        'Organizing frame sequence...',
      ],
    },
    ANALYZING: {
      name: 'Analyzing Colors',
      icon: '🎨',
      messages: [
        'Scanning color distribution...',
        'Finding dominant colors...',
        'Building color histogram...',
        'Optimizing palette...',
        'Reducing to 256 colors...',
      ],
    },
    ENCODING: {
      name: 'Encoding GIF',
      icon: '🔧',
      messages: [
        'Initializing encoder...',
        'Writing frame data...',
        'Applying compression...',
        'Optimizing frame deltas...',
        'Processing animations...',
      ],
    },
    FINALIZING: {
      name: 'Finalizing',
      icon: '✨',
      messages: [
        'Writing file headers...',
        'Optimizing file size...',
        'Preparing for download...',
        'Final quality checks...',
        'Almost ready...',
      ],
    },
  };

  private constructor() {}

  public static getInstance(): ContentScriptGifProcessor {
    if (!ContentScriptGifProcessor.instance) {
      ContentScriptGifProcessor.instance = new ContentScriptGifProcessor();
    }
    return ContentScriptGifProcessor.instance;
  }

  private updateStage(stageName: keyof typeof this.stages) {
    this.currentStage = stageName;
    this.messageIndex = 0;
    this.startMessageCycling();

    const stageInfo: StageProgressInfo = {
      stage: stageName,
      stageNumber: this.getStageNumber(stageName),
      totalStages: 4,
      stageName: this.stages[stageName].name,
      message: this.stages[stageName].messages[0],
      progress: this.getStageProgress(stageName),
    };

    this.progressCallback?.(stageInfo);
  }

  private getStageNumber(stageName: keyof typeof this.stages): number {
    const stageOrder = ['CAPTURING', 'ANALYZING', 'ENCODING', 'FINALIZING'];
    return stageOrder.indexOf(stageName) + 1;
  }

  private getStageProgress(stageName: keyof typeof this.stages): number {
    const stageNumber = this.getStageNumber(stageName);
    return ((stageNumber - 1) / 4) * 100;
  }

  private startMessageCycling() {
    // Clear existing timer
    if (this.messageTimer) clearInterval(this.messageTimer);

    if (!this.currentStage) return;

    // Cycle through messages every 3000ms
    this.messageTimer = setInterval(() => {
      if (!this.currentStage) return;

      const stage = this.stages[this.currentStage as keyof typeof this.stages];
      this.messageIndex = (this.messageIndex + 1) % stage.messages.length;

      const stageInfo: StageProgressInfo = {
        stage: this.currentStage,
        stageNumber: this.getStageNumber(this.currentStage as keyof typeof this.stages),
        totalStages: 4,
        stageName: stage.name,
        message: stage.messages[this.messageIndex],
        progress: this.getStageProgress(this.currentStage as keyof typeof this.stages),
      };

      this.progressCallback?.(stageInfo);
    }, 3000);
  }

  private stopMessageCycling() {
    if (this.messageTimer) {
      clearInterval(this.messageTimer);
      this.messageTimer = null;
    }
  }

  /**
   * Process video element to GIF entirely in content script
   */
  public async processVideoToGif(
    videoElement: HTMLVideoElement,
    options: GifProcessingOptions,
    onProgress?: (stageInfo: StageProgressInfo) => void
  ): Promise<GifProcessingResult> {
    if (this.isProcessing) {
      throw createError('gif', 'Already processing a GIF');
    }

    this.isProcessing = true;
    this.progressCallback = onProgress;
    const startTime = performance.now();

    try {
      logger.info('[ContentScriptGifProcessor] Starting GIF processing', { options });

      // Stage 1: Capturing Frames
      this.updateStage('CAPTURING');
      const frames = await this.captureFrames(videoElement, options);
      logger.info('[ContentScriptGifProcessor] Frames captured', { count: frames.length });

      // Stage 2: Analyzing Colors
      this.updateStage('ANALYZING');
      // Simulate color analysis time
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Stage 3: Encoding GIF
      this.updateStage('ENCODING');
      const gifBlob = await this.encodeGif(frames, options);
      logger.info('[ContentScriptGifProcessor] GIF encoded', { size: gifBlob.size });

      // Stage 4: Finalizing
      this.updateStage('FINALIZING');
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Generate metadata
      const metadata = {
        fileSize: gifBlob.size,
        duration: options.endTime - options.startTime,
        frameCount: frames.length,
        width: frames[0]?.width || 320,
        height: frames[0]?.height || 240,
        id: `gif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      };

      // Complete
      this.stopMessageCycling();
      const finalStageInfo: StageProgressInfo = {
        stage: 'COMPLETED',
        stageNumber: 4,
        totalStages: 4,
        stageName: 'Complete',
        message: '✅ GIF created successfully!',
        progress: 100,
      };
      onProgress?.(finalStageInfo);

      const processingTime = performance.now() - startTime;
      logger.info('[ContentScriptGifProcessor] Processing complete', {
        processingTime,
        metadata,
      });

      return { blob: gifBlob, metadata };
    } finally {
      this.isProcessing = false;
      this.stopMessageCycling();
      this.progressCallback = undefined;
    }
  }

  /**
   * Capture frames from video element
   */
  private async captureFrames(
    videoElement: HTMLVideoElement,
    options: GifProcessingOptions
  ): Promise<HTMLCanvasElement[]> {
    const { startTime, endTime, frameRate = 5, width = 480, height = 270 } = options;
    const duration = endTime - startTime;
    // Calculate proper frame count based on duration and frame rate
    const rawFrameCount = Math.ceil(duration * frameRate);
    const frameCount = rawFrameCount; // No artificial limit
    const frameInterval = duration / frameCount;

    logger.info('[ContentScriptGifProcessor] Capturing frames', {
      frameCount,
      frameInterval,
      dimensions: { width, height },
    });

    // Calculate actual dimensions maintaining aspect ratio
    const videoAspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    const targetAspectRatio = width / height;

    let actualWidth: number;
    let actualHeight: number;

    // Check if requested dimensions already maintain the video's aspect ratio (within 2% tolerance)
    const aspectRatioTolerance = 0.02;
    const aspectRatioDifference = Math.abs(videoAspectRatio - targetAspectRatio) / videoAspectRatio;

    if (aspectRatioDifference <= aspectRatioTolerance) {
      // Requested dimensions already maintain aspect ratio - use them directly
      actualWidth = width;
      actualHeight = height;
      logger.info(
        '[ContentScriptGifProcessor] Using requested dimensions (aspect ratio preserved)',
        {
          aspectRatioDifference: `${(aspectRatioDifference * 100).toFixed(1)}%`,
        }
      );
    } else {
      // Fit video within requested dimensions while maintaining aspect ratio
      if (videoAspectRatio > targetAspectRatio) {
        // Video is wider than target - fit to width
        actualWidth = width;
        actualHeight = Math.round(width / videoAspectRatio);
      } else {
        // Video is taller than target - fit to height
        actualHeight = height;
        actualWidth = Math.round(height * videoAspectRatio);
      }
      logger.info('[ContentScriptGifProcessor] Adjusted dimensions to maintain aspect ratio', {
        requestedRatio: targetAspectRatio,
        videoRatio: videoAspectRatio,
        adjustment: videoAspectRatio > targetAspectRatio ? 'fit-to-width' : 'fit-to-height',
      });
    }

    // Ensure even dimensions for video encoding
    actualWidth = Math.floor(actualWidth / 2) * 2;
    actualHeight = Math.floor(actualHeight / 2) * 2;

    logger.info('[ContentScriptGifProcessor] Calculated dimensions', {
      video: { width: videoElement.videoWidth, height: videoElement.videoHeight },
      requested: { width, height },
      actual: { width: actualWidth, height: actualHeight },
      videoAspectRatio,
      targetAspectRatio,
    });

    const frames: HTMLCanvasElement[] = [];

    // Store original state
    const originalTime = videoElement.currentTime;
    const wasPlaying = !videoElement.paused;

    // Pause for stable capture
    videoElement.pause();

    for (let i = 0; i < frameCount; i++) {
      const captureTime = startTime + i * frameInterval;

      // Seek to capture time
      videoElement.currentTime = captureTime;

      // Wait for seek to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Create canvas for this frame
      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw createError('gif', 'Failed to create canvas context');
      }

      // Draw video frame to canvas
      ctx.drawImage(videoElement, 0, 0, actualWidth, actualHeight);
      frames.push(canvas);

      // Export frame data for verification (in dev mode)
      if (typeof window !== 'undefined') {
        const win = window as Window & {
          __DEBUG_CAPTURED_FRAMES?: Array<{
            frameNumber: number;
            videoTime: number;
            width: number;
            height: number;
            dataUrl: string;
          }>;
        };
        if (!win.__DEBUG_CAPTURED_FRAMES) {
          win.__DEBUG_CAPTURED_FRAMES = [];
        }
        // Convert canvas to data URL for debugging
        const frameDataUrl = canvas.toDataURL('image/png');
        win.__DEBUG_CAPTURED_FRAMES.push({
          frameNumber: i + 1,
          videoTime: captureTime,
          width: actualWidth,
          height: actualHeight,
          dataUrl: frameDataUrl,
        });
      }

      logger.debug(`[ContentScriptGifProcessor] Captured frame ${i + 1}/${frameCount}`);
    }

    // Restore video state
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play().catch(() => {});
    }

    return frames;
  }

  /**
   * Encode frames to GIF using encoder abstraction
   */
  private async encodeGif(
    frames: HTMLCanvasElement[],
    options: GifProcessingOptions
  ): Promise<Blob> {
    const { frameRate = 10, quality = 'medium' } = options;

    try {
      // Create encoder options
      const encoderOptions: EncoderOptions = {
        width: frames[0].width,
        height: frames[0].height,
        quality: quality,
        frameRate: frameRate,
        loop: 0, // Loop forever
        debug: true, // Enable debug logging
      };

      // Create GIF encoder using factory
      const encoder = SimpleEncoderFactory.createEncoder('gifenc', encoderOptions);

      // Convert canvas frames to encoder format
      const frameData: FrameData[] = frames.map((canvas, index) => {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          throw new Error(`Failed to get context for frame ${index + 1}`);
        }

        // Apply text overlays if specified
        if (options.textOverlays && options.textOverlays.length > 0) {
          options.textOverlays.forEach((overlay) => {
            ctx.save();

            // Set font properties
            ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
            ctx.fillStyle = overlay.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Calculate actual position (overlay.position is in percentage)
            const x = (overlay.position.x / 100) * canvas.width;
            const y = (overlay.position.y / 100) * canvas.height;

            // Add text stroke for better visibility
            if (overlay.strokeColor) {
              ctx.strokeStyle = overlay.strokeColor;
              ctx.lineWidth = overlay.strokeWidth || 2;
              ctx.strokeText(overlay.text, x, y);
            } else {
              // Default black stroke for better visibility
              ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
              ctx.lineWidth = 2;
              ctx.strokeText(overlay.text, x, y);
            }

            // Draw the text
            ctx.fillText(overlay.text, x, y);

            ctx.restore();
          });
        }

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return {
          data: imageData,
          width: canvas.width,
          height: canvas.height,
        };
      });

      // Encode frames (stage handling is done at higher level)
      const result = await encoder.encode(frameData);

      logger.info('[ContentScriptGifProcessor] GIF encoding finished with gifenc', {
        size: result.size,
        frameCount: result.frameCount,
        duration: result.duration,
      });

      return result.blob;
    } catch (error) {
      console.error('[ContentScriptGifProcessor] Failed to encode GIF:', error);
      logger.error('[ContentScriptGifProcessor] Failed to encode GIF', { error });
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw createError('gif', `Failed to encode GIF: ${errorMessage}`);
    }
  }

  /**
   * Save GIF to IndexedDB
   */
  public async saveGifToStorage(blob: Blob, metadata: Record<string, unknown>): Promise<string> {
    return new Promise((resolve, reject) => {
      const dbName = 'YouTubeGifStore';

      const request = indexedDB.open(dbName, 3);

      request.onerror = () => {
        reject(createError('storage', 'Failed to open IndexedDB'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('gifs')) {
          const gifsStore = db.createObjectStore('gifs', { keyPath: 'id' });
          gifsStore.createIndex('createdAt', 'metadata.createdAt', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['gifs'], 'readwrite');
        const store = transaction.objectStore('gifs');

        const gifData = {
          id: metadata.id,
          blob,
          metadata: {
            ...metadata,
            createdAt: new Date().toISOString(),
            url: window.location.href,
            title: document.title,
          },
        };

        const addRequest = store.add(gifData);

        addRequest.onsuccess = () => {
          logger.info('[ContentScriptGifProcessor] GIF saved to IndexedDB', {
            id: (metadata as { id: string }).id,
          });
          resolve((metadata as { id: string }).id);
        };

        addRequest.onerror = () => {
          reject(createError('storage', 'Failed to save GIF to IndexedDB'));
        };
      };
    });
  }

  /**
   * Trigger download of GIF
   */
  public async downloadGif(blob: Blob, filename?: string): Promise<void> {
    const url = URL.createObjectURL(blob);
    const name = filename || `youtube-gif-${Date.now()}.gif`;

    // Send download request to background script
    chrome.runtime.sendMessage(
      {
        type: 'DOWNLOAD_GIF',
        data: {
          url,
          filename: name,
        },
      },
      (response) => {
        // Clean up blob URL after download starts
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if (response?.success) {
          logger.info('[ContentScriptGifProcessor] Download initiated', { filename: name });
        } else {
          logger.error('[ContentScriptGifProcessor] Download failed', { error: response?.error });
        }
      }
    );
  }
}

// Export singleton instance
export const gifProcessor = ContentScriptGifProcessor.getInstance();
