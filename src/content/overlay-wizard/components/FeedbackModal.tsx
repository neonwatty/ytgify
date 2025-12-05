import React from 'react';
import { EXTERNAL_SURVEY_URL } from '@/constants/features';
import { openExternalLink } from '@/constants/links';
import { feedbackTracker } from '@/shared/feedback-tracker';

interface FeedbackModalProps {
  onClose: () => void;
  onPermanentDismiss: () => void;
}

const FeedbackModal: React.FC<FeedbackModalProps> = ({
  onClose,
  onPermanentDismiss,
}) => {
  const handleTakeSurvey = async () => {
    await feedbackTracker.recordSurveyClicked();
    openExternalLink(EXTERNAL_SURVEY_URL);
    onClose();
  };

  const handleDontShowAgain = async () => {
    await feedbackTracker.recordPermanentDismiss();
    onPermanentDismiss();
  };

  return (
    <div className="ytgif-feedback-overlay">
      <div className="ytgif-feedback-modal ytgif-feedback-modal--simple">
        <button
          className="ytgif-feedback-close"
          onClick={onClose}
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
          <h2>Help us improve YTGify</h2>
          <p className="ytgif-feedback-subtitle">
            Your feedback helps shape future features
          </p>
        </div>

        <div className="ytgif-feedback-actions">
          <button
            className="ytgif-button-primary"
            onClick={handleTakeSurvey}
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
            Take Survey
          </button>
          <button
            className="ytgif-button-tertiary"
            onClick={handleDontShowAgain}
            type="button"
          >
            Don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackModal;
