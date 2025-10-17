import React from 'react';
import { getTwitterTemplates, generateTwitterShareUrl } from '@/utils/social-templates';
import { openExternalLink } from '@/constants/links';

interface SuccessScreenProps {
  onDownload?: () => void;
  onBack?: () => void;
  onFeedback?: () => void;
  onClose?: () => void;
  gifSize?: number;
  gifDataUrl?: string;
  gifMetadata?: {
    width: number;
    height: number;
    duration: number;
    frameCount?: number;
  };
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({
  onDownload,
  onBack,
  onFeedback,
  onClose: _onClose,
  gifSize,
  gifDataUrl,
  gifMetadata,
}) => {
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleShare = () => {
    const templates = getTwitterTemplates();
    const twitterUrl = generateTwitterShareUrl(templates[0].text); // Use short template
    openExternalLink(twitterUrl);
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
        </div>

        {/* Feedback and Share Actions */}
        <div className="ytgif-success-bottom-actions">
          <button className="ytgif-button-secondary" onClick={onFeedback}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            Give Feedback
          </button>

          <button className="ytgif-share-link" onClick={handleShare}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Spread the word about YTGify
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuccessScreen;
