import React from 'react';
import { ProposedFeature } from '@/types/storage';

interface FeatureVoteCardProps {
  feature: ProposedFeature;
  currentVote: 'up' | 'down' | null;
  onVote: (vote: 'up' | 'down' | null) => void;
}

const FeatureVoteCard: React.FC<FeatureVoteCardProps> = ({
  feature,
  currentVote,
  onVote,
}) => {
  const handleVote = (vote: 'up' | 'down') => {
    // Toggle off if clicking same vote, otherwise set new vote
    onVote(currentVote === vote ? null : vote);
  };

  return (
    <div className="ytgif-feature-vote-card">
      <div className="ytgif-feature-info">
        <h4 className="ytgif-feature-name">{feature.name}</h4>
        <p className="ytgif-feature-desc">{feature.description}</p>
      </div>
      <div className="ytgif-vote-buttons">
        <button
          className={`ytgif-vote-btn ytgif-vote-up ${currentVote === 'up' ? 'ytgif-vote-btn--active' : ''}`}
          onClick={() => handleVote('up')}
          aria-label={`Upvote ${feature.name}`}
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
              d="M5 15l7-7 7 7"
            />
          </svg>
        </button>
        <button
          className={`ytgif-vote-btn ytgif-vote-down ${currentVote === 'down' ? 'ytgif-vote-btn--active' : ''}`}
          onClick={() => handleVote('down')}
          aria-label={`Downvote ${feature.name}`}
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
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default FeatureVoteCard;
