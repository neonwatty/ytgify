import React from 'react';
import { engagementTracker } from '@/shared/engagement-tracker';
import { openExternalLink, getReviewLink } from '@/constants/links';

interface SuccessScreenProps {
  onDownload?: () => void;
  onBack?: () => void;
  onFeedback?: () => void;
  onClose?: () => void;
  onUploadToCloud?: () => void;
  gifSize?: number;
  gifDataUrl?: string;
  gifMetadata?: {
    width: number;
    height: number;
    duration: number;
    frameCount?: number;
  };
  // Phase 2: Cloud upload status
  uploadStatus?: 'uploading' | 'success' | 'failed' | 'disabled';
  uploadError?: string;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({
  onDownload,
  onBack,
  onFeedback,
  onClose: _onClose,
  onUploadToCloud,
  gifSize,
  gifDataUrl,
  gifMetadata,
  uploadStatus,
  uploadError,
}) => {
  const [showFooter, setShowFooter] = React.useState(false);

  // Check footer qualification on mount
  React.useEffect(() => {
    const checkFooter = async () => {
      try {
        const stats = await engagementTracker.getEngagementStats();
        const qualifies = await engagementTracker.shouldShowPrompt();
        const dismissed = stats.popupFooterDismissed;
        setShowFooter(qualifies && !dismissed);
      } catch (error) {
        console.error('Error checking footer qualification:', error);
      }
    };
    checkFooter();
  }, []);

  // Handle footer actions
  const handleReview = () => {
    openExternalLink(getReviewLink());
  };

  const handleDismissFooter = async () => {
    await engagementTracker.recordDismissal('popup-footer');
    setShowFooter(false);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Phase 2: Render upload status indicator
  const renderUploadStatus = () => {
    if (!uploadStatus) return null;

    const statusConfig = {
      uploading: {
        icon: (
          <svg className="ytgif-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
            <path
              d="M12 2a10 10 0 0110 10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        ),
        text: 'Uploading to cloud...',
        className: 'ytgif-upload-status-uploading',
      },
      success: {
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4" />
          </svg>
        ),
        text: 'Uploaded to ytgify!',
        className: 'ytgif-upload-status-success',
      },
      failed: {
        icon: (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" strokeWidth="2" d="M12 8v4m0 4h.01" />
          </svg>
        ),
        text: uploadError || 'Upload failed - saved locally',
        className: 'ytgif-upload-status-failed',
      },
      disabled: {
        icon: null,
        text: '',
        className: '',
      },
    };

    const config = statusConfig[uploadStatus];
    if (!config.text) return null;

    return (
      <div className={`ytgif-upload-status ${config.className}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  };

  return (
    <div className="ytgif-wizard-screen ytgif-success-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">GIF Created Successfully!</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* GIF Preview */}
        {gifDataUrl && (
          <div className="ytgif-success-preview">
            <img src={gifDataUrl} alt="Created GIF" className="ytgif-success-preview-image" />
            {gifMetadata && (
              <div className="ytgif-success-metadata">
                <span>
                  {gifMetadata.width}×{gifMetadata.height}
                </span>
                <span>•</span>
                <span>{formatSize(gifSize || 0)}</span>
                <span>•</span>
                <span>{gifMetadata.duration.toFixed(1)}s</span>
                {gifMetadata.frameCount && (
                  <>
                    <span>•</span>
                    <span>{gifMetadata.frameCount} frames</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        <div className="ytgif-success-message">
          <h3>Your GIF is ready!</h3>
          {!gifDataUrl && gifSize && <p className="ytgif-gif-size">Size: {formatSize(gifSize)}</p>}
        </div>

        {/* Phase 2: Cloud Upload Status */}
        {renderUploadStatus()}

        {/* Success Actions */}
        <div className="ytgif-success-actions">
          <button className="ytgif-button-secondary" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
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

          {uploadStatus === 'disabled' && onUploadToCloud && (
            <button className="ytgif-button-primary" onClick={onUploadToCloud}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" strokeWidth="2" />
                <polyline points="16 12 12 8 8 12" strokeWidth="2" />
                <line x1="12" y1="8" x2="12" y2="20" strokeWidth="2" />
              </svg>
              Upload to Cloud
            </button>
          )}
        </div>

        {/* Stay Connected Action */}
        <div className="ytgif-success-bottom-actions">
          <div className="ytgif-connect-button-wrapper">
            <button className="ytgif-button-secondary" onClick={onFeedback}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
              Stay Connected
            </button>
            <span className="ytgif-connect-subtext">Reviews, Feedback, & Updates</span>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      {showFooter && (
        <div className="ytgif-wizard-footer">
          <span>Enjoying YTGify? </span>
          <a onClick={handleReview}>Leave us a review!</a>
          <button className="dismiss-btn" onClick={handleDismissFooter}>×</button>
        </div>
      )}
    </div>
  );
};

export default SuccessScreen;
