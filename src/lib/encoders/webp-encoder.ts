/**
 * WebP encoder implementation using @jsquash/webp
 * Provides modern image format with better compression
 */

import { encode } from '@jsquash/webp';
import { 
  AbstractEncoder, 
  EncodingOptions, 
  EncodingResult, 
  EncodingProgress, 
  FrameData 
} from './abstract-encoder';

export class WebPEncoder extends AbstractEncoder {
  get name(): string {
    return 'webp';
  }

  get supportedFormats(): Array<'gif' | 'webp' | 'mp4'> {
    return ['webp'];
  }

  get characteristics() {
    return {
      speed: 'fast' as const,
      quality: 'high' as const,
      memoryUsage: 'low' as const,
      browserSupport: 'good' as const
    };
  }

  isAvailable(): boolean {
    // Check if WebP encoding is supported
    try {
      return typeof encode === 'function';
    } catch {
      return false;
    }
  }

  async initialize(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebP encoder is not available');
    }
    // @jsquash/webp doesn't need initialization, it handles WASM loading internally
  }

  async encode(
    frames: FrameData[],
    options: EncodingOptions,
    onProgress?: (progress: EncodingProgress) => void,
    abortSignal?: AbortSignal
  ): Promise<EncodingResult> {
    if (this.isEncoding) {
      throw new Error('Encoding already in progress');
    }

    this.isEncoding = true;
    this.progressCallback = onProgress;
    this.abortController = abortSignal ? new AbortController() : null;
    this.startTime = performance.now();
    this.frameCount = frames.length;

    try {
      // For animated WebP, we need to handle multiple frames
      // Note: @jsquash/webp currently only supports single frame encoding
      // For animated WebP, we'd need a different library or custom implementation
      // For now, we'll create a single frame WebP from the first frame
      
      if (frames.length > 1) {
        console.warn('WebP encoder currently only supports single frame encoding. Using first frame.');
      }

      return await this.encodeSingleFrame(frames[0], options);
    } finally {
      this.cleanup();
    }
  }

  private async encodeSingleFrame(
    frame: FrameData,
    options: EncodingOptions
  ): Promise<EncodingResult> {
    this.reportProgress('preparing', 0, 'Preparing WebP encoding');

    // Convert quality setting to WebP quality (0-100)
    const quality = this.mapQualityToWebP(options.quality);

    // Create ImageData from frame
    const imageData = frame.imageData;

    this.reportProgress('encoding', 30, 'Encoding to WebP format');

    // Encode to WebP using @jsquash/webp
    const webpBuffer = await encode(imageData, {
      quality,
      // Additional WebP options could go here
    });

    if (this.abortController?.signal.aborted) {
      throw new Error('Encoding cancelled');
    }

    this.reportProgress('finalizing', 80, 'Creating WebP blob');

    // Convert ArrayBuffer to Blob
    const blob = new Blob([webpBuffer], { type: 'image/webp' });
    const encodingTime = performance.now() - this.startTime;

    this.reportProgress('completed', 100, 'WebP encoding complete');

    return {
      blob,
      metadata: {
        width: imageData.width,
        height: imageData.height,
        frameCount: 1, // Currently single frame only
        fileSize: blob.size,
        encodingTime,
        averageFrameTime: encodingTime,
        format: 'webp',
        encoder: this.name
      },
      performance: {
        success: true,
        efficiency: this.calculateEfficiency(encodingTime, 1),
        recommendations: this.generateRecommendations(options, blob.size),
        peakMemoryUsage: this.getCurrentMemoryUsage() || 0
      }
    };
  }

  /**
   * Future implementation for animated WebP
   * This would require a different library that supports animated WebP
   */
  private async encodeAnimatedWebP(
    frames: FrameData[],
    options: EncodingOptions
  ): Promise<EncodingResult> {
    // Placeholder for animated WebP implementation
    // Libraries to consider:
    // - webp-wasm (supports animated WebP)
    // - libwebp-js (Google's official WebP library)
    
    throw new Error('Animated WebP encoding not yet implemented. Please use single frame or GIF format for animations.');
  }

  private mapQualityToWebP(quality: 'low' | 'medium' | 'high' | number): number {
    if (typeof quality === 'number') {
      // Ensure quality is between 0 and 100
      return Math.max(0, Math.min(100, quality));
    }
    
    switch (quality) {
      case 'low': return 60;
      case 'medium': return 80;
      case 'high': return 95;
      default: return 80;
    }
  }

  private calculateEfficiency(encodingTime: number, frameCount: number): number {
    // WebP encoding is generally very fast
    const timePerFrame = encodingTime / frameCount;
    const fps = 1000 / timePerFrame;
    // WebP should be very efficient, so scale expectations accordingly
    return Math.max(0.5, Math.min(1.0, fps / 30));
  }

  private generateRecommendations(options: EncodingOptions, fileSize: number): string[] {
    const recommendations: string[] = [];
    
    if (fileSize > 1024 * 1024) { // > 1MB
      recommendations.push('Consider reducing quality for smaller file size');
    }
    
    if (options.width * options.height > 1920 * 1080) {
      recommendations.push('High resolution may impact loading performance');
    }
    
    if (typeof options.quality === 'string' && options.quality === 'high') {
      recommendations.push('WebP provides excellent compression even at medium quality');
    }
    
    recommendations.push('WebP format provides 25-35% better compression than JPEG/PNG');
    
    return recommendations;
  }
}

/**
 * Create an animated WebP from multiple frames (future implementation)
 * This is a placeholder for when we have animated WebP support
 */
export async function createAnimatedWebP(
  frames: FrameData[],
  options: EncodingOptions & { loop?: number; delay?: number }
): Promise<Blob> {
  // This would be implemented when we have a library that supports animated WebP
  console.warn('Animated WebP is not yet supported. Using first frame only.');
  
  const encoder = new WebPEncoder();
  await encoder.initialize();
  const result = await encoder.encode([frames[0]], options);
  return result.blob;
}

/**
 * Convert GIF to WebP (static frame)
 * Useful for converting existing GIFs to WebP format
 */
export async function convertGifFrameToWebP(
  imageData: ImageData,
  quality: number = 80
): Promise<Blob> {
  const webpBuffer = await encode(imageData, { quality });
  return new Blob([webpBuffer], { type: 'image/webp' });
}

/**
 * Check if browser supports WebP format
 */
export function isWebPSupported(): boolean {
  // Check if canvas can export to WebP
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
}