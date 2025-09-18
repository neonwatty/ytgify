import React, { useState, useCallback, useMemo } from 'react';
import { TimelineSelection } from '@/types';
import { 
  PresetCalculator, 
  PresetDuration, 
  QuickPreset, 
  PresetCalculationOptions,
  PresetCalculationResult 
} from './preset-calculator';

interface QuickPresetsProps {
  videoDuration: number;
  currentTime: number;
  onPresetSelect: (selection: TimelineSelection, presetInfo: { duration: PresetDuration; confidence: number }) => void;
  disabled?: boolean;
  className?: string;
}

interface PresetButtonProps {
  preset: QuickPreset;
  result: PresetCalculationResult;
  onSelect: () => void;
  disabled: boolean;
  isRecommended?: boolean;
}

const PresetButton: React.FC<PresetButtonProps> = ({ 
  preset, 
  result, 
  onSelect, 
  disabled, 
  isRecommended = false 
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const getButtonClass = useCallback(() => {
    const baseClass = 'ytgif-preset-btn';
    const classes = [baseClass];

    if (disabled) {
      classes.push(`${baseClass}--disabled`);
    } else {
      // Color code based on confidence
      if (result.confidence >= 0.9) {
        classes.push(`${baseClass}--excellent`);
      } else if (result.confidence >= 0.7) {
        classes.push(`${baseClass}--good`);
      } else if (result.confidence >= 0.5) {
        classes.push(`${baseClass}--fair`);
      } else {
        classes.push(`${baseClass}--poor`);
      }
    }

    if (isRecommended) {
      classes.push(`${baseClass}--recommended`);
    }

    return classes.join(' ');
  }, [disabled, result.confidence, isRecommended]);

  const handleClick = useCallback(() => {
    if (!disabled) {
      onSelect();
    }
  }, [disabled, onSelect]);

  const formatDuration = useCallback((duration: number) => {
    return `${duration.toFixed(1)}s`;
  }, []);

  const getConfidenceLabel = useCallback((confidence: number) => {
    if (confidence >= 0.9) return 'Excellent';
    if (confidence >= 0.7) return 'Good';
    if (confidence >= 0.5) return 'Fair';
    return 'Limited';
  }, []);

  return (
    <div className="ytgif-preset-container">
      <button
        className={getButtonClass()}
        onClick={handleClick}
        disabled={disabled}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={`${preset.description} - ${formatDuration(result.selection.duration)}`}
      >
        <div className="ytgif-preset-btn__icon">
          {preset.icon}
        </div>
        <div className="ytgif-preset-btn__label">
          {preset.label}
        </div>
        <div className="ytgif-preset-btn__duration">
          {formatDuration(result.selection.duration)}
        </div>
        {isRecommended && (
          <div className="ytgif-preset-btn__badge">
            ⭐
          </div>
        )}
      </button>

      {showTooltip && (
        <div className="ytgif-preset-tooltip">
          <div className="ytgif-preset-tooltip__header">
            <strong>{preset.description}</strong>
            {isRecommended && <span className="ytgif-preset-tooltip__recommended">Recommended</span>}
          </div>
          
          <div className="ytgif-preset-tooltip__details">
            <div className="ytgif-preset-tooltip__time">
              📍 {result.selection.startTime.toFixed(1)}s → {result.selection.endTime.toFixed(1)}s
            </div>
            <div className="ytgif-preset-tooltip__quality">
              🎯 {getConfidenceLabel(result.confidence)} fit ({Math.round(result.confidence * 100)}%)
            </div>
            {result.adjustments.length > 0 && (
              <div className="ytgif-preset-tooltip__adjustments">
                <div className="ytgif-preset-tooltip__adjustments-title">Adjustments:</div>
                {result.adjustments.map((adjustment, index) => (
                  <div key={index} className="ytgif-preset-tooltip__adjustment">
                    • {adjustment}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export const QuickPresets: React.FC<QuickPresetsProps> = ({
  videoDuration,
  currentTime,
  onPresetSelect,
  disabled = false,
  className = ''
}) => {
  const calculationOptions = useMemo<PresetCalculationOptions>(() => ({
    videoDuration,
    currentTime,
    preferredPosition: 'after',
    minBuffer: 0.5
  }), [videoDuration, currentTime]);

  // Calculate all preset results
  const presetResults = useMemo(() => {
    return PresetCalculator.calculateAllPresets(calculationOptions);
  }, [calculationOptions]);

  // Get recommended presets
  const recommendations = useMemo(() => {
    return PresetCalculator.getRecommendedPresets(videoDuration, currentTime);
  }, [videoDuration, currentTime]);

  // Find the best recommended preset
  const bestPreset = useMemo(() => {
    return recommendations.length > 0 ? recommendations[0].preset : null;
  }, [recommendations]);

  // Handle preset selection
  const handlePresetSelect = useCallback((preset: QuickPreset) => {
    const result = presetResults[preset.duration];
    if (result && result.confidence > 0) {
      onPresetSelect(result.selection, {
        duration: preset.duration,
        confidence: result.confidence
      });
    }
  }, [presetResults, onPresetSelect]);

  // Check if any presets are viable
  const hasViablePresets = useMemo(() => {
    return Object.values(presetResults).some(result => result.confidence > 0.3);
  }, [presetResults]);

  if (!hasViablePresets) {
    return (
      <div className={`ytgif-quick-presets ytgif-quick-presets--empty ${className}`}>
        <div className="ytgif-quick-presets__message">
          <span className="ytgif-quick-presets__icon">⚠️</span>
          <span>Video too short for presets</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`ytgif-quick-presets ${className}`}>
      <div className="ytgif-quick-presets__header">
        <span className="ytgif-quick-presets__title">Quick Capture</span>
        <span className="ytgif-quick-presets__subtitle">One-click presets</span>
      </div>

      <div className="ytgif-quick-presets__buttons">
        {PresetCalculator.PRESETS.map((preset) => {
          const result = presetResults[preset.duration];
          const isRecommended = bestPreset?.duration === preset.duration;
          
          return (
            <PresetButton
              key={preset.duration}
              preset={preset}
              result={result}
              onSelect={() => handlePresetSelect(preset)}
              disabled={disabled || result.confidence <= 0.3}
              isRecommended={isRecommended}
            />
          );
        })}
      </div>

      {bestPreset && (
        <div className="ytgif-quick-presets__recommendation">
          <span className="ytgif-quick-presets__rec-icon">💡</span>
          <span className="ytgif-quick-presets__rec-text">
            {bestPreset.duration}s recommended for this video
          </span>
        </div>
      )}
    </div>
  );
};

// CSS-in-JS styles (to be added to the main CSS file)
const _quickPresetsStyles = `
.ytgif-quick-presets {
  background: rgba(0, 0, 0, 0.85);
  border-radius: 8px;
  padding: 12px;
  margin: 8px 0;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ytgif-quick-presets__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #fff;
}

.ytgif-quick-presets__title {
  font-weight: 600;
  font-size: 14px;
}

.ytgif-quick-presets__subtitle {
  font-size: 12px;
  opacity: 0.7;
}

.ytgif-quick-presets__buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 8px;
}

.ytgif-quick-presets__recommendation {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
}

.ytgif-quick-presets__rec-icon {
  font-size: 12px;
}

.ytgif-quick-presets__message {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: center;
  color: #fbbf24;
  font-size: 12px;
  padding: 8px;
}

.ytgif-quick-presets--empty {
  min-height: 60px;
}

/* Preset Button Styles */
.ytgif-preset-container {
  position: relative;
}

.ytgif-preset-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  border-radius: 6px;
  border: 2px solid transparent;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
  position: relative;
}

.ytgif-preset-btn:hover:not(.ytgif-preset-btn--disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.ytgif-preset-btn--excellent {
  border-color: #22c55e;
  background: rgba(34, 197, 94, 0.2);
}

.ytgif-preset-btn--good {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.2);
}

.ytgif-preset-btn--fair {
  border-color: #f59e0b;
  background: rgba(245, 158, 11, 0.2);
}

.ytgif-preset-btn--poor {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.2);
}

.ytgif-preset-btn--recommended {
  box-shadow: 0 0 0 2px #4ade80;
}

.ytgif-preset-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ytgif-preset-btn__icon {
  font-size: 16px;
  margin-bottom: 2px;
}

.ytgif-preset-btn__label {
  font-weight: 600;
  font-size: 12px;
  margin-bottom: 1px;
}

.ytgif-preset-btn__duration {
  font-size: 10px;
  opacity: 0.8;
}

.ytgif-preset-btn__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: #4ade80;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 8px;
}

/* Tooltip Styles */
.ytgif-preset-tooltip {
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px;
  color: #fff;
  font-size: 11px;
  width: 200px;
  z-index: 1000;
  margin-bottom: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ytgif-preset-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 4px solid transparent;
  border-top-color: rgba(0, 0, 0, 0.95);
}

.ytgif-preset-tooltip__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.ytgif-preset-tooltip__recommended {
  font-size: 9px;
  background: #4ade80;
  color: #000;
  padding: 2px 4px;
  border-radius: 3px;
  font-weight: 600;
}

.ytgif-preset-tooltip__details > div {
  margin-bottom: 3px;
}

.ytgif-preset-tooltip__time {
  color: #60a5fa;
}

.ytgif-preset-tooltip__quality {
  color: #34d399;
}

.ytgif-preset-tooltip__adjustments-title {
  color: #fbbf24;
  font-weight: 600;
  margin-bottom: 2px;
}

.ytgif-preset-tooltip__adjustment {
  color: #d1d5db;
  font-size: 10px;
  margin-left: 8px;
}
`;