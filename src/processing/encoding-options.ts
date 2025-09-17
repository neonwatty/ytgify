/**
 * GIF encoding configuration and optimization settings
 * Provides presets and utilities for gif.js encoding options
 */

import { GifSettings } from '@/types';
import { getResolutionDimensions } from '@/utils/resolution-parser';

export interface GifEncodingOptions {
  // Core gif.js options
  workers: number;
  quality: number;
  width?: number;
  height?: number;
  repeat: number;
  background?: string;
  debug?: boolean;
  
  // Performance optimization
  workerScript?: string;
  dither?: boolean | string;
  globalPalette?: boolean;
  
  // Chrome extension specific
  progressInterval?: number;
  memoryLimit?: number;
  timeLimit?: number;
}

export interface GifFrameOptions {
  delay: number;
  dispose?: number;
  copy?: boolean;
}

export interface EncodingPreset {
  name: string;
  description: string;
  targetFileSize: string;
  encodingTime: string;
  options: GifEncodingOptions;
}

export type GifQualityPreset = 'high-quality' | 'balanced' | 'fast-encode' | 'small-file';

/**
 * Predefined encoding presets optimized for different use cases
 */
export const ENCODING_PRESETS: Record<GifQualityPreset, EncodingPreset> = {
  'high-quality': {
    name: 'High Quality',
    description: 'Best quality, larger file size, slower encoding',
    targetFileSize: '2-5MB',
    encodingTime: '8-15s',
    options: {
      workers: 2,
      quality: 1, // Highest quality (1-30 range, lower is better)
      repeat: 0,
      dither: 'FloydSteinberg',
      globalPalette: true,
      progressInterval: 100,
      memoryLimit: 100 * 1024 * 1024, // 100MB
      timeLimit: 15000 // 15 seconds
    }
  },
  
  'balanced': {
    name: 'Balanced',
    description: 'Good quality-to-size ratio, moderate encoding time',
    targetFileSize: '1-3MB',
    encodingTime: '5-8s',
    options: {
      workers: 3,
      quality: 10, // Good balance
      repeat: 0,
      dither: true,
      globalPalette: false,
      progressInterval: 50,
      memoryLimit: 75 * 1024 * 1024, // 75MB
      timeLimit: 8000 // 8 seconds
    }
  },
  
  'fast-encode': {
    name: 'Fast Encode',
    description: 'Quick encoding, good quality, optimized for speed',
    targetFileSize: '1-2MB',
    encodingTime: '3-5s',
    options: {
      workers: 4,
      quality: 15, // Faster encoding
      repeat: 0,
      dither: false,
      globalPalette: false,
      progressInterval: 25,
      memoryLimit: 50 * 1024 * 1024, // 50MB
      timeLimit: 5000 // 5 seconds (meets target)
    }
  },
  
  'small-file': {
    name: 'Small File',
    description: 'Smallest file size, acceptable quality, fast encoding',
    targetFileSize: '0.5-1MB',
    encodingTime: '2-4s',
    options: {
      workers: 2,
      quality: 20, // Lower quality for smaller files
      repeat: 0,
      dither: false,
      globalPalette: false,
      progressInterval: 25,
      memoryLimit: 30 * 1024 * 1024, // 30MB
      timeLimit: 4000 // 4 seconds
    }
  }
};

/**
 * Dynamic encoding options based on content characteristics
 */
export interface ContentAnalysis {
  frameCount: number;
  averageComplexity: number; // 0-1 scale based on edge detection/variance
  motionLevel: 'low' | 'medium' | 'high';
  colorVariance: number; // 0-1 scale
  resolution: { width: number; height: number };
}

/**
 * Encoding optimization utilities
 */
export class EncodingOptimizer {
  /**
   * Select optimal preset based on user settings and content analysis
   */
  static selectOptimalPreset(
    settings: GifSettings,
    contentAnalysis?: ContentAnalysis
  ): GifQualityPreset {
    const duration = settings.endTime - settings.startTime;
    const estimatedFrames = Math.ceil(duration * settings.frameRate);
    
    // For very short clips, prioritize quality
    if (duration <= 2) {
      return settings.quality === 'high' ? 'high-quality' : 'balanced';
    }
    
    // For longer clips, consider file size and encoding time
    if (duration > 10) {
      return settings.quality === 'high' ? 'balanced' : 'fast-encode';
    }
    
    // Use content analysis if available
    if (contentAnalysis) {
      if (contentAnalysis.motionLevel === 'high' || estimatedFrames > 150) {
        return 'fast-encode';
      }
      
      if (contentAnalysis.colorVariance > 0.7) {
        return settings.quality === 'high' ? 'balanced' : 'fast-encode';
      }
    }
    
    // Default mapping based on user quality preference
    switch (settings.quality) {
      case 'high':
        return 'high-quality';
      case 'medium':
        return 'balanced';
      case 'low':
        return 'small-file';
      default:
        return 'balanced';
    }
  }

  /**
   * Calculate optimal worker count based on system and content
   */
  static calculateOptimalWorkers(
    frameCount: number,
    systemCores: number = navigator.hardwareConcurrency || 4
  ): number {
    // For small frame counts, fewer workers to reduce overhead
    if (frameCount < 30) {
      return Math.min(2, systemCores);
    }
    
    // For larger frame counts, use more workers but cap at system cores - 1
    return Math.min(Math.max(2, Math.floor(systemCores * 0.75)), 6);
  }

  /**
   * Adjust quality based on performance targets
   */
  static adjustQualityForPerformance(
    baseOptions: GifEncodingOptions,
    targetEncodeTime: number,
    estimatedFrames: number
  ): GifEncodingOptions {
    const adjusted = { ...baseOptions };
    
    // Estimate encoding complexity
    const complexityFactor = estimatedFrames / 100; // Base: 100 frames
    const estimatedTime = complexityFactor * 1000 * (30 - adjusted.quality) / 15; // Rough estimate
    
    if (estimatedTime > targetEncodeTime) {
      // Reduce quality to meet time target
      const reductionFactor = estimatedTime / targetEncodeTime;
      adjusted.quality = Math.min(30, Math.floor(adjusted.quality * reductionFactor));
      
      // Increase workers if beneficial
      adjusted.workers = Math.min(adjusted.workers + 1, 6);
      
      // Disable expensive options
      adjusted.dither = false;
      adjusted.globalPalette = false;
    }
    
    return adjusted;
  }

  /**
   * Create encoding options from GIF settings
   */
  static createOptionsFromSettings(
    settings: GifSettings,
    preset?: GifQualityPreset,
    contentAnalysis?: ContentAnalysis
  ): GifEncodingOptions {
    const selectedPreset = preset || this.selectOptimalPreset(settings, contentAnalysis);
    const baseOptions = { ...ENCODING_PRESETS[selectedPreset].options };
    
    // Parse resolution
    const [width, height] = getResolutionDimensions(settings.resolution, 640, 480);
    
    baseOptions.width = width;
    baseOptions.height = height;
    
    // Calculate optimal workers
    const estimatedFrames = Math.ceil((settings.endTime - settings.startTime) * settings.frameRate);
    baseOptions.workers = this.calculateOptimalWorkers(estimatedFrames);
    
    // Apply performance optimization for 5-second target
    const targetTime = 5000; // 5 seconds as per task requirement
    return this.adjustQualityForPerformance(baseOptions, targetTime, estimatedFrames);
  }

  /**
   * Calculate frame delay from frame rate
   */
  static calculateFrameDelay(frameRate: number): number {
    // GIF delay is in 1/100ths of a second
    return Math.round(100 / frameRate);
  }

  /**
   * Estimate memory usage for encoding
   */
  static estimateMemoryUsage(
    frameCount: number,
    width: number,
    height: number,
    options: GifEncodingOptions
  ): number {
    // Base memory per frame: 4 bytes per pixel (RGBA)
    const bytesPerFrame = width * height * 4;
    
    // Additional overhead for gif.js processing
    const processingOverhead = 1.5; // 50% overhead
    const workerOverhead = options.workers * 10 * 1024 * 1024; // 10MB per worker
    
    return Math.ceil(
      (frameCount * bytesPerFrame * processingOverhead) + workerOverhead
    );
  }

  /**
   * Validate encoding options against system constraints
   */
  static validateOptions(
    options: GifEncodingOptions,
    frameCount: number
  ): { valid: boolean; warnings: string[]; adjustedOptions?: GifEncodingOptions } {
    const warnings: string[] = [];
    const adjusted = { ...options };
    let needsAdjustment = false;

    // Check memory constraints
    const estimatedMemory = this.estimateMemoryUsage(
      frameCount,
      options.width || 640,
      options.height || 480,
      options
    );

    if (estimatedMemory > (options.memoryLimit || 100 * 1024 * 1024)) {
      warnings.push(`Estimated memory usage (${Math.round(estimatedMemory / 1024 / 1024)}MB) exceeds limit`);
      adjusted.quality = Math.min(30, adjusted.quality + 5);
      needsAdjustment = true;
    }

    // Check worker count
    const maxWorkers = navigator.hardwareConcurrency || 4;
    if (options.workers > maxWorkers) {
      warnings.push(`Worker count (${options.workers}) exceeds available cores (${maxWorkers})`);
      adjusted.workers = maxWorkers;
      needsAdjustment = true;
    }

    // Check quality range
    if (options.quality < 1 || options.quality > 30) {
      warnings.push(`Quality value (${options.quality}) outside valid range (1-30)`);
      adjusted.quality = Math.max(1, Math.min(30, options.quality));
      needsAdjustment = true;
    }

    return {
      valid: warnings.length === 0,
      warnings,
      adjustedOptions: needsAdjustment ? adjusted : undefined
    };
  }
}

/**
 * GIF encoding performance profiler
 */
export class EncodingProfiler {
  private startTime = 0;
  private frameStartTimes = new Map<number, number>();
  private metrics = {
    totalFrames: 0,
    processedFrames: 0,
    encodingTime: 0,
    avgFrameTime: 0,
    peakMemoryUsage: 0,
    errors: 0
  };

  start(): void {
    this.startTime = performance.now();
    this.metrics = {
      totalFrames: 0,
      processedFrames: 0,
      encodingTime: 0,
      avgFrameTime: 0,
      peakMemoryUsage: 0,
      errors: 0
    };
  }

  startFrame(frameIndex: number): void {
    this.frameStartTimes.set(frameIndex, performance.now());
  }

  endFrame(frameIndex: number): number {
    const startTime = this.frameStartTimes.get(frameIndex);
    if (!startTime) return 0;

    const frameTime = performance.now() - startTime;
    this.frameStartTimes.delete(frameIndex);
    
    this.metrics.processedFrames++;
    this.metrics.avgFrameTime = 
      (this.metrics.avgFrameTime * (this.metrics.processedFrames - 1) + frameTime) / 
      this.metrics.processedFrames;

    return frameTime;
  }

  recordMemoryUsage(): void {
    if ('memory' in performance) {
      const memInfo = (performance as unknown as { memory: { usedJSHeapSize: number } }).memory;
      this.metrics.peakMemoryUsage = Math.max(
        this.metrics.peakMemoryUsage,
        memInfo.usedJSHeapSize
      );
    }
  }

  recordError(): void {
    this.metrics.errors++;
  }

  finish(totalFrames: number): typeof this.metrics & { 
    success: boolean; 
    efficiency: number; 
    recommendations: string[] 
  } {
    this.metrics.encodingTime = performance.now() - this.startTime;
    this.metrics.totalFrames = totalFrames;
    
    const success = this.metrics.errors === 0 && this.metrics.processedFrames === totalFrames;
    const efficiency = this.metrics.processedFrames / Math.max(1, this.metrics.totalFrames);
    
    const recommendations: string[] = [];
    
    if (this.metrics.encodingTime > 5000) {
      recommendations.push('Consider reducing quality or frame rate for faster encoding');
    }
    
    if (this.metrics.avgFrameTime > 100) {
      recommendations.push('Frame processing is slow, consider fewer workers or lower resolution');
    }
    
    if (this.metrics.peakMemoryUsage > 100 * 1024 * 1024) {
      recommendations.push('High memory usage detected, consider processing in smaller batches');
    }
    
    return {
      ...this.metrics,
      success,
      efficiency,
      recommendations
    };
  }
}