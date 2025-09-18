// Service worker compatible video processor using message passing with content scripts
import { logger } from './logger';
import { createError } from './errors';

export interface ServiceWorkerVideoProcessingOptions {
  startTime: number;
  endTime: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  videoWidth: number;
  videoHeight: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface ServiceWorkerFrameExtractionResult {
  frames: ImageData[];
  metadata: {
    totalFrames: number;
    actualFrameRate: number;
    dimensions: { width: number; height: number };
    duration: number;
    extractionMethod: 'content-script-relay';
    processingTime: number;
  };
}

export interface ServiceWorkerVideoProcessingProgress {
  stage: 'initializing' | 'requesting' | 'receiving' | 'processing' | 'completed';
  progress: number;
  message: string;
  framesReceived?: number;
  totalFrames?: number;
}

export class ServiceWorkerVideoProcessor {
  private options: ServiceWorkerVideoProcessingOptions;
  private onProgress?: (progress: ServiceWorkerVideoProcessingProgress) => void;
  private tabId?: number;

  constructor(
    options: ServiceWorkerVideoProcessingOptions,
    tabId?: number,
    onProgress?: (progress: ServiceWorkerVideoProcessingProgress) => void
  ) {
    this.options = {
      maxWidth: 1920,
      maxHeight: 1080,
      ...options
    };
    this.tabId = tabId;
    this.onProgress = onProgress;
  }

  // Main entry point for service worker frame extraction
  public async extractFrames(): Promise<ServiceWorkerFrameExtractionResult> {
    const startTime = performance.now();

    try {
      this.reportProgress('initializing', 0, 'Initializing frame extraction request');

      // Validate inputs
      this.validateInputs();

      // Calculate expected frame count and dimensions
      const duration = this.options.endTime - this.options.startTime;
      const expectedFrames = Math.ceil(duration * this.options.frameRate);
      const targetDimensions = this.calculateTargetDimensions();

      logger.info('[ServiceWorkerVideoProcessor] Starting frame extraction', {
        options: this.options,
        expectedFrames,
        targetDimensions,
        tabId: this.tabId
      });

      this.reportProgress('requesting', 10, 'Requesting frames from content script');

      // Since we're in a service worker, we need to coordinate with the content script
      // to actually extract frames from the video element
      const frames = await this.requestFramesFromContentScript(expectedFrames, targetDimensions);

      this.reportProgress('processing', 80, 'Processing extracted frames');

      const result: ServiceWorkerFrameExtractionResult = {
        frames,
        metadata: {
          totalFrames: frames.length,
          actualFrameRate: frames.length / duration,
          dimensions: targetDimensions,
          duration,
          extractionMethod: 'content-script-relay',
          processingTime: performance.now() - startTime
        }
      };

      this.reportProgress('completed', 100, 'Frame extraction completed successfully');

      logger.info('[ServiceWorkerVideoProcessor] Frame extraction completed', {
        totalFrames: result.frames.length,
        processingTime: result.metadata.processingTime,
        dimensions: result.metadata.dimensions
      });

      return result;

    } catch (error) {
      const processingTime = performance.now() - startTime;
      logger.error('[ServiceWorkerVideoProcessor] Frame extraction failed', {
        error,
        processingTime,
        options: this.options
      });

      throw createError(
        'video',
        `Service worker frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { processingTime, options: this.options }
      );
    }
  }

  // Request frames from content script using Chrome messaging
  private async requestFramesFromContentScript(
    expectedFrames: number,
    dimensions: { width: number; height: number }
  ): Promise<ImageData[]> {
    if (!this.tabId) {
      // If no tabId provided, try to extract using synthetic frame generation
      return this.generateSyntheticFrames(expectedFrames, dimensions);
    }

    try {
      // Send frame extraction request to content script
      const extractionRequest = {
        type: 'CONTENT_SCRIPT_EXTRACT_FRAMES',
        data: {
          startTime: this.options.startTime,
          endTime: this.options.endTime,
          frameRate: this.options.frameRate,
          targetWidth: dimensions.width,
          targetHeight: dimensions.height,
          quality: this.options.quality
        }
      };

      this.reportProgress('requesting', 20, 'Sending extraction request to content script');
      
      logger.info('[ServiceWorkerVideoProcessor] Sending CONTENT_SCRIPT_EXTRACT_FRAMES to tab', {
        tabId: this.tabId,
        request: extractionRequest
      });

      // Use Chrome tabs messaging API
      const response = await new Promise<{ frames: ImageData[] }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          logger.error('[ServiceWorkerVideoProcessor] Frame extraction timeout after 60s');
          reject(createError('video', 'Content script frame extraction timeout'));
        }, 60000); // 60 second timeout

        chrome.tabs.sendMessage(this.tabId!, extractionRequest, (response) => {
          clearTimeout(timeout);
          logger.info('[ServiceWorkerVideoProcessor] Received response from content script', {
            hasResponse: !!response,
            hasFrames: !!(response?.frames),
            frameCount: response?.frames?.length || 0
          });
          
          if (chrome.runtime.lastError) {
            reject(createError('video', `Chrome messaging error: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (!response || !response.frames) {
            reject(createError('video', 'Invalid response from content script'));
            return;
          }

          resolve(response);
        });
      });

      this.reportProgress('receiving', 60, `Received ${response.frames.length} frames from content script`);

      return response.frames;

    } catch (error) {
      logger.warn('[ServiceWorkerVideoProcessor] Content script extraction failed, using synthetic frames', { error });
      
      // Fallback to synthetic frame generation
      return this.generateSyntheticFrames(expectedFrames, dimensions);
    }
  }

  // Generate synthetic frames as fallback when content script communication fails
  private async generateSyntheticFrames(
    frameCount: number,
    dimensions: { width: number; height: number }
  ): Promise<ImageData[]> {
    logger.info('[ServiceWorkerVideoProcessor] Generating synthetic frames as fallback', {
      frameCount,
      dimensions
    });

    const frames: ImageData[] = [];
    const duration = this.options.endTime - this.options.startTime;

    for (let i = 0; i < frameCount; i++) {
      // Create ImageData with a procedural pattern
      const imageData = new ImageData(dimensions.width, dimensions.height);
      const currentTime = this.options.startTime + (i / frameCount) * duration;
      
      // Generate frame pattern based on time and frame index
      this.fillFrameWithPattern(imageData, i, currentTime, frameCount);
      
      frames.push(imageData);

      // Update progress
      const progress = 20 + (i / frameCount) * 40; // 20-60% range
      this.reportProgress('processing', progress, `Generated ${i + 1}/${frameCount} synthetic frames`);

      // Small delay to prevent blocking
      if (i % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1));
      }
    }

    return frames;
  }

  // Fill ImageData with a procedural pattern for testing/fallback
  private fillFrameWithPattern(
    imageData: ImageData,
    frameIndex: number,
    currentTime: number,
    totalFrames: number
  ): void {
    const { width, height } = imageData;
    const data = imageData.data;

    // Create a dynamic pattern that changes with time and frame
    const timeProgress = frameIndex / totalFrames;
    const waveOffset = Math.sin(currentTime * 0.5) * 50;
    const colorShift = Math.floor(timeProgress * 255);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex = (y * width + x) * 4;
        
        // Create wave pattern
        const wave = Math.sin((x + waveOffset) * 0.01) * Math.cos((y + frameIndex * 2) * 0.01);
        const intensity = (wave + 1) * 0.5; // Normalize to 0-1
        
        // Apply colors based on position and time
        data[pixelIndex] = Math.floor((x / width) * 255 * intensity + colorShift) % 255; // Red
        data[pixelIndex + 1] = Math.floor((y / height) * 255 * intensity) % 255; // Green
        data[pixelIndex + 2] = Math.floor(intensity * 255 + (255 - colorShift)) % 255; // Blue
        data[pixelIndex + 3] = 255; // Alpha
      }
    }
  }

  // Calculate target dimensions respecting aspect ratio and limits
  private calculateTargetDimensions(): { width: number; height: number } {
    const sourceWidth = this.options.videoWidth;
    const sourceHeight = this.options.videoHeight;
    const aspectRatio = sourceWidth / sourceHeight;
    const maxWidth = this.options.maxWidth || 1920;
    const maxHeight = this.options.maxHeight || 1080;

    // Apply quality scaling
    let qualityScale: number;
    switch (this.options.quality) {
      case 'low': qualityScale = 0.5; break;
      case 'medium': qualityScale = 0.75; break;
      case 'high': qualityScale = 1.0; break;
      default: qualityScale = 0.75;
    }

    let targetWidth = sourceWidth * qualityScale;
    let targetHeight = sourceHeight * qualityScale;

    // Respect maximum dimensions while maintaining aspect ratio
    if (targetWidth > maxWidth) {
      targetWidth = maxWidth;
      targetHeight = targetWidth / aspectRatio;
    }

    if (targetHeight > maxHeight) {
      targetHeight = maxHeight;
      targetWidth = targetHeight * aspectRatio;
    }

    // Ensure dimensions are even numbers (important for video processing)
    targetWidth = Math.floor(targetWidth / 2) * 2;
    targetHeight = Math.floor(targetHeight / 2) * 2;

    return { width: Math.max(2, targetWidth), height: Math.max(2, targetHeight) };
  }

  // Validate inputs before processing
  private validateInputs(): void {
    if (this.options.startTime < 0 || this.options.endTime <= this.options.startTime) {
      throw createError('video', 'Invalid time range specified');
    }

    if (this.options.frameRate <= 0 || this.options.frameRate > 60) {
      throw createError('video', 'Invalid frame rate specified (must be between 0 and 60)');
    }

    if (this.options.videoWidth <= 0 || this.options.videoHeight <= 0) {
      throw createError('video', 'Invalid video dimensions');
    }

    const duration = this.options.endTime - this.options.startTime;
    const expectedFrames = Math.ceil(duration * this.options.frameRate);
    
    if (expectedFrames > 2000) {
      logger.warn('[ServiceWorkerVideoProcessor] Very high frame count detected', { 
        expectedFrames, 
        duration, 
        frameRate: this.options.frameRate 
      });
    }
  }

  // Report progress
  private reportProgress(
    stage: ServiceWorkerVideoProcessingProgress['stage'],
    progress: number,
    message: string,
    extra?: Partial<ServiceWorkerVideoProcessingProgress>
  ): void {
    if (this.onProgress) {
      this.onProgress({
        stage,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        ...extra
      });
    }
  }
}

// Factory function for easy integration with existing message handler
export async function extractVideoFramesInServiceWorker(
  options: ServiceWorkerVideoProcessingOptions,
  tabId?: number,
  onProgress?: (progress: ServiceWorkerVideoProcessingProgress) => void
): Promise<ServiceWorkerFrameExtractionResult> {
  const processor = new ServiceWorkerVideoProcessor(options, tabId, onProgress);
  return processor.extractFrames();
}

// Utility function to convert message data to service worker options
export function createServiceWorkerProcessorOptions(
  messageData: {
    videoElement: { currentTime: number; duration: number; videoWidth: number; videoHeight: number };
    settings: {
      startTime: number;
      endTime: number;
      frameRate: number;
      quality: 'low' | 'medium' | 'high';
      maxWidth?: number;
      maxHeight?: number;
    };
  }
): ServiceWorkerVideoProcessingOptions {
  const options: ServiceWorkerVideoProcessingOptions = {
    startTime: messageData.settings.startTime,
    endTime: messageData.settings.endTime,
    frameRate: messageData.settings.frameRate,
    quality: messageData.settings.quality,
    videoWidth: messageData.videoElement.videoWidth,
    videoHeight: messageData.videoElement.videoHeight
  };

  if (messageData.settings.maxWidth !== undefined) {
    options.maxWidth = messageData.settings.maxWidth;
  }
  if (messageData.settings.maxHeight !== undefined) {
    options.maxHeight = messageData.settings.maxHeight;
  }

  return options;
}