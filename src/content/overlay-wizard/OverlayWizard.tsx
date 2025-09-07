import React, { useEffect } from 'react';
import { TimelineSelection } from '@/types';
import { useOverlayNavigation } from './hooks/useOverlayNavigation';
import WelcomeScreen from './screens/WelcomeScreen';
import QuickCaptureScreen from './screens/QuickCaptureScreen';
import CustomRangeScreen from './screens/CustomRangeScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import SuccessScreen from './screens/SuccessScreen';

interface OverlayWizardProps {
  videoDuration: number;
  currentTime: number;
  videoTitle?: string;
  videoElement?: HTMLVideoElement;
  onSelectionChange: (selection: TimelineSelection) => void;
  onClose: () => void;
  onCreateGif: (selection: TimelineSelection) => void;
  onSeekTo?: (time: number) => void;
  isCreating?: boolean;
  processingStatus?: {
    stage: string;
    progress: number;
    message: string;
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
  isCreating = false,
  processingStatus
}) => {
  const navigation = useOverlayNavigation('welcome');
  const {
    currentScreen,
    data,
    goToScreen,
    goBack,
    setScreenData
  } = navigation;

  // Initialize with video data
  useEffect(() => {
    setScreenData({
      videoDuration,
      currentTime,
      videoTitle
    });
  }, [videoDuration, currentTime, videoTitle, setScreenData]);

  const handleWelcomeContinue = React.useCallback(() => {
    console.log('[OverlayWizard] handleWelcomeContinue called, going directly to quick-capture');
    // Set up default time range (4 seconds from current position)
    const startTime = Math.max(0, currentTime - 2);
    const endTime = Math.min(videoDuration, currentTime + 2);
    setScreenData({ startTime, endTime });
    goToScreen('quick-capture');
  }, [goToScreen, currentTime, videoDuration, setScreenData]);


  const handleConfirmQuickCapture = (startTime: number, endTime: number) => {
    const selection: TimelineSelection = {
      startTime,
      endTime,
      duration: endTime - startTime
    };
    // Update the data state with the final selection
    setScreenData({ startTime, endTime });
    onSelectionChange(selection);
    onCreateGif(selection);
    goToScreen('processing');
  };

  const handleConfirmCustomRange = (startTime: number, endTime: number) => {
    const selection: TimelineSelection = {
      startTime,
      endTime,
      duration: endTime - startTime
    };
    onSelectionChange(selection);
    onCreateGif(selection);
    goToScreen('processing');
  };

  // Progress dots for navigation indicator
  const screens = ['welcome', 'capture', 'processing', 'success'];
  const currentIndex = currentScreen === 'quick-capture' || currentScreen === 'custom-range' 
    ? 1 
    : currentScreen === 'success' 
    ? 3
    : screens.indexOf(currentScreen);
  
  // Debug logging
  React.useEffect(() => {
    console.log('[OverlayWizard] Current screen:', currentScreen);
  }, [currentScreen]);

  return (
    <div className="ytgif-overlay-wizard" role="dialog" aria-modal="true">
      <div className="ytgif-wizard-container">
        {/* Close button */}
        <button 
          className="ytgif-wizard-close"
          onClick={onClose}
          aria-label="Close wizard"
        >
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

        {/* Screen content with transitions */}
        <div className="ytgif-wizard-screens">
          {currentScreen === 'welcome' && (
            <WelcomeScreen
              videoTitle={videoTitle}
              videoDuration={videoDuration}
              onContinue={handleWelcomeContinue}
              onClose={onClose}
            />
          )}

          {currentScreen === 'quick-capture' && (
            <QuickCaptureScreen
              startTime={data.startTime || 0}
              endTime={data.endTime || 4}
              currentTime={currentTime}
              duration={videoDuration}
              videoElement={videoElement}
              onConfirm={handleConfirmQuickCapture}
              onBack={goBack}
              onSeekTo={onSeekTo}
            />
          )}

          {currentScreen === 'custom-range' && (
            <CustomRangeScreen
              videoDuration={videoDuration}
              currentTime={currentTime}
              onConfirm={handleConfirmCustomRange}
              onBack={goBack}
              onSeekTo={onSeekTo}
            />
          )}

          {currentScreen === 'processing' && (
            <ProcessingScreen
              processingStatus={processingStatus}
              onComplete={() => goToScreen('success')}
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
                console.log('Download GIF');
                // TODO: Implement actual download functionality
              }}
              onBack={() => {
                // Go back to quick capture screen to create another GIF
                goToScreen('quick-capture');
              }}
              onClose={onClose}
              gifSize={data.gifSize}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default OverlayWizard;