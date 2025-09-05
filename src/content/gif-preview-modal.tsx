import React, { useState, useEffect, useRef } from 'react';

interface GifPreviewModalProps {
  gifDataUrl: string;
  frames?: ImageData[];  // Optional frames for advanced preview
  metadata?: {
    width: number;
    height: number;
    fileSize: number;
    duration: number;
    frameCount?: number;
    frameRate?: number;
  };
  onClose: () => void;
  onDownload: () => void;
  onOpenLibrary: () => void;
}

export const GifPreviewModal: React.FC<GifPreviewModalProps> = ({
  gifDataUrl,
  frames,
  metadata,
  onClose,
  onDownload,
  onOpenLibrary
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const autoCloseTimerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    // Fade in animation
    setTimeout(() => setIsVisible(true), 10);
    
    // Auto-close after 15 seconds (increased for better preview)
    autoCloseTimerRef.current = setTimeout(() => {
      handleClose();
    }, 15000);

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300); // Wait for fade out
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Frame animation logic for advanced preview
  useEffect(() => {
    if (!frames || frames.length === 0 || !canvasRef.current || isPaused) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frameRate = metadata?.frameRate || 10;
    const frameDelay = 1000 / frameRate;
    let lastFrameTime = 0;

    const animate = (timestamp: number) => {
      if (timestamp - lastFrameTime >= frameDelay) {
        const frame = frames[currentFrame];
        if (frame) {
          canvas.width = frame.width;
          canvas.height = frame.height;
          ctx.putImageData(frame, 0, 0);
        }
        
        setCurrentFrame((prev) => (prev + 1) % frames.length);
        lastFrameTime = timestamp;
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [frames, currentFrame, isPaused, metadata?.frameRate]);

  const togglePlayPause = () => {
    setIsPaused(!isPaused);
    // Reset auto-close timer when user interacts
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(handleClose, 15000);
    }
  };

  const handleFrameSeek = (frameIndex: number) => {
    setCurrentFrame(frameIndex);
    setIsPaused(true);
  };

  return (
    <div 
      className={`ytgif-preview-modal ${isVisible ? 'ytgif-preview-modal--visible' : ''}`}
      onClick={handleClose}
    >
      <div 
        className="ytgif-preview-modal__content"
        onClick={(e) => e.stopPropagation()}
      >
        <button 
          className="ytgif-preview-modal__close"
          onClick={handleClose}
          aria-label="Close preview"
        >
          ✕
        </button>

        <div className="ytgif-preview-modal__header">
          <h3>✨ GIF Created Successfully!</h3>
        </div>

        <div 
          className="ytgif-preview-modal__image-container"
          onMouseEnter={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          {frames && frames.length > 0 ? (
            <>
              <canvas 
                ref={canvasRef}
                className="ytgif-preview-modal__canvas"
                style={{ maxWidth: '100%', height: 'auto' }}
              />
              {showControls && (
                <div className="ytgif-preview-modal__controls">
                  <button
                    className="ytgif-preview-modal__play-button"
                    onClick={togglePlayPause}
                    aria-label={isPaused ? 'Play' : 'Pause'}
                  >
                    {isPaused ? '▶️' : '⏸️'}
                  </button>
                  <div className="ytgif-preview-modal__frame-indicator">
                    Frame {currentFrame + 1} / {frames.length}
                  </div>
                  <input
                    type="range"
                    className="ytgif-preview-modal__scrubber"
                    min={0}
                    max={frames.length - 1}
                    value={currentFrame}
                    onChange={(e) => handleFrameSeek(parseInt(e.target.value))}
                  />
                </div>
              )}
            </>
          ) : (
            <img 
              src={gifDataUrl} 
              alt="Created GIF"
              className="ytgif-preview-modal__image"
            />
          )}
        </div>

        {metadata && (
          <div className="ytgif-preview-modal__metadata">
            <span>{metadata.width}×{metadata.height}</span>
            <span>•</span>
            <span>{formatFileSize(metadata.fileSize)}</span>
            <span>•</span>
            <span>{metadata.duration}s</span>
          </div>
        )}

        <div className="ytgif-preview-modal__actions">
          <button
            className="ytgif-preview-modal__button ytgif-preview-modal__button--primary"
            onClick={() => {
              onDownload();
              handleClose();
            }}
          >
            <span className="ytgif-preview-modal__button-icon">⬇</span>
            Download GIF
          </button>
          <button
            className="ytgif-preview-modal__button ytgif-preview-modal__button--secondary"
            onClick={() => {
              onOpenLibrary();
              handleClose();
            }}
          >
            <span className="ytgif-preview-modal__button-icon">📚</span>
            Open Library
          </button>
        </div>

        <div className="ytgif-preview-modal__footer">
          <small>GIF saved to library • Click Download to save to disk</small>
        </div>
      </div>

      <style>{`
        .ytgif-preview-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .ytgif-preview-modal--visible {
          opacity: 1;
        }

        .ytgif-preview-modal__content {
          background: #fff;
          border-radius: 12px;
          padding: 24px;
          max-width: 500px;
          width: 90%;
          max-height: 80vh;
          overflow-y: auto;
          position: relative;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          transform: scale(0.95);
          transition: transform 0.3s ease;
        }

        .ytgif-preview-modal--visible .ytgif-preview-modal__content {
          transform: scale(1);
        }

        .ytgif-preview-modal__close {
          position: absolute;
          top: 16px;
          right: 16px;
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: #666;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background 0.2s;
        }

        .ytgif-preview-modal__close:hover {
          background: #f0f0f0;
        }

        .ytgif-preview-modal__header {
          text-align: center;
          margin-bottom: 20px;
        }

        .ytgif-preview-modal__header h3 {
          margin: 0;
          font-size: 20px;
          color: #333;
          font-weight: 600;
        }

        .ytgif-preview-modal__image-container {
          background: #000;
          border-radius: 8px;
          overflow: hidden;
          margin-bottom: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
        }

        .ytgif-preview-modal__image {
          display: block;
          width: 100%;
          height: auto;
          max-height: 400px;
          object-fit: contain;
        }

        .ytgif-preview-modal__metadata {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: #666;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .ytgif-preview-modal__actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .ytgif-preview-modal__button {
          flex: 1;
          padding: 12px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .ytgif-preview-modal__button--primary {
          background: #1976d2;
          color: white;
        }

        .ytgif-preview-modal__button--primary:hover {
          background: #1565c0;
          transform: translateY(-1px);
        }

        .ytgif-preview-modal__button--secondary {
          background: #f5f5f5;
          color: #333;
        }

        .ytgif-preview-modal__button--secondary:hover {
          background: #e8e8e8;
        }

        .ytgif-preview-modal__button-icon {
          font-size: 18px;
        }

        .ytgif-preview-modal__footer {
          text-align: center;
          color: #999;
          font-size: 12px;
        }

        /* Dark mode support for YouTube dark theme */
        html[dark] .ytgif-preview-modal__content,
        [dark] .ytgif-preview-modal__content {
          background: #282828;
          color: #fff;
        }

        html[dark] .ytgif-preview-modal__header h3,
        [dark] .ytgif-preview-modal__header h3 {
          color: #fff;
        }

        html[dark] .ytgif-preview-modal__close,
        [dark] .ytgif-preview-modal__close {
          color: #aaa;
        }

        html[dark] .ytgif-preview-modal__close:hover,
        [dark] .ytgif-preview-modal__close:hover {
          background: #3a3a3a;
        }

        html[dark] .ytgif-preview-modal__metadata,
        [dark] .ytgif-preview-modal__metadata {
          color: #aaa;
        }

        html[dark] .ytgif-preview-modal__button--secondary,
        [dark] .ytgif-preview-modal__button--secondary {
          background: #3a3a3a;
          color: #fff;
        }

        html[dark] .ytgif-preview-modal__button--secondary:hover,
        [dark] .ytgif-preview-modal__button--secondary:hover {
          background: #484848;
        }

        html[dark] .ytgif-preview-modal__footer,
        [dark] .ytgif-preview-modal__footer {
          color: #888;
        }
      `}</style>
    </div>
  );
};