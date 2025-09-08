import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextOverlay } from '@/types';

interface TextOverlayScreenProps {
  startTime: number;
  endTime: number;
  videoDuration: number;
  videoElement?: HTMLVideoElement;
  textOverlays?: TextOverlay[];
  onConfirm: (overlays: TextOverlay[]) => void;
  onSkip: () => void;
  onBack?: () => void;
  onSeekTo?: (time: number) => void;
}

const TextOverlayScreenV2: React.FC<TextOverlayScreenProps> = ({
  startTime,
  endTime,
  videoDuration,
  videoElement,
  textOverlays = [],
  onConfirm,
  onSkip,
  onBack,
  onSeekTo
}) => {
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [position, setPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null);

  const handleAddText = useCallback(() => {
    if (!text.trim()) return;

    const overlay: TextOverlay = {
      id: `overlay-${Date.now()}`,
      text: text.trim(),
      position: {
        x: 50, // Center horizontally
        y: position === 'top' ? 20 : position === 'center' ? 50 : 80
      },
      fontSize,
      fontFamily: 'Arial',
      color: textColor,
      animation: 'none'
    };

    console.log('[TextOverlayScreenV2] Creating text overlay:', overlay);
    onConfirm([overlay]);
    console.log('[TextOverlayScreenV2] Called onConfirm with overlay array length:', [overlay].length);
  }, [text, fontSize, textColor, position, startTime, endTime, onConfirm]);

  const hasText = text.trim().length > 0;

  // Capture video frame for preview background
  useEffect(() => {
    if (videoElement && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Calculate the midpoint of the selected range
        const midTime = startTime + (endTime - startTime) / 2;
        console.log(`[TextOverlayScreenV2] Capturing frame at midpoint: ${midTime}s (range: ${startTime}s - ${endTime}s)`);
        
        // Store original time to restore later
        const originalTime = videoElement.currentTime;
        
        // Set canvas size to match video
        canvas.width = videoElement.videoWidth || 640;
        canvas.height = videoElement.videoHeight || 360;
        
        // Function to capture the frame
        const captureFrame = () => {
          try {
            ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
            const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
            setVideoFrameUrl(frameUrl);
            console.log(`[TextOverlayScreenV2] Frame captured successfully at ${videoElement.currentTime}s`);
          } catch (error) {
            console.error('[TextOverlayScreenV2] Error capturing frame:', error);
          }
          
          // Restore original time after a short delay
          setTimeout(() => {
            videoElement.currentTime = originalTime;
          }, 100);
        };
        
        // Seek to the midpoint and capture
        const performCapture = () => {
          videoElement.currentTime = midTime;
          
          // Use requestAnimationFrame to ensure the frame is rendered
          const checkAndCapture = () => {
            if (Math.abs(videoElement.currentTime - midTime) < 0.1) {
              // We're close enough to the target time
              requestAnimationFrame(() => {
                captureFrame();
              });
            } else {
              // Keep checking
              requestAnimationFrame(checkAndCapture);
            }
          };
          
          // Start checking after a small delay
          setTimeout(checkAndCapture, 100);
        };
        
        // Perform the capture
        performCapture();
      }
    }
  }, [videoElement, startTime, endTime]);

  return (
    <div className="ytgif-wizard-screen ytgif-text-overlay-screen">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {/* Standard wizard header */}
      <div className="ytgif-wizard-header">
        {onBack && (
          <button onClick={onBack} className="ytgif-back-button">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}
        <h2 className="ytgif-wizard-title">Add Text to Your GIF</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Video Preview with Real Frame Background */}
        <div className="ytgif-video-preview-section">
          <div className="ytgif-video-preview-frame">
            {videoFrameUrl ? (
              <div 
                className="ytgif-frame-preview"
                style={{
                  backgroundImage: `url(${videoFrameUrl})`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  width: '100%',
                  height: '300px',
                  position: 'relative',
                  borderRadius: '8px',
                  backgroundColor: '#000'
                }}
              >
                {hasText && (
                  <div 
                    className="ytgif-text-preview-overlay"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: position === 'top' ? '15%' : position === 'center' ? '50%' : '85%',
                      transform: `translate(-50%, ${position === 'center' ? '-50%' : '0'})`,
                      fontSize: `${Math.max(16, fontSize * 0.6)}px`,
                      color: textColor,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {text}
                  </div>
                )}
              </div>
            ) : (
              <div className="ytgif-preview-placeholder">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
                  <circle cx="8" cy="8" r="2"/>
                  <polyline points="23 16 16 9 8 17 2 11"/>
                </svg>
                <p>Loading video preview...</p>
              </div>
            )}
          </div>
        </div>

        {/* Text Controls */}
        <div className="ytgif-text-controls">
          {/* Text Input */}
          <div className="ytgif-control-group">
            <label className="ytgif-control-label">Your Text</label>
            <input
              type="text"
              className="ytgif-text-input"
              placeholder="Enter your text here..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={50}
              autoFocus
            />
            <span className="ytgif-char-count">{text.length}/50</span>
          </div>

          {/* Quick Position Selection */}
          <div className="ytgif-control-group">
            <label className="ytgif-control-label">Position</label>
            <div className="ytgif-position-buttons">
              <button
                className={`ytgif-position-btn ${position === 'top' ? 'active' : ''}`}
                onClick={() => setPosition('top')}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="4" y="4" width="16" height="4" fill={position === 'top' ? 'currentColor' : 'none'}/>
                  <rect x="4" y="4" width="16" height="16" strokeWidth="2"/>
                </svg>
                Top
              </button>
              <button
                className={`ytgif-position-btn ${position === 'center' ? 'active' : ''}`}
                onClick={() => setPosition('center')}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="4" y="10" width="16" height="4" fill={position === 'center' ? 'currentColor' : 'none'}/>
                  <rect x="4" y="4" width="16" height="16" strokeWidth="2"/>
                </svg>
                Center
              </button>
              <button
                className={`ytgif-position-btn ${position === 'bottom' ? 'active' : ''}`}
                onClick={() => setPosition('bottom')}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <rect x="4" y="16" width="16" height="4" fill={position === 'bottom' ? 'currentColor' : 'none'}/>
                  <rect x="4" y="4" width="16" height="16" strokeWidth="2"/>
                </svg>
                Bottom
              </button>
            </div>
          </div>

          {/* Advanced Options Toggle */}
          <button
            className="ytgif-advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
            type="button"
          >
            <span>{showAdvanced ? '−' : '+'}</span>
            Style Options
          </button>

          {/* Advanced Options */}
          {showAdvanced && (
            <div className="ytgif-advanced-options">
              <div className="ytgif-control-row">
                <div className="ytgif-control-group ytgif-control-half">
                  <label className="ytgif-control-label">Size</label>
                  <input
                    type="range"
                    min="16"
                    max="64"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="ytgif-range-input"
                  />
                  <span className="ytgif-range-value">{fontSize}px</span>
                </div>
                <div className="ytgif-control-group ytgif-control-half">
                  <label className="ytgif-control-label">Color</label>
                  <div className="ytgif-color-picker">
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => setTextColor(e.target.value)}
                      className="ytgif-color-input"
                    />
                    <span className="ytgif-color-value">{textColor}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* Standard Action Buttons */}
        <div className="ytgif-wizard-actions">
          <button 
            className="ytgif-button-secondary"
            onClick={onSkip}
            type="button"
          >
            Skip Text
          </button>
          
          <button 
            className="ytgif-button-primary"
            onClick={hasText ? handleAddText : onSkip}
            type="button"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {hasText ? 'Add Text & Create GIF' : 'Continue Without Text'}
          </button>
        </div>
    </div>
  );
};

export default TextOverlayScreenV2;