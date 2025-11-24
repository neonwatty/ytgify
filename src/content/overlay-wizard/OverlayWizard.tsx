import React, { useEffect } from 'react';
import { TimelineSelection, TextOverlay } from '@/types';
import { useOverlayNavigation } from './hooks/useOverlayNavigation';
import QuickCaptureScreen from './screens/QuickCaptureScreen';
import TextOverlayScreenV2 from './screens/TextOverlayScreenV2';
import ProcessingScreen from './screens/ProcessingScreen';
import SuccessScreen from './screens/SuccessScreen';
import { BufferingStatus } from '../gif-processor';

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
    resolution?: string,
    frameRate?: number
  ) => void;
  onSeekTo?: (time: number) => void;
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
  const { currentScreen, data, goToScreen, goBack, setScreenData, previousScreen} = navigation;

  // Use refs to track navigation state and functions for event listeners
  // This prevents listener re-registration on every state/function change
  const currentScreenRef = React.useRef(currentScreen);
  const previousScreenRef = React.useRef(previousScreen);
  const goToScreenRef = React.useRef(goToScreen);
  const goBackRef = React.useRef(goBack);

  // Keep refs synced with latest values
  React.useEffect(() => {
    currentScreenRef.current = currentScreen;
    previousScreenRef.current = previousScreen;
    goToScreenRef.current = goToScreen;
    goBackRef.current = goBack;
  }, [currentScreen, previousScreen, goToScreen, goBack]);

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
      const endTime = Math.min(videoDuration, currentTime + 5);
      setScreenData({ startTime, endTime });
    }
  }, [currentScreen, currentTime, videoDuration, data.startTime, data.endTime, setScreenData]);

  const handleConfirmQuickCapture = (
    startTime: number,
    endTime: number,
    frameRate?: number,
    resolution?: string
  ) => {
    console.log('[OverlayWizard] handleConfirmQuickCapture - frameRate:', frameRate);
    const selection: TimelineSelection = {
      startTime,
      endTime,
      duration: endTime - startTime,
    };
    // Update the data state with the final selection, frame rate, and resolution
    setScreenData({
      startTime,
      endTime,
      frameRate: frameRate || 5,
      resolution: resolution || '144p',
    });
    onSelectionChange(selection);
    // Go to text overlay screen instead of processing

    goToScreen('text-overlay');
  };

  // Store GIF data when it's created
  React.useEffect(() => {
    if (gifData && gifData.dataUrl) {
      // Store the data
      const newData = {
        gifDataUrl: gifData.dataUrl,
        gifSize: gifData.size,
        gifMetadata: gifData.metadata as
          | {
              width: number;
              height: number;
              duration: number;
              frameCount?: number;
            }
          | undefined,
      };

      setScreenData(newData);

      // Only transition if we're still on processing screen
      if (currentScreen === 'processing') {
        // Go directly to success screen
        setTimeout(() => {
          goToScreen('success');
        }, 100);
      }
    }
  }, [gifData, currentScreen, setScreenData, goToScreen]);

  // Auto-navigate to success when GIF data is available
  React.useEffect(() => {
    if (currentScreen === 'processing' && gifData?.dataUrl) {
      goToScreen('success');
    }
  }, [currentScreen, gifData, goToScreen]);

  // Handle processing cancellation via explicit event (not via isCreating state)
  // This prevents interference with normal back navigation which also sets isCreating to false

  // Listen for explicit cancel events from the content script
  // Uses refs for all values to avoid re-registering listener on any state/function change
  // This prevents race conditions when navigating between screens
  React.useEffect(() => {
    const handler = () => {
      console.log('[OverlayWizard] ytgif-processing-cancelled event received, currentScreen:', currentScreenRef.current);
      if (currentScreenRef.current === 'processing') {
        console.log('[OverlayWizard] Processing screen detected, navigating back. previousScreen:', previousScreenRef.current);
        if (previousScreenRef.current) {
          goBackRef.current();
        } else {
          goToScreenRef.current('quick-capture');
        }
      } else {
        console.log('[OverlayWizard] Not on processing screen, ignoring cancel event');
      }
    };

    console.log('[OverlayWizard] Registering ytgif-processing-cancelled listener');
    window.addEventListener('ytgif-processing-cancelled', handler);
    return () => {
      console.log('[OverlayWizard] Unregistering ytgif-processing-cancelled listener');
      window.removeEventListener('ytgif-processing-cancelled', handler);
    };
  }, []); // Empty deps - register once on mount, access latest values via refs

  // Add handlers for text overlay screen
  const handleConfirmTextOverlay = (overlays: TextOverlay[]) => {
    console.log('[OverlayWizard] handleConfirmTextOverlay called, currentScreen:', currentScreen);
    setScreenData({ textOverlays: overlays });
    const selection: TimelineSelection = {
      startTime: data.startTime || 0,
      endTime: data.endTime || 5,
      duration: (data.endTime || 5) - (data.startTime || 0),
    };

    console.log('[OverlayWizard] handleCreateGif - frameRate:', data.frameRate);
    console.log('[OverlayWizard] About to goToScreen(processing)');
    goToScreen('processing'); // Show processing screen immediately for better UX/resilience
    console.log('[OverlayWizard] Called goToScreen(processing), new screen should be:', 'processing');
    try {
      onCreateGif(selection, overlays, data.resolution, data.frameRate);
    } catch (error) {
      console.error('[OverlayWizard] onCreateGif failed:', error);
      goToScreen('quick-capture');
    }
  };

  const handleSkipTextOverlay = () => {
    const selection: TimelineSelection = {
      startTime: data.startTime || 0,
      endTime: data.endTime || 5,
      duration: (data.endTime || 5) - (data.startTime || 0),
    };
    console.log('[OverlayWizard] handleSkipTextOverlay - frameRate:', data.frameRate);
    console.log('[OverlayWizard] Calling onCreateGif with params:', {
      selection,
      textOverlays: [],
      resolution: data.resolution,
      frameRate: data.frameRate,
    });
    goToScreen('processing'); // Ensure processing screen mounts even if processing is slow
    try {
      onCreateGif(selection, [], data.resolution, data.frameRate);
    } catch (error) {
      console.error('[OverlayWizard] onCreateGif failed:', error);
      goToScreen('quick-capture');
    }
  };

  // Progress dots for navigation indicator
  const screens = ['capture', 'text', 'processing', 'success'];
  const currentIndex =
    currentScreen === 'quick-capture'
      ? 0
      : currentScreen === 'text-overlay'
        ? 1
        : currentScreen === 'processing'
          ? 2
          : currentScreen === 'success'
            ? 3
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
              endTime={data.endTime || 5}
              currentTime={currentTime}
              duration={videoDuration}
              videoElement={videoElement}
              frameRate={data.frameRate}
              resolution={data.resolution}
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
              resolution={data.resolution || '144p'}
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
              onBack={goBack}
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
              onClose={onClose}
              gifSize={data.gifSize}
              gifDataUrl={data.gifDataUrl}
              gifMetadata={data.gifMetadata}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OverlayWizard;
