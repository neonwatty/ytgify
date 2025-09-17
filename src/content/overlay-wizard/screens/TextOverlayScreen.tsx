import React, { useState, useCallback } from 'react';
import { TextOverlay } from '@/types';
import { TextOverlayEditor } from '@/editor/text/text-overlay-editor';
import { VideoPreview } from '../components/VideoPreview';

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

const TextOverlayScreen: React.FC<TextOverlayScreenProps> = ({
  startTime,
  endTime,
  videoElement,
  textOverlays = [],
  onConfirm,
  onSkip,
  onBack,
  onSeekTo,
}) => {
  const [overlays, setOverlays] = useState<TextOverlay[]>(textOverlays);
  const [previewTime, setPreviewTime] = useState(startTime);

  const handleUpdateOverlays = useCallback((newOverlays: TextOverlay[]) => {
    setOverlays(newOverlays);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(overlays);
  }, [overlays, onConfirm]);

  const handlePreviewSeek = useCallback(
    (time: number) => {
      const clampedTime = Math.max(startTime, Math.min(endTime, time));
      setPreviewTime(clampedTime);
      if (onSeekTo) {
        onSeekTo(clampedTime);
      }
    },
    [startTime, endTime, onSeekTo]
  );

  return (
    <div className="ytgif-wizard-screen ytgif-text-overlay-screen">
      <div className="ytgif-wizard-header">
        <h2 className="ytgif-wizard-title">Add Text</h2>
        <p className="ytgif-wizard-subtitle">
          Add text overlays to enhance your GIF. Drag to position, customize appearance, and add
          animations.
        </p>
      </div>

      <div className="ytgif-text-overlay-container">
        <div className="ytgif-text-preview-section">
          <VideoPreview
            videoElement={videoElement}
            startTime={startTime}
            endTime={endTime}
            currentPreviewTime={previewTime}
            onSeek={handlePreviewSeek}
            showTimeControls={true}
            overlays={overlays}
          />
        </div>

        <div className="ytgif-text-editor-section">
          <TextOverlayEditor
            overlays={overlays}
            onUpdateOverlays={handleUpdateOverlays}
            previewContent={
              <div className="ytgif-text-preview-placeholder">Preview shows above with video</div>
            }
          />
        </div>
      </div>

      <div className="ytgif-wizard-actions">
        {onBack && (
          <button className="ytgif-wizard-btn ytgif-wizard-btn-secondary" onClick={onBack}>
            Back
          </button>
        )}

        <div className="ytgif-wizard-actions-right">
          <button className="ytgif-wizard-btn ytgif-wizard-btn-secondary" onClick={onSkip}>
            Skip Text
          </button>

          <button
            className="ytgif-wizard-btn ytgif-wizard-btn-primary"
            onClick={handleConfirm}
            disabled={overlays.length === 0}
          >
            {overlays.length > 0 ? 'Apply Text' : 'Add Text First'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TextOverlayScreen;
