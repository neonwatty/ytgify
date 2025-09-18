import React, { useState, useRef, useCallback, useEffect } from 'react';
import { TimelineSelection } from '@/types';

interface TimelineMarkersProps {
  videoDuration: number;
  currentTime: number;
  selection: TimelineSelection;
  onSelectionChange: (selection: TimelineSelection) => void;
  onSeekTo?: (time: number) => void;
  className?: string;
}

interface DragState {
  isDragging: boolean;
  dragType: 'start' | 'end' | null;
  startX: number;
  startTime: number;
}

export const TimelineMarkers: React.FC<TimelineMarkersProps> = ({
  videoDuration,
  currentTime,
  selection,
  onSelectionChange,
  onSeekTo,
  className = ''
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    dragType: null,
    startX: 0,
    startTime: 0
  });

  const [isHoveringTrack, setIsHoveringTrack] = useState(false);

  // Convert time to percentage position
  const timeToPercent = useCallback((time: number): number => {
    return Math.max(0, Math.min(100, (time / videoDuration) * 100));
  }, [videoDuration]);

  // Convert mouse position to time
  const positionToTime = useCallback((clientX: number): number => {
    if (!trackRef.current) return 0;
    
    const rect = trackRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, relativeX / rect.width));
    return percentage * videoDuration;
  }, [videoDuration]);

  // Update selection with constraints
  const updateSelection = useCallback((startTime: number, endTime: number) => {
    // Ensure minimum duration of 0.5s
    const minDuration = 0.5;
    
    // Constrain to video bounds
    const constrainedStart = Math.max(0, Math.min(videoDuration - minDuration, startTime));
    const constrainedEnd = Math.max(constrainedStart + minDuration, Math.min(videoDuration, endTime));
    
    const newSelection: TimelineSelection = {
      startTime: constrainedStart,
      endTime: constrainedEnd,
      duration: constrainedEnd - constrainedStart
    };
    
    onSelectionChange(newSelection);
  }, [videoDuration, onSelectionChange]);

  // Handle mouse down on markers
  const handleMarkerMouseDown = useCallback((
    event: React.MouseEvent,
    markerType: 'start' | 'end'
  ) => {
    event.preventDefault();
    event.stopPropagation();
    
    setDragState({
      isDragging: true,
      dragType: markerType,
      startX: event.clientX,
      startTime: markerType === 'start' ? selection.startTime : selection.endTime
    });
    
    // Add visual feedback
    document.body.style.cursor = 'grabbing';
    document.body.style.userSelect = 'none';
  }, [selection]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!dragState.isDragging || !dragState.dragType) return;
    
    const newTime = positionToTime(event.clientX);
    
    if (dragState.dragType === 'start') {
      updateSelection(newTime, selection.endTime);
    } else {
      updateSelection(selection.startTime, newTime);
    }
    
    // Seek video to preview position
    if (onSeekTo) {
      onSeekTo(newTime);
    }
  }, [dragState, positionToTime, updateSelection, selection, onSeekTo]);

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    if (dragState.isDragging) {
      setDragState({
        isDragging: false,
        dragType: null,
        startX: 0,
        startTime: 0
      });
      
      // Reset cursor and selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [dragState.isDragging]);

  // Handle track click to move nearest marker
  const handleTrackClick = useCallback((event: React.MouseEvent) => {
    if (dragState.isDragging) return;
    
    const clickTime = positionToTime(event.clientX);
    const distanceToStart = Math.abs(clickTime - selection.startTime);
    const distanceToEnd = Math.abs(clickTime - selection.endTime);
    
    // Move the nearest marker
    if (distanceToStart < distanceToEnd) {
      updateSelection(clickTime, selection.endTime);
    } else {
      updateSelection(selection.startTime, clickTime);
    }
    
    // Seek to clicked position
    if (onSeekTo) {
      onSeekTo(clickTime);
    }
  }, [dragState.isDragging, positionToTime, selection, updateSelection, onSeekTo]);

  // Touch event handlers for mobile support
  const handleTouchStart = useCallback((event: React.TouchEvent, markerType: 'start' | 'end') => {
    event.preventDefault();
    const touch = event.touches[0];
    
    setDragState({
      isDragging: true,
      dragType: markerType,
      startX: touch.clientX,
      startTime: markerType === 'start' ? selection.startTime : selection.endTime
    });
  }, [selection]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!dragState.isDragging || !dragState.dragType) return;
    
    event.preventDefault();
    const touch = event.touches[0];
    const newTime = positionToTime(touch.clientX);
    
    if (dragState.dragType === 'start') {
      updateSelection(newTime, selection.endTime);
    } else {
      updateSelection(selection.startTime, newTime);
    }
    
    if (onSeekTo) {
      onSeekTo(newTime);
    }
  }, [dragState, positionToTime, updateSelection, selection, onSeekTo]);

  // Set up event listeners
  useEffect(() => {
    if (dragState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleMouseUp);
      };
    }
  }, [dragState.isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

  // Calculate positions
  const startPercent = timeToPercent(selection.startTime);
  const endPercent = timeToPercent(selection.endTime);
  const currentPercent = timeToPercent(currentTime);
  const selectionWidth = endPercent - startPercent;

  return (
    <div className={`ytgif-timeline-track ${className}`} ref={trackRef}>
      {/* Background progress bar */}
      <div className="ytgif-timeline-background" />
      
      {/* Current video progress */}
      <div
        className="ytgif-timeline-progress"
        style={{ width: `${currentPercent}%` }}
      />
      
      {/* Selection area */}
      <div
        className="ytgif-timeline-selection"
        style={{
          left: `${startPercent}%`,
          width: `${selectionWidth}%`
        }}
        onClick={handleTrackClick}
        onMouseEnter={() => setIsHoveringTrack(true)}
        onMouseLeave={() => setIsHoveringTrack(false)}
      />
      
      {/* Start marker */}
      <div
        className={`ytgif-timeline-handle ytgif-timeline-start ${
          dragState.dragType === 'start' ? 'dragging' : ''
        }`}
        style={{ left: `${startPercent}%` }}
        onMouseDown={(e) => handleMarkerMouseDown(e, 'start')}
        onTouchStart={(e) => handleTouchStart(e, 'start')}
        role="slider"
        tabIndex={0}
        aria-label={`Start time: ${selection.startTime.toFixed(1)} seconds`}
        aria-valuemin={0}
        aria-valuemax={videoDuration}
        aria-valuenow={selection.startTime}
        aria-orientation="horizontal"
      >
        <div className="ytgif-timeline-handle-grip" />
        <div className="ytgif-timeline-handle-tooltip">
          {formatTimeTooltip(selection.startTime)}
        </div>
      </div>
      
      {/* End marker */}
      <div
        className={`ytgif-timeline-handle ytgif-timeline-end ${
          dragState.dragType === 'end' ? 'dragging' : ''
        }`}
        style={{ left: `${endPercent}%` }}
        onMouseDown={(e) => handleMarkerMouseDown(e, 'end')}
        onTouchStart={(e) => handleTouchStart(e, 'end')}
        role="slider"
        tabIndex={0}
        aria-label={`End time: ${selection.endTime.toFixed(1)} seconds`}
        aria-valuemin={0}
        aria-valuemax={videoDuration}
        aria-valuenow={selection.endTime}
        aria-orientation="horizontal"
      >
        <div className="ytgif-timeline-handle-grip" />
        <div className="ytgif-timeline-handle-tooltip">
          {formatTimeTooltip(selection.endTime)}
        </div>
      </div>
      
      {/* Track interaction area */}
      <div
        className={`ytgif-timeline-interaction ${isHoveringTrack ? 'hovering' : ''}`}
        onClick={handleTrackClick}
        onMouseEnter={() => setIsHoveringTrack(true)}
        onMouseLeave={() => setIsHoveringTrack(false)}
      />
    </div>
  );
};

// Helper function to format time for tooltips
function formatTimeTooltip(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(1);
  
  if (mins > 0) {
    return `${mins}:${secs.padStart(4, '0')}`;
  }
  
  return `${secs}s`;
}