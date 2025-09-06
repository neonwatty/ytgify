import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TextOverlay, TimelineSelection } from '@/types';

// Export format types
export type ExportFormat = 'gif' | 'webp' | 'mp4';

interface EditorGifSettings {
  frameRate: number;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
  format: ExportFormat;
  // WebP specific
  webpQuality?: number;
  // MP4 specific
  mp4Bitrate?: number;
}

export interface EditorOverlayProps {
  videoUrl: string;
  selection: TimelineSelection;
  frames?: ImageData[];
  videoDuration: number;
  currentTime: number;
  onClose: () => void;
  onSave: (settings: EditorGifSettings, textOverlays: TextOverlay[]) => void;
  onExport: (settings: EditorGifSettings, textOverlays: TextOverlay[]) => void;
  onFramesRequest?: () => void;
  isProcessing?: boolean;
  className?: string;
}

interface EditorState {
  settings: EditorGifSettings;
  textOverlays: TextOverlay[];
  currentFrame: number;
  isPlaying: boolean;
  selectedTextOverlay: string | null;
  showAdvanced: boolean;
}

interface EnhancedTextOverlay extends TextOverlay {
  backgroundColor?: string;
  startTime?: number;
  endTime?: number;
}

// Format selector component
const FormatSelector: React.FC<{
  value: ExportFormat;
  onChange: (format: ExportFormat) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const formats = [
    { 
      value: 'gif' as ExportFormat, 
      label: 'GIF', 
      description: 'Universal compatibility',
      icon: '🎬'
    },
    { 
      value: 'webp' as ExportFormat, 
      label: 'WebP', 
      description: '25-35% smaller files',
      icon: '🖼️'
    },
    { 
      value: 'mp4' as ExportFormat, 
      label: 'MP4', 
      description: 'Best compression',
      icon: '📹'
    }
  ];

  return (
    <div className="ytgif-editor-control">
      <label className="ytgif-editor-control-label">Export Format</label>
      <div className="ytgif-editor-format-options">
        {formats.map((format) => (
          <button
            key={format.value}
            className={`ytgif-editor-format-option ${value === format.value ? 'active' : ''}`}
            onClick={() => onChange(format.value)}
            disabled={disabled || (format.value === 'mp4')} // MP4 coming soon
            title={format.description}
          >
            <span className="ytgif-editor-format-icon">{format.icon}</span>
            <span className="ytgif-editor-format-label">{format.label}</span>
            {format.value === 'mp4' && (
              <span className="ytgif-editor-format-badge">Soon</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

// Enhanced quality control with format-specific options
const QualityControl: React.FC<{
  settings: EditorGifSettings;
  onChange: (updates: Partial<EditorGifSettings>) => void;
  disabled?: boolean;
}> = ({ settings, onChange, disabled }) => {
  const qualities: Array<{ value: EditorGifSettings['quality']; label: string; description: string }> = [
    { value: 'low', label: 'Low', description: 'Smaller file, faster' },
    { value: 'medium', label: 'Medium', description: 'Balanced' },
    { value: 'high', label: 'High', description: 'Best quality' }
  ];

  return (
    <div className="ytgif-editor-control">
      <label className="ytgif-editor-control-label">Quality</label>
      <div className="ytgif-editor-quality-options">
        {qualities.map((quality) => (
          <button
            key={quality.value}
            className={`ytgif-editor-quality-option ${settings.quality === quality.value ? 'active' : ''}`}
            onClick={() => onChange({ quality: quality.value })}
            disabled={disabled}
            title={quality.description}
          >
            {quality.label}
          </button>
        ))}
      </div>
      
      {settings.format === 'webp' && (
        <div className="ytgif-editor-quality-advanced">
          <label className="ytgif-editor-control-sublabel">WebP Quality</label>
          <div className="ytgif-editor-quality-slider">
            <input
              type="range"
              min="60"
              max="100"
              value={settings.webpQuality || 85}
              onChange={(e) => onChange({ webpQuality: parseInt(e.target.value) })}
              disabled={disabled}
              className="ytgif-editor-slider"
            />
            <span className="ytgif-editor-quality-value">{settings.webpQuality || 85}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Enhanced resolution control with "Original" option
const ResolutionControl: React.FC<{
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
  disabled?: boolean;
  originalWidth?: number;
  originalHeight?: number;
}> = ({ width, height, onChange, disabled, originalWidth = 1920, originalHeight = 1080 }) => {
  const presets = [
    { width: originalWidth, height: originalHeight, label: 'Original' },
    { width: 1280, height: 720, label: '720p' },
    { width: 854, height: 480, label: '480p' },
    { width: 640, height: 360, label: '360p' }
  ];

  return (
    <div className="ytgif-editor-control">
      <label className="ytgif-editor-control-label">Resolution</label>
      <div className="ytgif-editor-resolution-options">
        {presets.map((preset) => (
          <button
            key={preset.label}
            className={`ytgif-editor-resolution-option ${
              width === preset.width && height === preset.height ? 'active' : ''
            }`}
            onClick={() => onChange(preset.width, preset.height)}
            disabled={disabled}
          >
            {preset.label}
            {preset.label === 'Original' && (
              <span className="ytgif-editor-resolution-size">
                {preset.width}×{preset.height}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="ytgif-editor-resolution-custom">
        <input
          type="number"
          value={width}
          onChange={(e) => onChange(parseInt(e.target.value) || width, height)}
          disabled={disabled}
          min="100"
          max="1920"
          className="ytgif-editor-input"
        />
        <span>×</span>
        <input
          type="number"
          value={height}
          onChange={(e) => onChange(width, parseInt(e.target.value) || height)}
          disabled={disabled}
          min="100"
          max="1080"
          className="ytgif-editor-input"
        />
      </div>
    </div>
  );
};

// Enhanced frame rate control with visual feedback
const FrameRateControl: React.FC<{
  value: number;
  onChange: (frameRate: number) => void;
  disabled?: boolean;
  duration: number;
}> = ({ value, onChange, disabled, duration }) => {
  const presets = [5, 10, 15, 20, 25, 30];
  const frameCount = Math.floor(duration * value);

  return (
    <div className="ytgif-editor-control">
      <label className="ytgif-editor-control-label">
        Frame Rate
        <span className="ytgif-editor-label-info">({frameCount} frames total)</span>
      </label>
      <div className="ytgif-editor-framerate-slider">
        <input
          type="range"
          min="5"
          max="30"
          step="1"
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          disabled={disabled}
          className="ytgif-editor-slider"
        />
        <span className="ytgif-editor-framerate-value">{value} fps</span>
      </div>
      <div className="ytgif-editor-framerate-presets">
        {presets.map((fps) => (
          <button
            key={fps}
            className={`ytgif-editor-framerate-preset ${value === fps ? 'active' : ''}`}
            onClick={() => onChange(fps)}
            disabled={disabled}
            title={`${Math.floor(duration * fps)} frames`}
          >
            {fps}
          </button>
        ))}
      </div>
      <div className="ytgif-editor-framerate-hint">
        {value <= 10 && <span className="hint-low">⚡ Fast processing, smaller file</span>}
        {value > 10 && value <= 20 && <span className="hint-medium">⚖️ Balanced quality</span>}
        {value > 20 && <span className="hint-high">✨ Smooth animation, larger file</span>}
      </div>
    </div>
  );
};

// Enhanced preview canvas with controls
interface PreviewCanvasProps {
  frames: ImageData[] | undefined;
  currentFrame: number;
  settings: EditorGifSettings;
  textOverlays: EnhancedTextOverlay[];
  onFrameChange: (frame: number) => void;
  isPlaying: boolean;
  onPlayToggle: () => void;
}

const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  frames,
  currentFrame,
  settings,
  textOverlays,
  onFrameChange,
  isPlaying,
  onPlayToggle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);

  const drawFrame = useCallback((frameIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas || !frames || frames.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame = frames[frameIndex];
    if (!frame) return;

    canvas.width = settings.width;
    canvas.height = settings.height;

    const imageData = ctx.createImageData(frame.width, frame.height);
    imageData.data.set(frame.data);
    ctx.putImageData(imageData, 0, 0);

    textOverlays.forEach((overlay: EnhancedTextOverlay) => {
      ctx.font = `${overlay.fontSize}px ${overlay.fontFamily}`;
      ctx.fillStyle = overlay.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const x = (overlay.position.x / 100) * canvas.width;
      const y = (overlay.position.y / 100) * canvas.height;
      
      if (overlay.backgroundColor) {
        const metrics = ctx.measureText(overlay.text);
        const padding = 10;
        ctx.fillStyle = overlay.backgroundColor;
        ctx.fillRect(
          x - metrics.width / 2 - padding,
          y - overlay.fontSize / 2 - padding,
          metrics.width + padding * 2,
          overlay.fontSize + padding * 2
        );
        ctx.fillStyle = overlay.color;
      }
      
      ctx.fillText(overlay.text, x, y);
    });
  }, [frames, settings.width, settings.height, textOverlays]);

  const animate = useCallback((timestamp: number) => {
    if (!frames || frames.length === 0) return;

    const frameDelay = 1000 / settings.frameRate;
    
    if (timestamp - lastFrameTimeRef.current >= frameDelay) {
      const nextFrame = (currentFrame + 1) % frames.length;
      onFrameChange(nextFrame);
      drawFrame(nextFrame);
      lastFrameTimeRef.current = timestamp;
    }

    if (isPlaying) {
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [frames, settings.frameRate, currentFrame, onFrameChange, drawFrame, isPlaying]);

  useEffect(() => {
    if (isPlaying && frames && frames.length > 0) {
      animationRef.current = requestAnimationFrame(animate);
    } else if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying, animate, frames]);

  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  return (
    <div className="ytgif-editor-preview">
      <canvas
        ref={canvasRef}
        className="ytgif-editor-canvas"
        style={{
          maxWidth: '100%',
          maxHeight: '400px',
          width: 'auto',
          height: 'auto',
          objectFit: 'contain'
        }}
      />
      {!frames && (
        <div className="ytgif-editor-preview-placeholder">
          <div className="ytgif-editor-preview-message">
            <span className="ytgif-editor-preview-icon">🎬</span>
            <span>Click "Extract Frames" to generate preview</span>
          </div>
        </div>
      )}
      
      <div className="ytgif-editor-preview-controls">
        <button
          className={`ytgif-editor-play-button ${isPlaying ? 'playing' : ''}`}
          onClick={onPlayToggle}
          disabled={!frames || frames.length === 0}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        {settings.loop && isPlaying && (
          <span className="ytgif-editor-loop-indicator" title="Looping enabled">
            🔄
          </span>
        )}

        {frames && frames.length > 0 && (
          <div className="ytgif-editor-frame-slider">
            <input
              type="range"
              min="0"
              max={frames.length - 1}
              value={currentFrame}
              onChange={(e) => onFrameChange(parseInt(e.target.value))}
              className="ytgif-editor-slider"
            />
            <span className="ytgif-editor-frame-info">
              Frame {currentFrame + 1} / {frames.length}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

// Main enhanced editor component
export const EditorOverlayEnhanced: React.FC<EditorOverlayProps> = ({
  videoUrl: _videoUrl,
  selection,
  frames,
  videoDuration: _videoDuration,
  currentTime: _currentTime,
  onClose,
  onSave,
  onExport,
  onFramesRequest,
  isProcessing = false,
  className = ''
}) => {
  const [state, setState] = useState<EditorState>({
    settings: {
      frameRate: 15,
      width: 640,
      height: 360,
      quality: 'medium',
      loop: true,
      format: 'gif',
      webpQuality: 85,
      mp4Bitrate: 2000000
    },
    textOverlays: [],
    currentFrame: 0,
    isPlaying: false,
    selectedTextOverlay: null,
    showAdvanced: false
  });

  const handleFrameChange = useCallback((frame: number) => {
    setState(prev => ({ ...prev, currentFrame: frame }));
  }, []);

  const handlePlayToggle = useCallback(() => {
    setState(prev => ({ ...prev, isPlaying: !prev.isPlaying }));
  }, []);

  const handleSettingsChange = useCallback((updates: Partial<EditorGifSettings>) => {
    setState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...updates }
    }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(state.settings, state.textOverlays);
  }, [state.settings, state.textOverlays, onSave]);

  const handleExport = useCallback(() => {
    onExport(state.settings, state.textOverlays);
  }, [state.settings, state.textOverlays, onExport]);

  // Enhanced file size estimation
  const estimatedFileSize = useMemo(() => {
    const pixels = state.settings.width * state.settings.height;
    const frameCount = Math.floor(selection.duration * state.settings.frameRate);
    
    let sizeInBytes = 0;
    
    switch (state.settings.format) {
      case 'gif': {
        const qualityMultiplier = { low: 0.3, medium: 0.5, high: 0.8 }[state.settings.quality];
        sizeInBytes = pixels * frameCount * qualityMultiplier;
        break;
      }
      case 'webp': {
        const webpQuality = state.settings.webpQuality || 85;
        const qualityFactor = (100 - webpQuality) / 100;
        sizeInBytes = pixels * frameCount * 0.3 * (1 - qualityFactor);
        break;
      }
      case 'mp4': {
        const bitrate = state.settings.mp4Bitrate || 2000000;
        sizeInBytes = (bitrate * selection.duration) / 8;
        break;
      }
    }
    
    const mb = (sizeInBytes / 1024 / 1024).toFixed(1);
    return parseFloat(mb) < 0.1 ? '<0.1' : mb;
  }, [state.settings, selection.duration]);

  return (
    <div className={`ytgif-editor-overlay-enhanced ${className}`}>
      <div className="ytgif-editor-container">
        <header className="ytgif-editor-header">
          <h2 className="ytgif-editor-title">
            GIF Editor
            {state.settings.format !== 'gif' && (
              <span className="ytgif-editor-format-badge">{state.settings.format.toUpperCase()}</span>
            )}
          </h2>
          <button
            className="ytgif-editor-close"
            onClick={onClose}
            aria-label="Close editor"
          >
            ×
          </button>
        </header>

        <div className="ytgif-editor-body">
          <div className="ytgif-editor-preview-section">
            <PreviewCanvas
              frames={frames}
              currentFrame={state.currentFrame}
              settings={state.settings}
              textOverlays={state.textOverlays}
              onFrameChange={handleFrameChange}
              isPlaying={state.isPlaying}
              onPlayToggle={handlePlayToggle}
            />

            {!frames && onFramesRequest && (
              <button
                className="ytgif-editor-extract-button"
                onClick={onFramesRequest}
                disabled={isProcessing}
              >
                {isProcessing ? 'Extracting...' : 'Extract Frames'}
              </button>
            )}
          </div>

          <div className="ytgif-editor-controls-section">
            <div className="ytgif-editor-controls-group">
              <FormatSelector
                value={state.settings.format}
                onChange={(format) => handleSettingsChange({ format })}
                disabled={isProcessing}
              />

              <QualityControl
                settings={state.settings}
                onChange={handleSettingsChange}
                disabled={isProcessing}
              />

              <ResolutionControl
                width={state.settings.width}
                height={state.settings.height}
                onChange={(width, height) => handleSettingsChange({ width, height })}
                disabled={isProcessing}
              />

              <FrameRateControl
                value={state.settings.frameRate}
                onChange={(frameRate) => handleSettingsChange({ frameRate })}
                disabled={isProcessing}
                duration={selection.duration}
              />

              <div className="ytgif-editor-control">
                <label className="ytgif-editor-control-label">Loop</label>
                <label className="ytgif-editor-checkbox-label">
                  <input
                    type="checkbox"
                    checked={state.settings.loop}
                    onChange={(e) => handleSettingsChange({ loop: e.target.checked })}
                    disabled={isProcessing || state.settings.format === 'mp4'}
                    className="ytgif-editor-checkbox"
                  />
                  <span>Loop forever</span>
                  {state.settings.format === 'mp4' && (
                    <span className="ytgif-editor-checkbox-hint">Not available for MP4</span>
                  )}
                </label>
              </div>
            </div>

            <div className="ytgif-editor-info">
              <div className="ytgif-editor-info-item">
                <span>📏 Duration:</span>
                <strong>{selection.duration.toFixed(1)}s</strong>
              </div>
              <div className="ytgif-editor-info-item">
                <span>💾 Est. Size:</span>
                <strong className={parseFloat(estimatedFileSize) > 10 ? 'warning' : ''}>
                  ~{estimatedFileSize} MB
                </strong>
              </div>
              <div className="ytgif-editor-info-item">
                <span>🎞️ Frames:</span>
                <strong>{Math.floor(selection.duration * state.settings.frameRate)}</strong>
              </div>
              <div className="ytgif-editor-info-item">
                <span>📐 Output:</span>
                <strong>{state.settings.width}×{state.settings.height}</strong>
              </div>
            </div>
          </div>
        </div>

        <footer className="ytgif-editor-footer">
          <div className="ytgif-editor-footer-left">
            {parseFloat(estimatedFileSize) > 10 && (
              <span className="ytgif-editor-warning">
                ⚠️ Large file size may affect performance
              </span>
            )}
          </div>
          <div className="ytgif-editor-footer-right">
            <button
              className="ytgif-editor-button ytgif-editor-button-secondary"
              onClick={handleSave}
              disabled={isProcessing}
            >
              Save to Library
            </button>
            <button
              className="ytgif-editor-button ytgif-editor-button-primary"
              onClick={handleExport}
              disabled={isProcessing}
            >
              {isProcessing 
                ? 'Processing...' 
                : `Export ${state.settings.format.toUpperCase()}`
              }
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};