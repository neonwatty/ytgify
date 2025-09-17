/**
 * Real-time file size estimation system for GIF creation
 * Provides accurate file size predictions before encoding starts
 * to help users make informed decisions about quality settings.
 */

import { GifSettings, TimelineSelection } from '@/types';
import { getResolutionDimensions } from '@/utils/resolution-parser';

export interface FileSizeEstimate {
  estimatedBytes: number;
  confidence: number; // 0-1 scale, how accurate the estimate is likely to be
  breakdown: {
    baseSize: number;
    frameCountMultiplier: number;
    qualityMultiplier: number;
    resolutionMultiplier: number;
    compressionSavings: number;
  };
  warnings: string[];
  recommendations: string[];
}

export interface SizeOptimizationSuggestion {
  originalSize: number;
  optimizedSize: number;
  savingsBytes: number;
  savingsPercentage: number;
  changes: string[];
  qualityImpact: 'minimal' | 'moderate' | 'significant';
}

export interface RealTimeEstimation {
  currentEstimate: number;
  projectedFinalSize: number;
  compressionRatio: number;
  processingProgress: number; // 0-1
  timeRemaining: number; // milliseconds
  accuracy: number; // improves as more frames are processed
}

/**
 * File size estimation constants based on empirical data
 */
const SIZE_CONSTANTS = {
  // Base size per frame in bytes (uncompressed RGBA)
  BASE_BYTES_PER_PIXEL: 4,
  
  // Compression ratios for different quality settings (empirically determined)
  COMPRESSION_RATIOS: {
    low: 0.05,    // Very high compression, ~95% size reduction
    medium: 0.12, // Moderate compression, ~88% size reduction
    high: 0.25    // Lower compression, ~75% size reduction
  },
  
  // Frame rate impact on compression efficiency
  FRAME_RATE_EFFICIENCY: {
    5: 1.1,   // Better compression for fewer frames
    8: 1.0,   // Baseline
    12: 0.95, // Slightly less efficient
    15: 0.9,  // Inter-frame differences reduce compression
    20: 0.85,
    24: 0.8,
    30: 0.75  // Highest frame rates have least compression
  },
  
  // Duration impact (longer GIFs may have better compression due to repeated patterns)
  DURATION_EFFICIENCY: {
    short: 1.0,  // < 3 seconds
    medium: 0.9, // 3-8 seconds
    long: 0.85   // > 8 seconds
  },
  
  // Content type multipliers (estimated based on typical YouTube content)
  CONTENT_TYPE_MULTIPLIERS: {
    static: 0.7,      // Mostly static content (text, simple graphics)
    animated: 1.0,    // Standard animated content
    action: 1.3,      // Fast motion, many scene changes
    cinematic: 1.1    // Film-like content with gradual changes
  },
  
  // Overhead for GIF format (headers, palette, etc.)
  GIF_OVERHEAD_BYTES: 2048 // Approximately 2KB overhead
};

/**
 * Advanced file size estimation system
 */
export class FileSizeEstimator {
  private estimationHistory: Array<{
    settings: GifSettings;
    estimated: number;
    actual?: number;
    timestamp: number;
  }> = [];

  /**
   * Primary file size estimation method
   */
  estimateFileSize(settings: GifSettings, contentType: 'static' | 'animated' | 'action' | 'cinematic' = 'animated'): number {
    const duration = settings.endTime - settings.startTime;
    const frameCount = Math.ceil(duration * settings.frameRate);

    // Parse resolution
    const [width, height] = getResolutionDimensions(settings.resolution, 640, 480);
    
    const pixelCount = width * height;
    
    // Base uncompressed size
    const baseSize = frameCount * pixelCount * SIZE_CONSTANTS.BASE_BYTES_PER_PIXEL;
    
    // Apply compression based on quality
    const compressionRatio = SIZE_CONSTANTS.COMPRESSION_RATIOS[settings.quality];
    let compressedSize = baseSize * compressionRatio;
    
    // Apply frame rate efficiency
    const frameRateEfficiency = this.getFrameRateEfficiency(settings.frameRate);
    compressedSize *= frameRateEfficiency;
    
    // Apply duration efficiency
    const durationEfficiency = this.getDurationEfficiency(duration);
    compressedSize *= durationEfficiency;
    
    // Apply content type multiplier
    const contentMultiplier = SIZE_CONSTANTS.CONTENT_TYPE_MULTIPLIERS[contentType];
    compressedSize *= contentMultiplier;
    
    // Add GIF format overhead
    const finalSize = compressedSize + SIZE_CONSTANTS.GIF_OVERHEAD_BYTES;
    
    // Store estimation for learning
    this.recordEstimation(settings, finalSize);
    
    return Math.round(finalSize);
  }

  /**
   * Detailed file size estimate with breakdown and confidence
   */
  getDetailedEstimate(
    settings: GifSettings, 
    contentType: 'static' | 'animated' | 'action' | 'cinematic' = 'animated'
  ): FileSizeEstimate {
    const duration = settings.endTime - settings.startTime;
    const frameCount = Math.ceil(duration * settings.frameRate);

    const [width, height] = getResolutionDimensions(settings.resolution, 640, 480);
    
    const pixelCount = width * height;
    const baseSize = frameCount * pixelCount * SIZE_CONSTANTS.BASE_BYTES_PER_PIXEL;
    
    // Calculate multipliers
    const frameCountMultiplier = frameCount / 100; // Normalized to 100 frames
    const qualityMultiplier = SIZE_CONSTANTS.COMPRESSION_RATIOS[settings.quality];
    const resolutionMultiplier = pixelCount / (640 * 480); // Normalized to 640x480
    const frameRateEfficiency = this.getFrameRateEfficiency(settings.frameRate);
    const durationEfficiency = this.getDurationEfficiency(duration);
    const contentMultiplier = SIZE_CONSTANTS.CONTENT_TYPE_MULTIPLIERS[contentType];
    
    // Calculate final size
    const compressedSize = baseSize * qualityMultiplier * frameRateEfficiency * durationEfficiency * contentMultiplier;
    const compressionSavings = baseSize - compressedSize;
    const finalSize = compressedSize + SIZE_CONSTANTS.GIF_OVERHEAD_BYTES;
    
    // Calculate confidence based on historical accuracy
    const confidence = this.calculateConfidence(settings);
    
    // Generate warnings and recommendations
    const warnings = this.generateWarnings(settings, finalSize);
    const recommendations = this.generateRecommendations(settings, finalSize);
    
    return {
      estimatedBytes: Math.round(finalSize),
      confidence,
      breakdown: {
        baseSize: Math.round(baseSize),
        frameCountMultiplier,
        qualityMultiplier,
        resolutionMultiplier,
        compressionSavings: Math.round(compressionSavings)
      },
      warnings,
      recommendations
    };
  }

  /**
   * Real-time size estimation during encoding
   */
  updateRealTimeEstimate(
    originalSettings: GifSettings,
    processedFrames: number,
    currentPartialSize: number,
    totalFrames: number,
    processingTimeElapsed: number
  ): RealTimeEstimation {
    const processingProgress = processedFrames / totalFrames;
    
    // Calculate current compression ratio from partial data
    const expectedPartialSize = this.estimateFileSize(originalSettings) * processingProgress;
    const compressionRatio = currentPartialSize / expectedPartialSize;
    
    // Project final size based on current ratio
    const projectedFinalSize = currentPartialSize + 
      (this.estimateFileSize(originalSettings) * (1 - processingProgress) * compressionRatio);
    
    // Estimate remaining time
    const avgTimePerFrame = processingTimeElapsed / processedFrames;
    const timeRemaining = avgTimePerFrame * (totalFrames - processedFrames);
    
    // Accuracy improves with more processed frames
    const accuracy = Math.min(0.95, 0.5 + (processingProgress * 0.45));
    
    return {
      currentEstimate: Math.round(currentPartialSize),
      projectedFinalSize: Math.round(projectedFinalSize),
      compressionRatio,
      processingProgress,
      timeRemaining,
      accuracy
    };
  }

  /**
   * Generate size optimization suggestions
   */
  suggestOptimizations(
    settings: GifSettings,
    _targetSizeBytes?: number
  ): SizeOptimizationSuggestion[] {
    const originalSize = this.estimateFileSize(settings);
    const suggestions: SizeOptimizationSuggestion[] = [];
    
    // Suggest quality reduction
    if (settings.quality === 'high') {
      const mediumQualitySettings = { ...settings, quality: 'medium' as const };
      const mediumSize = this.estimateFileSize(mediumQualitySettings);
      const savings = originalSize - mediumSize;
      
      suggestions.push({
        originalSize,
        optimizedSize: mediumSize,
        savingsBytes: savings,
        savingsPercentage: (savings / originalSize) * 100,
        changes: ['Reduce quality from high to medium'],
        qualityImpact: 'moderate'
      });
      
      const lowQualitySettings = { ...settings, quality: 'low' as const };
      const lowSize = this.estimateFileSize(lowQualitySettings);
      const lowSavings = originalSize - lowSize;
      
      suggestions.push({
        originalSize,
        optimizedSize: lowSize,
        savingsBytes: lowSavings,
        savingsPercentage: (lowSavings / originalSize) * 100,
        changes: ['Reduce quality from high to low'],
        qualityImpact: 'significant'
      });
    } else if (settings.quality === 'medium') {
      const lowQualitySettings = { ...settings, quality: 'low' as const };
      const lowSize = this.estimateFileSize(lowQualitySettings);
      const savings = originalSize - lowSize;
      
      suggestions.push({
        originalSize,
        optimizedSize: lowSize,
        savingsBytes: savings,
        savingsPercentage: (savings / originalSize) * 100,
        changes: ['Reduce quality from medium to low'],
        qualityImpact: 'moderate'
      });
    }
    
    // Suggest frame rate reduction
    if (settings.frameRate > 8) {
      const lowerFrameRate = Math.max(8, Math.floor(settings.frameRate * 0.75));
      const lowerFpsSettings = { ...settings, frameRate: lowerFrameRate };
      const lowerFpsSize = this.estimateFileSize(lowerFpsSettings);
      const savings = originalSize - lowerFpsSize;
      
      suggestions.push({
        originalSize,
        optimizedSize: lowerFpsSize,
        savingsBytes: savings,
        savingsPercentage: (savings / originalSize) * 100,
        changes: [`Reduce frame rate from ${settings.frameRate} to ${lowerFrameRate}fps`],
        qualityImpact: settings.frameRate > 15 ? 'minimal' : 'moderate'
      });
    }
    
    // Suggest resolution reduction
    const [width, height] = getResolutionDimensions(settings.resolution, 640, 480);
    
    if (width > 480 || height > 360) {
      const newWidth = Math.floor(width * 0.8);
      const newHeight = Math.floor(height * 0.8);
      const smallerResSettings = { ...settings, resolution: `${newWidth}x${newHeight}` };
      const smallerSize = this.estimateFileSize(smallerResSettings);
      const savings = originalSize - smallerSize;
      
      suggestions.push({
        originalSize,
        optimizedSize: smallerSize,
        savingsBytes: savings,
        savingsPercentage: (savings / originalSize) * 100,
        changes: [`Reduce resolution from ${width}x${height} to ${newWidth}x${newHeight}`],
        qualityImpact: 'moderate'
      });
    }
    
    // Combined optimization suggestion
    if (suggestions.length > 1) {
      const combinedSettings = { ...settings };
      const changes: string[] = [];
      
      if (settings.quality === 'high') {
        combinedSettings.quality = 'medium';
        changes.push('Reduce quality to medium');
      }
      
      if (settings.frameRate > 12) {
        combinedSettings.frameRate = 12;
        changes.push('Reduce frame rate to 12fps');
      }
      
      if (changes.length > 0) {
        const combinedSize = this.estimateFileSize(combinedSettings);
        const savings = originalSize - combinedSize;
        
        suggestions.push({
          originalSize,
          optimizedSize: combinedSize,
          savingsBytes: savings,
          savingsPercentage: (savings / originalSize) * 100,
          changes,
          qualityImpact: 'moderate'
        });
      }
    }
    
    // Sort by savings percentage (highest first)
    return suggestions
      .sort((a, b) => b.savingsPercentage - a.savingsPercentage)
      .slice(0, 4); // Return top 4 suggestions
  }

  /**
   * Compare file size across different quality settings
   */
  compareSizes(baseSettings: GifSettings): {
    low: { size: number; encodingTime: number };
    medium: { size: number; encodingTime: number };
    high: { size: number; encodingTime: number };
  } {
    const lowSettings = { ...baseSettings, quality: 'low' as const };
    const mediumSettings = { ...baseSettings, quality: 'medium' as const };
    const highSettings = { ...baseSettings, quality: 'high' as const };
    
    return {
      low: {
        size: this.estimateFileSize(lowSettings),
        encodingTime: this.estimateEncodingTime(lowSettings)
      },
      medium: {
        size: this.estimateFileSize(mediumSettings),
        encodingTime: this.estimateEncodingTime(mediumSettings)
      },
      high: {
        size: this.estimateFileSize(highSettings),
        encodingTime: this.estimateEncodingTime(highSettings)
      }
    };
  }

  /**
   * Get frame rate efficiency multiplier
   */
  private getFrameRateEfficiency(frameRate: number): number {
    // Find closest supported frame rate
    const supportedRates = Object.keys(SIZE_CONSTANTS.FRAME_RATE_EFFICIENCY).map(Number);
    const closest = supportedRates.reduce((prev, curr) => 
      Math.abs(curr - frameRate) < Math.abs(prev - frameRate) ? curr : prev
    );
    
    return SIZE_CONSTANTS.FRAME_RATE_EFFICIENCY[closest as keyof typeof SIZE_CONSTANTS.FRAME_RATE_EFFICIENCY];
  }

  /**
   * Get duration efficiency multiplier
   */
  private getDurationEfficiency(duration: number): number {
    if (duration < 3) return SIZE_CONSTANTS.DURATION_EFFICIENCY.short;
    if (duration <= 8) return SIZE_CONSTANTS.DURATION_EFFICIENCY.medium;
    return SIZE_CONSTANTS.DURATION_EFFICIENCY.long;
  }

  /**
   * Record estimation for learning and accuracy improvement
   */
  private recordEstimation(settings: GifSettings, estimated: number): void {
    this.estimationHistory.push({
      settings: { ...settings },
      estimated,
      timestamp: Date.now()
    });
    
    // Keep only recent estimations (last 100)
    if (this.estimationHistory.length > 100) {
      this.estimationHistory = this.estimationHistory.slice(-100);
    }
  }

  /**
   * Update estimation with actual result for learning
   */
  updateActualSize(settings: GifSettings, actualSize: number): void {
    // Find the most recent matching estimation
    const match = this.estimationHistory
      .slice()
      .reverse()
      .find(entry => 
        entry.settings.startTime === settings.startTime &&
        entry.settings.endTime === settings.endTime &&
        entry.settings.frameRate === settings.frameRate &&
        entry.settings.quality === settings.quality &&
        entry.settings.resolution === settings.resolution &&
        !entry.actual
      );
    
    if (match) {
      match.actual = actualSize;
    }
  }

  /**
   * Calculate confidence based on historical accuracy
   */
  private calculateConfidence(settings: GifSettings): number {
    const relevantHistory = this.estimationHistory.filter(entry => 
      entry.actual &&
      entry.settings.quality === settings.quality &&
      Math.abs(entry.settings.frameRate - settings.frameRate) <= 2
    );
    
    if (relevantHistory.length === 0) {
      return 0.7; // Default confidence for new estimations
    }
    
    // Calculate average accuracy
    const accuracies = relevantHistory.map(entry => {
      const error = Math.abs(entry.estimated - entry.actual!) / entry.actual!;
      return Math.max(0, 1 - error);
    });
    
    const avgAccuracy = accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length;
    
    // Weight more recent estimations more heavily
    return Math.min(0.95, Math.max(0.5, avgAccuracy));
  }

  /**
   * Generate warnings based on settings
   */
  private generateWarnings(settings: GifSettings, estimatedSize: number): string[] {
    const warnings: string[] = [];
    const duration = settings.endTime - settings.startTime;
    
    if (estimatedSize > 10 * 1024 * 1024) { // 10MB
      warnings.push('File size may be very large (>10MB), consider reducing quality or resolution');
    }
    
    if (duration > 15 && settings.frameRate > 15) {
      warnings.push('Long duration with high frame rate may create extremely large files');
    }
    
    if (settings.frameRate > 20 && settings.quality === 'high') {
      warnings.push('High frame rate with high quality will significantly increase file size');
    }

    const [width, height] = getResolutionDimensions(settings.resolution, 640, 480);
    
    if ((width > 1024 || height > 768) && duration > 5) {
      warnings.push('High resolution with long duration may exceed browser memory limits');
    }
    
    return warnings;
  }

  /**
   * Generate recommendations based on settings
   */
  private generateRecommendations(settings: GifSettings, estimatedSize: number): string[] {
    const recommendations: string[] = [];
    const duration = settings.endTime - settings.startTime;
    
    if (estimatedSize > 5 * 1024 * 1024) { // 5MB
      recommendations.push('Consider reducing frame rate or quality to decrease file size');
    }
    
    if (duration <= 3 && settings.quality === 'low') {
      recommendations.push('Short clips can use higher quality without significant size increase');
    }
    
    if (settings.frameRate > 24 && duration > 3) {
      recommendations.push('Frame rates above 24fps rarely improve perceived quality for most content');
    }
    
    if (settings.frameRate < 8) {
      recommendations.push('Very low frame rates may result in choppy motion');
    }
    
    return recommendations;
  }

  /**
   * Simple encoding time estimation (used by compareSizes)
   */
  private estimateEncodingTime(settings: GifSettings): number {
    const duration = settings.endTime - settings.startTime;
    const frameCount = Math.ceil(duration * settings.frameRate);
    
    const qualityMultipliers = {
      low: 0.5,
      medium: 1.0,
      high: 2.0
    };
    
    const baseTimePerFrame = 50; // 50ms base per frame
    return frameCount * baseTimePerFrame * qualityMultipliers[settings.quality];
  }

  /**
   * Estimate file size for a given timeline selection with default settings
   */
  estimateForSelection(
    selection: TimelineSelection,
    defaultSettings: Partial<GifSettings> = {}
  ): FileSizeEstimate {
    const settings: GifSettings = {
      startTime: selection.startTime,
      endTime: selection.endTime,
      frameRate: 12,
      resolution: '640x480',
      quality: 'medium',
      speed: 1,
      brightness: 0,
      contrast: 0,
      ...defaultSettings
    };
    
    return this.getDetailedEstimate(settings);
  }
}