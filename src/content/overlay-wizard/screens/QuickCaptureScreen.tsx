import React, { useState, useCallback } from 'react';
import VideoPreview from '../components/VideoPreview';
import TimelineScrubber from '../components/TimelineScrubber';

interface QuickCaptureScreenProps {
  startTime: number;
  endTime: number;
  currentTime: number;
  duration: number;
  videoElement?: HTMLVideoElement;
  onConfirm: () => void;
  onBack: () => void;
  onSeekTo?: (time: number) => void;
}

const QuickCaptureScreen: React.FC<QuickCaptureScreenProps> = ({
  startTime: initialStartTime,
  endTime: initialEndTime,
  currentTime,
  duration,
  videoElement,
  onConfirm,
  onBack,
  onSeekTo
}) => {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(startTime);
  
  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    setPreviewTime(newStart);
    setIsPreviewPlaying(false);
  }, []);
  
  const handleSeek = useCallback((time: number) => {
    setPreviewTime(time);
    if (onSeekTo) {
      onSeekTo(time);
    }
  }, [onSeekTo]);
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const gifDuration = endTime - startTime;

  return (
    <div className="ytgif-wizard-screen ytgif-quick-capture-screen">
      <div className="ytgif-wizard-header">
        <button onClick={onBack} className="ytgif-back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="ytgif-wizard-title">Quick Capture Preview</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Video Preview */}
        {videoElement && (
          <VideoPreview
            videoElement={videoElement}
            startTime={startTime}
            endTime={endTime}
            currentVideoTime={currentTime}
            isPlaying={isPreviewPlaying}
            onPlayStateChange={setIsPreviewPlaying}
          />
        )}
        
        {/* Enhanced Timeline Scrubber */}
        <TimelineScrubber
          duration={duration}
          startTime={startTime}
          endTime={endTime}
          currentTime={currentTime}
          previewTime={isPreviewPlaying ? previewTime : undefined}
          onRangeChange={handleRangeChange}
          onSeek={handleSeek}
        />

        {/* GIF Info */}
        <div className="ytgif-capture-info">
          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="ytgif-info-label">Duration:</span>
            <span className="ytgif-info-value">{gifDuration.toFixed(1)}s</span>
          </div>
          
          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4" />
            </svg>
            <span className="ytgif-info-label">Frames:</span>
            <span className="ytgif-info-value">~{Math.round(gifDuration * 10)}</span>
          </div>

          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="ytgif-info-label">Est. Size:</span>
            <span className="ytgif-info-value">~{(gifDuration * 0.5).toFixed(1)}MB</span>
          </div>
        </div>

        {/* If no video element, show fallback preview info */}
        {!videoElement && (
          <div className="ytgif-preview-fallback">
            <div className="ytgif-fallback-message">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Video preview will appear here</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="ytgif-wizard-actions">
          <button className="ytgif-button-secondary" onClick={onBack}>
            Back
          </button>
          <button className="ytgif-button-primary" onClick={() => {
            // Pass the updated time range when confirming
            onConfirm();
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Create GIF
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickCaptureScreen;