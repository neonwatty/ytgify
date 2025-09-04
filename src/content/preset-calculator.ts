import { TimelineSelection } from '@/types';

export type PresetDuration = 3 | 5 | 10;

export interface QuickPreset {
  duration: PresetDuration;
  label: string;
  description: string;
  icon: string;
}

export interface PresetCalculationOptions {
  videoDuration: number;
  currentTime: number;
  preferredPosition?: 'before' | 'after' | 'centered';
  minBuffer?: number; // Minimum buffer from video start/end
}

export interface PresetCalculationResult {
  selection: TimelineSelection;
  isOptimal: boolean; // Whether the calculation could place the preset optimally
  adjustments: string[]; // List of adjustments made (for user feedback)
  confidence: number; // 0-1 score of how well the preset fits
}

export class PresetCalculator {
  private static readonly DEFAULT_BUFFER = 0.5; // 500ms buffer from video boundaries
  private static readonly MIN_DURATION = 0.5; // Minimum viable GIF duration

  // Available quick presets
  public static readonly PRESETS: QuickPreset[] = [
    {
      duration: 3,
      label: '3s',
      description: 'Quick 3-second capture',
      icon: '⚡'
    },
    {
      duration: 5,
      label: '5s',
      description: 'Standard 5-second clip',
      icon: '🎬'
    },
    {
      duration: 10,
      label: '10s',
      description: 'Extended 10-second scene',
      icon: '📽️'
    }
  ];

  /**
   * Calculate optimal timeline selection for a given preset duration
   */
  public static calculatePreset(
    duration: PresetDuration,
    options: PresetCalculationOptions
  ): PresetCalculationResult {
    const { videoDuration, currentTime, preferredPosition = 'centered', minBuffer = this.DEFAULT_BUFFER } = options;

    // Validate inputs
    if (videoDuration <= 0 || currentTime < 0 || currentTime > videoDuration) {
      throw new Error('Invalid video parameters');
    }

    const adjustments: string[] = [];
    let confidence = 1.0;
    let requestedDuration = duration;

    // Handle case where video is shorter than preset duration
    if (videoDuration <= requestedDuration) {
      const effectiveDuration = Math.max(this.MIN_DURATION, videoDuration - (minBuffer * 2));
      
      if (effectiveDuration < this.MIN_DURATION) {
        return {
          selection: {
            startTime: 0,
            endTime: videoDuration,
            duration: videoDuration
          },
          isOptimal: false,
          adjustments: ['Video too short for any meaningful GIF'],
          confidence: 0
        };
      }

      requestedDuration = effectiveDuration as PresetDuration;
      adjustments.push(`Reduced duration to ${requestedDuration.toFixed(1)}s due to video length`);
      confidence *= 0.7;
    }

    let startTime: number;
    let endTime: number;

    // Calculate positioning based on preference
    switch (preferredPosition) {
      case 'before': {
        endTime = currentTime;
        startTime = Math.max(minBuffer, endTime - requestedDuration);
        break;
      }

      case 'after': {
        startTime = currentTime;
        endTime = Math.min(videoDuration - minBuffer, startTime + requestedDuration);
        break;
      }

      case 'centered':
      default: {
        const halfDuration = requestedDuration / 2;
        startTime = currentTime - halfDuration;
        endTime = currentTime + halfDuration;
        break;
      }
    }

    // Apply boundary constraints and adjustments
    const result = this.applyBoundaryConstraints({
      startTime,
      endTime,
      duration: endTime - startTime
    }, videoDuration, minBuffer);

    // Update adjustments based on constraints applied
    if (result.startTime !== startTime || result.endTime !== endTime) {
      adjustments.push(...this.calculateAdjustmentMessages(
        { startTime, endTime, duration: endTime - startTime },
        result,
        preferredPosition
      ));
      confidence *= 0.9;
    }

    // Calculate final confidence based on how close we got to the ideal
    const durationDifference = Math.abs(result.duration - requestedDuration);
    if (durationDifference > 0.5) {
      confidence *= Math.max(0.5, 1 - (durationDifference / requestedDuration));
    }

    // Check if the selection is reasonably positioned relative to current time
    if (currentTime < result.startTime || currentTime > result.endTime) {
      const distanceFromSelection = Math.min(
        Math.abs(currentTime - result.startTime),
        Math.abs(currentTime - result.endTime)
      );
      if (distanceFromSelection > requestedDuration * 0.5) {
        confidence *= 0.8;
        adjustments.push('Selection moved away from current playback position');
      }
    }

    return {
      selection: result,
      isOptimal: confidence >= 0.95 && adjustments.length === 0,
      adjustments,
      confidence: Math.max(0, Math.min(1, confidence))
    };
  }

  /**
   * Apply boundary constraints to ensure selection stays within video bounds
   */
  private static applyBoundaryConstraints(
    selection: TimelineSelection,
    videoDuration: number,
    minBuffer: number
  ): TimelineSelection {
    let { startTime, endTime } = selection;
    // Note: originalDuration could be used for comparison logging

    // Ensure minimum buffer from video start
    if (startTime < minBuffer) {
      const adjustment = minBuffer - startTime;
      startTime = minBuffer;
      endTime = Math.min(videoDuration - minBuffer, endTime + adjustment);
    }

    // Ensure minimum buffer from video end
    if (endTime > videoDuration - minBuffer) {
      const adjustment = endTime - (videoDuration - minBuffer);
      endTime = videoDuration - minBuffer;
      startTime = Math.max(minBuffer, startTime - adjustment);
    }

    // Ensure we don't go below minimum duration
    const currentDuration = endTime - startTime;
    if (currentDuration < this.MIN_DURATION) {
      // Try to expand while respecting boundaries
      const expansionNeeded = this.MIN_DURATION - currentDuration;
      const maxStartTime = Math.max(minBuffer, startTime - expansionNeeded / 2);
      const maxEndTime = Math.min(videoDuration - minBuffer, endTime + expansionNeeded / 2);

      if (maxEndTime - maxStartTime >= this.MIN_DURATION) {
        startTime = maxStartTime;
        endTime = maxEndTime;
      } else {
        // Use full available space if we can't get minimum duration
        startTime = minBuffer;
        endTime = videoDuration - minBuffer;
      }
    }

    return {
      startTime: Math.max(0, startTime),
      endTime: Math.min(videoDuration, endTime),
      duration: Math.min(videoDuration, endTime) - Math.max(0, startTime)
    };
  }

  /**
   * Generate user-friendly messages about adjustments made
   */
  private static calculateAdjustmentMessages(
    original: TimelineSelection,
    adjusted: TimelineSelection,
    _preferredPosition: string
  ): string[] {
    const messages: string[] = [];

    const startDiff = Math.abs(adjusted.startTime - original.startTime);
    const endDiff = Math.abs(adjusted.endTime - original.endTime);
    const durationDiff = Math.abs(adjusted.duration - original.duration);

    if (startDiff > 0.1 || endDiff > 0.1) {
      if (adjusted.startTime > original.startTime) {
        messages.push('Moved start time forward to stay within video bounds');
      } else if (adjusted.startTime < original.startTime) {
        messages.push('Moved start time backward to accommodate duration');
      }

      if (adjusted.endTime < original.endTime) {
        messages.push('Moved end time backward to stay within video bounds');
      } else if (adjusted.endTime > original.endTime) {
        messages.push('Extended end time to maintain duration');
      }
    }

    if (durationDiff > 0.1) {
      if (adjusted.duration < original.duration) {
        messages.push(`Duration reduced by ${durationDiff.toFixed(1)}s due to video constraints`);
      } else {
        messages.push(`Duration extended by ${durationDiff.toFixed(1)}s to meet minimum requirements`);
      }
    }

    return messages;
  }

  /**
   * Get the best preset duration for a given video
   */
  public static getBestPresetForVideo(videoDuration: number): PresetDuration {
    if (videoDuration < 5) {
      return 3;
    } else if (videoDuration < 15) {
      return 5;
    } else {
      return 10;
    }
  }

  /**
   * Check if a preset duration is viable for a video
   */
  public static isPresetViable(duration: PresetDuration, videoDuration: number): boolean {
    return videoDuration >= duration * 0.5; // At least 50% of preset duration must be available
  }

  /**
   * Get smart recommendations based on current video context
   */
  public static getRecommendedPresets(
    videoDuration: number,
    currentTime: number
  ): { preset: QuickPreset; viability: number; reason: string }[] {
    return this.PRESETS.map(preset => {
      const viability = this.calculatePresetViability(preset.duration, videoDuration, currentTime);
      const reason = this.getViabilityReason(preset.duration, videoDuration, currentTime);
      
      return {
        preset,
        viability,
        reason
      };
    }).sort((a, b) => b.viability - a.viability);
  }

  /**
   * Calculate how well a preset duration works for the current context (0-1)
   */
  private static calculatePresetViability(
    duration: PresetDuration,
    videoDuration: number,
    currentTime: number
  ): number {
    // Base viability on whether the preset fits in the video
    let viability = Math.min(1, videoDuration / duration);

    // Bonus if we have good positioning options around current time
    const availableBeforeTime = currentTime;
    const availableAfterTime = videoDuration - currentTime;
    const halfDuration = duration / 2;

    if (availableBeforeTime >= halfDuration && availableAfterTime >= halfDuration) {
      viability = Math.min(1, viability + 0.2); // Bonus for centered positioning
    } else if (availableBeforeTime >= duration || availableAfterTime >= duration) {
      viability = Math.min(1, viability + 0.1); // Smaller bonus for one-sided positioning
    }

    // Penalty for very short or very long relative durations
    const durationRatio = duration / videoDuration;
    if (durationRatio < 0.1) {
      viability *= 0.9; // Small penalty for very short relative duration
    } else if (durationRatio > 0.8) {
      viability *= 0.7; // Larger penalty for taking most of the video
    }

    return Math.max(0, Math.min(1, viability));
  }

  /**
   * Get explanation for why a preset has its viability score
   */
  private static getViabilityReason(
    duration: PresetDuration,
    videoDuration: number,
    currentTime: number
  ): string {
    if (videoDuration < duration * 0.5) {
      return 'Video too short for this duration';
    }

    if (videoDuration < duration) {
      return 'Limited by video length';
    }

    const halfDuration = duration / 2;
    const canCenter = currentTime >= halfDuration && (videoDuration - currentTime) >= halfDuration;

    if (canCenter) {
      return 'Perfect fit - can center around current time';
    }

    const canFitBefore = currentTime >= duration;
    const canFitAfter = (videoDuration - currentTime) >= duration;

    if (canFitBefore && canFitAfter) {
      return 'Good fit - flexible positioning';
    } else if (canFitBefore) {
      return 'Can position before current time';
    } else if (canFitAfter) {
      return 'Can position after current time';
    } else {
      return 'Will require adjustment to fit';
    }
  }

  /**
   * Calculate multiple preset options for comparison
   */
  public static calculateAllPresets(
    options: PresetCalculationOptions
  ): { [K in PresetDuration]: PresetCalculationResult } {
    const results = {} as { [K in PresetDuration]: PresetCalculationResult };

    for (const preset of this.PRESETS) {
      try {
        results[preset.duration] = this.calculatePreset(preset.duration, options);
      } catch (error) {
        results[preset.duration] = {
          selection: {
            startTime: 0,
            endTime: Math.min(preset.duration, options.videoDuration),
            duration: Math.min(preset.duration, options.videoDuration)
          },
          isOptimal: false,
          adjustments: [`Error calculating preset: ${error instanceof Error ? error.message : 'Unknown error'}`],
          confidence: 0
        };
      }
    }

    return results;
  }
}