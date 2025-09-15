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
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [durationSliderValue, setDurationSliderValue] = useState(endTime - startTime);
  
  const dragStartRef = useRef<{ x: number; startTime: number; endTime: number }>({
    x: 0,
    startTime: 0,
    endTime: 0
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

  // Handle mouse down on timeline elements
  const handleMouseDown = useCallback((e: React.MouseEvent, type: 'start' | 'end' | 'range') => {
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(type);
    dragStartRef.current = {
      x: e.clientX,
      startTime,
      endTime
    };
  }, [startTime, endTime]);

  // Handle timeline click (set selection center)
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (isDragging) return;
    
    const clickTime = positionToTime(e.clientX);
    const currentDuration = endTime - startTime;
    const halfDuration = currentDuration / 2;
    
    let newStart = clickTime - halfDuration;
    let newEnd = clickTime + halfDuration;
    
    // Clamp to timeline bounds
    if (newStart < 0) {
      newStart = 0;
      newEnd = Math.min(currentDuration, duration);
    } else if (newEnd > duration) {
      newEnd = duration;
      newStart = Math.max(0, duration - currentDuration);
    }
    
    onRangeChange(newStart, newEnd);
    
    // Also seek to this position if callback provided
    if (onSeek) {
      onSeek(clickTime);
    }
  }, [isDragging, positionToTime, startTime, endTime, duration, onRangeChange, onSeek]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) {
      // Update hover position
      if (timelineRef.current) {
        const rect = timelineRef.current.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right) {
          setHoverTime(positionToTime(e.clientX));
          setShowTooltip(true);
        } else {
          setShowTooltip(false);
        }
      }
      return;
    }
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaTime = (deltaX / timelineRef.current!.offsetWidth) * duration;
    
    let newStart = dragStartRef.current.startTime;
    let newEnd = dragStartRef.current.endTime;
    
    if (isDragging === 'start') {
      newStart = Math.max(0, Math.min(dragStartRef.current.startTime + deltaTime, newEnd - minDuration));
    } else if (isDragging === 'end') {
      newEnd = Math.min(duration, Math.max(dragStartRef.current.endTime + deltaTime, newStart + minDuration));
    } else if (isDragging === 'range') {
      const rangeDuration = dragStartRef.current.endTime - dragStartRef.current.startTime;
      newStart = Math.max(0, Math.min(dragStartRef.current.startTime + deltaTime, duration - rangeDuration));
      newEnd = newStart + rangeDuration;
    }
    
    // Enforce max duration
    if (newEnd - newStart > maxDuration) {
      if (isDragging === 'start') {
        newStart = newEnd - maxDuration;
      } else if (isDragging === 'end') {
        newEnd = newStart + maxDuration;
      }
    }
    
    onRangeChange(newStart, newEnd);
  }, [isDragging, positionToTime, duration, minDuration, maxDuration, onRangeChange]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(null);
  }, []);

  // Add/remove event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    } else {
      // Add hover listener even when not dragging
      document.addEventListener('mousemove', handleMouseMove);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
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
        >
          {/* Background track */}
          <div className="ytgif-timeline-background" />

          {/* Selection range */}
          <div
            className="ytgif-timeline-selection"
            style={{
              left: `${startPercent}%`,
              width: `${widthPercent}%`
            }}
            onMouseDown={(e) => handleMouseDown(e, 'range')}
          >
            {/* Start handle */}
            <div
              className="ytgif-timeline-handle ytgif-handle-start"
              onMouseDown={(e) => handleMouseDown(e, 'start')}
              title={formatTime(startTime)}
            >
              <div className="ytgif-handle-grip" />
            </div>

            {/* End handle */}
            <div
              className="ytgif-timeline-handle ytgif-handle-end"
              onMouseDown={(e) => handleMouseDown(e, 'end')}
              title={formatTime(endTime)}
            >
              <div className="ytgif-handle-grip" />
            </div>

            {/* Duration label */}
            <div className="ytgif-selection-duration">
              {(endTime - startTime).toFixed(1)}s
            </div>
          </div>

          {/* Current video time indicator */}
          <div
            className={`ytgif-timeline-current ${
              currentTime >= startTime && currentTime <= endTime
                ? 'ytgif-timeline-current-in-range'
                : 'ytgif-timeline-current-out-range'
            }`}
            style={{ left: `${currentPercent}%` }}
            title={`Current video time: ${formatTime(currentTime)}`}
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