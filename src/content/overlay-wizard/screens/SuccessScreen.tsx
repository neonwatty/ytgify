import React from 'react';
import { engagementTracker } from '@/shared/engagement-tracker';
import { feedbackTracker } from '@/shared/feedback-tracker';
import { openExternalLink, getReviewLink, getWaitlistLink } from '@/constants/links';
import { getDiscordWebhookUrl, DiscordService, recordDiscordUpload } from '@/shared/discord-service';
import FeedbackModal from '../components/FeedbackModal';

interface SuccessScreenProps {
  onDownload?: () => void;
  onBack?: () => void;
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

// Discord upload state type
type DiscordUploadState = 'idle' | 'captioning' | 'uploading' | 'success' | 'error';

const SuccessScreen: React.FC<SuccessScreenProps> = ({
  onDownload,
  onBack,
  onClose: _onClose,
  gifSize,
  gifDataUrl,
  gifMetadata,
}) => {
  const [showFooter, setShowFooter] = React.useState(false);
  const [showFeedback, setShowFeedback] = React.useState(false);

  // Discord state
  const [discordWebhookConfigured, setDiscordWebhookConfigured] = React.useState(false);
  const [discordHintDismissed, setDiscordHintDismissed] = React.useState(true); // Default true to hide until loaded
  const [discordUploadState, setDiscordUploadState] = React.useState<DiscordUploadState>('idle');
  const [discordError, setDiscordError] = React.useState<string | null>(null);
  const [discordCaption, setDiscordCaption] = React.useState<string>('');

  // Check if Discord webhook is configured and hint dismissed
  React.useEffect(() => {
    const checkDiscord = async () => {
      try {
        const webhookUrl = await getDiscordWebhookUrl();
        setDiscordWebhookConfigured(!!webhookUrl);

        // Check if hint was dismissed
        if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
          const result = await chrome.storage.sync.get(['discordHintDismissed']);
          setDiscordHintDismissed(!!result.discordHintDismissed);
        } else {
          setDiscordHintDismissed(false);
        }
      } catch (error) {
        console.error('Error checking Discord webhook:', error);
        setDiscordHintDismissed(false);
      }
    };
    checkDiscord();
  }, []);

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

  // Check post-success feedback trigger
  React.useEffect(() => {
    const checkFeedback = async () => {
      try {
        const shouldShow = await feedbackTracker.shouldShowPostSuccessFeedback();
        if (shouldShow) {
          // Delay showing feedback modal to not interrupt download flow
          setTimeout(() => {
            setShowFeedback(true);
            feedbackTracker.recordFeedbackShown('post-success');
          }, 2000);
        }
      } catch (error) {
        console.error('Error checking feedback qualification:', error);
      }
    };
    checkFeedback();
  }, []);

  // Handle footer actions
  const handleReview = () => {
    openExternalLink(getReviewLink());
  };

  const handleDismissFooter = async () => {
    await engagementTracker.recordDismissal('popup-footer');
    setShowFooter(false);
  };

  const handleDiscord = () => {
    openExternalLink('https://discord.gg/8EUxqR93');
  };

  const handleShareWaitlist = () => {
    openExternalLink(getWaitlistLink());
  };

  // Discord handlers
  const handleDiscordClick = () => {
    if (discordUploadState === 'idle') {
      setDiscordUploadState('captioning');
      setDiscordError(null);
    } else if (discordUploadState === 'error') {
      // Retry
      setDiscordUploadState('captioning');
      setDiscordError(null);
    }
  };

  const handleDismissDiscordHint = async () => {
    setDiscordHintDismissed(true);
    if (typeof chrome !== 'undefined' && chrome.storage?.sync) {
      await chrome.storage.sync.set({ discordHintDismissed: true });
    }
  };

  const handleDiscordCancel = () => {
    setDiscordUploadState('idle');
    setDiscordCaption('');
    setDiscordError(null);
  };

  const handleDiscordSend = async () => {
    if (!gifDataUrl || discordUploadState === 'uploading') return;

    setDiscordUploadState('uploading');
    setDiscordError(null);

    try {
      const webhookUrl = await getDiscordWebhookUrl();
      if (!webhookUrl) {
        throw new Error('Discord webhook not configured');
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
      const filename = `ytgify-${timestamp}.gif`;

      // Upload directly from content script (avoids service worker timeout issues)
      const result = await DiscordService.uploadGif(
        webhookUrl,
        gifDataUrl,
        filename,
        discordCaption.trim() || undefined
      );

      if (result.success) {
        // Record successful upload for analytics
        await recordDiscordUpload();
        setDiscordUploadState('success');
        setDiscordCaption('');
        // Reset to idle after 3 seconds
        setTimeout(() => setDiscordUploadState('idle'), 3000);
      } else {
        setDiscordUploadState('error');
        setDiscordError(result.error || 'Upload failed');
      }
    } catch (error) {
      setDiscordUploadState('error');
      setDiscordError(error instanceof Error ? error.message : 'Upload failed');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
          <div className="ytgif-success-preview ytgif-gif-preview">
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

        {/* Stay Connected Action */}
        <div className="ytgif-success-bottom-actions">
          {/* Discord Upload Button - Only show if configured */}
          {discordWebhookConfigured ? (
            <div className="ytgif-connect-button-wrapper ytgif-discord-upload-wrapper">
              {discordUploadState === 'captioning' ? (
                <div className="ytgif-discord-caption-form">
                  <input
                    type="text"
                    className="ytgif-discord-caption-input"
                    placeholder="Add a caption (optional)"
                    value={discordCaption}
                    onChange={(e) => setDiscordCaption(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleDiscordSend();
                      if (e.key === 'Escape') handleDiscordCancel();
                    }}
                    autoFocus
                  />
                  <div className="ytgif-discord-caption-actions">
                    <button
                      className="ytgif-button-text"
                      onClick={handleDiscordCancel}
                      type="button"
                    >
                      Cancel
                    </button>
                    <button
                      className="ytgif-button-discord-send"
                      onClick={handleDiscordSend}
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    className={`ytgif-button-secondary ytgif-discord-upload-btn ${
                      discordUploadState === 'success' ? 'ytgif-discord-success' : ''
                    } ${discordUploadState === 'error' ? 'ytgif-discord-error' : ''}`}
                    onClick={handleDiscordClick}
                    disabled={discordUploadState === 'uploading'}
                  >
                    {discordUploadState === 'uploading' ? (
                      <>
                        <div className="ytgif-button-spinner" />
                        Uploading...
                      </>
                    ) : discordUploadState === 'success' ? (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Sent!
                      </>
                    ) : (
                      <>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
                        </svg>
                        {discordUploadState === 'error' ? 'Retry' : 'Share to Discord'}
                      </>
                    )}
                  </button>
                  {discordUploadState === 'error' && discordError && (
                    <span className="ytgif-connect-subtext ytgif-error-text">{discordError}</span>
                  )}
                  {discordUploadState === 'success' && (
                    <span className="ytgif-connect-subtext ytgif-success-text">Uploaded to Discord!</span>
                  )}
                  {discordUploadState === 'idle' && (
                    <span className="ytgif-connect-subtext">Post directly to your server</span>
                  )}
                </>
              )}
            </div>
          ) : !discordHintDismissed ? (
            <div className="ytgif-discord-hint">
              <span className="ytgif-discord-hint-text">
                Tip: Set up Discord sharing in extension settings
              </span>
              <button
                className="ytgif-discord-hint-dismiss"
                onClick={handleDismissDiscordHint}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ) : null}

          <div className="ytgif-connect-button-wrapper">
            <button className="ytgif-button-secondary" onClick={handleShareWaitlist}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              Share This GIF
            </button>
            <span className="ytgif-connect-subtext">Be first to know when sharing launches</span>
          </div>
          <div className="ytgif-connect-button-wrapper">
            <button className="ytgif-button-secondary" onClick={handleDiscord}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515a.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0a12.64 12.64 0 00-.617-1.25a.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057a19.9 19.9 0 005.993 3.03a.078.078 0 00.084-.028a14.09 14.09 0 001.226-1.994a.076.076 0 00-.041-.106a13.107 13.107 0 01-1.872-.892a.077.077 0 01-.008-.128a10.2 10.2 0 00.372-.292a.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127a12.299 12.299 0 01-1.873.892a.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028a19.839 19.839 0 006.002-3.03a.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Join Discord
            </button>
            <span className="ytgif-connect-subtext">Bug reports & feedback</span>
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

      {/* Feedback Modal */}
      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          onPermanentDismiss={() => setShowFeedback(false)}
        />
      )}
    </div>
  );
};

export default SuccessScreen;
