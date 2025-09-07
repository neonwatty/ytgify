import React from 'react';

interface SuccessScreenProps {
  onDownload?: () => void;
  onBack?: () => void;
  onClose?: () => void;
  gifSize?: number;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ 
  onDownload,
  onBack,
  onClose,
  gifSize
}) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="ytgif-wizard-screen ytgif-success-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">✨ GIF Created Successfully!</h2>
        <button className="ytgif-close-btn" onClick={onClose}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18" strokeWidth={2} />
            <line x1="6" y1="6" x2="18" y2="18" strokeWidth={2} />
          </svg>
        </button>
      </div>

      <div className="ytgif-wizard-content">
        {/* Success Icon */}
        <div className="ytgif-success-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        {/* Success Message */}
        <div className="ytgif-success-message">
          <h3>Your GIF is ready!</h3>
          {gifSize && (
            <p className="ytgif-gif-size">Size: {formatSize(gifSize)}</p>
          )}
        </div>

        {/* Success Actions */}
        <div className="ytgif-success-actions">
          <button className="ytgif-button-secondary" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <button className="ytgif-button-primary" onClick={onDownload}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Download GIF
          </button>
        </div>

        {/* Info */}
        <div className="ytgif-success-info">
          <p>Your GIF has been saved to the extension library.</p>
          <p>You can access it anytime from the extension popup.</p>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;