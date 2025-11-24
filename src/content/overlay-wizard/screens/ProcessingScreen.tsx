import React, { useEffect, useState } from 'react';
import { openExternalLink, getDiscordLink } from '@/constants/links';

interface BufferingStatus {
  isBuffering: boolean;
  currentFrame: number;
  totalFrames: number;
  bufferedPercentage: number;
  estimatedTimeRemaining: number;
}

interface ProcessingScreenProps {
  processingStatus?: {
    stage: string;
    stageNumber: number;
    totalStages: number;
    progress: number;
    message: string;
    bufferingStatus?: BufferingStatus;
  };
  onComplete?: () => void;
  onError?: (error: string) => void;
  onBack?: () => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  processingStatus,
  onComplete,
  onError: _onError,
  onBack,
}) => {
  const [_dots, _setDots] = useState('');
  const [lastBufferingStatus, setLastBufferingStatus] = useState<BufferingStatus | undefined>();

  // Animate dots for loading effect
  useEffect(() => {
    const interval = setInterval(() => {
      _setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Persist buffering status to prevent flickering when updates are missing it
  useEffect(() => {
    if (processingStatus?.bufferingStatus) {
      setLastBufferingStatus(processingStatus.bufferingStatus);
      console.log('[ProcessingScreen] Buffering status received:', {
        isBuffering: processingStatus.bufferingStatus.isBuffering,
        currentFrame: processingStatus.bufferingStatus.currentFrame,
        totalFrames: processingStatus.bufferingStatus.totalFrames,
        bufferedPercentage: processingStatus.bufferingStatus.bufferedPercentage,
      });
    }
  }, [processingStatus?.bufferingStatus]);

  // Reset buffering status when leaving CAPTURING stage
  useEffect(() => {
    if (processingStatus?.stage && processingStatus.stage !== 'CAPTURING') {
      setLastBufferingStatus(undefined);
    }
  }, [processingStatus?.stage]);

  // Check for completion
  useEffect(() => {
    if (processingStatus?.progress === 100) {
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }
  }, [processingStatus?.progress, onComplete]);

  const currentStage = processingStatus?.stage || 'CAPTURING';
  const stageNumber = processingStatus?.stageNumber || 1;
  const totalStages = processingStatus?.totalStages || 4;
  const message = processingStatus?.message || 'Initializing...';

  // Check for special states
  const isError = currentStage === 'ERROR';
  const isCompleted = currentStage === 'COMPLETED';

  // Define all stages
  const stages = [
    { key: 'CAPTURING', name: 'Capturing Frames', icon: '📹' },
    { key: 'ANALYZING', name: 'Analyzing Colors', icon: '🎨' },
    { key: 'ENCODING', name: 'Encoding GIF', icon: '🔧' },
    { key: 'FINALIZING', name: 'Finalizing', icon: '✨' },
  ];

  const handleBackClick = () => {
    // Navigate back
    if (onBack) {
      onBack();
    }
  };

  const handleDiscordClick = () => {
    openExternalLink(getDiscordLink());
  };

  return (
    <div className="ytgif-processing-screen">
      <div className="ytgif-wizard-header">
        <button onClick={handleBackClick} className="ytgif-back-button" aria-label="Go back">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M12.5 15L7.5 10L12.5 5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 className="ytgif-wizard-title">
          {isError ? 'GIF Creation Failed' : isCompleted ? 'GIF Created!' : 'Creating Your GIF'}
        </h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Stage Progress Display */}
        <div className="ytgif-stage-progress">
          <div className="ytgif-stage-header">
            <h3>
              {isError
                ? 'Error occurred'
                : isCompleted
                  ? 'All stages complete'
                  : `Stage ${stageNumber} of ${totalStages}`}
            </h3>
          </div>

          {/* Discord Help Button - Only show on error */}
          {isError && (
            <div className="ytgif-discord-container">
              <p className="ytgif-discord-message">
                Need help? Join our Discord community for support.
              </p>
              <button onClick={handleDiscordClick} className="ytgif-discord-button">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Get Help on Discord
              </button>
            </div>
          )}

          {/* Stage Checklist */}
          <div className="ytgif-stage-list">
            {stages.map((stage, index) => {
              let stageItemClass = '';
              let indicator = null;
              const isStageCurrent = index + 1 === stageNumber;

              if (isError) {
                // For error state, show failed indicator for current stage
                const isCurrentErrorStage =
                  index + 1 === stageNumber || (stageNumber === 0 && index === 0);
                const wasCompleted = index + 1 < stageNumber;

                if (isCurrentErrorStage) {
                  stageItemClass = 'error';
                  indicator = <span className="ytgif-stage-error">✗</span>;
                } else if (wasCompleted) {
                  stageItemClass = 'completed';
                  indicator = <span className="ytgif-stage-check">✓</span>;
                } else {
                  stageItemClass = 'pending';
                  indicator = <span className="ytgif-stage-pending">○</span>;
                }
              } else if (isCompleted) {
                // All stages completed
                stageItemClass = 'completed';
                indicator = <span className="ytgif-stage-check">✓</span>;
              } else {
                // Normal progression
                const isStageCompleted = index + 1 < stageNumber;
                const _isStagePending = index + 1 > stageNumber;

                if (isStageCompleted) {
                  stageItemClass = 'completed';
                  indicator = <span className="ytgif-stage-check">✓</span>;
                } else if (isStageCurrent) {
                  stageItemClass = 'current';
                  indicator = <span className="ytgif-stage-active">●</span>;
                } else {
                  stageItemClass = 'pending';
                  indicator = <span className="ytgif-stage-pending">○</span>;
                }
              }

              const isCaptureStage = stage.key === 'CAPTURING';
              const shouldShowProgress = isCaptureStage && isStageCurrent && !isError && !isCompleted;

              // Use persisted buffering status to prevent flicker when updates don't include it
              const bs = lastBufferingStatus;
              const hasData = bs && bs.currentFrame !== undefined;

              return (
                <div key={stage.key} className={`ytgif-stage-item ${stageItemClass}`}>
                  <div className="ytgif-stage-indicator">{indicator}</div>
                  <div className="ytgif-stage-content">
                    <span className="ytgif-stage-icon">{stage.icon}</span>
                    <span className="ytgif-stage-name">{stage.name}</span>
                  </div>

                  {/* Always render during CAPTURING, use opacity to show/hide */}
                  {shouldShowProgress && (
                    <div
                      className={`ytgif-inline-progress ${hasData ? 'ytgif-has-data' : 'ytgif-no-data'}`}
                    >
                      {hasData ? (
                        <>
                          <div className="ytgif-inline-progress-bar">
                            <div
                              className="ytgif-inline-progress-fill"
                              style={{ width: `${(bs.currentFrame / bs.totalFrames) * 100}%` }}
                            />
                          </div>
                          <div className="ytgif-inline-progress-info">
                            <span className="ytgif-inline-frame-count">
                              Frame {bs.currentFrame}/{bs.totalFrames}
                            </span>
                            {bs.estimatedTimeRemaining > 0 && (
                              <>
                                <span className="ytgif-inline-separator">·</span>
                                <span className="ytgif-inline-eta">
                                  ~{Math.ceil(bs.estimatedTimeRemaining)}s
                                </span>
                              </>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="ytgif-inline-progress-placeholder">Initializing...</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Current Message */}
          <div className="ytgif-current-message">
            <div className="ytgif-message-text">{message}</div>
            {!isError && !isCompleted && (
              <div className="ytgif-loading-dots">
                <span className="ytgif-dot">⚬</span>
                <span className="ytgif-dot">⚬</span>
                <span className="ytgif-dot">⚬</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingScreen;
