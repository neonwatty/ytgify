import React, { useState, useRef } from 'react';
import { TimelineSelection } from '@/types';

interface CustomRangeScreenProps {
  videoDuration: number;
  currentTime: number;
  onConfirm: (startTime: number, endTime: number) => void;
  onBack: () => void;
  onSeekTo?: (time: number) => void;
}

const CustomRangeScreen: React.FC<CustomRangeScreenProps> = ({
  videoDuration,
  currentTime,
  onConfirm,
  onBack,
  onSeekTo
}) => {
  const [selection, setSelection] = useState<TimelineSelection>({
    startTime: Math.max(0, currentTime - 2),
    endTime: Math.min(videoDuration, currentTime + 2),
    duration: 4
  });
  
  const [isDragging, setIsDragging] = useState<'start' | 'end' | 'range' | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current || isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = percent * videoDuration;
    
    // Create a 4-second selection centered on click point
    const halfDuration = 2;
    const newStart = Math.max(0, time - halfDuration);
    const newEnd = Math.min(videoDuration, time + halfDuration);
    
    setSelection({
      startTime: newStart,
      endTime: newEnd,
      duration: newEnd - newStart
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!timelineRef.current || !isDragging) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percent = x / rect.width;
    const time = percent * videoDuration;
    
    if (isDragging === 'start') {
      const newStart = Math.min(time, selection.endTime - 0.5);
      setSelection({
        startTime: Math.max(0, newStart),
        endTime: selection.endTime,
        duration: selection.endTime - Math.max(0, newStart)
      });
    } else if (isDragging === 'end') {
      const newEnd = Math.max(time, selection.startTime + 0.5);
      setSelection({
        startTime: selection.startTime,
        endTime: Math.min(videoDuration, newEnd),
        duration: Math.min(videoDuration, newEnd) - selection.startTime
      });
    } else if (isDragging === 'range') {
      const duration = selection.duration;
      const newStart = Math.max(0, Math.min(time - duration / 2, videoDuration - duration));
      setSelection({
        startTime: newStart,
        endTime: newStart + duration,
        duration: duration
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, selection]);

  const startPercent = (selection.startTime / videoDuration) * 100;
  const widthPercent = (selection.duration / videoDuration) * 100;

  return (
    <div className="ytgif-wizard-screen ytgif-custom-range-screen">
      <div className="ytgif-wizard-header">
        <button onClick={onBack} className="ytgif-back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="ytgif-wizard-title">Select Range</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Timeline */}
        <div className="ytgif-timeline-container">
          <div 
            ref={timelineRef}
            className="ytgif-timeline-track ytgif-timeline-interactive"
            onClick={handleTimelineClick}
          >
            {/* Selection Range */}
            <div 
              className="ytgif-timeline-selection"
              style={{
                left: `${startPercent}%`,
                width: `${widthPercent}%`
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                setIsDragging('range');
              }}
            >
              <div 
                className="ytgif-selection-handle ytgif-handle-start"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDragging('start');
                }}
              />
              <div 
                className="ytgif-selection-handle ytgif-handle-end"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDragging('end');
                }}
              />
            </div>
            
            {/* Current Time Cursor */}
            <div 
              className="ytgif-timeline-cursor"
              style={{ left: `${(currentTime / videoDuration) * 100}%` }}
            />
          </div>
          
          {/* Time Labels */}
          <div className="ytgif-timeline-labels">
            <span>0:00</span>
            <span>{formatTime(videoDuration)}</span>
          </div>
        </div>

        {/* Time Inputs */}
        <div className="ytgif-time-inputs">
          <div className="ytgif-time-input-group">
            <label>Start Time</label>
            <input 
              type="text" 
              value={formatTime(selection.startTime)}
              onChange={(e) => {
                const parts = e.target.value.split(':');
                if (parts.length === 2) {
                  const mins = parseInt(parts[0]) || 0;
                  const secs = parseInt(parts[1]) || 0;
                  const newStart = Math.min(mins * 60 + secs, selection.endTime - 0.5);
                  setSelection({
                    startTime: Math.max(0, newStart),
                    endTime: selection.endTime,
                    duration: selection.endTime - Math.max(0, newStart)
                  });
                }
              }}
              className="ytgif-time-input"
            />
          </div>
          
          <div className="ytgif-duration-display">
            <span className="ytgif-duration-value">{selection.duration.toFixed(1)}s</span>
            <span className="ytgif-duration-label">Duration</span>
          </div>
          
          <div className="ytgif-time-input-group">
            <label>End Time</label>
            <input 
              type="text" 
              value={formatTime(selection.endTime)}
              onChange={(e) => {
                const parts = e.target.value.split(':');
                if (parts.length === 2) {
                  const mins = parseInt(parts[0]) || 0;
                  const secs = parseInt(parts[1]) || 0;
                  const newEnd = Math.max(mins * 60 + secs, selection.startTime + 0.5);
                  setSelection({
                    startTime: selection.startTime,
                    endTime: Math.min(videoDuration, newEnd),
                    duration: Math.min(videoDuration, newEnd) - selection.startTime
                  });
                }
              }}
              className="ytgif-time-input"
            />
          </div>
        </div>

        {/* Quick Presets */}
        <div className="ytgif-presets">
          <button 
            className="ytgif-preset-button"
            onClick={() => {
              const start = Math.max(0, currentTime - 2);
              const end = Math.min(videoDuration, currentTime + 2);
              setSelection({ startTime: start, endTime: end, duration: end - start });
            }}
          >
            4s at current
          </button>
          <button 
            className="ytgif-preset-button"
            onClick={() => {
              const start = Math.max(0, currentTime - 5);
              const end = Math.min(videoDuration, currentTime + 5);
              setSelection({ startTime: start, endTime: end, duration: end - start });
            }}
          >
            10s at current
          </button>
          <button 
            className="ytgif-preset-button"
            onClick={() => {
              setSelection({ startTime: 0, endTime: Math.min(10, videoDuration), duration: Math.min(10, videoDuration) });
            }}
          >
            First 10s
          </button>
        </div>

        {/* Action Buttons */}
        <div className="ytgif-wizard-actions">
          <button className="ytgif-button-secondary" onClick={onBack}>
            Back
          </button>
          <button 
            className="ytgif-button-primary" 
            onClick={() => onConfirm(selection.startTime, selection.endTime)}
            disabled={selection.duration < 0.5}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Create GIF ({selection.duration.toFixed(1)}s)
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomRangeScreen;