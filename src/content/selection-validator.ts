import { TimelineSelection } from '@/types';
import { logger } from '@/lib/logger';

export interface ValidationConfig {
  minDuration: number;
  maxDuration: number;
  maxFileSize?: number; // in MB
  allowZeroDuration?: boolean;
  customValidators?: ValidationRule[];
}

export interface ValidationRule {
  name: string;
  validate: (selection: TimelineSelection, videoDuration: number) => ValidationResult;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  message: string;
  suggestion?: string;
  severity: 'error' | 'warning' | 'info';
}

export interface ValidationSummary {
  isValid: boolean;
  errors: ValidationResult[];
  warnings: ValidationResult[];
  infos: ValidationResult[];
  canProceed: boolean;
}

export class SelectionValidator {
  private config: ValidationConfig;
  private defaultRules: ValidationRule[];

  constructor(config: ValidationConfig) {
    this.config = {
      allowZeroDuration: false,
      ...config
    };
    
    this.defaultRules = this.createDefaultRules();
  }

  private createDefaultRules(): ValidationRule[] {
    return [
      {
        name: 'minimum-duration',
        severity: 'error',
        validate: (selection: TimelineSelection) => {
          if (selection.duration < this.config.minDuration) {
            return {
              isValid: false,
              message: `Selection duration (${this.formatDuration(selection.duration)}) is below minimum (${this.formatDuration(this.config.minDuration)})`,
              suggestion: `Extend your selection to at least ${this.formatDuration(this.config.minDuration)}`,
              severity: 'error'
            };
          }
          return { isValid: true, message: 'Duration meets minimum requirement', severity: 'info' };
        }
      },
      {
        name: 'maximum-duration',
        severity: 'error',
        validate: (selection: TimelineSelection) => {
          if (selection.duration > this.config.maxDuration) {
            return {
              isValid: false,
              message: `Selection duration (${this.formatDuration(selection.duration)}) exceeds maximum (${this.formatDuration(this.config.maxDuration)})`,
              suggestion: `Reduce your selection to ${this.formatDuration(this.config.maxDuration)} or less`,
              severity: 'error'
            };
          }
          return { isValid: true, message: 'Duration within maximum limit', severity: 'info' };
        }
      },
      {
        name: 'zero-duration',
        severity: 'error',
        validate: (selection: TimelineSelection) => {
          if (!this.config.allowZeroDuration && selection.duration === 0) {
            return {
              isValid: false,
              message: 'Selection cannot have zero duration',
              suggestion: 'Click and drag to create a time range, or click two points to set start and end',
              severity: 'error'
            };
          }
          return { isValid: true, message: 'Duration is valid', severity: 'info' };
        }
      },
      {
        name: 'valid-time-range',
        severity: 'error',
        validate: (selection: TimelineSelection, videoDuration: number) => {
          if (selection.startTime < 0 || selection.endTime < 0) {
            return {
              isValid: false,
              message: 'Selection times cannot be negative',
              suggestion: 'Ensure both start and end times are positive',
              severity: 'error'
            };
          }
          
          if (selection.startTime >= selection.endTime) {
            return {
              isValid: false,
              message: 'Start time must be before end time',
              suggestion: 'Adjust your selection so the start comes before the end',
              severity: 'error'
            };
          }
          
          if (selection.endTime > videoDuration) {
            return {
              isValid: false,
              message: 'Selection extends beyond video duration',
              suggestion: `Reduce end time to ${this.formatDuration(videoDuration)} or less`,
              severity: 'error'
            };
          }
          
          return { isValid: true, message: 'Time range is valid', severity: 'info' };
        }
      },
      {
        name: 'duration-consistency',
        severity: 'warning',
        validate: (selection: TimelineSelection) => {
          const calculatedDuration = selection.endTime - selection.startTime;
          const tolerance = 0.1; // 100ms tolerance
          
          if (Math.abs(selection.duration - calculatedDuration) > tolerance) {
            return {
              isValid: false,
              message: 'Selection duration inconsistent with start/end times',
              suggestion: 'This appears to be a calculation error. Try reselecting the time range',
              severity: 'warning'
            };
          }
          
          return { isValid: true, message: 'Duration calculation is consistent', severity: 'info' };
        }
      },
      {
        name: 'optimal-duration',
        severity: 'warning',
        validate: (selection: TimelineSelection) => {
          const optimalMin = 1; // 1 second
          const optimalMax = 10; // 10 seconds
          
          if (selection.duration < optimalMin) {
            return {
              isValid: true,
              message: 'Very short selection may result in low-quality GIF',
              suggestion: `Consider extending to ${optimalMin}+ seconds for better quality`,
              severity: 'warning'
            };
          }
          
          if (selection.duration > optimalMax) {
            return {
              isValid: true,
              message: 'Long selection will create large file size',
              suggestion: `Consider reducing to ${optimalMax} seconds or less for smaller file size`,
              severity: 'info'
            };
          }
          
          return { isValid: true, message: 'Duration is in optimal range', severity: 'info' };
        }
      }
    ];
  }

  public validate(selection: TimelineSelection, videoDuration: number): ValidationSummary {
    const results: ValidationResult[] = [];
    
    // Run default validation rules
    this.defaultRules.forEach(rule => {
      try {
        const result = rule.validate(selection, videoDuration);
        if (!result.isValid || result.severity !== 'info') {
          results.push({ ...result, severity: result.severity || rule.severity });
        }
      } catch (error) {
        logger.error(`[SelectionValidator] Error in rule '${rule.name}'`, { error });
        results.push({
          isValid: false,
          message: `Validation error in rule '${rule.name}'`,
          severity: 'warning'
        });
      }
    });

    // Run custom validation rules if provided
    if (this.config.customValidators) {
      this.config.customValidators.forEach(rule => {
        try {
          const result = rule.validate(selection, videoDuration);
          if (!result.isValid || result.severity !== 'info') {
            results.push({ ...result, severity: result.severity || rule.severity });
          }
        } catch (error) {
          logger.error(`[SelectionValidator] Error in custom rule '${rule.name}'`, { error });
          results.push({
            isValid: false,
            message: `Custom validation error in rule '${rule.name}'`,
            severity: 'warning'
          });
        }
      });
    }

    // Categorize results
    const errors = results.filter(r => r.severity === 'error');
    const warnings = results.filter(r => r.severity === 'warning');
    const infos = results.filter(r => r.severity === 'info');

    // Determine overall validity
    const isValid = errors.length === 0;
    const canProceed = isValid; // Could be modified to allow proceeding with warnings

    return {
      isValid,
      errors,
      warnings,
      infos,
      canProceed
    };
  }

  public validateQuick(selection: TimelineSelection, videoDuration: number): boolean {
    // Quick validation for real-time feedback
    return (
      selection.duration >= this.config.minDuration &&
      selection.duration <= this.config.maxDuration &&
      selection.startTime >= 0 &&
      selection.endTime <= videoDuration &&
      selection.startTime < selection.endTime &&
      (this.config.allowZeroDuration || selection.duration > 0)
    );
  }

  public getValidationMessage(selection: TimelineSelection, videoDuration: number): string {
    const summary = this.validate(selection, videoDuration);
    
    if (summary.errors.length > 0) {
      return summary.errors[0].message;
    }
    
    if (summary.warnings.length > 0) {
      return summary.warnings[0].message;
    }
    
    return 'Selection is valid';
  }

  public getSuggestion(selection: TimelineSelection, videoDuration: number): string | null {
    const summary = this.validate(selection, videoDuration);
    
    if (summary.errors.length > 0 && summary.errors[0].suggestion) {
      return summary.errors[0].suggestion;
    }
    
    if (summary.warnings.length > 0 && summary.warnings[0].suggestion) {
      return summary.warnings[0].suggestion;
    }
    
    return null;
  }

  public adjustSelectionToValid(selection: TimelineSelection, videoDuration: number): TimelineSelection {
    const adjusted = { ...selection };
    
    // Clamp to video bounds
    adjusted.startTime = Math.max(0, Math.min(videoDuration, adjusted.startTime));
    adjusted.endTime = Math.max(0, Math.min(videoDuration, adjusted.endTime));
    
    // Ensure start < end
    if (adjusted.startTime >= adjusted.endTime) {
      if (adjusted.startTime > 0) {
        adjusted.endTime = Math.min(videoDuration, adjusted.startTime + this.config.minDuration);
      } else {
        adjusted.endTime = Math.min(videoDuration, this.config.minDuration);
      }
    }
    
    // Adjust duration to meet constraints
    const duration = adjusted.endTime - adjusted.startTime;
    
    if (duration < this.config.minDuration) {
      const shortfall = this.config.minDuration - duration;
      
      // Try extending end first
      if (adjusted.endTime + shortfall <= videoDuration) {
        adjusted.endTime += shortfall;
      } else if (adjusted.startTime - shortfall >= 0) {
        // Extend start backwards
        adjusted.startTime -= shortfall;
      } else {
        // Can't meet minimum duration within video bounds
        adjusted.startTime = 0;
        adjusted.endTime = Math.min(this.config.minDuration, videoDuration);
      }
    } else if (duration > this.config.maxDuration) {
      // Reduce duration by moving end time
      adjusted.endTime = adjusted.startTime + this.config.maxDuration;
    }
    
    // Recalculate duration
    adjusted.duration = adjusted.endTime - adjusted.startTime;
    
    return adjusted;
  }

  public estimateFileSize(selection: TimelineSelection, frameRate: number = 15, quality: 'low' | 'medium' | 'high' = 'medium'): number {
    // Rough estimation in MB based on duration, frame rate, and quality
    const qualityMultiplier = {
      low: 0.5,
      medium: 1.0,
      high: 2.0
    };
    
    const baseSizePerSecond = 0.5; // MB per second at medium quality, 15fps
    const duration = selection.duration;
    const frameRateMultiplier = frameRate / 15;
    const totalMultiplier = qualityMultiplier[quality] * frameRateMultiplier;
    
    return duration * baseSizePerSecond * totalMultiplier;
  }

  public checkFileSizeLimit(selection: TimelineSelection, frameRate?: number, quality?: 'low' | 'medium' | 'high'): ValidationResult {
    if (!this.config.maxFileSize) {
      return { isValid: true, message: 'No file size limit configured', severity: 'info' };
    }
    
    const estimatedSize = this.estimateFileSize(
      selection, 
      frameRate || 15, 
      quality || 'medium'
    );
    
    if (estimatedSize > this.config.maxFileSize) {
      return {
        isValid: false,
        message: `Estimated file size (${estimatedSize.toFixed(1)}MB) exceeds limit (${this.config.maxFileSize}MB)`,
        suggestion: 'Reduce duration, frame rate, or quality to decrease file size',
        severity: 'warning'
      };
    }
    
    return {
      isValid: true,
      message: `Estimated file size: ${estimatedSize.toFixed(1)}MB`,
      severity: 'info'
    };
  }

  private formatDuration(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (remainingSeconds === 0) {
      return `${minutes}m`;
    }
    
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  }

  public updateConfig(newConfig: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Recreate default rules with new config
    this.defaultRules = this.createDefaultRules();
    
    logger.debug('[SelectionValidator] Configuration updated', { config: this.config });
  }

  public getConfig(): ValidationConfig {
    return { ...this.config };
  }

  public addCustomValidator(rule: ValidationRule): void {
    if (!this.config.customValidators) {
      this.config.customValidators = [];
    }
    
    this.config.customValidators.push(rule);
    logger.debug('[SelectionValidator] Custom validator added', { ruleName: rule.name });
  }

  public removeCustomValidator(ruleName: string): boolean {
    if (!this.config.customValidators) {
      return false;
    }
    
    const initialLength = this.config.customValidators.length;
    this.config.customValidators = this.config.customValidators.filter(rule => rule.name !== ruleName);
    
    const removed = this.config.customValidators.length < initialLength;
    
    if (removed) {
      logger.debug('[SelectionValidator] Custom validator removed', { ruleName });
    }
    
    return removed;
  }
}