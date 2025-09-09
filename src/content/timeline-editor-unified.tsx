import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TimelineSelection, TextOverlay } from '@/types';
import { TimelineMarkers } from './timeline-markers';
import { QuickPresets } from './quick-presets';

// Export format types
export type ExportFormat = 'gif';

interface UnifiedGifSettings {
  frameRate: number;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
  format: ExportFormat;
}

export interface TimelineEditorUnifiedProps {
  videoDuration: number;
  currentTime: number;
  videoElement: HTMLVideoElement;
  onClose: () => void;
  onSave: (selection: TimelineSelection, settings: UnifiedGifSettings, textOverlays: TextOverlay[]) => Promise<void>;
  onExport: (selection: TimelineSelection, settings: UnifiedGifSettings, textOverlays: TextOverlay[]) => Promise<void>;
  onSeekTo?: (time: number) => void;
  className?: string;
}

interface UnifiedState {
  // Timeline state
  selection: TimelineSelection;
  isExtracting: boolean;
  extractedFrames: ImageData[] | null;
  
  // Editor state
  settings: UnifiedGifSettings;
  textOverlays: TextOverlay[];
  currentFrame: number;
  isPlaying: boolean;
  
  // Processing state
  isProcessing: boolean;
  processingMessage: string;
  processingProgress: number;
  gifCreated: boolean;
  
  // UI state
  showAdvancedSettings: boolean;
}

export const TimelineEditorUnified: React.FC<TimelineEditorUnifiedProps> = ({
  videoDuration,
  currentTime,
  videoElement,
  onClose,
  onSave,
  onExport,
  onSeekTo,
  className = ''
}) => {
  const [state, setState] = useState<UnifiedState>({
    // Initialize selection from current time forward
    selection: {
      startTime: currentTime,
      endTime: Math.min(videoDuration, currentTime + 5),
      duration: Math.min(5, videoDuration - currentTime)
    },
    isExtracting: false,
    extractedFrames: null,
    
    // Default settings
    settings: {
      frameRate: 15,
      width: 640,
      height: 360,
      quality: 'medium',
      loop: true,
      format: 'gif'
    },
    textOverlays: [],
    currentFrame: 0,
    isPlaying: false,
    
    isProcessing: false,
    processingMessage: '',
    processingProgress: 0,
    gifCreated: false,
    showAdvancedSettings: false
  });

  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();

  // Update selection duration when start/end times change
  useEffect(() => {
    setState(prev => ({
      ...prev,
      selection: {
        ...prev.selection,
        duration: prev.selection.endTime - prev.selection.startTime
      }
    }));
  }, [state.selection.startTime, state.selection.endTime]);

  // Listen for progress updates from background worker
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GIF_PROGRESS') {
        setState(prev => ({
          ...prev,
          processingProgress: event.data.progress || 0,
          processingMessage: event.data.message || prev.processingMessage
        }));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const extractFrames = useCallback(async () => {
    if (!videoElement || state.isExtracting) return;
    
    setState(prev => ({ ...prev, isExtracting: true }));
    
    const { startTime, endTime } = state.selection;
    const originalTime = videoElement.currentTime;
    const wasPlaying = !videoElement.paused;
    
    // Pause video during extraction
    if (wasPlaying) {
      videoElement.pause();
    }
    
    const frameRate = 5; // Preview frame rate
    const duration = endTime - startTime;
    const frameCount = Math.min(15, Math.ceil(duration * frameRate));
    const frames: ImageData[] = [];

    try {
      for (let i = 0; i < frameCount; i++) {
        const time = startTime + (i / frameCount) * duration;
        videoElement.currentTime = time;
        
        // Wait for seek to complete
        await new Promise<void>((resolve) => {
          // eslint-disable-next-line prefer-const
          let timeoutId: number;
          const onSeeked = () => {
            clearTimeout(timeoutId);
            videoElement.removeEventListener('seeked', onSeeked);
            resolve();
          };
          
          timeoutId = window.setTimeout(() => {
            videoElement.removeEventListener('seeked', onSeeked);
            resolve();
          }, 1000);
          
          videoElement.addEventListener('seeked', onSeeked);
        });

        // Capture frame
        const canvas = document.createElement('canvas');
        canvas.width = state.settings.width;
        canvas.height = state.settings.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
          frames.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        }
      }

      setState(prev => ({
        ...prev,
        extractedFrames: frames,
        isExtracting: false
      }));
    } catch (error) {
      console.error('[Frame Extraction] Failed:', error);
      setState(prev => ({ ...prev, isExtracting: false }));
    }

    // Restore original video state
    videoElement.currentTime = originalTime;
    if (wasPlaying) {
      videoElement.play();
    }
  }, [videoElement, state.selection, state.settings.width, state.settings.height, state.isExtracting]);

  // Auto-extract frames when selection changes (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (state.selection.duration > 0.5 && state.selection.duration < 30) {
        extractFrames();
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [state.selection, extractFrames]);

  const handleSelectionChange = useCallback((selection: TimelineSelection) => {
    setState(prev => ({ ...prev, selection }));
  }, []);

  const handleSettingsChange = useCallback((updates: Partial<UnifiedGifSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, []);

  const handleCreateGif = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      isProcessing: true, 
      processingMessage: 'Creating GIF...', 
      processingProgress: 0 
    }));
    
    // Simulate GIF creation with progress updates
    // In real implementation, this would trigger the actual GIF processing
    try {
      // This would normally call the actual GIF creation logic
      await onExport(state.selection, state.settings, state.textOverlays);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        processingMessage: '', 
        processingProgress: 100,
        gifCreated: true 
      }));
    } catch (error) {
      console.error('GIF creation failed:', error);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        processingMessage: '', 
        processingProgress: 0 
      }));
    }
  }, [state.selection, state.settings, state.textOverlays, onExport]);

  const handleSave = useCallback(async () => {
    if (!state.gifCreated) {
      alert('Please create the GIF first');
      return;
    }
    setState(prev => ({ ...prev, isProcessing: true, processingMessage: 'Saving to library...' }));
    try {
      await onSave(state.selection, state.settings, state.textOverlays);
      onClose();
    } catch (error) {
      console.error('Save failed:', error);
      setState(prev => ({ ...prev, isProcessing: false, processingMessage: '' }));
    }
  }, [state.selection, state.settings, state.textOverlays, state.gifCreated, onSave, onClose]);

  const handleExport = useCallback(async () => {
    if (!state.gifCreated) {
      alert('Please create the GIF first');
      return;
    }
    setState(prev => ({ ...prev, isProcessing: true, processingMessage: 'Exporting...' }));
    try {
      await onExport(state.selection, state.settings, state.textOverlays);
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      setState(prev => ({ ...prev, isProcessing: false, processingMessage: '' }));
    }
  }, [state.selection, state.settings, state.textOverlays, state.gifCreated, onExport, onClose]);

  // Preview animation
  useEffect(() => {
    if (state.isPlaying && state.extractedFrames && state.extractedFrames.length > 0) {
      const frameDelay = 1000 / state.settings.frameRate;
      let lastTime = performance.now();
      
      const animate = (currentTime: number) => {
        const deltaTime = currentTime - lastTime;
        
        if (deltaTime >= frameDelay) {
          setState(prev => ({
            ...prev,
            currentFrame: (prev.currentFrame + 1) % (prev.extractedFrames?.length || 1)
          }));
          lastTime = currentTime;
        }
        
        if (state.isPlaying) {
          animationRef.current = requestAnimationFrame(animate);
        }
      };
      
      animationRef.current = requestAnimationFrame(animate);
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [state.isPlaying, state.extractedFrames, state.settings.frameRate]);

  // Draw current frame on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !state.extractedFrames || state.extractedFrames.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const frame = state.extractedFrames[state.currentFrame];
    const imageData = new ImageData(
      new Uint8ClampedArray(frame.data),
      frame.width,
      frame.height
    );
    
    canvas.width = frame.width;
    canvas.height = frame.height;
    ctx.putImageData(imageData, 0, 0);
  }, [state.currentFrame, state.extractedFrames]);

  // File size estimation
  const estimatedFileSize = useMemo(() => {
    const pixels = state.settings.width * state.settings.height;
    const frameCount = Math.floor(state.selection.duration * state.settings.frameRate);
    
    let sizeInBytes = 0;
    
    switch (state.settings.format) {
      case 'gif': {
        const qualityMultiplier = { low: 0.3, medium: 0.5, high: 0.8 }[state.settings.quality];
        sizeInBytes = pixels * frameCount * qualityMultiplier;
        break;
      }
    }
    
    return sizeInBytes / (1024 * 1024); // Convert to MB
  }, [state.settings, state.selection.duration]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
    
    return `${secs}.${ms.toString().padStart(2, '0')}s`;
  };

  return (
    <div 
      ref={overlayRef}
      className={`ytgif-unified-overlay ${className}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ytgif-unified-title"
    >
      <div className="ytgif-unified-container">
        <header className="ytgif-unified-header">
          <h2 id="ytgif-unified-title">Create GIF from Video</h2>
          <button
            className="ytgif-unified-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </header>

        {/* Timeline Section */}
        <div className="ytgif-unified-timeline-section">
          <QuickPresets
            videoDuration={videoDuration}
            currentTime={currentTime}
            onPresetSelect={(selection) => handleSelectionChange(selection)}
            disabled={state.isProcessing}
          />
          
          <TimelineMarkers
            videoDuration={videoDuration}
            currentTime={currentTime}
            selection={state.selection}
            onSelectionChange={handleSelectionChange}
            onSeekTo={onSeekTo}
          />
          
          <div className="ytgif-unified-timeline-info">
            <span className="ytgif-unified-duration">
              Duration: {state.selection.duration.toFixed(1)}s
            </span>
            <span className="ytgif-unified-range">
              {formatTime(state.selection.startTime)} - {formatTime(state.selection.endTime)}
            </span>
          </div>
        </div>

        {/* Main Content */}
        <div className="ytgif-unified-content">
          {/* Preview Panel */}
          <div className="ytgif-unified-preview">
            <div className="ytgif-unified-preview-wrapper">
              {state.extractedFrames ? (
                <>
                  <canvas ref={canvasRef} className="ytgif-unified-canvas" />
                  <div className="ytgif-unified-preview-controls">
                    <button
                      className="ytgif-unified-play-btn"
                      onClick={() => setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                    >
                      {state.isPlaying ? '⏸' : '▶️'}
                    </button>
                    <div className="ytgif-unified-frame-info">
                      Frame {state.currentFrame + 1} / {state.extractedFrames.length}
                    </div>
                  </div>
                </>
              ) : (
                <div className="ytgif-unified-preview-placeholder">
                  {state.isExtracting ? (
                    <div className="ytgif-unified-extracting">
                      <div className="ytgif-unified-spinner"></div>
                      <span>Extracting frames...</span>
                    </div>
                  ) : (
                    <div className="ytgif-unified-preview-message">
                      <span className="ytgif-unified-preview-icon">🎬</span>
                      <span>Preview will appear here</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Settings Panel */}
          <div className="ytgif-unified-settings">

            {/* Quality Control */}
            <div className="ytgif-unified-control-group">
              <label className="ytgif-unified-label">Quality</label>
              <div className="ytgif-unified-quality-options">
                {(['low', 'medium', 'high'] as const).map((quality) => (
                  <button
                    key={quality}
                    className={`ytgif-unified-quality-btn ${state.settings.quality === quality ? 'active' : ''}`}
                    onClick={() => handleSettingsChange({ quality })}
                    disabled={state.isProcessing}
                  >
                    {quality.charAt(0).toUpperCase() + quality.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Resolution Control */}
            <div className="ytgif-unified-control-group">
              <label className="ytgif-unified-label">Resolution</label>
              <div className="ytgif-unified-resolution-options">
                <div className="ytgif-unified-resolution-presets">
                  {[
                    { width: 480, height: 270, label: '480p' },
                    { width: 640, height: 360, label: '360p' },
                    { width: 1280, height: 720, label: '720p' }
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      className={`ytgif-unified-resolution-btn ${
                        state.settings.width === preset.width && state.settings.height === preset.height ? 'active' : ''
                      }`}
                      onClick={() => handleSettingsChange({ width: preset.width, height: preset.height })}
                      disabled={state.isProcessing}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="ytgif-unified-resolution-custom">
                  <input
                    type="number"
                    value={state.settings.width}
                    onChange={(e) => handleSettingsChange({ width: parseInt(e.target.value) || 640 })}
                    disabled={state.isProcessing}
                    min="100"
                    max="1920"
                    className="ytgif-unified-input"
                  />
                  <span>×</span>
                  <input
                    type="number"
                    value={state.settings.height}
                    onChange={(e) => handleSettingsChange({ height: parseInt(e.target.value) || 360 })}
                    disabled={state.isProcessing}
                    min="100"
                    max="1080"
                    className="ytgif-unified-input"
                  />
                </div>
              </div>
            </div>

            {/* Frame Rate Control */}
            <div className="ytgif-unified-control-group">
              <label className="ytgif-unified-label">
                Frame Rate: {state.settings.frameRate} fps
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={state.settings.frameRate}
                onChange={(e) => handleSettingsChange({ frameRate: parseInt(e.target.value) })}
                disabled={state.isProcessing}
                className="ytgif-unified-slider"
              />
              <div className="ytgif-unified-fps-presets">
                {[10, 15, 20, 25].map((fps) => (
                  <button
                    key={fps}
                    className={`ytgif-unified-fps-btn ${state.settings.frameRate === fps ? 'active' : ''}`}
                    onClick={() => handleSettingsChange({ frameRate: fps })}
                    disabled={state.isProcessing}
                  >
                    {fps}
                  </button>
                ))}
              </div>
            </div>

            {/* Loop Control */}
            <div className="ytgif-unified-control-group">
              <label className="ytgif-unified-checkbox-label">
                <input
                  type="checkbox"
                  checked={state.settings.loop}
                  onChange={(e) => handleSettingsChange({ loop: e.target.checked })}
                  disabled={state.isProcessing}
                  className="ytgif-unified-checkbox"
                />
                <span>Loop animation</span>
              </label>
            </div>

          </div>
        </div>

        {/* Progress Bar */}
        {state.isProcessing && (
          <div className="ytgif-unified-progress-container">
            <div className="ytgif-unified-progress-bar">
              <div 
                className="ytgif-unified-progress-fill"
                style={{ width: `${state.processingProgress}%` }}
              />
            </div>
            <div className="ytgif-unified-progress-text">
              {state.processingMessage} {state.processingProgress > 0 && `(${Math.round(state.processingProgress)}%)`}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="ytgif-unified-footer">
          <div className="ytgif-unified-footer-info">
            <span className="ytgif-unified-duration-badge">
              {state.selection.duration.toFixed(1)}s
            </span>
            <span className="ytgif-unified-size-estimate">
              ~{estimatedFileSize.toFixed(1)}MB
            </span>
            {estimatedFileSize > 10 && (
              <span className="ytgif-unified-size-warning" title="Large file size may affect performance">
                ⚠️
              </span>
            )}
          </div>
          
          <div className="ytgif-unified-footer-actions">
            <button
              className="ytgif-unified-btn ytgif-unified-btn-cancel"
              onClick={onClose}
              disabled={state.isProcessing}
            >
              Cancel
            </button>
            {!state.gifCreated ? (
              <button
                className="ytgif-unified-btn ytgif-unified-btn-create"
                onClick={handleCreateGif}
                disabled={state.isProcessing || state.selection.duration < 0.5 || !state.extractedFrames}
              >
                {state.isProcessing ? state.processingMessage : 'Create GIF'}
              </button>
            ) : (
              <>
                <button
                  className="ytgif-unified-btn ytgif-unified-btn-save"
                  onClick={handleSave}
                  disabled={state.isProcessing}
                >
                  {state.isProcessing && state.processingMessage.includes('Saving') 
                    ? state.processingMessage 
                    : 'Save to Library'
                  }
                </button>
                <button
                  className="ytgif-unified-btn ytgif-unified-btn-export"
                  onClick={handleExport}
                  disabled={state.isProcessing}
                >
                  {state.isProcessing && state.processingMessage.includes('Export') 
                    ? state.processingMessage 
                    : `Export ${state.settings.format.toUpperCase()}`
                  }
                </button>
              </>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
};