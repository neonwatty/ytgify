import React, { useEffect } from 'react';
import { TimelineSelection, TextOverlay } from '@/types';
import { useOverlayNavigation } from './hooks/useOverlayNavigation';
import FeedbackScreen from './screens/FeedbackScreen';
import QuickCaptureScreen from './screens/QuickCaptureScreen';
import TextOverlayScreenV2 from './screens/TextOverlayScreenV2';
import ProcessingScreen from './screens/ProcessingScreen';
import SuccessScreen from './screens/SuccessScreen';

interface OverlayWizardProps {
  videoDuration: number;
  currentTime: number;
  videoTitle?: string;
  videoElement?: HTMLVideoElement;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClose: () => void;
  onCreateGif: (
    selection: TimelineSelection,
    textOverlays?: TextOverlay[],
    resolution?: string
  ) => void;
  onSeekTo?: (time: number) => void;
  isCreating?: boolean;
  processingStatus?: {
    stage: string;
    stageNumber: number;
    totalStages: number;
    progress: number;
    message: string;
  };
  gifData?: {
    dataUrl: string;
    size: number;
    metadata: unknown;
  };
}

const OverlayWizard: React.FC<OverlayWizardProps> = ({
  videoDuration,
  currentTime,
  videoTitle,
  videoElement,
  onSelectionChange,
  onClose,
  onCreateGif,
  onSeekTo,
  isCreating: _isCreating = false,
  processingStatus,
  gifData,
}) => {
  const navigation = useOverlayNavigation('quick-capture');
  const { currentScreen, data, goToScreen, goBack, setScreenData } = navigation;

  // Initialize with video data
  useEffect(() => {
    setScreenData({
      videoDuration,
      currentTime,
      videoTitle,
    });
  }, [videoDuration, currentTime, videoTitle, setScreenData]);

  // Initialize with default time range when starting with quick-capture
  React.useEffect(() => {
    if (currentScreen === 'quick-capture' && !data.startTime && !data.endTime) {
      const startTime = currentTime;
      const endTime = Math.min(videoDuration, currentTime + 10);
      setScreenData({ startTime, endTime });
    }
  }, [currentScreen, currentTime, videoDuration, data.startTime, data.endTime, setScreenData]);

  const handleConfirmQuickCapture = (
    startTime: number,
    endTime: number,
    frameRate?: number,
    resolution?: string
  ) => {
    const selection: TimelineSelection = {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
    // Update the data state with the final selection, frame rate, and resolution
    setScreenData({
      startTime,
      endTime,
      frameRate: frameRate || 10,
      resolution: resolution || '144p',
    });
    onSelectionChange(selection);
    // Go to text overlay screen instead of processing

    goToScreen('text-overlay');
  };

  // Store GIF data when it's created and transition to success
  React.useEffect(() => {
    if (gifData && gifData.dataUrl) {
      // Store the data
      const newData = {
        gifDataUrl: gifData.dataUrl,
        gifSize: gifData.size,
        gifMetadata: gifData.metadata,
      };

      setScreenData(newData);

      // Only transition if we're still on processing screen
      if (currentScreen === 'processing') {
        // Small delay to ensure state is updated
        setTimeout(() => {
          goToScreen('success');
        }, 100);
      }
    }
  }, [gifData, currentScreen, setScreenData, goToScreen]); // Add back required dependencies

  // Add handlers for text overlay screen
  const handleConfirmTextOverlay = (overlays: TextOverlay[]) => {
    setScreenData({ textOverlays: overlays });
    const selection: TimelineSelection = {
      startTime: data.startTime || 0,
      endTime: data.endTime || 10,
      duration: (data.endTime || 10) - (data.startTime || 0),
    };

    onCreateGif(selection, overlays, data.resolution);
    goToScreen('processing');
  };

  const handleSkipTextOverlay = () => {
    const selection: TimelineSelection = {
      startTime: data.startTime || 0,
      endTime: data.endTime || 10,
      duration: (data.endTime || 10) - (data.startTime || 0),
    };
    onCreateGif(selection, [], data.resolution);
    goToScreen('processing');
  };

  // Progress dots for navigation indicator
  const screens = ['capture', 'text', 'processing', 'success', 'feedback'];
  const currentIndex =
    currentScreen === 'quick-capture'
      ? 0
      : currentScreen === 'text-overlay'
        ? 1
        : currentScreen === 'processing'
          ? 2
          : currentScreen === 'success'
            ? 3
            : currentScreen === 'feedback'
              ? 4
              : 0;

  // Debug logging
  React.useEffect(() => {}, [currentScreen]);

  return (
    <div className="ytgif-overlay-wizard" role="dialog" aria-modal="true">
      <div className="ytgif-wizard-container">
        {/* Fixed header with progress indicator */}
        <div className="ytgif-wizard-header-container">
          {/* Close button */}
          <button className="ytgif-wizard-close" onClick={onClose} aria-label="Close wizard">
            ×
          </button>

          {/* Progress indicator */}
          <div className="ytgif-wizard-progress">
            {screens.map((_, index) => (
              <div
                key={index}
                className={`ytgif-progress-dot ${index <= currentIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>

        {/* Screen content with transitions */}
        <div className="ytgif-wizard-screens">
          {currentScreen === 'quick-capture' && (
            <QuickCaptureScreen
              startTime={data.startTime || 0}
              endTime={data.endTime || 10}
              currentTime={currentTime}
              duration={videoDuration}
              videoElement={videoElement}
              onConfirm={handleConfirmQuickCapture}
              onBack={goBack}
              onSeekTo={onSeekTo}
            />
          )}

          {currentScreen === 'text-overlay' && (
            <TextOverlayScreenV2
              startTime={data.startTime || 0}
              endTime={data.endTime || 4}
              videoDuration={videoDuration}
              videoElement={videoElement}
              textOverlays={data.textOverlays}
              onConfirm={handleConfirmTextOverlay}
              onSkip={handleSkipTextOverlay}
              onBack={goBack}
              onSeekTo={onSeekTo}
            />
          )}

          {currentScreen === 'processing' && (
            <ProcessingScreen
              processingStatus={processingStatus}
              onComplete={() => {
                // Don't transition here - wait for gifData to be available
              }}
              onError={(error) => {
                console.error('GIF creation error:', error);
                // Could show error screen or message
              }}
            />
          )}

          {currentScreen === 'success' && (
            <SuccessScreen
              onDownload={() => {
                // Handle download - this would trigger download from saved GIF
                if (data.gifDataUrl) {
                  const link = document.createElement('a');
                  link.download = `youtube-gif-${Date.now()}.gif`;
                  link.href = data.gifDataUrl;
                  link.click();
                }
              }}
              onBack={() => {
                // Go back to quick capture screen to create another GIF
                goToScreen('quick-capture');
              }}
              onFeedback={() => {
                // Go to feedback screen
                goToScreen('feedback');
              }}
              onClose={onClose}
              gifSize={data.gifSize}
              gifDataUrl={data.gifDataUrl}
              gifMetadata={data.gifMetadata}
            />
          )}

          {currentScreen === 'feedback' && (
            <FeedbackScreen
              onBack={() => {
                // Go back to success screen
                goToScreen('success');
              }}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OverlayWizard;
