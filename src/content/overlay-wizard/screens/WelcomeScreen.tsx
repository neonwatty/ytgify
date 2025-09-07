import React from 'react';

interface WelcomeScreenProps {
  videoTitle?: string;
  videoDuration: number;
  onContinue: () => void;
  onClose: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  videoTitle,
  videoDuration,
  onContinue,
  onClose
}) => {
  // Auto-advance after a short delay
  React.useEffect(() => {
    console.log('[WelcomeScreen] Setting up auto-advance timer');
    const timer = setTimeout(() => {
      console.log('[WelcomeScreen] Auto-advancing to next screen');
      onContinue();
    }, 1500);
    
    return () => {
      console.log('[WelcomeScreen] Clearing auto-advance timer');
      clearTimeout(timer);
    };
  }, [onContinue]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ytgif-wizard-screen ytgif-welcome-screen">
      <div className="ytgif-wizard-content">
        {/* Logo */}
        <div className="ytgif-logo-container">
          <div className="ytgif-logo">
            <span>G</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="ytgif-wizard-title">Create a GIF</h1>

        {/* Video Info */}
        <div className="ytgif-video-info">
          {videoTitle && (
            <p className="ytgif-video-title">{videoTitle}</p>
          )}
          <p className="ytgif-video-duration">
            Duration: {formatDuration(videoDuration)}
          </p>
        </div>

        {/* Loading indicator */}
        <div className="ytgif-loading-dots">
          <div className="ytgif-dot"></div>
          <div className="ytgif-dot"></div>
          <div className="ytgif-dot"></div>
        </div>

        <p className="ytgif-auto-advance">Starting automatically...</p>
      </div>
    </div>
  );
};

export default WelcomeScreen;