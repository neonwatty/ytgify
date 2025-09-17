// Simplified frame extraction that captures frames in real-time without seeking
import { logger } from './logger';
import { createError } from './errors';

export interface SimpleFrameExtractionOptions {
  startTime: number;
  endTime: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
}

export interface SimpleFrameExtractionResult {
  frames: ImageData[];
  metadata: {
    totalFrames: number;
    actualFrameRate: number;
    dimensions: { width: number; height: number };
    duration: number;
    extractionMethod: 'simple-capture';
    processingTime: number;
  };
}

export async function extractFramesSimple(
  videoElement: HTMLVideoElement,
  options: SimpleFrameExtractionOptions,
  onProgress?: (progress: { progress: number; message: string; stage: string }) => void
): Promise<SimpleFrameExtractionResult> {
  const startTime = performance.now();
  
  try {
    logger.info('[SimpleFrameExtractor] Starting simplified frame extraction');
    
    // Calculate dimensions - use reasonable defaults while maintaining aspect ratio
    const aspectRatio = videoElement.videoWidth / videoElement.videoHeight;
    const maxWidth = options.maxWidth || 640; // Default 640px width
    const maxHeight = options.maxHeight || 360; // Default 360px height
    
    let width = videoElement.videoWidth;
    let height = videoElement.videoHeight;

    // Apply quality scaling
    const qualityScale = options.quality === 'low' ? 0.5 :
                        options.quality === 'medium' ? 0.75 : 1.0;

    // Scale based on quality first
    width = width * qualityScale;
    height = height * qualityScale;

    // Then apply max constraints while maintaining aspect ratio
    if (width > maxWidth) {
      width = maxWidth;
      height = width / aspectRatio;
    }
    if (height > maxHeight) {
      height = maxHeight;
      width = height * aspectRatio;
    }

    // Ensure even dimensions for video encoding
    width = Math.floor(width / 2) * 2;
    height = Math.floor(height / 2) * 2;
    
    // Create canvas for frame capture
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw createError('video', 'Failed to create canvas context');
    }
    
    const frames: ImageData[] = [];
    const duration = options.endTime - options.startTime;
    // Calculate frame count based on duration and frame rate
    const requestedFrameCount = Math.ceil(duration * options.frameRate);
    const targetFrameCount = requestedFrameCount; // No artificial limit
    
    logger.info('[SimpleFrameExtractor] Frame count calculated', {
      requestedFrameCount,
      targetFrameCount
    });
    const captureInterval = duration / targetFrameCount;
    
    logger.info('[SimpleFrameExtractor] Capture settings', {
      duration,
      targetFrameCount,
      captureInterval,
      dimensions: { width, height }
    });
    
    // Store original state
    const originalTime = videoElement.currentTime;
    const wasPlaying = !videoElement.paused;
    
    // Ultra-simple approach: Just capture frames at current position with small increments
    logger.info('[SimpleFrameExtractor] Using ultra-simple instant capture method');
    
    // Pause video for stable capture
    videoElement.pause();
    
    // Move to start position if needed
    if (videoElement.currentTime < options.startTime || videoElement.currentTime > options.endTime) {
      videoElement.currentTime = options.startTime;
    }
    
    // Calculate frame times
    const frameInterval = duration / targetFrameCount;
    
    // Capture frames by incrementing currentTime
    logger.info('[SimpleFrameExtractor] Starting frame capture loop', { targetFrameCount });
    for (let i = 0; i < targetFrameCount; i++) {
      const captureTime = options.startTime + (i * frameInterval);
      
      logger.debug(`[SimpleFrameExtractor] Setting video time to ${captureTime.toFixed(2)}s for frame ${i + 1}`);
      // Set video to capture time
      videoElement.currentTime = Math.min(captureTime, options.endTime);
      
      // Small delay to let frame render
      logger.debug(`[SimpleFrameExtractor] Waiting 100ms for frame to render`);
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture frame
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(videoElement, 0, 0, width, height);
      
      const imageData = ctx.getImageData(0, 0, width, height);
      frames.push(imageData);
      
      // Report progress
      if (onProgress) {
        const progress = ((i + 1) / targetFrameCount) * 100;
        onProgress({
          progress,
          message: `Captured ${i + 1}/${targetFrameCount} frames`,
          stage: 'extracting'
        });
      }
      
      logger.info(`[SimpleFrameExtractor] Captured frame ${i + 1}/${targetFrameCount} at ${captureTime.toFixed(2)}s`);
    }
    logger.info('[SimpleFrameExtractor] Frame capture loop completed', { capturedFrames: frames.length });
    
    // Restore original state
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play().catch(() => {});
    }
    
    const processingTime = performance.now() - startTime;
    
    logger.info('[SimpleFrameExtractor] Extraction complete', {
      framesCaptured: frames.length,
      processingTime
    });
    
    return {
      frames,
      metadata: {
        totalFrames: frames.length,
        actualFrameRate: frames.length / duration,
        dimensions: { width, height },
        duration,
        extractionMethod: 'simple-capture',
        processingTime
      }
    };
    
  } catch (error) {
    logger.error('[SimpleFrameExtractor] Frame extraction failed', { error });
    throw createError('video', `Frame extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}