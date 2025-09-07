import React, { useRef, useEffect, useState, useCallback } from 'react';

interface VideoPreviewProps {
  videoElement: HTMLVideoElement;
  startTime: number;
  endTime: number;
  currentVideoTime?: number; // Add current video time prop
  isPlaying?: boolean;
  onPlayStateChange?: (playing: boolean) => void;
  width?: number;
  height?: number;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoElement,
  startTime,
  endTime,
  currentVideoTime,
  isPlaying = false,
  onPlayStateChange,
  width = 480,
  height = 270
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [currentPreviewTime, setCurrentPreviewTime] = useState(startTime);
  const [isLooping, setIsLooping] = useState(false);
  
  // Store original video state
  const originalStateRef = useRef<{
    currentTime: number;
    paused: boolean;
  }>({
    currentTime: videoElement.currentTime,
    paused: videoElement.paused
  });

  // Draw current frame to canvas
  const drawFrame = useCallback(() => {
    if (!canvasRef.current || !videoElement) return;
    
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    
    // Draw the current video frame to canvas
    ctx.drawImage(videoElement, 0, 0, width, height);
  }, [videoElement, width, height]);

  // Seek to specific time and draw frame
  const seekAndDraw = useCallback(async (time: number) => {
    return new Promise<void>((resolve) => {
      const onSeeked = () => {
        videoElement.removeEventListener('seeked', onSeeked);
        drawFrame();
        resolve();
      };
      
      videoElement.addEventListener('seeked', onSeeked);
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
    
    // Store original state before we start
    originalStateRef.current = {
      currentTime: videoElement.currentTime,
      paused: videoElement.paused
    };
    
    // Pause the main video to avoid conflicts
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
  }, [videoElement, startTime, endTime, isPlaying, isLooping, seekAndDraw]);

  // Stop playback
  const stopPlayback = useCallback(() => {
    setIsLooping(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    // Restore original video state
    if (videoElement && originalStateRef.current) {
      videoElement.currentTime = originalStateRef.current.currentTime;
      if (!originalStateRef.current.paused) {
        videoElement.play().catch(() => {});
      }
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

  // Initial frame draw and sync with video
  useEffect(() => {
    if (!isPlaying) {
      // When not playing preview, show current video time if it's within selection
      const timeToShow = currentVideoTime !== undefined && 
                        currentVideoTime >= startTime && 
                        currentVideoTime <= endTime 
                        ? currentVideoTime 
                        : startTime;
      seekAndDraw(timeToShow);
      setCurrentPreviewTime(timeToShow);
    }
  }, [startTime, currentVideoTime, isPlaying, seekAndDraw]);
  
  // Update preview when selection changes
  useEffect(() => {
    if (!isPlaying) {
      seekAndDraw(startTime);
      setCurrentPreviewTime(startTime);
    }
  }, [endTime, isPlaying, startTime, seekAndDraw]);

  // Monitor external video time changes
  useEffect(() => {
    if (!videoElement) return;
    
    const handleTimeUpdate = () => {
      // Only update if we're not currently playing preview
      if (!isPlaying) {
        const currentTime = videoElement.currentTime;
        // Update preview if current time is within our selection range
        if (currentTime >= startTime && currentTime <= endTime) {
          setCurrentPreviewTime(currentTime);
          drawFrame();
        }
      }
    };
    
    const handleSeeked = () => {
      // Update immediately when video seeks
      if (!isPlaying) {
        const currentTime = videoElement.currentTime;
        setCurrentPreviewTime(currentTime);
        drawFrame();
      }
    };
    
    videoElement.addEventListener('timeupdate', handleTimeUpdate);
    videoElement.addEventListener('seeked', handleSeeked);
    
    return () => {
      videoElement.removeEventListener('timeupdate', handleTimeUpdate);
      videoElement.removeEventListener('seeked', handleSeeked);
    };
  }, [videoElement, isPlaying, startTime, endTime, drawFrame]);
  
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