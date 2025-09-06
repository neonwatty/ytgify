import React from 'react';

interface ActionSelectScreenProps {
  currentTime: number;
  duration: number;
  onQuickCapture: () => void;
  onCustomRange: () => void;
  onBack: () => void;
}

const ActionSelectScreen: React.FC<ActionSelectScreenProps> = ({
  currentTime,
  duration,
  onQuickCapture,
  onCustomRange,
  onBack
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="ytgif-wizard-screen ytgif-action-screen">
      <div className="ytgif-wizard-header">
        <button onClick={onBack} className="ytgif-back-button">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="ytgif-wizard-title">Choose Capture Mode</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        <div className="ytgif-action-cards">
          {/* Quick Capture Card */}
          <button className="ytgif-action-card" onClick={onQuickCapture}>
            <div className="ytgif-card-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="ytgif-card-title">Quick Capture</h3>
            <p className="ytgif-card-description">
              Capture 4 seconds from current position
            </p>
            <div className="ytgif-card-detail">
              {formatTime(Math.max(0, currentTime - 2))} - {formatTime(Math.min(duration, currentTime + 2))}
            </div>
          </button>

          {/* Custom Range Card */}
          <button className="ytgif-action-card" onClick={onCustomRange}>
            <div className="ytgif-card-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </div>
            <h3 className="ytgif-card-title">Custom Range</h3>
            <p className="ytgif-card-description">
              Select any segment from the video
            </p>
            <div className="ytgif-card-detail">
              Up to {formatTime(duration)}
            </div>
          </button>
        </div>

        <div className="ytgif-tip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13 9h-2V7h2m0 10h-2v-6h2m-1-9A10 10 0 002 12a10 10 0 0010 10 10 10 0 0010-10A10 10 0 0012 2z"/>
          </svg>
          <span>Tip: GIFs work best with 2-10 second clips</span>
        </div>
      </div>
    </div>
  );
};

export default ActionSelectScreen;