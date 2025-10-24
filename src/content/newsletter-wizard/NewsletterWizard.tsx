import React from 'react';
import FeedbackScreen from '../overlay-wizard/screens/FeedbackScreen';

interface NewsletterWizardProps {
  onClose: () => void;
}

const NewsletterWizard: React.FC<NewsletterWizardProps> = ({ onClose }) => {
  const handleBack = () => {
    // No back navigation needed in standalone newsletter wizard
    onClose();
  };

  return (
    <div className="ytgif-overlay-wizard">
      <div className="ytgif-wizard-container">
        <button onClick={onClose} className="ytgif-wizard-close" aria-label="Close">
          ×
        </button>
        <FeedbackScreen onBack={handleBack} onClose={onClose} isStandalone={true} />
      </div>
    </div>
  );
};

export default NewsletterWizard;
