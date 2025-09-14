import React, { useCallback } from 'react';
import { TimelineSelection, TextOverlay } from '@/types';
import OverlayWizard from './overlay-wizard/OverlayWizard';

export interface TimelineOverlayWizardProps {
  videoDuration: number;
  currentTime: number;
  videoTitle?: string;
  videoElement?: HTMLVideoElement;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClose: () => void;
  onCreateGif: (selection: TimelineSelection, textOverlays?: TextOverlay[]) => void;
  onSeekTo?: (time: number) => void;
  isCreating?: boolean;
  processingStatus?: {
    stage: string;
    progress: number;
    message: string;
  };
  gifData?: {
    dataUrl: string;
    size: number;
    metadata: any;
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
  isCreating = false,
  processingStatus,
  gifData
}) => {
  const handleSelectionChange = useCallback((newSelection: TimelineSelection) => {
    onSelectionChange(newSelection);
  }, [onSelectionChange]);

  const handleCreateGif = useCallback((finalSelection: TimelineSelection, textOverlays?: TextOverlay[]) => {
    
    handleSelectionChange(finalSelection);
    onCreateGif(finalSelection, textOverlays);
  }, [handleSelectionChange, onCreateGif]);

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
      isCreating={isCreating}
      processingStatus={processingStatus}
      gifData={gifData}
    />
  );
};

export default TimelineOverlayWizard;