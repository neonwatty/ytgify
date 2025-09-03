import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { TextOverlay, TimelineSelection } from '@/types';

interface EditorGifSettings {
  frameRate: number;
  width: number;
  height: number;
  quality: 'low' | 'medium' | 'high';
  loop: boolean;
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
}

interface EnhancedTextOverlay extends TextOverlay {
  backgroundColor?: string;
  startTime?: number;
  endTime?: number;
}

interface PreviewCanvasProps {
  frames: ImageData[] | undefined;
  currentFrame: number;
  settings: EditorGifSettings;
  textOverlays: EnhancedTextOverlay[];
  onFrameChange: (frame: number) => void;
  isPlaying: boolean;
}

const PreviewCanvas: React.FC<PreviewCanvasProps> = ({
  frames,
  currentFrame,
  settings,
  textOverlays,
  onFrameChange,
  isPlaying
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
  }, [frames, settings, textOverlays]);

  useEffect(() => {
    drawFrame(currentFrame);
  }, [currentFrame, drawFrame]);

  useEffect(() => {
    if (!isPlaying || !frames || frames.length === 0) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const frameDuration = 1000 / settings.frameRate;
    let frameIndex = currentFrame;

    const animate = (timestamp: number) => {
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const elapsed = timestamp - lastFrameTimeRef.current;

      if (elapsed >= frameDuration) {
        frameIndex = (frameIndex + 1) % frames.length;
        onFrameChange(frameIndex);
        drawFrame(frameIndex);
        lastFrameTimeRef.current = timestamp;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      lastFrameTimeRef.current = 0;
    };
  }, [isPlaying, frames, settings.frameRate, currentFrame, onFrameChange, drawFrame]);

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
            <span>Click &quot;Extract Frames&quot; to generate preview</span>
          </div>
        </div>
      )}
    </div>
  );
};

const QualityControl: React.FC<{
  value: EditorGifSettings['quality'];
  onChange: (quality: EditorGifSettings['quality']) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
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
            className={`ytgif-editor-quality-option ${value === quality.value ? 'active' : ''}`}
            onClick={() => onChange(quality.value)}
            disabled={disabled}
            title={quality.description}
          >
            {quality.label}
          </button>
        ))}
      </div>
    </div>
  );
};

const ResolutionControl: React.FC<{
  width: number;
  height: number;
  onChange: (width: number, height: number) => void;
  disabled?: boolean;
}> = ({ width, height, onChange, disabled }) => {
  const presets = [
    { width: 320, height: 180, label: '320p' },
    { width: 480, height: 270, label: '480p' },
    { width: 640, height: 360, label: '640p' },
    { width: 854, height: 480, label: '854p' }
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

const FrameRateControl: React.FC<{
  value: number;
  onChange: (frameRate: number) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  const presets = [10, 15, 20, 25, 30];

  return (
    <div className="ytgif-editor-control">
      <label className="ytgif-editor-control-label">Frame Rate</label>
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
          >
            {fps}
          </button>
        ))}
      </div>
    </div>
  );
};

const TextOverlayControl: React.FC<{
  overlays: EnhancedTextOverlay[];
  selectedId: string | null;
  onChange: (overlays: EnhancedTextOverlay[]) => void;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}> = ({ overlays, selectedId, onChange, onSelect, disabled }) => {
  const handleAdd = () => {
    const newOverlay: EnhancedTextOverlay = {
      id: `overlay_${Date.now()}`,
      text: 'New Text',
      position: { x: 50, y: 50 },
      fontSize: 24,
      color: '#FFFFFF',
      fontFamily: 'Arial',
      startTime: 0,
      endTime: -1
    };
    onChange([...overlays, newOverlay]);
    onSelect(newOverlay.id);
  };

  const handleUpdate = (id: string, updates: Partial<EnhancedTextOverlay>) => {
    onChange(overlays.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const handleRemove = (id: string) => {
    onChange(overlays.filter(o => o.id !== id));
    if (selectedId === id) onSelect(null);
  };

  const selectedOverlay = overlays.find(o => o.id === selectedId);

  return (
    <div className="ytgif-editor-control ytgif-editor-text-control">
      <div className="ytgif-editor-control-header">
        <label className="ytgif-editor-control-label">Text Overlays</label>
        <button
          className="ytgif-editor-text-add"
          onClick={handleAdd}
          disabled={disabled}
        >
          + Add Text
        </button>
      </div>

      {overlays.length > 0 && (
        <div className="ytgif-editor-text-list">
          {overlays.map((overlay) => (
            <div
              key={overlay.id}
              className={`ytgif-editor-text-item ${selectedId === overlay.id ? 'selected' : ''}`}
              onClick={() => onSelect(overlay.id)}
            >
              <span className="ytgif-editor-text-preview">{overlay.text}</span>
              <button
                className="ytgif-editor-text-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(overlay.id);
                }}
                disabled={disabled}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {selectedOverlay && (
        <div className="ytgif-editor-text-editor">
          <input
            type="text"
            value={selectedOverlay.text}
            onChange={(e) => handleUpdate(selectedOverlay.id, { text: e.target.value })}
            disabled={disabled}
            className="ytgif-editor-input"
            placeholder="Enter text..."
          />
          <div className="ytgif-editor-text-props">
            <input
              type="color"
              value={selectedOverlay.color}
              onChange={(e) => handleUpdate(selectedOverlay.id, { color: e.target.value })}
              disabled={disabled}
              className="ytgif-editor-color"
            />
            <input
              type="number"
              value={selectedOverlay.fontSize}
              onChange={(e) => handleUpdate(selectedOverlay.id, { fontSize: parseInt(e.target.value) || 24 })}
              disabled={disabled}
              min="10"
              max="72"
              className="ytgif-editor-input ytgif-editor-input-small"
            />
            <select
              value={selectedOverlay.fontFamily}
              onChange={(e) => handleUpdate(selectedOverlay.id, { fontFamily: e.target.value })}
              disabled={disabled}
              className="ytgif-editor-select"
            >
              <option value="Arial">Arial</option>
              <option value="Helvetica">Helvetica</option>
              <option value="Georgia">Georgia</option>
              <option value="Comic Sans MS">Comic Sans</option>
              <option value="monospace">Monospace</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export const EditorOverlay: React.FC<EditorOverlayProps> = ({
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
      loop: true
    },
    textOverlays: [],
    currentFrame: 0,
    isPlaying: false,
    selectedTextOverlay: null
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

  const handleTextOverlaysChange = useCallback((overlays: EnhancedTextOverlay[]) => {
    setState(prev => ({ ...prev, textOverlays: overlays }));
  }, []);

  const handleTextOverlaySelect = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedTextOverlay: id }));
  }, []);

  const handleSave = useCallback(() => {
    onSave(state.settings, state.textOverlays);
  }, [state.settings, state.textOverlays, onSave]);

  const handleExport = useCallback(() => {
    onExport(state.settings, state.textOverlays);
  }, [state.settings, state.textOverlays, onExport]);

  const estimatedFileSize = useMemo(() => {
    const pixels = state.settings.width * state.settings.height;
    const frames = selection.duration * state.settings.frameRate;
    const qualityMultiplier = { low: 0.3, medium: 0.5, high: 0.8 }[state.settings.quality];
    const sizeInBytes = pixels * frames * qualityMultiplier;
    return (sizeInBytes / 1024 / 1024).toFixed(1);
  }, [state.settings, selection.duration]);

  return (
    <div className={`ytgif-editor-overlay ${className}`}>
      <div className="ytgif-editor-container">
        <header className="ytgif-editor-header">
          <h2 className="ytgif-editor-title">GIF Editor</h2>
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
            />

            <div className="ytgif-editor-preview-controls">
              <button
                className="ytgif-editor-play-button"
                onClick={handlePlayToggle}
                disabled={!frames || frames.length === 0}
              >
                {state.isPlaying ? '⏸️' : '▶️'}
              </button>

              {frames && frames.length > 0 && (
                <div className="ytgif-editor-frame-slider">
                  <input
                    type="range"
                    min="0"
                    max={frames.length - 1}
                    value={state.currentFrame}
                    onChange={(e) => handleFrameChange(parseInt(e.target.value))}
                    className="ytgif-editor-slider"
                  />
                  <span className="ytgif-editor-frame-info">
                    {state.currentFrame + 1} / {frames.length}
                  </span>
                </div>
              )}

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
          </div>

          <div className="ytgif-editor-controls-section">
            <div className="ytgif-editor-controls-group">
              <QualityControl
                value={state.settings.quality}
                onChange={(quality) => handleSettingsChange({ quality })}
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
              />

              <TextOverlayControl
                overlays={state.textOverlays}
                selectedId={state.selectedTextOverlay}
                onChange={handleTextOverlaysChange}
                onSelect={handleTextOverlaySelect}
                disabled={isProcessing}
              />

              <div className="ytgif-editor-control">
                <label className="ytgif-editor-control-label">Loop</label>
                <label className="ytgif-editor-checkbox-label">
                  <input
                    type="checkbox"
                    checked={state.settings.loop}
                    onChange={(e) => handleSettingsChange({ loop: e.target.checked })}
                    disabled={isProcessing}
                    className="ytgif-editor-checkbox"
                  />
                  <span>Loop forever</span>
                </label>
              </div>
            </div>

            <div className="ytgif-editor-info">
              <div className="ytgif-editor-info-item">
                <span>Duration:</span>
                <strong>{selection.duration.toFixed(1)}s</strong>
              </div>
              <div className="ytgif-editor-info-item">
                <span>Est. Size:</span>
                <strong>~{estimatedFileSize} MB</strong>
              </div>
              <div className="ytgif-editor-info-item">
                <span>Frames:</span>
                <strong>{Math.floor(selection.duration * state.settings.frameRate)}</strong>
              </div>
            </div>
          </div>
        </div>

        <footer className="ytgif-editor-footer">
          <button
            className="ytgif-editor-button ytgif-editor-button-secondary"
            onClick={handleSave}
            disabled={isProcessing || !frames}
          >
            Save to Library
          </button>
          <button
            className="ytgif-editor-button ytgif-editor-button-primary"
            onClick={handleExport}
            disabled={isProcessing || !frames}
          >
            {isProcessing ? 'Processing...' : 'Export GIF'}
          </button>
        </footer>
      </div>
    </div>
  );
};