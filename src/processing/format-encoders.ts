/**
 * Export Format Management for Multiple Output Types
 * Provides a unified interface for encoding to different media formats
 */

import { ExtractedFrame, FrameExtractionResult } from './frame-extractor';
import { GifSettings } from '@/types';
import { GifEncoder } from './gif-encoder';
import { performanceTracker } from '@/monitoring/performance-tracker';
import { metricsCollector } from '@/monitoring/metrics-collector';

export type ExportFormat = 'gif';

export interface ExportOptions {
  format: ExportFormat;
  settings: GifSettings;
  quality?: number; // 0-100
  compression?: 'lossy' | 'lossless';
  onProgress?: (progress: ExportProgress) => void;
  abortSignal?: AbortSignal;
}

export interface ExportProgress {
  format: ExportFormat;
  stage: 'preparing' | 'encoding' | 'optimizing' | 'finalizing';
  percentage: number;
  estimatedTimeRemaining?: number;
  currentOperation?: string;
  memoryUsage?: number;
}

export interface ExportResult {
  format: ExportFormat;
  blob: Blob;
  metadata: {
    width: number;
    height: number;
    frameCount: number;
    fileSize: number;
    encodingTime: number;
    codec?: string;
    compression?: 'lossy' | 'lossless';
    quality?: number;
  };
  performance: {
    success: boolean;
    efficiency: number;
    recommendations: string[];
    peakMemoryUsage: number;
  };
}

export interface FormatEncoder {
  format: ExportFormat;
  supportedCompressions: ('lossy' | 'lossless')[];
  
  encode(
    frames: ExtractedFrame[] | FrameExtractionResult,
    options: ExportOptions
  ): Promise<ExportResult>;
  
  estimateFileSize(
    frameCount: number,
    width: number,
    height: number,
    options: ExportOptions
  ): number;
  
  getQualitySettings(preset: 'low' | 'medium' | 'high'): {
    quality: number;
    compression: 'lossy' | 'lossless';
    additionalOptions?: Record<string, unknown>;
  };
  
  isSupported(): boolean;
}

/**
 * Format-specific quality presets
 */
export const FORMAT_QUALITY_PRESETS = {
  gif: {
    low: { quality: 10, colors: 64, dither: false },
    medium: { quality: 20, colors: 128, dither: true },
    high: { quality: 30, colors: 256, dither: true }
  },
};

/**
 * Registry for format encoders
 */
class FormatEncoderRegistry {
  private encoders = new Map<ExportFormat, FormatEncoder>();
  
  register(encoder: FormatEncoder): void {
    this.encoders.set(encoder.format, encoder);
  }
  
  getEncoder(format: ExportFormat): FormatEncoder | undefined {
    return this.encoders.get(format);
  }
  
  getSupportedFormats(): ExportFormat[] {
    return Array.from(this.encoders.keys()).filter(format => {
      const encoder = this.encoders.get(format);
      return encoder?.isSupported();
    });
  }
  
  hasEncoder(format: ExportFormat): boolean {
    const encoder = this.encoders.get(format);
    return encoder?.isSupported() ?? false;
  }
}

// Global registry instance
export const formatRegistry = new FormatEncoderRegistry();

/**
 * GIF Format Adapter - wraps existing GIF encoder
 */
class GifFormatEncoder implements FormatEncoder {
  format: ExportFormat = 'gif';
  supportedCompressions: ('lossy' | 'lossless')[] = ['lossy'];
  
  private gifEncoder = new GifEncoder();
  
  async encode(
    frames: ExtractedFrame[] | FrameExtractionResult,
    options: ExportOptions
  ): Promise<ExportResult> {
    const sessionId = `format-encode-gif-${Date.now()}`;
    metricsCollector.startOperation(sessionId);
    
    try {
      const preset = FORMAT_QUALITY_PRESETS.gif[options.settings.quality];
      
      const gifResult = await this.gifEncoder.encodeGif(frames, {
        settings: options.settings,
        preset: 'balanced', // Map to GIF encoder preset
        customOptions: preset,
        onProgress: (progress) => {
          options.onProgress?.({
            format: 'gif',
            stage: progress.stage,
            percentage: progress.percentage,
            estimatedTimeRemaining: progress.estimatedTimeRemaining,
            currentOperation: progress.currentOperation,
            memoryUsage: progress.memoryUsage
          });
        },
        abortSignal: options.abortSignal
      });
      
      const exportResult: ExportResult = {
        format: 'gif',
        blob: gifResult.blob,
        metadata: {
          ...gifResult.metadata,
          codec: 'gif89a',
          compression: 'lossy',
          quality: options.quality
        },
        performance: gifResult.performance
      };
      
      metricsCollector.endOperation(sessionId, 'encoding', {
        format: 'gif',
        fileSize: gifResult.blob.size
      });
      
      return exportResult;
    } catch (error) {
      metricsCollector.recordError({
        type: 'format-encoding-error',
        message: error instanceof Error ? error.message : 'Unknown error',
        context: { format: 'gif' }
      });
      throw error;
    }
  }
  
  estimateFileSize(
    frameCount: number,
    width: number,
    height: number,
    options: ExportOptions
  ): number {
    // GIF compression ratio estimation
    const pixelsPerFrame = width * height;
    const colorDepth = options.quality ? Math.min(8, Math.floor(options.quality / 12.5)) : 8;
    const compressionRatio = 0.3 + (colorDepth / 8) * 0.2;
    return frameCount * pixelsPerFrame * compressionRatio;
  }
  
  getQualitySettings(preset: 'low' | 'medium' | 'high') {
    const settings = FORMAT_QUALITY_PRESETS.gif[preset];
    return {
      quality: settings.quality,
      compression: 'lossy' as const,
      additionalOptions: settings
    };
  }
  
  isSupported(): boolean {
    return GifEncoder.isAvailable();
  }
}

// Register the GIF encoder
formatRegistry.register(new GifFormatEncoder());

/**
 * Main export function for encoding to any supported format
 */
export async function exportToFormat(
  frames: ExtractedFrame[] | FrameExtractionResult,
  options: ExportOptions
): Promise<ExportResult> {
  const encoder = formatRegistry.getEncoder(options.format);
  
  if (!encoder) {
    throw new Error(`Unsupported export format: ${options.format}`);
  }
  
  if (!encoder.isSupported()) {
    throw new Error(`Export format ${options.format} is not available in this environment`);
  }
  
  const sessionId = `export-${options.format}-${Date.now()}`;
  performanceTracker.startTimer(sessionId);
  
  try {
    metricsCollector.recordUserAction('export-started', {
      format: options.format,
      frameCount: Array.isArray(frames) ? frames.length : frames.frames.length,
      settings: options.settings
    });
    
    const result = await encoder.encode(frames, options);
    
    const totalTime = performanceTracker.endTimer(sessionId, 'encoding', {
      format: options.format,
      fileSize: result.blob.size
    });
    
    metricsCollector.recordUserAction('export-completed', {
      format: options.format,
      totalTime,
      fileSize: result.blob.size
    });
    
    return result;
  } catch (error) {
    performanceTracker.endTimer(sessionId, 'encoding');
    throw error;
  }
}

/**
 * Utility to estimate file sizes for all formats
 */
export function estimateExportSizes(
  frames: ExtractedFrame[] | FrameExtractionResult,
  settings: GifSettings
): Record<ExportFormat, { estimated: string; supported: boolean }> {
  const frameArray = Array.isArray(frames) ? frames : frames.frames;
  const frameCount = frameArray.length;
  
  if (frameCount === 0) {
    return {
      gif: { estimated: '0 MB', supported: false },
    };
  }
  
  const firstFrame = frameArray[0];
  const width = firstFrame.imageData.width;
  const height = firstFrame.imageData.height;
  
  const formats: ExportFormat[] = ['gif'];
  const result: Record<string, { estimated: string; supported: boolean }> = {};
  
  for (const format of formats) {
    const encoder = formatRegistry.getEncoder(format);
    if (encoder && encoder.isSupported()) {
      const sizeBytes = encoder.estimateFileSize(frameCount, width, height, {
        format,
        settings,
        quality: settings.quality === 'low' ? 60 : settings.quality === 'high' ? 90 : 75
      });
      result[format] = {
        estimated: `${(sizeBytes / 1024 / 1024).toFixed(1)} MB`,
        supported: true
      };
    } else {
      result[format] = {
        estimated: 'N/A',
        supported: false
      };
    }
  }
  
  return result as Record<ExportFormat, { estimated: string; supported: boolean }>;
}

/**
 * Get recommended format based on content and requirements
 */
export function recommendFormat(
  frames: ExtractedFrame[] | FrameExtractionResult,
  _requirements: {
    maxFileSize?: number; // in bytes
    preferQuality?: boolean;
    needTransparency?: boolean;
    needAnimation?: boolean;
  }
): ExportFormat {
  const frameArray = Array.isArray(frames) ? frames : frames.frames;
  const frameCount = frameArray.length;
  
  // For very short clips, GIF is usually best
  if (frameCount < 30) {
    return 'gif';
  }

  // Default to GIF
  return 'gif';
}