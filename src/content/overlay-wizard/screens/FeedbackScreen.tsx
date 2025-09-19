import React from 'react';

interface FeedbackScreenProps {
  onBack: () => void;
  onClose: () => void;
}

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ onBack, onClose }) => {
  return (
    <div className="ytgif-wizard-screen ytgif-feedback-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">Help Us Improve YTGify</h2>
        <div style={{ width: '20px' }}></div>
      </div>

      <div className="ytgif-wizard-content">
        {/* Logo */}
        <div className="ytgif-logo-container">
          <img
            src={chrome.runtime.getURL('icons/icon.svg')}
            alt="YTGify Logo"
            className="ytgif-logo-svg"
          />
        </div>

        {/* Feedback Content */}
        <div className="ytgif-feedback-content">
          <p className="ytgif-feedback-description">
            Found a bug or have a feature request?
            <br />
            We&apos;d love to hear from you!
          </p>

          {/* GitHub Link */}
          <div className="ytgif-feedback-option">
            <h3>Report Issues & Request Features</h3>
            <p>Visit our GitHub repository to report bugs or suggest new features:</p>
            <a
              href="https://github.com/neonwatty/ytgify"
              target="_blank"
              rel="noopener noreferrer"
              className="ytgif-feedback-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub Issues
            </a>
          </div>

          {/* X/Twitter Link */}
          <div className="ytgif-feedback-option">
            <h3>Follow & Connect</h3>
            <p>Follow us on X for updates and quick questions:</p>
            <a
              href="https://x.com/neonwatty"
              target="_blank"
              rel="noopener noreferrer"
              className="ytgif-feedback-link"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @neonwatty
            </a>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="ytgif-feedback-actions">
          <button className="ytgif-button-secondary" onClick={() => onBack && onBack()}>
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

          <button className="ytgif-button-primary" onClick={() => onClose && onClose()}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default FeedbackScreen;
