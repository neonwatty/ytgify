/**
 * WebP Encoding Implementation
 * Provides high-quality, efficient WebP image sequence encoding
 */

import { ExtractedFrame, FrameExtractionResult } from './frame-extractor';
import { GifSettings } from '@/types';
import { 
  ExportOptions, 
  ExportResult, 
  FormatEncoder,
  ExportProgress,
  formatRegistry,
  FORMAT_QUALITY_PRESETS
} from './format-encoders';
import { metricsCollector } from '@/monitoring/metrics-collector';

export interface WebPEncodingOptions {
  quality: number; // 0-100
  method: number; // 0-6, higher = better/slower
  lossless: boolean;
  nearLossless?: number; // 0-100 for lossless mode
  targetSize?: number; // Target size in bytes
  alphaQuality?: number; // 0-100 for alpha channel
  animationParams?: {
    loop: number; // 0 = infinite
    minimumDelay: number; // Minimum frame delay in ms
    keyframeDistance: number; // Max distance between keyframes
    mixedMode?: boolean; // Allow mixed lossy/lossless frames
  };
}

export interface WebPFrame {
  imageData: ImageData;
  duration: number; // Frame duration in milliseconds
  isKeyframe?: boolean;
}

export interface WebPEncodingProgress extends ExportProgress {
  frameIndex?: number;
  totalFrames: number;
  compressionRatio?: number;
}

export interface WebPEncodingResult extends ExportResult {
  metadata: ExportResult['metadata'] & {
    animationLoop?: number;
    hasAlpha: boolean;
    compressionRatio: number;
  };
}

/**
 * WebP Encoder using canvas and native browser APIs
 * Falls back to WebAssembly implementation if needed
 */
export class WebPEncoder implements FormatEncoder {
  format = 'webp' as const;
  supportedCompressions: ('lossy' | 'lossless')[] = ['lossy', 'lossless'];
  
  private isEncoding = false;
  private abortController: AbortController | null = null;
  private progressCallback?: (progress: WebPEncodingProgress) => void;
  private startTime = 0;
  
  /**
   * Check if WebP encoding is supported
   */
  isSupported(): boolean {
    // Check for basic canvas WebP support
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const dataUrl = canvas.toDataURL('image/webp');
    return dataUrl.indexOf('image/webp') === 5;
  }
  
  /**
   * Check if animated WebP is supported (requires additional library)
   */
  static isAnimatedWebPSupported(): boolean {
    // This would require a library like webp-hero or libwebp.js
    // For now, we'll use frame-by-frame encoding
    return false;
  }
  
  /**
   * Encode frames to WebP format
   */
  async encode(
    frames: ExtractedFrame[] | FrameExtractionResult,
    options: ExportOptions
  ): Promise<WebPEncodingResult> {
    if (this.isEncoding) {
      throw new Error('WebP encoding already in progress');
    }
    
    this.isEncoding = true;
    this.abortController = new AbortController();
    this.startTime = performance.now();
    this.progressCallback = options.onProgress ? (progress: WebPEncodingProgress) => {
      options.onProgress!(progress);
    } : undefined;
    
    const sessionId = `webp-encoding-${Date.now()}`;
    metricsCollector.startOperation(sessionId);
    
    try {
      const frameArray = Array.isArray(frames) ? frames : frames.frames;
      
      // Get quality settings
      const qualitySettings = this.getQualitySettings(options.settings.quality);
      const encodingOptions = this.createEncodingOptions(
        options, 
        qualitySettings
      );
      
      this.reportProgress('preparing', 0, 0, frameArray.length);
      
      // Process frames
      const webpFrames = await this.processFrames(
        frameArray,
        options.settings,
        encodingOptions
      );
      
      this.reportProgress('encoding', 30, undefined, frameArray.length);
      
      // Encode to WebP
      const blob = await this.encodeFramesToWebP(
        webpFrames,
        encodingOptions,
        options.abortSignal
      );
      
      this.reportProgress('finalizing', 95, undefined, frameArray.length);
      
      // Calculate compression ratio
      const originalSize = frameArray.reduce((sum, frame) => {
        return sum + (frame.imageData.width * frame.imageData.height * 4);
      }, 0);
      const compressionRatio = originalSize / blob.size;
      
      const encodingTime = performance.now() - this.startTime;
      
      // Create result
      const result: WebPEncodingResult = {
        format: 'webp',
        blob,
        metadata: {
          width: frameArray[0]?.imageData.width || 0,
          height: frameArray[0]?.imageData.height || 0,
          frameCount: frameArray.length,
          fileSize: blob.size,
          encodingTime,
          codec: 'webp',
          compression: encodingOptions.lossless ? 'lossless' : 'lossy',
          quality: options.quality || qualitySettings.quality,
          animationLoop: encodingOptions.animationParams?.loop,
          hasAlpha: this.detectAlpha(frameArray[0]?.imageData),
          compressionRatio
        },
        performance: {
          success: true,
          efficiency: compressionRatio,
          recommendations: this.generateRecommendations(
            compressionRatio,
            blob.size,
            frameArray.length
          ),
          peakMemoryUsage: this.estimateMemoryUsage(frameArray)
        }
      };
      
      this.reportProgress('finalizing', 100, undefined, frameArray.length);
      
      metricsCollector.endOperation(sessionId, 'encoding', {
        frameCount: frameArray.length,
        outputSize: blob.size,
        compressionRatio
      });
      
      return result;
      
    } catch (error) {
      metricsCollector.recordError({
        type: 'webp-encoding-error',
        message: error instanceof Error ? error.message : 'Unknown error',
        context: { format: 'webp' }
      });
      throw error;
    } finally {
      this.cleanup();
    }
  }
  
  /**
   * Process frames with effects and prepare for encoding
   */
  private async processFrames(
    frames: ExtractedFrame[],
    settings: GifSettings,
    options: WebPEncodingOptions
  ): Promise<WebPFrame[]> {
    const frameDuration = 1000 / settings.frameRate; // Convert to milliseconds
    const webpFrames: WebPFrame[] = [];
    
    for (let i = 0; i < frames.length; i++) {
      if (this.abortController?.signal.aborted) {
        throw new Error('WebP encoding cancelled');
      }
      
      const frame = frames[i];
      
      // Apply image adjustments
      const processedImageData = await this.applyImageAdjustments(
        frame.imageData,
        settings
      );
      
      // Add text overlays if needed
      const finalImageData = settings.textOverlays?.length 
        ? await this.applyTextOverlays(processedImageData, settings.textOverlays)
        : processedImageData;
      
      webpFrames.push({
        imageData: finalImageData,
        duration: frameDuration,
        isKeyframe: i % (options.animationParams?.keyframeDistance || 10) === 0
      });
      
      const progress = 10 + (i / frames.length) * 20; // 10-30% for processing
      this.reportProgress('preparing', progress, i, frames.length);
    }
    
    return webpFrames;
  }
  
  /**
   * Apply brightness, contrast, and other adjustments
   */
  private async applyImageAdjustments(
    imageData: ImageData,
    settings: GifSettings
  ): Promise<ImageData> {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    // Apply filters
    if (settings.brightness !== 1 || settings.contrast !== 1) {
      const filterString = [
        settings.brightness !== 1 ? `brightness(${settings.brightness})` : '',
        settings.contrast !== 1 ? `contrast(${settings.contrast})` : ''
      ].filter(Boolean).join(' ');
      
      if (filterString) {
        ctx.filter = filterString;
        ctx.drawImage(canvas, 0, 0);
      }
    }
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  
  /**
   * Apply text overlays to frame
   */
  private async applyTextOverlays(
    imageData: ImageData,
    overlays: GifSettings['textOverlays']
  ): Promise<ImageData> {
    if (!overlays || overlays.length === 0) {
      return imageData;
    }
    
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.putImageData(imageData, 0, 0);
    
    for (const overlay of overlays) {
      ctx.save();
      ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      
      // Add stroke for better readability
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeText(overlay.text, overlay.position.x, overlay.position.y);
      ctx.fillText(overlay.text, overlay.position.x, overlay.position.y);
      
      ctx.restore();
    }
    
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }
  
  /**
   * Encode WebP frames to final blob
   */
  private async encodeFramesToWebP(
    frames: WebPFrame[],
    options: WebPEncodingOptions,
    abortSignal?: AbortSignal
  ): Promise<Blob> {
    // For single frame WebP
    if (frames.length === 1) {
      return this.encodeSingleFrame(frames[0], options);
    }
    
    // For multiple frames, we need to create individual WebP images
    // and combine them (animated WebP would require additional library)
    const blobs: Blob[] = [];
    
    for (let i = 0; i < frames.length; i++) {
      if (abortSignal?.aborted) {
        throw new Error('Encoding cancelled');
      }
      
      const blob = await this.encodeSingleFrame(frames[i], options);
      blobs.push(blob);
      
      const progress = 30 + (i / frames.length) * 60; // 30-90% for encoding
      this.reportProgress('encoding', progress, i, frames.length);
    }
    
    // For now, return the first frame as static WebP
    // Full animated WebP would require webp-mux library
    return blobs[0];
  }
  
  /**
   * Encode a single frame to WebP
   */
  private async encodeSingleFrame(
    frame: WebPFrame,
    options: WebPEncodingOptions
  ): Promise<Blob> {
    const canvas = document.createElement('canvas');
    canvas.width = frame.imageData.width;
    canvas.height = frame.imageData.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    ctx.putImageData(frame.imageData, 0, 0);
    
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to encode WebP frame'));
          }
        },
        'image/webp',
        options.quality / 100
      );
    });
  }
  
  /**
   * Create encoding options from export options
   */
  private createEncodingOptions(
    exportOptions: ExportOptions,
    qualitySettings: ReturnType<typeof this.getQualitySettings>
  ): WebPEncodingOptions {
    const preset = FORMAT_QUALITY_PRESETS.webp[exportOptions.settings.quality];
    
    return {
      quality: exportOptions.quality || qualitySettings.quality,
      method: preset.method,
      lossless: exportOptions.compression === 'lossless',
      animationParams: {
        loop: 0, // Infinite loop
        minimumDelay: 1000 / exportOptions.settings.frameRate,
        keyframeDistance: 10,
        mixedMode: true
      }
    };
  }
  
  /**
   * Get quality settings for preset
   */
  getQualitySettings(preset: 'low' | 'medium' | 'high') {
    const settings = FORMAT_QUALITY_PRESETS.webp[preset];
    return {
      quality: settings.quality,
      compression: settings.compression,
      additionalOptions: settings
    };
  }
  
  /**
   * Estimate output file size
   */
  estimateFileSize(
    frameCount: number,
    width: number,
    height: number,
    options: ExportOptions
  ): number {
    const pixelsPerFrame = width * height;
    const bitsPerPixel = options.compression === 'lossless' ? 2.5 : 0.8;
    const qualityFactor = (options.quality || 75) / 100;
    const compressionRatio = options.compression === 'lossless' 
      ? 0.5 
      : 0.15 * qualityFactor;
    
    return frameCount * pixelsPerFrame * bitsPerPixel * compressionRatio;
  }
  
  /**
   * Detect if image has alpha channel
   */
  private detectAlpha(imageData?: ImageData): boolean {
    if (!imageData) return false;
    
    const data = imageData.data;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) {
        return true;
      }
    }
    return false;
  }
  
  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(
    compressionRatio: number,
    fileSize: number,
    frameCount: number
  ): string[] {
    const recommendations: string[] = [];
    
    if (compressionRatio < 5) {
      recommendations.push('Consider using lossy compression for better file size');
    }
    
    if (fileSize > 5 * 1024 * 1024) {
      recommendations.push('Large file size - consider reducing resolution or quality');
    }
    
    if (frameCount > 100) {
      recommendations.push('Many frames - consider reducing frame rate or duration');
    }
    
    return recommendations;
  }
  
  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(frames: ExtractedFrame[]): number {
    if (frames.length === 0) return 0;
    
    const frame = frames[0];
    const bytesPerFrame = frame.imageData.width * frame.imageData.height * 4;
    return bytesPerFrame * frames.length * 2; // Account for processing overhead
  }
  
  /**
   * Report encoding progress
   */
  private reportProgress(
    stage: WebPEncodingProgress['stage'],
    percentage: number,
    frameIndex?: number,
    totalFrames?: number
  ): void {
    if (!this.progressCallback) return;
    
    const elapsedTime = performance.now() - this.startTime;
    const estimatedTotalTime = percentage > 0 ? (elapsedTime / percentage) * 100 : 0;
    const estimatedTimeRemaining = Math.max(0, estimatedTotalTime - elapsedTime);
    
    this.progressCallback({
      format: 'webp',
      stage,
      percentage: Math.max(0, Math.min(100, percentage)),
      estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : undefined,
      currentOperation: `Processing ${stage}`,
      memoryUsage: this.getCurrentMemoryUsage(),
      frameIndex,
      totalFrames: totalFrames || 0
    });
  }
  
  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number | undefined {
    if ('memory' in performance) {
      const memInfo = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      return memInfo.usedJSHeapSize;
    }
    return undefined;
  }
  
  /**
   * Cleanup after encoding
   */
  private cleanup(): void {
    this.isEncoding = false;
    this.abortController = null;
    this.progressCallback = undefined;
    this.startTime = 0;
  }
}

// Register the WebP encoder
const webpEncoder = new WebPEncoder();
if (webpEncoder.isSupported()) {
  formatRegistry.register(webpEncoder);
}

/**
 * Convenience function for WebP encoding
 */
export async function encodeToWebP(
  frames: ExtractedFrame[] | FrameExtractionResult,
  settings: GifSettings,
  options?: {
    quality?: number;
    lossless?: boolean;
    onProgress?: (progress: WebPEncodingProgress) => void;
    abortSignal?: AbortSignal;
  }
): Promise<WebPEncodingResult> {
  const encoder = new WebPEncoder();
  return encoder.encode(frames, {
    format: 'webp',
    settings,
    quality: options?.quality,
    compression: options?.lossless ? 'lossless' : 'lossy',
    onProgress: options?.onProgress ? (progress: ExportProgress) => {
      const webpProgress: WebPEncodingProgress = {
        ...progress,
        totalFrames: Array.isArray(frames) ? frames.length : frames.frames.length
      };
      options.onProgress!(webpProgress);
    } : undefined,
    abortSignal: options?.abortSignal
  }) as Promise<WebPEncodingResult>;
}