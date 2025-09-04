/**
 * Dynamic frame rate and quality control system for GIF creation
 * Provides intelligent frame rate adjustment (5-30fps) and quality settings
 * that balance file size and visual quality with real-time estimation.
 */

import { GifSettings, TimelineSelection } from '@/types';
import { EncodingOptimizer, GifEncodingOptions } from './encoding-options';
import { FileSizeEstimator } from './file-size-estimator';

export interface QualityControlSettings {
  frameRate: number; // 5-30 fps
  quality: 'low' | 'medium' | 'high';
  resolution: string; // e.g., "640x480"
  maxFileSize?: number; // in bytes, optional target
  prioritizeSpeed: boolean; // true for faster encoding, false for better quality
}

export interface QualityRecommendation {
  recommendedFrameRate: number;
  recommendedQuality: 'low' | 'medium' | 'high';
  recommendedResolution: string;
  estimatedFileSize: number;
  estimatedEncodingTime: number;
  reasoning: string[];
}

export interface FrameRateProfile {
  fps: number;
  name: string;
  description: string;
  suitableFor: string[];
  estimatedQualityImpact: number; // 0-1 scale
}

export interface QualityProfile {
  quality: 'low' | 'medium' | 'high';
  name: string;
  description: string;
  encodingMultiplier: number; // time multiplier vs base
  fileSizeMultiplier: number; // size multiplier vs base
  visualQualityScore: number; // 0-1 scale
}

/**
 * Predefined frame rate profiles optimized for different content types
 */
export const FRAME_RATE_PROFILES: FrameRateProfile[] = [
  {
    fps: 5,
    name: 'Ultra Slow',
    description: 'Minimal frames, smallest files, choppy motion',
    suitableFor: ['static content', 'memes', 'simple animations'],
    estimatedQualityImpact: 0.3
  },
  {
    fps: 8,
    name: 'Slow',
    description: 'Low frame rate, good for simple content',
    suitableFor: ['text animations', 'simple graphics', 'reaction GIFs'],
    estimatedQualityImpact: 0.5
  },
  {
    fps: 12,
    name: 'Standard',
    description: 'Balanced frame rate, good for most content',
    suitableFor: ['gaming clips', 'tutorials', 'general purpose'],
    estimatedQualityImpact: 0.7
  },
  {
    fps: 15,
    name: 'Smooth',
    description: 'Higher quality motion, larger files',
    suitableFor: ['action sequences', 'sports', 'smooth animations'],
    estimatedQualityImpact: 0.8
  },
  {
    fps: 20,
    name: 'High Quality',
    description: 'Very smooth motion, significant file size increase',
    suitableFor: ['cinematic content', 'detailed animations', 'presentation clips'],
    estimatedQualityImpact: 0.9
  },
  {
    fps: 24,
    name: 'Cinematic',
    description: 'Film-like frame rate, large files',
    suitableFor: ['movie clips', 'professional content', 'high-quality demos'],
    estimatedQualityImpact: 0.95
  },
  {
    fps: 30,
    name: 'Ultra Smooth',
    description: 'Maximum frame rate, largest files, best motion quality',
    suitableFor: ['fast action', 'gaming highlights', 'premium content'],
    estimatedQualityImpact: 1.0
  }
];

/**
 * Quality profiles with detailed characteristics
 */
export const QUALITY_PROFILES: QualityProfile[] = [
  {
    quality: 'low',
    name: 'Fast & Small',
    description: 'Quick encoding, smallest file size, acceptable quality',
    encodingMultiplier: 0.5,
    fileSizeMultiplier: 0.6,
    visualQualityScore: 0.6
  },
  {
    quality: 'medium',
    name: 'Balanced',
    description: 'Good balance of quality, file size, and encoding time',
    encodingMultiplier: 1.0,
    fileSizeMultiplier: 1.0,
    visualQualityScore: 0.8
  },
  {
    quality: 'high',
    name: 'Best Quality',
    description: 'Highest quality, larger files, longer encoding time',
    encodingMultiplier: 2.0,
    fileSizeMultiplier: 1.8,
    visualQualityScore: 1.0
  }
];

/**
 * Core quality management system
 */
export class QualityManager {
  private fileSizeEstimator: FileSizeEstimator;

  constructor() {
    this.fileSizeEstimator = new FileSizeEstimator();
  }

  /**
   * Get frame rate profile by FPS value
   */
  getFrameRateProfile(fps: number): FrameRateProfile {
    return FRAME_RATE_PROFILES.find(profile => profile.fps === fps) ||
           FRAME_RATE_PROFILES.find(profile => profile.fps === 12)!; // Default to standard
  }

  /**
   * Get quality profile by quality setting
   */
  getQualityProfile(quality: 'low' | 'medium' | 'high'): QualityProfile {
    return QUALITY_PROFILES.find(profile => profile.quality === quality)!;
  }

  /**
   * Validate frame rate within acceptable range
   */
  validateFrameRate(fps: number): { valid: boolean; adjustedFps?: number; warning?: string } {
    if (fps < 5) {
      return {
        valid: false,
        adjustedFps: 5,
        warning: 'Frame rate too low, adjusted to minimum of 5fps'
      };
    }
    
    if (fps > 30) {
      return {
        valid: false,
        adjustedFps: 30,
        warning: 'Frame rate too high, adjusted to maximum of 30fps'
      };
    }

    // Snap to nearest supported frame rate
    const supportedRates = FRAME_RATE_PROFILES.map(p => p.fps);
    const nearest = supportedRates.reduce((prev, curr) => 
      Math.abs(curr - fps) < Math.abs(prev - fps) ? curr : prev
    );

    if (nearest !== fps) {
      return {
        valid: false,
        adjustedFps: nearest,
        warning: `Frame rate adjusted to nearest supported value: ${nearest}fps`
      };
    }

    return { valid: true };
  }

  /**
   * Analyze video content to recommend optimal settings
   */
  analyzeContent(
    selection: TimelineSelection,
    videoMetadata?: {
      originalFrameRate: number;
      resolution: { width: number; height: number };
      bitrate?: number;
    }
  ): QualityRecommendation {
    const duration = selection.duration;
    const reasoning: string[] = [];

    // Start with default medium quality
    let recommendedQuality: 'low' | 'medium' | 'high' = 'medium';
    let recommendedFrameRate = 12; // Standard default
    let recommendedResolution = '640x480';

    // Analyze duration impact
    if (duration <= 2) {
      recommendedQuality = 'high';
      recommendedFrameRate = Math.min(15, videoMetadata?.originalFrameRate || 15);
      reasoning.push('Short duration allows for higher quality');
    } else if (duration <= 5) {
      recommendedFrameRate = 12;
      reasoning.push('Medium duration, balanced settings recommended');
    } else if (duration <= 10) {
      recommendedQuality = 'medium';
      recommendedFrameRate = 10;
      reasoning.push('Longer duration, optimizing for file size');
    } else {
      recommendedQuality = 'low';
      recommendedFrameRate = 8;
      reasoning.push('Very long duration, prioritizing small file size');
    }

    // Adjust based on source video characteristics
    if (videoMetadata) {
      if (videoMetadata.originalFrameRate <= 15) {
        recommendedFrameRate = Math.min(recommendedFrameRate, videoMetadata.originalFrameRate);
        reasoning.push(`Matched source frame rate (${videoMetadata.originalFrameRate}fps)`);
      }

      // Adjust resolution based on source
      const { width, height } = videoMetadata.resolution;
      if (width <= 480 || height <= 360) {
        recommendedResolution = '480x360';
        reasoning.push('Small source resolution detected');
      } else if (width <= 720 || height <= 480) {
        recommendedResolution = '640x480';
        reasoning.push('Standard definition source');
      } else {
        recommendedResolution = '720x480';
        reasoning.push('High definition source, using larger output');
      }
    }

    // Validate and adjust frame rate
    const frameRateValidation = this.validateFrameRate(recommendedFrameRate);
    if (!frameRateValidation.valid && frameRateValidation.adjustedFps) {
      recommendedFrameRate = frameRateValidation.adjustedFps;
      if (frameRateValidation.warning) {
        reasoning.push(frameRateValidation.warning);
      }
    }

    // Estimate file size and encoding time
    const tempSettings: GifSettings = {
      startTime: selection.startTime,
      endTime: selection.endTime,
      frameRate: recommendedFrameRate,
      resolution: recommendedResolution,
      quality: recommendedQuality,
      speed: 1,
      brightness: 0,
      contrast: 0
    };

    const estimatedFileSize = this.fileSizeEstimator.estimateFileSize(tempSettings);
    const estimatedEncodingTime = this.estimateEncodingTime(tempSettings);

    return {
      recommendedFrameRate,
      recommendedQuality,
      recommendedResolution,
      estimatedFileSize,
      estimatedEncodingTime,
      reasoning
    };
  }

  /**
   * Optimize settings for a target file size
   */
  optimizeForFileSize(
    settings: GifSettings,
    targetFileSizeBytes: number,
    tolerancePercent: number = 10
  ): {
    optimizedSettings: GifSettings;
    estimatedFileSize: number;
    reductionSteps: string[];
  } {
    const optimizedSettings = { ...settings };
    const reductionSteps: string[] = [];
    let currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
    
    const targetRange = {
      min: targetFileSizeBytes * (1 - tolerancePercent / 100),
      max: targetFileSizeBytes * (1 + tolerancePercent / 100)
    };

    // If we're already within range, return as-is
    if (currentFileSize >= targetRange.min && currentFileSize <= targetRange.max) {
      return {
        optimizedSettings,
        estimatedFileSize: currentFileSize,
        reductionSteps: ['No optimization needed - already within target range']
      };
    }

    // If file is too large, reduce quality step by step
    if (currentFileSize > targetRange.max) {
      // Step 1: Reduce frame rate
      if (optimizedSettings.frameRate > 8) {
        const originalFps = optimizedSettings.frameRate;
        optimizedSettings.frameRate = Math.max(8, Math.floor(optimizedSettings.frameRate * 0.75));
        currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
        reductionSteps.push(`Reduced frame rate from ${originalFps} to ${optimizedSettings.frameRate}fps`);
      }

      // Step 2: Reduce quality if still too large
      if (currentFileSize > targetRange.max && optimizedSettings.quality === 'high') {
        optimizedSettings.quality = 'medium';
        currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
        reductionSteps.push('Reduced quality from high to medium');
      }

      // Step 3: Further reduce quality if still too large
      if (currentFileSize > targetRange.max && optimizedSettings.quality === 'medium') {
        optimizedSettings.quality = 'low';
        currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
        reductionSteps.push('Reduced quality from medium to low');
      }

      // Step 4: Reduce resolution if still too large
      if (currentFileSize > targetRange.max) {
        const [width, height] = optimizedSettings.resolution.includes('x') 
          ? optimizedSettings.resolution.split('x').map(n => parseInt(n.trim()))
          : [640, 480];
        
        const newWidth = Math.floor(width * 0.8);
        const newHeight = Math.floor(height * 0.8);
        optimizedSettings.resolution = `${newWidth}x${newHeight}`;
        currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
        reductionSteps.push(`Reduced resolution from ${width}x${height} to ${newWidth}x${newHeight}`);
      }

      // Step 5: Last resort - reduce frame rate to minimum
      if (currentFileSize > targetRange.max && optimizedSettings.frameRate > 5) {
        optimizedSettings.frameRate = 5;
        currentFileSize = this.fileSizeEstimator.estimateFileSize(optimizedSettings);
        reductionSteps.push('Reduced frame rate to minimum (5fps)');
      }
    }

    return {
      optimizedSettings,
      estimatedFileSize: currentFileSize,
      reductionSteps
    };
  }

  /**
   * Create optimal encoding options from quality settings
   */
  createEncodingOptions(settings: GifSettings): GifEncodingOptions {
    return EncodingOptimizer.createOptionsFromSettings(settings);
  }

  /**
   * Estimate encoding time based on settings
   */
  estimateEncodingTime(settings: GifSettings): number {
    const duration = settings.endTime - settings.startTime;
    const frameCount = Math.ceil(duration * settings.frameRate);
    
    // Base time per frame (milliseconds)
    const qualityProfile = this.getQualityProfile(settings.quality);
    const baseTimePerFrame = 50; // 50ms base per frame
    
    const [width, height] = settings.resolution.includes('x')
      ? settings.resolution.split('x').map(n => parseInt(n.trim()))
      : [640, 480];
    
    // Resolution complexity factor
    const pixelCount = width * height;
    const resolutionFactor = Math.sqrt(pixelCount / (640 * 480)); // Normalized to standard resolution
    
    // Calculate total time
    const estimatedTime = frameCount * baseTimePerFrame * qualityProfile.encodingMultiplier * resolutionFactor;
    
    return Math.round(estimatedTime);
  }

  /**
   * Generate a quality control summary for UI display
   */
  getQualitySummary(settings: GifSettings): {
    frameRateProfile: FrameRateProfile;
    qualityProfile: QualityProfile;
    estimatedFileSize: string;
    estimatedEncodingTime: string;
    recommendations: string[];
  } {
    const frameRateProfile = this.getFrameRateProfile(settings.frameRate);
    const qualityProfile = this.getQualityProfile(settings.quality);
    const fileSize = this.fileSizeEstimator.estimateFileSize(settings);
    const encodingTime = this.estimateEncodingTime(settings);
    
    const recommendations: string[] = [];
    const duration = settings.endTime - settings.startTime;
    
    // Generate context-aware recommendations
    if (duration > 10 && settings.quality === 'high') {
      recommendations.push('Consider medium quality for long clips to reduce file size');
    }
    
    if (settings.frameRate > 20 && duration > 5) {
      recommendations.push('High frame rate with long duration may create very large files');
    }
    
    if (fileSize > 5 * 1024 * 1024) { // 5MB
      recommendations.push('Estimated file size is large, consider reducing quality or frame rate');
    }
    
    if (encodingTime > 15000) { // 15 seconds
      recommendations.push('Encoding may take a while, consider faster quality settings');
    }

    return {
      frameRateProfile,
      qualityProfile,
      estimatedFileSize: this.formatFileSize(fileSize),
      estimatedEncodingTime: this.formatTime(encodingTime),
      recommendations
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Format time duration for display
   */
  private formatTime(milliseconds: number): string {
    if (milliseconds < 1000) return `${milliseconds}ms`;
    const seconds = milliseconds / 1000;
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Real-time quality adjustment based on performance feedback
   */
  adjustQualityForPerformance(
    currentSettings: GifSettings,
    performanceMetrics: {
      averageFrameProcessingTime: number;
      memoryUsage: number;
      encodingProgress: number;
      estimatedTimeRemaining: number;
    }
  ): { adjustedSettings: GifSettings; adjustmentReason: string } {
    const adjustedSettings = { ...currentSettings };
    let adjustmentReason = '';

    // If processing is too slow (> 200ms per frame), reduce quality
    if (performanceMetrics.averageFrameProcessingTime > 200) {
      if (adjustedSettings.quality === 'high') {
        adjustedSettings.quality = 'medium';
        adjustmentReason = 'Reduced quality to medium for better performance';
      } else if (adjustedSettings.quality === 'medium') {
        adjustedSettings.quality = 'low';
        adjustmentReason = 'Reduced quality to low for better performance';
      }
    }

    // If memory usage is high (> 150MB), reduce frame rate
    if (performanceMetrics.memoryUsage > 150 * 1024 * 1024 && adjustedSettings.frameRate > 8) {
      adjustedSettings.frameRate = Math.max(8, adjustedSettings.frameRate - 2);
      adjustmentReason += (adjustmentReason ? '; ' : '') + 'Reduced frame rate due to high memory usage';
    }

    // If estimated time remaining is too long (> 20s), optimize for speed
    if (performanceMetrics.estimatedTimeRemaining > 20000) {
      if (adjustedSettings.quality !== 'low') {
        adjustedSettings.quality = 'low';
        adjustmentReason += (adjustmentReason ? '; ' : '') + 'Switched to fast encoding to meet time constraints';
      }
    }

    return {
      adjustedSettings,
      adjustmentReason: adjustmentReason || 'No adjustments needed'
    };
  }
}