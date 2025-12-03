import React, { useState } from 'react';
import { FeatureVote } from '@/types/storage';
import { PROPOSED_FEATURES, EXTERNAL_SURVEY_URL } from '@/constants/features';
import { openExternalLink } from '@/constants/links';
import { feedbackTracker } from '@/shared/feedback-tracker';
import FeatureVoteCard from './FeatureVoteCard';

interface FeedbackModalProps {
  trigger: 'milestone' | 'time' | 'post-success';
  milestoneCount?: 10 | 25 | 50;
  onClose: () => void;
  onSubmit: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  trigger,
  milestoneCount,
  onClose,
  onSubmit,
}) => {
  const [votes, setVotes] = useState<Record<string, 'up' | 'down' | null>>({});
  const [suggestion, setSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getHeaderText = () => {
    if (trigger === 'milestone' && milestoneCount) {
      return `You've created ${milestoneCount} GIFs!`;
    }
    if (trigger === 'time') {
      return 'Thanks for using YTGify!';
    }
    return 'Nice GIF!';
  };

  const handleVote = (featureId: string, vote: 'up' | 'down' | null) => {
    setVotes((prev) => ({ ...prev, [featureId]: vote }));
  };

  const handleSurveyClick = async () => {
    await feedbackTracker.recordSurveyClicked();
    openExternalLink(EXTERNAL_SURVEY_URL);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const featureVotes: FeatureVote[] = Object.entries(votes)
      .filter(([, vote]) => vote !== null)
      .map(([featureId, vote]) => ({
        featureId,
        vote: vote!,
        votedAt: Date.now(),
      }));

    await feedbackTracker.recordFeedbackSubmitted(
      featureVotes,
      suggestion || undefined,
      false
    );

    setIsSubmitting(false);
    onSubmit();
  };

  const handleDismiss = async () => {
    onClose();
  };

  return (
    <div className="ytgif-feedback-overlay">
      <div className="ytgif-feedback-modal">
        <button
          className="ytgif-feedback-close"
          onClick={handleDismiss}
          aria-label="Close"
          type="button"
        >
          &times;
        </button>

        <div className="ytgif-feedback-header">
          <div className="ytgif-feedback-icon">
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
          <h2>{getHeaderText()}</h2>
          <p className="ytgif-feedback-subtitle">Help us improve YTGify</p>
        </div>

        <div className="ytgif-feedback-content">
          <h3 className="ytgif-feedback-section-title">
            Vote for features you&apos;d like:
          </h3>
          <div className="ytgif-feature-list">
            {PROPOSED_FEATURES.map((feature) => (
              <FeatureVoteCard
                key={feature.id}
                feature={feature}
                currentVote={votes[feature.id] || null}
                onVote={(vote) => handleVote(feature.id, vote)}
              />
            ))}
          </div>

          <div className="ytgif-feedback-suggestion">
            <label htmlFor="ytgif-suggestion">Have another idea?</label>
            <textarea
              id="ytgif-suggestion"
              placeholder="Tell us what feature would make YTGify better..."
              value={suggestion}
              onChange={(e) => setSuggestion(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>

          <button
            className="ytgif-feedback-survey-link"
            onClick={handleSurveyClick}
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Take detailed survey
          </button>
        </div>

        <div className="ytgif-feedback-actions">
          <button
            className="ytgif-button-secondary"
            onClick={handleDismiss}
            type="button"
          >
            Maybe Later
          </button>
          <button
            className="ytgif-button-primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            type="button"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
