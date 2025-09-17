import React, { useState, useEffect } from 'react';
import { TimelineOverlay, TimelineOverlayProps } from './timeline-overlay';

type TimelineOverlayWrapperProps = TimelineOverlayProps;

export const TimelineOverlayWrapper: React.FC<TimelineOverlayWrapperProps> = (props) => {
  const [processingStatus, setProcessingStatus] = useState(props.processingStatus);
  const [isCreating, setIsCreating] = useState(props.isCreating);

  // Listen for progress updates via custom event
  useEffect(() => {
    const handleProgressUpdate = (event: CustomEvent) => {
      const { stage, progress, message } = event.detail;
      
      setProcessingStatus({
        stage,
        progress,
        message
      });
    };

    const handleCreatingStateChange = (event: CustomEvent) => {
      
      setIsCreating(event.detail.isCreating);
      if (!event.detail.isCreating) {
        // Clear status when done
        setProcessingStatus(undefined);
      }
    };

    window.addEventListener('ytgif-progress-update', handleProgressUpdate as EventListener);
    window.addEventListener('ytgif-creating-state', handleCreatingStateChange as EventListener);

    return () => {
      window.removeEventListener('ytgif-progress-update', handleProgressUpdate as EventListener);
      window.removeEventListener('ytgif-creating-state', handleCreatingStateChange as EventListener);
    };
  }, []);

  // Update when props change
  useEffect(() => {
    setProcessingStatus(props.processingStatus);
  }, [props.processingStatus]);

  useEffect(() => {
    setIsCreating(props.isCreating);
  }, [props.isCreating]);

  return (
    <TimelineOverlay
      {...props}
      processingStatus={processingStatus}
      isCreating={isCreating}
    />
  );
};