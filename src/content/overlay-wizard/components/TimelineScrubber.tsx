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

export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
  duration,
  startTime,
  endTime,
  currentTime = 0,
  previewTime,
  onRangeChange,
  onSeek,
  minDuration = 0.5,
  maxDuration = 30
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [durationSliderValue, setDurationSliderValue] = useState(endTime - startTime);
  
  const dragStartRef = useRef<{ x: number; startTime: number }>({
    x: 0,
    startTime: 0
  });

  // Update slider value when handles are dragged
  useEffect(() => {
    setDurationSliderValue(endTime - startTime);
  }, [startTime, endTime]);

  // Handle slider change
  const handleDurationSliderChange = (value: number) => {
    const newValue = parseFloat(value.toFixed(1));
    const maxEnd = Math.min(startTime + newValue, duration);
    onRangeChange(startTime, maxEnd);
    setDurationSliderValue(newValue);
  };

  // Calculate slider constraints
  const maxSliderValue = Math.min(20, duration - startTime);

  // Convert time to pixel position
  const timeToPosition = useCallback((time: number): number => {
    if (!timelineRef.current) return 0;
    const width = timelineRef.current.offsetWidth;
    return (time / duration) * width;
  }, [duration]);

  // Convert pixel position to time
  const positionToTime = useCallback((x: number): number => {
    if (!timelineRef.current) return 0;
    const rect = timelineRef.current.getBoundingClientRect();
    const relativeX = Math.max(0, Math.min(x - rect.left, rect.width));
    return (relativeX / rect.width) * duration;
  }, [duration]);

  // Handle mouse down on handle
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      startTime
    };
  }, [startTime]);

  // Handle timeline click (move handle to position)
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
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
  }, [isDragging, positionToTime, startTime, endTime, duration, onRangeChange, onSeek]);

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
  const handleTimelineMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging && timelineRef.current) {
      const hoverTimeValue = positionToTime(e.clientX);
      setHoverTime(hoverTimeValue);
    }
  }, [isDragging, positionToTime]);

  // Handle mouse move during drag (global document listener)
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaTime = (deltaX / timelineRef.current!.offsetWidth) * duration;

    const currentDuration = endTime - startTime;
    let newStart = Math.max(0, Math.min(dragStartRef.current.startTime + deltaTime, duration - currentDuration));
    let newEnd = Math.min(newStart + currentDuration, duration);

    // If we hit the end of the video, clamp both values
    if (newEnd >= duration) {
      newEnd = duration;
      newStart = Math.max(0, duration - currentDuration);
    }

    onRangeChange(newStart, newEnd);
  }, [isDragging, duration, startTime, endTime, onRangeChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

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

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate positions as percentages
  const startPercent = (startTime / duration) * 100;
  const endPercent = (endTime / duration) * 100;
  const widthPercent = endPercent - startPercent;
  const currentPercent = (currentTime / duration) * 100;
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
              width: `${widthPercent}%`
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
            <div
              className="ytgif-timeline-preview-head"
              style={{ left: `${previewPercent}%` }}
            />
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
                <div
                  key={mark}
                  className="ytgif-slider-mark"
                  style={{ left: `${position}%` }}
                >
                  <div className="ytgif-slider-mark-line" />
                  <div className="ytgif-slider-mark-label">{mark}s</div>
                </div>
              );
            })}
          </div>
        </div>
        {duration < 1 && (
          <div className="ytgif-slider-disabled-message">
            Video too short for GIF creation
          </div>
        )}
      </div>
    </div>
  );
};

export default TimelineScrubber;