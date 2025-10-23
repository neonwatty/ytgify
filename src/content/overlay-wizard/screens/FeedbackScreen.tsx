import React, { useEffect } from 'react';
import { openExternalLink, getReviewLink } from '@/constants/links';

interface FeedbackScreenProps {
  onBack: () => void;
  onClose: () => void;
}

const FeedbackScreen: React.FC<FeedbackScreenProps> = ({ onBack, onClose }) => {
  const handleRate = () => {
    openExternalLink(getReviewLink());
  };

  // Load BeehIiv embed script
  useEffect(() => {
    const scriptId = 'beehiiv-embed-script';

    // Check if script is already loaded
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://subscribe-forms.beehiiv.com/embed.js';
      script.async = true;
      document.head.appendChild(script);
    }

    // Cleanup function
    return () => {
      const script = document.getElementById(scriptId);
      if (script) {
        script.remove();
      }
    };
  }, []);

  return (
    <div className="ytgif-wizard-screen ytgif-feedback-screen">
      <div className="ytgif-wizard-header">
        <div style={{ width: '20px' }}></div>
        <h2 className="ytgif-wizard-title">Support YTGify</h2>
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
          {/* Show Your Support Section - Now First */}
          <div className="ytgif-support-section">
            <h3>Enjoying YTGify?</h3>
            <div className="ytgif-support-buttons">
              <button className="ytgif-support-btn" onClick={handleRate}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                <span>Leave us a review!</span>
              </button>
            </div>
          </div>

          {/* BeehIiv Newsletter Section - Second */}
          <div className="ytgif-newsletter-section">
            <h3>Stay Updated</h3>
            <p>Get notified about new features and releases:</p>
            <div className="ytgif-newsletter-embed">
              <iframe
                src="https://subscribe-forms.beehiiv.com/40d30e3d-c27d-4986-a9ce-3d4ae314fc5d"
                className="beehiiv-embed"
                data-test-id="beehiiv-embed"
                frameBorder="0"
                scrolling="no"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  height: '70px',
                  margin: '0',
                  borderRadius: '0px',
                  backgroundColor: 'transparent',
                  boxShadow: 'none',
                  display: 'block'
                }}
              />
            </div>
          </div>

          {/* GitHub Link - Third */}
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
