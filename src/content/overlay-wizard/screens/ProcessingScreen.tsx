import React, { useEffect, useState } from 'react';

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
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({
  processingStatus,
  onComplete,
  onError: _onError,
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

  return (
    <div className="ytgif-processing-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
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
