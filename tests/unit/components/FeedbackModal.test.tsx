import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import FeedbackModal from '../../../src/content/overlay-wizard/components/FeedbackModal';

// Mock CSS imports
jest.mock('../../../src/content/wizard-styles.css', () => ({}));

// Mock features module
jest.mock('../../../src/constants/features', () => ({
  EXTERNAL_SURVEY_URL: 'https://forms.gle/mock-survey-id',
}));

// Mock links module
const mockOpenExternalLink = jest.fn();
jest.mock('../../../src/constants/links', () => ({
  openExternalLink: (...args: unknown[]) => mockOpenExternalLink(...args),
}));

// Mock feedback tracker
const mockRecordSurveyClicked = jest.fn().mockResolvedValue(undefined);
const mockRecordPermanentDismiss = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/shared/feedback-tracker', () => ({
  feedbackTracker: {
    recordSurveyClicked: () => mockRecordSurveyClicked(),
    recordPermanentDismiss: () => mockRecordPermanentDismiss(),
  },
}));

describe('FeedbackModal Component', () => {
  const defaultProps = {
    onClose: jest.fn(),
    onPermanentDismiss: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Header and Content', () => {
    test('displays header text', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Help us improve YTGify')).toBeInTheDocument();
    });

    test('displays subtitle', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Your feedback helps shape future features')).toBeInTheDocument();
    });
  });

  describe('Take Survey Button', () => {
    test('renders Take Survey button', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText('Take Survey')).toBeInTheDocument();
    });

    test('clicking Take Survey opens external URL', async () => {
      render(<FeedbackModal {...defaultProps} />);

      const surveyButton = screen.getByText('Take Survey');
      fireEvent.click(surveyButton);

      await waitFor(() => {
        expect(mockOpenExternalLink).toHaveBeenCalledWith('https://forms.gle/mock-survey-id');
      });
    });

    test('clicking Take Survey records click and closes modal', async () => {
      const onClose = jest.fn();
      render(<FeedbackModal {...defaultProps} onClose={onClose} />);

      const surveyButton = screen.getByText('Take Survey');
      fireEvent.click(surveyButton);

      await waitFor(() => {
        expect(mockRecordSurveyClicked).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });

  describe('Dont Show Again Button', () => {
    test('renders Dont show again button', () => {
      render(<FeedbackModal {...defaultProps} />);
      expect(screen.getByText("Don't show again")).toBeInTheDocument();
    });

    test('clicking Dont show again records permanent dismiss', async () => {
      const onPermanentDismiss = jest.fn();
      render(<FeedbackModal {...defaultProps} onPermanentDismiss={onPermanentDismiss} />);

      const dismissButton = screen.getByText("Don't show again");
      fireEvent.click(dismissButton);

      await waitFor(() => {
        expect(mockRecordPermanentDismiss).toHaveBeenCalled();
        expect(onPermanentDismiss).toHaveBeenCalled();
      });
    });
  });

  describe('Close Button', () => {
    test('clicking close button calls onClose', () => {
      const onClose = jest.fn();
      render(<FeedbackModal {...defaultProps} onClose={onClose} />);

      const closeButton = screen.getByLabelText('Close');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalled();
    });
  });
});
