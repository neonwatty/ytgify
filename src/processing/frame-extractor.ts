/**
 * WebCodecs-based frame extraction system
 * Optimized for performance with <100ms per frame extraction target
 */

import { GifSettings, TimelineSelection } from '@/types';
import { performanceTracker } from '@/monitoring/performance-tracker';
import { metricsCollector } from '@/monitoring/metrics-collector';
import { parseResolution } from '@/utils/resolution-parser';

interface FrameExtractionConfig {
  startTime: number;
  endTime: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  maxWidth?: number;
  maxHeight?: number;
}

export interface ExtractedFrame {
  imageData: ImageData;
  timestamp: number;
  frameIndex: number;
}

interface FrameExtractionResult {
  frames: ExtractedFrame[];
  metadata: {
    totalFrames: number;
    actualFrameRate: number;
    duration: number;
    width: number;
    height: number;
  };
}

interface FrameExtractionProgress {
  framesExtracted: number;
  totalFrames: number;
  currentTimestamp: number;
  elapsedTime: number;
}

class FrameExtractor {
  private decoder: VideoDecoder | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private extractedFrames: ExtractedFrame[] = [];
  private isExtracting = false;
  private abortController: AbortController | null = null;
  private progressCallback?: (progress: FrameExtractionProgress) => void;
  private startTime = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('Failed to get 2D rendering context');
    }
    this.ctx = context;
  }

  /**
   * Check if WebCodecs API is supported
   */
  static isSupported(): boolean {
    return (
      typeof VideoDecoder !== 'undefined' &&
      typeof VideoEncoder !== 'undefined' &&
      typeof VideoFrame !== 'undefined'
    );
  }

  /**
   * Extract frames from video element using WebCodecs
   */
  async extractFrames(
    videoElement: HTMLVideoElement,
    config: FrameExtractionConfig,
    onProgress?: (progress: FrameExtractionProgress) => void
  ): Promise<FrameExtractionResult> {
    if (this.isExtracting) {
      throw new Error('Frame extraction already in progress');
    }

    if (!FrameExtractor.isSupported()) {
      throw new Error('WebCodecs API not supported in this browser');
    }

    this.isExtracting = true;
    this.progressCallback = onProgress;
    this.startTime = performance.now();
    this.extractedFrames = [];
    this.abortController = new AbortController();

    // Start overall extraction monitoring
    const sessionId = `extraction-${Date.now()}`;
    metricsCollector.startOperation(sessionId);
    metricsCollector.recordUserAction('frame-extraction-started', {
      config: {
        duration: config.endTime - config.startTime,
        frameRate: config.frameRate,
        quality: config.quality,
      },
    });

    try {
      const result = await this.performExtraction(videoElement, config);

      // Record successful completion
      const totalTime = metricsCollector.endOperation(sessionId, 'frame-extraction', {
        framesExtracted: result.frames.length,
        dimensions: `${result.metadata.width}x${result.metadata.height}`,
      });

      metricsCollector.recordUserAction('frame-extraction-completed', {
        totalFrames: result.frames.length,
        totalTime,
        averageTimePerFrame: totalTime / result.frames.length,
      });

      return result;
    } catch (error) {
      // Record extraction failure
      metricsCollector.recordError({
        type: 'frame-extraction-error',
        message: error instanceof Error ? error.message : 'Unknown error',
        context: { config },
      });
      throw error;
    } finally {
      this.cleanup();
    }
  }

  /**
   * Cancel ongoing frame extraction
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  private async performExtraction(
    videoElement: HTMLVideoElement,
    config: FrameExtractionConfig
  ): Promise<FrameExtractionResult> {
    const duration = config.endTime - config.startTime;
    const targetFrameCount = Math.ceil(duration * config.frameRate);
    const frameInterval = 1 / config.frameRate;

    // Record memory usage before extraction
    await performanceTracker.recordMemoryUsage();

    // Set up canvas dimensions based on quality and constraints
    const dimensions = this.calculateOutputDimensions(
      videoElement.videoWidth,
      videoElement.videoHeight,
      config
    );

    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;

    // Extract frames by seeking through the video
    const timestamps: number[] = [];
    for (let i = 0; i < targetFrameCount; i++) {
      const timestamp = config.startTime + i * frameInterval;
      if (timestamp <= config.endTime) {
        timestamps.push(timestamp);
      }
    }

    // Process each timestamp
    for (let i = 0; i < timestamps.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('Frame extraction cancelled');
      }

      const timestamp = timestamps[i];
      const frame = await this.extractFrameAtTime(videoElement, timestamp, i);
      this.extractedFrames.push(frame);

      // Report progress
      if (this.progressCallback) {
        const elapsedTime = performance.now() - this.startTime;
        this.progressCallback({
          framesExtracted: i + 1,
          totalFrames: timestamps.length,
          currentTimestamp: timestamp,
          elapsedTime,
        });
      }
    }

    return {
      frames: this.extractedFrames,
      metadata: {
        totalFrames: this.extractedFrames.length,
        actualFrameRate: this.extractedFrames.length / duration,
        duration,
        width: dimensions.width,
        height: dimensions.height,
      },
    };
  }

  private async extractFrameAtTime(
    videoElement: HTMLVideoElement,
    timestamp: number,
    frameIndex: number
  ): Promise<ExtractedFrame> {
    const frameStartTime = performance.now();
    const operationId = `frame-extraction-${frameIndex}`;

    // Start monitoring this frame extraction
    performanceTracker.startTimer(operationId);

    // Seek to the timestamp
    videoElement.currentTime = timestamp;

    // Wait for seek to complete
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('Seek timeout'));
      }, 5000);

      const onSeeked = () => {
        cleanup();
        resolve();
      };

      const onError = () => {
        cleanup();
        reject(new Error('Seek failed'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        videoElement.removeEventListener('seeked', onSeeked);
        videoElement.removeEventListener('error', onError);
      };

      videoElement.addEventListener('seeked', onSeeked, { once: true });
      videoElement.addEventListener('error', onError, { once: true });
    });

    // Draw frame to canvas
    this.ctx.drawImage(
      videoElement,
      0,
      0,
      videoElement.videoWidth,
      videoElement.videoHeight,
      0,
      0,
      this.canvas.width,
      this.canvas.height
    );

    // Extract ImageData
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);

    const extractionTime = performance.now() - frameStartTime;

    // End monitoring and record metrics
    performanceTracker.endTimer(operationId, 'frame-extraction', {
      frameIndex,
      timestamp,
      dimensions: `${this.canvas.width}x${this.canvas.height}`,
    });

    // Record frame extraction metrics
    metricsCollector.trackFrameExtraction(frameIndex, extractionTime, true);

    // Log performance warning if extraction takes too long
    if (extractionTime > 100) {
      console.warn(`Frame extraction took ${extractionTime.toFixed(2)}ms (target: <100ms)`);
      // Also record this as a performance issue
      metricsCollector.recordError({
        type: 'performance-warning',
        message: `Slow frame extraction: ${extractionTime.toFixed(2)}ms`,
        context: { frameIndex, timestamp, target: 100 },
      });
    }

    return {
      imageData,
      timestamp,
      frameIndex,
    };
  }

  private calculateOutputDimensions(
    sourceWidth: number,
    sourceHeight: number,
    config: FrameExtractionConfig
  ): { width: number; height: number } {
    const aspectRatio = sourceWidth / sourceHeight;

    let targetWidth = sourceWidth;
    let targetHeight = sourceHeight;

    // Apply quality-based scaling
    const qualityScale = this.getQualityScale(config.quality);
    targetWidth = Math.floor(sourceWidth * qualityScale);
    targetHeight = Math.floor(sourceHeight * qualityScale);

    // Apply max dimension constraints
    if (config.maxWidth && targetWidth > config.maxWidth) {
      targetWidth = config.maxWidth;
      targetHeight = Math.floor(targetWidth / aspectRatio);
    }

    if (config.maxHeight && targetHeight > config.maxHeight) {
      targetHeight = config.maxHeight;
      targetWidth = Math.floor(targetHeight * aspectRatio);
    }

    // Ensure dimensions are even numbers (better for video encoding)
    targetWidth = targetWidth % 2 === 0 ? targetWidth : targetWidth - 1;
    targetHeight = targetHeight % 2 === 0 ? targetHeight : targetHeight - 1;

    return { width: targetWidth, height: targetHeight };
  }

  private getQualityScale(quality: 'low' | 'medium' | 'high'): number {
    switch (quality) {
      case 'low':
        return 0.5; // 50% of original size
      case 'medium':
        return 0.75; // 75% of original size
      case 'high':
        return 1.0; // Original size
      default:
        return 0.75;
    }
  }

  private cleanup(): void {
    this.isExtracting = false;
    this.progressCallback = undefined;
    this.abortController = null;

    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
  }

  /**
   * Utility function to create frame extraction config from GIF settings and timeline selection
   */
  static createConfigFromSelection(
    selection: TimelineSelection,
    settings: GifSettings
  ): FrameExtractionConfig {
    // Parse resolution string to get dimensions
    const dimensions = parseResolution(settings.resolution);

    // If original resolution is selected, don't set max dimensions
    const config: FrameExtractionConfig = {
      startTime: selection.startTime,
      endTime: selection.endTime,
      frameRate: settings.frameRate,
      quality: settings.quality,
    };

    // Only set max dimensions if not original resolution
    if (dimensions) {
      config.maxWidth = dimensions.width;
      config.maxHeight = dimensions.height;
    }

    return config;
  }

  /**
   * Estimate memory usage for frame extraction
   */
  static estimateMemoryUsage(
    config: FrameExtractionConfig,
    videoWidth: number,
    videoHeight: number
  ): number {
    const duration = config.endTime - config.startTime;
    const frameCount = Math.ceil(duration * config.frameRate);

    const qualityScale = config.quality === 'low' ? 0.5 : config.quality === 'medium' ? 0.75 : 1.0;

    const frameWidth = Math.floor(videoWidth * qualityScale);
    const frameHeight = Math.floor(videoHeight * qualityScale);

    // ImageData uses 4 bytes per pixel (RGBA)
    const bytesPerFrame = frameWidth * frameHeight * 4;

    return frameCount * bytesPerFrame;
  }
}

/**
 * Convenience function for extracting frames from video elements
 */
async function _extractVideoFrames(
  videoElement: HTMLVideoElement,
  config: FrameExtractionConfig,
  onProgress?: (progress: FrameExtractionProgress) => void
): Promise<FrameExtractionResult> {
  const extractor = new FrameExtractor();
  return await extractor.extractFrames(videoElement, config, onProgress);
}
