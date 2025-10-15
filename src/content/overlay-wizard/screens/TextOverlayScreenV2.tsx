import React, { useState, useCallback, useRef, useEffect } from 'react';
import { TextOverlay } from '@/types';

interface TextOverlayScreenProps {
  startTime: number;
  endTime: number;
  videoDuration: number;
  videoElement?: HTMLVideoElement;
  textOverlays?: TextOverlay[];
  resolution?: string;
  onConfirm: (overlays: TextOverlay[]) => void;
  onSkip: () => void;
  onBack?: () => void;
  onSeekTo?: (time: number) => void;
}

const TextOverlayScreenV2: React.FC<TextOverlayScreenProps> = ({
  startTime,
  endTime,
  videoElement,
  resolution = '144p',
  onConfirm,
  onSkip,
  onBack,
}) => {
  // Get font size range based on resolution
  const getFontSizeRange = () => {
    switch (resolution) {
      case '144p':
        return { min: 10, max: 48, default: 24 };
      case '240p':
        return { min: 12, max: 56, default: 28 };
      case '360p':
        return { min: 16, max: 64, default: 32 };
      case '480p':
        return { min: 20, max: 72, default: 36 };
      default:
        return { min: 10, max: 48, default: 24 };
    }
  };

  const fontSizeRange = getFontSizeRange();

  // Get target GIF dimensions based on resolution
  const getGifDimensions = () => {
    const resolutionMap: Record<string, { width: number; height: number }> = {
      '144p': { width: 256, height: 144 },
      '240p': { width: 426, height: 240 },
      '360p': { width: 640, height: 360 },
      '480p': { width: 854, height: 480 },
    };
    return resolutionMap[resolution] || resolutionMap['144p'];
  };

  const gifDimensions = getGifDimensions();

  // Top text state
  const [topText, setTopText] = useState('');
  const [topFontSize, setTopFontSize] = useState(fontSizeRange.default);
  const [topTextColor, setTopTextColor] = useState('#FFFFFF');

  // Bottom text state
  const [bottomText, setBottomText] = useState('');
  const [bottomFontSize, setBottomFontSize] = useState(fontSizeRange.default);
  const [bottomTextColor, setBottomTextColor] = useState('#FFFFFF');

  const [showTopAdvanced, setShowTopAdvanced] = useState(false);
  const [showBottomAdvanced, setShowBottomAdvanced] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [videoFrameUrl, setVideoFrameUrl] = useState<string | null>(null);

  const handleAddText = useCallback(() => {
    const overlays: TextOverlay[] = [];

    // Add top text if present
    if (topText.trim()) {
      overlays.push({
        id: 'top-overlay',
        text: topText.trim(),
        position: {
          x: 50, // Center horizontally
          y: 20, // Top position
        },
        fontSize: topFontSize,
        fontFamily: 'Arial',
        color: topTextColor,
        animation: 'none',
      });
    }

    // Add bottom text if present
    if (bottomText.trim()) {
      overlays.push({
        id: 'bottom-overlay',
        text: bottomText.trim(),
        position: {
          x: 50, // Center horizontally
          y: 80, // Bottom position
        },
        fontSize: bottomFontSize,
        fontFamily: 'Arial',
        color: bottomTextColor,
        animation: 'none',
      });
    }

    onConfirm(overlays);
  }, [topText, topFontSize, topTextColor, bottomText, bottomFontSize, bottomTextColor, onConfirm]);

  const hasText = topText.trim().length > 0 || bottomText.trim().length > 0;

  // Capture video frame for preview background
  useEffect(() => {
    if (videoElement && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Use the start time for consistency with QuickCaptureScreen
        const frameTime = startTime;

        // Store original time to restore later
        const originalTime = videoElement.currentTime;

        // Set canvas size to match target GIF dimensions
        canvas.width = gifDimensions.width;
        canvas.height = gifDimensions.height;

        // Function to capture the frame at GIF resolution
        const captureFrame = () => {
          try {
            // Draw video scaled to GIF dimensions
            ctx.drawImage(videoElement, 0, 0, gifDimensions.width, gifDimensions.height);
            const frameUrl = canvas.toDataURL('image/jpeg', 0.9);
            setVideoFrameUrl(frameUrl);
          } catch (error) {
            console.error('[TextOverlayScreenV2] Error capturing frame:', error);
          }

          // Restore original time after a short delay
          setTimeout(() => {
            videoElement.currentTime = originalTime;
          }, 100);
        };

        // Seek to the frame time and capture
        const performCapture = () => {
          videoElement.currentTime = frameTime;

          // Use requestAnimationFrame to ensure the frame is rendered
          const checkAndCapture = () => {
            if (Math.abs(videoElement.currentTime - frameTime) < 0.1) {
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
  }, [videoElement, startTime, endTime, gifDimensions.width, gifDimensions.height]);

  return (
    <div className="ytgif-wizard-screen ytgif-text-overlay-screen">
      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Standard wizard header */}
      <div className="ytgif-wizard-header">
        {onBack && (
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
        )}
        <h2 className="ytgif-wizard-title">Make It Memorable</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Helper text */}
        <p className="ytgif-wizard-helper">Add captions, reactions, or context to your GIF</p>
        {/* Video Preview with Real Frame Background */}
        <div className="ytgif-video-preview-section">
          <div className="ytgif-video-preview-frame">
            <p style={{ fontSize: '12px', color: '#999', marginBottom: '8px' }}>
              Preview at {resolution} ({gifDimensions.width}×{gifDimensions.height}px)
            </p>
            {videoFrameUrl ? (
              <div
                className="ytgif-frame-preview"
                style={{
                  backgroundImage: `url(${videoFrameUrl})`,
                  backgroundSize: 'cover',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  width: '100%',
                  maxWidth: `${gifDimensions.width}px`,
                  height: `${(gifDimensions.height / gifDimensions.width) * 100}%`,
                  maxHeight: '300px',
                  aspectRatio: `${gifDimensions.width} / ${gifDimensions.height}`,
                  position: 'relative',
                  borderRadius: '8px',
                  backgroundColor: '#000',
                  margin: '0 auto',
                }}
              >
                {topText.trim() && (
                  <div
                    className="ytgif-text-preview-overlay"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      top: '20%',
                      transform: 'translate(-50%, -50%)',
                      // Use actual font size that will be rendered in the GIF
                      fontSize: `${topFontSize}px`,
                      color: topTextColor,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {topText}
                  </div>
                )}
                {bottomText.trim() && (
                  <div
                    className="ytgif-text-preview-overlay"
                    style={{
                      position: 'absolute',
                      left: '50%',
                      bottom: '20%',
                      transform: 'translate(-50%, 50%)',
                      // Use actual font size that will be rendered in the GIF
                      fontSize: `${bottomFontSize}px`,
                      color: bottomTextColor,
                      fontWeight: 'bold',
                      textShadow: '2px 2px 4px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap',
                      maxWidth: '90%',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {bottomText}
                  </div>
                )}
              </div>
            ) : (
              <div className="ytgif-preview-placeholder">
                <svg
                  width="64"
                  height="64"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                  <circle cx="8" cy="8" r="2" />
                  <polyline points="23 16 16 9 8 17 2 11" />
                </svg>
                <p>Loading video preview...</p>
              </div>
            )}
          </div>
        </div>

        {/* Text Controls */}
        <div className="ytgif-text-controls">
          {/* Top Text Section */}
          <div className="ytgif-text-section">
            <div className="ytgif-control-group">
              <label className="ytgif-control-label">Top Text</label>
              <input
                type="text"
                className="ytgif-text-input"
                placeholder="Add your caption here..."
                value={topText}
                onChange={(e) => setTopText(e.target.value)}
                maxLength={50}
                autoFocus
              />
              <span className="ytgif-char-count">{topText.length}/50</span>
            </div>

            {/* Top Text Style Options */}
            <button
              className="ytgif-advanced-toggle"
              onClick={() => setShowTopAdvanced(!showTopAdvanced)}
              type="button"
            >
              <span>{showTopAdvanced ? '−' : '+'}</span>
              Top Text Style
            </button>

            {showTopAdvanced && (
              <div className="ytgif-advanced-options">
                <div className="ytgif-control-row">
                  <div className="ytgif-control-group ytgif-control-half">
                    <label className="ytgif-control-label">Size</label>
                    <input
                      type="range"
                      min={fontSizeRange.min}
                      max={fontSizeRange.max}
                      value={topFontSize}
                      onChange={(e) => setTopFontSize(Number(e.target.value))}
                      className="ytgif-range-input"
                    />
                    <span className="ytgif-range-value">{topFontSize}px</span>
                  </div>
                  <div className="ytgif-control-group ytgif-control-half">
                    <label className="ytgif-control-label">Color</label>
                    <div className="ytgif-color-picker">
                      <input
                        type="color"
                        value={topTextColor}
                        onChange={(e) => setTopTextColor(e.target.value)}
                        className="ytgif-color-input"
                      />
                      <span className="ytgif-color-value">{topTextColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="ytgif-text-divider"></div>

          {/* Bottom Text Section */}
          <div className="ytgif-text-section">
            <div className="ytgif-control-group">
              <label className="ytgif-control-label">Bottom Text</label>
              <input
                type="text"
                className="ytgif-text-input"
                placeholder="Perfect for reactions or context..."
                value={bottomText}
                onChange={(e) => setBottomText(e.target.value)}
                maxLength={50}
              />
              <span className="ytgif-char-count">{bottomText.length}/50</span>
            </div>

            {/* Bottom Text Style Options */}
            <button
              className="ytgif-advanced-toggle"
              onClick={() => setShowBottomAdvanced(!showBottomAdvanced)}
              type="button"
            >
              <span>{showBottomAdvanced ? '−' : '+'}</span>
              Bottom Text Style
            </button>

            {showBottomAdvanced && (
              <div className="ytgif-advanced-options">
                <div className="ytgif-control-row">
                  <div className="ytgif-control-group ytgif-control-half">
                    <label className="ytgif-control-label">Size</label>
                    <input
                      type="range"
                      min={fontSizeRange.min}
                      max={fontSizeRange.max}
                      value={bottomFontSize}
                      onChange={(e) => setBottomFontSize(Number(e.target.value))}
                      className="ytgif-range-input"
                    />
                    <span className="ytgif-range-value">{bottomFontSize}px</span>
                  </div>
                  <div className="ytgif-control-group ytgif-control-half">
                    <label className="ytgif-control-label">Color</label>
                    <div className="ytgif-color-picker">
                      <input
                        type="color"
                        value={bottomTextColor}
                        onChange={(e) => setBottomTextColor(e.target.value)}
                        className="ytgif-color-input"
                      />
                      <span className="ytgif-color-value">{bottomTextColor}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Standard Action Buttons */}
      <div className="ytgif-wizard-actions">
        <button className="ytgif-button-secondary" onClick={onSkip} type="button">
          Skip This Step
        </button>

        <button
          className="ytgif-button-primary"
          onClick={hasText ? handleAddText : onSkip}
          type="button"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          {hasText ? 'Apply Text & Continue' : 'Create GIF Without Text'}
        </button>
      </div>
    </div>
  );
};

export default TextOverlayScreenV2;
