/**
 * Enhanced GIF encoder with multiple backend support
 * Maintains backward compatibility while providing improved performance
 */

import { sharedLogger as logger } from '@/shared/logger';
import { createError } from './errors';
import { 
  encodeFrames, 
  getEncoderRecommendations,
  EncoderType,
  EncodingOptions as NewEncodingOptions,
  EncodingResult,
  EncodingProgress,
  FrameData
} from './encoders';

// Re-export legacy interfaces for backward compatibility
export interface GifEncodingOptions {
  width: number;
  height: number;
  frameRate: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
  dithering?: boolean;
  optimizeColors?: boolean;
  backgroundColor?: string;
  // New options
  preferredEncoder?: EncoderType;
  enableFeatureDetection?: boolean;
}

export interface GifEncodingProgress {
  stage: 'analyzing' | 'quantizing' | 'encoding' | 'optimizing' | 'completed';
  progress: number;
  message: string;
  // Enhanced progress info
  frameIndex?: number;
  totalFrames?: number;
  estimatedTimeRemaining?: number;
  memoryUsage?: number;
}

export interface EncodedGifResult {
  gifBlob: Blob;
  thumbnailBlob?: Blob;
  metadata: {
    fileSize: number;
    duration: number;
    width: number;
    height: number;
    frameCount: number;
    colorCount?: number;
    compressionRatio?: number;
    // Enhanced metadata
    encodingTime: number;
    averageFrameTime: number;
    encoder: string;
    performance: {
      efficiency: number;
      recommendations: string[];
      peakMemoryUsage: number;
    };
  };
}

export class GifEncoder {
  private options: GifEncodingOptions;
  private canvas: OffscreenCanvas;
  private ctx: OffscreenCanvasRenderingContext2D;
  private onProgress?: (progress: GifEncodingProgress) => void;
  private abortController: AbortController | null = null;

  constructor(options: GifEncodingOptions, onProgress?: (progress: GifEncodingProgress) => void) {
    this.options = options;
    this.onProgress = onProgress;
    
    // Create offscreen canvas for frame processing
    this.canvas = new OffscreenCanvas(options.width, options.height);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw createError('gif', 'Failed to create 2D canvas context');
    }
    this.ctx = ctx;

    logger.info('[GifEncoder] Initialized with enhanced encoder system', { 
      width: options.width, 
      height: options.height, 
      quality: options.quality,
      preferredEncoder: options.preferredEncoder || 'auto'
    });
  }

  // Main encoding method with enhanced backend selection
  public async encodeFrames(frames: ImageData[]): Promise<EncodedGifResult> {
    if (frames.length === 0) {
      throw createError('gif', 'No frames provided for encoding');
    }

    logger.info('[GifEncoder] Starting GIF encoding with enhanced system', { 
      frameCount: frames.length, 
      options: this.options 
    });

    // Set up abort controller for cancellation support
    this.abortController = new AbortController();

    try {
      // Convert ImageData frames to FrameData format
      const frameData: FrameData[] = frames.map((imageData, index) => ({
        imageData,
        timestamp: index * (1000 / this.options.frameRate),
        delay: Math.round(1000 / this.options.frameRate)
      }));

      // Convert options to new format
      const encodingOptions: NewEncodingOptions = {
        width: this.options.width,
        height: this.options.height,
        frameRate: this.options.frameRate,
        quality: this.options.quality,
        loop: this.options.loop,
        dithering: this.options.dithering,
        optimizeColors: this.options.optimizeColors,
        backgroundColor: this.options.backgroundColor
      };

      // Set up progress adapter
      const progressAdapter = (progress: EncodingProgress) => {
        if (this.onProgress) {
          this.onProgress({
            stage: this.mapStage(progress.stage),
            progress: progress.percentage,
            message: progress.currentOperation || `${progress.stage}: ${progress.percentage}%`,
            frameIndex: progress.frameIndex,
            totalFrames: progress.totalFrames,
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
            memoryUsage: progress.memoryUsage
          });
        }
      };

      // Get encoder recommendations if feature detection enabled
      if (this.options.enableFeatureDetection) {
        const recommendations = await getEncoderRecommendations();
        logger.info('[GifEncoder] Encoder analysis completed', {
          recommended: recommendations.recommended,
          available: recommendations.available.map(e => ({ name: e.name, available: e.available }))
        });
      }

      // Encode using the best available encoder
      const result: EncodingResult = await encodeFrames(
        frameData,
        encodingOptions,
        {
          encoder: this.options.preferredEncoder || 'auto',
          format: 'gif',
          onProgress: progressAdapter,
          abortSignal: this.abortController.signal
        }
      );

      // Create thumbnail from first frame
      const thumbnailBlob = await this.createThumbnail(frames[0]);

      // Convert result to legacy format
      const legacyResult: EncodedGifResult = {
        gifBlob: result.blob,
        thumbnailBlob,
        metadata: {
          fileSize: result.metadata.fileSize,
          duration: frames.length / this.options.frameRate,
          width: result.metadata.width,
          height: result.metadata.height,
          frameCount: result.metadata.frameCount,
          colorCount: undefined, // May not be available from all encoders
          compressionRatio: this.calculateCompressionRatio(result.blob.size, frames[0]),
          encodingTime: result.metadata.encodingTime,
          averageFrameTime: result.metadata.averageFrameTime,
          encoder: result.metadata.encoder,
          performance: {
            efficiency: result.performance.efficiency,
            recommendations: result.performance.recommendations,
            peakMemoryUsage: result.performance.peakMemoryUsage
          }
        }
      };

      logger.info('[GifEncoder] Encoding completed successfully', { 
        fileSize: legacyResult.metadata.fileSize,
        frameCount: frames.length,
        encoder: result.metadata.encoder,
        encodingTime: result.metadata.encodingTime,
        efficiency: result.performance.efficiency
      });

      return legacyResult;

    } catch (error) {
      logger.error('[GifEncoder] Encoding failed', { error, frameCount: frames.length });
      throw createError('gif', `GIF encoding failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      this.cleanup();
    }
  }

  // Cancel ongoing encoding
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
      logger.info('[GifEncoder] Encoding cancelled');
    }
  }

  // Get encoding status
  public get isEncoding(): boolean {
    return this.abortController !== null && !this.abortController.signal.aborted;
  }

  // Create thumbnail from first frame (unchanged for compatibility)
  private async createThumbnail(firstFrame: ImageData): Promise<Blob> {
    const thumbnailSize = 150;
    const thumbnailCanvas = new OffscreenCanvas(thumbnailSize, thumbnailSize);
    const thumbnailCtx = thumbnailCanvas.getContext('2d');
    
    if (!thumbnailCtx) {
      throw createError('gif', 'Failed to create thumbnail canvas context');
    }

    const tempCanvas = new OffscreenCanvas(firstFrame.width, firstFrame.height);
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.putImageData(firstFrame, 0, 0);
      
      const scale = Math.min(thumbnailSize / firstFrame.width, thumbnailSize / firstFrame.height);
      const scaledWidth = firstFrame.width * scale;
      const scaledHeight = firstFrame.height * scale;
      const offsetX = (thumbnailSize - scaledWidth) / 2;
      const offsetY = (thumbnailSize - scaledHeight) / 2;
      
      thumbnailCtx.drawImage(tempCanvas, offsetX, offsetY, scaledWidth, scaledHeight);
    }

    return thumbnailCanvas.convertToBlob({ type: 'image/png', quality: 0.8 });
  }

  private mapStage(newStage: EncodingProgress['stage']): GifEncodingProgress['stage'] {
    switch (newStage) {
      case 'preparing': return 'analyzing';
      case 'encoding': return 'encoding';
      case 'finalizing': return 'optimizing';
      case 'completed': return 'completed';
      default: return 'encoding';
    }
  }

  private calculateCompressionRatio(fileSize: number, firstFrame: ImageData): number {
    const uncompressedSize = firstFrame.width * firstFrame.height * 4; // RGBA
    return uncompressedSize / fileSize;
  }

  private cleanup(): void {
    this.abortController = null;
  }
}

// Export utility function for easy integration (enhanced version)
export async function encodeGif(
  frames: ImageData[], 
  options: GifEncodingOptions,
  onProgress?: (progress: GifEncodingProgress) => void
): Promise<EncodedGifResult> {
  const encoder = new GifEncoder(options, onProgress);
  return encoder.encodeFrames(frames);
}

// Export encoder selection utilities for advanced use
;

/**
 * Get performance benchmarks for available encoders
 */
export async function benchmarkEncoders(): Promise<Array<{
  name: string;
  available: boolean;
  benchmarkTime?: number;
  framesPerSecond?: number;
  recommendation?: string;
}>> {
  try {
    const { encoderFactory } = await import('./encoders/encoder-factory');
    const benchmarks = await encoderFactory.benchmarkEncoders(10);
    
    return benchmarks.map(b => ({
      name: b.name,
      available: b.available,
      benchmarkTime: b.benchmarkTime,
      framesPerSecond: b.framesPerSecond,
      recommendation: b.framesPerSecond ? 
        (b.framesPerSecond > 50 ? 'Excellent performance' :
         b.framesPerSecond > 20 ? 'Good performance' : 'Consider alternatives') 
        : undefined
    }));
  } catch (error) {
    logger.error('[GifEncoder] Benchmark failed', { error });
    return [];
  }
}

/**
 * Feature detection for encoder capabilities
 */
export async function detectEncoderFeatures(): Promise<{
  hasGifenc: boolean;
  hasGifJs: boolean;
  recommendedEncoder: EncoderType;
  performanceProfile: 'high' | 'medium' | 'low';
}> {
  try {
    const recommendations = await getEncoderRecommendations();
    const availableMap = recommendations.available.reduce((acc, encoder) => {
      acc[encoder.name] = encoder.available;
      return acc;
    }, {} as Record<string, boolean>);

    const hasGifenc = availableMap['gifenc'] || false;
    const hasGifJs = availableMap['gif.js'] || false;
    
    let performanceProfile: 'high' | 'medium' | 'low' = 'low';
    if (hasGifenc) {
      performanceProfile = 'high';
    } else if (hasGifJs) {
      performanceProfile = 'medium';
    }

    return {
      hasGifenc,
      hasGifJs,
      recommendedEncoder: recommendations.recommended.encoder,
      performanceProfile
    };
  } catch (error) {
    logger.error('[GifEncoder] Feature detection failed', { error });
    return {
      hasGifenc: false,
      hasGifJs: true, // Safe fallback
      recommendedEncoder: 'gif.js',
      performanceProfile: 'low'
    };
  }
}