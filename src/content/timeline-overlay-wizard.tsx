import React, { useCallback } from 'react';
import { TimelineSelection, TextOverlay } from '@/types';
import OverlayWizard from './overlay-wizard/OverlayWizard';
import { BufferingStatus } from './gif-processor';

interface TimelineOverlayWizardProps {
  videoDuration: number;
  currentTime: number;
  videoTitle?: string;
  videoElement?: HTMLVideoElement;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClose: () => void;
  onCreateGif: (
    selection: TimelineSelection,
    textOverlays?: TextOverlay[],
    resolution?: string,
    frameRate?: number
  ) => void;
  onSeekTo?: (time: number) => void;
  onUploadToCloud?: () => void;
  isCreating?: boolean;
  processingStatus?: {
    stage: string;
    stageNumber: number;
    totalStages: number;
    progress: number;
    message: string;
    bufferingStatus?: BufferingStatus;
  };
  gifData?: {
    dataUrl: string;
    size: number;
    metadata: Record<string, unknown>;
    // Phase 2: Cloud upload status
    uploadStatus?: 'uploading' | 'success' | 'failed' | 'disabled';
    uploadError?: string;
  };
}

export const TimelineOverlayWizard: React.FC<TimelineOverlayWizardProps> = ({
  videoDuration,
  currentTime,
  videoTitle,
  videoElement,
  onSelectionChange,
  onClose,
  onCreateGif,
  onSeekTo,
  onUploadToCloud,
  isCreating = false,
  processingStatus,
  gifData,
}) => {
  const handleSelectionChange = useCallback(
    (newSelection: TimelineSelection) => {
      onSelectionChange(newSelection);
    },
    [onSelectionChange]
  );

  const handleCreateGif = useCallback(
    (finalSelection: TimelineSelection, textOverlays?: TextOverlay[], resolution?: string, frameRate?: number) => {
      handleSelectionChange(finalSelection);
      onCreateGif(finalSelection, textOverlays, resolution, frameRate);
    },
    [handleSelectionChange, onCreateGif]
  );

  return (
    <OverlayWizard
      videoDuration={videoDuration}
      currentTime={currentTime}
      videoTitle={videoTitle}
      videoElement={videoElement}
      onSelectionChange={handleSelectionChange}
      onClose={onClose}
      onCreateGif={handleCreateGif}
      onSeekTo={onSeekTo}
      onUploadToCloud={onUploadToCloud}
      isCreating={isCreating}
      processingStatus={processingStatus}
      gifData={gifData}
    />
  );
};

