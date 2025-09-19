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

const VideoPreview: React.FC<VideoPreviewProps> = ({
  videoElement,
  startTime,
  endTime,
  currentVideoTime,
  isPlaying = false,
  onPlayStateChange,
  overlays = [],
  width = 480,
  height = 270,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  const [currentPreviewTime, setCurrentPreviewTime] = useState(startTime);
  const isLoopingRef = useRef(false);
  const savedVideoStateRef = useRef<{ currentTime: number; paused: boolean } | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  // Draw text overlays on canvas
  const drawTextOverlays = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      if (!overlays || overlays.length === 0) return;

      overlays.forEach((overlay) => {
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
    },
    [overlays, width, height]
  );

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
  const seekAndDraw = useCallback(
    async (time: number) => {
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
            paused: videoElement.paused,
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
    },
    [videoElement, drawFrame]
  );

  // Handle range playback - memoized without dependencies that change
  const playRange = useCallback(() => {
    if (!videoElement || !canvasRef.current) {
      console.log('[VideoPreview] Cannot start playback - missing video or canvas');
      return;
    }

    console.log('[VideoPreview] Starting playback', { startTime, endTime });

    // Save video state before starting preview
    if (!savedVideoStateRef.current) {
      savedVideoStateRef.current = {
        currentTime: videoElement.currentTime,
        paused: videoElement.paused,
      };
    }

    // Pause main video during preview
    videoElement.pause();

    // Start playback from startTime
    let currentTime = startTime;
    isLoopingRef.current = true;
    lastFrameTimeRef.current = performance.now();

    const animate = async () => {
      // Check if we should continue - use ref value only
      if (!isLoopingRef.current) {
        console.log('[VideoPreview] Stopping animation loop - isLooping is false');
        return;
      }

      const now = performance.now();
      const deltaTime = (now - lastFrameTimeRef.current) / 1000; // Convert to seconds

      // Only update if enough time has passed (target 10 FPS = 100ms)
      if (deltaTime >= 0.1) {
        // Update time
        currentTime += deltaTime;

        // Check if we've reached the end
        if (currentTime >= endTime) {
          currentTime = startTime; // Loop back to start
        }

        setCurrentPreviewTime(currentTime);

        // Seek video and draw frame
        try {
          await seekAndDraw(currentTime);
        } catch (error) {
          console.error('[VideoPreview] Error during seekAndDraw:', error);
        }

        lastFrameTimeRef.current = now;
      }

      // Continue animation
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start the animation
    animate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement, startTime, endTime]);

  // Stop playback and restore video state - stable reference
  const stopPlayback = useCallback(() => {
    console.log('[VideoPreview] Stopping playback');
    isLoopingRef.current = false;

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = undefined;
    }

    // Restore original video state
    if (videoElement && savedVideoStateRef.current) {
      videoElement.currentTime = savedVideoStateRef.current.currentTime;
      if (!savedVideoStateRef.current.paused) {
        videoElement.play().catch((err) => {
          console.error('[VideoPreview] Error restoring video playback:', err);
        });
      }
      savedVideoStateRef.current = null;
    }
  }, [videoElement]);

  // Handle play state changes
  useEffect(() => {
    console.log('[VideoPreview] Play state changed:', isPlaying);
    if (isPlaying) {
      playRange();
    } else {
      stopPlayback();
    }

    return () => {
      if (isPlaying) {
        stopPlayback();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Initial frame draw and sync with main video
  useEffect(() => {
    if (!isPlaying && videoElement) {
      // When not playing preview, show current video time if it's within selection
      const timeToShow =
        currentVideoTime !== undefined &&
        currentVideoTime >= startTime &&
        currentVideoTime <= endTime
          ? currentVideoTime
          : startTime;
      seekAndDraw(timeToShow);
      setCurrentPreviewTime(timeToShow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime, endTime, currentVideoTime, isPlaying, videoElement]);

  // Draw initial frame
  useEffect(() => {
    if (videoElement) {
      drawFrame();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoElement]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isLoopingRef.current = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Restore video state if needed
      if (videoElement && savedVideoStateRef.current) {
        videoElement.currentTime = savedVideoStateRef.current.currentTime;
        if (!savedVideoStateRef.current.paused) {
          videoElement.play().catch(() => {});
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        <canvas ref={canvasRef} width={width} height={height} className="ytgif-preview-canvas" />

        {/* Playback overlay */}
        {!isPlaying && (
          <div className="ytgif-preview-overlay">
            <button
              className="ytgif-preview-play-button"
              onClick={() => {
                console.log('[VideoPreview] Play overlay clicked');
                if (onPlayStateChange) {
                  onPlayStateChange(true);
                }
              }}
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
          onClick={() => {
            console.log('[VideoPreview] Play/pause button clicked, current state:', isPlaying);
            if (onPlayStateChange) {
              onPlayStateChange(!isPlaying);
            }
          }}
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

        <span className="ytgif-preview-duration">{(endTime - startTime).toFixed(1)}s clip</span>

        <button
          className="ytgif-preview-control-btn"
          onClick={() => {
            console.log('[VideoPreview] Reset button clicked');
            // Stop playback if playing
            if (isPlaying) {
              onPlayStateChange?.(false);
            }
            // Reset to start
            setCurrentPreviewTime(startTime);
            seekAndDraw(startTime).catch((err) => {
              console.error('[VideoPreview] Error resetting to start:', err);
            });
          }}
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
