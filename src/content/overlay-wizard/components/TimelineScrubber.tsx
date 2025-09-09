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
  const [activePreset, setActivePreset] = useState<'3s' | '5s' | '10s' | null>(null);
  
  const dragStartRef = useRef<{ x: number; startTime: number; endTime: number }>({
    x: 0,
    startTime: 0,
    endTime: 0
  });

  // Check if current selection matches a preset
  const detectActivePreset = useCallback(() => {
    const duration = endTime - startTime;
    const tolerance = 0.1; // 100ms tolerance
    
    // Check for 3s preset
    if (Math.abs(duration - 3) < tolerance) {
      return '3s';
    }
    // Check for 5s preset
    if (Math.abs(duration - 5) < tolerance) {
      return '5s';
    }
    // Check for 10s preset
    if (Math.abs(duration - 10) < tolerance) {
      return '10s';
    }
    
    return null;
  }, [startTime, endTime, currentTime]);

  // Update active preset when selection changes
  useEffect(() => {
    const preset = detectActivePreset();
    setActivePreset(preset);
  }, [detectActivePreset]);

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
      
      {/* Quick duration presets */}
      <div className="ytgif-duration-presets">
        <button 
          className={`ytgif-preset-btn ${activePreset === '3s' ? 'ytgif-preset-btn--active' : ''}`}
          onClick={() => {
            const newEnd = Math.min(duration, startTime + 3);
            onRangeChange(startTime, newEnd);
            setActivePreset('3s');
          }}
        >
          3s
        </button>
        <button 
          className={`ytgif-preset-btn ${activePreset === '5s' ? 'ytgif-preset-btn--active' : ''}`}
          onClick={() => {
            const newEnd = Math.min(duration, startTime + 5);
            onRangeChange(startTime, newEnd);
            setActivePreset('5s');
          }}
        >
          5s
        </button>
        <button 
          className={`ytgif-preset-btn ${activePreset === '10s' ? 'ytgif-preset-btn--active' : ''}`}
          onClick={() => {
            const newEnd = Math.min(duration, startTime + 10);
            onRangeChange(startTime, newEnd);
            setActivePreset('10s');
          }}
        >
          10s
        </button>
      </div>
    </div>
  );
};

export default TimelineScrubber;