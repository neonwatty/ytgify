import React from 'react';
import { openExternalLink, getReviewLink, getGitHubStarLink } from '@/constants/links';
import { getTwitterTemplates, generateTwitterShareUrl } from '@/utils/social-templates';

interface MilestoneScreenProps {
  milestoneCount: 10 | 25 | 50;
  onContinue: () => void;
  onRate?: () => void;
  onShare?: () => void;
  onGitHub?: () => void;
}

const MilestoneScreen: React.FC<MilestoneScreenProps> = ({
  milestoneCount,
  onContinue,
  onRate,
  onShare,
  onGitHub,
}) => {
  const getMilestoneTitle = () => {
    switch (milestoneCount) {
      case 10:
        return 'Milestone!';
      case 25:
        return 'Amazing Work!';
      case 50:
        return 'Legendary Creator!';
      default:
        return 'Milestone!';
    }
  };

  const handleRate = () => {
    openExternalLink(getReviewLink());
    if (onRate) onRate();
  };

  const handleShare = () => {
    const templates = getTwitterTemplates();
    const twitterUrl = generateTwitterShareUrl(templates[1].text); // Use medium template for milestones
    openExternalLink(twitterUrl);
    if (onShare) onShare();
  };

  const handleGitHub = () => {
    openExternalLink(getGitHubStarLink());
    if (onGitHub) onGitHub();
  };

  return (
    <div className="ytgif-wizard-screen ytgif-milestone-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">{getMilestoneTitle()}</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Milestone Icon */}
        <div className="ytgif-milestone-icon">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        {/* Milestone Message */}
        <div className="ytgif-milestone-message">
          <h3>You&apos;ve created {milestoneCount} GIFs!</h3>
          <p>Help us grow by supporting YTGify:</p>
        </div>

        {/* Action Buttons */}
        <div className="ytgif-milestone-actions">
          <button className="ytgif-milestone-action-btn" onClick={handleRate}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
            <span>Rate YTGify</span>
          </button>

          <button className="ytgif-milestone-action-btn" onClick={handleShare}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Share on X</span>
          </button>

          <button className="ytgif-milestone-action-btn" onClick={handleGitHub}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span>Star on GitHub</span>
          </button>
        </div>

        {/* Continue Button */}
        <button className="ytgif-button-primary ytgif-milestone-continue" onClick={onContinue}>
          Continue
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MilestoneScreen;
