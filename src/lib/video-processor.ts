// Advanced video frame extraction using WebCodecs API and Canvas fallback
import { logger } from './logger';
import { createError } from './errors';

export interface VideoProcessingOptions {
  startTime: number;
  endTime: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
  enableWebCodecs?: boolean;
}

export interface FrameExtractionResult {
  frames: ImageData[];
  metadata: {
    totalFrames: number;
    actualFrameRate: number;
    dimensions: { width: number; height: number };
    duration: number;
    extractionMethod: 'webcodecs' | 'canvas' | 'hybrid';
    processingTime: number;
  };
}

export interface VideoProcessingProgress {
  stage: 'initializing' | 'extracting' | 'processing' | 'finalizing' | 'completed';
  progress: number;
  message: string;
  framesExtracted?: number;
  totalFrames?: number;
}

export class VideoProcessor {
  private options: VideoProcessingOptions;
  private onProgress?: (progress: VideoProcessingProgress) => void;
  private canvas?: OffscreenCanvas;
  private ctx?: OffscreenCanvasRenderingContext2D;
  private abortController?: AbortController;

  constructor(
    options: VideoProcessingOptions,
    onProgress?: (progress: VideoProcessingProgress) => void
  ) {
    this.options = {
      enableWebCodecs: true,
      maxWidth: 1920,
      maxHeight: 1080,
      ...options
    };
    this.onProgress = onProgress;
    this.abortController = new AbortController();
  }

  // Main entry point for frame extraction
  public async extractFrames(videoElement: HTMLVideoElement): Promise<FrameExtractionResult> {
    const startTime = performance.now();

    try {
      this.reportProgress('initializing', 0, 'Initializing video processing');

      // Validate video element and options
      this.validateInputs(videoElement);

      // Determine the best extraction method
      const extractionMethod = await this.determineExtractionMethod(videoElement);
      
      logger.info('[VideoProcessor] Starting frame extraction', {
        method: extractionMethod,
        options: this.options,
        videoDimensions: {
          width: videoElement.videoWidth,
          height: videoElement.videoHeight,
          duration: videoElement.duration
        }
      });

      let result: FrameExtractionResult;

      switch (extractionMethod) {
        case 'webcodecs':
          result = await this.extractFramesWithWebCodecs(videoElement);
          break;
        case 'canvas':
          result = await this.extractFramesWithCanvas(videoElement);
          break;
        case 'hybrid':
          result = await this.extractFramesHybrid(videoElement);
          break;
        default:
          throw createError('video', `Unsupported extraction method: ${extractionMethod}`);
      }

      result.metadata.processingTime = performance.now() - startTime;
      this.reportProgress('completed', 100, 'Frame extraction completed successfully');

      logger.info('[VideoProcessor] Frame extraction completed', {
        totalFrames: result.frames.length,
        method: result.metadata.extractionMethod,
        processingTime: result.metadata.processingTime,
        dimensions: result.metadata.dimensions
      });

      return result;

    } catch (error) {
      const processingTime = performance.now() - startTime;
      logger.error('[VideoProcessor] Frame extraction failed', {
        error,
        processingTime,
        options: this.options
      });

      throw createError(
        'video',
        `Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { processingTime, options: this.options }
      );
    }
  }

  // WebCodecs-based frame extraction for maximum performance
  private async extractFramesWithWebCodecs(videoElement: HTMLVideoElement): Promise<FrameExtractionResult> {
    if (!('VideoDecoder' in globalThis) || !('VideoFrame' in globalThis)) {
      throw createError('video', 'WebCodecs API not available');
    }

    const frames: ImageData[] = [];
    const duration = this.options.endTime - this.options.startTime;
    const expectedFrames = Math.ceil(duration * this.options.frameRate);
    
    this.reportProgress('extracting', 10, 'Setting up WebCodecs decoder');

    try {
      // For Chrome extension context, we need to work with the video stream
      // Since we can't directly decode arbitrary video streams in WebCodecs without
      // proper demuxing, we'll use a hybrid approach that leverages VideoFrame
      // from the existing video element
      
      const { width, height } = this.calculateTargetDimensions(
        videoElement.videoWidth,
        videoElement.videoHeight
      );

      // Create canvas for frame processing
      if (!this.canvas) {
        this.canvas = new OffscreenCanvas(width, height);
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
          throw createError('video', 'Failed to create canvas context');
        }
        this.ctx = ctx;
      }

      // Calculate frame timestamps
      const frameInterval = 1 / this.options.frameRate;
      let frameCount = 0;

      for (let time = this.options.startTime; time < this.options.endTime && frameCount < expectedFrames; time += frameInterval) {
        if (this.abortController?.signal.aborted) {
          throw createError('video', 'Frame extraction aborted');
        }

        // Seek to the specific time and capture frame
        await this.seekToTime(videoElement, time);
        
        // Create VideoFrame from current video element state
        const videoFrame = new VideoFrame(videoElement, {
          timestamp: time * 1000000, // Convert to microseconds
        });

        try {
          // Convert VideoFrame to ImageData
          const imageData = await this.videoFrameToImageData(videoFrame, width, height);
          frames.push(imageData);
          frameCount++;

          // Update progress
          const progress = 10 + (frameCount / expectedFrames) * 70; // 10-80% range
          this.reportProgress('extracting', progress, `Extracted ${frameCount}/${expectedFrames} frames`);

        } finally {
          videoFrame.close(); // Important: close VideoFrame to prevent memory leaks
        }

        // Small delay to prevent blocking
        if (frameCount % 10 === 0) {
          await this.delay(1);
        }
      }

      this.reportProgress('finalizing', 90, 'Finalizing frame data');

      return {
        frames,
        metadata: {
          totalFrames: frames.length,
          actualFrameRate: frames.length / duration,
          dimensions: { width, height },
          duration,
          extractionMethod: 'webcodecs',
          processingTime: 0 // Will be set by caller
        }
      };

    } catch (error) {
      logger.error('[VideoProcessor] WebCodecs extraction failed', { error });
      
      // Fallback to canvas method
      logger.info('[VideoProcessor] Falling back to canvas extraction');
      return this.extractFramesWithCanvas(videoElement);
    }
  }

  // Canvas-based frame extraction as fallback
  private async extractFramesWithCanvas(videoElement: HTMLVideoElement): Promise<FrameExtractionResult> {
    const frames: ImageData[] = [];
    const duration = this.options.endTime - this.options.startTime;
    const expectedFrames = Math.ceil(duration * this.options.frameRate);
    
    this.reportProgress('extracting', 10, 'Setting up canvas extraction');

    const { width, height } = this.calculateTargetDimensions(
      videoElement.videoWidth,
      videoElement.videoHeight
    );

    // Create canvas for frame processing
    if (!this.canvas) {
      this.canvas = new OffscreenCanvas(width, height);
      const ctx = this.canvas.getContext('2d');
      if (!ctx) {
        throw createError('video', 'Failed to create canvas context');
      }
      this.ctx = ctx;
    }

    // Calculate frame intervals
    const frameInterval = 1 / this.options.frameRate;
    let frameCount = 0;

    for (let time = this.options.startTime; time < this.options.endTime && frameCount < expectedFrames; time += frameInterval) {
      if (this.abortController?.signal.aborted) {
        throw createError('video', 'Frame extraction aborted');
      }

      // Seek to specific time
      await this.seekToTime(videoElement, time);

      // Draw current frame to canvas
      if (this.ctx) {
        this.ctx.clearRect(0, 0, width, height);
        this.ctx.drawImage(videoElement, 0, 0, width, height);

        // Extract ImageData
        const imageData = this.ctx.getImageData(0, 0, width, height);
        frames.push(imageData);
        frameCount++;
      }

      // Update progress
      const progress = 10 + (frameCount / expectedFrames) * 70; // 10-80% range
      this.reportProgress('extracting', progress, `Extracted ${frameCount}/${expectedFrames} frames`);

      // Small delay to prevent blocking
      if (frameCount % 5 === 0) {
        await this.delay(5);
      }
    }

    this.reportProgress('finalizing', 90, 'Finalizing frame data');

    return {
      frames,
      metadata: {
        totalFrames: frames.length,
        actualFrameRate: frames.length / duration,
        dimensions: { width, height },
        duration,
        extractionMethod: 'canvas',
        processingTime: 0 // Will be set by caller
      }
    };
  }

  // Hybrid extraction method combining WebCodecs and Canvas
  private async extractFramesHybrid(videoElement: HTMLVideoElement): Promise<FrameExtractionResult> {
    // Try WebCodecs first, fall back to canvas on error
    try {
      const result = await this.extractFramesWithWebCodecs(videoElement);
      result.metadata.extractionMethod = 'hybrid';
      return result;
    } catch (error) {
      logger.warn('[VideoProcessor] WebCodecs failed in hybrid mode, using canvas', { error });
      const result = await this.extractFramesWithCanvas(videoElement);
      result.metadata.extractionMethod = 'hybrid';
      return result;
    }
  }

  // Convert VideoFrame to ImageData using canvas
  private async videoFrameToImageData(videoFrame: VideoFrame, targetWidth: number, targetHeight: number): Promise<ImageData> {
    if (!this.ctx) {
      throw createError('video', 'Canvas context not initialized');
    }

    // Clear canvas and draw VideoFrame
    this.ctx.clearRect(0, 0, targetWidth, targetHeight);
    this.ctx.drawImage(videoFrame, 0, 0, targetWidth, targetHeight);

    // Extract ImageData
    return this.ctx.getImageData(0, 0, targetWidth, targetHeight);
  }

  // Seek video to specific time with proper waiting
  private async seekToTime(videoElement: HTMLVideoElement, time: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (Math.abs(videoElement.currentTime - time) < 0.1) {
        // Already close enough to target time
        resolve();
        return;
      }

      const timeoutId = setTimeout(() => {
        videoElement.removeEventListener('seeked', onSeeked);
        reject(createError('video', `Seek timeout for time ${time}`));
      }, 2000);

      const onSeeked = () => {
        clearTimeout(timeoutId);
        videoElement.removeEventListener('seeked', onSeeked);
        resolve();
      };

      videoElement.addEventListener('seeked', onSeeked);
      videoElement.currentTime = time;
    });
  }

  // Determine the best extraction method based on environment and video
  private async determineExtractionMethod(_videoElement: HTMLVideoElement): Promise<'webcodecs' | 'canvas' | 'hybrid'> {
    // Check WebCodecs availability and user preference
    const hasWebCodecs = 'VideoDecoder' in globalThis && 'VideoFrame' in globalThis;
    
    if (!hasWebCodecs) {
      logger.info('[VideoProcessor] WebCodecs not available, using canvas method');
      return 'canvas';
    }

    if (!this.options.enableWebCodecs) {
      logger.info('[VideoProcessor] WebCodecs disabled by options, using canvas method');
      return 'canvas';
    }

    // Check video characteristics
    const videoDuration = this.options.endTime - this.options.startTime;
    const expectedFrames = Math.ceil(videoDuration * this.options.frameRate);
    
    // For shorter videos or lower frame counts, canvas is often sufficient
    if (videoDuration < 10 || expectedFrames < 100) {
      logger.info('[VideoProcessor] Short video detected, using canvas method');
      return 'canvas';
    }

    // Use hybrid for maximum reliability
    logger.info('[VideoProcessor] Using hybrid extraction method');
    return 'hybrid';
  }

  // Calculate target dimensions respecting aspect ratio and limits
  private calculateTargetDimensions(sourceWidth: number, sourceHeight: number): { width: number; height: number } {
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
  private validateInputs(videoElement: HTMLVideoElement): void {
    if (!videoElement || !(videoElement instanceof HTMLVideoElement)) {
      throw createError('video', 'Invalid video element provided');
    }

    if (videoElement.readyState < 2) {
      throw createError('video', 'Video element not ready for processing');
    }

    if (this.options.startTime < 0 || this.options.endTime <= this.options.startTime) {
      throw createError('video', 'Invalid time range specified');
    }

    if (this.options.endTime > videoElement.duration) {
      throw createError('video', 'End time exceeds video duration');
    }

    if (this.options.frameRate <= 0 || this.options.frameRate > 60) {
      throw createError('video', 'Invalid frame rate specified (must be between 0 and 60)');
    }

    const duration = this.options.endTime - this.options.startTime;
    const expectedFrames = Math.ceil(duration * this.options.frameRate);
    
    if (expectedFrames > 1000) {
      logger.warn('[VideoProcessor] High frame count detected, performance may be impacted', { 
        expectedFrames, 
        duration, 
        frameRate: this.options.frameRate 
      });
    }
  }

  // Utility methods
  private reportProgress(
    stage: VideoProcessingProgress['stage'],
    progress: number,
    message: string,
    extra?: Partial<VideoProcessingProgress>
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

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Abort ongoing processing
  public abort(): void {
    this.abortController?.abort();
    logger.info('[VideoProcessor] Processing aborted by user request');
  }

  // Cleanup resources
  public cleanup(): void {
    this.abort();
    this.canvas = undefined;
    this.ctx = undefined;
    logger.debug('[VideoProcessor] Resources cleaned up');
  }
}

// Factory function for easy integration
export async function extractVideoFrames(
  videoElement: HTMLVideoElement,
  options: VideoProcessingOptions,
  onProgress?: (progress: VideoProcessingProgress) => void
): Promise<FrameExtractionResult> {
  const processor = new VideoProcessor(options, onProgress);
  
  try {
    return await processor.extractFrames(videoElement);
  } finally {
    processor.cleanup();
  }
}

// Utility function to create video processor from message data
export function createVideoProcessorFromMessage(
  messageData: {
    videoElement: { currentTime: number; duration: number; videoWidth: number; videoHeight: number };
    settings: { startTime: number; endTime: number; frameRate: number; quality: 'low' | 'medium' | 'high' };
  }
): VideoProcessingOptions {
  return {
    startTime: messageData.settings.startTime,
    endTime: messageData.settings.endTime,
    frameRate: messageData.settings.frameRate,
    quality: messageData.settings.quality,
    enableWebCodecs: true
  };
}