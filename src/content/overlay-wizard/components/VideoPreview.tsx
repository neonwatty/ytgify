import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TextOverlay } from '@/types';

interface VideoPreviewProps {
  videoElement?: HTMLVideoElement;
  startTime: number;
  endTime: number;
  currentVideoTime?: number;
  currentPreviewTime?: number;
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  onSeek?: (time: number) => void;
  showTimeControls?: boolean;
  overlays?: TextOverlay[];
  width?: number;
  height?: number;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoElement,
  startTime,
  endTime,
  currentVideoTime,
  currentPreviewTime: externalPreviewTime,
  isPlaying = false,
  onPlayStateChange,
  onSeek,
  showTimeControls = false,
  overlays = [],
  width = 480,
  height = 270
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [currentPreviewTime, setCurrentPreviewTime] = useState(startTime);
  const [isLooping, setIsLooping] = useState(false);
  const savedVideoStateRef = useRef<{ currentTime: number; paused: boolean } | null>(null);
  
  // Draw text overlays on canvas
  const drawTextOverlays = useCallback((ctx: CanvasRenderingContext2D) => {
    if (!overlays || overlays.length === 0) return;
    
    overlays.forEach(overlay => {
      ctx.save();
      
      // Set text properties
      ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Calculate position
      const x = (overlay.position.x / 100) * width;
      const y = (overlay.position.y / 100) * height;
      
      // Draw text with optional stroke
      if (overlay.strokeColor && overlay.strokeWidth) {
        ctx.strokeStyle = overlay.strokeColor;
        ctx.lineWidth = overlay.strokeWidth;
        ctx.strokeText(overlay.text, x, y);
      }
      
      ctx.fillText(overlay.text, x, y);
      ctx.restore();
    });
  }, [overlays, width, height]);

  // Draw current frame to canvas
  const drawFrame = useCallback(() => {
    if (!canvasRef.current || !videoElement) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    try {
      // Draw directly from the main video element
      ctx.drawImage(videoElement, 0, 0, width, height);
      
      // Draw text overlays on top
      drawTextOverlays(ctx);
    } catch (error) {
      console.error('[VideoPreview] Error drawing frame:', error);
    }
  }, [videoElement, width, height, drawTextOverlays]);

  // Seek video to specific time and draw frame
  const seekAndDraw = useCallback(async (time: number) => {
    return new Promise<void>((resolve) => {
      if (!videoElement) {
        resolve();
        return;
      }
      
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        drawFrame();
        resolve();
      };
      
      videoElement.addEventListener('seeked', onSeeked);
      
      // Save current state before seeking
      if (!savedVideoStateRef.current) {
        savedVideoStateRef.current = {
          currentTime: videoElement.currentTime,
          paused: videoElement.paused
        };
      }
      
      // Pause video if playing to prevent conflicts
      if (!videoElement.paused) {
        videoElement.pause();
      }
      
      videoElement.currentTime = time;
      
      // Timeout fallback
      setTimeout(() => {
        videoElement.removeEventListener('seeked', onSeeked);
        drawFrame();
        resolve();
      }, 500);
    });
  }, [videoElement, drawFrame]);

  // Handle range playback
  const playRange = useCallback(async () => {
    if (!videoElement || !canvasRef.current) return;
    
    // Save video state before starting preview
    savedVideoStateRef.current = {
      currentTime: videoElement.currentTime,
      paused: videoElement.paused
    };
    
    // Pause main video during preview
    videoElement.pause();
    
    // Start playback from startTime
    let currentTime = startTime;
    setIsLooping(true);
    
    const animate = async () => {
      if (!isLooping || !isPlaying) return;
      
      // Update time
      currentTime += 0.1; // Advance by 100ms
      
      // Check if we've reached the end
      if (currentTime >= endTime) {
        currentTime = startTime; // Loop back to start
      }
      
      setCurrentPreviewTime(currentTime);
      
      // Seek video and draw frame
      await seekAndDraw(currentTime);
      
      // Continue animation
      animationFrameRef.current = requestAnimationFrame(() => {
        setTimeout(animate, 100); // 10 FPS for smoother preview
      });
    };
    
    animate();
  }, [startTime, endTime, isPlaying, isLooping, videoElement, seekAndDraw]);

  // Stop playback and restore video state
  const stopPlayback = useCallback(() => {
    setIsLooping(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Restore original video state
    if (videoElement && savedVideoStateRef.current) {
      videoElement.currentTime = savedVideoStateRef.current.currentTime;
      if (!savedVideoStateRef.current.paused) {
        videoElement.play();
      }
      savedVideoStateRef.current = null;
    }
  }, [videoElement]);

  // Handle play state changes
  useEffect(() => {
    if (isPlaying) {
      playRange();
    } else {
      stopPlayback();
    }
    
    return () => {
      stopPlayback();
    };
  }, [isPlaying, playRange, stopPlayback]);

  // Initial frame draw and sync with main video
  useEffect(() => {
    if (!isPlaying && videoElement) {
      // When not playing preview, show current video time if it's within selection
      const timeToShow = currentVideoTime !== undefined && 
                        currentVideoTime >= startTime && 
                        currentVideoTime <= endTime 
                        ? currentVideoTime 
                        : startTime;
      seekAndDraw(timeToShow);
      setCurrentPreviewTime(timeToShow);
    }
  }, [startTime, currentVideoTime, isPlaying, seekAndDraw, videoElement, endTime]);
  
  // Update preview when selection changes
  useEffect(() => {
    if (!isPlaying && videoElement) {
      seekAndDraw(startTime);
      setCurrentPreviewTime(startTime);
    }
  }, [endTime, isPlaying, startTime, seekAndDraw, videoElement]);

  // Draw initial frame
  useEffect(() => {
    if (videoElement) {
      drawFrame();
    }
  }, [videoElement, drawFrame]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, [stopPlayback]);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
  };

  return (
    <div className="ytgif-video-preview">
      <div className="ytgif-preview-container">
        <canvas 
          ref={canvasRef}
          width={width}
          height={height}
          className="ytgif-preview-canvas"
        />
        
        {/* Playback overlay */}
        {!isPlaying && (
          <div className="ytgif-preview-overlay">
            <button 
              className="ytgif-preview-play-button"
              onClick={() => onPlayStateChange?.(true)}
            >
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        )}
        
        {/* Time indicator */}
        <div className="ytgif-preview-time">
          {formatTime(currentPreviewTime)} / {formatTime(endTime)}
        </div>
      </div>
      
      {/* Preview controls */}
      <div className="ytgif-preview-controls">
        <button 
          className={`ytgif-preview-control-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => onPlayStateChange?.(!isPlaying)}
        >
          {isPlaying ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
        
        <span className="ytgif-preview-duration">
          {(endTime - startTime).toFixed(1)}s clip
        </span>
        
        <button 
          className="ytgif-preview-control-btn"
          onClick={() => seekAndDraw(startTime)}
          title="Reset to start"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 13c0 3.31-2.69 6-6 6s-6-2.69-6-6 2.69-6 6-6v4l5-5-5-5v4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8h-2z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default VideoPreview;