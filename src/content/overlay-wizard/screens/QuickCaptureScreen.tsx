import React, { useState, useCallback } from 'react';
import VideoPreview from '../components/VideoPreview';
import TimelineScrubber from '../components/TimelineScrubber';

interface QuickCaptureScreenProps {
  startTime: number;
  endTime: number;
  currentTime: number;
  duration: number;
  videoElement?: HTMLVideoElement;
  frameRate?: number;
  resolution?: string;
  onConfirm: (startTime: number, endTime: number, frameRate?: number, resolution?: string) => void;
  onBack: () => void;
  onSeekTo?: (time: number) => void;
}

const QuickCaptureScreen: React.FC<QuickCaptureScreenProps> = ({
  startTime: initialStartTime,
  endTime: initialEndTime,
  currentTime,
  duration,
  videoElement,
  frameRate: initialFrameRate,
  resolution: initialResolution,
  onConfirm,
  onBack,
  onSeekTo,
}) => {
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Debug state changes
  React.useEffect(() => {
    console.log('[QuickCaptureScreen] Preview playing state changed:', isPreviewPlaying);
  }, [isPreviewPlaying]);
  const [previewTime, setPreviewTime] = useState(startTime);
  const [selectedFrameRate, setSelectedFrameRate] = useState(initialFrameRate || 5); // Default to 5 fps
  const [selectedResolution, setSelectedResolution] = useState(initialResolution || '144p'); // Default to 144p for smallest file size

  const handleRangeChange = useCallback((newStart: number, newEnd: number) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    setPreviewTime(newStart);
    setIsPreviewPlaying(false);
  }, []);

  const handleSeek = useCallback(
    (time: number) => {
      setPreviewTime(time);
      if (onSeekTo) {
        onSeekTo(time);
      }
    },
    [onSeekTo]
  );

  const gifDuration = endTime - startTime;

  return (
    <div className="ytgif-wizard-screen ytgif-quick-capture-screen">
      <div className="ytgif-wizard-header">
        <button onClick={onBack} className="ytgif-back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <h2 className="ytgif-wizard-title">Select Your Perfect Moment</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Helper text */}
        <p className="ytgif-wizard-helper">Drag the timeline to choose your clip</p>
        {/* Video Preview */}
        {videoElement ? (
          <VideoPreview
            videoElement={videoElement}
            startTime={startTime}
            endTime={endTime}
            currentVideoTime={currentTime}
            isPlaying={isPreviewPlaying}
            onPlayStateChange={(playing) => {
              console.log('[QuickCaptureScreen] onPlayStateChange called with:', playing);
              setIsPreviewPlaying(playing);
            }}
          />
        ) : (
          <div className="ytgif-preview-fallback">
            <p>Loading video element...</p>
          </div>
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

        {/* Resolution Options */}
        <div className="ytgif-resolution-section">
          <div className="ytgif-resolution-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Resolution</span>
          </div>
          <div className="ytgif-resolution-options">
            <button
              className={`ytgif-resolution-btn ${selectedResolution === '144p' ? 'ytgif-resolution-btn--active' : ''}`}
              onClick={() => setSelectedResolution('144p')}
            >
              144p Nano
              <span className="ytgif-resolution-desc">Perfect for chat</span>
            </button>
            <button
              className={`ytgif-resolution-btn ${selectedResolution === '240p' ? 'ytgif-resolution-btn--active' : ''}`}
              onClick={() => setSelectedResolution('240p')}
            >
              240p Mini
              <span className="ytgif-resolution-desc">Quick to share</span>
            </button>
            <button
              className={`ytgif-resolution-btn ${selectedResolution === '360p' ? 'ytgif-resolution-btn--active' : ''}`}
              onClick={() => setSelectedResolution('360p')}
            >
              360p Compact
              <span className="ytgif-resolution-desc">Ideal for email</span>
            </button>
            <button
              className={`ytgif-resolution-btn ${selectedResolution === '480p' ? 'ytgif-resolution-btn--active' : ''}`}
              onClick={() => setSelectedResolution('480p')}
            >
              480p HD
              <span className="ytgif-resolution-desc">Best quality</span>
            </button>
          </div>
        </div>

        {/* Frame Rate Options */}
        <div className="ytgif-frame-rate-section">
          <div className="ytgif-frame-rate-label">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            <span>Frame Rate</span>
          </div>
          <div className="ytgif-frame-rate-options">
            <button
              className={`ytgif-frame-rate-btn ${selectedFrameRate === 5 ? 'ytgif-frame-rate-btn--active' : ''}`}
              onClick={() => setSelectedFrameRate(5)}
            >
              5 fps
              <span className="ytgif-frame-rate-desc">Smaller file • Classic GIF feel</span>
            </button>
            <button
              className={`ytgif-frame-rate-btn ${selectedFrameRate === 10 ? 'ytgif-frame-rate-btn--active' : ''}`}
              onClick={() => setSelectedFrameRate(10)}
            >
              10 fps
              <span className="ytgif-frame-rate-desc">Balanced • Recommended</span>
            </button>
            <button
              className={`ytgif-frame-rate-btn ${selectedFrameRate === 15 ? 'ytgif-frame-rate-btn--active' : ''}`}
              onClick={() => setSelectedFrameRate(15)}
            >
              15 fps
              <span className="ytgif-frame-rate-desc">Smoother • Larger file</span>
            </button>
          </div>
        </div>

        {/* GIF Info */}
        <div className="ytgif-capture-info">
          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="ytgif-info-label">Duration:</span>
            <span className="ytgif-info-value">{gifDuration.toFixed(1)}s</span>
          </div>

          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 16h4m10 0h4"
              />
            </svg>
            <span className="ytgif-info-label">Frames:</span>
            <span className="ytgif-info-value">~{Math.round(gifDuration * selectedFrameRate)}</span>
          </div>

          <div className="ytgif-info-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="ytgif-info-label">Est. Size:</span>
            <span className="ytgif-info-value">
              ~
              {(() => {
                const resolutionMultipliers: Record<string, number> = {
                  '144p': 0.3,
                  '240p': 0.5,
                  '360p': 0.7,
                  '480p': 1.0,
                };
                const sizeEstimate =
                  gifDuration *
                  selectedFrameRate *
                  0.05 *
                  resolutionMultipliers[selectedResolution];
                return sizeEstimate.toFixed(1);
              })()}
              MB
            </span>
          </div>
        </div>

        {/* If no video element, show fallback preview info */}
        {!videoElement && (
          <div className="ytgif-preview-fallback">
            <div className="ytgif-fallback-message">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <p>Video preview will appear here</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="ytgif-wizard-actions">
          <button
            className="ytgif-button-primary"
            onClick={() => {
              // Pass the current selection, frame rate, and resolution
              onConfirm(startTime, endTime, selectedFrameRate, selectedResolution);
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            Continue to Customize →
          </button>
        </div>
      </div>
    </div>
  );
};

export default QuickCaptureScreen;
