import React, { useEffect, useState } from 'react';

interface ProcessingScreenProps {
  processingStatus?: {
    stage: string;
    progress: number;
    message: string;
  };
  onComplete?: () => void;
  onError?: (error: string) => void;
}

const ProcessingScreen: React.FC<ProcessingScreenProps> = ({ 
  processingStatus,
  onComplete,
  onError 
}) => {
  const [dots, setDots] = useState('');
  
  // Animate dots for loading effect
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
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

  const progress = processingStatus?.progress || 0;
  const message = processingStatus?.message || 'Initializing...';
  const stage = processingStatus?.stage || 'preparing';

  return (
    <div className="ytgif-processing-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">Creating Your GIF</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Progress Circle */}
        <div className="ytgif-progress-circle-container">
          <svg className="ytgif-progress-circle" width="120" height="120">
            <circle
              className="ytgif-progress-circle-bg"
              cx="60"
              cy="60"
              r="54"
              strokeWidth="8"
              fill="none"
              stroke="#e0e0e0"
            />
            <circle
              className="ytgif-progress-circle-fill"
              cx="60"
              cy="60"
              r="54"
              strokeWidth="8"
              fill="none"
              stroke="#9966cc"
              strokeDasharray={`${(progress / 100) * 339.292} 339.292`}
              strokeLinecap="round"
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="ytgif-progress-circle-text">
            {Math.round(progress)}%
          </div>
        </div>

        {/* Status Message */}
        <div className="ytgif-status-text">
          {message}{stage === 'processing' && dots}
        </div>

        {/* Progress Bar */}
        <div className="ytgif-progress-bar-container">
          <div className="ytgif-progress-bar">
            <div 
              className="ytgif-progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stage Info */}
        <div className="ytgif-stage-info">
          {stage === 'capturing' && (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="2" y="2" width="20" height="20" rx="2" ry="2" />
                <circle cx="8" cy="8" r="2" />
                <path d="M14 8h6M14 12h6M14 16h6M4 16l4-4 2 2 4-4" />
              </svg>
              <span>Capturing frames from video</span>
            </>
          )}
          {stage === 'encoding' && (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 2L2 7v10c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V7l-10-5z" />
                <path d="M9 12l2 2 4-4" />
              </svg>
              <span>Encoding GIF</span>
            </>
          )}
          {stage === 'processing' && (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
              <span>Processing</span>
            </>
          )}
          {stage === 'completed' && (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span style={{ color: '#4caf50' }}>Complete!</span>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProcessingScreen;