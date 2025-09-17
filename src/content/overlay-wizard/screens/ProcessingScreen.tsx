import React, { useEffect, useState } from 'react';

interface ProcessingScreenProps {
  processingStatus?: {
    stage: string;
    stageNumber: number;
    totalStages: number;
    progress: number;
    message: string;
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

  // Animate dots for loading effect
  useEffect(() => {
    const interval = setInterval(() => {
      _setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Check for completion
  useEffect(() => {
    if (processingStatus?.progress === 100) {
      setTimeout(() => {
        onComplete?.();
      }, 1000);
    }
  }, [processingStatus?.progress, onComplete]);

  const _currentStage = processingStatus?.stage || 'CAPTURING';
  const stageNumber = processingStatus?.stageNumber || 1;
  const totalStages = processingStatus?.totalStages || 4;
  const message = processingStatus?.message || 'Initializing...';

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
        <h2 className="ytgif-wizard-title">Creating Your GIF</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Stage Progress Display */}
        <div className="ytgif-stage-progress">
          <div className="ytgif-stage-header">
            <h3>
              Stage {stageNumber} of {totalStages}
            </h3>
          </div>

          {/* Stage Checklist */}
          <div className="ytgif-stage-list">
            {stages.map((stage, index) => {
              const isCompleted = index + 1 < stageNumber;
              const isCurrent = index + 1 === stageNumber;
              const isPending = index + 1 > stageNumber;

              return (
                <div
                  key={stage.key}
                  className={`ytgif-stage-item ${isCurrent ? 'current' : isCompleted ? 'completed' : 'pending'}`}
                >
                  <div className="ytgif-stage-indicator">
                    {isCompleted && <span className="ytgif-stage-check">✓</span>}
                    {isCurrent && <span className="ytgif-stage-active">●</span>}
                    {isPending && <span className="ytgif-stage-pending">○</span>}
                  </div>
                  <div className="ytgif-stage-content">
                    <span className="ytgif-stage-icon">{stage.icon}</span>
                    <span className="ytgif-stage-name">{stage.name}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Current Message */}
          <div className="ytgif-current-message">
            <div className="ytgif-message-text">{message}</div>
            <div className="ytgif-loading-dots">
              <span className="ytgif-dot">⚬</span>
              <span className="ytgif-dot">⚬</span>
              <span className="ytgif-dot">⚬</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessingScreen;
