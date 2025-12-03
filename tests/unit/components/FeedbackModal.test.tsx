import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackModal from '../../../src/content/overlay-wizard/components/FeedbackModal';

// Mock CSS imports
jest.mock('../../../src/content/wizard-styles.css', () => ({}));

// Mock features module with test data
const mockFeatures = [
  { id: 'cloud-storage', name: 'Save to Cloud', description: 'Store your GIFs in cloud storage', category: 'storage' },
  { id: 'community-gallery', name: 'Community Gallery', description: 'Browse and discover GIFs', category: 'community' },
  { id: 'slack-integration', name: 'Slack Integration', description: 'Share GIFs to Slack', category: 'sharing' },
  { id: 'discord-integration', name: 'Discord Integration', description: 'Share GIFs to Discord', category: 'sharing' },
];

jest.mock('../../../src/constants/features', () => ({
  EXTERNAL_SURVEY_URL: 'https://forms.gle/mock-survey-id',
  PROPOSED_FEATURES: [
    { id: 'cloud-storage', name: 'Save to Cloud', description: 'Store your GIFs in cloud storage', category: 'storage' },
    { id: 'community-gallery', name: 'Community Gallery', description: 'Browse and discover GIFs', category: 'community' },
    { id: 'slack-integration', name: 'Slack Integration', description: 'Share GIFs to Slack', category: 'sharing' },
    { id: 'discord-integration', name: 'Discord Integration', description: 'Share GIFs to Discord', category: 'sharing' },
  ],
}));

// Mock links module
const mockOpenExternalLink = jest.fn();
jest.mock('../../../src/constants/links', () => ({
  openExternalLink: (...args: unknown[]) => mockOpenExternalLink(...args),
}));

// Mock feedback tracker
const mockRecordSurveyClicked = jest.fn().mockResolvedValue(undefined);
const mockRecordFeedbackSubmitted = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/shared/feedback-tracker', () => ({
  feedbackTracker: {
    recordSurveyClicked: () => mockRecordSurveyClicked(),
    recordFeedbackSubmitted: (votes: unknown, suggestion: unknown, surveyClicked: unknown) =>
      mockRecordFeedbackSubmitted(votes, suggestion, surveyClicked),
  },
}));

describe('FeedbackModal Component', () => {
  const defaultProps = {
    trigger: 'post-success' as const,
    onClose: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Header Text', () => {
    test('displays milestone header for milestone trigger', () => {
      render(<FeedbackModal {...defaultProps} trigger="milestone" milestoneCount={10} />);
      expect(screen.getByText("You've created 10 GIFs!")).toBeInTheDocument();
    });

    test('displays milestone header for 25 GIFs', () => {
      render(<FeedbackModal {...defaultProps} trigger="milestone" milestoneCount={25} />);
      expect(screen.getByText("You've created 25 GIFs!")).toBeInTheDocument();
    });

    test('displays milestone header for 50 GIFs', () => {
      render(<FeedbackModal {...defaultProps} trigger="milestone" milestoneCount={50} />);
      expect(screen.getByText("You've created 50 GIFs!")).toBeInTheDocument();
    });

    test('displays time-based header for time trigger', () => {
      render(<FeedbackModal {...defaultProps} trigger="time" />);
      expect(screen.getByText('Thanks for using YTGify!')).toBeInTheDocument();
    });

    test('displays post-success header for post-success trigger', () => {
      render(<FeedbackModal {...defaultProps} trigger="post-success" />);
      expect(screen.getByText('Nice GIF!')).toBeInTheDocument();
    });
  });

  describe('Feature Vote Cards', () => {
    test('renders all 4 proposed features', () => {
      render(<FeedbackModal {...defaultProps} />);

      expect(screen.getByText('Save to Cloud')).toBeInTheDocument();
      expect(screen.getByText('Community Gallery')).toBeInTheDocument();
      expect(screen.getByText('Slack Integration')).toBeInTheDocument();
      expect(screen.getByText('Discord Integration')).toBeInTheDocument();
    });

    test('renders feature descriptions', () => {
      render(<FeedbackModal {...defaultProps} />);

      expect(screen.getByText('Store your GIFs in cloud storage')).toBeInTheDocument();
      expect(screen.getByText('Browse and discover GIFs')).toBeInTheDocument();
    });
  });

  describe('Survey Link', () => {
    test('renders Take detailed survey button', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Take detailed survey')).toBeInTheDocument();
    });

    test('clicking survey link opens external URL', async () => {
      render(<FeedbackModal {...defaultProps} />);

      const surveyButton = screen.getByText('Take detailed survey');
      fireEvent.click(surveyButton);

      await waitFor(() => {
        expect(mockOpenExternalLink).toHaveBeenCalledWith('https://forms.gle/mock-survey-id');
      });
    });

    test('clicking survey link records click', async () => {
      render(<FeedbackModal {...defaultProps} />);

      const surveyButton = screen.getByText('Take detailed survey');
      fireEvent.click(surveyButton);

      await waitFor(() => {
        expect(mockRecordSurveyClicked).toHaveBeenCalled();
      });
    });
  });

  describe('Suggestion Textarea', () => {
    test('renders suggestion textarea with label', () => {
      render(<FeedbackModal {...defaultProps} />);

      expect(screen.getByText('Have another idea?')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Tell us what feature would make YTGify better...')).toBeInTheDocument();
    });

    test('captures suggestion input', () => {
      render(<FeedbackModal {...defaultProps} />);

      const textarea = screen.getByPlaceholderText('Tell us what feature would make YTGify better...');
      fireEvent.change(textarea, { target: { value: 'Add GIF editing features' } });

      expect(textarea).toHaveValue('Add GIF editing features');
    });
  });

  describe('Action Buttons', () => {
    test('renders Maybe Later button', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Maybe Later')).toBeInTheDocument();
    });

    test('renders Submit Feedback button', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Submit Feedback')).toBeInTheDocument();
    });

    test('clicking Maybe Later calls onClose', () => {
      const onClose = jest.fn();
      render(<FeedbackModal {...defaultProps} onClose={onClose} />);

      const maybeLaterButton = screen.getByText('Maybe Later');
      fireEvent.click(maybeLaterButton);

      expect(onClose).toHaveBeenCalled();
    });

    test('clicking close button calls onClose', () => {
      const onClose = jest.fn();
      render(<FeedbackModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });

    test('clicking Submit Feedback calls onSubmit after recording', async () => {
      const onSubmit = jest.fn();
      render(<FeedbackModal {...defaultProps} onSubmit={onSubmit} />);

      const submitButton = screen.getByText('Submit Feedback');
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockRecordFeedbackSubmitted).toHaveBeenCalled();
        expect(onSubmit).toHaveBeenCalled();
      });
    });

    test('submit button shows loading state while submitting', async () => {
      render(<FeedbackModal {...defaultProps} />);

      const submitButton = screen.getByText('Submit Feedback');
      fireEvent.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Subtitle and Structure', () => {
    test('renders help subtitle', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Help us improve YTGify')).toBeInTheDocument();
    });

    test('renders vote section title', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText("Vote for features you'd like:")).toBeInTheDocument();
    });
  });
});
