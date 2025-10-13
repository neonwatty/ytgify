import React, { useRef, useState, useCallback, useEffect } from 'react';

interface TimelineScrubberProps {
  duration: number;
  startTime: number;
  endTime: number;
  currentTime?: number;
  previewTime?: number;
  onRangeChange: (start: number, end: number) => void;
  onSeek?: (time: number) => void;
  minDuration?: number;
  maxDuration?: number;
}

const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  duration,
  startTime,
  endTime,
  previewTime,
  onRangeChange,
  onSeek,
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [durationSliderValue, setDurationSliderValue] = useState(endTime - startTime);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const dragStartRef = useRef<{ x: number; startTime: number }>({
    x: 0,
    startTime: 0,
  });

  // Format time for display (seconds to MM:SS)
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Parse time input (accepts MM:SS or decimal seconds)
  const parseTimeInput = (value: string): number | null => {
    const trimmed = value.trim();
    if (!trimmed) return null;

    // Try MM:SS format first
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':');
      if (parts.length === 2) {
        const mins = parseInt(parts[0], 10);
        const secs = parseFloat(parts[1]);
        if (!isNaN(mins) && !isNaN(secs) && secs < 60) {
          // Allow negative for validation to handle
          return mins * 60 + secs;
        }
      }
      return null;
    }

    // Try decimal seconds
    const seconds = parseFloat(trimmed);
    if (!isNaN(seconds)) {
      return seconds;
    }

    return null;
  };

  // Validate start time
  const validateStartTime = (time: number): string | null => {
    if (time < 0) {
      return 'Start time cannot be negative';
    }
    const clipDuration = endTime - startTime;
    const maxStartTime = duration - clipDuration;
    if (time > maxStartTime) {
      return `Must be between 0:00 and ${formatTime(maxStartTime)}`;
    }
    return null;
  };

  // Update input value when startTime changes (scrubber dragged)
  useEffect(() => {
    if (!isInputFocused) {
      setInputValue(formatTime(startTime));
    }
  }, [startTime, isInputFocused]);

  // Update slider value when handles are dragged
  useEffect(() => {
    setDurationSliderValue(endTime - startTime);
  }, [startTime, endTime]);

  // Handle slider change
  const handleDurationSliderChange = (value: number) => {
    const newValue = parseFloat(value.toFixed(1));
    const maxEnd = Math.min(startTime + newValue, duration);
    onRangeChange(startTime, maxEnd);
    // Set slider value to actual applied duration, not requested duration
    setDurationSliderValue(maxEnd - startTime);
  };

  // Calculate slider constraints
  const maxSliderValue = Math.min(20, duration - startTime);

  // Convert pixel position to time
  const positionToTime = useCallback(
    (x: number): number => {
      if (!timelineRef.current) return 0;
      const rect = timelineRef.current.getBoundingClientRect();
      const relativeX = Math.max(0, Math.min(x - rect.left, rect.width));
      return (relativeX / rect.width) * duration;
    },
    [duration]
  );

  // Handle mouse down on handle
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        startTime,
      };
    },
    [startTime]
  );

  // Handle timeline click (move handle to position)
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent) => {
      if (isDragging) return;

      const clickTime = positionToTime(e.clientX);
      const currentDuration = endTime - startTime;

      // Calculate new start and end based on click position
      let newStart = clickTime;
      let newEnd = Math.min(clickTime + currentDuration, duration);

      // If we hit the end of the video, adjust both start and end
      if (newEnd >= duration) {
        newEnd = duration;
        newStart = Math.max(0, duration - currentDuration);
      }

      onRangeChange(newStart, newEnd);

      // Also seek to this position if callback provided
      if (onSeek) {
        onSeek(clickTime);
      }
    },
    [isDragging, positionToTime, startTime, endTime, duration, onRangeChange, onSeek]
  );

  // Handle mouse enter on timeline
  const handleTimelineMouseEnter = useCallback(() => {
    setShowTooltip(true);
  }, []);

  // Handle mouse leave on timeline
  const handleTimelineMouseLeave = useCallback(() => {
    setShowTooltip(false);
    setHoverTime(null);
  }, []);

  // Handle mouse move on timeline (local to timeline element)
  const handleTimelineMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging && timelineRef.current) {
        const hoverTimeValue = positionToTime(e.clientX);
        setHoverTime(hoverTimeValue);
      }
    },
    [isDragging, positionToTime]
  );

  // Handle mouse move during drag (global document listener)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - dragStartRef.current.x;
      const deltaTime = (deltaX / timelineRef.current!.offsetWidth) * duration;

      const currentDuration = endTime - startTime;
      let newStart = Math.max(
        0,
        Math.min(dragStartRef.current.startTime + deltaTime, duration - currentDuration)
      );
      let newEnd = Math.min(newStart + currentDuration, duration);

      // If we hit the end of the video, clamp both values
      if (newEnd >= duration) {
        newEnd = duration;
        newStart = Math.max(0, duration - currentDuration);
      }

      onRangeChange(newStart, newEnd);
    },
    [isDragging, duration, startTime, endTime, onRangeChange]
  );

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setInputError(null); // Clear error on typing
  };

  // Handle input blur (apply time)
  const handleInputBlur = () => {
    setIsInputFocused(false);
    const parsedTime = parseTimeInput(inputValue);

    if (parsedTime === null) {
      setInputError('Invalid format. Use MM:SS or seconds');
      setInputValue(formatTime(startTime)); // Revert to current value
      return;
    }

    const validationError = validateStartTime(parsedTime);
    if (validationError) {
      setInputError(validationError);
      setInputValue(formatTime(startTime)); // Revert to current value
      return;
    }

    // Apply the new start time
    const clipDuration = endTime - startTime;
    const newEnd = Math.min(parsedTime + clipDuration, duration);
    onRangeChange(parsedTime, newEnd);
    setInputError(null);
  };

  // Handle input key down
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur(); // Trigger blur handler
    } else if (e.key === 'Escape') {
      setInputValue(formatTime(startTime)); // Revert
      setInputError(null);
      e.currentTarget.blur();
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    setIsInputFocused(true);
  };

  // Add/remove event listeners for dragging only
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate positions as percentages
  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  const widthPercent = endPercent - startPercent;
  const previewPercent = previewTime ? (previewTime / duration) * 100 : null;

  return (
    <div className="ytgif-timeline-scrubber">
      {/* Timeline Selection Container */}
      <div className="ytgif-timeline-container">
        <div className="ytgif-timeline-header">
          <span className="ytgif-timeline-label">Timeline Selection</span>
        </div>

        <div
          ref={timelineRef}
          className="ytgif-timeline-track"
          onClick={handleTimelineClick}
          onMouseEnter={handleTimelineMouseEnter}
          onMouseLeave={handleTimelineMouseLeave}
          onMouseMove={handleTimelineMouseMove}
        >
          {/* Background track */}
          <div className="ytgif-timeline-background" />

          {/* Selection range - visual only, not draggable */}
          <div
            className="ytgif-timeline-selection"
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`,
            }}
          />

          {/* Single handle at start position */}
          <div
            className="ytgif-timeline-handle"
            style={{ left: `${startPercent}%` }}
            onMouseDown={handleMouseDown}
            title={formatTime(startTime)}
          />

          {/* Preview playhead (when playing preview) */}
          {previewPercent !== null && (
            <div className="ytgif-timeline-preview-head" style={{ left: `${previewPercent}%` }} />
          )}

          {/* Hover tooltip */}
          {showTooltip && hoverTime !== null && (
            <div
              className="ytgif-timeline-tooltip"
              style={{ left: `${(hoverTime / duration) * 100}%` }}
            >
              {formatTime(hoverTime)}
            </div>
          )}
        </div>

        {/* Time labels */}
        <div className="ytgif-timeline-labels">
          <span className="ytgif-label-start">{formatTime(0)}</span>
          <span className="ytgif-label-selection">
            {formatTime(startTime)} - {formatTime(endTime)}
          </span>
          <span className="ytgif-label-end">{formatTime(duration)}</span>
        </div>

        {/* Timeline Controls - Start Time Input and Duration Display */}
        <div className="ytgif-timeline-controls">
          <div className="ytgif-timeline-control-left">
            <label htmlFor="ytgif-start-time-input" className="ytgif-control-label">
              Start
            </label>
            <input
              id="ytgif-start-time-input"
              type="text"
              className={`ytgif-time-input-field ${inputError ? 'error' : ''}`}
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onFocus={handleInputFocus}
              onKeyDown={handleInputKeyDown}
              placeholder="0:00"
              aria-label="Start time"
              aria-invalid={inputError !== null}
              aria-describedby={inputError ? 'ytgif-time-input-error' : undefined}
            />
            {inputError && (
              <div id="ytgif-time-input-error" className="ytgif-time-input-error-message">
                {inputError}
              </div>
            )}
          </div>
          <div className="ytgif-timeline-control-right">
            <span className="ytgif-control-label">Duration</span>
            <span className="ytgif-control-value">{durationSliderValue.toFixed(1)}s</span>
          </div>
        </div>
      </div>

      {/* Duration slider */}
      <div className="ytgif-duration-slider">
        <div className="ytgif-slider-header">
          <span className="ytgif-slider-label">Clip Duration</span>
          <span className="ytgif-slider-value">{durationSliderValue.toFixed(1)}s</span>
        </div>
        <div className="ytgif-slider-container">
          <input
            type="range"
            className="ytgif-slider-input"
            min="1"
            max={maxSliderValue}
            step="0.1"
            value={durationSliderValue}
            onChange={(e) => handleDurationSliderChange(parseFloat(e.target.value))}
            aria-label="GIF duration"
            aria-valuemin={1}
            aria-valuemax={maxSliderValue}
            aria-valuenow={durationSliderValue}
            disabled={duration < 1}
          />
          {/* Hash marks */}
          <div className="ytgif-slider-marks">
            {[1, 5, 10, 15, 20].map((mark) => {
              // Only show marks that are within the slider range
              if (mark > maxSliderValue) return null;

              // Calculate position as percentage
              // The slider goes from min (1) to max (maxSliderValue)
              const sliderMin = 1;
              const sliderRange = maxSliderValue - sliderMin;
              const markOffset = mark - sliderMin;
              let position = (markOffset / sliderRange) * 100;

              // Apply specific adjustments based on observed offsets
              // 5s mark needs to move right by about 1%
              // 15s mark needs to move left by about 0.5%
              if (mark === 5) {
                position += 1.0; // Move 5s mark right
              } else if (mark === 15) {
                position -= 0.5; // Move 15s mark left
              }

              return (
                <div key={mark} className="ytgif-slider-mark" style={{ left: `${position}%` }}>
                  <div className="ytgif-slider-mark-line" />
                  <div className="ytgif-slider-mark-label">{mark}s</div>
                </div>
              );
            })}
          </div>
        </div>
        {duration < 1 && (
          <div className="ytgif-slider-disabled-message">Video too short for GIF creation</div>
        )}
      </div>
    </div>
  );
};

export default TimelineScrubber;
